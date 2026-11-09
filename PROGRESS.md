# PROGRESS

Spec: `apprentice-build-kit/` (docs 00–13). Framework: `@agent-native/core` **0.226.0** (`chat` template).

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 0 Orientation | Done | API verification table below. No LLM key is configured in this environment (see "Needs an LLM key"). |
| 1 Foundation (F0) | Done | Schema + migrations, features engine, seed, domain actions with `mutateIssue`, Queue + Issue detail, nav state, `view-screen`, `focus-issue`, AGENTS.md, `triage-domain` skill |
| 2 Watch → pattern → playbook (F1–F3) | Done | Episodes, signatures, trigger inference, bindings, pattern card, editor (Recipe, SKILL.md, History) |
| 3 Runs, review, trust (F4–F6) | Done | Runs/decisions/executor, `needsApproval` predicate on every domain action, Review, Exceptions, trust ladder |
| 4 Prove it (F7, F8) | Done | Backtest tab with live toggles, regression tests + gate, `evals/apprentice.eval.ts` |
| 5 Assist & safety (F9–F12) | Done | Ghost chip (Tab/Esc, outcome tracking), provenance drawer, undo run/decision with conflict protection, drift demotion + banner |
| 6 Scale out (F13, F16, F17, F20) | Done | `run-autopilot`, `build-digest`, `install-autopilot` (Agent Resources job), Insights + digests, MCP catalog + `review-batch` `embedRoute`, export skill (zip) |
| 7 Wow (F14, F15, F19) | Done | Lessons with Recorder report + narration mic, voice intents in AGENTS.md, Team-mode conflict card + `resolve-conflict` |
| 7 Wow (F18 sub-agent backtests) | Not built | Judgments are resolved sequentially by the agent (`resolve-judgments`) |
| 8 Polish | Partial | Light theme reviewed screen by screen; keyboard map + `?` overlay; empty/loading/error states. Dark-mode tokens defined but not reviewed screen by screen. |
| 9 Stretch (F21–F23) | Not started | By design (cut order) |

## Verification

- `pnpm typecheck`: clean (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- `pnpm agent-native:doctor`: clean.
- `pnpm test`: **53 passing**, made up of engine unit tests (features, actions, signature, triggers, bindings, patterns incl. team conflict, trust/eligibility/drift, approval predicate matrix, confidence/time saved, backtest, tests, ghost prediction, SKILL.md snapshot) and one **integration test of the whole loop** on in-memory PGlite (seed → watch → pattern → ghost → playbook → backtest → shadow review → override test blocks promotion → fix → Draft → Act run → provenance → undo).
- Browser click-through (Playwright, local dev, demo data), E2E script from `09-TESTING`:

| # | Step | Result |
|---|---|---|
| 1 | Queue with demo data + "Demo data" badge | ✅ |
| 2–3 | Triage #31, #32 by hand → pattern card | ✅ the card appears immediately after the second demonstration (with Bob's conflict) |
| 4 | Ghost chip on #33 after `needs-info`, Tab runs it | ✅ in the integration test (prediction from the candidate); chip renders in the action bar |
| 5 | Make playbook → editor, 3 steps, owners, SKILL.md | ✅ |
| 6 | Backtest numbers, toggle changes them | ✅ 29 considered · 17 matched · 14 agreed → toggling `kind` gives 25/14 |
| 7 | Agent "let me tune this" → inline sliders | ⏳ needs an LLM key (skill + `appAction` recipe in `apprentice-teacher`) |
| 8 | Run → Review: approve 5, override 1 → "Saved as test" | ✅ "Saved as test #3" |
| 9 | Override test blocks promotion; fix trigger → passing; breaking edit blocked | ✅ (blocked-edit path covered by the integration test) |
| 10 | Promote to Draft; agent run pauses for Approve/Deny | ✅ promotion + human *Approve & apply*; ⏳ the agent pause needs an LLM key (predicate unit-tested) |
| 11 | Promote to Act → runs without asking | ✅ "1 matched · 1 executed" |
| 12 | Override at Act → auto-demotion banner | ✅ in the engine (`checkDrift`) and wired in `review-decision`; banner in the chrome |
| 13 | Undo the run → restored | ✅ in UI and integration test (comments retracted, conflicts refused) |
| 14 | "Who taught you this?" | ✅ shows the #31 and #32 demonstrations |
| 15 | Insights hours saved > 0; autopilot → digest in-app | ✅ via *Run autopilot now* / *Build digest now*; the scheduled job is installed through `install-autopilot` |
| 16 | Export skill zip | ✅ (`export-skill` + JSZip) |
| 17 | MCP inline review card | ⏳ needs a connected host; deep link always works |
| 18 | Team-mode conflict card + resolve | ✅ card shows Bob's way; "Use bob's way" calls `resolve-conflict` |

### Needs an LLM key (not verified here)
Agent chat replies, the Draft-level agent Approve/Deny pause, the generative-UI tuner, `resolve-judgments` by the agent, and `pnpm eval`. Add `ANTHROPIC_API_KEY` (or OpenAI or Builder) to `.env`.

## Framework API verification (installed types win over the spec sheet)

| API (spec 12) | Status | Note |
|---|---|---|
| `defineAction` (`@agent-native/core/action`) | OK | `needsApproval` predicate `(args, ctx)`, `audit.target`, `mcpTool`, `agentTool`, `readOnly`, `link`, `mcpApp` all present |
| `fail(message, { errorCode, statusCode })` | OK | Used instead of throwing `Error` with `.code` |
| `ctx.caller` union | DIFFERENT | Adds `mcp-widget`, `mcp-widget-write`, `webmcp` |
| `useActionQuery` / `useActionMutation` / `useDbSync` / `setClientAppState` | OK | `@agent-native/core/client/hooks` |
| `useAgentRouteState` | OK | `getNavigationState({ pathname, searchParams })` |
| `AgentSidebar`, `sendToAgentChat` | OK | Sidebar comes from `@agent-native/toolkit/app/chat` in this template |
| `readAppState` / `writeAppState` / `writeAppStateForCurrentTab` | OK | `@agent-native/core/application-state` |
| DB schema helpers `table/text/integer` | DIFFERENT | Template convention is `drizzle-orm/pg-core` + `createGetDb` + `runMigrations` (followed) |
| Audit log reader from server code | DIFFERENT | No server helper; provenance queries `agent_audit_log` via `getDbExec`, scoped to owner/actor |
| `recorder` (`@agent-native/core/client/recorder`) | OK | `report({ seconds, reason })` returns `{ events: [{ type, name, at }] }` |
| `defineEval`, `usesTool`, `llmJudge`, `createScorer` | OK | `@agent-native/core/eval` |
| Automations `jobs/*.md` | DIFFERENT | Jobs live in Agent Resources (DB), not the repo; written with `resourcePut` from `install-autopilot` |
| `embedRoute` | OK | Exported from `@agent-native/core` (`dist/mcp/embed-route.d.ts`) |
| MCP endpoint | OK | `/mcp` |
| Agent Teams | Not used | F18 not built |
| `agentNative.invoke`, harness agents | Not used | STRETCH |

## Deviations from the spec (and why)

1. **Learning from one-label-at-a-time clicks.** Consecutive steps of the same action are merged (`canonicalSteps`: label `bug` then `needs-info` = one step), so UI demonstrations match seeded history.
2. **The pattern card appears on the second demonstration.** An open live episode counts once its signature equals a closed one, and leaving an issue closes its episode (`end-demonstration`). Otherwise the card would only appear after a third issue or a 5-minute idle.
3. **Ghost suggestions before a playbook exists** use pattern candidates as well as playbooks (demo beat 0:25).
4. **Trigger inference** uses all of the user's history with the same signature as positives (seed included), and only that user's other episodes as negatives. "Weak trigger" means precision < 75%. Keyword-derived nullable features (`mentionsComponent`, `versionMentioned`) are excluded because they discriminate by coincidence.
5. **Override tests fail until the recipe is fixed.** An override is by definition something the playbook got wrong, so its test starts red and blocks promotion. The edit gate refuses only edits that break a **currently passing** test; a rename is allowed while an override test is red.
6. **Demo thresholds**: Suggest→Draft 3 reviewed / 80%, Draft→Act 5 / 85%, Act→Auto 8 / 90% + 5 executed, so the seed demo can climb the ladder (normal thresholds unchanged).
7. **Optional agent params.** `request-repro.message` falls back to the reporter template, so a human can *Approve & apply* without the agent. When the agent runs a playbook, it still writes the message.
8. **Seed layout** adjusted for a clean backtest: 001–012 needs-info, 013–015 invalid closes (the 3 disagreements), 016–018 Bob (Team mode), 019–022 versioned bugs, 023–030 docs/features/spam. #38 is a usage question with pasted config (the demo override). Incoming batch 061–068 is delivered by *Simulate new issues*.
9. **Timestamps** are `BIGINT` epoch ms (Postgres `integer` overflows); JSON columns are `jsonb`.
10. **GitHub import** is unauthenticated: the doctor forbids reading per-user credentials from `process.env`.
11. **Apprentice settings** live at `/preferences`, because `/settings` belongs to the framework.

## Known issues

- On a cold dev start, each new route compiles on first visit (the framework skeleton shows for a few seconds).
- `NODE_OPTIONS=--no-experimental-strip-types` in a shell breaks `agent-native dev`. Unset it for this project.
