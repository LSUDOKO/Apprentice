import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { resolveJudgments, type JudgmentInput } from "../server/apprentice/services/executor.js";

export default defineAction({
  description:
    "Agent only: after run-playbook returns awaiting_judgment, answer each decision's judgment question (matches + one-sentence reason) and write any agent-decides parameters (agentParams[stepId][param]). Call once with all decisions. When unsure, matches: false — exceptions go to the human.",
  schema: z.object({
    runId: z.string().min(1),
    judgments: z
      .array(
        z.object({
          decisionId: z.string().min(1),
          matches: z.boolean(),
          reason: z.string().min(1).max(400),
          agentParams: z.record(z.string(), z.record(z.string(), z.unknown())).optional().describe("stepId → { param: value }"),
        }),
      )
      .min(1)
      .max(50),
  }),
  audit: { target: (a) => ({ type: "run", id: a.runId }), summary: (a) => `Resolved ${a.judgments.length} judgments` },
  run: async (args, ctx) => resolveJudgments(requireScope(ctx), ctx, args.runId, args.judgments as JudgmentInput[]),
});
