import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { domainAction, issueId, playbookContext, suggestion } from "../server/apprentice/action-helpers.js";

export default defineAction({
  description: "Post a comment on an issue. Keep agent-written comments polite, specific and under 80 words.",
  schema: z.object({
    issueId,
    body: z.string().min(1).max(4000).describe("Comment markdown"),
    playbookContext,
    suggestion,
  }),
  ...domainAction("comment-on-issue", (a) => `Comment on ${a.issueId}`),
});
