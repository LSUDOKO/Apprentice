import { defineAction } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { describeStep } from "../server/apprentice/engine/actions.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { listDecisionRows } from "../server/apprentice/services/executor.js";
import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description: "List Apprentice decisions (what a playbook proposed for an issue) for a run, playbook or status, with steps, confidence and explanation.",
  schema: z.object({
    runId: z.string().optional(),
    playbookId: z.string().optional(),
    status: z.enum(["pending", "approved", "edited", "overridden", "skipped", "executing", "executed", "undone", "failed"]).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async (args, ctx) => {
    const scope = requireScope(ctx);
    const rows = await listDecisionRows(scope, { ...(args.runId ? { runId: args.runId } : {}), ...(args.playbookId ? { playbookId: args.playbookId } : {}), ...(args.status ? { status: args.status } : {}), limit: args.limit });
    const pbIds = [...new Set(rows.map((r) => r.playbookId))];
    const playbooks = pbIds.length
      ? await getDb()
          .select({ id: schema.playbooks.id, name: schema.playbooks.name, trustLevel: schema.playbooks.trustLevel, steps: schema.playbooks.steps })
          .from(schema.playbooks)
          .where(and(eq(schema.playbooks.ownerEmail, scope.ownerEmail), inArray(schema.playbooks.id, pbIds)))
      : [];
    const byId = new Map(playbooks.map((p) => [p.id, p]));
    return {
      decisions: rows
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((d) => {
          const pb = byId.get(d.playbookId);
          return {
            id: d.id,
            runId: d.runId,
            playbookId: d.playbookId,
            playbookName: pb?.name ?? "Playbook",
            trustLevel: pb?.trustLevel ?? 0,
            issueId: d.issueId,
            number: d.issueView.number,
            title: d.issueView.title,
            body: d.issueView.body,
            author: d.issueView.author,
            labels: d.issueView.labels,
            status: d.status,
            verdict: d.verdict,
            confidence: d.confidence,
            explanation: d.explanation,
            needsJudgment: d.needsJudgment === 1,
            judgment: d.judgment,
            humanSteps: d.humanSteps,
            steps: d.proposedSteps.map((s) => ({
              ...s,
              label: describeStep(s.action, s.args),
              instructions: Object.fromEntries(
                s.pendingAgentParams.map((p) => {
                  const spec = pb?.steps.find((x) => x.id === s.stepId)?.params[p];
                  return [p, spec?.owner === "agent" ? spec.instruction : ""];
                }),
              ),
            })),
            reviewer: d.reviewer,
            reviewedAt: d.reviewedAt,
            executedAt: d.executedAt,
            createdAt: d.createdAt,
          };
        }),
    };
  },
});
