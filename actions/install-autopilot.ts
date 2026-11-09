import { defineAction } from "@agent-native/core/action";
import { resourcePut } from "@agent-native/core/resources";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";

const AUTOPILOT_PATH = "jobs/apprentice-autopilot.md";

const job = (schedule: string, enabled: boolean) => `---
schedule: "${schedule}"
enabled: ${enabled}
runAs: creator
---

# Apprentice autopilot

Run Apprentice's active playbooks on new, untriaged issues.

1. Call \`run-autopilot\` with \`maxItems: 50\`.
2. If any run returns \`awaiting_judgment\`, follow the \`playbook-runner\` skill to resolve judgments.
3. Call \`build-digest\` for the period since the last digest.
4. Reply with the digest text exactly as returned — nothing else.

Never raise trust levels, never undo runs, and never close or mark duplicates outside an approved playbook step.
`;

export default defineAction({
  description:
    "Install (or update) the scheduled Apprentice autopilot automation for this user: hourly by default, it runs active playbooks on new issues and posts the digest. Run it now from Settings › Automations.",
  schema: z.object({
    schedule: z.string().regex(/^(\S+\s+){4}\S+$/, "5-field cron").default("13 * * * *").describe("Cron schedule, default hourly at :13"),
    enabled: z.boolean().default(true),
  }),
  audit: { target: () => ({ type: "automation", id: AUTOPILOT_PATH }), summary: (a) => `Installed autopilot (${a.schedule})` },
  run: async ({ schedule, enabled }, ctx) => {
    const scope = requireScope(ctx);
    await resourcePut(scope.ownerEmail, AUTOPILOT_PATH, job(schedule, enabled), "text/markdown");
    return { path: AUTOPILOT_PATH, schedule, enabled };
  },
});

