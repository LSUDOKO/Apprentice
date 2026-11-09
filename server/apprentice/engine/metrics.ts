import type { ConditionResult } from "./triggers.js";
import { describeCondition } from "./triggers.js";

/** Laplace-smoothed agreement × trigger coverage × judgment penalty (05 §8). */
export function confidence(input: { approved: number; reviewed: number; conditionResults: readonly ConditionResult[]; judgmentPending: boolean }): number {
  const base = (input.approved + 1) / (input.reviewed + 2);
  const coverage = input.conditionResults.some((r) => r.cond.op === "matches") ? 0.85 : 1;
  const penalty = input.judgmentPending ? 0.9 : 1;
  return Math.round(100 * base * coverage * penalty);
}

export function explanation(input: { approved: number; reviewed: number; conditionResults: readonly ConditionResult[]; judgment?: string | null }): string {
  const passed = input.conditionResults.filter((r) => r.pass);
  const conds = passed.map((r) => describeCondition(r.cond)).join("; ");
  const head = `Matched ${passed.length}/${input.conditionResults.length} conditions${conds ? ` (${conds})` : ""}.`;
  const judgment = input.judgment ? ` Agent judges: “${input.judgment}”.` : "";
  const record = input.reviewed > 0 ? ` This playbook agreed with you ${input.approved} of ${input.reviewed} times.` : " No reviews yet.";
  return head + judgment + record;
}

export const MIN_HUMAN_MS = 20_000;
export const MAX_HUMAN_MS = 15 * 60_000;

export function humanMs(startedAt: number, endedAt: number | null): number {
  const raw = (endedAt ?? startedAt) - startedAt;
  return Math.min(MAX_HUMAN_MS, Math.max(MIN_HUMAN_MS, raw));
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/** Estimated time saved = executed decisions × median human time for this playbook. */
export function savedMs(executedDecisions: number, medianHumanMs: number | null): number {
  return executedDecisions * (medianHumanMs ?? 0);
}

export const TIME_SAVED_METHOD =
  "Estimated: decisions Apprentice executed × the median time you took on the same kind of issue (each demonstration clamped to 20 s – 15 min).";
