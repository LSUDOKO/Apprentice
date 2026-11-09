import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { savedMs } from "../server/apprentice/engine/metrics.js";
import { describeTrigger } from "../server/apprentice/engine/triggers.js";
import { LEVEL_NAMES } from "../server/apprentice/engine/trust.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { getEligibility, listPlaybookRows } from "../server/apprentice/services/playbooks.js";

export default defineAction({
  description:
    "List the user's Apprentice playbooks (skills learned from their triage work) with trigger, trust level, agreement, tests, executed count and whether each is ready to promote.",
  schema: z.object({ status: z.enum(["draft", "active", "paused", "archived"]).optional() }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  run: async ({ status }, ctx) => {
    const scope = requireScope(ctx);
    const rows = await listPlaybookRows(scope, status);
    const playbooks = await Promise.all(
      rows.map(async (p) => {
        const elig = await getEligibility(scope, p);
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          version: p.version,
          trustLevel: p.trustLevel,
          levelName: LEVEL_NAMES[p.trustLevel] ?? "Watch",
          triggerText: describeTrigger(p.trigger),
          stepCount: p.steps.length,
          stats: p.stats,
          minutesSaved: Math.round(savedMs(p.stats.executed - p.stats.undone, p.stats.medianHumanMs) / 60_000),
          eligible: elig.eligible,
          nextLevel: elig.nextLevel,
          blockers: elig.blockers,
          demotionReason: p.demotionReason,
          lastDemotedAt: p.lastDemotedAt,
          updatedAt: p.updatedAt,
        };
      }),
    );
    playbooks.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.updatedAt - a.updatedAt);
    return { playbooks };
  },
});
