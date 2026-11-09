import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { simulateIncoming } from "../server/apprentice/services/seed.js";

export default defineAction({
  description: "Demo helper: deliver the next batch of new (invented) issues into the queue, as if they just arrived. Use before running playbooks on new issues in a demo.",
  schema: z.object({ count: z.number().int().min(1).max(8).default(4).describe("How many new issues") }),
  audit: { target: () => ({ type: "workspace", id: "demo" }), summary: (a) => `Simulated ${a.count} new issues` },
  run: async ({ count }, ctx) => simulateIncoming(requireScope(ctx), count),
});
