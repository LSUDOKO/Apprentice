---
name: triage-domain
description: Issue triage conventions for Apprentice — label vocabulary, priorities, components, assignees and comment style. Use whenever labeling, prioritizing, assigning or commenting on issues.
---

# Triage domain

## Labels
| Label | Use when |
|---|---|
| `bug` | Something is broken compared to documented behavior |
| `needs-info` | Can't act yet: missing version, reproduction steps, logs or environment |
| `feature` | New capability request |
| `docs` | Documentation error, typo, or missing docs |
| `question` | Usage question, not a defect |
| `duplicate` | Same problem as an existing issue (use `mark-duplicate`, which also closes) |
| `invalid` | Not actionable: spam, off-topic, not reproducible after follow-up |
| `p1-crash` | Crash or data loss with a stack trace |
| `good first issue` | Small, well-scoped, good for newcomers |

## Priorities
`p0` outage/data loss for many · `p1` crash or blocker with workaround missing · `p2` normal bug · `p3` minor/cosmetic/feature.

## Components
`core` (runtime, actions, DB, sync) · `templates` · `cli` · `docs` · `ui`. Infer from file paths, package names and keywords in the report.

## Assignees
`triage` (needs follow-up) · `core-team` · `docs-team`.

## Comment style
- Thank the reporter in a few words, then list exactly what is missing as a short bullet list.
- Under 80 words. No promises about timelines or fixes. No internal jargon.
- Example (needs info):
  > Thanks for the report! To look into this we need a bit more:
  > - the `@agent-native/core` version (`pnpm list @agent-native/core`)
  > - the steps to reproduce, starting from a fresh template
  > We'll pick it up as soon as we have these.

## Duplicates
Search open and closed issues for the same error message or symptom before marking a duplicate; link the original in the comment.
