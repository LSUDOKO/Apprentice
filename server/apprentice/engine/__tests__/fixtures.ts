import { deriveFeatures } from "../features.js";
import { computeSignature } from "../signature.js";
import type { EpisodeLike, IssueSnapshot, ItemView, Step } from "../types.js";

const EMPTY: IssueSnapshot = { labels: [], priority: null, component: null, assignee: null, state: "open", closeReason: null, duplicateOf: null };

export function item(n: number, title: string, body: string, snap: Partial<IssueSnapshot> = {}, author = `user${n}`): ItemView {
  const s = { ...EMPTY, ...snap };
  return { ...s, id: `i${n}`, number: n, title, body, author, features: deriveFeatures({ ...s, title, body, authorIsFirstTime: false }) };
}

export const NEEDS_INFO = (author: string): Step[] => [
  { action: "label-issue", args: { add: ["bug", "needs-info"], remove: [] }, at: 1 },
  { action: "request-repro", args: { missing: ["version", "steps"], message: `Thanks @${author}, which version?` }, at: 2 },
  { action: "assign-issue", args: { assignee: "triage" }, at: 3 },
];

export function episode(id: string, view: ItemView, steps: Step[], opts: Partial<EpisodeLike> = {}): EpisodeLike {
  return {
    id,
    issueId: view.id,
    actorEmail: "me@x.dev",
    source: "watch",
    status: "closed",
    steps,
    contextStart: view,
    signature: computeSignature(steps),
    startedAt: 0,
    endedAt: 60_000,
    ...opts,
  };
}

export const unversionedBug = (n: number) => item(n, `App crashes on start ${n}`, "It just crashes. No idea why.");
export const versionedBug = (n: number) =>
  item(n, `Action fails ${n}`, "@agent-native/core 0.12.3\n\nSteps to reproduce:\n1. run it\n2. click\n\nExpected: ok\nActual: error");
export const docsIssue = (n: number) => item(n, `Typo in the docs ${n}`, "The docs page has a typo.");
