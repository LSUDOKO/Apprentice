# 08 — Integrations

Only integrations that serve the Apprentice story are included. Everything goes through
Agent-Native's own extension points — no second agent framework.

---

## 8.1 MCP server: Apprentice as a skill hub for outside agents (F16, Tier A)

Agent-Native auto-mounts an MCP server that exposes actions to external agents (Claude, ChatGPT,
Cursor, Codex…). External agents get a small curated catalog by default; opt actions in with
`mcpTool: true`.

Curated catalog: `list-playbooks`, `run-playbook`, `review-batch`, `get-insights`, `export-skill`.
Everything else stays discoverable but not featured. Destructive domain actions keep their
`needsApproval` gate — MCP uses its own approval flow.

**MCP App (inline UI):** `review-batch` returns a deep link and an inline UI built from the real
`/review` route:

```ts
import { embedRoute } from "@agent-native/core";   // VERIFY export path in installed version
// in defineAction({...}) for review-batch:
...embedRoute({ title: "Review Apprentice batch", openLabel: "Open in Apprentice", path: "/review" }),
```
Make `/review` work inside the embed: internally scrollable, reconstructs state from the URL
(`?run=`), buttons use actions, "Continue in chat" uses `sendToAgentChat` (embed-aware).

**Host notes (document in Settings → MCP help):** a connected chat app gets inline App cards only
when the signed-in person turned on the **App cards in chat apps** lab (Settings → Labs) and
reconnected the app; otherwise tools return plain results with the deep link. After changing MCP
metadata, reconnect the connector in the host.

Doc: https://www.agent-native.com/docs/mcp-protocol/ · https://www.agent-native.com/docs/mcp-apps/

## 8.2 Portable skill export (F17, Tier A)

`export-skill` returns `SKILL.md` + `playbook.json`; the UI zips them (JSZip) as
`<playbook-slug>-skill.zip`. The exported SKILL.md (see the format reference in
`apprentice-templates/skills/README-playbook-skill-format.md`) must be useful standalone in
Claude Code and other skill-aware agents.
**Do not claim Hermes Agent compatibility unless you tested loading the file in Hermes.**
If tested, mention it in the README; otherwise say "standard SKILL.md format".

## 8.3 Automations: autopilot (F13)

Scheduled automation file at `jobs/apprentice-autopilot.md` (template in this kit). Prefer
creating it through **Settings › Automations** or by asking the agent ("create a scheduled
automation from apprentice-templates/jobs/apprentice-autopilot.md"), which writes it into Agent
Resources. Local dev: schedules don't fire by default — use **Run now** for demos.
Cron default: `13 * * * *` (hourly, off the hour). Docs: https://www.agent-native.com/docs/automations/

## 8.4 Slack digest (F13)

Slack is optional and configured through the framework's Messaging (Admin → Messaging, or env:
`SLACK_SIGNING_SECRET` + `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`, or legacy `SLACK_BOT_TOKEN`).
Easiest demo path: in Slack, ask the agent to "post the Apprentice digest here every hour" — a
recurring job created from Slack delivers its result back to that Slack conversation.
In-app digests (`digests` table, Insights page) must work with no Slack at all.
Docs: https://www.agent-native.com/docs/messaging/

## 8.5 Voice (F15, Tier A)

Built in: mic in the composer (Builder Gemini / BYOK Whisper / browser fallback) and realtime
speech mode (hands-free; can navigate and call actions; approval-gated actions stay paused).
No code. Lesson-panel mic (F14) uses the browser `SpeechRecognition` API when available; hide the
button when unsupported. Docs: https://www.agent-native.com/docs/voice-input/

## 8.6 Recorder (F14)

`import { recorder } from "@agent-native/core/client/recorder"`.
On lesson stop: `recorder.report({ seconds: elapsedSeconds, reason: "manual" })` → send to
`finish-lesson`. Keep only `action`, `nav`, `state` events; drop `data` bodies beyond names.
Add `recorder.log("apprentice.lesson.start" | ".stop", { lessonId })` markers.
Bonus: when recording the Clips demo with developer logs on, Clips reads the recorder too.
Docs: https://www.agent-native.com/docs/recorder/

## 8.7 Generative UI tuner (F7)

The agent uses built-in `render-inline-extension` to render Alpine/Tailwind controls inside chat.
The control calls `appAction("backtest-playbook", { playbookId, triggerOverride })` on input
(debounced), shows numbers, and on Apply calls `appAction("update-playbook", …)`. Use theme
classes (`bg-background`, `text-foreground`, `border-border`). The full recipe is in the
"Interactive tuner" section of the `apprentice-teacher` skill. Docs: https://www.agent-native.com/docs/generative-ui/

## 8.8 GitHub import (read-only)

`GET https://api.github.com/repos/{owner}/{repo}/issues?state=open&per_page=50` with headers
`Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, optional
`Authorization: Bearer ${GITHUB_TOKEN}` (server env only). Skip items with a `pull_request` key.
Map labels → names. Unauthenticated limit is low (60/hour) — handle 403/429 with a clear
message. Never write to GitHub.

## 8.9 Sub-agents for judgment backtests (F18, Tier A)

Use the framework's Custom Agents & Teams to fan out judgment scoring (e.g., 4 sub-agents × 25
items) and merge. **VERIFY** API at https://www.agent-native.com/docs/agent-teams/ ; if
unavailable in the installed version, evaluate sequentially and say so in PROGRESS.md.

## 8.10 STRETCH integrations (only after everything else passes)

- **A2A cross-app step (F21):** `import { agentNative } from "@agent-native/core/agent-native"`;
  `await agentNative.invoke("mail", prompt, { userEmail })`. Requires a workspace with another app
  and `A2A_SECRET`. Docs: https://www.agent-native.com/docs/a2a-protocol/
- **Harness agent code-fix step (F23):** `registerBuiltinAgentHarnesses()` / `resolveAgentHarness()`
  / `startAgentHarnessRun()`; supported: Claude Code, Codex, Pi, ACP agents (e.g. Gemini CLI).
  Always a checkpoint step. Docs: https://www.agent-native.com/docs/harness-agents/
- **Hermes Agent as an external peer:** only if verified that Hermes speaks MCP client, ACP or A2A
  in the installed version. Lowest priority. Never required for the demo.
