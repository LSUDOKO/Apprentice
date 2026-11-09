import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { updateSettings } from "../server/apprentice/services/settings.js";

export default defineAction({
  description: "Turn watch mode on or off. While on, the user's own triage clicks are recorded as demonstrations Apprentice can learn from.",
  schema: z.object({ on: z.boolean().describe("true to watch, false to pause") }),
  audit: { target: () => ({ type: "settings", id: "watchMode" }), summary: (a) => `Watch mode ${a.on ? "on" : "off"}` },
  run: async ({ on }, ctx) => {
    const s = await updateSettings(requireScope(ctx), { watchMode: on });
    return { watchMode: s.watchMode };
  },
});
