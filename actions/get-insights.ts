import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { getInsights } from "../server/apprentice/services/ops.js";

export default defineAction({
  description: "Apprentice impact: estimated hours saved (per playbook and total), items handled, agreement over time, autonomy per playbook, ghost suggestion acceptance and exceptions. All time numbers are estimates.",
  schema: z.object({ rangeDays: z.number().int().min(1).max(365).default(30) }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  run: async ({ rangeDays }, ctx) => getInsights(requireScope(ctx), rangeDays),
});
