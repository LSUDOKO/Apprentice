# 10 — Build plan

Phases are ordered so the app is demoable as early as possible and gets better each phase.
Each phase ends with its **Definition of Done (DoD)**; do not proceed until it passes.
Commit at the end of every phase. Keep `PROGRESS.md` current.

---

## Phase 0 — Orientation (no feature code)
- Read CLAUDE.md and docs 00, 01, 02, 12. Read template's AGENTS.md, actions/hello.ts, server/db, app/root.tsx.
- Verify every API listed in `12-FRAMEWORK-REFERENCE.md` against installed types; record results in `PROGRESS.md` (table: API · status OK/DIFFERENT/MISSING · note).
- Create `BUILT-DURING-HACKATHON.md` (template used, date, plan).
- **DoD:** PROGRESS.md has the verification table; `pnpm dev` runs; agent answers via chat with an LLM key configured.

## Phase 1 — Foundation: data + triage workspace (F0) — CORE
- Schema (03) for issues, comments, activity, settings; migrations per template convention.
- Engine `features.ts` + tests. Seed files (13) + `seed-demo-data`, `reset-demo`.
- Domain actions (04) with `mutateIssue` service (without recordStep yet), audit targets.
- Design tokens + fonts + layout shell (top bar, left rail, AgentSidebar) + Queue + Issue detail.
- `use-navigation-state`, `view-screen`, `focus-issue`, selection writes.
- AGENTS.md (merge from templates) + `triage-domain` skill.
- **DoD:** triage fully by UI and by chat; agent "open issue 14" navigates; typecheck + tests green.

## Phase 2 — Watch → pattern → playbook (F1, F2, F3) — CORE
- Episodes + recordStep + signature + patterns + bindings + trigger inference (+ tests).
- Pattern card UI; `create-playbook`; SKILL.md generator; Playbooks list; Editor Recipe/SKILL.md/History tabs; `update-playbook` with versions.
- `apprentice-teacher` skill.
- **DoD:** E2E steps 1, 2, 3 and 5 pass (step 4, the ghost chip, arrives in Phase 5).

## Phase 3 — Runs, review, trust ladder (F4, F5, F6) — CORE
- Runs, decisions, executor, approval predicate on every domain mutation, `run-playbook`, `resolve-judgments`, `review-decision`, `execute-decision`, eligibility, `set-trust-level`.
- Review screen, Exceptions screen, trust ladder component.
- `playbook-runner` + `shadow-reviewer` skills.
- **DoD:** E2E steps 8, 10, 11 pass (tests gate can be stubbed until Phase 4 — remove the stub in Phase 4).

## Phase 4 — Prove it (F7, F8) — POWER
- Backtest engine + tab with live toggles; tests engine + tab + promotion/edit gate; generative-UI tuner flow in teacher skill.
- `evals/apprentice.eval.ts`.
- **DoD:** E2E steps 6, 7, 9 pass; `agent-native eval` passes.

## Phase 5 — Assist and safety (F9, F10, F11, F12) — POWER
- Ghost prediction + chip + Tab; provenance drawer; undo run/decision; drift checks + notifications/banners.
- **DoD:** E2E steps 4, 12, 13, 14 pass.

## Phase 6 — Scale out (F13, F16, F17, F20) — POWER + Tier A
- `run-autopilot`, `build-digest`, automation file, Insights page + digests.
- MCP catalog flags; `review-batch` with `embedRoute`; Settings MCP help.
- `export-skill` + zip download.
- **DoD:** E2E steps 15, 16 pass; MCP verified in at least one host OR documented as deep-link only.

## Phase 7 — Wow (F14, F15, F18, F19) — WOW + Tier A
- Lessons with Recorder + narration mic; voice intents section in AGENTS.md; sub-agent judgment backtests (VERIFY first); team conflict cards + `resolve-conflict`.
- **DoD:** E2E step 18 passes; a recorded lesson creates a demonstration with narration.

## Phase 8 — Polish (mandatory)
- Visual pass on every screen in light + dark; empty/loading/error states everywhere; keyboard map + `?` overlay; copy review (short, plain); performance (queries indexed, no N+1 in lists).
- Accessibility pass (focus order, labels, contrast).
- README for the repo (see 11) + `BUILT-DURING-HACKATHON.md` complete.
- Run the full E2E script twice from Reset demo.
- **DoD:** all 18 E2E steps pass twice; typecheck, tests, evals green.

## Phase 9 — Stretch (only if Phase 8 is done)
F21 A2A delegate step → F22 drop-in capability → F23 harness code-fix step. Each behind a feature flag; never shown in the demo unless flawless.

---

## Cut order if time runs short (cut from the bottom)
F23 → F22 → F21 → F18 → F19 → F14 → F16 inline card (keep deep link) → F13 Slack (keep in-app digest).
**Never cut:** F0–F12, F17, F20, Phase 8 polish.
