import { defineAction } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { notFound, requireScope } from "../server/apprentice/services/core.js";
import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description: "Dismiss a pattern candidate so Apprentice stops proposing it.",
  schema: z.object({ candidateId: z.string().min(1) }),
  audit: { target: (a) => ({ type: "pattern", id: a.candidateId }), summary: () => "Dismissed pattern" },
  run: async ({ candidateId }, ctx) => {
    const scope = requireScope(ctx);
    const rows = await getDb()
      .update(schema.patternCandidates)
      .set({ status: "dismissed", updatedAt: Date.now() })
      .where(and(eq(schema.patternCandidates.ownerEmail, scope.ownerEmail), eq(schema.patternCandidates.id, candidateId)))
      .returning({ id: schema.patternCandidates.id });
    if (!rows.length) notFound(`Pattern ${candidateId}`);
    return { id: candidateId, status: "dismissed" as const };
  },
});
