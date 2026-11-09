import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { listDigests } from "../server/apprentice/services/ops.js";

export default defineAction({
  description: "Past Apprentice digests (newest first).",
  schema: z.object({ limit: z.number().int().min(1).max(50).default(10) }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ limit }, ctx) => ({ digests: await listDigests(requireScope(ctx), limit) }),
});
