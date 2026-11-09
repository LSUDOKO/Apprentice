import { fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";

import { applyAction, describeStep } from "../engine/actions.js";
import { deriveFeatures } from "../engine/features.js";
import { computeSignature } from "../engine/signature.js";
import type { IssueSnapshot, ItemView, Step } from "../engine/types.js";
import { getDb, schema } from "../../db/index.js";
import issuesJson from "../seed/issues.json" with { type: "json" };
import historyJson from "../seed/history.json" with { type: "json" };
import { newId, type Scope } from "./core.js";
import { refreshCandidates } from "./patterns.js";
import { updateSettings } from "./settings.js";

type SeedIssue = (typeof issuesJson.issues)[number];
type SeedEpisode = { issueId: string; actor: string; startedHoursAgo: number; steps: { action: string; args: Record<string, unknown>; afterSec: number }[] };

const HOUR = 3_600_000;
const EMPTY: IssueSnapshot = { labels: [], priority: null, component: null, assignee: null, state: "open", closeReason: null, duplicateOf: null };

function viewOf(issue: SeedIssue, snap: IssueSnapshot): ItemView {
  return {
    ...snap,
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    author: issue.author,
    features: deriveFeatures({ ...snap, title: issue.title, body: issue.body, authorIsFirstTime: issue.authorIsFirstTime }),
  };
}

function issueRow(scope: Scope, issue: SeedIssue, snap: IssueSnapshot, now: number) {
  const createdAt = now - issue.createdHoursAgo * HOUR;
  return {
    id: issue.id,
    source: "seed" as const,
    repo: issuesJson.repo,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    author: issue.author,
    ...snap,
    authorIsFirstTime: issue.authorIsFirstTime ? 1 : 0,
    features: viewOf(issue, snap).features,
    createdAt,
    updatedAt: createdAt,
    ownerEmail: scope.ownerEmail,
    orgId: scope.orgId,
  };
}

export async function hasIssues(scope: Scope): Promise<boolean> {
  const [row] = await getDb().select({ id: schema.issues.id }).from(schema.issues).where(eq(schema.issues.ownerEmail, scope.ownerEmail)).limit(1);
  return !!row;
}

/** Load the demo dataset (13-SEED-DATA). Idempotent: does nothing when the user already has issues. */
export async function seedDemoData(scope: Scope): Promise<{ seeded: boolean; issues: number; episodes: number }> {
  if (await hasIssues(scope)) return { seeded: false, issues: 0, episodes: 0 };
  const now = Date.now();
  const episodes = historyJson.episodes as SeedEpisode[];
  const byId = new Map(issuesJson.issues.map((i) => [i.id, i]));
  const state = new Map<string, IssueSnapshot>();
  const episodeRows: (typeof schema.episodes.$inferInsert)[] = [];
  const commentRows: (typeof schema.issueComments.$inferInsert)[] = [];
  const activityRows: (typeof schema.activity.$inferInsert)[] = [];

  for (const ep of [...episodes].sort((a, b) => b.startedHoursAgo - a.startedHoursAgo)) {
    const issue = byId.get(ep.issueId);
    if (!issue) continue;
    const actorEmail = ep.actor === "me" ? scope.ownerEmail : ep.actor;
    const before = state.get(issue.id) ?? EMPTY;
    const contextStart = viewOf(issue, before);
    let snap = before;
    let at = now - ep.startedHoursAgo * HOUR;
    const startedAt = at;
    const steps: Step[] = [];
    for (const s of ep.steps) {
      at += s.afterSec * 1000;
      const { next, comment } = applyAction(snap, s.action, s.args, { author: issue.author });
      snap = next;
      steps.push({ action: s.action, args: s.args, at });
      activityRows.push({
        id: newId("act"),
        issueId: issue.id,
        actorEmail,
        actorKind: "human",
        action: s.action,
        summary: describeStep(s.action, s.args),
        createdAt: at,
        ownerEmail: scope.ownerEmail,
        orgId: scope.orgId,
      });
      if (comment) {
        commentRows.push({ id: newId("cmt"), issueId: issue.id, author: actorEmail, body: comment, createdAt: at, ownerEmail: scope.ownerEmail, orgId: scope.orgId });
      }
    }
    state.set(issue.id, snap);
    episodeRows.push({
      id: newId("ep"),
      issueId: issue.id,
      actorEmail,
      actorKind: "human",
      source: "seed",
      status: "closed",
      steps,
      contextStart,
      context: null,
      signature: computeSignature(steps),
      startedAt,
      endedAt: at,
      lastStepAt: at,
      ownerEmail: scope.ownerEmail,
      orgId: scope.orgId,
    });
  }
  for (const c of historyJson.comments) {
    commentRows.push({ id: newId("cmt"), issueId: c.issueId, author: c.author, body: c.body, createdAt: now - c.hoursAgo * HOUR, ownerEmail: scope.ownerEmail, orgId: scope.orgId });
  }
  const issueRows = issuesJson.issues.filter((i) => i.batch !== "incoming").map((i) => issueRow(scope, i, state.get(i.id) ?? EMPTY, now));

  await getDb().transaction(async (tx) => {
    await tx.insert(schema.issues).values(issueRows);
    if (episodeRows.length) await tx.insert(schema.episodes).values(episodeRows);
    if (commentRows.length) await tx.insert(schema.issueComments).values(commentRows);
    if (activityRows.length) await tx.insert(schema.activity).values(activityRows);
  });
  await updateSettings(scope, { demoMode: true });
  return { seeded: true, issues: issueRows.length, episodes: episodeRows.length };
}

const USER_TABLES = [
  schema.issues,
  schema.issueComments,
  schema.activity,
  schema.episodes,
  schema.patternCandidates,
  schema.lessons,
  schema.suggestionEvents,
  schema.playbooks,
  schema.playbookVersions,
  schema.runs,
  schema.decisions,
  schema.stepExecutions,
  schema.playbookTests,
  schema.digests,
] as const;

/** Wipe this user's Apprentice data and reload the demo. Only in demo mode. */
export async function resetDemo(scope: Scope, demoMode: boolean) {
  if (!demoMode) fail("Reset is only available in demo mode (Settings).", { errorCode: "NOT_DEMO_MODE", statusCode: 409 });
  await getDb().transaction(async (tx) => {
    for (const table of USER_TABLES) await tx.delete(table).where(eq(table.ownerEmail, scope.ownerEmail));
  });
  const result = await seedDemoData(scope);
  await refreshCandidates(scope);
  return result;
}

/** Demo helper: the next batch of "new issues arriving" (seed-061 … seed-068). */
export async function simulateIncoming(scope: Scope, count: number): Promise<{ added: string[] }> {
  const incoming = issuesJson.issues.filter((i) => i.batch === "incoming");
  const existing = await getDb()
    .select({ id: schema.issues.id })
    .from(schema.issues)
    .where(and(eq(schema.issues.ownerEmail, scope.ownerEmail), inArray(schema.issues.id, incoming.map((i) => i.id))));
  const have = new Set(existing.map((e) => e.id));
  const next = incoming.filter((i) => !have.has(i.id)).slice(0, count);
  if (!next.length) return { added: [] };
  const now = Date.now();
  await getDb()
    .insert(schema.issues)
    .values(next.map((i, idx) => ({ ...issueRow(scope, i, EMPTY, now), createdAt: now - (next.length - idx) * 60_000, updatedAt: now })));
  return { added: next.map((i) => i.id) };
}
