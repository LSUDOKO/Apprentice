import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { recordSuggestionOutcome } from "../server/apprentice/services/assist.js";

export default defineAction({
  description: "UI only: the user accepted (Tab) or dismissed (Esc) a ghost suggestion.",
  schema: z.object({
    issueId: z.string(),
    sourceId: z.string(),
    stepIndex: z.number().int(),
    action: z.string(),
    outcome: z.enum(["accepted", "dismissed"]),
  }),
  agentTool: false,
  audit: { enabled: false },
  run: async (args, ctx) => recordSuggestionOutcome(requireScope(ctx), args),
});
