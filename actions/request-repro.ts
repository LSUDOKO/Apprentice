import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { domainAction, issueId, playbookContext, suggestion } from "../server/apprentice/action-helpers.js";

export default defineAction({
  description:
    "Ask the reporter for missing details: adds the needs-info label and posts a comment listing what is missing. Omit message to use the standard template.",
  schema: z.object({
    issueId,
    missing: z.array(z.enum(["version", "steps", "logs", "environment"])).min(1).describe("What the report is missing"),
    message: z.string().min(1).max(2000).optional().describe("Comment text; omit to use the template"),
    playbookContext,
    suggestion,
  }),
  ...domainAction("request-repro", (a) => `Request repro (${(a.missing as string[]).join(", ")}) on ${a.issueId}`),
});
