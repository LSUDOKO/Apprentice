import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { domainAction, issueId, playbookContext, suggestion } from "../server/apprentice/action-helpers.js";

export default defineAction({
  description: "Set an issue's priority: p0 outage/data loss, p1 crash or blocker, p2 normal bug, p3 minor or feature. null clears it.",
  schema: z.object({
    issueId,
    priority: z.enum(["p0", "p1", "p2", "p3"]).nullable().describe("Priority, or null to clear"),
    playbookContext,
    suggestion,
  }),
  ...domainAction("set-priority", (a) => `Priority ${String(a.priority)} on ${a.issueId}`),
});
