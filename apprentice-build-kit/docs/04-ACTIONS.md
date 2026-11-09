# 04 — Actions

Every operation is a `defineAction()` in `actions/<name>.ts`. Conventions:

- `description` is written for the agent: say **when** to use it, not just what it does.
- Reads: `http: { method: "GET" }` (enables `useActionQuery`), `readOnly: true` where supported.
- Mutations: default POST; set `audit: { target: (args) => ({ type: "issue" | "playbook" | "run", id }), summary }`.
- Scope every query by `ctx.userEmail` / `ctx.orgId` (`run: async (args, ctx) => …`).
- UI-only helpers that waste an agent tool slot: `agentTool: false`.
- External-agent catalog (MCP): `mcpTool: true` only on the curated set marked **MCP** below.
- Return plain JSON objects; throw `Error` with a stable `code` property for expected failures
  (`NOT_FOUND`, `TESTS_FAILING`, `NOT_ELIGIBLE`, `INVALID_TRIGGER`, …).

### Shared input fragment (domain mutations)

```ts
const playbookContext = z.object({
  playbookId: z.string(), runId: z.string(), decisionId: z.string(), stepId: z.string(),
}).optional().describe("Set ONLY when executing a playbook decision. Omit for ad-hoc requests.");

const suggestion = z.object({ playbookId: z.string(), stepIndex: z.number() })
  .optional().describe("UI-only: set when the user accepted a ghost suggestion.");
```

Domain mutations declare:
```ts
needsApproval: approvalFor("label-issue"),   // from server/apprentice/services/approval.ts (05 §6)
```

---

## Domain (triage)

| Action | Method | Input | Behavior |
|---|---|---|---|
| `list-issues` | GET | `{ state?, label?, untriaged?, q?, limit=50, cursor? }` | Paged list with derived features + `matchingPlaybooks` count |
| `get-issue` | GET | `{ issueId }` | Issue + comments + activity + latest decision |
| `label-issue` | POST | `{ issueId, add: string[], remove: string[], playbookContext?, suggestion? }` | Mutate labels; recompute features; `recordStep` (humans) / `recordExecution` (playbook) |
| `set-priority` | POST | `{ issueId, priority: "p0"\|"p1"\|"p2"\|"p3"\|null, … }` | same pattern |
| `set-component` | POST | `{ issueId, component: string\|null, … }` | same |
| `assign-issue` | POST | `{ issueId, assignee: string\|null, … }` | same |
| `comment-on-issue` | POST | `{ issueId, body: string (1..4000), … }` | Adds comment (`byAgent` from ctx.caller) |
| `request-repro` | POST | `{ issueId, missing: ("version"\|"steps"\|"logs"\|"environment")[], message?: string, … }` | Adds `needs-info` label + templated/agent-written comment listing missing items |
| `mark-duplicate` | POST | `{ issueId, duplicateOfId, … }` | **destructive**. Label `duplicate`, comment link, close with reason `duplicate` |
| `close-issue` | POST | `{ issueId, reason: "completed"\|"invalid"\|"wontfix", … }` | **destructive** |
| `reopen-issue` | POST | `{ issueId }` | Used by undo and humans. `agentTool: true` |
| `import-github-issues` | POST | `{ repo: "owner/name", limit=50 }` | Read-only GitHub REST import, idempotent by `gh_<repo>_<number>`; skips PRs |
| `seed-demo-data` | POST | `{}` | Loads `server/apprentice/seed/*` if the user has no issues. Idempotent |
| `reset-demo` | POST | `{ confirm: literal("reset") }` | Only when settings `demoMode`; wipes the user's Apprentice data and reseeds. `needsApproval: true` for agent callers |

All domain mutations: `audit.target = { type: "issue", id: args.issueId }`, summary like
`Labeled #42 +needs-info`. They also write an `activity` row.

---

## Watch / learn

| Action | Method | Input | Behavior |
|---|---|---|---|
| `list-demonstrations` | GET | `{ sinceMs?, issueId?, actorEmail?, status? }` | Episodes with steps. **MCP** no |
| `set-watch-mode` | POST | `{ on: boolean }` | Settings `watchMode` |
| `detect-patterns` | POST | `{ minSupport? }` | Runs engine (05 §3) over closed episodes; upserts `pattern_candidates`; returns new candidates. Called automatically (debounced) after an episode closes and on demand |
| `list-pattern-candidates` | GET | `{ status? }` | |
| `dismiss-pattern` | POST | `{ candidateId }` | |
| `resolve-conflict` | POST | `{ candidateId, chosenActorEmail, note? }` | Team mode: chosen signature becomes the playbook; record decision in description |
| `start-lesson` | POST | `{}` | Creates `lessons` row (`recording`), sets app-state `apprentice:lesson` |
| `finish-lesson` | POST | `{ lessonId, recorderReport: unknown, narration?: string }` | Trims/validates report (actions, nav, state events only), links episodes in window, writes narration to those episodes, closes them, calls detect-patterns |

---

## Playbooks

| Action | Method | Input | Behavior |
|---|---|---|---|
| `create-playbook` | POST | `{ candidateId } \| { name, description, trigger, steps }` | Creates at level 1 (Suggest), status `active`, version 1, SKILL.md, initial tests from source episodes (`origin: seed` = expected steps of each source episode) |
| `get-playbook` | GET | `{ playbookId }` | Playbook + stats + eligibility + latest test summary |
| `list-playbooks` | GET | `{ status? }` | **MCP** |
| `update-playbook` | POST | `{ playbookId, patch: { name?, description?, trigger?, steps? }, changeNote? }` | Validates trigger/steps; bumps version; regenerates SKILL.md; runs tests; if status `active` and tests fail → reject with `TESTS_FAILING` unless `saveAsDraft: true` (then status `draft`) |
| `list-playbook-versions` | GET | `{ playbookId }` | |
| `set-trust-level` | POST | `{ playbookId, level: 0..4, reason }` | Raising requires eligibility (05 §6) and passing tests; raising from an agent caller → `needsApproval: true` (predicate on `ctx.caller !== "frontend"`). Lowering is always allowed |
| `get-promotion-eligibility` | GET | `{ playbookId }` | `{ eligible, nextLevel, evidence: {...}, blockers: string[] }` |
| `export-skill` | GET | `{ playbookId }` | Returns `{ files: [{ path: "SKILL.md", content }, { path: "playbook.json", content }] }`; UI zips client-side (JSZip) for download. **MCP** |

---

## Runs and review

| Action | Method | Input | Behavior |
|---|---|---|---|
| `run-playbook` | POST | `{ playbookId, scope: { issueIds?: string[], openUntriaged?: boolean }, trigger?: "manual"\|"chat"\|"mcp"\|"schedule" }` | Creates run (mode from trust level), evaluates trigger per issue, creates decisions with resolved steps + confidence. If any decision `needsJudgment` → run status `awaiting_judgment` and returns the list for the agent. Level ≥3: executes eligible decisions via executor immediately (non-checkpoint steps; level 4 all). Returns `{ runId, mode, status, counts, awaitingJudgment: [...], toExecute: [...] }` — `toExecute` lists decisions/steps the agent must run itself with `playbookContext` (Draft level, and checkpoint/destructive steps at Act) so the approval gate applies. **MCP** |
| `resolve-judgments` | POST | `{ runId, judgments: { decisionId, matches: boolean, reason: string, agentParams?: Record<stepId, Record<param, unknown>> }[] }` | Agent-only (`agentTool: true`, UI never calls). Fills judgment + agent params; non-matching decisions → `skipped`; then continues the run per level |
| `list-runs` | GET | `{ playbookId?, limit }` | |
| `list-decisions` | GET | `{ runId?, playbookId?, status?, limit }` | |
| `review-decision` | POST | `{ decisionId, verdict: "approve"\|"edit"\|"override"\|"skip", humanSteps?: ResolvedStepInput[], applyNow?: boolean, note? }` | Updates decision + stats; edit/override → creates `playbook_tests`; recompute eligibility; drift check (05 §8); `applyNow` → execute (approved steps or humanSteps) via executor |
| `execute-decision` | POST | `{ decisionId }` | Human-approved apply from UI (`agentTool: false`) |
| `review-batch` | GET | `{ runId? }` | Latest pending batch summary for external hosts. Has `link` + `mcpApp` via `embedRoute({ path: "/review?run=…" })`. **MCP** |
| `undo-run` | POST | `{ runId }` | Reverts executed steps newest-first in one transaction; decisions → `undone`; comments retracted. `needsApproval` for agent callers |
| `undo-decision` | POST | `{ decisionId }` | Same for one decision |
| `explain-decision` | GET | `{ decisionId }` | Provenance: playbook + version, matched conditions with values, judgment, source episodes (actor, issue, date), audit events via `list-audit-events` (targetType `issue`, targetId) |

---

## Prove

| Action | Method | Input | Behavior |
|---|---|---|---|
| `backtest-playbook` | GET | `{ playbookId, triggerOverride?: TriggerSpec, stepsOverride?: StepSpec[], limit=100 }` | Deterministic replay against closed human episodes (05 §5). Returns `{ considered, matched, agreed, disagreed: [...], missed: [...], falsePositives: [...], needsJudgmentCount }`. Fast (<500ms on seed). Callable from generative UI via `appAction` |
| `run-playbook-tests` | POST | `{ playbookId }` | Runs all tests, stores results, returns pass/fail + diffs |
| `list-playbook-tests` | GET | `{ playbookId }` | |

---

## Assist

| Action | Method | Input | Behavior |
|---|---|---|---|
| `predict-next-step` | GET | `{ issueId }` | Ghost suggestion (05 §7): `{ suggestion: { playbookId, playbookName, stepIndex, action, args, label, needsAgent } \| null }` |
| `record-suggestion-outcome` | POST | `{ issueId, playbookId, stepIndex, action, outcome }` | `agentTool: false` |
| `list-exceptions` | GET | `{ limit }` | Open issues with reason codes: `NO_MATCH`, `LOW_CONFIDENCE`, `CHECKPOINT_WAITING`, `OVERRIDE_PENDING`, `CONFLICT` |

---

## Ops

| Action | Method | Input | Behavior |
|---|---|---|---|
| `run-autopilot` | POST | `{ maxItems=50 }` | For each active playbook with level ≥1, run on new open untriaged issues. Used by the scheduled automation. Idempotent per issue/version |
| `build-digest` | POST | `{ sinceMs? }` | Builds markdown digest + stats, stores `digests` row, returns text (the automation's agent posts it to Slack) |
| `get-insights` | GET | `{ rangeDays=30 }` | Time saved, agreement series, levels, suggestion acceptance, exceptions trend. **MCP** |
| `get-settings` / `update-settings` | GET/POST | | Apprentice settings |

---

## Context

| Action | Method | Input | Behavior |
|---|---|---|---|
| `view-screen` | — (`http: false`) | `{}` | Reads `navigation`, `selection`, `__url__`; hydrates current issue / playbook / run / decision; includes pending pattern candidates and the active lesson. Required by convention |
| `focus-issue` | POST | `{ issueId?, playbookId?, runId?, compareIssueIds?: [string,string], path? }` | Writes the one-shot `navigate` app-state command so the UI moves (never writes `navigation`) |

---

## Example: a domain action

```ts
// actions/label-issue.ts
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { approvalFor } from "../server/apprentice/services/approval.js";
import { mutateIssue } from "../server/apprentice/services/executor.js";

export default defineAction({
  description:
    "Add or remove labels on an issue. Use for triage (bug, needs-info, duplicate…). " +
    "When executing a playbook decision, pass playbookContext.",
  schema: z.object({
    issueId: z.string(),
    add: z.array(z.string().min(1)).default([]),
    remove: z.array(z.string().min(1)).default([]),
    playbookContext,
    suggestion,
  }),
  needsApproval: approvalFor("label-issue"),
  audit: {
    target: (args) => ({ type: "issue", id: args.issueId }),
    summary: (args) => `Labels +${args.add.join(",")} -${args.remove.join(",")}`,
  },
  run: async (args, ctx) =>
    mutateIssue(ctx, "label-issue", args, (issue) => ({
      labels: applyLabelDiff(issue.labels, args.add, args.remove),
    })),
});
```

`mutateIssue` (service) = load + scope check → before snapshot → write → recompute features →
activity row → if `playbookContext`: `step_executions` row, else if human and watch mode on:
`recordStep` → return `{ issue, executionId? }`.
