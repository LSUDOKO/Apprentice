# 11 — Demo and submission (Builder.io Agent-Native Hackathon)

## Official requirements (from https://www.builder.io/hackathon/rules)

1. A functional app built with Agent-Native.
2. Original work or meaningful new development during the hackathon; **identify pre-existing work,
   templates, libraries, third-party assets, and what changed** → `BUILT-DURING-HACKATHON.md`.
3. Project description, creator/team details, contact info, an accessible demo of the working app.
4. A **public Clips recording** of the actual app in use — viewable without login or access request.
5. Submit via the form at https://www.builder.io/hackathon/submit by **Monday Nov 9, 2026, 11:59 PM PT**
   and confirm receipt. Recording a clip alone does not submit.
6. A public repo or live deployment is encouraged (not required). Do both if possible.

Judging: Usefulness & Execution 40% · Creativity & Design 20% · Innovation 20% · Cleverness & Use of Agent-Native 20%.

---

## 2-minute demo script (record with Clips)

Prep: Reset demo · light theme · browser zoom 110% · agent sidebar closed · Slack (if used) in a second window · Claude with the Apprentice connector (if used) in a third.

| Time | Screen | Say / do |
|---|---|---|
| 0:00 | Queue | "Every agent waits for you to tell it what to do. Apprentice learns by watching you." |
| 0:10 | Issue seed-031 → seed-032 | Triage two unversioned bug reports by hand (fast, keyboard). |
| 0:25 | seed-033 | Ghost chip appears after the first step → press Tab. "It's already predicting my next move." |
| 0:35 | Pattern card → Editor | Make playbook. Point at color-coded params: fixed · from the issue · agent decides. |
| 0:50 | Backtest tab | "Before trusting it, it replays my history: matched 34, agreed 31." Toggle a condition. |
| 1:00 | Review | Run in shadow mode. Approve, approve, override one → "That override just became a test." |
| 1:15 | Editor header | Promote to Act (evidence tooltip). Run on new issues → handled live; checkpoint pauses with Approve in chat. |
| 1:30 | Timeline → Why? | "Who taught you this?" → provenance shows my two demonstrations. Undo the batch in one click. |
| 1:42 | Insights / Slack / Claude | Digest + hours saved; approve the batch inline in Claude (or show the deep link). |
| 1:52 | Export skill | "And the skill is portable — any agent can use it. Show it once. Delegate forever." |

Keep narration short; let the UI move. Re-record until there are no hesitations.

## Repo README outline

1. Title + one-liner + 20-second GIF.
2. The problem / the insight ("every click is already a typed demonstration").
3. Features (with screenshots): Watch · Playbooks · Backtest · Tests · Trust ladder · Ghost · Undo · Autopilot · MCP · Export.
4. **How it uses Agent-Native** (table from 02-ARCHITECTURE "Framework feature map") — judges will read this.
5. Run locally (create → copy → `pnpm dev` → Load demo data).
6. Built during the hackathon (link to BUILT-DURING-HACKATHON.md).
7. Limitations / next steps (honest).

## Submission form content (draft)

- **Project name:** Apprentice
- **Tagline:** The agent that learns your job by watching you — then proves it before it acts.
- **Description (≈120 words):** Apprentice turns your normal work into skills. Because Agent-Native UIs and agents share the same typed actions, every triage click is already a structured demonstration. After two similar demonstrations Apprentice proposes an editable playbook, backtests it against your history, turns every correction into a regression test, and earns autonomy through a trust ladder built on the framework's approval gate — from shadow mode to fully automatic, with one-click undo. It runs on a schedule, posts digests, can be reviewed inline from Claude or ChatGPT via MCP Apps, and exports each learned playbook as a portable SKILL.md any agent can use.
- **Pre-existing work:** Agent-Native `chat` template; libraries listed in BUILT-DURING-HACKATHON.md. Everything else built during the hackathon.
- **Demo:** public Clips link · **Repo/deployment:** links.

## Final checklist

- [ ] Clips link opens in a private window without login
- [ ] All 18 E2E steps pass after Reset demo
- [ ] README + BUILT-DURING-HACKATHON.md complete
- [ ] Deployed URL works (optional) with demo data loaded and no secrets exposed
- [ ] Form submitted and receipt confirmed
