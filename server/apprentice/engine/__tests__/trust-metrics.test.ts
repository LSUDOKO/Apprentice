import { describe, expect, it } from "vitest";

import { stepNeedsApproval, approvalFor } from "../../services/approval.js";
import { confidence, humanMs, median, savedMs } from "../metrics.js";
import { checkDrift, DEMO_THRESHOLDS, eligibility, NORMAL_THRESHOLDS, rollingAgreement, type Verdict } from "../trust.js";
import { EMPTY_STATS, type StepSpec } from "../types.js";

const stats = (o: Partial<typeof EMPTY_STATS>) => ({ ...EMPTY_STATS, ...o });

describe("trust ladder", () => {
  it("rolling agreement ignores skips and only looks at the last 20", () => {
    const v: Verdict[] = ["skipped", "approved", "overridden", ...Array<Verdict>(30).fill("approved")];
    expect(rollingAgreement(v)).toEqual({ agreement: 19 / 20, window: 20 });
    expect(rollingAgreement([])).toEqual({ agreement: 0, window: 0 });
  });
  it("demo thresholds are lower than normal ones", () => {
    const s = stats({ reviewed: 4, rollingAgreement: 0.9, testsTotal: 2, testsPassing: 2 });
    expect(eligibility(s, 1, DEMO_THRESHOLDS).eligible).toBe(true);
    expect(eligibility(s, 1, NORMAL_THRESHOLDS).blockers[0]).toMatch(/8 reviewed/);
  });
  it("a failing test always blocks promotion", () => {
    const e = eligibility(stats({ reviewed: 50, rollingAgreement: 1, testsTotal: 3, testsPassing: 2 }), 1, DEMO_THRESHOLDS);
    expect(e.eligible).toBe(false);
    expect(e.blockers).toContain("1 test(s) failing.");
  });
  it("Auto needs executed decisions and a low undo rate", () => {
    const e = eligibility(stats({ reviewed: 40, rollingAgreement: 1, executed: 10, undone: 2, testsTotal: 1, testsPassing: 1 }), 3, DEMO_THRESHOLDS);
    expect(e.nextLevel).toBe(4);
    expect(e.blockers.join(" ")).toMatch(/Undo rate/);
  });
  it("drift: an override at Act demotes; low agreement at Draft demotes; Suggest never does", () => {
    expect(checkDrift({ level: 3, latestVerdict: "overridden", verdictsNewestFirst: ["overridden"] }).demote).toBe(true);
    const low: Verdict[] = [...Array<Verdict>(5).fill("overridden"), ...Array<Verdict>(5).fill("approved")];
    expect(checkDrift({ level: 2, latestVerdict: "approved", verdictsNewestFirst: low }).reason).toMatch(/50%/);
    expect(checkDrift({ level: 1, latestVerdict: "overridden", verdictsNewestFirst: low }).demote).toBe(false);
  });
});

describe("approval predicate (levels × checkpoint × destructive)", () => {
  const steps: StepSpec[] = [
    { id: "s1", action: "label-issue", params: {}, checkpoint: false, destructive: false },
    { id: "s2", action: "assign-issue", params: {}, checkpoint: true, destructive: false },
    { id: "s3", action: "close-issue", params: {}, checkpoint: true, destructive: true },
  ];
  const pb = (trustLevel: number) => ({ status: "active", trustLevel, steps });
  it.each([
    [1, "s1", "label-issue", true],
    [2, "s1", "label-issue", true],
    [3, "s1", "label-issue", false],
    [3, "s2", "assign-issue", true],
    [3, "s3", "close-issue", true],
    [4, "s3", "close-issue", false],
  ])("level %i step %s → %s", (level, stepId, action, expected) => {
    expect(stepNeedsApproval(pb(level), stepId, action)).toBe(expected);
  });
  it("fails closed for paused or missing playbooks", () => {
    expect(stepNeedsApproval(null, "s1", "label-issue")).toBe(true);
    expect(stepNeedsApproval({ ...pb(4), status: "paused" }, "s1", "label-issue")).toBe(true);
  });
  it("ad-hoc calls (no playbookContext) are never gated", async () => {
    const pred = approvalFor("label-issue", async () => pb(1));
    expect(await pred({}, { userEmail: "a@b", orgId: null, caller: "tool" })).toBe(false);
    expect(await pred({ playbookContext: { playbookId: "p", runId: "r", decisionId: "d", stepId: "s1" } }, { userEmail: "a@b", orgId: null, caller: "tool" })).toBe(true);
  });
});

describe("confidence & time saved", () => {
  it("uses Laplace smoothing", () => {
    expect(confidence({ approved: 0, reviewed: 0, conditionResults: [], judgmentPending: false })).toBe(50);
    expect(confidence({ approved: 9, reviewed: 10, conditionResults: [], judgmentPending: true })).toBe(Math.round(100 * (10 / 12) * 0.9));
  });
  it("clamps human time to 20s–15min", () => {
    expect(humanMs(0, 1000)).toBe(20_000);
    expect(humanMs(0, 3_600_000)).toBe(900_000);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBeNull();
    expect(savedMs(3, 60_000)).toBe(180_000);
  });
});
