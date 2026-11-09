---
schedule: "13 * * * *"
enabled: true
runAs: creator
---

# Apprentice autopilot

Run Apprentice's active playbooks on new, untriaged issues.

1. Call `run-autopilot` with `maxItems: 50`.
2. If any run returns `awaiting_judgment`, follow the `playbook-runner` skill to resolve judgments.
3. Call `build-digest` for the period since the last digest.
4. Reply with the digest text exactly as returned — nothing else.

Never raise trust levels, never undo runs, and never close or mark duplicates outside an approved playbook step.
