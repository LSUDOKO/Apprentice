import { FEATURE_LABELS } from "./features.js";
import type { Condition, ItemView, TriggerSpec } from "./types.js";

export class InvalidTriggerError extends Error {
  readonly code = "INVALID_TRIGGER";
}

const MAX_REGEX_LENGTH = 200;

export function compileRegex(pattern: string): RegExp {
  if (pattern.length > MAX_REGEX_LENGTH) throw new InvalidTriggerError(`Regex longer than ${MAX_REGEX_LENGTH} characters.`);
  try {
    return new RegExp(pattern, "i");
  } catch {
    throw new InvalidTriggerError(`Invalid regex: ${pattern}`);
  }
}

/** Throws InvalidTriggerError when a condition can never be evaluated. */
export function validateTrigger(trigger: TriggerSpec): void {
  for (const c of trigger.all) {
    if (c.op === "matches") compileRegex(c.value);
  }
}

function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0);
}

export function actualValue(cond: Condition, item: ItemView): unknown {
  if (cond.field === "title") return item.title;
  if (cond.field === "body") return item.body;
  return item.features[cond.field];
}

export function evaluateCondition(cond: Condition, item: ItemView): boolean {
  const actual = actualValue(cond, item);
  switch (cond.op) {
    case "eq":
      return (actual ?? null) === (cond.value ?? null);
    case "neq":
      return (actual ?? null) !== (cond.value ?? null);
    case "includes":
      return Array.isArray(actual) && actual.includes(cond.value);
    case "excludes":
      return !Array.isArray(actual) || !actual.includes(cond.value);
    case "matches":
      return typeof actual === "string" && compileRegex(cond.value).test(actual);
    case "isEmpty":
      return isEmptyValue(actual);
    case "isNotEmpty":
      return !isEmptyValue(actual);
  }
}

export type ConditionResult = { cond: Condition; actual: unknown; pass: boolean };

export type Evaluation = {
  deterministicMatch: boolean;
  conditionResults: ConditionResult[];
  needsJudgment: boolean;
};

export function evaluate(trigger: TriggerSpec, item: ItemView): Evaluation {
  const conditionResults = trigger.all.map((cond) => ({ cond, actual: actualValue(cond, item), pass: evaluateCondition(cond, item) }));
  const deterministicMatch = conditionResults.every((r) => r.pass);
  return { deterministicMatch, conditionResults, needsJudgment: deterministicMatch && !!trigger.judgment };
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "empty";
  if (typeof v === "string") return `\`${v}\``;
  return String(v);
}

/** Plain-English rendering of one condition, e.g. "no version is mentioned". */
export function describeCondition(c: Condition): string {
  if (c.op === "includes" || c.op === "excludes") return c.op === "includes" ? `labels include \`${c.value}\`` : `labels don't include \`${c.value}\``;
  if (c.op === "matches") return `${c.field} matches /${c.value}/`;
  const label = FEATURE_LABELS[c.field];
  if ((c.op === "eq" || c.op === "neq") && typeof c.value === "boolean") {
    const positive = (c.op === "eq") === c.value;
    if (c.field === "hasVersion") return positive ? "a version is mentioned" : "no version is mentioned";
    if (c.field === "hasRepro") return positive ? "it has reproduction steps" : "no reproduction steps";
    if (c.field === "hasStackTrace") return positive ? "it includes a stack trace" : "no stack trace";
    if (positive) return label;
    if (label.startsWith("has ")) return label.replace(/^has (a )?/, "no ");
    if (label.startsWith("looks like")) return label.replace("looks like", "doesn't look like");
    return `not ${label}`;
  }
  switch (c.op) {
    case "eq":
      return `${label} is ${fmt(c.value)}`;
    case "neq":
      return `${label} is not ${fmt(c.value)}`;
    case "isEmpty":
      return `${label} is empty`;
    case "isNotEmpty":
      return `${label} is set`;
    default:
      return label;
  }
}

export function describeTrigger(trigger: TriggerSpec): string {
  const parts = trigger.all.map(describeCondition);
  if (trigger.judgment) parts.push(`(agent judges) ${trigger.judgment}`);
  return parts.length ? parts.join("; ") : "every issue";
}
