import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { domainAction, issueId, playbookContext, suggestion } from "../server/apprentice/action-helpers.js";

export default defineAction({
  description: "Reopen a closed issue.",
  schema: z.object({ issueId, playbookContext, suggestion }),
  ...domainAction("reopen-issue", (a) => `Reopen ${a.issueId}`),
});
