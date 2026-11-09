import { defineAction } from "@agent-native/core/action";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";

import { canonicalSteps } from "../server/apprentice/engine/signature.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { closeIdleEpisodes } from "../server/apprentice/services/record-step.js";
import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description:
    "List recorded demonstrations: each is one person working one issue by hand, with ordered steps. Use to answer 'what have I been doing today?'. Defaults to the user's own live demonstrations (not seed history).",
  schema: z.object({
    sinceMs: z.number().optional().describe("Only demonstrations started after this epoch-ms time"),
    issueId: z.string().optional().describe("Only this issue"),
    includeHistory: z.boolean().default(false).describe("Include seeded/team history"),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async (args, ctx) => {
    const scope = requireScope(ctx);
    await closeIdleEpisodes(scope);
    const conds = [eq(schema.episodes.ownerEmail, scope.ownerEmail)];
    if (args.sinceMs) conds.push(gte(schema.episodes.startedAt, args.sinceMs));
    if (args.issueId) conds.push(eq(schema.episodes.issueId, args.issueId));
    const rows = await getDb().select().from(schema.episodes).where(and(...conds)).orderBy(desc(schema.episodes.startedAt)).limit(300);
    const visible = rows.filter((r) => args.includeHistory || r.source !== "seed").slice(0, args.limit);
    return {
      demonstrations: visible.map((e) => ({
        id: e.id,
        issueId: e.issueId,
        number: e.contextStart.number,
        title: e.contextStart.title,
        actorEmail: e.actorEmail,
        source: e.source,
        status: e.status,
        signature: e.signature,
        narration: e.narration,
        startedAt: e.startedAt,
        endedAt: e.endedAt,
        steps: canonicalSteps(e.steps).map((s) => ({ action: s.action, args: s.args })),
      })),
    };
  },
});
