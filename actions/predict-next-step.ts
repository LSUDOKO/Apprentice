import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { predictForIssue } from "../server/apprentice/services/assist.js";

export default defineAction({
  description:
    "Ghost suggestion: predict the user's next triage step on an issue from their playbooks and noticed patterns. For 'do the usual for this one', call this and then perform the suggested action (ad-hoc, without playbookContext).",
  schema: z.object({ issueId: z.string().min(1) }),
  http: { method: "GET" },
  readOnly: true,
  persistInBrowser: false,
  run: async ({ issueId }, ctx) => ({ suggestion: await predictForIssue(requireScope(ctx), issueId) }),
});
