import type { ActionRunContext } from "@agent-native/core/action";
import { z } from "zod";

import type { DomainActionName } from "./engine/actions.js";
import { approvalFor } from "./services/approval.js";
import { mutateIssue, type DomainArgs } from "./services/issues.js";

/** Set ONLY when the agent executes a playbook decision; the trust ladder gates these calls. */
export const playbookContext = z
  .object({
    playbookId: z.string().describe("Playbook id"),
    runId: z.string().describe("Run id from run-playbook"),
    decisionId: z.string().describe("Decision id from run-playbook"),
    stepId: z.string().describe("Step id from the decision's steps"),
  })
  .optional()
  .describe("Set ONLY when executing a playbook decision (from run-playbook toExecute). Omit for ad-hoc requests.");

export const suggestion = z
  .object({ sourceId: z.string(), stepIndex: z.number().int() })
  .optional()
  .describe("UI-only: set when the user accepted a ghost suggestion. Agents omit this.");

export const issueId = z.string().min(1).describe("Issue id, e.g. seed-031 (from list-issues or view-screen)");

export const mutationOutput = z.object({
  issue: z.object({
    id: z.string(),
    number: z.number(),
    labels: z.array(z.string()),
    priority: z.string().nullable(),
    component: z.string().nullable(),
    assignee: z.string().nullable(),
    state: z.string(),
  }),
  executionId: z.string().nullable(),
  demonstration: z.boolean(),
});

/** Shared pieces of every triage action: approval gate, audit target, and the mutation path. */
export function domainAction(name: DomainActionName, summary: (args: Record<string, unknown>) => string) {
  return {
    needsApproval: approvalFor(name),
    outputSchema: mutationOutput,
    audit: {
      target: (args: { issueId: string }) => ({ type: "issue", id: args.issueId }),
      summary: (args: Record<string, unknown>) => summary(args),
    },
    run: (args: DomainArgs, ctx?: ActionRunContext) => mutateIssue(ctx, name, args),
  };
}
