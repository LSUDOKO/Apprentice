---
name: playbook-runner
description: Exact procedure for running Apprentice playbooks — scope, judgments, agent-written parameters, executing with playbookContext under the trust ladder, and reporting. Use whenever running a playbook or the autopilot.
---

# Running playbooks

## 1. Start the run
`run-playbook({ playbookId, scope: { openUntriaged: true } | { issueIds }, trigger })`.
The result includes `runId`, `mode` (shadow/draft/act/auto), counts, and possibly `status: "awaiting_judgment"` with decisions to resolve.

## 2. Resolve judgments (if any)
For each decision listed:
- `get-issue(issueId)`; answer the playbook's judgment question honestly; `matches: false` when unsure.
- For each pending agent parameter, follow its instruction (see `triage-domain` comment style).
Call `resolve-judgments` **once** with all results.

## 3. Execute (only for draft/act/auto modes)
The run executes what the trust level allows automatically. For decisions left for you to execute
(draft mode, or steps the run returned as `toExecute`):
- Call each step's domain action with exactly the resolved args **plus**
  `playbookContext: { playbookId, runId, decisionId, stepId }`.
- If the call pauses for approval, stop and tell the user what is waiting. Do not retry.

## 4. Report
"Ran **<playbook>** on N issues: X handled, Y waiting for your approval, Z sent to exceptions."
Then `focus-issue({ runId })` to open the review screen when anything waits.

## Never
- Never execute steps of a decision whose status is `skipped`, `overridden` or `undone`.
- Never call destructive actions outside a decision unless the user asked explicitly.
- Never change trust levels during a run.
