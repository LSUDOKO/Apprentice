import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { domainAction, issueId, playbookContext, suggestion } from "../server/apprentice/action-helpers.js";

export default defineAction({
  description:
    "Add or remove labels on an issue (bug, needs-info, feature, docs, question, invalid, p1-crash, good first issue). Use for ad-hoc triage, or with playbookContext when executing a playbook decision.",
  schema: z.object({
    issueId,
    add: z.array(z.string().min(1)).default([]).describe("Labels to add"),
    remove: z.array(z.string().min(1)).default([]).describe("Labels to remove"),
    playbookContext,
    suggestion,
  }),
  ...domainAction("label-issue", (a) => `Labels +${(a.add as string[]).join(",")} -${(a.remove as string[]).join(",")} on ${a.issueId}`),
});
