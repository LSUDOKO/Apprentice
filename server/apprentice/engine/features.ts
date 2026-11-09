import type { IssueFeatures, IssueKind, IssueSnapshot } from "./types.js";

/** Keyword maps shared by feature derivation, tests and the "why did this match?" UI. */
export const FEATURE_KEYWORDS = {
  bug: [
    "crash",
    "crashes",
    "error",
    "broken",
    "breaks",
    "fails",
    "failing",
    "bug",
    "doesn't work",
    "does not work",
    "not working",
    "exception",
    "regression",
    "hangs",
    "freezes",
    "wrong",
    "blank",
    "stuck",
    "does nothing",
    "stopped",
    "stop working",
    "disappear",
    "returns nothing",
    "never",
    "loop",
    "twice",
    "unresponsive",
    "empty",
    "flicker",
    "used to work",
    "worked before",
    "doesn't start",
    "silently",
    "doesn't update",
    "halfway",
    "can't",
    "ignores",
    "drops",
    "stale",
    "missing",
    "unreadable",
  ],
  feature: ["feature request", "would be nice", "support for", "add a way", "proposal", "allow ", "could we", "please add"],
  question: ["how do i", "how to", "is it possible", "question", "can i", "what is the best way"],
  docs: ["docs", "documentation", "typo", "readme", "guide", "tutorial"],
  components: {
    core: ["action", "defineaction", "drizzle", "database", "db", "sync", "runtime", "server", "pglite", "postgres"],
    templates: ["template", "chat template", "mail template", "scaffold"],
    cli: ["cli", "pnpm dev", "agent-native dev", "command", "npx", "create"],
    docs: ["docs", "documentation", "readme", "typo"],
    ui: ["sidebar", "button", "css", "tailwind", "component", "dark mode", "layout", "render"],
  } as Record<string, string[]>,
  spam: ["casino", "crypto giveaway", "buy followers", "seo services", "cheap", "discount", "click here", "free money", "loan"],
} as const;

const VERSION_RE = /(?:@agent-native\/core\s*@?|version\s*[:=]?\s*|\bv)(\d+\.\d+(?:\.\d+)?)/i;
const BARE_VERSION_RE = /\b(\d+\.\d+\.\d+)\b/;
const STACK_TRACE_RE = /(\bat .+\(.+:\d+:\d+\))|Traceback \(most recent call last\)|Error: .+\n\s+at /;
const CODE_BLOCK_RE = /```[\s\S]*?```/;
const NUMBERED_LIST_RE = /(^|\n)\s*1[.)]\s+.+\n\s*2[.)]\s+/;
const LINK_RE = /https?:\/\/\S+/g;

function includesAny(text: string, words: readonly string[]): boolean {
  return words.some((w) => text.includes(w));
}

export function detectVersion(text: string): string | null {
  const m = VERSION_RE.exec(text) ?? BARE_VERSION_RE.exec(text);
  return m?.[1] ?? null;
}

export function detectRepro(body: string): boolean {
  const text = body.toLowerCase();
  if (text.includes("steps to reproduce") || text.includes("repro steps") || text.includes("to reproduce:")) return true;
  if (NUMBERED_LIST_RE.test(body) && (text.includes("expected") || text.includes("actual"))) return true;
  if (CODE_BLOCK_RE.test(body) && /\brun\b/.test(text) && (text.includes("expected") || text.includes("actual"))) return true;
  return false;
}

export function detectStackTrace(body: string): boolean {
  return STACK_TRACE_RE.test(body);
}

export function detectSpam(title: string, body: string): boolean {
  const text = `${title}\n${body}`.toLowerCase();
  const links = body.match(LINK_RE)?.length ?? 0;
  const hasCode = CODE_BLOCK_RE.test(body);
  return (links >= 3 && !hasCode) || (includesAny(text, FEATURE_KEYWORDS.spam) && !hasCode);
}

export function detectComponent(text: string): string | null {
  const lower = text.toLowerCase();
  let best: string | null = null;
  let bestHits = 0;
  for (const [component, words] of Object.entries(FEATURE_KEYWORDS.components)) {
    const hits = words.filter((w) => lower.includes(w)).length;
    if (hits > bestHits) {
      best = component;
      bestHits = hits;
    }
  }
  return best;
}

export function detectKind(title: string, body: string, labels: string[]): IssueKind {
  if (labels.includes("bug")) return "bug";
  if (labels.includes("feature")) return "feature";
  if (labels.includes("docs")) return "docs";
  if (labels.includes("question")) return "question";
  const t = title.toLowerCase();
  const all = `${t}\n${body.toLowerCase()}`;
  if (includesAny(t, FEATURE_KEYWORDS.docs)) return "docs";
  if (includesAny(t, FEATURE_KEYWORDS.feature)) return "feature";
  if (includesAny(t, FEATURE_KEYWORDS.question)) return "question";
  if (includesAny(all, FEATURE_KEYWORDS.bug)) return "bug";
  if (includesAny(all, FEATURE_KEYWORDS.feature)) return "feature";
  return "other";
}

export type FeatureInput = IssueSnapshot & {
  title: string;
  body: string;
  authorIsFirstTime: boolean;
};

/** Derive the deterministic issue features. Called on every issue write. */
export function deriveFeatures(issue: FeatureInput): IssueFeatures {
  const text = `${issue.title}\n${issue.body}`;
  const lower = text.toLowerCase();
  const versionMentioned = detectVersion(text);
  return {
    kind: detectKind(issue.title, issue.body, issue.labels),
    labels: [...issue.labels].sort(),
    hasVersion: versionMentioned !== null,
    versionMentioned,
    hasRepro: detectRepro(issue.body),
    hasStackTrace: detectStackTrace(issue.body),
    hasCodeBlock: CODE_BLOCK_RE.test(issue.body),
    bodyLength: issue.body.length,
    titleLength: issue.title.length,
    mentionsDocs: includesAny(lower, FEATURE_KEYWORDS.docs),
    mentionsComponent: detectComponent(text),
    isLikelySpam: detectSpam(issue.title, issue.body),
    priority: issue.priority,
    component: issue.component,
    assignee: issue.assignee,
    state: issue.state,
    authorIsFirstTime: issue.authorIsFirstTime,
  };
}

/** Human labels for feature fields, shared with the UI. */
export const FEATURE_LABELS: Record<keyof IssueFeatures, string> = {
  kind: "kind",
  labels: "labels",
  hasVersion: "has a version",
  versionMentioned: "version mentioned",
  hasRepro: "has repro steps",
  hasStackTrace: "has a stack trace",
  hasCodeBlock: "has a code block",
  bodyLength: "body length",
  titleLength: "title length",
  mentionsDocs: "mentions docs",
  mentionsComponent: "mentions component",
  isLikelySpam: "looks like spam",
  priority: "priority",
  component: "component",
  assignee: "assignee",
  state: "state",
  authorIsFirstTime: "first-time author",
};
