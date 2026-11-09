import type { PlaybookStats } from "./types.js";

export const LEVELS = { WATCH: 0, SUGGEST: 1, DRAFT: 2, ACT: 3, AUTO: 4 } as const;
export const LEVEL_NAMES = ["Watch", "Suggest", "Draft", "Act", "Auto"] as const;
export type TrustLevel = 0 | 1 | 2 | 3 | 4;

export type PromotionRule = { reviewed: number; agreement: number; executed?: number; maxUndoneRatio?: number };
export type Thresholds = Record<"toDraft" | "toAct" | "toAuto", PromotionRule>;

export const NORMAL_THRESHOLDS: Thresholds = {
  toDraft: { reviewed: 8, agreement: 0.85 },
  toAct: { reviewed: 15, agreement: 0.9 },
  toAuto: { reviewed: 30, agreement: 0.95, executed: 20, maxUndoneRatio: 0.05 },
};

/** Lower bars so a 2-minute demo can climb the ladder on the seed data. */
export const DEMO_THRESHOLDS: Thresholds = {
  toDraft: { reviewed: 3, agreement: 0.8 },
  toAct: { reviewed: 5, agreement: 0.85 },
  toAuto: { reviewed: 8, agreement: 0.9, executed: 5, maxUndoneRatio: 0.05 },
};

export function thresholdsFor(demoMode: boolean): Thresholds {
  return demoMode ? DEMO_THRESHOLDS : NORMAL_THRESHOLDS;
}

export type Verdict = "approved" | "edited" | "overridden" | "skipped";

export const ROLLING_WINDOW = 20;

/** approved / (approved + edited + overridden) over the last 20 non-skipped reviews (newest first). */
export function rollingAgreement(verdictsNewestFirst: readonly Verdict[]): { agreement: number; window: number } {
  const window = verdictsNewestFirst.filter((v) => v !== "skipped").slice(0, ROLLING_WINDOW);
  if (window.length === 0) return { agreement: 0, window: 0 };
  return { agreement: window.filter((v) => v === "approved").length / window.length, window: window.length };
}

export type Eligibility = {
  eligible: boolean;
  nextLevel: TrustLevel | null;
  evidence: { reviewed: number; agreement: number; executed: number; undone: number; testsPassing: number; testsTotal: number };
  blockers: string[];
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function eligibility(stats: PlaybookStats, level: number, thresholds: Thresholds): Eligibility {
  const evidence = {
    reviewed: stats.reviewed,
    agreement: stats.rollingAgreement,
    executed: stats.executed,
    undone: stats.undone,
    testsPassing: stats.testsPassing,
    testsTotal: stats.testsTotal,
  };
  if (level >= LEVELS.AUTO) return { eligible: false, nextLevel: null, evidence, blockers: ["Already at the highest level."] };
  const nextLevel = (Math.max(level, LEVELS.SUGGEST) + 1) as TrustLevel;
  if (level < LEVELS.SUGGEST) return { eligible: true, nextLevel: LEVELS.SUGGEST, evidence, blockers: [] };
  const rule = nextLevel === LEVELS.DRAFT ? thresholds.toDraft : nextLevel === LEVELS.ACT ? thresholds.toAct : thresholds.toAuto;
  const blockers: string[] = [];
  if (stats.reviewed < rule.reviewed) blockers.push(`Needs ${rule.reviewed} reviewed decisions (has ${stats.reviewed}).`);
  if (stats.rollingAgreement < rule.agreement) blockers.push(`Needs ${pct(rule.agreement)} agreement (has ${pct(stats.rollingAgreement)}).`);
  if (rule.executed !== undefined && stats.executed < rule.executed) blockers.push(`Needs ${rule.executed} executed decisions (has ${stats.executed}).`);
  if (rule.maxUndoneRatio !== undefined && stats.executed > 0 && stats.undone / stats.executed > rule.maxUndoneRatio) {
    blockers.push(`Undo rate must be at most ${pct(rule.maxUndoneRatio)} (is ${pct(stats.undone / stats.executed)}).`);
  }
  if (stats.testsTotal < 1) blockers.push("Needs at least one regression test.");
  else if (stats.testsPassing < stats.testsTotal) blockers.push(`${stats.testsTotal - stats.testsPassing} test(s) failing.`);
  return { eligible: blockers.length === 0, nextLevel, evidence, blockers };
}

export type DriftInput = {
  level: number;
  latestVerdict: Verdict | null;
  verdictsNewestFirst: readonly Verdict[];
};

export type DriftResult = { demote: boolean; reason: string | null };

export const DRIFT_MIN_WINDOW = 10;
export const DRIFT_AGREEMENT = 0.8;

/** Drift rules (05 §8): an override at autonomy, or agreement falling below 80% over ≥10 reviews. */
export function checkDrift(input: DriftInput): DriftResult {
  if (input.level <= LEVELS.SUGGEST) return { demote: false, reason: null };
  if (input.level >= LEVELS.ACT && (input.latestVerdict === "overridden" || input.latestVerdict === "edited")) {
    return { demote: true, reason: "override at autonomy" };
  }
  const { agreement, window } = rollingAgreement(input.verdictsNewestFirst);
  if (window >= DRIFT_MIN_WINDOW && agreement < DRIFT_AGREEMENT) {
    return { demote: true, reason: `agreement dropped to ${pct(agreement)}` };
  }
  return { demote: false, reason: null };
}

export type UnmatchedInput = { recentOpenIssues: number; recentUnmatched: number };

/** "New kind of issue arriving" alarm: >50% of ≥10 new issues match no playbook. */
export function unmatchedSpike(input: UnmatchedInput): boolean {
  return input.recentOpenIssues >= 10 && input.recentUnmatched / input.recentOpenIssues > 0.5;
}
