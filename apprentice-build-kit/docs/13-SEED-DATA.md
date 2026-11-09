# 13 — Seed data (deterministic demo)

Generate `server/apprentice/seed/issues.json` and `server/apprentice/seed/history.json` once
(write them by hand or with a one-off script committed to the repo), then **commit the JSON** so
every reset produces identical data. All content is invented — do not copy real GitHub issues.
The fictional project is "Agent-Native" style: a TypeScript framework with `core`, `templates`,
`cli`, `docs`, `ui` components.

Users: the demo user is whoever is signed in (local dev email). A second teacher is
`bob@demo.local` (history only, for Team mode).

## issues.json — 60 issues (`seed-001` … `seed-060`)

| Range | Count | Kind | Notes |
|---|---|---|---|
| 001–020 | 20 | **History bugs, already triaged** | closed or triaged; used by history episodes |
| 021–030 | 10 | History mixed (features, docs, spam) | already triaged |
| 031–038 | 8 | **Live: unversioned bug reports** | open, untriaged, no version, no repro → the demo pattern |
| 039–042 | 4 | Live: bugs WITH version + repro + stack trace | should NOT match the needs-info playbook |
| 043–046 | 4 | Live: crash reports with stack traces | candidate for a second playbook (P1 + core) |
| 047–050 | 4 | Live: duplicates of seed-005 / seed-009 | titles paraphrase the originals |
| 051–054 | 4 | Live: docs typos/questions | |
| 055–056 | 2 | Live: spam/off-topic | link-heavy |
| 057–060 | 4 | Live: feature requests | |

Writing rules: realistic titles ("Dev server crashes after adding a new action"), bodies 3–15
lines, mix of markdown, some code blocks; unversioned bugs must clearly lack a version and repro
steps; versioned ones include `@agent-native/core 0.12.x` style strings. Authors: 15 invented
GitHub-style handles. `createdAt` spread over the past 30 days; live issues within last 2 days.

## history.json — past human episodes (drive backtest, tests, insights, Team mode)

- **34 episodes by the demo user** on issues 001–030 (some issues have 2 episodes over time — allowed):
  - 26 follow the **needs-info signature**: `label-issue(add:[bug,needs-info])` > `request-repro(missing:[version,steps])` > `assign-issue(assignee:"triage")`, on unversioned bugs.
  - 3 look like unversioned bugs but the user did something else (closed as `invalid`) → produce disagreements in backtest.
  - 5 on other kinds (docs label + assign docs; feature label + p3) → negatives for trigger inference.
- **6 episodes by bob@demo.local** on unversioned bugs where Bob did `label-issue(add:[invalid])` > `close-issue(reason:invalid)` → Team mode conflict with the demo user's pattern.
- Each episode: realistic durations (40s–4min), `source: "seed"`, closed, signature precomputed by the same engine function at seed time (do not hardcode).

Target backtest result for the auto-generated needs-info playbook on this history:
**≈34 considered-matches region, ≈31 agreed, 3 disagreements** (exact numbers may vary slightly
with inference; adjust seed content, not the engine, to land close).

**Important:** history episodes must NOT by themselves create a pattern candidate for the
needs-info signature before the live demo — otherwise the "Apprentice noticed" moment is lost.
Implement: pattern detection only considers episodes with `source` in (`watch`, `lesson`) for
*proposing* candidates (min support 2), while backtests, tests and insights use all episodes
including `seed`. Team-mode conflicts may use seed episodes once a live candidate exists.

## Seeded comments
Add 0–3 comments on history issues (reporter replies with versions after needs-info, etc.) so the
timeline looks lived-in.

## Labels vocabulary
`bug`, `needs-info`, `feature`, `docs`, `question`, `duplicate`, `invalid`, `p1-crash`, `good first issue`.
Assignees: `triage`, `core-team`, `docs-team`.
