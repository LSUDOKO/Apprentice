# 00 — Product

## One-liner

**Apprentice: show it once, delegate forever.** An agent that learns your job by watching you
work, proves what it learned, and earns autonomy step by step.

## The problem

Every team has queue work: issue triage, support tickets, inbound requests, ops checklists.
It is repetitive, but it isn't trivial — it encodes judgment ("no version number → ask for one",
"crash with stack trace → P1, assign to core").

Today's AI agents make you *describe* that judgment in prompts, then hope. Nobody trusts the
result, so people keep doing the work by hand.

## The insight (why this is only possible with Agent-Native)

In Agent-Native, the UI and the agent call the **same typed actions**. So every click a human
makes is already a structured, typed operation — and the framework's audit log records each
mutating call with who did it (human vs. agent), from which surface, and its inputs.

That means a human's normal work is already a clean, machine-readable **demonstration**.
Apprentice turns demonstrations into skills. No screen scraping, no prompt writing.

## Who it's for

- **Primary demo persona:** an open-source maintainer triaging GitHub issues (the judges maintain
  an open-source repo — they feel this pain).
- **Broader market:** support leads, ops teams, anyone with a queue.

## The loop

1. **Watch** — you triage items by hand; Apprentice records typed demonstrations with context.
2. **Notice** — after 2–3 similar demonstrations it proposes a playbook.
3. **Edit** — you refine the playbook visually (trigger, steps, parameters, checkpoints).
4. **Prove** — backtest against your history; your corrections become regression tests.
5. **Trust** — shadow mode → draft → act-with-undo → auto. Autonomy is earned and can be lost.
6. **Scale** — scheduled runs, Slack digest, approve from Claude/ChatGPT, export the skill to any agent.

## Pitch lines

- "Every agent waits for instructions. Apprentice learns by watching you."
- "Hermes-style agents learn skills from what *they* do. Apprentice learns skills from what *you* do — then proves them before trusting them."
- "Your corrections become tests."
- "Teach once in Apprentice, use it in any agent."

## Rubric mapping

| Criterion (weight) | How Apprentice scores |
|---|---|
| Usefulness & Execution (40%) | Real queue work; measurable time saved; complete loop from teaching to autonomous runs with undo |
| Creativity & Design (20%) | Ghost autocomplete, color-coded playbook editor, trust ladder, split-view shadow review, backtest slider |
| Innovation (20%) | Inverts the human–agent flow: the human teaches by doing; autonomy is earned from evidence and tests |
| Use of Agent-Native (20%) | Actions as demonstrations, audit log, recorder, `needsApproval` as the trust ladder, evals, generative UI, skills, automations, messaging, MCP server + MCP Apps, voice, sub-agents |

## Non-goals

- Apprentice does not write to GitHub (local mirror only).
- Apprentice is not a general workflow builder; playbooks are learned from demonstrations first.
- No screen-recording-based learning; learning is from typed actions.
