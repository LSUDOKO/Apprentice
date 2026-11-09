import { defineAction } from "@agent-native/core/action";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description: "List recent playbook runs with mode (shadow/draft/act/auto), status and counts.",
  schema: z.object({ playbookId: z.string().optional(), limit: z.number().int().min(1).max(100).default(20) }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ playbookId, limit }, ctx) => {
    const scope = requireScope(ctx);
    const where = playbookId ? and(eq(schema.runs.ownerEmail, scope.ownerEmail), eq(schema.runs.playbookId, playbookId)) : eq(schema.runs.ownerEmail, scope.ownerEmail);
    const [runs, playbooks] = await Promise.all([
      getDb().select().from(schema.runs).where(where).orderBy(desc(schema.runs.startedAt)).limit(limit),
      getDb().select({ id: schema.playbooks.id, name: schema.playbooks.name }).from(schema.playbooks).where(eq(schema.playbooks.ownerEmail, scope.ownerEmail)),
    ]);
    const names = new Map(playbooks.map((p) => [p.id, p.name]));
    return { runs: runs.map((r) => ({ ...r, playbookName: names.get(r.playbookId) ?? "Playbook" })) };
  },
});
