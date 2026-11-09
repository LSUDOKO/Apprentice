# 12 — Agent-Native framework reference (verified 2026-11-09)

Checked against https://www.agent-native.com/docs/ on 2026-11-09. Before using any entry,
confirm it in `node_modules/@agent-native/core` (types win over this sheet). Items marked
**VERIFY** were not confirmed in detail.

## Setup

```bash
npx --yes @agent-native/core@latest create apprentice --standalone --template chat
cd apprentice && corepack enable && pnpm install && pnpm dev
```
Node 22.22+, pnpm. On the Welcome screen choose **Continue as local dev**. LLM: connect
Builder.io, add a custom key, or set a provider key in `.env` (Anthropic/OpenAI), or local Ollama.
Peer-dependency errors → `npx clear-npx-cache`. Local DB = PGlite; hosted = `DATABASE_URL` Postgres (e.g. Neon).

Inspect data: `pnpm action db-schema`, `pnpm action db-query --sql "SELECT …"`. Run any action: `pnpm action <name> --arg=value`.

## Actions — https://www.agent-native.com/docs/actions-defining/

```ts
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
export default defineAction({
  description: "…", schema: z.object({…}),
  http: { method: "GET" },           // reads; omit for POST mutations; http: false = internal
  needsApproval: true | ((args, ctx) => boolean | Promise<boolean>),
  agentTool: false,                  // hide from agent (UI/CLI only)
  mcpTool: true,                     // feature in external-agent catalog
  toolCallable: false,               // block from extension iframes
  audit: { target: (args, result) => ({ type, id, ownerEmail?, visibility? }), summary: (args) => "…" },
  access: { scope: "resource", resource: { type, idFrom, level } },   // optional
  run: async (args, ctx) => { /* ctx.userEmail, ctx.orgId, ctx.caller */ },
});
```
`ctx.caller`: `"tool" | "http" | "frontend" | "cli" | "mcp" | "a2a" | "automation"`.
Approval: a thrown predicate counts as "needs approval". Chat shows Approve/Deny automatically.
Direct HTTP callers get 409 `approval_required`; the proven app UI may run gated calls.

## Client — https://www.agent-native.com/docs/client-data/

```ts
import { useActionQuery, useActionMutation, useDbSync, setClientAppState } from "@agent-native/core/client/hooks";
const { data } = useActionQuery("list-issues", { state: "open" });
const { mutate } = useActionMutation("label-issue");
useDbSync({ queryClient, realtime: { reason: "autopilot triages issues in the background" } });
await setClientAppState("selection", value, { keepalive: true });
```
Navigation hook (lives in the app): `useAgentRouteState` from `@agent-native/core/client/navigation`
with `getNavigationState`, `getCommandPath`, `navigateOptions: { replace: true, flushSync: true }`.

## Agent UI — https://www.agent-native.com/docs/drop-in-agent/

```tsx
import { AgentSidebar, AgentToggleButton, sendToAgentChat } from "@agent-native/core/client/agent-chat";
<AgentSidebar suggestions={[…]} dynamicSuggestions defaultSidebarWidth={400}>…</AgentSidebar>
sendToAgentChat({ message, context, submit: true, openSidebar: true });
```

## App state — https://www.agent-native.com/docs/context-awareness/

Server: `import { readAppState, writeAppState } from "@agent-native/core/application-state"`.
Keys: `navigation` (UI writes), `selection` (UI writes), `navigate` (agent writes one-shot command),
`__url__`, `pending-selection-context` (Cmd+I). Every template should have a `view-screen` action.

## Database — https://www.agent-native.com/docs/server-database/

`import { table, text, integer } from "@agent-native/core/db/schema"` (VERIFY other helpers).
Templates expose a db helper (example in docs: `getDb()` from `../server/db/index.js`) and Drizzle.

## Audit log — https://www.agent-native.com/docs/audit-log/

Automatic for mutating actions. Table `agent_audit_log` (action, caller, actor_kind, actor_email,
thread_id, turn_id, target_type, target_id, status, summary, input, approval…). Built-in actions:
`list-audit-events` (filters: targetType, targetId, actorKind, status, threadId, turnId, action,
sinceMs, limit), `get-audit-event`, `export-audit-events`. VERIFY whether server code can call these
directly or should query the table via Drizzle (scoped).

## Recorder — https://www.agent-native.com/docs/recorder/

`import { recorder } from "@agent-native/core/client/recorder"` — `report({ seconds, reason })`,
`log(name, data)`, `watch(name, fn)`, `onReport(fn)`, `redact(...)`, `pending()`. Events:
action, state, nav, error, toast, log. 120s window by default (`configureRecorder`).

## Generative UI — https://www.agent-native.com/docs/generative-ui/

Built-in agent actions: `render-inline-extension` (transient), `create-extension` (saved),
`show-extension-inline`, `update-extension`. Inside the iframe: `appAction(name, params)`,
`window.slotContext`, `agentNative.ui.output(value)`, `agentNative.chat.send(msg, { submit })`. Alpine.js + Tailwind theme classes.

## Evals — https://www.agent-native.com/docs/evals/

```ts
import { defineEval, contains, usesTool, llmJudge, createScorer } from "@agent-native/core/eval";
export default defineEval({ name, input: { prompt }, threshold: 0.7, scorers: [usesTool("run-playbook")] });
```
Run `agent-native eval [filter] [--json]`. Promote a trace: `agent-native eval promote <runId> --write evals/x.eval.ts`.

## Automations — https://www.agent-native.com/docs/automations/ · /recurring-jobs/

`jobs/<name>.md` with frontmatter (`schedule` cron, `enabled`, `runAs`, optional `model`, `mcpTools`).
Body = prompt. Create via Settings › Automations or by asking the agent (`manage-automations`).
**Run now** works locally; scheduled ticks don't fire locally unless opted in.

## Messaging — https://www.agent-native.com/docs/messaging/

Slack via Admin → Messaging (managed OAuth: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`,
`SLACK_SIGNING_SECRET`; legacy: `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET`). A recurring job
created from Slack delivers results back to that conversation.

## MCP — https://www.agent-native.com/docs/mcp-protocol/ · /mcp-apps/ · /external-agents/

Auto-mounted MCP server. `mcpTool: true` features an action. MCP Apps: `embedRoute({ title, openLabel, path })`
returns matching `link` + `mcpApp` (VERIFY import path; docs show `embedApp` from `@agent-native/core`).
Inline cards require the person's **App cards in chat apps** lab (Settings → Labs).

## Voice — https://www.agent-native.com/docs/voice-input/

Built into the composer; realtime speech mode can navigate and call actions; approvals still pause. No code needed.

## Agent teams / sub-agents — https://www.agent-native.com/docs/agent-teams/ (VERIFY)

## A2A (stretch) — https://www.agent-native.com/docs/a2a-protocol/

`import { agentNative } from "@agent-native/core/agent-native"`; `agentNative.invoke(app, prompt, { userEmail })`.
`import { callAgent, A2AClient } from "@agent-native/core/a2a"`. Production needs `A2A_SECRET`.

## Harness agents (stretch) — https://www.agent-native.com/docs/harness-agents/

`registerBuiltinAgentHarnesses()`, `resolveAgentHarness(name)`, `startAgentHarnessRun(...)`.
Built-ins: `ai-sdk-harness:claude-code`, `ai-sdk-harness:codex`, `ai-sdk-harness:pi`, `acp:gemini`, `acp:claude-code`, custom ACP command.

## Deployment — https://www.agent-native.com/docs/deploy-an-app/

Any Nitro host (Netlify, Vercel, Cloudflare, Render, Node, Docker). Postgres via `DATABASE_URL` (Neon recommended).
Scheduled automations fire on Netlify/Vercel/Cloudflare with the documented secrets (`A2A_SECRET` / `CRON_SECRET`).
