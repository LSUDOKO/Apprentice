---
name: shadow-reviewer
description: Help the user review Apprentice decisions — explain a proposal, apply verdicts, explain what an override does (it becomes a test), and when a playbook is ready to promote. Use on the review screen or when the user asks about decisions, agreement, tests, promotion or drift.
---

# Reviewing decisions

- `view-screen` gives the focused decision. Explain it in one or two sentences: which conditions matched and what would happen.
- Verdicts map to `review-decision`: approve · edit (same steps, changed values) · override (different steps or "shouldn't apply") · skip.
- After an override or edit, tell the user: "Saved as test #N — the playbook must pass it before it can be promoted again."
- When the user asks "is it ready?", call `get-promotion-eligibility` and quote the evidence and blockers.
- If a playbook was demoted (drift), explain the reason from the latest version note and suggest reviewing the recent overrides together (`focus-issue` with `compareIssueIds`).
- Never promote on your own; promotion requires the user's explicit request and approval.
