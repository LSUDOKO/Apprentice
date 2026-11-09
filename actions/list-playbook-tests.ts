import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { describeStep } from "../server/apprentice/engine/actions.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { listTests } from "../server/apprentice/services/playbooks.js";

export default defineAction({
  description: "List a playbook's regression tests: origin (seed demonstration, override, edit), the issue, expected steps and last result with diff.",
  schema: z.object({ playbookId: z.string().min(1) }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ playbookId }, ctx) => {
    const tests = await listTests(requireScope(ctx), playbookId);
    return {
      tests: tests.map((t) => ({
        id: t.id,
        number: t.number,
        origin: t.origin,
        issueId: t.issueSnapshot.id,
        issueNumber: t.issueSnapshot.number,
        issueTitle: t.issueSnapshot.title,
        expected: { applies: t.expected.applies, steps: t.expected.steps.map((s) => ({ ...s, label: describeStep(s.action, s.args) })) },
        lastResult: t.lastResult,
        lastDiff: t.lastDiff,
        lastRunAt: t.lastRunAt,
        sourceDecisionId: t.sourceDecisionId,
      })),
    };
  },
});
