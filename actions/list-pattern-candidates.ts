import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { describeStep } from "../server/apprentice/engine/actions.js";
import { describeTrigger } from "../server/apprentice/engine/triggers.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { listCandidates } from "../server/apprentice/services/patterns.js";

export default defineAction({
  description: "List patterns Apprentice noticed in the user's work that could become playbooks (status new, or conflict when teammates handle the same issues differently).",
  schema: z.object({ status: z.enum(["new", "conflict", "accepted", "dismissed"]).optional() }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ status }, ctx) => {
    const rows = await listCandidates(requireScope(ctx), status ? [status] : ["new", "conflict"]);
    return {
      candidates: rows.map((c) => ({
        id: c.id,
        name: c.suggestedName,
        status: c.status,
        support: c.support,
        weakTrigger: c.weakTrigger === 1,
        trigger: c.trigger,
        triggerText: describeTrigger(c.trigger),
        steps: c.steps,
        stepLabels: c.steps.map((s) => describeStep(s.action, Object.fromEntries(Object.entries(s.params).map(([k, p]) => [k, p.owner === "fixed" ? p.value : undefined])))),
        episodeIds: c.episodeIds,
        conflictWith: c.conflictWith,
        updatedAt: c.updatedAt,
      })),
    };
  },
});
