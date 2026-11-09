import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { runAutopilot } from "../server/apprentice/services/ops.js";

export default defineAction({
  description:
    "Run every active playbook (Suggest and above) on new untriaged issues. Used by the scheduled autopilot automation. Idempotent per issue: issues a playbook already handled are skipped. Then resolve any judgments and call build-digest.",
  schema: z.object({ maxItems: z.number().int().min(1).max(200).default(50) }),
  retrySafe: true,
  audit: { target: () => ({ type: "workspace", id: "autopilot" }), summary: () => "Autopilot run" },
  run: async ({ maxItems }, ctx) => runAutopilot(requireScope(ctx), ctx, maxItems),
});
