# Agent-Native evidence

Every claim about how Apprentice uses the Agent-Native framework, with the exact file and line that implements it and a way to check it yourself. Line numbers are for commit `main` at submission time.

## 1. One set of typed actions for every caller

| Claim | Evidence |
|---|---|
| Every operation is a `defineAction` in `actions/` (62 files). The UI, the agent, MCP clients, the CLI and the scheduler all call these. | [`actions/`](../actions/) · e.g. [`actions/label-issue.ts`](../actions/label-issue.ts) |
| All triage actions share one helper that wires the approval gate, the audit target and the single write path. | [`server/apprentice/action-helpers.ts#L41-L51`](../server/apprentice/action-helpers.ts#L41-L51) (`domainAction`) |
| There is exactly one mutation path for issues, used by humans, the agent and the executor. | [`server/apprentice/services/issues.ts#L198`](../server/apprentice/services/issues.ts#L198) (`mutateIssue`) |
| The agent is given the same action registry the UI uses. | [`server/plugins/agent-chat.ts`](../server/plugins/agent-chat.ts) (`actions: loadActionsFromStaticRegistry(actionsRegistry)`) |

Verify: `ls actions | wc -l` → 62. `pnpm action label-issue --issueId seed-040 --add '["needs-info"]'` runs the same code the button runs and returns `demonstration: false`, because only UI calls are demonstrations.

## 2. Clicks become demonstrations

| Claim | Evidence |
|---|---|
| A call is a demonstration only when it comes from the UI (`ctx.caller === "frontend"`), is not a playbook execution, and watch mode is on. | [`server/apprentice/services/issues.ts#L204`](../server/apprentice/services/issues.ts#L204) |
| The demonstration is recorded as a step after the mutation commits. | [`server/apprentice/services/issues.ts#L217`](../server/apprentice/services/issues.ts#L217) → [`services/record-step.ts#L62`](../server/apprentice/services/record-step.ts#L62) (`recordStep`) |
| Each step snapshots the framework's application state (navigation, selection). | [`services/record-step.ts#L18`](../server/apprentice/services/record-step.ts#L18) (`readAppState`) |
| Lessons merge the framework **Recorder** report with the narration. | [`services/lessons.ts#L15`](../server/apprentice/services/lessons.ts#L15) |

## 3. The trust ladder is the framework's `needsApproval` gate

| Claim | Evidence |
|---|---|
| Every domain action declares `needsApproval`. | [`action-helpers.ts#L43`](../server/apprentice/action-helpers.ts#L43) |
| The predicate: ad-hoc calls are never gated; playbook executions ask at Watch/Suggest/Draft, ask at Act only for checkpoints or destructive actions, and never at Auto. A thrown error fails closed (the framework asks). | [`services/approval.ts#L14-L21`](../server/apprentice/services/approval.ts#L14-L21) (`stepNeedsApproval`) · [`#L37`](../server/apprentice/services/approval.ts#L37) (`approvalFor`) |
| Promotion thresholds (reviewed, agreement, executed) per level. | [`engine/trust.ts#L23`](../server/apprentice/engine/trust.ts#L23) (`thresholdsFor`) · [`#L49`](../server/apprentice/engine/trust.ts#L49) (`eligibility`) |
| An override at Act or Auto automatically steps the playbook back one rung. | [`engine/trust.ts#L86`](../server/apprentice/engine/trust.ts#L86) (`checkDrift`) · [`services/executor.ts#L409-L415`](../server/apprentice/services/executor.ts#L409-L415) (`applyDrift`) |

Verify: `pnpm test` includes the approval predicate matrix and the full-loop integration test.

## 4. Screen context and agent-driven navigation

| Claim | Evidence |
|---|---|
| `view-screen` gives the agent the open issue, ghost suggestion, playbook, focused decision and pattern candidates. | [`actions/view-screen.ts#L26`](../actions/view-screen.ts#L26) (`readAppState("navigation" / "selection" / "__url__")`) |
| `focus-issue` moves the user's UI via the one-shot `navigate` command. | [`actions/focus-issue.ts#L28`](../actions/focus-issue.ts#L28) (`writeAppStateForCurrentTab("navigate", …)`) |
| The UI live-updates while the agent or autopilot changes data. | [`app/routes/review.tsx#L178`](../app/routes/review.tsx#L178) (`useDbSync({ realtime })`) · [`app/routes/issues.tsx`](../app/routes/issues.tsx) |

## 5. MCP, embedded UI, automations, audit

| Claim | Evidence |
|---|---|
| Five actions are exposed as MCP tools. | `mcpTool: true` in [`list-playbooks`](../actions/list-playbooks.ts), [`run-playbook`](../actions/run-playbook.ts), [`review-batch`](../actions/review-batch.ts), [`get-insights`](../actions/get-insights.ts), [`export-skill`](../actions/export-skill.ts) |
| `review-batch` renders the `/review` screen inline in MCP App hosts. | [`actions/review-batch.ts#L16`](../actions/review-batch.ts#L16) (`embedRoute`) |
| `run-playbook` records whether it was started from chat, MCP, the scheduler or the UI. | [`actions/run-playbook.ts#L24`](../actions/run-playbook.ts#L24) (`ctx.caller`) |
| Autopilot is installed as a scheduled job in Agent Resources. | [`actions/install-autopilot.ts#L37`](../actions/install-autopilot.ts#L37) (`resourcePut`) · job template [`jobs/apprentice-autopilot.md`](../jobs/apprentice-autopilot.md) |
| "Who taught you this?" includes the framework's audit log for the issue. | [`services/executor.ts#L530`](../server/apprentice/services/executor.ts#L530) (`auditEventsFor`, reads `agent_audit_log`) |
| Each domain action declares an audit target (the issue). | [`action-helpers.ts#L45-L48`](../server/apprentice/action-helpers.ts#L45-L48) |

## 6. Agent instructions, skills and evals

| Claim | Evidence |
|---|---|
| System prompt: actions are the source of truth; never route around an approval pause. | [`server/plugins/agent-chat.ts`](../server/plugins/agent-chat.ts) (`systemPrompt`) |
| Runtime agent guide. | [`AGENTS.md`](../AGENTS.md) |
| Four domain skills. | [`.agents/skills/triage-domain`](../.agents/skills/triage-domain), [`apprentice-teacher`](../.agents/skills/apprentice-teacher), [`playbook-runner`](../.agents/skills/playbook-runner), [`shadow-reviewer`](../.agents/skills/shadow-reviewer) |
| Agent-behavior eval gate. | [`evals/apprentice.eval.ts`](../evals/apprentice.eval.ts) (`defineEval`, `usesTool`, `llmJudge`) |
| Learned playbooks export as a portable `SKILL.md`. | [`engine/skill-markdown.ts#L45`](../server/apprentice/engine/skill-markdown.ts#L45) · [`actions/export-skill.ts`](../actions/export-skill.ts) |

## 7. What is not proven here

- Agent chat, the Draft-level Approve/Deny pause in chat, and `pnpm eval` need an LLM key. The hosted demo's Groq free tier (8,000 tokens/minute) is too small for one agent turn (~20,000 tokens). The approval predicate itself is unit-tested and the whole loop works from the UI.
- The MCP inline review card needs a connected MCP host; the deep link always works.
