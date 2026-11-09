import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { undoDecision } from "../server/apprentice/services/executor.js";

export default defineAction({
  description: "Undo one executed decision (restore the issue and retract the comment it posted).",
  schema: z.object({ decisionId: z.string().min(1) }),
  needsApproval: (_args, ctx) => ctx?.caller !== "frontend",
  audit: { target: (a) => ({ type: "decision", id: a.decisionId }), summary: () => "Undid decision" },
  run: async ({ decisionId }, ctx) => undoDecision(requireScope(ctx), decisionId),
});
