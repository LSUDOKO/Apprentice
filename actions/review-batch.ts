import { defineAction } from "@agent-native/core/action";
import { embedRoute } from "@agent-native/core";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description:
    "Get the latest Apprentice batch waiting for review (or a specific run) — counts and the issues waiting — with a link to review it. Capable chat apps show the real review screen inline.",
  schema: z.object({ runId: z.string().optional().describe("Run id; omit for the latest run with pending decisions") }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  ...embedRoute<{ runId?: string | undefined }, { runId: string | null }>({
    title: "Review Apprentice batch",
    openLabel: "Open in Apprentice",
    path: ({ result }) => (result?.runId ? `/review?run=${encodeURIComponent(result.runId)}&embed=1` : "/review?embed=1"),
  }),
  run: async ({ runId }, ctx) => {
    const scope = requireScope(ctx);
    const pending = await getDb()
      .select({ id: schema.decisions.id, runId: schema.decisions.runId, issueView: schema.decisions.issueView, confidence: schema.decisions.confidence })
      .from(schema.decisions)
      .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), eq(schema.decisions.status, "pending"), ...(runId ? [eq(schema.decisions.runId, runId)] : [])))
      .orderBy(desc(schema.decisions.createdAt))
      .limit(50);
    const target = runId ?? pending[0]?.runId ?? null;
    const inRun = pending.filter((p) => p.runId === target);
    return {
      runId: target,
      pending: inRun.length,
      items: inRun.map((p) => ({ decisionId: p.id, number: p.issueView.number, title: p.issueView.title, confidence: p.confidence })),
      message: target ? `${inRun.length} decision(s) waiting for review.` : "Nothing waiting for review.",
    };
  },
});
