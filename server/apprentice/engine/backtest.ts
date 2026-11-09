import { agentParamSets, resolveSteps } from "./bindings.js";
import { canonicalSteps, sameActions, sameFixedArgs } from "./signature.js";
import { evaluate } from "./triggers.js";
import type { EpisodeLike, ExpectedStep, StepSpec, TriggerSpec } from "./types.js";

export type BacktestCase = {
  episodeId: string;
  issueId: string;
  number: number;
  title: string;
  actorEmail: string;
  predicted: ExpectedStep[] | null;
  actual: ExpectedStep[];
  kind: "actions" | "args" | "missed";
};

export type BacktestResult = {
  considered: number;
  matched: number;
  agreed: number;
  disagreed: BacktestCase[];
  missed: BacktestCase[];
  falsePositives: number;
  needsJudgmentCount: number;
  agreement: number;
};

/**
 * Deterministic replay (05 §5): would this playbook have done what you did?
 * Agent-written params are not scored. Judgment conditions are counted, not scored.
 */
export function backtest(trigger: TriggerSpec, steps: StepSpec[], episodes: readonly EpisodeLike[]): BacktestResult {
  const ignore = agentParamSets(steps);
  const shape = steps.map((s) => ({ action: s.action, args: {} }));
  let matched = 0;
  let agreed = 0;
  let needsJudgmentCount = 0;
  const disagreed: BacktestCase[] = [];
  const missed: BacktestCase[] = [];
  for (const ep of episodes) {
    const m = evaluate(trigger, ep.contextStart);
    const actual = canonicalSteps(ep.steps);
    const base = {
      episodeId: ep.id,
      issueId: ep.issueId,
      number: ep.contextStart.number,
      title: ep.contextStart.title,
      actorEmail: ep.actorEmail,
      actual,
    };
    if (m.needsJudgment) needsJudgmentCount++;
    if (m.deterministicMatch) {
      matched++;
      const predicted = resolveSteps(steps, ep.contextStart).map((r) => ({ action: r.action, args: r.args }));
      if (!sameActions(predicted, actual)) disagreed.push({ ...base, predicted, kind: "actions" });
      else if (!sameFixedArgs(predicted, actual, ignore)) disagreed.push({ ...base, predicted, kind: "args" });
      else agreed++;
    } else if (sameActions(shape, actual)) {
      missed.push({ ...base, predicted: null, kind: "missed" });
    }
  }
  return {
    considered: episodes.length,
    matched,
    agreed,
    disagreed,
    missed,
    falsePositives: disagreed.filter((d) => d.kind === "actions").length,
    needsJudgmentCount,
    agreement: matched ? agreed / matched : 0,
  };
}
