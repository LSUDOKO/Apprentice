import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { getEligibility, refreshPlaybook } from "../server/apprentice/services/playbooks.js";

export default defineAction({
  description: "Is a playbook ready to move up the trust ladder? Returns the next level, the evidence (reviewed, agreement, executed, tests) and any blockers.",
  schema: z.object({ playbookId: z.string().min(1) }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ playbookId }, ctx) => {
    const scope = requireScope(ctx);
    return getEligibility(scope, await refreshPlaybook(scope, playbookId));
  },
});
