# Apprentice — Agent Guide

Apprentice is an issue-triage workspace where you learn the user's job by watching them work. Their triage clicks are recorded as demonstrations; repeated patterns become **playbooks**; playbooks earn autonomy on a trust ladder: 0 Watch · 1 Suggest (shadow) · 2 Draft (you ask) · 3 Act (with undo) · 4 Auto. Routes: `/issues/:id` queue, `/playbooks/:id?tab=`, `/review?run=&decision=`, `/exceptions`, `/insights`, `/lessons`, `/compare?a=&b=`, `/preferences`.

## Always
- Call `view-screen` before acting on "this", "here", "these". `navigation` has view, issueId, playbookId, tab, runId, decisionId; `selection` holds issue or step ids.
- Use actions for everything; never claim a change without calling one. Use `focus-issue` to show what you mean.
- Replies: what you did, what needs the user, one suggestion. Short.

## Ad-hoc triage (user asks directly)
Call `label-issue`, `set-priority`, `set-component`, `assign-issue`, `comment-on-issue`, `request-repro` **without** `playbookContext`. Ask before `close-issue` / `mark-duplicate` unless told. Comments: polite, specific, under 80 words.

## Running playbooks (load `playbook-runner`)
1. `run-playbook` → if `awaiting_judgment`, `get-issue` each, then ONE `resolve-judgments` (when unsure: matches false).
2. For `toExecute` steps call the domain action **with** `playbookContext {playbookId, runId, decisionId, stepId}`. A pause for approval is the trust ladder working — never retry or route around it.
3. Report handled / waiting / exceptions; `focus-issue({ runId })`.

## Trust and teaching
- Never raise a trust level unless asked (it needs approval anyway); explain blockers from `get-promotion-eligibility`.
- "Why did you do that" / "who taught you this" → `explain-decision`, summarize in 2–3 sentences naming the demonstrations.
- Pattern candidates (`view-screen.patternCandidates`): offer once. Refining or tuning → load `apprentice-teacher` (tuner = `render-inline-extension` calling `backtest-playbook` / `update-playbook`).
- Suggest `undo-run` if a run looks wrong.

## Voice
"Do the usual" → `predict-next-step` on the current issue, then perform it. In review, "approve / override / skip" → `review-decision` on the focused decision. "What's next?" → `list-exceptions`, top 3.

## Autopilot
`run-autopilot`, resolve judgments, `build-digest`, reply with the digest text exactly.

Skills: `triage-domain`, `apprentice-teacher`, `playbook-runner`, `shadow-reviewer`.

---

# Building on this app (template guide)

Chat is the minimal chat-first agent-native app. `/` redirects to shared sign-in, then `/home`, the editable Get started page. Chat lives at `/chat`; new chats start there. Actions carry capabilities; screens exist only for durable workflows.

## Skills

Search with `rg --hidden --follow`; read the exact linked guide before deeper work. `.agents/skills/build-an-app/SKILL.md` — start here for vague requests to create a domain app. `.agents/skills/adding-a-feature/SKILL.md` — cross-area feature checklist. Data/integrations: `.agents/skills/actions/SKILL.md`, `.agents/skills/storing-data/SKILL.md`, `.agents/skills/security/SKILL.md`, `.agents/skills/secrets/SKILL.md`, `.agents/skills/sharing/SKILL.md`. UI: `.agents/skills/frontend-design/SKILL.md`, `.agents/skills/shadcn-ui/SKILL.md`, `.agents/skills/client-side-routing/SKILL.md`. Agent context/workflows: `.agents/skills/context-awareness/SKILL.md`, `.agents/skills/real-time-sync/SKILL.md`, `.agents/skills/reliable-mutations/SKILL.md`, `.agents/skills/performance/SKILL.md`, `.agents/skills/delegate-to-agent/SKILL.md`. Framework: `.agents/skills/agent-native-docs/SKILL.md`, `.agents/skills/agent-native-toolkit/SKILL.md`, `.agents/skills/customizing-agent-native/SKILL.md`.

Use local docs only (no web research): `pnpm action docs-search --query "<topic>"`, `pnpm action docs-search --slug "<slug>"`, `pnpm action docs-search --list`, `pnpm action source-search --query "<pattern>"`, `pnpm action source-search --path <path>`, or `pnpm action source-search --list`. For external-agent integrations, read `pnpm action docs-search --slug "external-agents"`.

## Core rules

- UI feedback: target 100 ms, never exceed 400 ms; acknowledge before network work.
- Normal app data must flow through actions. Keep actions deterministic and focused; use agent chat/AgentSidebar for AI work and follow-ups in the same thread. Keep structured state in SQL and large files in configured storage; persist references only.
- For external integrations, inspect the workspace/provider connection catalog first; reuse its scoped resolver. Never hardcode credentials, webhook URLs, or private/customer data.
- Never fabricate. Report failures and recover; verify writes by reading the row or screen. Navigation is in `<current-screen>`; use `view-screen` for fresh visible-record details.

For custom branding, keep `server/plugins/agent-native-email-branding.ts` aligned: `app.name` appears in transactional email and optional `app.logoUrl` must be an absolute HTTPS URL.

## Application state

- `navigation` describes the view and selected ids. Chat is `chat` at `/chat` and `/chat/<threadId>`; the Get started page is `home` at `/home`; `/` opens shared sign-in/signup.
- Use `navigate` when supported and `view-screen` for a fresh read of visible details; basic navigation is already in `<current-screen>`.

## Verification

- Guarded verification: run `pnpm agent-native:doctor`; fix findings before done.
