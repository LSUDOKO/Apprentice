import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { createFromCandidate } from "../server/apprentice/services/playbooks.js";

export default defineAction({
  description:
    "Team mode: when teammates handle the same kind of issue differently, pick whose way becomes the shared playbook. Records the decision in the playbook description.",
  schema: z.object({
    candidateId: z.string().min(1),
    chosenActorEmail: z.string().min(3).describe("Email of the teacher whose approach wins"),
    note: z.string().max(300).optional().describe("Why this approach"),
  }),
  audit: { target: (a) => ({ type: "pattern", id: a.candidateId }), summary: (a) => `Resolved team conflict for ${a.chosenActorEmail}` },
  run: async (args, ctx) => {
    const pb = await createFromCandidate(requireScope(ctx), args.candidateId, { chosenActorEmail: args.chosenActorEmail, note: args.note });
    return { playbookId: pb.id, name: pb.name, path: `/playbooks/${pb.id}` };
  },
});
