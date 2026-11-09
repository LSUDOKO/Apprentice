# Architecture

How Apprentice is put together, for humans and coding agents reading the repo. For the framework-specific proof points, see [AGENT-NATIVE-EVIDENCE.md](AGENT-NATIVE-EVIDENCE.md).

## System overview

Every caller goes through the same typed actions. Writes to issues go through one function, `mutateIssue`. That function decides whether the call is a demonstration (a human click), a playbook execution (gated by the trust ladder), or a plain ad-hoc change.

```mermaid
flowchart TB
  subgraph Callers
    UI[React UI<br/>caller: frontend]
    Agent[Agent chat<br/>caller: tool]
    MCP[Claude / ChatGPT / Cursor<br/>caller: mcp]
    Cron[Autopilot job<br/>caller: automation]
  end
  UI --> A
  Agent --> A
  MCP --> A
  Cron --> A
  A[actions/*.ts<br/>62 defineAction] --> G{needsApproval<br/>services/approval.ts}
  G -->|ad-hoc or trusted| M[mutateIssue<br/>services/issues.ts]
  G -->|below trust level| H[Human approves<br/>in chat or Review]
  H --> M
  M --> DB[(Postgres<br/>Neon / PGlite)]
  M -->|caller = frontend<br/>and watch mode| R[recordStep<br/>services/record-step.ts]
  R --> E[Engine<br/>server/apprentice/engine]
  E --> P[Pattern candidates,<br/>ghost prediction]
  P --> PB[Playbooks + versions<br/>+ regression tests]
  PB --> X[Executor<br/>services/executor.ts]
  X -->|playbookContext| A
```

## The learning loop, step by step

```mermaid
sequenceDiagram
  actor Maya
  participant UI
  participant Action as label-issue (defineAction)
  participant Svc as mutateIssue
  participant Rec as recordStep
  participant Eng as engine
  Maya->>UI: clicks "+ needs-info" on #31
  UI->>Action: call (caller = frontend)
  Action->>Svc: needsApproval = false (no playbookContext)
  Svc->>Svc: apply mutation in a transaction
  Svc->>Rec: demonstration = true
  Rec->>Rec: snapshot features + navigation/selection
  Note over Maya,Eng: repeat on #32
  Rec->>Eng: detectPatterns (support ≥ 2)
  Eng-->>UI: pattern card: trigger + steps + parameter owners
  Maya->>UI: Make playbook
  UI->>Eng: backtest on her history
  Eng-->>UI: considered / matched / agreed / false positives
```

## The trust ladder

```mermaid
stateDiagram-v2
  [*] --> Watch
  Watch --> Suggest: playbook created
  Suggest --> Draft: ≥3 reviewed, ≥80% agree, tests pass, human click
  Draft --> Act: ≥5 reviewed, ≥85% agree, tests pass, human click
  Act --> Auto: ≥8 reviewed, ≥90% agree, ≥5 executed, tests pass, human click
  Act --> Draft: override (automatic step back)
  Auto --> Act: override (automatic step back)
```

Thresholds shown are demo mode (`engine/trust.ts`, `thresholdsFor`). What each level means for an action called with `playbookContext` (`services/approval.ts`, `stepNeedsApproval`):

| Level | Behaviour |
|---|---|
| 0 Watch | Recording only |
| 1 Suggest | Shadow: decisions are proposed, nothing changes until a human approves |
| 2 Draft | Every step asks for approval |
| 3 Act | Runs on its own; asks only at checkpoints or for destructive actions; every run can be undone |
| 4 Auto | Runs on its own |

## Data model

15 Apprentice tables in [`server/db/schema.ts`](../server/db/schema.ts), all scoped by `owner_email` / `org_id`. The main relationships:

```mermaid
erDiagram
  issues ||--o{ issue_comments : has
  issues ||--o{ activity : logs
  issues ||--o{ episodes : "demonstrated on"
  pattern_candidates }o--|| playbooks : "becomes"
  playbooks ||--o{ playbook_versions : versions
  playbooks ||--o{ playbook_tests : "regression tests"
  playbooks ||--o{ runs : runs
  runs ||--o{ decisions : proposes
  decisions }o--|| issues : "about"
  decisions ||--o{ step_executions : executes
  lessons ||--o{ episodes : records
```

Also: `suggestion_events` (ghost chip accept/ignore), `digests`, `apprentice_settings`.

## Engine (pure TypeScript, no I/O)

[`server/apprentice/engine/`](../server/apprentice/engine/) is deterministic and unit-tested.

| File | What it does |
|---|---|
| `features.ts` | Derives issue features: kind, has version, has repro, stack trace, code block, mentions docs or a component, likely spam, first-time author |
| `signature.ts` | Normalises a demonstration's steps into a comparable signature (with step merging) |
| `patterns.ts` | `detectPatterns`, `inferTrigger` (discriminative conditions from positives vs negatives), `findConflicts` (two teammates, two approaches) |
| `bindings.ts` | Infers who owns each parameter: fixed, from the issue, or agent decides |
| `triggers.ts` | Evaluates trigger conditions against an issue |
| `backtest.ts` | Replays a trigger and steps on past demonstrations: considered, matched, agreed, missed, false positives |
| `tests.ts` | Regression tests from review verdicts; an override with no steps means "should not apply" |
| `trust.ts` | Thresholds, rolling agreement, eligibility, drift (auto step back) |
| `predict.ts` | Next-step prediction for the ghost chip |
| `metrics.ts` | Time saved, estimated from the user's median handling time |
| `skill-markdown.ts` | Generates the portable `SKILL.md` |

## Services (database-backed)

[`server/apprentice/services/`](../server/apprentice/services/): `issues.ts` (single mutation path), `record-step.ts` (demonstrations), `patterns.ts`, `playbooks.ts` (versions, test gate, eligibility), `executor.ts` (runs, decisions, review, drift, undo with conflict protection, provenance), `approval.ts` (trust gate), `assist.ts` (ghost, exceptions), `ops.ts` (insights, digest, autopilot, GitHub import), `lessons.ts`, `seed.ts`, `settings.ts`.

## UI

[`app/routes/`](../app/routes/): queue and issue detail (`issues*.tsx`), playbook editor (`playbooks.$playbookId.tsx`: Recipe, Backtest, Tests, Provenance, History, SKILL.md), review (`review.tsx`), exceptions, insights (charts in `app/components/apprentice/Charts.tsx`, hand-written SVG), lessons, compare, settings (`preferences.tsx`). Components live in [`app/components/apprentice/`](../app/components/apprentice/).

## Tests

- 55 Vitest tests: engine units plus a full-loop integration test on in-memory PGlite ([`server/apprentice/__tests__/flow.test.ts`](../server/apprentice/__tests__/flow.test.ts)): seed → watch → pattern → ghost → playbook → backtest → shadow review → override test blocks promotion → fix → Draft → Act run → provenance → undo.
- Agent-behaviour eval gate: [`evals/apprentice.eval.ts`](../evals/apprentice.eval.ts) (needs an LLM key).

## Deployment

| Piece | Where |
|---|---|
| App | Render web service, `NITRO_PRESET=render_com`, start `node .output/server/index.mjs` |
| Database | Neon Postgres; app tables are created at startup by additive migrations ([`server/db/migrations.ts`](../server/db/migrations.ts)) |
| Website | `landing/` (Vite + React + Framer Motion) on Cloudflare Pages |
| Demo film | `video/` (Remotion); screenshots captured by a Playwright script against the running app |
