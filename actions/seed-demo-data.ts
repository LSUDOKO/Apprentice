import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { seedDemoData } from "../server/apprentice/services/seed.js";

export default defineAction({
  description: "Load the demo dataset (60 invented issues plus past demonstrations) when the user has no issues yet. Safe to call twice.",
  schema: z.object({}),
  retrySafe: true,
  audit: { target: () => ({ type: "workspace", id: "demo" }), summary: () => "Loaded demo data" },
  run: async (_args, ctx) => seedDemoData(requireScope(ctx)),
});
