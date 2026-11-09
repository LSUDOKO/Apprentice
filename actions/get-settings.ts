import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { getSettings } from "../server/apprentice/services/settings.js";

export default defineAction({
  description: "Apprentice settings: watch mode, demo mode (lower promotion thresholds), min support for patterns, GitHub repo, and the promotion thresholds in effect.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async (_args, ctx) => getSettings(requireScope(ctx)),
});
