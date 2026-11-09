# Apprentice — Build Kit for Claude Code

> **Apprentice** is an Agent-Native app where the agent learns your job by watching you do it.
> You triage a few items by hand → Apprentice turns the pattern into an editable playbook →
> proves it with a backtest and regression tests → earns autonomy step by step → and the
> learned skill can be used by any agent (in-app agent, Claude Code, or any MCP client).
>
> Built for the **Builder.io Agent-Native Hackathon** (https://www.builder.io/hackathon).

This folder is a complete specification kit. It contains no app code — it tells Claude Code
exactly what to build, in what order, to what quality bar.

---

## How to use this kit

1. Create the app (Node.js 22.22+ and pnpm required):

   ```bash
   npx --yes @agent-native/core@latest create apprentice --standalone --template chat
   cd apprentice
   corepack enable
   pnpm install
   ```

2. Copy **everything in this kit** into the root of the new `apprentice/` folder:

   ```
   apprentice/
   ├── CLAUDE.md                  ← from this kit (merge with any CLAUDE.md the template created)
   ├── apprentice-docs/           ← rename this kit's docs/ folder to apprentice-docs/
   ├── apprentice-templates/      ← this kit's templates/ folder
   └── apprentice-prompts/        ← this kit's prompts/ folder
   ```

   (Renaming avoids collisions with folders the template may already have.)

3. Open Claude Code in the `apprentice/` folder and paste the **Phase 0** prompt from
   `apprentice-prompts/KICKOFF.md`. Then run each phase prompt in order.

4. Add an LLM key when Claude Code asks (Builder.io connection, Anthropic key, or OpenAI key —
   see `apprentice-docs/12-FRAMEWORK-REFERENCE.md`).

---

## What's inside

| File | Purpose |
|---|---|
| `CLAUDE.md` | Master instructions for Claude Code: rules, quality bar, workflow |
| `docs/00-PRODUCT.md` | Vision, problem, users, pitch, how it maps to the judging rubric |
| `docs/01-FEATURES.md` | Every feature (core + power + wow + Tier A tech) with acceptance criteria |
| `docs/02-ARCHITECTURE.md` | System design, folder layout, data flow, framework mapping |
| `docs/03-DATA-MODEL.md` | All database tables (Drizzle) and JSON shapes |
| `docs/04-ACTIONS.md` | Every `defineAction` — schema, flags, behavior |
| `docs/05-ENGINE.md` | Algorithms: episodes, pattern detection, triggers, trust ladder, backtest, tests, ghost, undo, drift |
| `docs/06-AGENT.md` | Agent behavior, instructions, skills, view-screen, navigate |
| `docs/07-UI-DESIGN.md` | Design system + every screen, component and state |
| `docs/08-INTEGRATIONS.md` | MCP server + MCP Apps, skill export, Slack, automations, voice, recorder, GitHub, A2A |
| `docs/09-TESTING.md` | Unit tests, eval gate, end-to-end checks, demo verification |
| `docs/10-BUILD-PLAN.md` | Phased build order with definition of done per phase |
| `docs/11-DEMO-AND-SUBMISSION.md` | 2-minute demo script, Clips recording, submission checklist |
| `docs/12-FRAMEWORK-REFERENCE.md` | Verified Agent-Native API cheat sheet with doc links |
| `docs/13-SEED-DATA.md` | Exact seed dataset spec so the demo is deterministic |
| `templates/AGENTS.md` | The app agent's always-on instructions |
| `templates/skills/*/SKILL.md` | Agent skills (teacher, runner, reviewer, triage domain) |
| `templates/jobs/apprentice-autopilot.md` | Scheduled automation |
| `prompts/KICKOFF.md` | Copy-paste prompts for Claude Code, one per phase |
