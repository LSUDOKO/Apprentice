/**
 * Shared types for the Apprentice engine. Everything in `engine/` is pure:
 * no database, framework, or LLM imports, so it can be unit tested in isolation.
 */

export type IssueKind = "bug" | "feature" | "question" | "docs" | "other";

export type IssueFeatures = {
  kind: IssueKind;
  labels: string[];
  hasVersion: boolean;
  versionMentioned: string | null;
  hasRepro: boolean;
  hasStackTrace: boolean;
  hasCodeBlock: boolean;
  bodyLength: number;
  titleLength: number;
  mentionsDocs: boolean;
  mentionsComponent: string | null;
  isLikelySpam: boolean;
  priority: string | null;
  component: string | null;
  assignee: string | null;
  state: string;
  authorIsFirstTime: boolean;
};

/** The mutable triage fields of an issue. Used for before/after snapshots and undo. */
export type IssueSnapshot = {
  labels: string[];
  priority: string | null;
  component: string | null;
  assignee: string | null;
  state: "open" | "closed";
  closeReason: string | null;
  duplicateOf: string | null;
};

/** Everything the engine needs to know about an issue at one moment. */
export type ItemView = IssueSnapshot & {
  id: string;
  number: number;
  title: string;
  body: string;
  author: string;
  features: IssueFeatures;
};

export type Step = {
  action: string;
  args: Record<string, unknown>;
  at: number;
  auditEventId?: string;
  nav?: unknown;
};

export type EpisodeSource = "watch" | "lesson" | "seed";

export type EpisodeLike = {
  id: string;
  issueId: string;
  actorEmail: string;
  source: EpisodeSource;
  status: "open" | "closed";
  steps: Step[];
  /** The issue as it looked when the episode opened (before the first step). */
  contextStart: ItemView;
  signature: string | null;
  startedAt: number;
  endedAt: number | null;
};

export type FeatureField = keyof IssueFeatures;

export type Condition =
  | { field: FeatureField; op: "eq" | "neq"; value: string | number | boolean | null }
  | { field: "labels"; op: "includes" | "excludes"; value: string }
  | { field: "title" | "body"; op: "matches"; value: string }
  | { field: FeatureField; op: "isEmpty" | "isNotEmpty" };

export type TriggerSpec = {
  all: Condition[];
  judgment?: string | null;
};

export type ParamOwner = "fixed" | "fromItem" | "agent";

export type ParamSpec =
  | { owner: "fixed"; value: unknown }
  | { owner: "fromItem"; path: string }
  | { owner: "agent"; instruction: string };

export type StepSpec = {
  id: string;
  action: string;
  params: Record<string, ParamSpec>;
  checkpoint: boolean;
  destructive: boolean;
};

export type ResolvedStep = {
  stepId: string;
  action: string;
  args: Record<string, unknown>;
  owners: Record<string, ParamOwner>;
  checkpoint: boolean;
  destructive: boolean;
  pendingAgentParams: string[];
};

export type PlaybookStats = {
  reviewed: number;
  approved: number;
  overridden: number;
  edited: number;
  rollingAgreement: number;
  executed: number;
  undone: number;
  testsTotal: number;
  testsPassing: number;
  medianHumanMs: number | null;
};

export const EMPTY_STATS: PlaybookStats = {
  reviewed: 0,
  approved: 0,
  overridden: 0,
  edited: 0,
  rollingAgreement: 0,
  executed: 0,
  undone: 0,
  testsTotal: 0,
  testsPassing: 0,
  medianHumanMs: null,
};

export type PlaybookLike = {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "archived";
  trustLevel: number;
  trigger: TriggerSpec;
  steps: StepSpec[];
  version: number;
};

export type ExpectedStep = { action: string; args: Record<string, unknown> };

export type TestExpectation = { applies: boolean; steps: ExpectedStep[] };
