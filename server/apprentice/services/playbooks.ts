import { fail } from "@agent-native/core/action";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { DESTRUCTIVE_ACTIONS, isDomainAction } from "../engine/actions.js";
import { backtest, type BacktestResult } from "../engine/backtest.js";
import { humanMs, median } from "../engine/metrics.js";
import { nameFrom } from "../engine/patterns.js";
import { canonicalSteps, computeSignature } from "../engine/signature.js";
import { skillMarkdown } from "../engine/skill-markdown.js";
import { runTest } from "../engine/tests.js";
import { InvalidTriggerError, validateTrigger } from "../engine/triggers.js";
import { eligibility, rollingAgreement, type Eligibility, type Verdict } from "../engine/trust.js";
import { EMPTY_STATS, type ExpectedStep, type ItemView, type PlaybookStats, type StepSpec, type TestExpectation, type TriggerSpec } from "../engine/types.js";
import { getDb, schema } from "../../db/index.js";
import { newId, notFound, type Scope, firstRow } from "./core.js";
import { getCandidate, loadEpisodes } from "./patterns.js";
import { getSettings } from "./settings.js";

export type PlaybookRow = typeof schema.playbooks.$inferSelect;
export type TestRow = typeof schema.playbookTests.$inferSelect;

export async function loadPlaybook(scope: Scope, id: string): Promise<PlaybookRow | null> {
  const [row] = await getDb()
    .select()
    .from(schema.playbooks)
    .where(and(eq(schema.playbooks.ownerEmail, scope.ownerEmail), eq(schema.playbooks.id, id)))
    .limit(1);
  return row ?? null;
}

export async function requirePlaybook(scope: Scope, id: string): Promise<PlaybookRow> {
  return (await loadPlaybook(scope, id)) ?? notFound(`Playbook ${id}`);
}

export async function listPlaybookRows(scope: Scope, status?: PlaybookRow["status"]): Promise<PlaybookRow[]> {
  const where = status
    ? and(eq(schema.playbooks.ownerEmail, scope.ownerEmail), eq(schema.playbooks.status, status))
    : and(eq(schema.playbooks.ownerEmail, scope.ownerEmail), ne(schema.playbooks.status, "archived"));
  return getDb().select().from(schema.playbooks).where(where).orderBy(desc(schema.playbooks.updatedAt)).limit(100);
}

/** Normalize and validate a recipe coming from the UI or the agent. */
export function validateRecipe(trigger: TriggerSpec, steps: StepSpec[]): StepSpec[] {
  try {
    validateTrigger(trigger);
  } catch (err) {
    if (err instanceof InvalidTriggerError) fail(err.message, { errorCode: "INVALID_TRIGGER", statusCode: 400 });
    throw err;
  }
  if (steps.length === 0) fail("A playbook needs at least one step.", { errorCode: "INVALID_STEPS", statusCode: 400 });
  const ids = new Set<string>();
  return steps.map((s, i) => {
    if (!isDomainAction(s.action)) fail(`Unknown action in step ${i + 1}: ${s.action}`, { errorCode: "INVALID_STEPS", statusCode: 400 });
    const id = s.id && !ids.has(s.id) ? s.id : `s${i + 1}_${crypto.randomUUID().slice(0, 4)}`;
    ids.add(id);
    const destructive = DESTRUCTIVE_ACTIONS.has(s.action);
    return { ...s, id, destructive, checkpoint: s.checkpoint || destructive };
  });
}

export function recipeSignature(steps: readonly StepSpec[]): string {
  return computeSignature(steps.map((s) => ({ action: s.action, args: Object.fromEntries(Object.keys(s.params).map((k) => [k, true])) })));
}

export async function listTests(scope: Scope, playbookId: string): Promise<TestRow[]> {
  return getDb()
    .select()
    .from(schema.playbookTests)
    .where(and(eq(schema.playbookTests.ownerEmail, scope.ownerEmail), eq(schema.playbookTests.playbookId, playbookId)))
    .orderBy(asc(schema.playbookTests.number))
    .limit(500);
}

export type TestOutcome = { id: string; number: number; origin: TestRow["origin"]; pass: boolean; diff: ReturnType<typeof runTest>["diff"] };

/** Evaluate tests against a recipe without saving. */
export function evaluateTests(recipe: { trigger: TriggerSpec; steps: StepSpec[] }, tests: readonly TestRow[]): TestOutcome[] {
  return tests.map((t) => {
    const r = runTest(recipe, t.issueSnapshot, t.expected);
    return { id: t.id, number: t.number, origin: t.origin, pass: r.pass, diff: r.diff };
  });
}

export async function runAndStoreTests(scope: Scope, playbook: Pick<PlaybookRow, "id" | "trigger" | "steps">): Promise<TestOutcome[]> {
  const tests = await listTests(scope, playbook.id);
  const outcomes = evaluateTests(playbook, tests);
  const now = Date.now();
  for (const o of outcomes) {
    await getDb()
      .update(schema.playbookTests)
      .set({ lastResult: o.pass ? "pass" : "fail", lastDiff: o.diff as unknown as Record<string, unknown>, lastRunAt: now })
      .where(and(eq(schema.playbookTests.ownerEmail, scope.ownerEmail), eq(schema.playbookTests.id, o.id)));
  }
  return outcomes;
}

export async function addTest(
  scope: Scope,
  input: { playbookId: string; origin: TestRow["origin"]; issueSnapshot: ItemView; expected: TestExpectation; sourceDecisionId?: string | null },
): Promise<TestRow> {
  const existing = await listTests(scope, input.playbookId);
  const row = firstRow(
    await getDb()
    .insert(schema.playbookTests)
    .values({
      id: newId("tst"),
      playbookId: input.playbookId,
      number: (existing[existing.length - 1]?.number ?? 0) + 1,
      origin: input.origin,
      sourceDecisionId: input.sourceDecisionId ?? null,
      issueSnapshot: input.issueSnapshot,
      expected: input.expected,
      lastResult: null,
      lastDiff: null,
      lastRunAt: null,
      createdAt: Date.now(),
      ownerEmail: scope.ownerEmail,
      orgId: scope.orgId,
    })
    .returning(),
  );
  return row;
}

/** Backtest a recipe against the user's own closed demonstrations (newest first). */
export async function backtestRecipe(scope: Scope, trigger: TriggerSpec, steps: StepSpec[], limit = 100): Promise<BacktestResult> {
  const episodes = (await loadEpisodes(scope, { closedOnly: true })).filter((e) => e.actorEmail === scope.ownerEmail).slice(0, limit);
  return backtest(trigger, steps, episodes);
}

/** Recompute cached stats from decisions, tests and demonstrations. */
export async function computeStats(scope: Scope, playbook: PlaybookRow): Promise<PlaybookStats> {
  const db = getDb();
  const [decisionRows, tests, episodes] = await Promise.all([
    db
      .select({ status: schema.decisions.status, verdict: schema.decisions.verdict, executedAt: schema.decisions.executedAt })
      .from(schema.decisions)
      .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.playbookId, playbook.id)))
      .orderBy(sql`${schema.decisions.reviewedAt} DESC NULLS LAST`)
      .limit(1000),
    listTests(scope, playbook.id),
    loadEpisodes(scope, { closedOnly: true }),
  ]);
  const verdicts = reviewedVerdicts(decisionRows);
  const reviewed = verdicts.filter((v) => v !== "skipped");
  const executed = decisionRows.filter((d) => d.executedAt !== null).length;
  const undone = decisionRows.filter((d) => d.status === "undone").length;
  const source = new Set(playbook.sourceEpisodeIds);
  const sameKind = episodes.filter((e) => e.actorEmail === scope.ownerEmail && (source.has(e.id) || e.signature === playbook.signature));
  return {
    reviewed: reviewed.length,
    approved: reviewed.filter((v) => v === "approved").length,
    overridden: reviewed.filter((v) => v === "overridden").length,
    edited: reviewed.filter((v) => v === "edited").length,
    rollingAgreement: rollingAgreement(verdicts).agreement,
    executed,
    undone,
    testsTotal: tests.length,
    testsPassing: tests.filter((t) => t.lastResult === "pass").length,
    medianHumanMs: median(sameKind.map((e) => humanMs(e.startedAt, e.endedAt))),
  };
}

/** Review verdicts, newest first (rows must be ordered by reviewedAt desc). */
export function reviewedVerdicts(rows: readonly { verdict: Verdict | null }[]): Verdict[] {
  return rows.flatMap((r) => (r.verdict ? [r.verdict] : []));
}

export async function skillInputFor(scope: Scope, playbook: PlaybookRow, stats: PlaybookStats, bt: BacktestResult | null) {
  const sourceIds = playbook.sourceEpisodeIds;
  const sources = sourceIds.length
    ? await getDb()
        .select({ actorEmail: schema.episodes.actorEmail, contextStart: schema.episodes.contextStart, startedAt: schema.episodes.startedAt })
        .from(schema.episodes)
        .where(and(eq(schema.episodes.ownerEmail, scope.ownerEmail), inArray(schema.episodes.id, sourceIds)))
    : [];
  return {
    id: playbook.id,
    name: playbook.name,
    description: playbook.description,
    trigger: playbook.trigger,
    steps: playbook.steps,
    trustLevel: playbook.trustLevel,
    demonstrations: sources.map((s) => ({ actorEmail: s.actorEmail, number: s.contextStart.number, at: s.startedAt })),
    backtest: bt ? { matched: bt.matched, agreed: bt.agreed } : null,
    testsPassing: stats.testsPassing,
    testsTotal: stats.testsTotal,
  };
}

/** Refresh stats + SKILL.md after anything that changes evidence. */
export async function refreshPlaybook(scope: Scope, playbookId: string): Promise<PlaybookRow> {
  const pb = await requirePlaybook(scope, playbookId);
  const stats = await computeStats(scope, pb);
  const bt = await backtestRecipe(scope, pb.trigger, pb.steps);
  const md = skillMarkdown(await skillInputFor(scope, pb, stats, bt));
  const row = firstRow(
    await getDb()
    .update(schema.playbooks)
    .set({ stats, skillMarkdown: md })
    .where(and(eq(schema.playbooks.ownerEmail, scope.ownerEmail), eq(schema.playbooks.id, pb.id)))
    .returning(),
  );
  return row;
}

async function writeVersion(scope: Scope, pb: PlaybookRow, changeNote: string): Promise<void> {
  await getDb()
    .insert(schema.playbookVersions)
    .values({
      id: newId("pbv"),
      playbookId: pb.id,
      version: pb.version,
      snapshot: { name: pb.name, description: pb.description, trigger: pb.trigger, steps: pb.steps, trustLevel: pb.trustLevel, status: pb.status },
      changeNote,
      createdBy: scope.ownerEmail,
      createdAt: Date.now(),
      ownerEmail: scope.ownerEmail,
      orgId: scope.orgId,
    });
}

export type CreatePlaybookInput = {
  name: string;
  description: string;
  trigger: TriggerSpec;
  steps: StepSpec[];
  signature?: string;
  sourceEpisodeIds?: string[];
  changeNote?: string;
};

export async function createPlaybook(scope: Scope, input: CreatePlaybookInput): Promise<PlaybookRow> {
  const steps = validateRecipe(input.trigger, input.steps);
  const now = Date.now();
  const id = newId("pb");
  const pb = firstRow(
    await getDb()
    .insert(schema.playbooks)
    .values({
      id,
      name: input.name.trim(),
      description: input.description.trim(),
      status: "active",
      trustLevel: 1,
      trigger: input.trigger,
      steps,
      version: 1,
      signature: input.signature ?? recipeSignature(steps),
      sourceEpisodeIds: input.sourceEpisodeIds ?? [],
      skillMarkdown: "",
      stats: EMPTY_STATS,
      createdBy: scope.ownerEmail,
      createdAt: now,
      updatedAt: now,
      ownerEmail: scope.ownerEmail,
      orgId: scope.orgId,
    })
    .returning(),
  );
  await writeVersion(scope, pb, input.changeNote ?? "Created from demonstrations");

  if (input.sourceEpisodeIds?.length) {
    const sources = await getDb()
      .select()
      .from(schema.episodes)
      .where(and(eq(schema.episodes.ownerEmail, scope.ownerEmail), inArray(schema.episodes.id, input.sourceEpisodeIds)));
    for (const ep of sources) {
      const expected: ExpectedStep[] = canonicalSteps(ep.steps).map((s) => ({ action: s.action, args: s.args }));
      await addTest(scope, { playbookId: id, origin: "seed", issueSnapshot: ep.contextStart, expected: { applies: true, steps: expected } });
    }
  }
  await runAndStoreTests(scope, pb);
  return refreshPlaybook(scope, id);
}

export type UpdatePatch = { name?: string; description?: string; trigger?: TriggerSpec; steps?: StepSpec[] };

export async function updatePlaybook(
  scope: Scope,
  playbookId: string,
  patch: UpdatePatch,
  opts: { changeNote?: string | undefined; saveAsDraft?: boolean | undefined },
): Promise<{ playbook: PlaybookRow; tests: TestOutcome[] }> {
  const pb = await requirePlaybook(scope, playbookId);
  const trigger = patch.trigger ?? pb.trigger;
  const steps = validateRecipe(trigger, patch.steps ?? pb.steps);
  const outcomes = evaluateTests({ trigger, steps }, await listTests(scope, pb.id));
  const failing = outcomes.filter((o) => !o.pass);
  let status = pb.status;
  if (failing.length && pb.status === "active") {
    if (!opts.saveAsDraft) {
      fail(`Blocked: ${failing.length} test(s) would fail (${failing.map((f) => `#${f.number}`).join(", ")}). Fix the recipe or save as draft.`, {
        errorCode: "TESTS_FAILING",
        statusCode: 409,
        details: { failing: failing.map((f) => ({ number: f.number, failedConditions: f.diff.failedConditions })) },
      });
    }
    status = "draft";
  } else if (!failing.length && pb.status === "draft" && !opts.saveAsDraft) {
    status = "active";
  }
  const row = firstRow(
    await getDb()
    .update(schema.playbooks)
    .set({
      name: patch.name?.trim() || pb.name,
      description: patch.description?.trim() ?? pb.description,
      trigger,
      steps,
      status,
      version: pb.version + 1,
      updatedAt: Date.now(),
    })
    .where(and(eq(schema.playbooks.ownerEmail, scope.ownerEmail), eq(schema.playbooks.id, pb.id)))
    .returning(),
  );
  await writeVersion(scope, row, opts.changeNote?.trim() || "Edited recipe");
  await runAndStoreTests(scope, row);
  return { playbook: await refreshPlaybook(scope, row.id), tests: outcomes };
}

export async function getEligibility(scope: Scope, pb: PlaybookRow): Promise<Eligibility> {
  const settings = await getSettings(scope);
  return eligibility(pb.stats, pb.trustLevel, settings.thresholds);
}

export async function setTrustLevel(scope: Scope, playbookId: string, level: number, reason: string): Promise<PlaybookRow> {
  const pb = await refreshPlaybook(scope, playbookId);
  if (level > pb.trustLevel) {
    if (level !== pb.trustLevel + 1 && pb.trustLevel >= 1) fail("Promote one level at a time.", { errorCode: "NOT_ELIGIBLE", statusCode: 409 });
    const elig = await getEligibility(scope, pb);
    if (!elig.eligible) fail(`Not eligible: ${elig.blockers.join(" ")}`, { errorCode: "NOT_ELIGIBLE", statusCode: 409, details: { blockers: elig.blockers } });
  }
  const now = Date.now();
  const promoted = level > pb.trustLevel;
  const row = firstRow(
    await getDb()
    .update(schema.playbooks)
    .set({
      trustLevel: level,
      updatedAt: now,
      version: pb.version + 1,
      ...(promoted ? { lastPromotedAt: now, demotionReason: null } : { lastDemotedAt: now, demotionReason: reason }),
    })
    .where(and(eq(schema.playbooks.ownerEmail, scope.ownerEmail), eq(schema.playbooks.id, pb.id)))
    .returning(),
  );
  await writeVersion(scope, row, `${promoted ? "Promoted" : "Lowered"} trust to level ${level}: ${reason}`);
  return refreshPlaybook(scope, row.id);
}

export async function listVersions(scope: Scope, playbookId: string) {
  return getDb()
    .select()
    .from(schema.playbookVersions)
    .where(and(eq(schema.playbookVersions.ownerEmail, scope.ownerEmail), eq(schema.playbookVersions.playbookId, playbookId)))
    .orderBy(desc(schema.playbookVersions.version))
    .limit(100);
}

/** Turn a pattern candidate into a playbook (F2). In Team mode, `chosenActorEmail` picks whose way wins (F19). */
export async function createFromCandidate(
  scope: Scope,
  candidateId: string,
  opts: { chosenActorEmail?: string | undefined; name?: string | undefined; description?: string | undefined; note?: string | undefined } = {},
): Promise<PlaybookRow> {
  const candidate = (await getCandidate(scope, candidateId)) ?? notFound(`Pattern candidate ${candidateId}`);
  if (candidate.status === "accepted" && candidate.playbookId) return requirePlaybook(scope, candidate.playbookId);
  if (candidate.status === "dismissed") fail("This pattern was dismissed.", { errorCode: "DISMISSED", statusCode: 409 });
  const other = opts.chosenActorEmail && opts.chosenActorEmail !== candidate.actorEmail ? candidate.conflictWith?.find((c) => c.actorEmail === opts.chosenActorEmail) : undefined;
  if (opts.chosenActorEmail && opts.chosenActorEmail !== candidate.actorEmail && !other) {
    fail(`${opts.chosenActorEmail} has no conflicting approach on this pattern.`, { errorCode: "INVALID_CHOICE", statusCode: 400 });
  }
  const steps = other ? other.steps : candidate.steps;
  const teamNote = candidate.conflictWith?.length
    ? ` Team decision: chose ${other ? other.actorEmail : candidate.actorEmail}'s approach over ${[candidate.actorEmail, ...candidate.conflictWith.map((c) => c.actorEmail)].filter((a) => a !== (other?.actorEmail ?? candidate.actorEmail)).join(", ")}${opts.note ? ` (${opts.note})` : ""}.`
    : "";
  const pb = await createPlaybook(scope, {
    name: opts.name ?? (other ? nameFrom(candidate.trigger, other.steps) : candidate.suggestedName),
    description: (opts.description ?? `Learned from ${candidate.support} demonstrations.`) + teamNote,
    trigger: candidate.trigger,
    steps,
    signature: other ? other.signature : candidate.signature,
    sourceEpisodeIds: other ? other.episodeIds : candidate.episodeIds,
    changeNote: other ? `Created from ${other.actorEmail}'s demonstrations (team decision)` : "Created from demonstrations",
  });
  await getDb()
    .update(schema.patternCandidates)
    .set({ status: "accepted", playbookId: pb.id, updatedAt: Date.now() })
    .where(and(eq(schema.patternCandidates.ownerEmail, scope.ownerEmail), eq(schema.patternCandidates.id, candidate.id)));
  return pb;
}
