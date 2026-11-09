import { fail } from "@agent-native/core/action";
import type { ActionRunContext } from "@agent-native/core/action";

export type Scope = { ownerEmail: string; orgId: string | null };

export type ActorKind = "human" | "agent" | "automation";

/** Resolve the signed-in user. Apprentice never falls back to a shared identity. */
export function requireScope(ctx: ActionRunContext | undefined): Scope {
  const ownerEmail = ctx?.userEmail ?? fail("Sign in to use Apprentice.", { errorCode: "UNAUTHENTICATED", statusCode: 401 });
  return { ownerEmail, orgId: ctx?.orgId ?? null };
}

/** Who performed a call, as Apprentice reports it in timelines and provenance. */
export function actorKindOf(ctx: ActionRunContext | undefined): ActorKind {
  switch (ctx?.caller) {
    case "frontend":
    case "cli":
    case "http":
      return "human";
    case "automation":
      return "automation";
    default:
      return "agent";
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function notFound(what: string): never {
  return fail(`${what} not found.`, { errorCode: "NOT_FOUND", statusCode: 404 });
}

export const DEMO_TEACHER = "bob@demo.local";

/** First row of a `.returning()` / `.limit(1)` result that must exist. */
export function firstRow<T>(rows: readonly T[], what = "Row"): T {
  const row = rows[0];
  if (row === undefined) throw new Error(`${what} was not written.`);
  return row;
}

let lastTick = 0;
/** Strictly increasing ms timestamp so steps written in one transaction keep their order (undo replays newest-first).
 * ponytail: per-process counter; across processes ties fall back to id order. */
export function tick(): number {
  lastTick = Math.max(Date.now(), lastTick + 1);
  return lastTick;
}
