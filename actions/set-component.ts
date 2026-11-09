import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { domainAction, issueId, playbookContext, suggestion } from "../server/apprentice/action-helpers.js";

export default defineAction({
  description: "Set the component an issue belongs to: core, templates, cli, docs or ui. null clears it.",
  schema: z.object({
    issueId,
    component: z.string().min(1).max(40).nullable().describe("Component: core | templates | cli | docs | ui, or null"),
    playbookContext,
    suggestion,
  }),
  ...domainAction("set-component", (a) => `Component ${String(a.component)} on ${a.issueId}`),
});
