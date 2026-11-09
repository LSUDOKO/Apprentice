# Kickoff prompts for Claude Code

Paste one prompt at a time, in order. Wait for each phase's Definition of Done before moving on.
If Claude Code asks a question, answer it; if it deviates from the spec, ask it to record why in PROGRESS.md.

---

## Phase 0 — Orientation

```
You are building "Apprentice" in this Agent-Native app (created from the chat template).
Read CLAUDE.md fully, then apprentice-docs/00, 01, 02, 10 and 12, then this template's own
AGENTS.md, actions/hello.ts, server/db and app/root.tsx.

Do Phase 0 from apprentice-docs/10-BUILD-PLAN.md:
1. Verify every API in apprentice-docs/12-FRAMEWORK-REFERENCE.md against node_modules/@agent-native/core
   (grep the exports and types). Create PROGRESS.md with a table: API | OK / DIFFERENT / MISSING | note.
2. Create BUILT-DURING-HACKATHON.md (template used, today's date, planned scope).
3. Copy apprentice-templates/skills/* (except README-playbook-skill-format.md) into the folder this
   template uses for agent skills, and merge apprentice-templates/AGENTS.md into AGENTS.md.
4. Confirm `pnpm dev` runs and the agent replies in chat (tell me if an LLM key is needed).
Do not write feature code yet. End with a short summary and any spec deviations you foresee.
```

## Phase 1 — Foundation

```
Do Phase 1 of apprentice-docs/10-BUILD-PLAN.md. Specs: 03-DATA-MODEL (issues, issue_comments,
activity, settings), 04-ACTIONS (Domain + Context sections), 05-ENGINE §2 (features, with unit tests),
07-UI-DESIGN (tokens, fonts, layout shell, Queue, Issue detail, navigation hook), 13-SEED-DATA
(write issues.json + history.json now so later phases can use them).
Work like a senior engineer: vertical slice first, strict types, loading/empty/error states.
Finish with typecheck + tests, click-through, a chat test ("label this as a bug" on an open issue),
update PROGRESS.md and commit.
```

## Phase 2 — Watch → pattern → playbook

```
Do Phase 2. Specs: 03 (episodes, pattern_candidates, playbooks, playbook_versions),
05-ENGINE §1, §3, §4, §11 (+ unit tests), 04 (Watch/learn + Playbooks sections),
07 (pattern card, Playbooks list, Editor: Recipe, SKILL.md, History tabs), apprentice-teacher skill.
Remember: only source watch/lesson episodes can propose candidates (13-SEED-DATA).
Verify E2E steps 1, 2, 3, 5 from 09-TESTING. Update PROGRESS.md and commit.
```

## Phase 3 — Runs, review, trust ladder

```
Do Phase 3. Specs: 03 (runs, decisions, step_executions), 05-ENGINE §5 (evaluate), §6 (trust +
approval predicate on EVERY domain mutation via needsApproval), §8 (confidence), §10 (executor),
04 (Runs and review), 07 (Review, Exceptions, TrustLadder), playbook-runner + shadow-reviewer skills.
Verify E2E steps 8, 10, 11 (include a real agent run at Draft level that pauses for Approve/Deny).
Update PROGRESS.md and commit.
```

## Phase 4 — Prove it

```
Do Phase 4. Specs: 05-ENGINE §5 backtest, §9 tests (+ unit tests), the tests gate on promotion and
on editing active playbooks, Backtest and Tests tabs (07), the generative-UI tuner flow in the
apprentice-teacher skill, and evals/apprentice.eval.ts from 09-TESTING §3.
Verify E2E steps 6, 7, 9 and run the eval gate. Update PROGRESS.md and commit.
```

## Phase 5 — Assist and safety

```
Do Phase 5: ghost prediction (05 §7) + GhostChip with Tab/Esc + outcome tracking, provenance drawer
(explain-decision, 05/04), undo run/decision (05 §10) with conflict protection, drift checks +
notifications/banners (05 §8). Verify E2E steps 4, 12, 13, 14. Update PROGRESS.md and commit.
```

## Phase 6 — Scale out

```
Do Phase 6: run-autopilot, build-digest, the automation from apprentice-templates/jobs (create it the
way 08-INTEGRATIONS §8.3 says), Insights page with digests (05 §12), MCP catalog flags and the
review-batch MCP App via embedRoute (08 §8.1), Settings MCP help, export-skill + zip download
(08 §8.2, format in apprentice-templates/skills/README-playbook-skill-format.md).
Verify E2E steps 15, 16 (and 17 if a host is available). Update PROGRESS.md and commit.
```

## Phase 7 — Wow

```
Do Phase 7: lessons with the framework Recorder + narration mic (08 §8.6, F14), the voice section of
AGENTS.md (F15), sub-agent judgment backtests only after verifying the Agent Teams API (F18, 08 §8.9),
and Team-mode conflict cards + resolve-conflict (F19). Verify E2E step 18 and a recorded lesson.
Update PROGRESS.md and commit.
```

## Phase 8 — Polish (do not skip)

```
Do Phase 8 from 10-BUILD-PLAN: visual pass in light and dark on every screen against 07-UI-DESIGN,
empty/loading/error states everywhere, keyboard map + ? overlay, accessibility pass, query
performance, repo README per 11-DEMO-AND-SUBMISSION, complete BUILT-DURING-HACKATHON.md.
Then run all 18 E2E steps from 09-TESTING twice from Reset demo and report results.
Fix everything that fails. Update PROGRESS.md and commit.
```

## Optional — Deploy

```
Deploy the app following https://www.agent-native.com/docs/deploy-an-app/ with Neon Postgres
(DATABASE_URL). Set required secrets server-side only. Load demo data on first visit for the demo
account. Confirm the scheduled automation fires on the host or document Run now for the demo.
```

## Phase 9 — Stretch (only if everything above is green)

```
Implement STRETCH features in this order behind feature flags: F21 (A2A delegate step),
F22 (ItemAdapter drop-in), F23 (harness code-fix step). Stop at the first one that is not
flawless and remove its flag from the demo build.
```
