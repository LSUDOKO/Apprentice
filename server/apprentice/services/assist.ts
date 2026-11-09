import { and, desc, eq, inArray } from "drizzle-orm";

import { predictNextStep, type PredictionSource, type Suggestion } from "../engine/predict.js";
import { evaluate } from "../engine/triggers.js";
import { getDb, schema } from "../../db/index.js";
import { newId, type Scope } from "./core.js";
import { LOW_CONFIDENCE } from "./executor.js";
import { requireIssue, toItemView } from "./issues.js";
import { listCandidates } from "./patterns.js";
import { listPlaybookRows } from "./playbooks.js";

async function predictionSources(scope: Scope): Promise<PredictionSource[]> {
  const [playbooks, candidates] = await Promise.all([listPlaybookRows(scope, "active"), listCandidates(scope)]);
  return [
    ...playbooks
      .filter((p) => p.trustLevel >= 1)
      .map((p) => ({ id: p.id, kind: "playbook" as const, name: p.name, trustLevel: p.trustLevel, rollingAgreement: p.stats.rollingAgreement, trigger: p.trigger, steps: p.steps })),
    ...candidates.map((c) => ({ id: c.id, kind: "candidate" as const, name: c.suggestedName, trustLevel: 0, rollingAgreement: 0, trigger: c.trigger, steps: c.steps })),
  ];
}

/** Ghost autocomplete (F9) for the current user on one issue. */
export async function predictForIssue(scope: Scope, issueId: string): Promise<Suggestion | null> {
  const issue = await requireIssue(getDb(), scope, issueId);
  if (issue.state !== "open") return null;
  const [episode] = await getDb()
    .select()
    .from(schema.episodes)
    .where(
      and(
        eq(schema.episodes.ownerEmail, scope.ownerEmail),
        eq(schema.episodes.actorEmail, scope.ownerEmail),
        eq(schema.episodes.issueId, issueId),
        eq(schema.episodes.status, "open"),
      ),
    )
    .limit(1);
  const view = toItemView(issue);
  // Only predict for untouched issues or ones the user is working right now.
  if (!episode && (view.labels.length > 0 || view.assignee)) return null;
  return predictNextStep({ issue: view, contextStart: episode?.contextStart ?? null, doneSteps: episode?.steps ?? [], sources: await predictionSources(scope) });
}

export async function recordSuggestionOutcome(scope: Scope, input: { issueId: string; sourceId: string; stepIndex: number; action: string; outcome: "accepted" | "dismissed" }) {
  await getDb().insert(schema.suggestionEvents).values({ id: newId("sug"), ...input, createdAt: Date.now(), ownerEmail: scope.ownerEmail, orgId: scope.orgId });
  return { ok: true };
}

export type ExceptionReason = "NO_MATCH" | "LOW_CONFIDENCE" | "CHECKPOINT_WAITING" | "AWAITING_JUDGMENT" | "CONFLICT";

export type ExceptionItem = {
  issueId: string;
  number: number;
  title: string;
  reason: ExceptionReason;
  detail: string;
  decisionId: string | null;
  playbookId: string | null;
  runId: string | null;
};

/** Exceptions inbox (F6): everything that needs the human. */
export async function listExceptions(scope: Scope, limit: number): Promise<{ items: ExceptionItem[]; counts: Record<ExceptionReason, number> }> {
  const db = getDb();
  const [open, playbooks, pending, conflicts] = await Promise.all([
    db
      .select()
      .from(schema.issues)
      .where(and(eq(schema.issues.ownerEmail, scope.ownerEmail), eq(schema.issues.state, "open")))
      .orderBy(desc(schema.issues.createdAt))
      .limit(200),
    listPlaybookRows(scope, "active"),
    db
      .select()
      .from(schema.decisions)
      .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), inArray(schema.decisions.status, ["pending", "executing"])))
      .orderBy(desc(schema.decisions.createdAt))
      .limit(200),
    db
      .select()
      .from(schema.patternCandidates)
      .where(and(eq(schema.patternCandidates.ownerEmail, scope.ownerEmail), eq(schema.patternCandidates.status, "conflict")))
      .limit(20),
  ]);
  const pbById = new Map(playbooks.map((p) => [p.id, p]));
  const items: ExceptionItem[] = [];
  const withDecision = new Set<string>();
  for (const d of pending) {
    withDecision.add(d.issueId);
    const pb = pbById.get(d.playbookId);
    const base = { issueId: d.issueId, number: d.issueView.number, title: d.issueView.title, decisionId: d.id, playbookId: d.playbookId, runId: d.runId };
    if (d.needsJudgment) items.push({ ...base, reason: "AWAITING_JUDGMENT", detail: `${pb?.name ?? "Playbook"} is waiting for the agent's judgment.` });
    else if (d.confidence < LOW_CONFIDENCE) items.push({ ...base, reason: "LOW_CONFIDENCE", detail: `Confidence ${d.confidence}% on ${pb?.name ?? "a playbook"}.` });
    else if ((pb?.trustLevel ?? 0) >= 3 && d.proposedSteps.some((s) => s.checkpoint || s.destructive)) {
      items.push({ ...base, reason: "CHECKPOINT_WAITING", detail: `${pb?.name ?? "Playbook"} paused at a checkpoint step.` });
    }
  }
  for (const issue of open) {
    if (withDecision.has(issue.id) || issue.labels.length > 0 || issue.assignee) continue;
    const view = toItemView(issue);
    if (!playbooks.some((p) => evaluate(p.trigger, view).deterministicMatch)) {
      items.push({ issueId: issue.id, number: issue.number, title: issue.title, reason: "NO_MATCH", detail: "No playbook matches this kind of issue yet.", decisionId: null, playbookId: null, runId: null });
    }
  }
  for (const c of conflicts) {
    const other = c.conflictWith?.[0];
    items.push({ issueId: "", number: 0, title: c.suggestedName, reason: "CONFLICT", detail: `Your team handles this two ways${other ? ` (${other.actorEmail} does it differently)` : ""}.`, decisionId: null, playbookId: null, runId: null });
  }
  const counts = { NO_MATCH: 0, LOW_CONFIDENCE: 0, CHECKPOINT_WAITING: 0, AWAITING_JUDGMENT: 0, CONFLICT: 0 } as Record<ExceptionReason, number>;
  for (const i of items) counts[i.reason]++;
  return { items: items.slice(0, limit), counts };
}

export async function pendingReviewCount(scope: Scope): Promise<number> {
  const rows = await getDb()
    .select({ id: schema.decisions.id })
    .from(schema.decisions)
    .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.status, "pending")))
    .limit(500);
  return rows.length;
}
