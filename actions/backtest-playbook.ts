import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { stepSpecSchema, triggerSchema } from "../server/apprentice/action-helpers.js";
import type { StepSpec, TriggerSpec } from "../server/apprentice/engine/types.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { backtestRecipe, requirePlaybook, validateRecipe } from "../server/apprentice/services/playbooks.js";

export default defineAction({
  description:
    "Replay a playbook against the issues the user triaged by hand: how many it would have matched, agreed with, disagreed with, or missed. Pass triggerOverride / stepsOverride to try a change without saving (used by the live tuner).",
  schema: z.object({
    playbookId: z.string().min(1),
    triggerOverride: triggerSchema.optional(),
    stepsOverride: z.array(stepSpecSchema).optional(),
    limit: z.number().int().min(1).max(500).default(200),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async (args, ctx) => {
    const scope = requireScope(ctx);
    const pb = await requirePlaybook(scope, args.playbookId);
    const trigger = (args.triggerOverride as TriggerSpec | undefined) ?? pb.trigger;
    const steps = validateRecipe(trigger, (args.stepsOverride as StepSpec[] | undefined) ?? pb.steps);
    const r = await backtestRecipe(scope, trigger, steps, args.limit);
    return {
      considered: r.considered,
      matched: r.matched,
      agreed: r.agreed,
      agreement: r.agreement,
      falsePositives: r.falsePositives,
      needsJudgmentCount: r.needsJudgmentCount,
      disagreed: r.disagreed.slice(0, 30),
      missed: r.missed.slice(0, 30),
      missedCount: r.missed.length,
      disagreedCount: r.disagreed.length,
    };
  },
});
