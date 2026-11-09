import type { IssueSnapshot } from "./types.js";

/**
 * Registry of the triage (domain) actions the engine knows how to learn,
 * replay and undo. The real `defineAction`s live in `actions/`; this is the
 * pure description of what each one does to an issue.
 */
export const DOMAIN_ACTIONS = [
  "label-issue",
  "set-priority",
  "set-component",
  "assign-issue",
  "comment-on-issue",
  "request-repro",
  "mark-duplicate",
  "close-issue",
  "reopen-issue",
] as const;

export type DomainActionName = (typeof DOMAIN_ACTIONS)[number];

export const DESTRUCTIVE_ACTIONS: ReadonlySet<string> = new Set(["close-issue", "mark-duplicate"]);

/** Free-text params: never "fixed" when they differ, always written by the agent. */
export const FREE_TEXT_PARAMS: ReadonlySet<string> = new Set(["body", "message", "comment", "note"]);

/** Params an action can run without (it falls back to a template), so a human can apply a decision before the agent wrote them. */
export const OPTIONAL_PARAMS: Record<string, ReadonlySet<string>> = {
  "request-repro": new Set(["message"]),
};

export const MISSING_ITEMS = ["version", "steps", "logs", "environment"] as const;
export type MissingItem = (typeof MISSING_ITEMS)[number];

const MISSING_TEXT: Record<MissingItem, string> = {
  version: "the `@agent-native/core` version (`pnpm list @agent-native/core`)",
  steps: "the steps to reproduce, starting from a fresh template",
  logs: "the full error output or logs",
  environment: "your environment (OS, Node version, browser)",
};

export function isDomainAction(name: string): name is DomainActionName {
  return (DOMAIN_ACTIONS as readonly string[]).includes(name);
}

export function reproTemplate(author: string, missing: readonly string[]): string {
  const items = missing
    .filter((m): m is MissingItem => (MISSING_ITEMS as readonly string[]).includes(m))
    .map((m) => `- ${MISSING_TEXT[m]}`);
  return [`Thanks for the report, @${author}! To look into this we need a bit more:`, ...items, "We'll pick it up as soon as we have these."].join("\n");
}

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

export function applyLabelDiff(labels: string[], add: readonly string[], remove: readonly string[]): string[] {
  const removeSet = new Set(remove);
  return uniq([...labels.filter((l) => !removeSet.has(l)), ...add]);
}

export type ApplyContext = { author: string; duplicateOfNumber?: number | null };

export type ApplyResult = { next: IssueSnapshot; comment: string | null };

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Apply one domain action to an issue snapshot. Pure; mirrors what the real action writes. */
export function applyAction(snapshot: IssueSnapshot, action: string, args: Record<string, unknown>, ctx: ApplyContext): ApplyResult {
  const next: IssueSnapshot = { ...snapshot, labels: [...snapshot.labels] };
  switch (action) {
    case "label-issue":
      next.labels = applyLabelDiff(next.labels, strArray(args.add), strArray(args.remove));
      return { next, comment: null };
    case "set-priority":
      next.priority = str(args.priority);
      return { next, comment: null };
    case "set-component":
      next.component = str(args.component);
      return { next, comment: null };
    case "assign-issue":
      next.assignee = str(args.assignee);
      return { next, comment: null };
    case "comment-on-issue":
      return { next, comment: str(args.body) };
    case "request-repro": {
      next.labels = applyLabelDiff(next.labels, ["needs-info"], []);
      const message = str(args.message) ?? reproTemplate(ctx.author, strArray(args.missing));
      return { next, comment: message };
    }
    case "mark-duplicate": {
      const target = str(args.duplicateOfId);
      next.labels = applyLabelDiff(next.labels, ["duplicate"], []);
      next.state = "closed";
      next.closeReason = "duplicate";
      next.duplicateOf = target;
      const ref = ctx.duplicateOfNumber ? `#${ctx.duplicateOfNumber}` : (target ?? "another issue");
      return { next, comment: `Closing as a duplicate of ${ref}. Please follow that issue for updates.` };
    }
    case "close-issue":
      next.state = "closed";
      next.closeReason = str(args.reason) ?? "completed";
      return { next, comment: null };
    case "reopen-issue":
      next.state = "open";
      next.closeReason = null;
      next.duplicateOf = null;
      return { next, comment: null };
    default:
      throw new Error(`Unknown domain action: ${action}`);
  }
}

/** Short human label for a step, e.g. "Label +bug +needs-info". */
export function describeStep(action: string, args: Record<string, unknown>): string {
  switch (action) {
    case "label-issue": {
      const add = strArray(args.add).map((l) => `+${l}`);
      const remove = strArray(args.remove).map((l) => `−${l}`);
      return `Label ${[...add, ...remove].join(" ") || "(no change)"}`;
    }
    case "set-priority":
      return `Priority ${str(args.priority) ?? "none"}`;
    case "set-component":
      return `Component ${str(args.component) ?? "none"}`;
    case "assign-issue":
      return `Assign ${str(args.assignee) ?? "nobody"}`;
    case "comment-on-issue":
      return "Comment";
    case "request-repro":
      return `Request repro (${strArray(args.missing).join(", ") || "details"})`;
    case "mark-duplicate":
      return "Mark duplicate";
    case "close-issue":
      return `Close as ${str(args.reason) ?? "completed"}`;
    case "reopen-issue":
      return "Reopen";
    default:
      return action;
  }
}
