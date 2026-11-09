import { fail } from "@agent-native/core/action";
import { and, desc, eq, gte, inArray } from "drizzle-orm";

import { getDb, schema } from "../../db/index.js";
import { firstRow, newId, notFound, type Scope } from "./core.js";
import { refreshCandidates } from "./patterns.js";
import { closeEpisode } from "./record-step.js";

type RecorderEvent = { type?: unknown; name?: unknown; path?: unknown; key?: unknown; at?: unknown; t?: unknown; ts?: unknown };

const KEEP = new Set(["action", "nav", "state"]);
const MAX_EVENTS = 200;

/** Keep only action / nav / state events and their names (08 §8.6); drop payload bodies. */
export function trimRecorderReport(report: unknown): { events: { type: string; name: string | null; at: number | null }[]; total: number } {
  const raw = report && typeof report === "object" && Array.isArray((report as { events?: unknown }).events) ? ((report as { events: unknown[] }).events as RecorderEvent[]) : Array.isArray(report) ? (report as RecorderEvent[]) : [];
  const events = raw
    .filter((e) => typeof e?.type === "string" && KEEP.has(e.type))
    .slice(0, MAX_EVENTS)
    .map((e) => {
      const name = [e.name, e.path, e.key].find((v) => typeof v === "string") as string | undefined;
      const at = [e.at, e.t, e.ts].find((v) => typeof v === "number") as number | undefined;
      return { type: String(e.type), name: name ?? null, at: at ?? null };
    });
  return { events, total: raw.length };
}

export async function activeLesson(scope: Scope) {
  const [row] = await getDb()
    .select()
    .from(schema.lessons)
    .where(and(eq(schema.lessons.ownerEmail, scope.ownerEmail), eq(schema.lessons.status, "recording")))
    .limit(1);
  return row ?? null;
}

export async function startLesson(scope: Scope) {
  const current = await activeLesson(scope);
  if (current) return current;
  // Steps before the lesson belong to earlier demonstrations.
  const open = await getDb()
    .select()
    .from(schema.episodes)
    .where(and(eq(schema.episodes.ownerEmail, scope.ownerEmail), eq(schema.episodes.actorEmail, scope.ownerEmail), eq(schema.episodes.status, "open")));
  for (const ep of open) await closeEpisode(scope, ep);
  return firstRow(
    await getDb()
      .insert(schema.lessons)
      .values({ id: newId("les"), status: "recording", startedAt: Date.now(), episodeIds: [], ownerEmail: scope.ownerEmail, orgId: scope.orgId })
      .returning(),
  );
}

export async function finishLesson(scope: Scope, input: { lessonId: string; recorderReport: unknown; narration?: string | undefined; cancel?: boolean | undefined }) {
  const [lesson] = await getDb()
    .select()
    .from(schema.lessons)
    .where(and(eq(schema.lessons.ownerEmail, scope.ownerEmail), eq(schema.lessons.id, input.lessonId)))
    .limit(1);
  if (!lesson) notFound(`Lesson ${input.lessonId}`);
  if (lesson.status !== "recording") fail("This lesson is already finished.", { errorCode: "LESSON_CLOSED", statusCode: 409 });
  const episodes = await getDb()
    .select()
    .from(schema.episodes)
    .where(and(eq(schema.episodes.ownerEmail, scope.ownerEmail), eq(schema.episodes.lessonId, lesson.id), gte(schema.episodes.startedAt, lesson.startedAt)));
  const report = trimRecorderReport(input.recorderReport);
  const narration = input.narration?.trim() || null;
  for (const ep of episodes) {
    await getDb()
      .update(schema.episodes)
      .set({ narration, context: { ...(ep.context ?? {}), recorder: report } })
      .where(and(eq(schema.episodes.ownerEmail, scope.ownerEmail), eq(schema.episodes.id, ep.id)));
    if (ep.status === "open") await closeEpisode(scope, ep);
  }
  const row = firstRow(
    await getDb()
      .update(schema.lessons)
      .set({ status: input.cancel ? "cancelled" : "done", endedAt: Date.now(), recorderReport: report, narration, episodeIds: episodes.map((e) => e.id) })
      .where(and(eq(schema.lessons.ownerEmail, scope.ownerEmail), eq(schema.lessons.id, lesson.id)))
      .returning(),
  );
  const candidates = input.cancel ? [] : await refreshCandidates(scope);
  return { lesson: row, demonstrations: episodes.length, newCandidates: candidates.length };
}

export async function listLessons(scope: Scope) {
  const lessons = await getDb().select().from(schema.lessons).where(eq(schema.lessons.ownerEmail, scope.ownerEmail)).orderBy(desc(schema.lessons.startedAt)).limit(50);
  const ids = lessons.flatMap((l) => l.episodeIds);
  const eps = ids.length
    ? await getDb().select().from(schema.episodes).where(and(eq(schema.episodes.ownerEmail, scope.ownerEmail), inArray(schema.episodes.id, ids)))
    : [];
  return lessons.map((l) => ({
    ...l,
    demonstrations: eps
      .filter((e) => l.episodeIds.includes(e.id))
      .map((e) => ({ id: e.id, issueId: e.issueId, number: e.contextStart.number, title: e.contextStart.title, steps: e.steps.map((s) => ({ action: s.action, args: s.args })) })),
  }));
}
