import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { endDemonstration } from "../server/apprentice/services/record-step.js";

export default defineAction({
  description: "UI-only: the user left an issue, so their demonstration on it is complete.",
  schema: z.object({ issueId: z.string().min(1) }),
  agentTool: false,
  audit: { enabled: false },
  run: async ({ issueId }, ctx) => ({ closed: await endDemonstration(requireScope(ctx), issueId) }),
});
