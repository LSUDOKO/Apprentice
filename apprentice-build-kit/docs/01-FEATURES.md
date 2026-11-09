# 01 — Features and acceptance criteria

Tags: **CORE** (must ship), **POWER** (wins the hackathon), **WOW** (memorable extras),
**STRETCH** (only after everything else is solid). Build order is in `10-BUILD-PLAN.md`.

Each feature lists its four areas: **UI / Action / Agent / App-state**.

---

## F0 — Triage workspace (CORE, foundation)

The domain the agent learns from: a GitHub-style issue queue.

- **UI:** Queue list (left) + issue detail (right). Filters: open/closed, label, untriaged, has-version, has-repro. Detail shows title, body (markdown), labels, priority, component, assignee, comments, activity timeline.
- **Actions:** `list-issues`, `get-issue`, `label-issue`, `set-priority`, `set-component`, `assign-issue`, `comment-on-issue`, `request-repro`, `mark-duplicate`, `close-issue`, `reopen-issue`, `seed-demo-data`, `reset-demo`, `import-github-issues`.
- **Agent:** can do any triage action on request ("label this as bug").
- **App-state:** `navigation` = `{view, issueId, filter}`; `selection` = selected issue ids.
- **Acceptance:** A user can triage an issue entirely by mouse/keyboard; the agent can do the same via chat; both appear in the activity timeline marked "you" vs "agent".

## F1 — Watch mode with context (CORE)

- Every human mutation on an issue is recorded as a **step** in an **episode** (one episode = one actor working one issue), with the action name, validated args, timestamp, audit event link, and a **context snapshot** (navigation + selection + derived issue features at that moment).
- **UI:** a subtle "Watching" indicator in the top bar (eye icon + count of demonstrations today). Toggle to pause watching. Issue timeline shows "Recorded as demonstration".
- **Actions:** steps recorded inside domain actions via `recordStep()`; `list-demonstrations`, `set-watch-mode`.
- **Agent:** can answer "what have I been doing today?" from demonstrations.
- **Acceptance:** after triaging 3 issues by hand, `list-demonstrations` returns 3 closed episodes with ordered steps and context.

## F2 — Pattern detection → playbook card (CORE)

- After ≥2 episodes share a step signature (min support configurable), a **pattern candidate** appears as a card: "I noticed a pattern: for *bug reports with no version*, you add `needs-info`, request a repro, and assign to `triage`. Make it a playbook?"
- Buttons: **Make playbook**, **Refine with agent** (sends to chat), **Dismiss**.
- **Actions:** `detect-patterns`, `list-pattern-candidates`, `dismiss-pattern`, `create-playbook`.
- **Agent:** names/describes playbooks well; proposes judgment conditions when deterministic features aren't enough.
- **Acceptance:** the seeded demo flow produces the expected candidate after 2 live demonstrations (see `13-SEED-DATA.md`).

## F3 — Visual playbook editor (CORE, signature screen)

- Shows **Trigger → Steps → Checkpoints** as a vertical recipe.
- Trigger = list of conditions on issue features (`labels includes bug`, `versionMentioned is empty`) + optional **judgment condition** in plain English (evaluated by the agent).
- Each step = real action + parameters. Each parameter has an **owner**, color-coded:
  - **Fixed** (graphite) — constant value, e.g. label `needs-info`
  - **From item** (teal) — taken from the issue, e.g. `issue.author`
  - **Agent decides** (violet) — filled by the agent at run time, e.g. comment wording
- Steps can be reordered, removed, marked as checkpoint ("ask me first").
- Every save creates a new **version**; history tab shows diffs.
- The playbook also renders as `SKILL.md` (read-only preview tab).
- **Actions:** `get-playbook`, `list-playbooks`, `update-playbook`, `list-playbook-versions`.
- **App-state:** `navigation.playbookId`, `selection` = selected step.
- **Acceptance:** editing a parameter owner from fixed → agent-decides updates the preview SKILL.md and creates version n+1.

## F4 — Trust ladder on the framework approval gate (CORE)

Levels: **0 Watch · 1 Suggest · 2 Draft · 3 Act (with undo) · 4 Auto**.

- Implemented with `needsApproval` predicates on domain actions: when a call carries a `playbookContext`, the predicate looks up the playbook's level and returns true when approval is required (see `05-ENGINE.md §6`).
- Promotion is earned (agreement rate + minimum reviewed decisions + all tests passing) and requires a human click. Demotion is automatic on override at level ≥3 and on drift.
- **UI:** 5-segment ladder badge on every playbook; promotion button lights up when eligible with the evidence ("19/20 agreed · 12 tests passing").
- **Actions:** `set-trust-level`, `get-promotion-eligibility`.
- **Acceptance:** at level 2 an agent-run step pauses with Approve/Deny in chat; at level 3 non-checkpoint steps run without asking; a checkpoint step still pauses.

## F5 — Shadow mode review (CORE)

- Running a playbook at level 1 creates **decisions** (proposals) without executing anything.
- **UI** `/review`: split view — left: the issue; right: "What I'd do" (resolved steps with param colors) + confidence + explanation. Buttons: **Approve (a)**, **Edit (e)**, **Override (o)**, **Skip (s)**. Agreement meter at top.
- Override opens a mini editor: "What should happen instead?" — pick steps; that becomes a test.
- **Actions:** `run-playbook`, `list-decisions`, `review-decision`, `execute-decision`.
- **Acceptance:** approving 5 and overriding 1 updates agreement to 5/6 and creates 1 test.

## F6 — Exceptions inbox (CORE)

- Issues that no active playbook matches, low-confidence decisions (<60), and pending overrides.
- **UI** `/exceptions` with reason chips ("No playbook matches", "Low confidence", "Checkpoint waiting").
- Handling an exception by hand is itself a demonstration (closes the loop).
- **Actions:** `list-exceptions`.

## F7 — Backtest with live slider (POWER)

- Replays a playbook against the last N items **you** handled by hand: "Would have matched 34 · agreed on 31 · 3 disagreements" with a list of the disagreements.
- **Generative UI:** ask the agent "let me tune this" → it renders an inline sandboxed control (slider/toggles for trigger conditions) that calls `backtest-playbook` via the extension bridge and shows numbers updating live; "Apply" writes back through `update-playbook`.
- Also a native Backtest tab in the editor (same action).
- **Actions:** `backtest-playbook`.
- **Acceptance:** toggling a trigger condition in the tab changes match/agree counts within 1s on seed data.

## F8 — Corrections become tests (POWER)

- Every override/edit creates a **playbook test** (issue snapshot + expected steps).
- `run-playbook-tests` replays the deterministic engine against all tests.
- **Gate:** promotion and edits to an active playbook are blocked while any test fails (clear error listing failures; "Save as draft" still allowed).
- CI: `evals/*.eval.ts` with `defineEval` runs the real agent on fixed prompts (see `09-TESTING.md`).
- **UI:** Tests tab with pass/fail list, "Run tests" button, badge on playbook card.
- **Acceptance:** an override creates a test; editing the playbook so it would repeat the mistake makes the test fail and blocks promotion.

## F9 — Ghost autocomplete (POWER)

- While you work an issue by hand, Apprentice predicts your next step from matching playbooks and shows a faint chip in the action bar: "Label `needs-info` · Tab ↹".
- **Tab** executes the step through the same action the button uses; **Esc** dismisses. Outcomes are recorded (accept/dismiss) and feed confidence.
- If the next step has an agent-decides parameter, the chip reads "Ask Apprentice to write the comment ↹" and Tab sends it to the agent.
- **Actions:** `predict-next-step`, `record-suggestion-outcome`.
- **Acceptance:** on a matching issue after step 1 by hand, the chip shows step 2; Tab performs it.

## F10 — Provenance: "Who taught you this?" (POWER)

- Any agent-made change (timeline entry, decision) has "Why?" → panel showing the playbook + version, the trigger conditions that matched, and the source demonstrations (who, when, links to the issues) plus audit events.
- **Actions:** `explain-decision`.

## F11 — Batch undo (POWER)

- Every executed step stores a before-snapshot. **Undo run** reverts a whole run in reverse order; **Undo** on a single decision too.
- **Actions:** `undo-run`, `undo-decision`.
- **Acceptance:** run on 10 issues → undo → all 10 back to exact prior state; comments created by the run are retracted.

## F12 — Drift alarm (POWER)

- Rolling agreement drops below threshold, or unmatched-item share spikes → playbook demotes one level + notification + banner "Apprentice stepped back: 3 recent overrides on *Needs-info bugs*."
- Computed on every review and every run (no background daemon needed).

## F13 — Autopilot schedule + Slack digest (POWER)

- A scheduled automation (`jobs/apprentice-autopilot.md`) runs active playbooks on new issues hourly, then posts a digest: "Handled 14 · 2 need you · 1 playbook ready to promote".
- Digest always appears in-app (`/insights` → Digests); Slack delivery when Slack messaging is configured.
- **Actions:** `run-autopilot`, `build-digest`.

## F14 — Record a lesson (WOW, uses Recorder)

- "Record a lesson" button: start → do the task → stop. Apprentice pulls the framework Recorder report for that window (route changes, actions, state writes, timings) and merges it with the step records and your narration into one high-quality demonstration.
- Narration: typed, or dictated via the browser speech API mic in the lesson panel; or use the chat composer's built-in voice.
- **Actions:** `start-lesson`, `finish-lesson`.

## F15 — Voice teaching (Tier A tech — realtime voice)

- Uses the framework's built-in **realtime speech mode** in the agent composer: hands-free, the voice agent can navigate and call actions; approval-gated actions still pause.
- Apprentice adds: clean action descriptions + an AGENTS.md section so voice commands like "do the usual for this one" map to `predict-next-step` / `run-playbook` on the current issue.
- No custom voice code needed beyond F14's lesson mic.

## F16 — Approve from Claude / ChatGPT (POWER, MCP Apps)

- Apprentice's MCP server exposes a curated set of actions (`list-playbooks`, `run-playbook`, `review-batch`, `get-insights`, `export-skill`) to external agents.
- `review-batch` has an MCP App UI (`embedRoute`) that renders the real `/review` route inline in capable hosts, with a deep-link fallback everywhere else.
- **Acceptance:** from Claude (with the connector added and the "App cards in chat apps" lab on), asking "review today's Apprentice batch" shows the review UI inline.

## F17 — Portable skill export (Tier A tech)

- **Export skill** downloads a folder zip: `SKILL.md` (frontmatter + instructions + steps) and `playbook.json` (machine-readable spec).
- The SKILL.md works standalone in Claude Code and other skill-aware agents; when used outside Apprentice it instructs the agent to call Apprentice's MCP tools when available.
- **VERIFY** before claiming compatibility with Hermes Agent's skill format; only claim what you tested.
- **Actions:** `export-skill`.

## F18 — Sub-agent backtests (Tier A tech)

- For playbooks with a judgment condition or agent-decides parameters, the agent backtests by splitting items across sub-agents (framework Agent Teams), each scoring a slice; results stream into the Backtest tab.
- Deterministic backtests never need sub-agents (they run in the action).
- **VERIFY** the Agent Teams API (`/docs/agent-teams/`) before building; fallback = sequential agent evaluation.

## F19 — Team mode: teacher disagreement (WOW)

- When different people demonstrate the same trigger with different steps, Apprentice shows a **conflict card**: "Your team handles this two ways: Alice → `needs-info`; Bob → close as `invalid`. Pick one." Choosing creates one shared playbook and records the decision.
- Seed data includes a second teacher (`bob@demo.local`) so this works locally.

## F20 — Insights / time-saved ledger (POWER)

- `/insights`: estimated hours saved (per playbook and total), agreement over time, autonomy level per playbook, suggestion acceptance rate, exceptions trend. Clearly labeled "estimated" with the method in a tooltip.
- **Actions:** `get-insights`.

## F21 — Cross-app playbook step (STRETCH, A2A)

- Step type `delegate`: send a prompt to another Agent-Native app in the workspace (e.g., Mail: "draft a reply to the reporter") via `agentNative.invoke()`. Gated like any step.

## F22 — Drop-in capability (STRETCH)

- Engine isolated behind an `ItemAdapter` interface so Apprentice could be installed into another template (e.g., Mail). Demonstrate only if fully working.

## F23 — Harness agent fix step (STRETCH)

- Step type `code-fix`: hand a known-small bug to a harness agent (Claude Code / Codex / ACP agent) in a sandbox to draft a fix. Only if `registerBuiltinAgentHarnesses()` works in this environment. Always gated at checkpoint.
