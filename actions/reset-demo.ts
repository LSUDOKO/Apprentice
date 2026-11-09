import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { resetDemo } from "../server/apprentice/services/seed.js";
import { getSettings } from "../server/apprentice/services/settings.js";

export default defineAction({
  description: "Demo mode only: wipe all of this user's Apprentice data (issues, playbooks, runs, tests) and reload the demo dataset.",
  schema: z.object({ confirm: z.literal("reset").describe('Must be the string "reset"') }),
  needsApproval: (_args, ctx) => ctx?.caller !== "frontend",
  audit: { target: () => ({ type: "workspace", id: "demo" }), summary: () => "Reset demo data" },
  run: async (_args, ctx) => {
    const scope = requireScope(ctx);
    const settings = await getSettings(scope);
    if (!settings.demoMode) fail("Turn on demo mode in Settings first.", { errorCode: "NOT_DEMO_MODE", statusCode: 409 });
    return resetDemo(scope, settings.demoMode);
  },
});
