# CLAUDE.md — Apprentice (Agent-Native Hackathon build)

You are building **Apprentice**, a production-quality Agent-Native app, for the Builder.io
Agent-Native Hackathon. The judges are the people who built the Agent-Native framework.
Every decision should make the app (1) genuinely useful and complete, (2) beautifully designed,
(3) a clear human–agent workflow, and (4) an exemplary use of Agent-Native.

The full spec lives in `apprentice-docs/`. Read it before writing code.

---

## 0. Read order (mandatory before Phase 1)

1. `apprentice-docs/00-PRODUCT.md`
2. `apprentice-docs/01-FEATURES.md`
3. `apprentice-docs/02-ARCHITECTURE.md`
4. `apprentice-docs/12-FRAMEWORK-REFERENCE.md`
5. Then the doc for whatever you are building (03 data, 04 actions, 05 engine, 06 agent, 07 UI, 08 integrations).
6. Also read the template's own `AGENTS.md`, `README`, and the existing `actions/hello.ts`
   to learn the conventions this template version uses.

Track progress in `PROGRESS.md` at the repo root (create it): phase, what's done, what's
verified, known issues. Update it at the end of every phase.

---

## 1. Non-negotiable framework rules (from Agent-Native "Key Concepts")

1. **All app data lives in Postgres via Drizzle** (PGlite locally). No in-memory state, no files
   as a database, no `localStorage` for anything the agent must see.
2. **All AI goes through the agent.** Never call an LLM inline from an action, route, or React
   component. If something needs judgment, hand it to the agent (`sendToAgentChat()` from UI,
   or the agent loop / automation from the server). Deterministic logic stays in actions.
3. **Every operation is a `defineAction()`** in `actions/`. The UI calls actions with
   `useActionQuery` / `useActionMutation`. Never write a parallel REST endpoint for the same thing.
4. **Live sync**: agent writes must appear in the UI without a reload.
5. **Ephemeral UI state lives in application state** (`navigation`, `selection`), readable by the agent.

**Four-area checklist for EVERY user-facing feature:** UI + Action + Skill/AGENTS.md entry +
App-state (navigation/selection/view-screen). A feature missing one of these is not done.

---

## 2. Verify, don't guess

The spec references real framework APIs that were verified against the docs on 2026-11-09
(see `12-FRAMEWORK-REFERENCE.md`). Framework versions move fast. Before using any API:

- Check the installed types in `node_modules/@agent-native/core` (grep for the export).
- If the docs page and installed types disagree, **trust the installed types** and note it in `PROGRESS.md`.
- Anything marked **VERIFY** in the docs must be confirmed before you build on it.
- If an API does not exist, implement the closest honest equivalent and record the deviation.
  Never fake a capability in the UI (no buttons that pretend to work).

Useful doc root: https://www.agent-native.com/docs/

---

## 3. Quality bar (act like a senior engineer)

**TypeScript**
- `strict` mode. No `any` except at validated boundaries. Zod schemas for every action input.
- Pure engine logic in `server/apprentice/engine/*` with no DB or framework imports, so it is unit-testable.
- Small modules, descriptive names, no dead code, no commented-out code, no TODOs left in shipped paths.

**Backend**
- Every mutating action: validates input, scopes by `ctx.userEmail` / `ctx.orgId`, declares
  `audit.target`, returns a typed result, throws clear errors with an error code.
- Idempotency where an action may be retried (imports, scheduled runs).
- Transactions for multi-row writes (run creation, undo).

**Frontend**
- Every screen has: loading skeleton, empty state (with a helpful next action), error state, and success feedback (toast).
- Keyboard-first: `j/k` to move, `Enter` to open, `Tab` to accept ghost suggestion, `a`/`o` approve/override in review, `?` shows shortcuts.
- Accessible: semantic HTML, labels on inputs, focus rings visible, color never the only signal (icons/text too), WCAG AA contrast.
- Responsive down to 1024px wide (desktop-first product); usable on mobile for review screens.
- Use the template's Tailwind + shadcn primitives and the design tokens in `07-UI-DESIGN.md`.

**Testing** — see `09-TESTING.md`. Engine functions must have unit tests. Run typecheck + tests at the end of every phase.

**Security**
- Never put secrets in client code. GitHub token and Slack credentials are server-side env/secrets only.
- Apprentice never writes to GitHub. Imported issues are a local mirror.
- Destructive actions (close, mark-duplicate) are always gated by the trust ladder.

---

## 4. Workflow per phase

1. Re-read the relevant spec section.
2. Plan briefly (list files to create/change).
3. Build the smallest vertical slice end-to-end (DB → action → UI → agent), then widen.
4. Run: typecheck, unit tests, `pnpm dev` and click through the feature, ask the agent to do it via chat.
5. Update `PROGRESS.md`. Commit with a clear message (`feat(engine): pattern detection`).
6. Do not start the next phase until the current phase's Definition of Done passes (`10-BUILD-PLAN.md`).

---

## 5. Hackathon constraints

- The project must be built with Agent-Native, started from the `chat` template. Keep a
  `BUILT-DURING-HACKATHON.md` listing: the template used, libraries added, and what was built new.
  (The official rules require identifying pre-existing work.)
- The demo is a public Clips recording of the real app. Everything shown must actually work.
- Seed data must be clearly labeled as demo data in the UI (a small "Demo data" badge).

---

## 6. Scope discipline

Build in the order of `10-BUILD-PLAN.md`. Features are tagged **CORE**, **POWER**, **WOW**, **STRETCH**.
Never start a WOW/STRETCH item while any CORE or POWER item is broken. A polished smaller app
beats a broken bigger one.
