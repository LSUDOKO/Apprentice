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

const featureField = z.enum([
  "kind",
  "labels",
  "hasVersion",
  "versionMentioned",
  "hasRepro",
  "hasStackTrace",
  "hasCodeBlock",
  "bodyLength",
  "titleLength",
  "mentionsDocs",
  "mentionsComponent",
  "isLikelySpam",
  "priority",
  "component",
  "assignee",
  "state",
  "authorIsFirstTime",
]);

export const conditionSchema = z.union([
  z.object({ field: featureField, op: z.enum(["eq", "neq"]), value: z.union([z.string(), z.number(), z.boolean(), z.null()]) }),
  z.object({ field: z.literal("labels"), op: z.enum(["includes", "excludes"]), value: z.string().min(1) }),
  z.object({ field: z.enum(["title", "body"]), op: z.literal("matches"), value: z.string().min(1).max(200) }),
  z.object({ field: featureField, op: z.enum(["isEmpty", "isNotEmpty"]) }),
]);

export const triggerSchema = z
  .object({
    all: z.array(conditionSchema).max(8).describe("Conditions that must all hold (AND)"),
    judgment: z.string().max(400).nullable().optional().describe("Optional yes/no question the agent answers per issue"),
  })
  .describe("Playbook trigger");

export const paramSchema = z.union([
  z.object({ owner: z.literal("fixed"), value: z.unknown() }),
  z.object({ owner: z.literal("fromItem"), path: z.string().min(1) }),
  z.object({ owner: z.literal("agent"), instruction: z.string().min(1).max(400) }),
]);

export const stepSpecSchema = z.object({
  id: z.string().min(1).describe("Stable step id, e.g. s1"),
  action: z.string().min(1).describe("Domain action name, e.g. label-issue"),
  params: z.record(z.string(), paramSchema).describe("Param → owner: fixed value, fromItem path, or agent instruction"),
  checkpoint: z.boolean().default(false).describe("Always ask the human before this step (until Auto)"),
  destructive: z.boolean().default(false),
});

export const expectedStepSchema = z.object({ action: z.string().min(1), args: z.record(z.string(), z.unknown()) });
