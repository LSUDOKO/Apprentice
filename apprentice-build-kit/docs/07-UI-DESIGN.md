# 07 — UI and design

Load the `frontend-design` skill if your Claude Code has it. The goal: a calm, confident tool that
looks like a craftsperson's workbench — not a generic AI dashboard. No purple gradients, no
emoji-heavy UI, no glowing "AI" sparkles everywhere. The *agent's* presence is shown through
precise, colored provenance, not decoration.

## Design language: "The Workshop Ledger"

- **Mood:** warm paper neutrals, ink-dark text, one confident accent. Dense but breathable, like a good issue tracker.
- **Typography:** `IBM Plex Sans` (UI) + `IBM Plex Mono` (action names, params, ids, numbers). Load from Google Fonts (or self-host). Sizes: 12 / 13 / 14 (base) / 16 / 20 / 28. Tabular numbers for all metrics.
- **Radius:** 6px controls, 10px cards. **Shadows:** almost none; use 1px borders.
- **Motion:** 120–180ms ease-out. Ghost chip fades in; step cards slide 4px on reorder. Respect `prefers-reduced-motion`.

### Color tokens (define as CSS variables on `:root` and `.dark`, map into the template's Tailwind theme)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FAF8F4` | `#14130F` | app background |
| `--surface` | `#FFFFFF` | `#1C1B17` | cards, panes |
| `--border` | `#E7E2D8` | `#2E2C26` | |
| `--ink` | `#1E1C17` | `#F2EEE6` | text |
| `--ink-muted` | `#6B655A` | `#A39C8F` | secondary text |
| `--accent` | `#C2410C` (burnt orange) | `#F97316` | primary actions, focus |
| `--param-fixed` | `#57534E` | `#A8A29E` | Fixed parameter chips |
| `--param-item` | `#0F766E` | `#2DD4BF` | From-item chips |
| `--param-agent` | `#6D28D9` | `#A78BFA` | Agent-decides chips |
| `--ok` | `#15803D` | `#4ADE80` | pass, approved |
| `--warn` | `#B45309` | `#FBBF24` | checkpoint, drift |
| `--bad` | `#B91C1C` | `#F87171` | fail, override |

Parameter chips always show an icon + text label too (◆ Fixed, ⇢ From issue, ✦ Agent decides) — never color alone.

### Trust ladder component
Five connected segments labeled Watch · Suggest · Draft · Act · Auto. Filled segments in `--accent`;
the next level shows a dashed outline with "Ready" when eligible. Tooltip: evidence + blockers.
Compact variant (dots) for lists.

## Layout

```
┌ Top bar: Apprentice logo · global search (⌘K) · Watching ● 12 today · Demo data badge · AgentToggleButton ┐
├ Left rail (icons + labels): Queue · Review (badge) · Exceptions (badge) · Playbooks · Insights · Lessons · Settings │
├ Main area (route)                                                              │ AgentSidebar (right, 400px) │
```

## Screens

### Queue `/` (and `/issues/:id`)
- Two panes: list (380px) + detail. List rows: number, title, label chips, priority dot, "matched by" playbook icon, agent-activity dot.
- Filter bar: Untriaged · All open · Needs info · Closed · search.
- Detail: title, author, created; body (markdown, code highlighted); right column: Labels, Priority, Component, Assignee editors (each is a control calling a domain action); **Action bar** at bottom: Request repro · Mark duplicate · Close · Comment — and the **Ghost chip** on its left.
- Ghost chip: dashed border, `--ink-muted` text, playbook name in tiny mono above: "Needs-info for unversioned bugs · step 2/3", label "Request repro (version, steps)", key hint `Tab ↹`. Accept → chip turns solid accent for 400ms then disappears.
- Activity timeline: each entry shows actor avatar (human) or Apprentice glyph (agent) + "Why?" link for agent entries → Provenance drawer.
- Pattern card: slides in at top of the list when a candidate exists (dismissible), shows the recipe preview with param chips and support count ("seen 2× today").

### Playbooks `/playbooks`
Card grid: name, trigger summary in plain English, trust ladder (compact), agreement %, tests (✓ 12 / ✗ 0), executed count, estimated time saved. Sort by "ready to promote" first.

### Playbook editor `/playbooks/:id`
Header: name (inline editable), status, trust ladder + Promote button, Run now (dropdown: on untriaged / on selection), Export skill.
Tabs: **Recipe** · Backtest · Tests · Provenance · History · SKILL.md
- **Recipe:** Trigger card (conditions as editable rows: field ▾ op ▾ value; add condition; judgment textarea with violet "Agent judges" tag) → Steps (cards with action name in mono, param rows with owner segmented control Fixed / From issue / Agent decides, value input appropriate to owner, checkpoint toggle with ⚑ icon, drag handle, destructive steps have a red left border) → "Save" (creates version) with change note.
- **Backtest:** big numbers (Considered · Matched · Agreed · Missed · False positives), agreement bar, disagreement list (click → issue in a side drawer with predicted vs actual). Condition toggles on the left re-run the backtest live (debounced 250ms). "Tune with agent" button → sendToAgentChat → generative UI.
- **Tests:** list with pass/fail, origin chip (override/edit/seed), diff view (expected vs predicted steps), "Run tests".
- **Provenance:** source demonstrations timeline (who, when, issue link, steps), audit events.
- **History:** versions with change notes, diff of trigger/steps.
- **SKILL.md:** rendered preview + copy button.

### Review `/review?run=…`
Full-width split. Left: issue (compact). Right: Decision panel — "What I'd do" steps with param chips, confidence ring, explanation, matched conditions ✓ list. Bottom: Approve (a) · Edit (e) · Override (o) · Skip (s); "Approve & apply" when level ≥2. Top: run selector, agreement meter for this run, progress "4 / 12". After the last decision: summary + "Promote?" if eligible.
Override flow: drawer with the same step editor (pre-filled with proposal) + "This playbook shouldn't apply here" option → creates a test (toast: "Saved as test #13").

### Compare `/compare?a=…&b=…`
Two issues side by side with their decisions/steps. Used by the agent (`focus-issue` with
`compareIssueIds`) for drift and team-conflict discussions.

### Exceptions `/exceptions`
List grouped by reason with explanation chips. Opening one goes to the issue (with watch mode recording).

### Insights `/insights`
Stat tiles: Estimated hours saved · Items handled by Apprentice · Agreement (30d) · Suggestions accepted. Charts (follow the `dataviz` skill if available): hours saved per week (bars), agreement over time per playbook (lines), autonomy distribution. Digests list.

### Lessons `/lessons`
"Record a lesson" big button → recording bar pinned at top of every page (red dot, timer, narration mic, Stop). Finished lessons list with the steps captured and narration.

### Settings `/settings`
Watch mode · Demo mode (lower thresholds) · Min support · GitHub repo import · Reset demo · Slack digest status (read-only: configured or "set up in Messaging") · MCP connection help (how to add Apprentice to Claude/ChatGPT/Cursor).

## States (every screen)
- Loading: skeleton rows matching the layout.
- Empty: illustration-free, one sentence + primary action ("No playbooks yet — triage two similar issues and Apprentice will suggest one" + "Load demo data").
- Error: inline message with retry; never a blank screen.

## Keyboard map
`j/k` move · `Enter` open · `Tab` accept ghost · `Esc` dismiss · `l` labels · `p` priority · `r` request repro · `a/e/o/s` review verdicts · `g q` queue · `g r` review · `g p` playbooks · `?` help · `⌘K` search · `⌘I` send selection to agent (framework).

## Navigation state hook
Implement `app/hooks/use-navigation-state.ts` with the framework's `useAgentRouteState` (see 12):
map `/issues/:id` → `{ view: "issue", issueId }`, `/playbooks/:id` → `{ view: "playbook", playbookId, tab }`,
`/review` → `{ view: "review", runId, decisionId }`, etc. `getCommandPath` maps `navigate` commands
(`{ issueId }`, `{ playbookId }`, `{ runId }`, `{ compareIssueIds }` → `/compare?a=&b=`) to routes.
Write `selection` on row selection and on step selection in the editor.
