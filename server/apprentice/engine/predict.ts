import { OPTIONAL_PARAMS, describeStep } from "./actions.js";
import { resolveStep } from "./bindings.js";
import { canonicalSteps } from "./signature.js";
import { evaluate } from "./triggers.js";
import type { ItemView, Step, StepSpec, TriggerSpec } from "./types.js";

export type PredictionSource = {
  id: string;
  kind: "playbook" | "candidate";
  name: string;
  trustLevel: number;
  rollingAgreement: number;
  trigger: TriggerSpec;
  steps: StepSpec[];
};

export type Suggestion = {
  sourceId: string;
  sourceKind: "playbook" | "candidate";
  playbookName: string;
  stepIndex: number;
  stepCount: number;
  action: string;
  args: Record<string, unknown>;
  label: string;
  /** Agent-written params the action cannot run without. Tab hands these to the agent. */
  needsAgent: boolean;
  /** Agent-written params the action can fill from a template if the human applies it directly. */
  agentParams: string[];
};

function remainingLabels(expected: unknown, done: unknown): string[] {
  const want = Array.isArray(expected) ? (expected as string[]) : [];
  const have = new Set(Array.isArray(done) ? (done as string[]) : []);
  return want.filter((l) => !have.has(l));
}

/**
 * Ghost autocomplete (05 §7): find the first source whose trigger matches and
 * whose steps start with what the user already did, and suggest the next step.
 * A partially done label step suggests the missing labels. Destructive steps are never suggested.
 */
export function predictNextStep(input: { issue: ItemView; contextStart: ItemView | null; doneSteps: readonly Step[]; sources: readonly PredictionSource[] }): Suggestion | null {
  const ordered = [...input.sources].sort(
    (a, b) => b.trustLevel - a.trustLevel || b.rollingAgreement - a.rollingAgreement || (a.kind === "playbook" ? -1 : 1),
  );
  const done = canonicalSteps(input.doneSteps);
  for (const src of ordered) {
    if (!evaluate(src.trigger, input.contextStart ?? input.issue).deterministicMatch) continue;
    if (done.length > src.steps.length) continue;
    if (!done.every((d, i) => d.action === src.steps[i]?.action)) continue;

    let index = done.length;
    let args: Record<string, unknown> | null = null;
    const last = done[done.length - 1];
    const lastSpec = src.steps[done.length - 1];
    if (last && lastSpec?.action === "label-issue" && lastSpec.params.add?.owner === "fixed") {
      const missing = remainingLabels(lastSpec.params.add.value, last.args.add);
      if (missing.length) {
        index = done.length - 1;
        args = { add: missing, remove: [] };
      }
    }
    const spec = src.steps[index];
    if (!spec || spec.destructive || spec.checkpoint) continue;
    const resolved = resolveStep(spec, input.issue);
    const finalArgs = args ?? resolved.args;
    const optional = OPTIONAL_PARAMS[spec.action] ?? new Set<string>();
    const required = resolved.pendingAgentParams.filter((p) => !optional.has(p));
    return {
      sourceId: src.id,
      sourceKind: src.kind,
      playbookName: src.name,
      stepIndex: index,
      stepCount: src.steps.length,
      action: spec.action,
      args: finalArgs,
      label: describeStep(spec.action, finalArgs),
      needsAgent: required.length > 0,
      agentParams: resolved.pendingAgentParams,
    };
  }
  return null;
}
