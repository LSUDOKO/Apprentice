# 02 — Architecture

## System overview

```
┌────────────────────────── Browser (React, React Router) ───────────────────────────┐
│  Queue · Issue · Playbooks · Review · Exceptions · Insights · Lessons · Settings     │
│  useActionQuery / useActionMutation  ·  sendToAgentChat()  ·  useNavigationState      │
│  Recorder (framework, in-memory)     ·  <AgentSidebar> (chat, voice, approvals)        │
└───────────────┬───────────────────────────────────────────────┬──────────────────────┘
                │ same typed actions                             │ agent chat bridge
┌───────────────▼───────────────────────────────────────────────▼──────────────────────┐
│                         Agent-Native server (Nitro)                                    │
│  actions/*.ts  ── domain actions (triage)  ── recordStep() ──► episodes                 │
│                ── engine actions (detect, playbooks, runs, backtest, tests, undo)       │
│                ── context actions (view-screen, focus-issue)                            │
│  server/apprentice/engine/*  (pure TS: features, triggers, signatures, trust, backtest) │
│  server/apprentice/services/* (DB access, step executor, snapshot/undo)                 │
│  Agent loop: AGENTS.md + .agents/skills/* + actions as tools + sub-agents               │
│  Automations: jobs/apprentice-autopilot.md (cron)                                       │
│  Built-ins: audit log · needsApproval · evals · MCP server/MCP Apps · messaging · A2A   │
└───────────────┬──────────────────────────────────────────────────────────────────────┘
                │ Drizzle
        ┌───────▼────────┐        External: GitHub REST (read-only import),
        │ Postgres/PGlite │        Slack (digest), MCP clients (Claude, ChatGPT, Cursor…)
        └────────────────┘
```

## Folder layout (target)

Adapt to the template's actual layout — keep its conventions (verify where the template puts
schema, db helper, routes, skills).

```
actions/
  # domain (triage)
  list-issues.ts  get-issue.ts  label-issue.ts  set-priority.ts  set-component.ts
  assign-issue.ts  comment-on-issue.ts  request-repro.ts  mark-duplicate.ts
  close-issue.ts  reopen-issue.ts  import-github-issues.ts  seed-demo-data.ts  reset-demo.ts
  # watch / learn
  list-demonstrations.ts  set-watch-mode.ts  detect-patterns.ts  list-pattern-candidates.ts
  dismiss-pattern.ts  resolve-conflict.ts  start-lesson.ts  finish-lesson.ts
  # playbooks
  create-playbook.ts  get-playbook.ts  list-playbooks.ts  update-playbook.ts
  list-playbook-versions.ts  set-trust-level.ts  get-promotion-eligibility.ts  export-skill.ts
  # runs / review
  run-playbook.ts  list-runs.ts  list-decisions.ts  review-decision.ts  execute-decision.ts
  resolve-judgments.ts  review-batch.ts  undo-run.ts  undo-decision.ts  explain-decision.ts
  # prove
  backtest-playbook.ts  run-playbook-tests.ts  list-playbook-tests.ts
  # assist
  predict-next-step.ts  record-suggestion-outcome.ts  list-exceptions.ts
  # ops
  run-autopilot.ts  build-digest.ts  get-insights.ts  get-settings.ts  update-settings.ts
  # context
  view-screen.ts  focus-issue.ts
server/
  db/schema.ts                       # add Apprentice tables (see 03)
  apprentice/
    engine/                          # PURE functions, unit tested, no imports from db/framework
      features.ts  signature.ts  episodes.ts  patterns.ts  triggers.ts  bindings.ts
      trust.ts  backtest.ts  tests.ts  predict.ts  confidence.ts  skill-markdown.ts  types.ts
    services/
      record-step.ts  snapshot.ts  executor.ts  playbooks.ts  decisions.ts  metrics.ts
      approval.ts                    # the needsApproval predicate factory
      github.ts  seed.ts
    seed/
      issues.json  history.json      # see 13-SEED-DATA
app/
  root.tsx                           # AgentSidebar, navigation hook, top bar
  hooks/use-navigation-state.ts
  routes/  (queue, issues.$id, playbooks, playbooks.$id, review, exceptions, insights, lessons, settings)
  components/apprentice/  (TrustLadder, ParamChip, StepCard, TriggerEditor, GhostChip, PatternCard,
                           AgreementMeter, DecisionPanel, ProvenancePanel, BacktestView, TestsView, …)
.agents/skills/                       # from apprentice-templates/skills
AGENTS.md                             # merge apprentice-templates/AGENTS.md
jobs/apprentice-autopilot.md          # or create via Automations (see 08)
evals/apprentice.eval.ts
```

## Key flows

### A. Human triage → demonstration
1. User clicks "Add label" → `useActionMutation("label-issue")` (caller `frontend`).
2. Action validates, snapshots the issue (before), mutates, then `recordStep(ctx, issueId, "label-issue", args)`.
3. `recordStep` reads `navigation`/`selection` app-state, derives features, appends to the open episode for (actor, issue) or opens a new one; closes the actor's previous open episode if it was on a different issue.
4. Framework audit log records the call automatically (actor human, caller frontend, inputs). The step stores the audit event id when it can be resolved (see 05 §1).
5. UI updates instantly (mutation invalidates queries); a debounced `detect-patterns` call runs after each closed episode.

### B. Pattern → playbook → shadow → trust
1. `detect-patterns` groups closed episodes by signature, infers bindings and a trigger, stores a `pattern_candidates` row; UI shows a card (live sync).
2. "Make playbook" → `create-playbook` (level 1 Suggest). "Refine with agent" → `sendToAgentChat` with candidate id.
3. `run-playbook` (mode by level) → creates `runs` + `decisions` rows. Judgment conditions / agent-decides params are marked `needsJudgment`; the agent fills them via `resolve-judgments`.
4. Review: approve/override/edit → metrics update, overrides become tests, promotion eligibility recomputed, drift check.
5. At level ≥2 decisions execute through domain actions with `playbookContext` → `needsApproval` decides whether the agent must pause.

### C. Agent execution path (why the approval gate works)
- When the **agent** executes a decision it calls the domain action itself (e.g. `label-issue`) with `playbookContext: {playbookId, runId, decisionId}` → framework evaluates `needsApproval` → pauses with Approve/Deny in chat if required.
- When the **human** clicks "Approve & apply" in `/review`, the UI calls `execute-decision` (caller `frontend`), which applies the steps via the service-layer executor (the human approval is the click itself; recorded in `decisions.reviewer`).
- Scheduled runs (`automation` caller) follow level rules: level ≥3 executes non-checkpoint steps, level 4 executes all.

## Framework feature map

| Feature | Framework mechanism |
|---|---|
| Demonstrations | `defineAction` domain actions + `recordStep` + audit log (`audit.target`) |
| Context capture | `readAppState("navigation"/"selection")`, Recorder (lessons) |
| Agent awareness | `view-screen` action, `navigation`/`selection` keys, dynamic suggestions |
| Agent moves UI | `navigate` app-state command via `focus-issue` |
| Trust ladder | `needsApproval` predicate + audit `approval` field |
| Backtest tuning | Generative UI `render-inline-extension` + `appAction` bridge |
| Tests | DB-stored playbook tests + `defineEval` CI gate |
| Autopilot | Automations (`jobs/*.md`, cron) |
| Digest | Messaging (Slack) + in-app digest |
| External agents | MCP server (`mcpTool: true`), MCP Apps (`embedRoute`) |
| Voice | Built-in composer voice + realtime speech mode |
| Parallel backtest | Agent Teams sub-agents (VERIFY) |
| Cross-app | A2A `agentNative.invoke()` (STRETCH) |

## Live sync policy

- Default: mutations invalidate action queries automatically (no polling needed for the acting tab).
- Opt in to `useDbSync({ realtime: { reason } })` only on `/review` and the Queue, because the agent/automation may change items while the user watches. Reason strings: "agent runs update decisions while reviewing", "autopilot triages issues in the background".
