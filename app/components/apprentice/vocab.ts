export const LABELS = ["bug", "needs-info", "feature", "docs", "question", "duplicate", "invalid", "p1-crash", "good first issue"] as const;
export const PRIORITIES = ["p0", "p1", "p2", "p3"] as const;
export const COMPONENTS = ["core", "templates", "cli", "docs", "ui"] as const;
export const ASSIGNEES = ["triage", "core-team", "docs-team"] as const;
export const MISSING = ["version", "steps", "logs", "environment"] as const;

export function reproMessage(author: string, missing: readonly string[]): string {
  const text: Record<string, string> = {
    version: "the `@agent-native/core` version (`pnpm list @agent-native/core`)",
    steps: "the steps to reproduce, starting from a fresh template",
    logs: "the full error output or logs",
    environment: "your environment (OS, Node version, browser)",
  };
  return [`Thanks for the report, @${author}! To look into this we need a bit more:`, ...missing.map((m) => `- ${text[m] ?? m}`), "We'll pick it up as soon as we have these."].join("\n");
}
