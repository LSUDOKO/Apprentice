import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { domainAction, issueId, playbookContext, suggestion } from "../server/apprentice/action-helpers.js";

export default defineAction({
  description: "Destructive: close an issue as completed, invalid or wontfix. Only when the user asked or an approved playbook step says so.",
  schema: z.object({
    issueId,
    reason: z.enum(["completed", "invalid", "wontfix"]).describe("Why it is closed"),
    playbookContext,
    suggestion,
  }),
  ...domainAction("close-issue", (a) => `Close ${a.issueId} as ${String(a.reason)}`),
});
