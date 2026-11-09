import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { updateSettings } from "../server/apprentice/services/settings.js";

export default defineAction({
  description: "Change Apprentice settings: watchMode, demoMode, minSupport (2–10 demonstrations before proposing a playbook), githubRepo.",
  schema: z.object({
    watchMode: z.boolean().optional(),
    demoMode: z.boolean().optional(),
    minSupport: z.number().int().min(2).max(10).optional(),
    githubRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).nullable().optional(),
  }),
  audit: { target: () => ({ type: "settings", id: "apprentice" }), summary: () => "Updated Apprentice settings" },
  run: async (args, ctx) =>
    updateSettings(requireScope(ctx), {
      ...(args.watchMode !== undefined ? { watchMode: args.watchMode } : {}),
      ...(args.demoMode !== undefined ? { demoMode: args.demoMode } : {}),
      ...(args.minSupport !== undefined ? { minSupport: args.minSupport } : {}),
      ...(args.githubRepo !== undefined ? { githubRepo: args.githubRepo } : {}),
    }),
});
