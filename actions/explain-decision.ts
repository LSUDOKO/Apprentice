import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { explainDecision } from "../server/apprentice/services/executor.js";

export default defineAction({
  description:
    "'Why did you do that?' / 'Who taught you this?': provenance for a decision — playbook and version, which trigger conditions matched with their values, the judgment, the human demonstrations it was learned from, executions and audit events.",
  schema: z.object({ decisionId: z.string().min(1) }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ decisionId }, ctx) => explainDecision(requireScope(ctx), decisionId),
});
