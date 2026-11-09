import type { ActionRunContext } from "@agent-native/core/action";
import { fail } from "@agent-native/core/action";
import { getDbExec } from "@agent-native/core/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { OPTIONAL_PARAMS, type DomainActionName, isDomainAction } from "../engine/actions.js";
import { resolveSteps } from "../engine/bindings.js";
import { confidence, explanation } from "../engine/metrics.js";
import { canonicalSteps } from "../engine/signature.js";
import { expectationFromReview, toExpected } from "../engine/tests.js";
import { describeCondition, evaluate } from "../engine/triggers.js";
import { checkDrift, LEVELS } from "../engine/trust.js";
import type { ExpectedStep, ItemView, ResolvedStep } from "../engine/types.js";
import { getDb, schema } from "../../db/index.js";
import { actorKindOf, newId, notFound, type ActorKind, type Scope, firstRow } from "./core.js";
import { applyIssueMutation, featuresFor, snapshotOf, snapshotsEqual, toItemView, type PlaybookContext } from "./issues.js";
import { addTest, listTests, refreshPlaybook, requirePlaybook, reviewedVerdicts, runAndStoreTests, setTrustLevel, type PlaybookRow } from "./playbooks.js";

export type DecisionRow = typeof schema.decisions.$inferSelect;
export type RunRow = typeof schema.runs.$inferSelect;
type RunMode = RunRow["mode"];

const MODE_BY_LEVEL: Record<number, RunMode> = { 1: "shadow", 2: "draft", 3: "act", 4: "auto" };
const OPEN_DECISION: DecisionRow["status"][] = ["pending", "approved", "edited", "executing"];
const APPLYABLE: DecisionRow["status"][] = [...OPEN_DECISION, "overridden"];
export const LOW_CONFIDENCE = 60;
const RUN_LIMIT = 50;

export async function requireDecision(scope: Scope, id: string): Promise<DecisionRow> {
  const [row] = await getDb()
    .select()
    .from(schema.decisions)
    .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.id, id)))
    .limit(1);
  return row ?? notFound(`Decision ${id}`);
}

export async function requireRun(scope: Scope, id: string): Promise<RunRow> {
  const [row] = await getDb()
    .select()
    .from(schema.runs)
    .where(and(eq(schema.runs.ownerEmail, scope.ownerEmail), eq(schema.runs.id, id)))
    .limit(1);
  return row ?? notFound(`Run ${id}`);
}

function isAgentCaller(ctx: ActionRunContext | undefined): boolean {
  return ctx?.caller === "tool" || ctx?.caller === "mcp" || ctx?.caller === "a2a";
}

function requiredPending(step: ResolvedStep): string[] {
  const optional = OPTIONAL_PARAMS[step.action] ?? new Set<string>();
  return step.pendingAgentParams.filter((p) => !optional.has(p));
}

function stepsToApply(d: DecisionRow): { stepId: string; action: string; args: Record<string, unknown>; pending: string[] }[] {
  if (d.humanSteps) return d.humanSteps.map((s, i) => ({ stepId: `h${i + 1}`, action: s.action, args: s.args, pending: [] }));
  return d.proposedSteps.map((s) => ({ stepId: s.stepId, action: s.action, args: s.args, pending: requiredPending(s) }));
}

/** Guard for an agent executing one step of a decision with playbookContext. */
export async function assertExecutable(scope: Scope, pc: PlaybookContext, action: string): Promise<void> {
  const d = await requireDecision(scope, pc.decisionId);
  if (d.runId !== pc.runId || d.playbookId !== pc.playbookId) fail("playbookContext doesn't match the decision.", { errorCode: "INVALID_CONTEXT", statusCode: 400 });
  if (!OPEN_DECISION.includes(d.status)) fail(`Decision is ${d.status}; it can't be executed.`, { errorCode: "DECISION_CLOSED", statusCode: 409 });
  if (d.needsJudgment) fail("Resolve the judgment for this decision first (resolve-judgments).", { errorCode: "NEEDS_JUDGMENT", statusCode: 409 });
  const step = stepsToApply(d).find((s) => s.stepId === pc.stepId);
  if (!step || step.action !== action) fail(`Step ${pc.stepId} of this decision is not ${action}.`, { errorCode: "INVALID_CONTEXT", statusCode: 400 });
  const [done] = await getDb()
    .select({ id: schema.stepExecutions.id })
    .from(schema.stepExecutions)
    .where(and(eq(schema.stepExecutions.ownerEmail, scope.ownerEmail), eq(schema.stepExecutions.decisionId, d.id), eq(schema.stepExecutions.stepId, pc.stepId), eq(schema.stepExecutions.status, "done")))
    .limit(1);
  if (done) fail("This step was already executed.", { errorCode: "ALREADY_EXECUTED", statusCode: 409 });
  await getDb().update(schema.decisions).set({ status: "executing" }).where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.id, d.id)));
}

/** After an agent-executed step: mark the decision executed once every step ran. */
export async function completeDecisionIfDone(scope: Scope, decisionId: string): Promise<void> {
  const d = await requireDecision(scope, decisionId);
  const done = await getDb()
    .select({ stepId: schema.stepExecutions.stepId })
    .from(schema.stepExecutions)
    .where(and(eq(schema.stepExecutions.ownerEmail, scope.ownerEmail), eq(schema.stepExecutions.decisionId, d.id), eq(schema.stepExecutions.status, "done")));
  const doneIds = new Set(done.map((r) => r.stepId));
  if (stepsToApply(d).every((s) => doneIds.has(s.stepId))) {
    await getDb()
      .update(schema.decisions)
      .set({ status: "executed", executedAt: Date.now() })
      .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.id, d.id)));
    await refreshRunSummary(scope, d.runId);
    await refreshPlaybook(scope, d.playbookId);
  }
}

/** Apply every step of a decision through the shared mutation path, in one transaction. */
export async function executeDecision(scope: Scope, decisionId: string, opts: { actorKind: ActorKind; approvedBy: string | null }): Promise<DecisionRow> {
  const d = await requireDecision(scope, decisionId);
  if (!APPLYABLE.includes(d.status) || (d.status === "overridden" && !d.humanSteps?.length)) {
    fail(`Decision is ${d.status}; nothing to apply.`, { errorCode: "DECISION_CLOSED", statusCode: 409 });
  }
  const steps = stepsToApply(d);
  const blocked = steps.find((s) => s.pending.length > 0);
  if (blocked) fail(`The agent still has to write: ${blocked.pending.join(", ")}.`, { errorCode: "NEEDS_AGENT", statusCode: 409 });
  const now = Date.now();
  await getDb().transaction(async (tx) => {
    for (const step of steps) {
      if (!isDomainAction(step.action)) fail(`Unknown action ${step.action}.`, { errorCode: "INVALID_STEPS", statusCode: 400 });
      await applyIssueMutation(tx, scope, {
        issueId: d.issueId,
        action: step.action as DomainActionName,
        args: step.args,
        actorEmail: scope.ownerEmail,
        actorKind: opts.actorKind,
        execution: { playbookId: d.playbookId, runId: d.runId, decisionId: d.id, stepId: step.stepId, approvedBy: opts.approvedBy },
      });
    }
    await tx
      .update(schema.decisions)
      .set({ status: "executed", executedAt: now })
      .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.id, d.id)));
  });
  return requireDecision(scope, d.id);
}

async function refreshRunSummary(scope: Scope, runId: string): Promise<RunRow> {
  const rows = await getDb()
    .select({ status: schema.decisions.status, needsJudgment: schema.decisions.needsJudgment })
    .from(schema.decisions)
    .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.runId, runId)));
  const count = (s: DecisionRow["status"]) => rows.filter((r) => r.status === s).length;
  const awaiting = rows.filter((r) => r.needsJudgment === 1 && OPEN_DECISION.includes(r.status)).length;
  const run = await requireRun(scope, runId);
  const summary = {
    ...run.summary,
    decisions: rows.length,
    pending: count("pending") + count("executing"),
    approved: count("approved"),
    edited: count("edited"),
    overridden: count("overridden"),
    skipped: count("skipped"),
    executed: count("executed"),
    undone: count("undone"),
    awaitingJudgment: awaiting,
  };
  const status: RunRow["status"] =
    run.status === "undone" ? "undone" : awaiting > 0 ? "awaiting_judgment" : "done";
  const row = firstRow(
    await getDb()
    .update(schema.runs)
    .set({ summary, status, finishedAt: status === "done" ? (run.finishedAt ?? Date.now()) : run.finishedAt })
    .where(and(eq(schema.runs.ownerEmail, scope.ownerEmail), eq(schema.runs.id, runId)))
    .returning(),
  );
  return row;
}

export type RunScope = { issueIds?: string[]; openUntriaged?: boolean };

export type ToExecute = { decisionId: string; issueId: string; number: number; steps: { stepId: string; action: string; args: Record<string, unknown> }[] };

export type JudgmentRequest = {
  decisionId: string;
  issueId: string;
  number: number;
  title: string;
  judgment: string | null;
  agentParams: { stepId: string; action: string; param: string; instruction: string }[];
};

export type RunResult = {
  runId: string;
  mode: RunMode;
  status: RunRow["status"];
  counts: Record<string, number>;
  awaitingJudgment: JudgmentRequest[];
  toExecute: ToExecute[];
  reviewPath: string;
};

async function issuesInScope(scope: Scope, pb: PlaybookRow, runScope: RunScope) {
  const db = getDb();
  const base = and(eq(schema.issues.ownerEmail, scope.ownerEmail), eq(schema.issues.state, "open"));
  if (runScope.issueIds?.length) {
    return db.select().from(schema.issues).where(and(base, inArray(schema.issues.id, runScope.issueIds))).limit(RUN_LIMIT);
  }
  const open = await db.select().from(schema.issues).where(base).orderBy(desc(schema.issues.createdAt)).limit(200);
  const untriaged = open.filter((i) => i.labels.length === 0 && !i.assignee);
  const ids = untriaged.map((i) => i.id);
  if (!ids.length) return [];
  const existing = await db
    .select({ issueId: schema.decisions.issueId })
    .from(schema.decisions)
    .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.playbookId, pb.id), inArray(schema.decisions.issueId, ids), inArray(schema.decisions.status, [...OPEN_DECISION, "executed"])));
  const taken = new Set(existing.map((e) => e.issueId));
  return untriaged.filter((i) => !taken.has(i.id)).slice(0, RUN_LIMIT);
}

function judgmentRequest(d: DecisionRow, pb: PlaybookRow, view: ItemView): JudgmentRequest {
  return {
    decisionId: d.id,
    issueId: d.issueId,
    number: view.number,
    title: view.title,
    judgment: d.judgment ? null : (pb.trigger.judgment ?? null),
    agentParams: d.proposedSteps.flatMap((s) =>
      s.pendingAgentParams.map((param) => {
        const spec = pb.steps.find((x) => x.id === s.stepId)?.params[param];
        return { stepId: s.stepId, action: s.action, param, instruction: spec?.owner === "agent" ? spec.instruction : `Write ${param}` };
      }),
    ),
  };
}

function hasCheckpoint(d: DecisionRow): boolean {
  return d.proposedSteps.some((s) => s.checkpoint || s.destructive);
}

/** Continue a run per trust level once judgments are resolved: execute what the level allows. */
async function continueRun(scope: Scope, ctx: ActionRunContext | undefined, run: RunRow, pb: PlaybookRow): Promise<RunResult> {
  const decisions = await getDb()
    .select()
    .from(schema.decisions)
    .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.runId, run.id)))
    .orderBy(asc(schema.decisions.createdAt));
  const awaiting = decisions.filter((d) => d.needsJudgment === 1 && d.status === "pending");
  const ready = decisions.filter((d) => d.needsJudgment === 0 && d.status === "pending");
  const toExecute: ToExecute[] = [];
  const actorKind = actorKindOf(ctx) === "automation" ? "automation" : "agent";
  for (const d of ready) {
    const autoOk = run.mode === "auto" || (run.mode === "act" && !hasCheckpoint(d));
    if (autoOk) {
      await executeDecision(scope, d.id, { actorKind, approvedBy: null });
    } else if (run.mode !== "shadow" && isAgentCaller(ctx)) {
      toExecute.push({
        decisionId: d.id,
        issueId: d.issueId,
        number: d.issueView.number,
        steps: stepsToApply(d).map(({ stepId, action, args }) => ({ stepId, action, args })),
      });
    }
  }
  const final = await refreshRunSummary(scope, run.id);
  await refreshPlaybook(scope, pb.id);
  return {
    runId: run.id,
    mode: run.mode,
    status: final.status,
    counts: final.summary,
    awaitingJudgment: awaiting.map((d) => judgmentRequest(d, pb, d.issueView)),
    toExecute,
    reviewPath: `/review?run=${run.id}`,
  };
}

export async function runPlaybook(
  scope: Scope,
  ctx: ActionRunContext | undefined,
  input: { playbookId: string; scope: RunScope; trigger: RunRow["trigger"] },
): Promise<RunResult> {
  const pb = await refreshPlaybook(scope, input.playbookId);
  if (pb.status !== "active") fail(`Playbook is ${pb.status}. Only active playbooks run.`, { errorCode: "NOT_ACTIVE", statusCode: 409 });
  if (pb.trustLevel < LEVELS.SUGGEST) fail("This playbook is at Watch level: it only learns. Promote it to Suggest to run it.", { errorCode: "WATCH_ONLY", statusCode: 409 });
  const mode: RunMode = MODE_BY_LEVEL[pb.trustLevel] ?? "shadow";
  const candidates = await issuesInScope(scope, pb, input.scope);
  const runId = newId("run");
  const now = Date.now();
  const agentRun = isAgentCaller(ctx);
  const rows: (typeof schema.decisions.$inferInsert)[] = [];
  let notMatched = 0;
  for (const issue of candidates) {
    const view = toItemView(issue);
    const ev = evaluate(pb.trigger, view);
    if (!ev.deterministicMatch) {
      notMatched++;
      continue;
    }
    const proposed = resolveSteps(pb.steps, view);
    const needsJudgment = ev.needsJudgment || proposed.some((s) => requiredPending(s).length > 0 || (agentRun && s.pendingAgentParams.length > 0));
    rows.push({
      id: newId("dec"),
      runId,
      playbookId: pb.id,
      issueId: issue.id,
      playbookVersion: pb.version,
      issueView: view,
      proposedSteps: proposed,
      needsJudgment: needsJudgment ? 1 : 0,
      judgment: null,
      confidence: confidence({ approved: pb.stats.approved, reviewed: pb.stats.reviewed, conditionResults: ev.conditionResults, judgmentPending: ev.needsJudgment }),
      explanation: explanation({ approved: pb.stats.approved, reviewed: pb.stats.reviewed, conditionResults: ev.conditionResults, judgment: pb.trigger.judgment ?? null }),
      status: "pending",
      createdAt: now + rows.length,
      ownerEmail: scope.ownerEmail,
      orgId: scope.orgId,
    });
  }
  await getDb().transaction(async (tx) => {
    await tx.insert(schema.runs).values({
      id: runId,
      playbookId: pb.id,
      playbookVersion: pb.version,
      mode,
      trigger: input.trigger,
      status: "running",
      itemCount: candidates.length,
      summary: { considered: candidates.length, matched: rows.length, notMatched },
      startedAt: now,
      finishedAt: null,
      createdBy: scope.ownerEmail,
      ownerEmail: scope.ownerEmail,
      orgId: scope.orgId,
    });
    if (rows.length) await tx.insert(schema.decisions).values(rows);
  });
  return continueRun(scope, ctx, await requireRun(scope, runId), pb);
}

export type JudgmentInput = { decisionId: string; matches: boolean; reason: string; agentParams?: Record<string, Record<string, unknown>> };

export async function resolveJudgments(scope: Scope, ctx: ActionRunContext | undefined, runId: string, judgments: JudgmentInput[]): Promise<RunResult> {
  const run = await requireRun(scope, runId);
  const pb = await requirePlaybook(scope, run.playbookId);
  for (const j of judgments) {
    const d = await requireDecision(scope, j.decisionId);
    if (d.runId !== runId) fail(`Decision ${d.id} is not part of run ${runId}.`, { errorCode: "INVALID_CONTEXT", statusCode: 400 });
    if (d.status !== "pending") continue;
    if (!j.matches) {
      await getDb()
        .update(schema.decisions)
        .set({ judgment: { matches: false, reason: j.reason }, needsJudgment: 0, status: "skipped", explanation: `${d.explanation} Agent: doesn't apply — ${j.reason}` })
        .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.id, d.id)));
      continue;
    }
    const proposed = d.proposedSteps.map((s) => {
      const filled = j.agentParams?.[s.stepId] ?? {};
      const args = { ...s.args, ...Object.fromEntries(Object.entries(filled).filter(([k]) => s.pendingAgentParams.includes(k))) };
      return { ...s, args, pendingAgentParams: s.pendingAgentParams.filter((p) => !(p in filled)) };
    });
    const stillMissing = proposed.flatMap((s) => requiredPending(s));
    if (stillMissing.length) fail(`Decision ${d.id} still needs: ${stillMissing.join(", ")}.`, { errorCode: "NEEDS_AGENT", statusCode: 400 });
    await getDb()
      .update(schema.decisions)
      .set({ judgment: { matches: true, reason: j.reason }, needsJudgment: 0, proposedSteps: proposed })
      .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.id, d.id)));
  }
  return continueRun(scope, ctx, run, pb);
}

export type ReviewInput = {
  decisionId: string;
  verdict: "approve" | "edit" | "override" | "skip";
  humanSteps?: ExpectedStep[];
  applyNow?: boolean;
  note?: string;
};

export type ReviewResult = { decision: DecisionRow; testNumber: number | null; demoted: { from: number; to: number; reason: string } | null; executed: boolean };

const VERDICT_STATUS = { approve: "approved", edit: "edited", override: "overridden", skip: "skipped" } as const;

/** Record a human verdict on a decision (F5), turn corrections into tests (F8), check drift (F12). */
export async function reviewDecision(scope: Scope, input: ReviewInput): Promise<ReviewResult> {
  const d = await requireDecision(scope, input.decisionId);
  if (!OPEN_DECISION.includes(d.status) || d.verdict) fail(`Decision already ${d.verdict ?? d.status}.`, { errorCode: "DECISION_CLOSED", statusCode: 409 });
  const pb = await requirePlaybook(scope, d.playbookId);
  const humanSteps = input.humanSteps ? canonicalSteps(input.humanSteps).map((s) => ({ action: s.action, args: s.args })) : null;
  if (input.verdict === "edit" && !humanSteps?.length) fail("An edit needs the corrected steps.", { errorCode: "INVALID_REVIEW", statusCode: 400 });
  for (const s of humanSteps ?? []) {
    if (!isDomainAction(s.action)) fail(`Unknown action ${s.action}.`, { errorCode: "INVALID_REVIEW", statusCode: 400 });
  }
  const status = VERDICT_STATUS[input.verdict];
  const now = Date.now();
  await getDb()
    .update(schema.decisions)
    .set({
      verdict: status,
      status,
      humanSteps: input.verdict === "edit" || input.verdict === "override" ? humanSteps : null,
      reviewer: scope.ownerEmail,
      reviewNote: input.note ?? null,
      reviewedAt: now,
      needsJudgment: input.verdict === "approve" ? 0 : d.needsJudgment,
    })
    .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.id, d.id)));

  let testNumber: number | null = null;
  const expected = expectationFromReview(input.verdict, toExpected(d.proposedSteps), humanSteps);
  if (expected) {
    const test = await addTest(scope, {
      playbookId: pb.id,
      origin: input.verdict === "edit" ? "edit" : "override",
      issueSnapshot: d.issueView,
      expected,
      sourceDecisionId: d.id,
    });
    testNumber = test.number;
    await runAndStoreTests(scope, pb);
  }

  let executed = false;
  const canApply = input.applyNow && pb.trustLevel >= LEVELS.DRAFT && (input.verdict === "approve" || (humanSteps?.length ?? 0) > 0);
  if (canApply) {
    await executeDecision(scope, d.id, { actorKind: "human", approvedBy: scope.ownerEmail });
    executed = true;
  }

  const refreshed = await refreshPlaybook(scope, pb.id);
  const demoted = await applyDrift(scope, refreshed, status);
  await refreshRunSummary(scope, d.runId);
  return { decision: await requireDecision(scope, d.id), testNumber, demoted, executed };
}

/** Demote one level when the drift rules say so; record why. */
export async function applyDrift(scope: Scope, pb: PlaybookRow, latest: "approved" | "edited" | "overridden" | "skipped" | null) {
  const rows = await getDb()
    .select({ verdict: schema.decisions.verdict, reviewedAt: schema.decisions.reviewedAt })
    .from(schema.decisions)
    .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.playbookId, pb.id)))
    .orderBy(desc(schema.decisions.reviewedAt))
    .limit(40);
  const verdicts = reviewedVerdicts(rows.filter((r) => r.reviewedAt !== null));
  const drift = checkDrift({ level: pb.trustLevel, latestVerdict: latest, verdictsNewestFirst: verdicts });
  if (!drift.demote || !drift.reason) return null;
  const to = pb.trustLevel - 1;
  await setTrustLevel(scope, pb.id, to, `Apprentice stepped back: ${drift.reason}`);
  return { from: pb.trustLevel, to, reason: drift.reason };
}

export type UndoResult = { undone: number; conflicts: { executionId: string; issueId: string; reason: string }[] };

async function undoExecutions(scope: Scope, executions: (typeof schema.stepExecutions.$inferSelect)[], actorEmail: string): Promise<UndoResult> {
  const conflicts: UndoResult["conflicts"] = [];
  let undone = 0;
  const now = Date.now();
  const blockedIssues = new Set<string>();
  await getDb().transaction(async (tx) => {
    for (const exe of executions) {
      if (blockedIssues.has(exe.issueId)) {
        conflicts.push({ executionId: exe.id, issueId: exe.issueId, reason: "A later change on this issue could not be undone." });
        continue;
      }
      const [issue] = await tx
        .select()
        .from(schema.issues)
        .where(and(eq(schema.issues.ownerEmail, scope.ownerEmail), eq(schema.issues.id, exe.issueId)))
        .limit(1);
      if (!issue) continue;
      if (!snapshotsEqual(snapshotOf(issue), exe.after)) {
        blockedIssues.add(exe.issueId);
        conflicts.push({ executionId: exe.id, issueId: exe.issueId, reason: `Issue #${issue.number} changed after Apprentice acted; kept the newer work.` });
        continue;
      }
      await tx
        .update(schema.issues)
        .set({ ...exe.before, features: featuresFor(issue, exe.before), updatedAt: now })
        .where(and(eq(schema.issues.ownerEmail, scope.ownerEmail), eq(schema.issues.id, exe.issueId)));
      if (exe.createdCommentId) {
        await tx
          .update(schema.issueComments)
          .set({ retracted: 1 })
          .where(and(eq(schema.issueComments.ownerEmail, scope.ownerEmail), eq(schema.issueComments.id, exe.createdCommentId)));
      }
      await tx
        .update(schema.stepExecutions)
        .set({ status: "undone", undoneAt: now })
        .where(and(eq(schema.stepExecutions.ownerEmail, scope.ownerEmail), eq(schema.stepExecutions.id, exe.id)));
      await tx.insert(schema.activity).values({
        id: newId("act"),
        issueId: exe.issueId,
        actorEmail,
        actorKind: "human",
        action: "undo",
        summary: `Undid ${exe.action}`,
        decisionId: exe.decisionId,
        runId: exe.runId,
        createdAt: now,
        ownerEmail: scope.ownerEmail,
        orgId: scope.orgId,
      });
      undone++;
    }
  });
  const decisionIds = [...new Set(executions.map((e) => e.decisionId))];
  for (const id of decisionIds) {
    const left = await getDb()
      .select({ id: schema.stepExecutions.id })
      .from(schema.stepExecutions)
      .where(and(eq(schema.stepExecutions.ownerEmail, scope.ownerEmail), eq(schema.stepExecutions.decisionId, id), eq(schema.stepExecutions.status, "done")))
      .limit(1);
    if (!left.length) {
      await getDb().update(schema.decisions).set({ status: "undone" }).where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.id, id)));
    }
  }
  return { undone, conflicts };
}

async function doneExecutions(scope: Scope, where: { runId?: string; decisionId?: string }) {
  const filter = where.runId ? eq(schema.stepExecutions.runId, where.runId) : eq(schema.stepExecutions.decisionId, where.decisionId ?? "");
  return getDb()
    .select()
    .from(schema.stepExecutions)
    .where(and(eq(schema.stepExecutions.ownerEmail, scope.ownerEmail), filter, eq(schema.stepExecutions.status, "done")))
    .orderBy(desc(schema.stepExecutions.executedAt), desc(schema.stepExecutions.id));
}

/** Batch undo (F11): revert a whole run newest-first, refusing to overwrite newer work. */
export async function undoRun(scope: Scope, runId: string): Promise<UndoResult> {
  const run = await requireRun(scope, runId);
  const result = await undoExecutions(scope, await doneExecutions(scope, { runId }), scope.ownerEmail);
  if (!result.conflicts.length) {
    await getDb().update(schema.runs).set({ status: "undone" }).where(and(eq(schema.runs.ownerEmail, scope.ownerEmail), eq(schema.runs.id, runId)));
  }
  await refreshRunSummary(scope, runId);
  await refreshPlaybook(scope, run.playbookId);
  return result;
}

export async function undoDecision(scope: Scope, decisionId: string): Promise<UndoResult> {
  const d = await requireDecision(scope, decisionId);
  const result = await undoExecutions(scope, await doneExecutions(scope, { decisionId }), scope.ownerEmail);
  await refreshRunSummary(scope, d.runId);
  await refreshPlaybook(scope, d.playbookId);
  return result;
}

export type AuditEvent = { id: string; action: string; caller: string; actorKind: string; actorEmail: string | null; status: string; summary: string | null; createdAt: number };

/** Framework audit events for an issue, scoped to the caller. */
export async function auditEventsFor(scope: Scope, issueId: string, limit = 20): Promise<AuditEvent[]> {
  try {
    const { rows } = await getDbExec().execute({
      sql: `SELECT id, action, caller, actor_kind, actor_email, status, summary, created_at FROM agent_audit_log
            WHERE target_type = ? AND target_id = ? AND (owner_email = ? OR actor_email = ?) ORDER BY created_at DESC LIMIT ?`,
      args: ["issue", issueId, scope.ownerEmail, scope.ownerEmail, limit],
    });
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      action: String(r.action),
      caller: String(r.caller),
      actorKind: String(r.actor_kind),
      actorEmail: (r.actor_email as string | null) ?? null,
      status: String(r.status),
      summary: (r.summary as string | null) ?? null,
      createdAt: Number(r.created_at),
    }));
  } catch {
    return [];
  }
}

/** Provenance (F10): which playbook version, which conditions, which demonstrations taught it. */
export async function explainDecision(scope: Scope, decisionId: string) {
  const d = await requireDecision(scope, decisionId);
  const pb = await requirePlaybook(scope, d.playbookId);
  const [version] = await getDb()
    .select()
    .from(schema.playbookVersions)
    .where(and(eq(schema.playbookVersions.ownerEmail, scope.ownerEmail), eq(schema.playbookVersions.playbookId, pb.id), eq(schema.playbookVersions.version, d.playbookVersion)))
    .limit(1);
  const trigger = version?.snapshot.trigger ?? pb.trigger;
  const ev = evaluate(trigger, d.issueView);
  const sources = pb.sourceEpisodeIds.length
    ? await getDb()
        .select()
        .from(schema.episodes)
        .where(and(eq(schema.episodes.ownerEmail, scope.ownerEmail), inArray(schema.episodes.id, pb.sourceEpisodeIds)))
    : [];
  const executions = await getDb()
    .select()
    .from(schema.stepExecutions)
    .where(and(eq(schema.stepExecutions.ownerEmail, scope.ownerEmail), eq(schema.stepExecutions.decisionId, d.id)))
    .orderBy(asc(schema.stepExecutions.executedAt));
  const tests = await listTests(scope, pb.id);
  return {
    decision: {
      id: d.id,
      status: d.status,
      verdict: d.verdict,
      confidence: d.confidence,
      explanation: d.explanation,
      judgment: d.judgment,
      reviewer: d.reviewer,
      issueId: d.issueId,
      number: d.issueView.number,
      title: d.issueView.title,
      runId: d.runId,
      createdAt: d.createdAt,
      executedAt: d.executedAt,
    },
    playbook: { id: pb.id, name: pb.name, version: d.playbookVersion, currentVersion: pb.version, trustLevel: pb.trustLevel },
    conditions: ev.conditionResults.map((r) => ({ text: describeCondition(r.cond), actual: r.actual ?? null, pass: r.pass })),
    judgmentQuestion: trigger.judgment ?? null,
    demonstrations: sources.map((e) => ({
      episodeId: e.id,
      actorEmail: e.actorEmail,
      source: e.source,
      issueId: e.issueId,
      number: e.contextStart.number,
      title: e.contextStart.title,
      at: e.startedAt,
      steps: canonicalSteps(e.steps).map((s) => ({ action: s.action, args: s.args })),
      narration: e.narration,
    })),
    executions: executions.map((x) => ({ id: x.id, action: x.action, args: x.args, status: x.status, executedAt: x.executedAt })),
    tests: { total: tests.length, passing: tests.filter((t) => t.lastResult === "pass").length },
    auditEvents: await auditEventsFor(scope, d.issueId),
  };
}

export async function listDecisionRows(scope: Scope, filter: { runId?: string; playbookId?: string; status?: DecisionRow["status"]; issueId?: string; limit: number }) {
  const conds = [eq(schema.decisions.ownerEmail, scope.ownerEmail)];
  if (filter.runId) conds.push(eq(schema.decisions.runId, filter.runId));
  if (filter.playbookId) conds.push(eq(schema.decisions.playbookId, filter.playbookId));
  if (filter.status) conds.push(eq(schema.decisions.status, filter.status));
  if (filter.issueId) conds.push(eq(schema.decisions.issueId, filter.issueId));
  return getDb()
    .select()
    .from(schema.decisions)
    .where(and(...conds))
    .orderBy(desc(schema.decisions.createdAt))
    .limit(filter.limit);
}
