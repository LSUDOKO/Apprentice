import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { stepSpecSchema, triggerSchema } from "../server/apprentice/action-helpers.js";
import type { StepSpec, TriggerSpec } from "../server/apprentice/engine/types.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { updatePlaybook, type UpdatePatch } from "../server/apprentice/services/playbooks.js";

export default defineAction({
  description:
    "Edit a playbook (name, description, trigger, steps). Creates a new version, regenerates SKILL.md and reruns its regression tests. An edit that would break a passing test is refused with TESTS_FAILING unless saveAsDraft is true.",
  schema: z.object({
    playbookId: z.string().min(1),
    patch: z.object({
      name: z.string().min(3).max(120).optional(),
      description: z.string().max(600).optional(),
      trigger: triggerSchema.optional(),
      steps: z.array(stepSpecSchema).optional(),
    }),
    changeNote: z.string().max(200).optional().describe("Short note for the version history"),
    saveAsDraft: z.boolean().optional().describe("Save even if tests fail; the playbook becomes a draft and stops running"),
  }),
  audit: { target: (a) => ({ type: "playbook", id: a.playbookId }), summary: (a) => `Edited playbook: ${a.changeNote ?? "recipe"}` },
  run: async (args, ctx) => {
    const patch: UpdatePatch = {};
    if (args.patch.name !== undefined) patch.name = args.patch.name;
    if (args.patch.description !== undefined) patch.description = args.patch.description;
    if (args.patch.trigger !== undefined) patch.trigger = args.patch.trigger as TriggerSpec;
    if (args.patch.steps !== undefined) patch.steps = args.patch.steps as StepSpec[];
    const { playbook, tests } = await updatePlaybook(requireScope(ctx), args.playbookId, patch, { changeNote: args.changeNote, saveAsDraft: args.saveAsDraft });
    return {
      playbookId: playbook.id,
      version: playbook.version,
      status: playbook.status,
      tests: { total: tests.length, passing: tests.filter((t) => t.pass).length, failing: tests.filter((t) => !t.pass).map((t) => t.number) },
    };
  },
});
