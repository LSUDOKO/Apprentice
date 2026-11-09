import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { domainAction, issueId, playbookContext, suggestion } from "../server/apprentice/action-helpers.js";

export default defineAction({
  description:
    "Destructive: close an issue as a duplicate of another one (labels it duplicate and links the original). Only when the user asked or an approved playbook step says so.",
  schema: z.object({
    issueId,
    duplicateOfId: z.string().min(1).describe("Id of the original issue"),
    playbookContext,
    suggestion,
  }),
  ...domainAction("mark-duplicate", (a) => `Mark ${a.issueId} duplicate of ${a.duplicateOfId}`),
});
