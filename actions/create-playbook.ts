import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { stepSpecSchema, triggerSchema } from "../server/apprentice/action-helpers.js";
import type { StepSpec, TriggerSpec } from "../server/apprentice/engine/types.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { createFromCandidate, createPlaybook } from "../server/apprentice/services/playbooks.js";

export default defineAction({
  description:
    "Create a playbook, either from a pattern candidate (candidateId, optionally renamed) or from an explicit recipe. New playbooks start at trust level 1 (Suggest: shadow mode only).",
  schema: z.object({
    candidateId: z.string().optional().describe("Pattern candidate to turn into a playbook"),
    name: z.string().min(3).max(120).optional(),
    description: z.string().max(600).optional(),
    trigger: triggerSchema.optional(),
    steps: z.array(stepSpecSchema).optional(),
  }),
  audit: { target: (_a, r) => ({ type: "playbook", id: (r as { playbookId?: string } | undefined)?.playbookId ?? "new" }), summary: (a) => `Created playbook ${a.name ?? a.candidateId ?? ""}` },
  run: async (args, ctx) => {
    const scope = requireScope(ctx);
    const pb = args.candidateId
      ? await createFromCandidate(scope, args.candidateId, { name: args.name, description: args.description })
      : args.name && args.trigger && args.steps
        ? await createPlaybook(scope, { name: args.name, description: args.description ?? "", trigger: args.trigger as TriggerSpec, steps: args.steps as StepSpec[], changeNote: "Created by hand" })
        : fail("Pass candidateId, or name + trigger + steps.", { errorCode: "INVALID_INPUT", statusCode: 400 });
    return { playbookId: pb.id, name: pb.name, trustLevel: pb.trustLevel, path: `/playbooks/${pb.id}` };
  },
});
