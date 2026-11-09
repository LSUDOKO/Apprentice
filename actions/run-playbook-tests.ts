import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { refreshPlaybook, requirePlaybook, runAndStoreTests } from "../server/apprentice/services/playbooks.js";

export default defineAction({
  description: "Run a playbook's regression tests (every past correction is a test) and store pass/fail with diffs.",
  schema: z.object({ playbookId: z.string().min(1) }),
  retrySafe: true,
  audit: { target: (a) => ({ type: "playbook", id: a.playbookId }), summary: () => "Ran playbook tests" },
  run: async ({ playbookId }, ctx) => {
    const scope = requireScope(ctx);
    const outcomes = await runAndStoreTests(scope, await requirePlaybook(scope, playbookId));
    await refreshPlaybook(scope, playbookId);
    return { total: outcomes.length, passing: outcomes.filter((o) => o.pass).length, failing: outcomes.filter((o) => !o.pass).map((o) => ({ number: o.number, failedConditions: o.diff.failedConditions })) };
  },
});
