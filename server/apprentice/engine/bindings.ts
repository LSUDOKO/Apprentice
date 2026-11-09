import { DESTRUCTIVE_ACTIONS, FREE_TEXT_PARAMS } from "./actions.js";
import { canonicalSteps, valuesEqual } from "./signature.js";
import type { EpisodeLike, ItemView, ParamSpec, ResolvedStep, StepSpec } from "./types.js";

/** Item paths a parameter can be copied from, in preference order. */
export const ITEM_PATHS = [
  "author",
  "number",
  "features.mentionsComponent",
  "features.versionMentioned",
  "features.kind",
  "component",
  "assignee",
  "priority",
] as const;

export function getPath(item: ItemView, path: string): unknown {
  let cur: unknown = item;
  for (const part of path.split(".")) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function trimExample(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  const firstLine = s.split("\n").find((l) => l.trim()) ?? s;
  const oneLine = firstLine.replace(/\s+/g, " ").trim();
  return oneLine.length > 120 ? `${oneLine.slice(0, 117)}…` : oneLine;
}

export function summarizeHint(values: unknown[]): string {
  const examples = values
    .filter((v) => v !== undefined && v !== null && v !== "")
    .slice(0, 2)
    .map((v) => `“${trimExample(v)}”`);
  return examples.length ? `Write a comment similar to these examples: ${examples.join(" / ")}` : "Write a short, friendly comment for the reporter.";
}

export function inferParam(key: string, values: unknown[], contexts: ItemView[]): ParamSpec {
  const defined = values.filter((v) => v !== undefined);
  if (defined.length === values.length && values.every((v) => valuesEqual(v, values[0]))) {
    return { owner: "fixed", value: values[0] };
  }
  for (const path of ITEM_PATHS) {
    const ok = values.every((v, i) => v !== undefined && v !== null && valuesEqual(v, contexts[i] ? getPath(contexts[i], path) : undefined));
    if (ok) return { owner: "fromItem", path };
  }
  if (FREE_TEXT_PARAMS.has(key)) return { owner: "agent", instruction: summarizeHint(values) };
  const examples = [...new Set(defined.map((v) => trimExample(v)))].slice(0, 3).join(", ");
  return { owner: "agent", instruction: `Choose ${key} like: ${examples}` };
}

/** Infer step specs (with parameter owners) from a group of episodes sharing a signature. */
export function inferBindings(group: readonly Pick<EpisodeLike, "steps" | "contextStart">[]): StepSpec[] {
  if (group.length === 0) return [];
  const canon = group.map((ep) => canonicalSteps(ep.steps));
  const contexts = group.map((ep) => ep.contextStart);
  return (canon[0] ?? []).map((first, i) => {
    const keys = new Set(canon.flatMap((steps) => Object.keys(steps[i]?.args ?? {})));
    const params: Record<string, ParamSpec> = {};
    for (const key of [...keys].sort()) {
      params[key] = inferParam(
        key,
        canon.map((steps) => steps[i]?.args[key]),
        contexts,
      );
    }
    const destructive = DESTRUCTIVE_ACTIONS.has(first.action);
    return { id: `s${i + 1}`, action: first.action, params, checkpoint: destructive, destructive };
  });
}

/** Resolve a step spec against an item: fixed + fromItem filled, agent params left pending. */
export function resolveStep(step: StepSpec, item: ItemView): ResolvedStep {
  const args: Record<string, unknown> = {};
  const owners: ResolvedStep["owners"] = {};
  const pendingAgentParams: string[] = [];
  for (const [key, spec] of Object.entries(step.params)) {
    owners[key] = spec.owner;
    if (spec.owner === "fixed") args[key] = spec.value;
    else if (spec.owner === "fromItem") args[key] = getPath(item, spec.path) ?? null;
    else pendingAgentParams.push(key);
  }
  return {
    stepId: step.id,
    action: step.action,
    args,
    owners,
    checkpoint: step.checkpoint,
    destructive: step.destructive || DESTRUCTIVE_ACTIONS.has(step.action),
    pendingAgentParams,
  };
}

export function resolveSteps(steps: readonly StepSpec[], item: ItemView): ResolvedStep[] {
  return steps.map((s) => resolveStep(s, item));
}

/** Per-step set of params that are not scored (agent-written). */
export function agentParamSets(steps: readonly StepSpec[]): Set<string>[] {
  return steps.map((s) => new Set(Object.entries(s.params).filter(([, p]) => p.owner === "agent").map(([k]) => k)));
}
