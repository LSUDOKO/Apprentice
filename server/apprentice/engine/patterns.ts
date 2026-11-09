import { inferBindings } from "./bindings.js";
import { computeSignature } from "./signature.js";
import { evaluate } from "./triggers.js";
import type { Condition, EpisodeLike, FeatureField, IssueFeatures, ItemView, StepSpec, TriggerSpec } from "./types.js";

const BOOLEAN_FIELDS: FeatureField[] = ["hasVersion", "hasRepro", "hasStackTrace", "hasCodeBlock", "mentionsDocs", "isLikelySpam", "authorIsFirstTime"];
// versionMentioned is covered by hasVersion; mentionsComponent is keyword noise that discriminates by coincidence.
const NULLABLE_FIELDS: FeatureField[] = ["priority", "component", "assignee"];
const CATEGORICAL_FIELDS: FeatureField[] = ["kind"];

const MAX_CONDITIONS = 4;
const TARGET_NEGATIVE_SHARE = 0.1;
const WEAK_PRECISION = 0.75;

function matchesAll(conds: Condition[], item: ItemView): boolean {
  return evaluate({ all: conds }, item).deterministicMatch;
}

/** Conditions every positive satisfies. */
export function candidateConditions(positives: ItemView[], negatives: ItemView[]): Condition[] {
  const first = positives[0];
  if (!first) return [];
  const f = (item: ItemView) => item.features;
  const out: Condition[] = [];
  for (const field of CATEGORICAL_FIELDS) {
    const v = f(first)[field];
    if (positives.every((p) => f(p)[field] === v)) out.push({ field, op: "eq", value: v as string });
  }
  for (const field of BOOLEAN_FIELDS) {
    const v = f(first)[field] as boolean;
    if (positives.every((p) => f(p)[field] === v)) out.push({ field, op: "eq", value: v });
  }
  const negativeLabels = new Set(negatives.flatMap((n) => f(n).labels));
  const allLabels = new Set(positives.flatMap((p) => f(p).labels));
  for (const label of allLabels) {
    if (positives.every((p) => f(p).labels.includes(label))) out.push({ field: "labels", op: "includes", value: label });
  }
  for (const label of negativeLabels) {
    if (positives.every((p) => !f(p).labels.includes(label))) out.push({ field: "labels", op: "excludes", value: label });
  }
  for (const field of NULLABLE_FIELDS) {
    const values = positives.map((p) => f(p)[field] as string | null);
    if (values.every((v) => v === null)) out.push({ field, op: "isEmpty" });
    else if (values.every((v) => v !== null && v === values[0])) out.push({ field, op: "eq", value: values[0] ?? null });
  }
  return out;
}

export type InferredTrigger = { trigger: TriggerSpec; weakTrigger: boolean; negativeShare: number; precision: number };

/**
 * Greedy discriminative trigger inference (05 §3.1). Positives are the issue
 * contexts the user handled with this signature; negatives are contexts they
 * handled differently. Picks conditions that exclude the most negatives.
 */
export function inferTrigger(positives: ItemView[], negatives: ItemView[]): InferredTrigger {
  const pool = candidateConditions(positives, negatives);
  const chosen: Condition[] = [];
  let remaining = negatives;
  while (chosen.length < MAX_CONDITIONS && pool.length > 0) {
    let bestIdx = -1;
    let bestExcluded = 0;
    pool.forEach((cond, i) => {
      const excluded = remaining.filter((n) => !matchesAll([cond], n)).length;
      if (excluded > bestExcluded) {
        bestExcluded = excluded;
        bestIdx = i;
      }
    });
    if (bestIdx === -1) break;
    chosen.push(pool[bestIdx]!);
    pool.splice(bestIdx, 1);
    remaining = remaining.filter((n) => matchesAll(chosen, n));
    if (negatives.length === 0 || remaining.length / negatives.length <= TARGET_NEGATIVE_SHARE) break;
  }
  if (chosen.length === 0 && pool[0]) chosen.push(pool[0]);
  const negativeShare = negatives.length ? remaining.length / negatives.length : 0;
  const posMatched = positives.filter((p) => matchesAll(chosen, p)).length;
  const precision = posMatched + remaining.length ? posMatched / (posMatched + remaining.length) : 1;
  return { trigger: { all: chosen, judgment: null }, weakTrigger: precision < WEAK_PRECISION, negativeShare, precision };
}

const KIND_NOUN: Record<IssueFeatures["kind"], string> = {
  bug: "bugs",
  feature: "feature requests",
  question: "questions",
  docs: "docs issues",
  other: "issues",
};

/** Deterministic playbook name, e.g. "Needs-info for unversioned bugs". */
export function nameFrom(trigger: TriggerSpec, steps: StepSpec[]): string {
  const kindCond = trigger.all.find((c) => c.field === "kind" && c.op === "eq");
  const noun = kindCond && "value" in kindCond ? KIND_NOUN[kindCond.value as IssueFeatures["kind"]] ?? "issues" : "issues";
  const noVersion = trigger.all.some((c) => c.field === "hasVersion" && c.op === "eq" && c.value === false);
  const crash = trigger.all.some((c) => c.field === "hasStackTrace" && c.op === "eq" && c.value === true);
  const qualifier = noVersion ? "unversioned " : crash ? "crashing " : "";
  const labelStep = steps.find((s) => s.action === "label-issue");
  const added = labelStep?.params.add;
  const labels = added?.owner === "fixed" && Array.isArray(added.value) ? (added.value as string[]) : [];
  const head =
    steps.some((s) => s.action === "request-repro") || labels.includes("needs-info")
      ? "Needs-info"
      : steps.some((s) => s.action === "mark-duplicate")
        ? "Duplicates"
        : steps.some((s) => s.action === "close-issue")
          ? "Close"
          : labels[0]
            ? `Label ${labels.find((l) => l !== "bug") ?? labels[0]}`
            : "Triage";
  return `${head} for ${qualifier}${noun}`;
}

export type PatternCandidateDraft = {
  signature: string;
  actorEmail: string;
  episodeIds: string[];
  trigger: TriggerSpec;
  steps: StepSpec[];
  support: number;
  weakTrigger: boolean;
  suggestedName: string;
  conflictWith: ConflictInfo[] | null;
};

export type ConflictInfo = { actorEmail: string; signature: string; episodeIds: string[]; steps: StepSpec[] };

export type DetectInput = {
  /** All episodes of the user and their team (seed included). Open live episodes count provisionally. */
  episodes: EpisodeLike[];
  actorEmail: string;
  minSupport: number;
  coveredSignatures: ReadonlySet<string>;
  dismissedSignatures: ReadonlySet<string>;
};

const CONFLICT_OVERLAP = 0.6;

function signatureOf(ep: EpisodeLike): string {
  return ep.signature ?? computeSignature(ep.steps);
}

/**
 * Pattern detection (05 §3). Only live demonstrations (watch/lesson) can propose
 * a candidate; seed history only sharpens the trigger and detects team conflicts.
 * An open live episode counts once its signature equals a closed one's, so the
 * card appears the moment the second demonstration is complete.
 */
export function detectPatterns(input: DetectInput): PatternCandidateDraft[] {
  const mine = input.episodes.filter((e) => e.actorEmail === input.actorEmail && e.steps.length > 0);
  const live = mine.filter((e) => e.source !== "seed");
  const closedLiveSigs = new Set(live.filter((e) => e.status === "closed").map(signatureOf));
  const counted = live.filter((e) => e.status === "closed" || closedLiveSigs.has(signatureOf(e)));

  const groups = new Map<string, EpisodeLike[]>();
  for (const ep of counted) {
    const sig = signatureOf(ep);
    groups.set(sig, [...(groups.get(sig) ?? []), ep]);
  }

  const drafts: PatternCandidateDraft[] = [];
  for (const [signature, group] of groups) {
    if (group.length < input.minSupport) continue;
    if (input.coveredSignatures.has(signature) || input.dismissedSignatures.has(signature)) continue;
    const sameSigHistory = mine.filter((e) => e.status === "closed" && signatureOf(e) === signature);
    const positives = [...new Map([...group, ...sameSigHistory].map((e) => [e.id, e.contextStart])).values()];
    const negatives = mine.filter((e) => e.status === "closed" && signatureOf(e) !== signature).map((e) => e.contextStart);
    const inferred = inferTrigger(positives, negatives);
    const steps = inferBindings(group);
    drafts.push({
      signature,
      actorEmail: input.actorEmail,
      episodeIds: group.map((e) => e.id),
      trigger: inferred.trigger,
      steps,
      support: group.length,
      weakTrigger: inferred.weakTrigger,
      suggestedName: nameFrom(inferred.trigger, steps),
      conflictWith: findConflicts(inferred.trigger, signature, input),
    });
  }
  return drafts;
}

/** Team mode (F19): other teachers who handle the same kind of issue with different steps. */
export function findConflicts(trigger: TriggerSpec, signature: string, input: DetectInput): ConflictInfo[] | null {
  const others = input.episodes.filter((e) => e.actorEmail !== input.actorEmail && e.status === "closed" && e.steps.length > 0);
  const byActorSig = new Map<string, EpisodeLike[]>();
  for (const ep of others) {
    const key = `${ep.actorEmail}\u0000${signatureOf(ep)}`;
    byActorSig.set(key, [...(byActorSig.get(key) ?? []), ep]);
  }
  const conflicts: ConflictInfo[] = [];
  for (const [key, group] of byActorSig) {
    const [actorEmail = "", sig = ""] = key.split("\u0000");
    if (sig === signature || group.length < input.minSupport) continue;
    const overlap = group.filter((e) => evaluate(trigger, e.contextStart).deterministicMatch).length / group.length;
    if (overlap >= CONFLICT_OVERLAP) {
      conflicts.push({ actorEmail, signature: sig, episodeIds: group.map((e) => e.id), steps: inferBindings(group) });
    }
  }
  return conflicts.length ? conflicts : null;
}
