# Built during the hackathon

**Hackathon:** Builder.io Agent-Native Hackathon. **Build date:** 2026-11-09.

## Pre-existing work

- **Template:** Agent-Native `chat` template, created with `npx @agent-native/core@0.226.0 create apprentice --standalone --template chat`. It is committed unmodified as the second commit (`chore: scaffold Agent-Native chat template…`), so every later diff is hackathon work.
- **Framework packages:** `@agent-native/core`, `@agent-native/toolkit`, `@agent-native/agentkit` 0.226.0 and the template's own dependencies (React Router, Drizzle, PGlite, Tailwind, Radix, Tabler icons, sonner).
- **Spec kit:** `apprentice-build-kit/` (product, feature and design specification written before building).

## Libraries added

| Package | Why |
|---|---|
| `@fontsource-variable/geist`, `@fontsource-variable/geist-mono` | Self-hosted fonts for the dark "Eclipse" design |
| `framer-motion`, `vite`, `@vitejs/plugin-react` (in `landing/` only) | Landing site scroll animations and build |

## Built new

- **Learning engine** (`server/apprentice/engine/`, pure TypeScript): issue features, signatures with step merging, discriminative trigger inference, parameter-owner inference, backtest, regression tests, trust ladder + drift, ghost prediction, confidence, time saved, SKILL.md generator.
- **Services** (`server/apprentice/services/`): the single issue-mutation path shared by humans, the agent and the executor; watch-mode step recording; pattern detection; playbooks with versions and the test gate; runs, decisions and the executor with batch undo and conflict protection; provenance (incl. framework audit log); exceptions; insights; digest; autopilot; GitHub import; lessons (Recorder); deterministic seed.
- **~50 actions** (`actions/`), including the `needsApproval` trust-ladder predicate on every domain action, `review-batch` with `embedRoute`, `export-skill`, `install-autopilot`, `view-screen` and `focus-issue`.
- **Database:** 15 tables (`server/db/schema.ts`) with additive migrations.
- **UI:** dark "Eclipse" theme (light variant kept); nav rail with badges; watch indicator; Queue and Issue detail (label/priority/component/assignee editors, repro/duplicate/close dialogs, activity timeline with "Why?"); pattern card with Team-mode conflict; ghost chip; playbook editor (Recipe, Backtest with live toggles, Tests, Provenance, History, SKILL.md); Review split view with keyboard verdicts and correction sheet; Exceptions; Insights; Lessons with narration mic; Compare; Settings; `?` shortcuts overlay.
- **Agent:** `AGENTS.md` Apprentice section, system prompt, primary tool list, four skills (`triage-domain`, `apprentice-teacher`, `playbook-runner`, `shadow-reviewer`), autopilot job template, `evals/apprentice.eval.ts`.
- **Tests:** 55 Vitest tests (engine units + full-loop integration on PGlite).
- **Landing site** (`landing/`): Vite + React + Framer Motion, scroll-driven sections, deployed to Cloudflare Pages at https://apprentice-agent.pages.dev.
- **Seed data generator** (`scripts/generate-seed.ts`) and committed JSON: 68 invented issues plus demonstration history.

## Changed in the template

`Sidebar.tsx` (Apprentice nav replaces the Home link), `Header.tsx` (status pills), `Layout.tsx` (workspace banners), `AgentInspector.tsx` (suggestions), `root.tsx` (global shortcuts), `use-navigation-state.ts` (Apprentice routes), `global.css` (theme tokens and fonts), `server/plugins/agent-chat.ts` (prompt and tools), `server/plugins/agent-native-email-branding.ts` (`homePath: /issues`), `AGENTS.md`, `README.md`, `package.json` (scripts), `tsconfig.json` (evals). The template's `hello` example action was removed.
