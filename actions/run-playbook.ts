import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { runPlaybook } from "../server/apprentice/services/executor.js";

export default defineAction({
  description:
    "Run a playbook on issues. Mode follows its trust level: Suggest → shadow decisions only; Draft → you execute each step with playbookContext (the user approves); Act → non-checkpoint decisions execute with undo, checkpoint ones are returned in toExecute; Auto → everything executes. If status is awaiting_judgment, read each issue and call resolve-judgments. Report handled / waiting / exceptions and link reviewPath.",
  schema: z.object({
    playbookId: z.string().min(1),
    scope: z
      .object({
        issueIds: z.array(z.string()).max(50).optional().describe("Specific issues"),
        openUntriaged: z.boolean().optional().describe("All open issues with no labels/assignee that this playbook hasn't handled yet"),
      })
      .default({ openUntriaged: true }),
    trigger: z.enum(["manual", "chat", "mcp", "schedule"]).optional().describe("What started the run"),
  }),
  mcpTool: true,
  mcpAnnotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  audit: { target: (a) => ({ type: "playbook", id: a.playbookId }), summary: () => "Ran playbook" },
  run: async (args, ctx) => {
    const trigger = args.trigger ?? (ctx?.caller === "tool" ? "chat" : ctx?.caller === "mcp" ? "mcp" : ctx?.caller === "automation" ? "schedule" : "manual");
    const runScope = { ...(args.scope.issueIds ? { issueIds: args.scope.issueIds } : {}), ...(args.scope.openUntriaged !== undefined ? { openUntriaged: args.scope.openUntriaged } : {}) };
    return runPlaybook(requireScope(ctx), ctx, { playbookId: args.playbookId, scope: runScope, trigger });
  },
});
