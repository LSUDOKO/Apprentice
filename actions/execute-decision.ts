import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { executeDecision } from "../server/apprentice/services/executor.js";

export default defineAction({
  description: "UI only: the user clicked 'Apply' on a reviewed decision. The click is the human approval.",
  schema: z.object({ decisionId: z.string().min(1) }),
  agentTool: false,
  audit: { target: (a) => ({ type: "decision", id: a.decisionId }), summary: () => "Applied decision" },
  run: async ({ decisionId }, ctx) => {
    const scope = requireScope(ctx);
    const d = await executeDecision(scope, decisionId, { actorKind: "human", approvedBy: scope.ownerEmail });
    return { decisionId: d.id, status: d.status };
  },
});
