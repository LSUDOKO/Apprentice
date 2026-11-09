# 06 — The agent

The in-app agent is the framework's agent (AgentSidebar + agent loop). Do **not** add another
agent framework. Its behavior is shaped by three files types:

| Building block | File | Source in this kit |
|---|---|---|
| Instructions (every turn) | `AGENTS.md` | `apprentice-templates/AGENTS.md` (merge into the template's file) |
| Skills (on demand) | `.agents/skills/<name>/SKILL.md` | `apprentice-templates/skills/*` |
| Tools | `actions/*.ts` | `04-ACTIONS.md` |

## What the agent does in Apprentice

1. **Ad-hoc triage on request** — "label this as a bug and ask for the version" → calls domain actions without `playbookContext`.
2. **Refine patterns** — from a pattern card's "Refine with agent": rename the candidate, propose a judgment condition only when deterministic conditions can't separate cases, then `create-playbook` or `update-playbook`.
3. **Run playbooks** — `run-playbook`; if it returns `awaiting_judgment`, read each issue (`get-issue`), decide `matches` + write agent-decides params, call `resolve-judgments`.
4. **Execute at Draft level** — call the domain actions with `playbookContext`; the framework pauses for Approve/Deny. Never try to bypass a pause.
5. **Tune via generative UI** — when the user asks to tune a playbook, render an inline extension (`render-inline-extension`) with sliders/toggles that call `appAction("backtest-playbook", …)` and an Apply button that calls `appAction("update-playbook", …)`.
6. **Explain** — "why did you do that?" → `explain-decision`, then summarize provenance in 2–3 sentences.
7. **Move the UI** — use `focus-issue` to show what it's talking about (open the issue, open two issues side by side for a drift/conflict discussion).
8. **Backtest with judgment** — for playbooks with a judgment condition, split the items across sub-agents (Agent Teams — VERIFY API) and merge results; otherwise just call `backtest-playbook`.
9. **Autopilot** — when run by the scheduled automation: `run-autopilot`, resolve judgments, `build-digest`, reply with the digest text (delivery goes to Slack when the automation was created from Slack or a destination is configured).

## Hard rules for the agent (put in AGENTS.md)

- Always call `view-screen` before acting on "this", "here", "the current one".
- Never call `set-trust-level` to raise a level unless the user explicitly asks; it will require approval anyway.
- Never pass `playbookContext` for ad-hoc requests; always pass it when executing a playbook decision.
- Never close or mark duplicate without either user instruction or an approved playbook step.
- Free text it writes into issues (comments) must be polite, specific about what is missing, and under 80 words.
- When uncertain whether a playbook applies, set `matches: false` with a reason — exceptions go to the human.

## view-screen contents

```jsonc
{
  "navigation": { "view": "issue", "issueId": "iss_…" },
  "url": { "pathname": "/issues/iss_…", "searchParams": {} },
  "selection": { "kind": "issues", "ids": ["…"] },
  "issue": { /* hydrated issue + features + comments(last 5) */ },
  "ghostSuggestion": { /* predict-next-step result or null */ },
  "playbook": { /* when on a playbook page: summary, level, stats, failing tests */ },
  "run": { /* when on review: run summary + pending decisions count */ },
  "patternCandidates": [ /* status new|conflict */ ],
  "lesson": { /* active lesson or null */ },
  "watchMode": "on"
}
```

## Dynamic suggestions (AgentSidebar `suggestions` + `dynamicSuggestions`)

Static suggestions: "What have I been doing today?", "Run my playbooks on new issues",
"Which playbooks are ready to promote?". Selection-aware ones come from the framework's dynamic
suggestions; make sure `selection` is meaningful (issue ids, playbook step ids).

## Voice (Tier A)

Built-in composer voice + realtime speech mode need no code. Add an AGENTS.md section mapping
spoken intents: "do the usual" → `predict-next-step` then execute the suggestion (ad-hoc, user
asked); "approve" / "override" during review → `review-decision` on the focused decision.
