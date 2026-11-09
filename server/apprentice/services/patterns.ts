import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { detectPatterns } from "../engine/patterns.js";
import type { EpisodeLike } from "../engine/types.js";
import { getDb, schema } from "../../db/index.js";
import { newId, type Scope, firstRow } from "./core.js";
import { getSettings } from "./settings.js";

type EpisodeRow = typeof schema.episodes.$inferSelect;
export type CandidateRow = typeof schema.patternCandidates.$inferSelect;

export const EPISODE_LIMIT = 500;

export function toEpisodeLike(row: EpisodeRow): EpisodeLike {
  return {
    id: row.id,
    issueId: row.issueId,
    actorEmail: row.actorEmail,
    source: row.source,
    status: row.status,
    steps: row.steps,
    contextStart: row.contextStart,
    signature: row.signature,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
  };
}

/** All human demonstrations for this user's workspace (their own and seeded teammates'). */
export async function loadEpisodes(scope: Scope, opts: { closedOnly?: boolean } = {}): Promise<EpisodeLike[]> {
  const where = opts.closedOnly
    ? and(eq(schema.episodes.ownerEmail, scope.ownerEmail), eq(schema.episodes.actorKind, "human"), eq(schema.episodes.status, "closed"))
    : and(eq(schema.episodes.ownerEmail, scope.ownerEmail), eq(schema.episodes.actorKind, "human"));
  const rows = await getDb().select().from(schema.episodes).where(where).orderBy(desc(schema.episodes.startedAt)).limit(EPISODE_LIMIT);
  return rows.map(toEpisodeLike);
}

/** Run pattern detection and upsert candidates by signature. Returns the candidates that are new or changed. */
export async function refreshCandidates(scope: Scope): Promise<CandidateRow[]> {
  const db = getDb();
  const settings = await getSettings(scope);
  const [episodes, playbooks, existing] = await Promise.all([
    loadEpisodes(scope),
    db
      .select({ signature: schema.playbooks.signature })
      .from(schema.playbooks)
      .where(and(eq(schema.playbooks.ownerEmail, scope.ownerEmail), ne(schema.playbooks.status, "archived"))),
    db.select().from(schema.patternCandidates).where(eq(schema.patternCandidates.ownerEmail, scope.ownerEmail)).limit(200),
  ]);
  const bySig = new Map(existing.map((c) => [c.signature, c]));
  const settled = new Set(existing.filter((c) => c.status === "dismissed" || c.status === "accepted").map((c) => c.signature));
  const drafts = detectPatterns({
    episodes,
    actorEmail: scope.ownerEmail,
    minSupport: settings.minSupport,
    coveredSignatures: new Set(playbooks.map((p) => p.signature)),
    dismissedSignatures: settled,
  });
  const now = Date.now();
  const changed: CandidateRow[] = [];
  for (const d of drafts) {
    const status = d.conflictWith ? ("conflict" as const) : ("new" as const);
    const values = {
      signature: d.signature,
      status,
      actorEmail: d.actorEmail,
      episodeIds: d.episodeIds,
      trigger: d.trigger,
      steps: d.steps,
      support: d.support,
      weakTrigger: d.weakTrigger ? 1 : 0,
      conflictWith: d.conflictWith,
      suggestedName: d.suggestedName,
      updatedAt: now,
    };
    const prev = bySig.get(d.signature);
    if (prev) {
      if (prev.support === d.support && prev.status === status) continue;
      const row = firstRow(
    await db
        .update(schema.patternCandidates)
        .set(values)
        .where(and(eq(schema.patternCandidates.ownerEmail, scope.ownerEmail), eq(schema.patternCandidates.id, prev.id)))
        .returning(),
  );
      changed.push(row);
    } else {
      const row = firstRow(
    await db
        .insert(schema.patternCandidates)
        .values({ ...values, id: newId("pc"), createdAt: now, ownerEmail: scope.ownerEmail, orgId: scope.orgId })
        .returning(),
  );
      changed.push(row);
    }
  }
  return changed;
}

export async function listCandidates(scope: Scope, statuses: CandidateRow["status"][] = ["new", "conflict"]): Promise<CandidateRow[]> {
  return getDb()
    .select()
    .from(schema.patternCandidates)
    .where(and(eq(schema.patternCandidates.ownerEmail, scope.ownerEmail), inArray(schema.patternCandidates.status, statuses)))
    .orderBy(desc(schema.patternCandidates.updatedAt))
    .limit(20);
}

export async function getCandidate(scope: Scope, id: string): Promise<CandidateRow | null> {
  const [row] = await getDb()
    .select()
    .from(schema.patternCandidates)
    .where(and(eq(schema.patternCandidates.ownerEmail, scope.ownerEmail), eq(schema.patternCandidates.id, id)))
    .limit(1);
  return row ?? null;
}
