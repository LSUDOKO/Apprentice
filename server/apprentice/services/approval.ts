import type { ActionRunContext } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";

import { DESTRUCTIVE_ACTIONS } from "../engine/actions.js";
import { LEVELS } from "../engine/trust.js";
import type { StepSpec } from "../engine/types.js";
import { getDb, schema } from "../../db/index.js";
import type { PlaybookContext } from "./issues.js";

export type ApprovalPlaybook = { status: string; trustLevel: number; steps: StepSpec[] } | null;
export type PlaybookLoader = (playbookId: string, ownerEmail: string) => Promise<ApprovalPlaybook>;

/** Pure trust-ladder rule (05 §6): does this playbook step need a human approval? */
export function stepNeedsApproval(pb: ApprovalPlaybook, stepId: string, action: string): boolean {
  if (!pb || pb.status !== "active") return true;
  const step = pb.steps.find((s) => s.id === stepId);
  const destructive = DESTRUCTIVE_ACTIONS.has(action);
  if (pb.trustLevel <= LEVELS.DRAFT) return true;
  if (pb.trustLevel === LEVELS.ACT) return !!step?.checkpoint || destructive;
  return false;
}

const loadFromDb: PlaybookLoader = async (playbookId, ownerEmail) => {
  const [row] = await getDb()
    .select({ status: schema.playbooks.status, trustLevel: schema.playbooks.trustLevel, steps: schema.playbooks.steps })
    .from(schema.playbooks)
    .where(and(eq(schema.playbooks.ownerEmail, ownerEmail), eq(schema.playbooks.id, playbookId)))
    .limit(1);
  return row ?? null;
};

/**
 * `needsApproval` predicate for every domain action. Ad-hoc calls (no
 * playbookContext) never get an extra gate; playbook executions are gated by
 * the playbook's trust level. A throw fails closed (the framework asks).
 */
export function approvalFor(action: string, load: PlaybookLoader = loadFromDb) {
  return async (args: { playbookContext?: PlaybookContext | undefined }, ctx?: ActionRunContext): Promise<boolean> => {
    const pc = args.playbookContext;
    if (!pc) return false;
    if (!ctx?.userEmail) return true;
    return stepNeedsApproval(await load(pc.playbookId, ctx.userEmail), pc.stepId, action);
  };
}
