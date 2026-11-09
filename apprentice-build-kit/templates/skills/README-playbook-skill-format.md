# Exported playbook SKILL.md format (reference for `engine/skill-markdown.ts`)

This file is a reference for the generator — **do not install it as a skill**. The generator
must produce output with exactly this structure from a playbook (deterministic, no LLM).

```markdown
---
name: needs-info-for-unversioned-bugs
description: Use when a new bug report has no version number and no reproduction steps. Labels it, asks the reporter for the missing details, and assigns it to triage. Learned by Apprentice from 2 demonstrations; agreed with the user 31/34 times in backtest.
---

# Needs-info for unversioned bugs

## When to use
All of these are true for the issue:
- labels include `bug` (or the report describes broken behavior)
- no version is mentioned
- no reproduction steps

## Steps
1. **label-issue** — add `bug`, `needs-info` *(fixed)*
2. **request-repro** — missing: `version`, `steps` *(fixed)*; message: *(you decide)* Write a short, friendly request for the missing details, under 80 words.
3. **assign-issue** — assignee `triage` *(fixed)*

## Checkpoints
- None. Ask before closing or marking anything as duplicate.

## If you are running inside Apprentice
Call `run-playbook` with playbook id `pb_…` instead of doing the steps by hand.

## If you are running somewhere else
If the Apprentice MCP server is connected, call its `run-playbook` tool. Otherwise perform the
equivalent steps in your issue tracker, and ask the user before any destructive action.

## Learned from
- 2 demonstrations by alice@example.com (issues #31, #32) on 2026-11-09
- Backtest: matched 34, agreed 31 · Tests: 12 passing · Trust level: Act
```

`playbook.json` (exported alongside) = `{ name, description, version, trigger, steps, stats, exportedAt, generator: "apprentice" }`.
