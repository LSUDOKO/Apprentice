import { describe, expect, it } from "vitest";

import { backtest } from "../backtest.js";
import { inferBindings } from "../bindings.js";
import { predictNextStep, type PredictionSource } from "../predict.js";
import { skillMarkdown } from "../skill-markdown.js";
import { expectationFromReview, runTest } from "../tests.js";
import type { TriggerSpec } from "../types.js";
import { episode, NEEDS_INFO, unversionedBug, versionedBug } from "./fixtures.js";

const trigger: TriggerSpec = { all: [{ field: "kind", op: "eq", value: "bug" }, { field: "hasVersion", op: "eq", value: false }] };
const steps = inferBindings([episode("e1", unversionedBug(1), NEEDS_INFO("a")), episode("e2", unversionedBug(2), NEEDS_INFO("b"))]);

describe("backtest", () => {
  it("counts agreed, disagreed (false positive) and missed", () => {
    const eps = [
      episode("a", unversionedBug(3), NEEDS_INFO("x")),
      episode("d", unversionedBug(4), [{ action: "close-issue", args: { reason: "invalid" }, at: 1 }]),
      episode("m", versionedBug(5), NEEDS_INFO("y")),
      episode("n", versionedBug(6), [{ action: "set-priority", args: { priority: "p2" }, at: 1 }]),
    ];
    const r = backtest(trigger, steps, eps);
    expect(r).toMatchObject({ considered: 4, matched: 2, agreed: 1, falsePositives: 1 });
    expect(r.missed.map((m) => m.episodeId)).toEqual(["m"]);
  });
});

describe("regression tests", () => {
  it("applies=false passes only when the trigger does not match", () => {
    expect(runTest({ trigger, steps }, unversionedBug(7), { applies: false, steps: [] }).pass).toBe(false);
    expect(runTest({ trigger, steps }, versionedBug(8), { applies: false, steps: [] }).pass).toBe(true);
  });
  it("fails on a different action sequence or a different fixed value", () => {
    expect(runTest({ trigger, steps }, unversionedBug(9), { applies: true, steps: [{ action: "close-issue", args: {} }] }).pass).toBe(false);
    const wrongAssignee = NEEDS_INFO("z").map((s) => ({ action: s.action, args: s.action === "assign-issue" ? { assignee: "core-team" } : s.args }));
    expect(runTest({ trigger, steps }, unversionedBug(9), { applies: true, steps: wrongAssignee }).pass).toBe(false);
    const right = NEEDS_INFO("z").map((s) => ({ action: s.action, args: s.args }));
    expect(runTest({ trigger, steps }, unversionedBug(9), { applies: true, steps: right }).pass).toBe(true);
  });
  it("turns reviews into expectations", () => {
    expect(expectationFromReview("approve", [], null)).toBeNull();
    expect(expectationFromReview("override", [], [])).toEqual({ applies: false, steps: [] });
  });
});

describe("ghost prediction", () => {
  const src: PredictionSource = { id: "p", kind: "playbook", name: "Needs-info", trustLevel: 1, rollingAgreement: 1, trigger, steps };
  const view = unversionedBug(10);
  it("suggests the remaining labels of a half-done label step, then the next step", () => {
    const half = predictNextStep({ issue: view, contextStart: view, doneSteps: [{ action: "label-issue", args: { add: ["needs-info"], remove: [] }, at: 1 }], sources: [src] });
    expect(half).toMatchObject({ action: "label-issue", args: { add: ["bug"] }, stepIndex: 0 });
    const next = predictNextStep({ issue: view, contextStart: view, doneSteps: [{ action: "label-issue", args: { add: ["bug", "needs-info"], remove: [] }, at: 1 }], sources: [src] });
    expect(next).toMatchObject({ action: "request-repro", needsAgent: false, agentParams: ["message"] });
  });
  it("returns nothing when the user diverged or the next step is destructive", () => {
    expect(predictNextStep({ issue: view, contextStart: view, doneSteps: [{ action: "close-issue", args: {}, at: 1 }], sources: [src] })).toBeNull();
    const destructive: PredictionSource = { ...src, steps: [{ id: "x", action: "close-issue", params: {}, checkpoint: true, destructive: true }] };
    expect(predictNextStep({ issue: view, contextStart: view, doneSteps: [], sources: [destructive] })).toBeNull();
  });
});

describe("SKILL.md", () => {
  it("renders the standard structure deterministically", () => {
    const md = skillMarkdown({
      id: "pb_1",
      name: "Needs-info for unversioned bugs",
      description: "Asks for the missing version.",
      trigger,
      steps,
      trustLevel: 3,
      demonstrations: [{ actorEmail: "alice@example.com", number: 31, at: Date.UTC(2026, 10, 9) }],
      backtest: { matched: 34, agreed: 31 },
      testsPassing: 12,
      testsTotal: 12,
    });
    expect(md).toMatchSnapshot();
    expect(md.startsWith("---\nname: needs-info-for-unversioned-bugs\n")).toBe(true);
  });
});
