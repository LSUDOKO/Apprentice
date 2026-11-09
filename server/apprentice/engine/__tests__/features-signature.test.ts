import { describe, expect, it } from "vitest";

import { applyAction, applyLabelDiff, reproTemplate } from "../actions.js";
import { detectRepro, detectSpam, detectStackTrace, detectVersion, deriveFeatures } from "../features.js";
import { canonicalSteps, computeSignature, sameFixedArgs, valuesEqual } from "../signature.js";

describe("features", () => {
  it("detects versions in the common formats", () => {
    expect(detectVersion("using v0.12.3 on mac")).toBe("0.12.3");
    expect(detectVersion("@agent-native/core 0.12")).toBe("0.12");
    expect(detectVersion("version: 1.4.0")).toBe("1.4.0");
    expect(detectVersion("it is broken since yesterday")).toBeNull();
  });
  it("detects repro steps", () => {
    expect(detectRepro("Steps to reproduce:\n1. a\n2. b")).toBe(true);
    expect(detectRepro("1. open\n2. click\nExpected: x")).toBe(true);
    expect(detectRepro("It crashes sometimes.")).toBe(false);
  });
  it("detects stack traces", () => {
    expect(detectStackTrace("Error: boom\n    at run (/app/a.ts:1:2)")).toBe(true);
    expect(detectStackTrace("Traceback (most recent call last)")).toBe(true);
    expect(detectStackTrace("no trace here")).toBe(false);
  });
  it("flags link-heavy spam without code", () => {
    expect(detectSpam("Cheap SEO", "https://a.x https://b.x https://c.x")).toBe(true);
    expect(detectSpam("Bug", "see https://a.x\n```ts\ncode\n```")).toBe(false);
  });
  it("derives kind from labels before keywords", () => {
    const base = { priority: null, component: null, assignee: null, state: "open" as const, closeReason: null, duplicateOf: null, authorIsFirstTime: false };
    expect(deriveFeatures({ ...base, labels: [], title: "App crashes", body: "" }).kind).toBe("bug");
    expect(deriveFeatures({ ...base, labels: ["docs"], title: "App crashes", body: "" }).kind).toBe("docs");
    expect(deriveFeatures({ ...base, labels: [], title: "Feature request: x", body: "" }).kind).toBe("feature");
  });
});

describe("actions", () => {
  it("applies label diffs without duplicates", () => {
    expect(applyLabelDiff(["bug"], ["bug", "needs-info"], [])).toEqual(["bug", "needs-info"]);
    expect(applyLabelDiff(["bug", "x"], [], ["x"])).toEqual(["bug"]);
  });
  it("request-repro adds needs-info and a templated comment", () => {
    const snap = { labels: [], priority: null, component: null, assignee: null, state: "open" as const, closeReason: null, duplicateOf: null };
    const r = applyAction(snap, "request-repro", { missing: ["version"] }, { author: "ann" });
    expect(r.next.labels).toEqual(["needs-info"]);
    expect(r.comment).toBe(reproTemplate("ann", ["version"]));
  });
  it("mark-duplicate closes and links", () => {
    const snap = { labels: [], priority: null, component: null, assignee: null, state: "open" as const, closeReason: null, duplicateOf: null };
    const r = applyAction(snap, "mark-duplicate", { duplicateOfId: "i5" }, { author: "a", duplicateOfNumber: 5 });
    expect(r.next).toMatchObject({ state: "closed", closeReason: "duplicate", duplicateOf: "i5" });
    expect(r.comment).toContain("#5");
  });
});

describe("signature", () => {
  const s = (action: string, args: Record<string, unknown>) => ({ action, args, at: 0 });
  it("same actions with different args share a signature", () => {
    expect(computeSignature([s("assign-issue", { assignee: "a" })])).toBe(computeSignature([s("assign-issue", { assignee: "b" })]));
  });
  it("order matters", () => {
    expect(computeSignature([s("a", {}), s("b", {})])).not.toBe(computeSignature([s("b", {}), s("a", {})]));
  });
  it("collapses consecutive steps of the same action (label clicks one at a time)", () => {
    const steps = [s("label-issue", { add: ["bug"], remove: [] }), s("label-issue", { add: ["needs-info"], remove: [] }), s("assign-issue", { assignee: "t" })];
    expect(canonicalSteps(steps)).toEqual([
      { action: "label-issue", args: { add: ["bug", "needs-info"], remove: [] } },
      { action: "assign-issue", args: { assignee: "t" } },
    ]);
    expect(computeSignature(steps)).toBe("label-issue:add,remove > assign-issue:assignee");
  });
  it("compares arrays as sets and empty arrays as empty", () => {
    expect(valuesEqual(["b", "a"], ["a", "b"])).toBe(true);
    expect(valuesEqual([], undefined)).toBe(true);
    expect(sameFixedArgs([{ action: "x", args: { m: "hi", k: 1 } }], [{ action: "x", args: { m: "other", k: 1 } }], [new Set(["m"])])).toBe(true);
  });
});
