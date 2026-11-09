import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { listExceptions } from "../server/apprentice/services/assist.js";

export default defineAction({
  description:
    "Everything that needs the human: issues no playbook matches (NO_MATCH), low-confidence decisions, checkpoints waiting, decisions awaiting the agent's judgment, and team conflicts. Use for 'what's next?'.",
  schema: z.object({ limit: z.number().int().min(1).max(200).default(100) }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ limit }, ctx) => listExceptions(requireScope(ctx), limit),
});
