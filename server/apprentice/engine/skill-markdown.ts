import { describeCondition } from "./triggers.js";
import { LEVEL_NAMES } from "./trust.js";
import type { ParamSpec, StepSpec, TriggerSpec } from "./types.js";

export type SkillInput = {
  id: string;
  name: string;
  description: string;
  trigger: TriggerSpec;
  steps: StepSpec[];
  trustLevel: number;
  demonstrations: { actorEmail: string; number: number; at: number }[];
  backtest: { matched: number; agreed: number } | null;
  testsPassing: number;
  testsTotal: number;
};

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "playbook"
  );
}

function fmtValue(v: unknown): string {
  if (Array.isArray(v)) return v.length ? v.map((x) => `\`${String(x)}\``).join(", ") : "none";
  if (v === null || v === undefined) return "none";
  return `\`${String(v)}\``;
}

function fmtParam(key: string, p: ParamSpec): string {
  if (p.owner === "fixed") return `${key} ${fmtValue(p.value)} *(fixed)*`;
  if (p.owner === "fromItem") return `${key} from the issue's \`${p.path}\` *(from issue)*`;
  return `${key}: *(you decide)* ${p.instruction}`;
}

function dateOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Deterministic SKILL.md for a playbook (05 §11). No LLM. */
export function skillMarkdown(input: SkillInput): string {
  const conditions = input.trigger.all.map((c) => `- ${describeCondition(c)}`);
  if (input.trigger.judgment) conditions.push(`- and, in your judgment: ${input.trigger.judgment}`);
  const steps = input.steps.map((s, i) => {
    const params = Object.entries(s.params)
      .filter(([, p]) => !(p.owner === "fixed" && Array.isArray(p.value) && p.value.length === 0))
      .map(([k, p]) => fmtParam(k, p));
    const flag = s.checkpoint ? " ⚑ checkpoint — ask the user first" : "";
    return `${i + 1}. **${s.action}** — ${params.join("; ") || "no parameters"}${flag}`;
  });
  const checkpoints = input.steps.filter((s) => s.checkpoint);
  const byActor = new Map<string, { numbers: number[]; last: number }>();
  for (const d of input.demonstrations) {
    const cur = byActor.get(d.actorEmail) ?? { numbers: [], last: 0 };
    cur.numbers.push(d.number);
    cur.last = Math.max(cur.last, d.at);
    byActor.set(d.actorEmail, cur);
  }
  const learned = [...byActor.entries()].map(
    ([actor, v]) => `- ${v.numbers.length} demonstration${v.numbers.length === 1 ? "" : "s"} by ${actor} (issues ${v.numbers.map((n) => `#${n}`).join(", ")}) on ${dateOf(v.last)}`,
  );
  const evidence = [
    input.backtest ? `Backtest: matched ${input.backtest.matched}, agreed ${input.backtest.agreed}` : null,
    `Tests: ${input.testsPassing}/${input.testsTotal} passing`,
    `Trust level: ${LEVEL_NAMES[input.trustLevel] ?? "Watch"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const demoCount = input.demonstrations.length;
  const agreement = input.backtest ? ` Agreed with the user ${input.backtest.agreed}/${input.backtest.matched} times in backtest.` : "";
  const description = `Use when ${input.trigger.all.map(describeCondition).join(", ") || "an issue needs triage"}. ${input.description.trim()} Learned by Apprentice from ${demoCount} demonstration${demoCount === 1 ? "" : "s"}.${agreement}`
    .replace(/\s+/g, " ")
    .trim();

  return [
    "---",
    `name: ${slugify(input.name)}`,
    `description: ${description}`,
    "---",
    "",
    `# ${input.name}`,
    "",
    "## When to use",
    conditions.length ? "All of these are true for the issue:" : "Any issue in the triage queue.",
    ...conditions,
    "",
    "## Steps",
    ...steps,
    "",
    "## Checkpoints",
    checkpoints.length
      ? checkpoints.map((s) => `- Ask the user before **${s.action}**.`).join("\n")
      : "- None. Ask before closing or marking anything as duplicate.",
    "",
    "## If you are running inside Apprentice",
    `Call \`run-playbook\` with playbook id \`${input.id}\` instead of doing the steps by hand.`,
    "",
    "## If you are running somewhere else",
    "If the Apprentice MCP server is connected, call its `run-playbook` tool. Otherwise perform the",
    "equivalent steps in your issue tracker, and ask the user before any destructive action.",
    "",
    "## Learned from",
    ...(learned.length ? learned : ["- Created by hand"]),
    `- ${evidence}`,
    "",
  ].join("\n");
}
