import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { slugify } from "../server/apprentice/engine/skill-markdown.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { refreshPlaybook } from "../server/apprentice/services/playbooks.js";

export default defineAction({
  description:
    "Export a playbook as a portable agent skill: SKILL.md (standard frontmatter + instructions) and playbook.json (machine-readable recipe). Works in Claude Code and other skill-aware agents.",
  schema: z.object({ playbookId: z.string().min(1) }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  run: async ({ playbookId }, ctx) => {
    const pb = await refreshPlaybook(requireScope(ctx), playbookId);
    const json = {
      name: pb.name,
      description: pb.description,
      version: pb.version,
      trigger: pb.trigger,
      steps: pb.steps,
      stats: pb.stats,
      exportedAt: new Date().toISOString(),
      generator: "apprentice",
    };
    const slug = slugify(pb.name);
    return {
      folder: `${slug}-skill`,
      files: [
        { path: "SKILL.md", content: pb.skillMarkdown },
        { path: "playbook.json", content: `${JSON.stringify(json, null, 2)}\n` },
      ],
    };
  },
});
