import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { domainAction, issueId, playbookContext, suggestion } from "../server/apprentice/action-helpers.js";

export default defineAction({
  description: "Assign an issue to a team: triage (needs follow-up), core-team or docs-team. null unassigns.",
  schema: z.object({
    issueId,
    assignee: z.string().min(1).max(60).nullable().describe("Assignee team, e.g. triage, core-team, docs-team; null to unassign"),
    playbookContext,
    suggestion,
  }),
  ...domainAction("assign-issue", (a) => `Assign ${String(a.assignee)} on ${a.issueId}`),
});
