import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { undoRun } from "../server/apprentice/services/executor.js";

export default defineAction({
  description: "Undo everything a playbook run changed, newest first: labels, priority, assignee and state are restored and its comments retracted. Issues changed afterwards by someone else are kept and reported as conflicts.",
  schema: z.object({ runId: z.string().min(1) }),
  needsApproval: (_args, ctx) => ctx?.caller !== "frontend",
  audit: { target: (a) => ({ type: "run", id: a.runId }), summary: () => "Undid run" },
  run: async ({ runId }, ctx) => undoRun(requireScope(ctx), runId),
});
