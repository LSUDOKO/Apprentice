import type { ActionRunContext } from "@agent-native/core/action";
import { fail } from "@agent-native/core/action";
import { and, asc, desc, eq } from "drizzle-orm";

import { applyAction, DESTRUCTIVE_ACTIONS, describeStep, type DomainActionName } from "../engine/actions.js";
import { deriveFeatures } from "../engine/features.js";
import type { IssueSnapshot, ItemView } from "../engine/types.js";
import { getDb, schema } from "../../db/index.js";
import { actorKindOf, newId, notFound, requireScope, tick, type ActorKind, type Scope, firstRow } from "./core.js";
import { assertExecutable, completeDecisionIfDone } from "./executor.js";
import { recordStep } from "./record-step.js";
import { getSettings } from "./settings.js";

export type IssueRow = typeof schema.issues.$inferSelect;
export type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type DbLike = ReturnType<typeof getDb> | Tx;

export type PlaybookContext = { playbookId: string; runId: string; decisionId: string; stepId: string };

export function snapshotOf(row: Pick<IssueRow, "labels" | "priority" | "component" | "assignee" | "state" | "closeReason" | "duplicateOf">): IssueSnapshot {
  return {
    labels: [...row.labels],
    priority: row.priority,
    component: row.component,
    assignee: row.assignee,
    state: row.state,
    closeReason: row.closeReason,
    duplicateOf: row.duplicateOf,
  };
}

export function toItemView(row: IssueRow): ItemView {
  return {
    ...snapshotOf(row),
    id: row.id,
    number: row.number,
    title: row.title,
    body: row.body,
    author: row.author,
    features: row.features,
  };
}

export function featuresFor(row: Pick<IssueRow, "title" | "body" | "authorIsFirstTime">, snap: IssueSnapshot) {
  return deriveFeatures({ ...snap, title: row.title, body: row.body, authorIsFirstTime: row.authorIsFirstTime === 1 });
}

export async function loadIssue(db: DbLike, scope: Scope, issueId: string): Promise<IssueRow | null> {
  const [row] = await db
    .select()
    .from(schema.issues)
    .where(and(eq(schema.issues.ownerEmail, scope.ownerEmail), eq(schema.issues.id, issueId)))
    .limit(1);
  return row ?? null;
}

export async function requireIssue(db: DbLike, scope: Scope, issueId: string): Promise<IssueRow> {
  return (await loadIssue(db, scope, issueId)) ?? notFound(`Issue ${issueId}`);
}

/** Field-wise compare (jsonb does not preserve key order, so no JSON.stringify). */
export function snapshotsEqual(a: IssueSnapshot, b: IssueSnapshot): boolean {
  const la = [...a.labels].sort();
  const lb = [...b.labels].sort();
  return (
    la.length === lb.length &&
    la.every((l, i) => l === lb[i]) &&
    (a.priority ?? null) === (b.priority ?? null) &&
    (a.component ?? null) === (b.component ?? null) &&
    (a.assignee ?? null) === (b.assignee ?? null) &&
    a.state === b.state &&
    (a.closeReason ?? null) === (b.closeReason ?? null) &&
    (a.duplicateOf ?? null) === (b.duplicateOf ?? null)
  );
}

const META_KEYS = new Set(["issueId", "playbookContext", "suggestion"]);

/** Step args as recorded and replayed: the action input minus routing/meta fields. */
export function stepArgsOf(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([k, v]) => !META_KEYS.has(k) && v !== undefined));
}

export type ApplyInput = {
  issueId: string;
  action: DomainActionName;
  args: Record<string, unknown>;
  actorEmail: string;
  actorKind: ActorKind;
  execution?: PlaybookContext & { approvedBy?: string | null };
  /** When set, refuse to write if the issue no longer matches (undo conflict protection). */
  expectBefore?: IssueSnapshot;
  /** The human's change is being recorded as a demonstration. */
  demonstration?: boolean;
};

export type ApplyOutput = { row: IssueRow; before: IssueSnapshot; after: IssueSnapshot; commentId: string | null; executionId: string | null };

/**
 * The one write path for triage changes. Used by the domain actions (human UI,
 * ad-hoc agent, agent executing a decision) and by the executor (human-approved
 * decisions, autopilot). Writes issue + comment + activity (+ step execution) atomically.
 */
export async function applyIssueMutation(tx: Tx, scope: Scope, input: ApplyInput): Promise<ApplyOutput> {
  const row = await requireIssue(tx, scope, input.issueId);
  const before = snapshotOf(row);
  if (input.expectBefore && !snapshotsEqual(input.expectBefore, before)) {
    fail(`Issue #${row.number} changed since this step was planned.`, { errorCode: "CONFLICT", statusCode: 409 });
  }
  let duplicateOfNumber: number | null = null;
  if (input.action === "mark-duplicate") {
    const targetId = String(input.args.duplicateOfId ?? "");
    if (targetId === row.id) fail("An issue can't be a duplicate of itself.", { errorCode: "INVALID_DUPLICATE", statusCode: 400 });
    const target = await requireIssue(tx, scope, targetId);
    duplicateOfNumber = target.number;
  }
  const { next, comment } = applyAction(before, input.action, input.args, { author: row.author, duplicateOfNumber });
  const now = tick();
  const features = featuresFor(row, next);
  const updated = firstRow(
    await tx
    .update(schema.issues)
    .set({ ...next, features, updatedAt: now })
    .where(and(eq(schema.issues.ownerEmail, scope.ownerEmail), eq(schema.issues.id, row.id)))
    .returning(),
  );

  let commentId: string | null = null;
  if (comment) {
    commentId = newId("cmt");
    await tx.insert(schema.issueComments).values({
      id: commentId,
      issueId: row.id,
      author: input.actorKind === "human" ? input.actorEmail : "apprentice",
      body: comment,
      byAgent: input.actorKind === "human" ? 0 : 1,
      runId: input.execution?.runId ?? null,
      createdAt: now,
      ownerEmail: scope.ownerEmail,
      orgId: scope.orgId,
    });
  }

  let executionId: string | null = null;
  if (input.execution) {
    executionId = newId("exe");
    await tx.insert(schema.stepExecutions).values({
      id: executionId,
      decisionId: input.execution.decisionId,
      runId: input.execution.runId,
      issueId: row.id,
      stepId: input.execution.stepId,
      action: input.action,
      args: input.args,
      before,
      after: next,
      createdCommentId: commentId,
      status: "done",
      executedAt: now,
      ownerEmail: scope.ownerEmail,
      orgId: scope.orgId,
    });
  }

  const label = describeStep(input.action, input.args);
  const approved = input.execution?.approvedBy ? ` · approved by ${input.execution.approvedBy}` : "";
  await tx.insert(schema.activity).values({
    id: newId("act"),
    issueId: row.id,
    actorEmail: input.actorEmail,
    actorKind: input.execution ? (input.actorKind === "automation" ? "automation" : "agent") : input.actorKind,
    action: input.action,
    summary: `${label}${approved}`,
    decisionId: input.execution?.decisionId ?? null,
    runId: input.execution?.runId ?? null,
    demonstration: input.demonstration ? 1 : 0,
    createdAt: now,
    ownerEmail: scope.ownerEmail,
    orgId: scope.orgId,
  });

  return { row: updated, before, after: next, commentId, executionId };
}

export type DomainArgs = {
  issueId: string;
  playbookContext?: PlaybookContext | undefined;
  suggestion?: { sourceId: string; stepIndex: number } | undefined;
} & Record<string, unknown>;

export type MutationResult = {
  issue: { id: string; number: number; labels: string[]; priority: string | null; component: string | null; assignee: string | null; state: string };
  executionId: string | null;
  demonstration: boolean;
};

/** Entry point for every domain action's `run`. */
export async function mutateIssue(ctx: ActionRunContext | undefined, action: DomainActionName, args: DomainArgs): Promise<MutationResult> {
  const scope = requireScope(ctx);
  const stepArgs = stepArgsOf(args);
  const actorKind = actorKindOf(ctx);
  const pc = args.playbookContext;
  if (pc) await assertExecutable(scope, pc, action);
  const demonstration = !pc && ctx?.caller === "frontend" && (await getSettings(scope)).watchMode;
  const out = await getDb().transaction((tx) =>
    applyIssueMutation(tx, scope, {
      issueId: args.issueId,
      action,
      args: stepArgs,
      actorEmail: scope.ownerEmail,
      actorKind,
      ...(pc ? { execution: pc } : {}),
      demonstration,
    }),
  );
  if (pc) await completeDecisionIfDone(scope, pc.decisionId);
  if (demonstration) await recordStep(scope, { issueBefore: out.row, before: out.before, action, args: stepArgs });
  const r = out.row;
  return {
    issue: { id: r.id, number: r.number, labels: r.labels, priority: r.priority, component: r.component, assignee: r.assignee, state: r.state },
    executionId: out.executionId,
    demonstration,
  };
}

export function isDestructive(action: string): boolean {
  return DESTRUCTIVE_ACTIONS.has(action);
}

export async function listComments(scope: Scope, issueId: string) {
  return getDb()
    .select()
    .from(schema.issueComments)
    .where(and(eq(schema.issueComments.ownerEmail, scope.ownerEmail), eq(schema.issueComments.issueId, issueId)))
    .orderBy(asc(schema.issueComments.createdAt))
    .limit(100);
}

export async function listActivity(scope: Scope, issueId: string) {
  return getDb()
    .select()
    .from(schema.activity)
    .where(and(eq(schema.activity.ownerEmail, scope.ownerEmail), eq(schema.activity.issueId, issueId)))
    .orderBy(desc(schema.activity.createdAt))
    .limit(100);
}
