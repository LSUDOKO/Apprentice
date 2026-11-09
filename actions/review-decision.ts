import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { expectedStepSchema } from "../server/apprentice/action-helpers.js";
import type { ExpectedStep } from "../server/apprentice/engine/types.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { reviewDecision } from "../server/apprentice/services/executor.js";

export default defineAction({
  description:
    "Record the user's verdict on a decision: approve, edit (same steps, different values), override (different steps, or humanSteps: [] for 'this playbook shouldn't apply here'), or skip. Edits and overrides become regression tests. applyNow executes at Draft level and above. Only use when the user gave the verdict.",
  schema: z.object({
    decisionId: z.string().min(1),
    verdict: z.enum(["approve", "edit", "override", "skip"]),
    humanSteps: z.array(expectedStepSchema).max(10).optional().describe("What should happen instead (edit/override)"),
    applyNow: z.boolean().optional().describe("Also apply the approved (or corrected) steps now"),
    note: z.string().max(400).optional(),
  }),
  audit: { target: (a) => ({ type: "decision", id: a.decisionId }), summary: (a) => `Review: ${a.verdict}` },
  run: async (args, ctx) => {
    const r = await reviewDecision(requireScope(ctx), {
      decisionId: args.decisionId,
      verdict: args.verdict,
      ...(args.humanSteps ? { humanSteps: args.humanSteps as ExpectedStep[] } : {}),
      ...(args.applyNow !== undefined ? { applyNow: args.applyNow } : {}),
      ...(args.note ? { note: args.note } : {}),
    });
    return { decisionId: r.decision.id, status: r.decision.status, testNumber: r.testNumber, demoted: r.demoted, executed: r.executed };
  },
});
