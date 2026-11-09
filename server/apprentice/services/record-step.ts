import { readAppState } from "@agent-native/core/application-state";
import { and, eq, lt } from "drizzle-orm";

import { computeSignature } from "../engine/signature.js";
import type { IssueSnapshot, Step } from "../engine/types.js";
import { getDb, schema } from "../../db/index.js";
import { newId, type Scope } from "./core.js";
import { featuresFor, toItemView, type IssueRow } from "./issues.js";
import { refreshCandidates } from "./patterns.js";

/** A demonstration stays open while the same person keeps working the same issue. */
export const IDLE_MS = 5 * 60_000;

type EpisodeRow = typeof schema.episodes.$inferSelect;

async function readNavSnapshot(): Promise<unknown> {
  try {
    const [navigation, selection] = await Promise.all([readAppState("navigation"), readAppState("selection")]);
    return { navigation, selection };
  } catch {
    return null;
  }
}

async function activeLessonId(scope: Scope): Promise<string | null> {
  const [lesson] = await getDb()
    .select({ id: schema.lessons.id })
    .from(schema.lessons)
    .where(and(eq(schema.lessons.ownerEmail, scope.ownerEmail), eq(schema.lessons.status, "recording")))
    .limit(1);
  return lesson?.id ?? null;
}

export async function closeEpisode(scope: Scope, ep: EpisodeRow): Promise<void> {
  await getDb()
    .update(schema.episodes)
    .set({ status: "closed", signature: computeSignature(ep.steps), endedAt: ep.lastStepAt })
    .where(and(eq(schema.episodes.ownerEmail, scope.ownerEmail), eq(schema.episodes.id, ep.id)));
}

/** Close the actor's open demonstrations idle longer than IDLE_MS (lazy close on read). */
export async function closeIdleEpisodes(scope: Scope): Promise<number> {
  const stale = await getDb()
    .select()
    .from(schema.episodes)
    .where(
      and(
        eq(schema.episodes.ownerEmail, scope.ownerEmail),
        eq(schema.episodes.status, "open"),
        lt(schema.episodes.lastStepAt, Date.now() - IDLE_MS),
      ),
    )
    .limit(50);
  for (const ep of stale) await closeEpisode(scope, ep);
  return stale.length;
}

/**
 * Record one human triage step as part of a demonstration (05 §1).
 * Returns true when the step was recorded.
 */
export async function recordStep(
  scope: Scope,
  input: { issueBefore: IssueRow; before: IssueSnapshot; action: string; args: Record<string, unknown> },
): Promise<boolean> {
  const db = getDb();
  const now = Date.now();
  const step: Step = { action: input.action, args: input.args, at: now, nav: await readNavSnapshot() };
  const open = await db
    .select()
    .from(schema.episodes)
    .where(and(eq(schema.episodes.ownerEmail, scope.ownerEmail), eq(schema.episodes.actorEmail, scope.ownerEmail), eq(schema.episodes.status, "open")))
    .limit(10);

  let current: EpisodeRow | null = null;
  for (const ep of open) {
    if (ep.issueId === input.issueBefore.id && now - ep.lastStepAt < IDLE_MS && !current) current = ep;
    else await closeEpisode(scope, ep);
  }

  if (current) {
    await db
      .update(schema.episodes)
      .set({ steps: [...current.steps, step], lastStepAt: now })
      .where(and(eq(schema.episodes.ownerEmail, scope.ownerEmail), eq(schema.episodes.id, current.id)));
  } else {
    const lessonId = await activeLessonId(scope);
    const contextStart = {
      ...toItemView(input.issueBefore),
      ...input.before,
      features: featuresFor(input.issueBefore, input.before),
    };
    await db.insert(schema.episodes).values({
      id: newId("ep"),
      issueId: input.issueBefore.id,
      actorEmail: scope.ownerEmail,
      actorKind: "human",
      source: lessonId ? "lesson" : "watch",
      status: "open",
      steps: [step],
      contextStart,
      context: null,
      signature: null,
      lessonId,
      startedAt: now,
      endedAt: null,
      lastStepAt: now,
      ownerEmail: scope.ownerEmail,
      orgId: scope.orgId,
    });
  }
  await refreshCandidates(scope);
  return true;
}

/** Called when the user leaves an issue: their demonstration on it is complete. */
export async function endDemonstration(scope: Scope, issueId: string): Promise<boolean> {
  const open = await getDb()
    .select()
    .from(schema.episodes)
    .where(
      and(
        eq(schema.episodes.ownerEmail, scope.ownerEmail),
        eq(schema.episodes.actorEmail, scope.ownerEmail),
        eq(schema.episodes.status, "open"),
        eq(schema.episodes.issueId, issueId),
      ),
    )
    .limit(5);
  for (const ep of open) await closeEpisode(scope, ep);
  if (open.length) await refreshCandidates(scope);
  return open.length > 0;
}
