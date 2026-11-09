import { agentParamSets, resolveSteps } from "./bindings.js";
import { sameActions, sameFixedArgs } from "./signature.js";
import { describeCondition, evaluate } from "./triggers.js";
import type { ExpectedStep, ItemView, ResolvedStep, StepSpec, TestExpectation, TriggerSpec } from "./types.js";

export type TestDiff = {
  expected: TestExpectation;
  predicted: ExpectedStep[] | null;
  failedConditions: string[];
};

export type TestRun = { pass: boolean; diff: TestDiff };

/** Replay one regression test against the deterministic engine (05 §9). */
export function runTest(playbook: { trigger: TriggerSpec; steps: StepSpec[] }, issue: ItemView, expected: TestExpectation): TestRun {
  const m = evaluate(playbook.trigger, issue);
  const failedConditions = m.conditionResults.filter((r) => !r.pass).map((r) => describeCondition(r.cond));
  if (!expected.applies) {
    return { pass: !m.deterministicMatch, diff: { expected, predicted: m.deterministicMatch ? toExpected(resolveSteps(playbook.steps, issue)) : null, failedConditions } };
  }
  const predicted = toExpected(resolveSteps(playbook.steps, issue));
  const pass =
    m.deterministicMatch && sameActions(predicted, expected.steps) && sameFixedArgs(predicted, expected.steps, agentParamSets(playbook.steps));
  return { pass, diff: { expected, predicted: m.deterministicMatch ? predicted : null, failedConditions } };
}

export function toExpected(steps: readonly ResolvedStep[]): ExpectedStep[] {
  return steps.map((s) => ({ action: s.action, args: s.args }));
}

/** Build the expectation a review verdict implies. `null` = no test (approve/skip). */
export function expectationFromReview(verdict: "approve" | "edit" | "override" | "skip", proposed: readonly ExpectedStep[], humanSteps: readonly ExpectedStep[] | null): TestExpectation | null {
  if (verdict === "approve" || verdict === "skip") return null;
  const steps = humanSteps ?? [];
  if (verdict === "override" && steps.length === 0) return { applies: false, steps: [] };
  if (verdict === "edit") return { applies: true, steps: steps.length ? [...steps] : [...proposed] };
  return { applies: true, steps: [...steps] };
}
