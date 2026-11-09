import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { setTrustLevel } from "../server/apprentice/services/playbooks.js";

export default defineAction({
  description:
    "Change a playbook's trust level: 0 Watch · 1 Suggest · 2 Draft · 3 Act (with undo) · 4 Auto. Raising requires the evidence from get-promotion-eligibility and all tests passing; raising from chat always needs the user's approval. Lowering is always allowed. Never raise unless the user asked.",
  schema: z.object({
    playbookId: z.string().min(1),
    level: z.number().int().min(0).max(4).describe("Target level 0–4"),
    reason: z.string().min(1).max(200).describe("Why"),
  }),
  needsApproval: (_args, ctx) => ctx?.caller !== "frontend",
  audit: { target: (a) => ({ type: "playbook", id: a.playbookId }), summary: (a) => `Trust level → ${a.level}: ${a.reason}` },
  run: async ({ playbookId, level, reason }, ctx) => {
    const pb = await setTrustLevel(requireScope(ctx), playbookId, level, reason);
    return { playbookId: pb.id, trustLevel: pb.trustLevel };
  },
});
