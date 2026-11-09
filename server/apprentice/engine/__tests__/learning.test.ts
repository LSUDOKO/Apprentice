import { describe, expect, it } from "vitest";

import { inferBindings, inferParam, resolveStep } from "../bindings.js";
import { detectPatterns, inferTrigger, nameFrom } from "../patterns.js";
import { evaluate, InvalidTriggerError, validateTrigger } from "../triggers.js";
import { docsIssue, episode, item, NEEDS_INFO, unversionedBug, versionedBug } from "./fixtures.js";

describe("triggers", () => {
  const v = unversionedBug(1);
  it("evaluates each operator", () => {
    expect(evaluate({ all: [{ field: "kind", op: "eq", value: "bug" }] }, v).deterministicMatch).toBe(true);
    expect(evaluate({ all: [{ field: "kind", op: "neq", value: "bug" }] }, v).deterministicMatch).toBe(false);
    expect(evaluate({ all: [{ field: "labels", op: "excludes", value: "bug" }] }, v).deterministicMatch).toBe(true);
    expect(evaluate({ all: [{ field: "labels", op: "includes", value: "bug" }] }, v).deterministicMatch).toBe(false);
    expect(evaluate({ all: [{ field: "title", op: "matches", value: "crash(es)?" }] }, v).deterministicMatch).toBe(true);
    expect(evaluate({ all: [{ field: "versionMentioned", op: "isEmpty" }] }, v).deterministicMatch).toBe(true);
    expect(evaluate({ all: [{ field: "versionMentioned", op: "isNotEmpty" }] }, versionedBug(2)).deterministicMatch).toBe(true);
  });
  it("rejects invalid regexes", () => {
    expect(() => validateTrigger({ all: [{ field: "title", op: "matches", value: "(" }] })).toThrow(InvalidTriggerError);
  });
  it("a judgment condition needs the agent only when deterministic conditions match", () => {
    expect(evaluate({ all: [], judgment: "Is it a crash?" }, v).needsJudgment).toBe(true);
    expect(evaluate({ all: [{ field: "kind", op: "eq", value: "docs" }], judgment: "x" }, v).needsJudgment).toBe(false);
  });
});

describe("bindings", () => {
  const ctx = [item(1, "a", "", {}, "ann"), item(2, "b", "", {}, "bob")];
  it("fixed when every value is equal", () => {
    expect(inferParam("assignee", ["triage", "triage"], ctx)).toEqual({ owner: "fixed", value: "triage" });
  });
  it("fromItem when values follow an issue field", () => {
    expect(inferParam("assignee", ["ann", "bob"], ctx)).toEqual({ owner: "fromItem", path: "author" });
  });
  it("agent for differing free text", () => {
    expect(inferParam("message", ["hi ann", "hello bob there"], ctx).owner).toBe("agent");
  });
  it("infers a full recipe and resolves it against a new issue", () => {
    const eps = [episode("e1", unversionedBug(1), NEEDS_INFO("u1")), episode("e2", unversionedBug(2), NEEDS_INFO("u2"))];
    const steps = inferBindings(eps);
    expect(steps.map((s) => s.action)).toEqual(["label-issue", "request-repro", "assign-issue"]);
    const r = resolveStep(steps[1]!, unversionedBug(9));
    expect(r.args.missing).toEqual(["version", "steps"]);
    expect(r.pendingAgentParams).toEqual(["message"]);
  });
});

describe("patterns", () => {
  const me = "me@x.dev";
  const live = [episode("l1", unversionedBug(31), NEEDS_INFO("a")), episode("l2", unversionedBug(32), NEEDS_INFO("b"))];
  const history = [
    episode("h1", unversionedBug(1), NEEDS_INFO("c"), { source: "seed" }),
    episode("h2", versionedBug(2), [{ action: "label-issue", args: { add: ["bug"], remove: [] }, at: 1 }, { action: "set-priority", args: { priority: "p2" }, at: 2 }], { source: "seed" }),
    episode("h3", docsIssue(3), [{ action: "label-issue", args: { add: ["docs"], remove: [] }, at: 1 }], { source: "seed" }),
  ];
  it("seed history alone never proposes a candidate", () => {
    expect(detectPatterns({ episodes: history, actorEmail: me, minSupport: 2, coveredSignatures: new Set(), dismissedSignatures: new Set() })).toHaveLength(0);
  });
  it("two live demonstrations propose one candidate with a discriminative trigger", () => {
    const [c] = detectPatterns({ episodes: [...live, ...history], actorEmail: me, minSupport: 2, coveredSignatures: new Set(), dismissedSignatures: new Set() });
    expect(c?.support).toBe(2);
    expect(c?.trigger.all).toEqual(expect.arrayContaining([{ field: "kind", op: "eq", value: "bug" }]));
    expect(c?.trigger.all.some((x) => x.field === "hasVersion" || x.field === "hasRepro")).toBe(true);
    expect(c?.suggestedName).toBe("Needs-info for unversioned bugs");
  });
  it("an open live episode counts once it matches a closed one", () => {
    const open = { ...live[1]!, status: "open" as const, signature: null };
    expect(detectPatterns({ episodes: [live[0]!, open], actorEmail: me, minSupport: 2, coveredSignatures: new Set(), dismissedSignatures: new Set() })).toHaveLength(1);
  });
  it("skips covered and dismissed signatures", () => {
    const sig = live[0]!.signature!;
    expect(detectPatterns({ episodes: live, actorEmail: me, minSupport: 2, coveredSignatures: new Set([sig]), dismissedSignatures: new Set() })).toHaveLength(0);
    expect(detectPatterns({ episodes: live, actorEmail: me, minSupport: 2, coveredSignatures: new Set(), dismissedSignatures: new Set([sig]) })).toHaveLength(0);
  });
  it("detects a team conflict when another teacher handles the same issues differently", () => {
    const close = [
      { action: "label-issue", args: { add: ["invalid"], remove: [] }, at: 1 },
      { action: "close-issue", args: { reason: "invalid" }, at: 2 },
    ];
    const bob = [episode("b1", unversionedBug(40), close, { actorEmail: "bob@x.dev", source: "seed" }), episode("b2", unversionedBug(41), close, { actorEmail: "bob@x.dev", source: "seed" })];
    const [c] = detectPatterns({ episodes: [...live, ...history, ...bob], actorEmail: me, minSupport: 2, coveredSignatures: new Set(), dismissedSignatures: new Set() });
    expect(c?.conflictWith?.[0]?.actorEmail).toBe("bob@x.dev");
  });
  it("trigger inference keeps at least one condition", () => {
    expect(inferTrigger([unversionedBug(1)], []).trigger.all.length).toBeGreaterThan(0);
    expect(nameFrom({ all: [] }, [])).toBe("Triage for issues");
  });
});
