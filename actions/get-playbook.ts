import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { describeCondition, describeTrigger } from "../server/apprentice/engine/triggers.js";
import { LEVEL_NAMES } from "../server/apprentice/engine/trust.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { getEligibility, listTests, refreshPlaybook } from "../server/apprentice/services/playbooks.js";

export default defineAction({
  description: "Read one playbook: trigger, steps with parameter owners (fixed / from issue / agent decides), stats, promotion eligibility, test summary and generated SKILL.md.",
  schema: z.object({ playbookId: z.string().min(1) }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ playbookId }, ctx) => {
    const scope = requireScope(ctx);
    const pb = await refreshPlaybook(scope, playbookId);
    const [eligibility, tests] = await Promise.all([getEligibility(scope, pb), listTests(scope, pb.id)]);
    return {
      playbook: {
        id: pb.id,
        name: pb.name,
        description: pb.description,
        status: pb.status,
        version: pb.version,
        trustLevel: pb.trustLevel,
        levelName: LEVEL_NAMES[pb.trustLevel] ?? "Watch",
        trigger: pb.trigger,
        triggerText: describeTrigger(pb.trigger),
        conditionTexts: pb.trigger.all.map(describeCondition),
        steps: pb.steps,
        stats: pb.stats,
        skillMarkdown: pb.skillMarkdown,
        sourceEpisodeIds: pb.sourceEpisodeIds,
        demotionReason: pb.demotionReason,
        lastDemotedAt: pb.lastDemotedAt,
        lastPromotedAt: pb.lastPromotedAt,
        createdAt: pb.createdAt,
        updatedAt: pb.updatedAt,
      },
      eligibility,
      tests: { total: tests.length, passing: tests.filter((t) => t.lastResult === "pass").length, failing: tests.filter((t) => t.lastResult === "fail").map((t) => t.number) },
    };
  },
});
