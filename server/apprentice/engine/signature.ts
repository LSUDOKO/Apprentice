import type { Step } from "./types.js";

type ArgStep = { action: string; args: Record<string, unknown> };

/** Merge two arg objects for the same action: arrays union, scalars keep the latest value. */
function mergeArgs(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k];
    out[k] = Array.isArray(prev) && Array.isArray(v) ? [...new Set([...prev, ...v])] : v;
  }
  return out;
}

/**
 * Collapse consecutive steps of the same action into one. Clicking "bug" then
 * "needs-info" in the label editor is one logical step: label +bug +needs-info.
 */
export function canonicalSteps<T extends ArgStep>(steps: readonly T[]): ArgStep[] {
  const out: ArgStep[] = [];
  for (const step of steps) {
    const last = out[out.length - 1];
    if (last && last.action === step.action) {
      out[out.length - 1] = { action: last.action, args: mergeArgs(last.args, step.args) };
    } else {
      out.push({ action: step.action, args: { ...step.args } });
    }
  }
  return out;
}

export function stableKeys(args: Record<string, unknown>): string {
  return Object.keys(args)
    .filter((k) => args[k] !== undefined)
    .sort()
    .join(",");
}

export function normalizeStep(step: ArgStep): string {
  return `${step.action}:${stableKeys(step.args)}`;
}

/** Episodes with the same actions in the same order share a signature; args may differ. */
export function computeSignature(steps: readonly Step[] | readonly ArgStep[]): string {
  return canonicalSteps(steps).map(normalizeStep).join(" > ");
}

function normalizeValue(v: unknown): unknown {
  if (Array.isArray(v) && v.length === 0) return null;
  if (Array.isArray(v)) return [...v].map(normalizeValue).map((x) => JSON.stringify(x)).sort();
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, normalizeValue(x)]),
    );
  }
  return v ?? null;
}

/** Deep equality where arrays compare as sets (label order never matters). */
export function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeValue(a)) === JSON.stringify(normalizeValue(b));
}

export function sameActions(a: readonly ArgStep[], b: readonly ArgStep[]): boolean {
  const ca = canonicalSteps(a);
  const cb = canonicalSteps(b);
  return ca.length === cb.length && ca.every((s, i) => s.action === cb[i]?.action);
}

/**
 * Same fixed args: every arg the prediction fixes must equal the actual value.
 * `ignore` lists, per step index, args that are not scored (agent-written text).
 */
export function sameFixedArgs(predicted: readonly ArgStep[], actual: readonly ArgStep[], ignore: ReadonlyArray<ReadonlySet<string>> = []): boolean {
  const cp = canonicalSteps(predicted);
  const ca = canonicalSteps(actual);
  if (cp.length !== ca.length) return false;
  return cp.every((step, i) =>
    Object.entries(step.args).every(([k, v]) => {
      if (ignore[i]?.has(k) || v === undefined) return true;
      return valuesEqual(v, ca[i]?.args[k]);
    }),
  );
}
