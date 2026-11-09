# 05 — Engine algorithms

All functions in this doc live in `server/apprentice/engine/` as **pure TypeScript** (no DB,
no framework imports, no LLM calls). Services load data, call the engine, and persist results.
Every function here needs unit tests (`09-TESTING.md`).

Judgment ("does this report describe a crash?") and free-text writing are **never** done in the
engine — they are marked `needsJudgment` and resolved by the agent (`resolve-judgments`).

---

## §1 Steps and episodes

### Recording (services/record-step.ts)

`recordStep(ctx, issueId, action, args)` is called by `mutateIssue` when:
`ctx.caller === "frontend"` (a human in the UI) **and** watch mode is on **and** no `playbookContext`.

```
1. strip meta args (playbookContext, suggestion)
2. read app-state: navigation, selection (server readAppState) → nav snapshot
3. find the actor's open episode
   - if open episode exists for a DIFFERENT issue → close it (computeSignature, set endedAt)
   - if open episode exists for THIS issue and last step < IDLE_MS (5 min) ago → append
   - else → close stale and open a new episode with contextStart = issue.features (before mutation)
4. append { action, args, at: now, nav }
5. resolve audit event id (best effort): newest `agent_audit_log` row for actor + action + target
   within 5s (VERIFY: use the framework's list-audit-events reader if it can be called server-side;
   otherwise skip — provenance falls back to querying by target).
```

Episodes also close lazily: any read of demonstrations closes open episodes idle > `IDLE_MS`.
Closing an episode triggers `detect-patterns` (debounced 1.5s per user, fire-and-await within
the request — do not rely on detached promises on serverless).

### Signature (engine/signature.ts)

```
normalizeStep(step) = action + ":" + stableKeys(args)   // e.g. "label-issue:add,remove"
signature(episode)  = dedupeConsecutive(steps.map(normalizeStep)).join(" > ")
```
Two episodes with the same actions in the same order (args may differ) share a signature.
Order-insensitive variant (for steps that commute, like label + assign) is a later improvement — not required.

---

## §2 Issue features (engine/features.ts)

Derived deterministically on every issue write; stored in `issues.features`.

```ts
type IssueFeatures = {
  kind: "bug" | "feature" | "question" | "docs" | "other";  // from labels/title keywords
  labels: string[];
  hasVersion: boolean;          versionMentioned: string | null;   // /v?\d+\.\d+(\.\d+)?/ near "version|@agent-native|core"
  hasRepro: boolean;            // "steps to reproduce" | numbered list + "expected"/"actual" | code block + "run"
  hasStackTrace: boolean;       // /at .+\(.+:\d+:\d+\)|Traceback|Error: .+\n\s+at /
  hasCodeBlock: boolean;
  bodyLength: number;           titleLength: number;
  mentionsDocs: boolean;        // "docs", "documentation", "typo"
  mentionsComponent: string | null;  // keyword map → core|templates|cli|docs|ui
  isLikelySpam: boolean;        // link-heavy + no code + off-topic keywords
  priority: string | null; component: string | null; assignee: string | null; state: string;
  authorIsFirstTime: boolean;
};
```
Keep the keyword maps in one exported constant so tests and the UI ("why did this match?") share them.

---

## §3 Pattern detection (engine/patterns.ts)

Input: closed human episodes for the user (last 30 days), existing playbooks, dismissed signatures.
Only episodes with `source` in (`watch`, `lesson`) can **propose** a new candidate; `seed`
episodes are used for trigger negatives, backtests, tests, insights and Team-mode conflicts
(see `13-SEED-DATA.md`).

```
groups = groupBy(episodes, signature)
for each group with size >= minSupport (default 2; demoMode 2):
  if signature already covered by an active playbook → skip
  if signature dismissed → skip
  bindings = inferBindings(group)          // §4
  trigger  = inferTrigger(group, allClosedEpisodes)   // §3.1
  candidate = { signature, episodeIds, steps: bindings, trigger, support: size,
                suggestedName: nameFrom(trigger, steps) }
conflicts (Team mode, F19):
  for candidates A, B from DIFFERENT actors whose triggers overlap
  (jaccard(matchedIssueSet(A.trigger), matchedIssueSet(B.trigger)) >= 0.6) and signatures differ
  → mark both status "conflict", conflictWith = other
```

`nameFrom` is deterministic ("Needs-info for bugs without version"); the agent may rename later.

### §3.1 Trigger inference

```
positives = contextStart features of the group's episodes
negatives = contextStart features of other closed episodes (different signature), last 30 days
candidateConditions = for each feature f:
   boolean f: if all positives share value v → { field f, op eq, value v }
   labels:    each label present in all positives → includes; absent in all → excludes (only labels seen in negatives)
   nullable string f: all null → isEmpty; all equal non-null → eq
score(condition) = fraction of negatives it EXCLUDES   (discriminative power)
choose conditions greedily by score until negatives matched by the conjunction <= 10% or no gain;
max 4 conditions; always keep at least 1.
if the chosen conjunction still matches > 25% of negatives → set judgment = null but flag
   candidate.weakTrigger = true (UI shows "Trigger may be too broad — refine with agent")
```

### §4 Parameter binding inference (engine/bindings.ts)

For each step position i and each arg key k across the group's episodes:

```
values = group.map(ep => ep.steps[i].args[k])
if all deepEqual(values)                         → { owner: "fixed", value: values[0] }
else if exists path p in issue fields such that for every episode
        value == get(issueAtEpisodeStart, p)      → { owner: "fromItem", path: p }
        (search paths: author, number, features.mentionsComponent, features.versionMentioned, component, …)
else if k is free text (body/message/comment)     → { owner: "agent", instruction: summarizeHint(values) }
else                                              → { owner: "agent", instruction: `Choose ${k} like: ${examples}` }
```
`summarizeHint` = deterministic: "Write a comment similar to these examples:" + up to 2 trimmed examples.

---

## §5 Trigger evaluation and backtest

### Evaluate (engine/triggers.ts)
```
evaluate(trigger, features) → { deterministicMatch: boolean, conditionResults: {cond, actual, pass}[], needsJudgment: boolean }
needsJudgment = deterministicMatch && !!trigger.judgment
```
`matches` regex conditions are compiled with a 200-char limit and try/catch (reject invalid → `INVALID_TRIGGER`).

### Backtest (engine/backtest.ts)
Data: closed **human** episodes (not seed-of-this-playbook's own source episodes counted separately), up to `limit`, newest first.
```
for ep in episodes:
  m = evaluate(trigger, ep.contextStart)
  predicted = m.deterministicMatch ? resolveSteps(steps, issueAt(ep)) : null
  actual    = ep.steps
  if predicted && sameActions(predicted, actual) && sameFixedArgs(predicted, actual) → agreed++
  else if predicted && !sameActions                                                   → falsePositive / disagreement
  else if !predicted && signature(ep) == playbook signature                         → missed++
matched = count(predicted != null)
needsJudgmentCount = count(m.needsJudgment)   // these are reported, not scored, unless the agent scores them (F18)
```
Agent-decides params are excluded from agreement (they are free text); report them as "not scored".

---

## §6 Trust ladder (engine/trust.ts + services/approval.ts)

```
LEVELS = { WATCH: 0, SUGGEST: 1, DRAFT: 2, ACT: 3, AUTO: 4 }

thresholds (normal / demoMode):
  SUGGEST→DRAFT : reviewed ≥ 8 / 3,  rollingAgreement ≥ 0.85
  DRAFT→ACT     : reviewed ≥ 15 / 5, rollingAgreement ≥ 0.90
  ACT→AUTO      : reviewed ≥ 30 / 8, rollingAgreement ≥ 0.95, executed ≥ 20 / 5, undone ratio ≤ 0.05
  all promotions: testsPassing == testsTotal and testsTotal ≥ 1
rollingAgreement = approved / (approved + edited + overridden) over the last 20 reviewed decisions
  (edited counts as disagreement; skipped excluded)

eligibility(stats, level, thresholds) → { eligible, nextLevel, evidence, blockers[] }
```

### The approval predicate (the key Agent-Native integration)

```ts
// services/approval.ts
export function approvalFor(action: DomainActionName) {
  return async (args: { playbookContext?: PlaybookContext }, ctx: RunCtx): Promise<boolean> => {
    const pc = args.playbookContext;
    if (!pc) return false;                       // ad-hoc request or human UI → no extra gate
    const pb = await loadPlaybook(pc.playbookId, ctx);
    if (!pb || pb.status !== "active") return true;   // fail closed
    const step = pb.steps.find(s => s.id === pc.stepId);
    const destructive = DESTRUCTIVE_ACTIONS.has(action);
    if (pb.trustLevel <= LEVELS.DRAFT) return true;            // Suggest/Draft: always ask
    if (pb.trustLevel === LEVELS.ACT) return !!step?.checkpoint || destructive;
    return false;                                               // AUTO
  };
}
```
Keep the predicate fast (one indexed read; cache per request). The framework treats a thrown
predicate as "requires approval" — that is the desired fail-closed behavior.

Note: at level 1 (Suggest) the agent should not call domain actions for the playbook at all —
`run-playbook` only creates decisions. The predicate still returns true as a safety net.

---

## §7 Ghost prediction (engine/predict.ts)

```
input: issue (features now), the actor's open episode for this issue (steps so far), active playbooks (level ≥1)
for pb in playbooks ordered by (trustLevel desc, rollingAgreement desc):
  if !evaluate(pb.trigger, episode.contextStart ?? issue.features).deterministicMatch → continue
  done = episode.steps.map(normalizeStep)
  expected = pb.steps.map(s => s.action + ":" + paramKeys(s))
  if done is not a prefix of expected (allow empty) → continue
  next = pb.steps[done.length]; if !next → continue
  resolved = resolveStep(next, issue)       // fixed + fromItem; agent params → needsAgent
  return { playbookId, stepIndex: done.length, action: next.action, args: resolved.args,
           label: humanLabel(next, resolved), needsAgent: resolved.pendingAgentParams.length > 0 }
return null
```
Fires on issue open and after each step. Never suggests destructive steps (they need explicit action).

---

## §8 Drift and confidence

### Drift (engine/trust.ts `checkDrift`)
After each review and each run:
```
if level ≥ ACT and the latest review is override/edit → demote one level, reason "override at autonomy"
if reviewedLast20 ≥ 10 and rollingAgreement < 0.80        → demote one level, reason "agreement dropped to X%"
unmatched share: open issues created in last 24h with NO_MATCH > 50% and ≥ 10 issues
   → no demotion; raise a notification "New kind of issue arriving — teach Apprentice?"
```
Demotion writes `lastDemotedAt`, a `playbook_versions` note, an in-app notification, and an activity entry.

### Confidence (engine/confidence.ts)
```
base     = smoothedAgreement = (approved + 1) / (reviewed + 2)        // Laplace
coverage = 1.0 if all trigger conditions matched with margin; 0.85 if any condition is a regex match
judgmentPenalty = 0.9 if judgment pending
confidence = round(100 * base * coverage * judgmentPenalty)
```
`explanation` (deterministic text): "Matched 3/3 conditions (labels includes bug; version missing; no repro). This playbook agreed with you 19 of 20 times."

---

## §9 Tests (engine/tests.ts)

```
runTest(playbook, test):
  m = evaluate(playbook.trigger, test.issueSnapshot.features)
  if !test.expected.applies: pass = !m.deterministicMatch
  else: predicted = resolveSteps(playbook.steps, test.issueSnapshot)
        pass = m.deterministicMatch && sameActions(predicted, test.expected.steps)
               && sameFixedArgs(predicted, test.expected.steps)
  diff = { expected, predicted, failedConditions }
```
Creating tests from reviews:
- **override** with humanSteps that are a different action sequence → `expected = { applies: humanSteps.length > 0, steps: humanSteps }`
- **override** with "this playbook should not apply" → `expected = { applies: false }`
- **edit** (same actions, different fixed args) → expected = edited steps

---

## §10 Executor and undo (services/executor.ts, services/snapshot.ts)

```
executeDecision(decision, ctx, { approvedBy }):
  in a transaction:
    for step in decision.proposedSteps (or humanSteps):
      if step.pendingAgentParams.length → throw NEEDS_AGENT
      before = snapshot(issue); apply via the same mutateIssue path (with playbookContext)
      insert step_executions { before, after, createdCommentId }
    decision.status = executed; activity rows (actorKind agent|human)
undoRun(runId): executions newest-first:
    restore IssueSnapshot fields from `before`; if createdCommentId → retracted = 1
    if state changed closed→open → reopen; mark execution undone; decision undone
```
Undo is refused for an execution whose issue changed afterwards by someone else (compare
`after` to current snapshot) — report it as a conflict instead of overwriting newer work.

---

## §11 SKILL.md generation (engine/skill-markdown.ts)

Deterministic template from the playbook (no LLM). See the sample output in
`apprentice-templates/skills/README-playbook-skill-format.md`. Include: frontmatter
(`name`, `description` with the trigger in plain English), "When to use", "Steps" with
param owners, "Checkpoints", "If running inside Apprentice" (call `run-playbook`), "If running
elsewhere" (use Apprentice MCP tools when connected, otherwise perform equivalent steps and ask
before destructive ones), and "Learned from" (n demonstrations, agreement %, tests).

---

## §12 Time saved (engine/insights.ts)

```
humanMs(episode) = clamp(endedAt - startedAt, 20s, 15min)
medianHumanMs(playbook) = median(humanMs of source episodes + agreed human episodes in backtest)
savedMs = executedDecisions × medianHumanMs   (per playbook)
```
Label all numbers "estimated" in the UI with this formula in a tooltip.
