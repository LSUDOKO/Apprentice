# 03 — Data model

Use the framework's schema helpers (`import { table, text, integer } from "@agent-native/core/db/schema"`).
**VERIFY** which other column helpers exist in the installed version (boolean, real, json). If only
`text`/`integer` exist, store JSON as `text` (serialize/parse in the service layer with zod) and
booleans as `integer` 0/1. Timestamps are epoch milliseconds (`integer`).

Every user-owned table has `ownerEmail` (text) and `orgId` (text, nullable). Scope every query by
`ctx.userEmail`/`ctx.orgId`. If the template exposes `ownableColumns()` / sharing helpers, use them
for `playbooks` (so team playbooks can be shared in Team mode).

IDs: prefixed random ids (`iss_`, `ep_`, `pb_`, `run_`, `dec_`, `exe_`, `tst_`, `pc_`, `les_`, `sug_`, `dig_`).

---

## Domain

### `issues`
| column | type | notes |
|---|---|---|
| id | text PK | `seed-NNN` (demo data), `gh_<repo>_<number>` (GitHub import), `iss_…` (created in app) |
| source | text | `seed` \| `github` |
| repo | text | e.g. `BuilderIO/agent-native` |
| number | integer | |
| title | text | |
| body | text | markdown |
| author | text | |
| state | text | `open` \| `closed` |
| closeReason | text null | `completed` \| `duplicate` \| `invalid` \| `wontfix` |
| duplicateOf | text null | issue id |
| labels | text (JSON string[]) | |
| priority | text null | `p0`…`p3` |
| component | text null | `core`, `docs`, `templates`, `cli`, `ui`… |
| assignee | text null | |
| features | text (JSON IssueFeatures) | derived on write, see 05 §2 |
| createdAt / updatedAt | integer | |
| ownerEmail / orgId | text | |

### `issue_comments`
`id, issueId, author, body, createdAt, byAgent (0/1), runId (null), retracted (0/1)`

### `activity`
Timeline rows for the issue detail: `id, issueId, actorEmail, actorKind (human|agent|automation), action, summary, decisionId (null), runId (null), createdAt`.

---

## Learning

### `episodes`
| column | type | notes |
|---|---|---|
| id | text PK | `ep_…` |
| issueId | text | |
| actorEmail | text | |
| actorKind | text | `human` \| `agent` |
| source | text | `watch` \| `lesson` \| `seed` |
| status | text | `open` \| `closed` |
| steps | text (JSON Step[]) | ordered |
| contextStart | text (JSON IssueFeatures) | issue features when the episode opened |
| context | text (JSON) | nav/selection snapshots + recorder nav events (lessons) |
| signature | text null | computed on close |
| narration | text null | lessons |
| startedAt / endedAt | integer | |
| ownerEmail / orgId | text | |

`Step = { action: string, args: Record<string,unknown>, at: number, auditEventId?: string, nav?: unknown }`
(args exclude `playbookContext` and `suggestion` meta).

### `pattern_candidates`
`id, signature, status (new|accepted|dismissed|conflict), episodeIds (JSON), trigger (JSON TriggerSpec), steps (JSON StepSpec[]), support (int), conflictWith (JSON {actorEmail, signature, episodeIds}[] | null), suggestedName, createdAt, updatedAt, ownerEmail, orgId`

### `lessons`
`id, status (recording|done|cancelled), startedAt, endedAt, recorderReport (JSON, trimmed), narration, episodeIds (JSON), ownerEmail, orgId`

### `suggestion_events`
`id, issueId, playbookId, stepIndex, action, outcome (accepted|dismissed), createdAt, ownerEmail`

---

## Playbooks

### `playbooks`
| column | type | notes |
|---|---|---|
| id | text PK | `pb_…` |
| name / description | text | |
| status | text | `draft` \| `active` \| `paused` \| `archived` |
| trustLevel | integer | 0–4 |
| trigger | text (JSON TriggerSpec) | |
| steps | text (JSON StepSpec[]) | |
| version | integer | |
| sourceEpisodeIds | text (JSON) | provenance |
| skillMarkdown | text | regenerated on every save |
| stats | text (JSON PlaybookStats) | cached metrics |
| visibility | text | `private` \| `org` |
| createdBy | text | |
| createdAt / updatedAt / lastPromotedAt / lastDemotedAt | integer | |
| ownerEmail / orgId | text | |

### `playbook_versions`
`id, playbookId, version, snapshot (JSON full playbook), changeNote, createdBy, createdAt`

### JSON types

```ts
type Condition =
  | { field: keyof IssueFeatures; op: "eq" | "neq"; value: string | number | boolean | null }
  | { field: "labels"; op: "includes" | "excludes"; value: string }
  | { field: "title" | "body"; op: "matches"; value: string }      // case-insensitive regex, validated
  | { field: keyof IssueFeatures; op: "isEmpty" | "isNotEmpty" };

type TriggerSpec = {
  all: Condition[];                 // AND
  judgment?: string | null;         // plain-English condition evaluated by the agent
};

type ParamOwner = "fixed" | "fromItem" | "agent";
type ParamSpec =
  | { owner: "fixed"; value: unknown }
  | { owner: "fromItem"; path: string }        // e.g. "author", "features.component"
  | { owner: "agent"; instruction: string };   // e.g. "Write a friendly request for version + repro"

type StepSpec = {
  id: string;
  action: string;                              // a domain action name
  params: Record<string, ParamSpec>;
  checkpoint: boolean;                         // always ask before this step (until level 4)
  destructive: boolean;                        // derived from action registry; close/mark-duplicate
  type?: "action" | "delegate" | "code-fix";   // delegate/code-fix are STRETCH
};

type PlaybookStats = {
  reviewed: number; approved: number; overridden: number; edited: number;
  rollingAgreement: number;        // 0..1 over last 20 reviewed
  executed: number; undone: number;
  testsTotal: number; testsPassing: number;
  medianHumanMs: number | null;    // from source + matched human episodes
};
```

---

## Runs and decisions

### `runs`
`id, playbookId, playbookVersion, mode (shadow|draft|act|auto|backtest), trigger (manual|schedule|mcp|chat|ghost), status (running|awaiting_judgment|done|undone|failed), itemCount, summary (JSON), startedAt, finishedAt, createdBy, ownerEmail, orgId`

### `decisions`
| column | type | notes |
|---|---|---|
| id | text PK | `dec_…` |
| runId / playbookId / issueId | text | |
| playbookVersion | integer | |
| proposedSteps | text (JSON ResolvedStep[]) | |
| needsJudgment | integer 0/1 | judgment condition or agent params unresolved |
| judgment | text (JSON) null | `{ matches: boolean, reason: string }` from the agent |
| confidence | integer | 0–100 |
| explanation | text | human-readable why |
| status | text | `pending` \| `approved` \| `edited` \| `overridden` \| `skipped` \| `executing` \| `executed` \| `undone` \| `failed` |
| humanSteps | text (JSON ResolvedStep[]) null | what the reviewer did instead |
| reviewer / reviewedAt | text / integer | |
| executedAt | integer null | |
| createdAt | integer | |

`ResolvedStep = { stepId: string, action: string, args: Record<string, unknown>, owners: Record<string, ParamOwner>, checkpoint: boolean, destructive: boolean, pendingAgentParams: string[] }`

### `step_executions`
`id, decisionId, runId, issueId, action, args (JSON), before (JSON IssueSnapshot), after (JSON IssueSnapshot), createdCommentId (null), auditEventId (null), status (done|undone|failed), error (null), executedAt, undoneAt`

`IssueSnapshot = { labels, priority, component, assignee, state, closeReason, duplicateOf }`

### `playbook_tests`
`id, playbookId, origin (override|edit|manual|seed), sourceDecisionId (null), issueSnapshot (JSON full issue incl. features), expected (JSON { applies: boolean, steps: { action, args }[] }), lastResult (pass|fail|null), lastDiff (JSON null), lastRunAt, createdAt, ownerEmail, orgId`

---

## Ops

### `digests`
`id, periodStart, periodEnd, body (markdown), stats (JSON), deliveredTo (JSON string[]), createdAt, ownerEmail, orgId`

### `apprentice_settings` (or the framework `settings` store — prefer it if it is per-user key/value)
Keys: `watchMode` (on|off), `minSupport` (2), `demoMode` (bool), `thresholds` (JSON, see 05 §6), `githubRepo`, `digestChannel`.

---

## Indexes

- `issues(ownerEmail, state, updatedAt)`
- `episodes(ownerEmail, status, issueId)`, `episodes(signature)`
- `decisions(runId)`, `decisions(playbookId, status)`, `decisions(issueId)`
- `step_executions(runId)`, `playbook_tests(playbookId)`
