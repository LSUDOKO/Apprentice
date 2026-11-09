import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { buildDigest } from "../server/apprentice/services/ops.js";

export default defineAction({
  description: "Build and store the Apprentice digest since the last one: handled, needs you, ready to promote, estimated time saved. Returns markdown to post (e.g. to Slack) exactly as is.",
  schema: z.object({ sinceMs: z.number().optional().describe("Period start, epoch ms; defaults to the last digest") }),
  audit: { target: () => ({ type: "workspace", id: "digest" }), summary: () => "Built digest" },
  run: async ({ sinceMs }, ctx) => buildDigest(requireScope(ctx), sinceMs),
});
