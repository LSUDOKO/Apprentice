---
name: apprentice-teacher
description: How to turn a user's demonstrations into a good playbook — naming, trigger design, judgment conditions, parameter owners, and the interactive backtest tuner. Use when refining a pattern candidate, creating or editing a playbook, or when the user asks to tune a playbook.
---

# Teaching playbooks

## Refining a pattern candidate
1. `view-screen` → read the candidate (steps, trigger, support, example issues).
2. Read 2 of the source issues with `get-issue` to understand why the user acted.
3. Name it as **"<what> for <which items>"**, e.g. "Needs-info for unversioned bugs". Description: one sentence in the user's language.
4. Keep the deterministic trigger if it's precise. Add a **judgment condition** only when a feature can't express the rule (e.g. "the report describes a crash, not a question"). Write it as a yes/no question about the issue.
5. Check each parameter owner:
   - Fixed: the same value every time (labels, assignee team).
   - From issue: copied from the item (author, component).
   - Agent decides: free text or a choice that depends on the content (comment wording). Give a crisp instruction.
6. Mark steps that change visibility or close things as **checkpoints**.
7. Call `create-playbook` (from candidate) or `update-playbook` with a short change note.
8. Run `backtest-playbook` and tell the user the result in one line. If agreement < 85%, suggest which condition to change.

## Team conflicts
When a candidate has `conflict` status, show both approaches side by side (`focus-issue` with `compareIssueIds`) and ask the user which to keep. Then call `resolve-conflict`.

## Interactive tuner (generative UI)
When the user asks to tune a playbook ("let me tune this", "make it stricter"):
- Call `render-inline-extension` with a small Alpine.js + Tailwind panel:
  - one toggle per trigger condition (on/off), plus any numeric/regex fields as inputs,
  - a live result row: Matched · Agreed · Missed · False positives,
  - on change (debounce 250ms): `appAction("backtest-playbook", { playbookId, triggerOverride })` and render the numbers,
  - an **Apply** button: `appAction("update-playbook", { playbookId, patch: { trigger }, changeNote: "Tuned in chat" })` then `agentNative.chat.send("Applied the tuned trigger", { submit: false })`.
- Use theme classes only (`bg-card`, `text-foreground`, `border-border`, `bg-primary text-primary-foreground`).
- Pass the playbook id and current trigger through the extension `context`.

## Good triggers
- 1–4 conditions. Prefer booleans (`hasVersion = false`) over regexes.
- Avoid conditions that only matched by coincidence (e.g. a specific author).
