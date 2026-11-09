import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { refreshCandidates } from "../server/apprentice/services/patterns.js";
import { closeIdleEpisodes } from "../server/apprentice/services/record-step.js";

export default defineAction({
  description: "Look for repeated patterns in the user's demonstrations and propose playbooks. Runs automatically after each demonstration; call it on demand too.",
  schema: z.object({}),
  retrySafe: true,
  audit: { enabled: false },
  run: async (_args, ctx) => {
    const scope = requireScope(ctx);
    await closeIdleEpisodes(scope);
    const changed = await refreshCandidates(scope);
    return { changed: changed.map((c) => ({ id: c.id, name: c.suggestedName, status: c.status, support: c.support })) };
  },
});
