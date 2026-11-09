import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { listVersions } from "../server/apprentice/services/playbooks.js";

export default defineAction({
  description: "Version history of a playbook with change notes and full snapshots (for diffs).",
  schema: z.object({ playbookId: z.string().min(1) }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ playbookId }, ctx) => ({ versions: await listVersions(requireScope(ctx), playbookId) }),
});
