import { bigint, index, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

import type {
  ConflictInfo,
} from "../apprentice/engine/patterns.js";
import type {
  ExpectedStep,
  IssueFeatures,
  IssueSnapshot,
  ItemView,
  PlaybookStats,
  ResolvedStep,
  Step,
  StepSpec,
  TestExpectation,
  TriggerSpec,
} from "../apprentice/engine/types.js";

/**
 * Apprentice tables. Every row is private to its owner (`owner_email`) and
 * carries `org_id` for tenant scoping. Timestamps are epoch milliseconds.
 */
const ms = (name: string) => bigint(name, { mode: "number" });

export const issues = pgTable(
  "issues",
  {
    id: text("id").notNull(),
    source: text("source", { enum: ["seed", "github", "app"] }).notNull(),
    repo: text("repo").notNull(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    author: text("author").notNull(),
    state: text("state", { enum: ["open", "closed"] }).notNull(),
    closeReason: text("close_reason"),
    duplicateOf: text("duplicate_of"),
    labels: jsonb("labels").$type<string[]>().notNull(),
    priority: text("priority"),
    component: text("component"),
    assignee: text("assignee"),
    authorIsFirstTime: integer("author_is_first_time").notNull().default(0),
    features: jsonb("features").$type<IssueFeatures>().notNull(),
    createdAt: ms("created_at").notNull(),
    updatedAt: ms("updated_at").notNull(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
  },
  (t) => [
    primaryKey({ columns: [t.ownerEmail, t.id] }),
    index("issues_owner_state_updated_idx").on(t.ownerEmail, t.state, t.updatedAt),
  ],
);

export const issueComments = pgTable(
  "issue_comments",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id").notNull(),
    author: text("author").notNull(),
    body: text("body").notNull(),
    byAgent: integer("by_agent").notNull().default(0),
    runId: text("run_id"),
    retracted: integer("retracted").notNull().default(0),
    createdAt: ms("created_at").notNull(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
  },
  (t) => [index("issue_comments_owner_issue_idx").on(t.ownerEmail, t.issueId)],
);

export const activity = pgTable(
  "activity",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    actorKind: text("actor_kind", { enum: ["human", "agent", "automation"] }).notNull(),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    decisionId: text("decision_id"),
    runId: text("run_id"),
    demonstration: integer("demonstration").notNull().default(0),
    createdAt: ms("created_at").notNull(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
  },
  (t) => [index("activity_owner_issue_idx").on(t.ownerEmail, t.issueId, t.createdAt)],
);

export const episodes = pgTable(
  "episodes",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    actorKind: text("actor_kind", { enum: ["human", "agent"] }).notNull(),
    source: text("source", { enum: ["watch", "lesson", "seed"] }).notNull(),
    status: text("status", { enum: ["open", "closed"] }).notNull(),
    steps: jsonb("steps").$type<Step[]>().notNull(),
    contextStart: jsonb("context_start").$type<ItemView>().notNull(),
    context: jsonb("context").$type<Record<string, unknown>>(),
    signature: text("signature"),
    narration: text("narration"),
    lessonId: text("lesson_id"),
    startedAt: ms("started_at").notNull(),
    endedAt: ms("ended_at"),
    lastStepAt: ms("last_step_at").notNull(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
  },
  (t) => [
    index("episodes_owner_status_issue_idx").on(t.ownerEmail, t.status, t.issueId),
    index("episodes_signature_idx").on(t.signature),
  ],
);

export const patternCandidates = pgTable(
  "pattern_candidates",
  {
    id: text("id").primaryKey(),
    signature: text("signature").notNull(),
    status: text("status", { enum: ["new", "accepted", "dismissed", "conflict"] }).notNull(),
    actorEmail: text("actor_email").notNull(),
    episodeIds: jsonb("episode_ids").$type<string[]>().notNull(),
    trigger: jsonb("trigger").$type<TriggerSpec>().notNull(),
    steps: jsonb("steps").$type<StepSpec[]>().notNull(),
    support: integer("support").notNull(),
    weakTrigger: integer("weak_trigger").notNull().default(0),
    conflictWith: jsonb("conflict_with").$type<ConflictInfo[] | null>(),
    suggestedName: text("suggested_name").notNull(),
    playbookId: text("playbook_id"),
    createdAt: ms("created_at").notNull(),
    updatedAt: ms("updated_at").notNull(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
  },
  (t) => [index("pattern_candidates_owner_status_idx").on(t.ownerEmail, t.status)],
);

export const lessons = pgTable("lessons", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["recording", "done", "cancelled"] }).notNull(),
  startedAt: ms("started_at").notNull(),
  endedAt: ms("ended_at"),
  recorderReport: jsonb("recorder_report").$type<Record<string, unknown> | null>(),
  narration: text("narration"),
  episodeIds: jsonb("episode_ids").$type<string[]>().notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

export const suggestionEvents = pgTable("suggestion_events", {
  id: text("id").primaryKey(),
  issueId: text("issue_id").notNull(),
  sourceId: text("source_id").notNull(),
  stepIndex: integer("step_index").notNull(),
  action: text("action").notNull(),
  outcome: text("outcome", { enum: ["accepted", "dismissed"] }).notNull(),
  createdAt: ms("created_at").notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

export const playbooks = pgTable(
  "playbooks",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    status: text("status", { enum: ["draft", "active", "paused", "archived"] }).notNull(),
    trustLevel: integer("trust_level").notNull(),
    trigger: jsonb("trigger").$type<TriggerSpec>().notNull(),
    steps: jsonb("steps").$type<StepSpec[]>().notNull(),
    version: integer("version").notNull(),
    signature: text("signature").notNull(),
    sourceEpisodeIds: jsonb("source_episode_ids").$type<string[]>().notNull(),
    skillMarkdown: text("skill_markdown").notNull(),
    stats: jsonb("stats").$type<PlaybookStats>().notNull(),
    visibility: text("visibility", { enum: ["private", "org"] }).notNull().default("private"),
    demotionReason: text("demotion_reason"),
    createdBy: text("created_by").notNull(),
    createdAt: ms("created_at").notNull(),
    updatedAt: ms("updated_at").notNull(),
    lastPromotedAt: ms("last_promoted_at"),
    lastDemotedAt: ms("last_demoted_at"),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
  },
  (t) => [index("playbooks_owner_status_idx").on(t.ownerEmail, t.status)],
);

export const playbookVersions = pgTable(
  "playbook_versions",
  {
    id: text("id").primaryKey(),
    playbookId: text("playbook_id").notNull(),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").$type<{ name: string; description: string; trigger: TriggerSpec; steps: StepSpec[]; trustLevel: number; status: string }>().notNull(),
    changeNote: text("change_note").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: ms("created_at").notNull(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
  },
  (t) => [index("playbook_versions_playbook_idx").on(t.ownerEmail, t.playbookId)],
);

export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    playbookId: text("playbook_id").notNull(),
    playbookVersion: integer("playbook_version").notNull(),
    mode: text("mode", { enum: ["shadow", "draft", "act", "auto"] }).notNull(),
    trigger: text("trigger", { enum: ["manual", "schedule", "mcp", "chat", "ghost"] }).notNull(),
    status: text("status", { enum: ["running", "awaiting_judgment", "done", "undone", "failed"] }).notNull(),
    itemCount: integer("item_count").notNull(),
    summary: jsonb("summary").$type<Record<string, number>>().notNull(),
    startedAt: ms("started_at").notNull(),
    finishedAt: ms("finished_at"),
    createdBy: text("created_by").notNull(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
  },
  (t) => [index("runs_owner_playbook_idx").on(t.ownerEmail, t.playbookId, t.startedAt)],
);

export const decisions = pgTable(
  "decisions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    playbookId: text("playbook_id").notNull(),
    issueId: text("issue_id").notNull(),
    playbookVersion: integer("playbook_version").notNull(),
    issueView: jsonb("issue_view").$type<ItemView>().notNull(),
    proposedSteps: jsonb("proposed_steps").$type<ResolvedStep[]>().notNull(),
    needsJudgment: integer("needs_judgment").notNull().default(0),
    judgment: jsonb("judgment").$type<{ matches: boolean; reason: string } | null>(),
    confidence: integer("confidence").notNull(),
    explanation: text("explanation").notNull(),
    status: text("status", {
      enum: ["pending", "approved", "edited", "overridden", "skipped", "executing", "executed", "undone", "failed"],
    }).notNull(),
    verdict: text("verdict", { enum: ["approved", "edited", "overridden", "skipped"] }),
    humanSteps: jsonb("human_steps").$type<ExpectedStep[] | null>(),
    reviewer: text("reviewer"),
    reviewNote: text("review_note"),
    reviewedAt: ms("reviewed_at"),
    executedAt: ms("executed_at"),
    createdAt: ms("created_at").notNull(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
  },
  (t) => [
    index("decisions_run_idx").on(t.runId),
    index("decisions_playbook_status_idx").on(t.playbookId, t.status),
    index("decisions_issue_idx").on(t.issueId),
  ],
);

export const stepExecutions = pgTable(
  "step_executions",
  {
    id: text("id").primaryKey(),
    decisionId: text("decision_id").notNull(),
    runId: text("run_id").notNull(),
    issueId: text("issue_id").notNull(),
    stepId: text("step_id").notNull(),
    action: text("action").notNull(),
    args: jsonb("args").$type<Record<string, unknown>>().notNull(),
    before: jsonb("before").$type<IssueSnapshot>().notNull(),
    after: jsonb("after").$type<IssueSnapshot>().notNull(),
    createdCommentId: text("created_comment_id"),
    status: text("status", { enum: ["done", "undone", "failed"] }).notNull(),
    error: text("error"),
    executedAt: ms("executed_at").notNull(),
    undoneAt: ms("undone_at"),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
  },
  (t) => [index("step_executions_run_idx").on(t.runId)],
);

export const playbookTests = pgTable(
  "playbook_tests",
  {
    id: text("id").primaryKey(),
    playbookId: text("playbook_id").notNull(),
    number: integer("number").notNull(),
    origin: text("origin", { enum: ["override", "edit", "manual", "seed"] }).notNull(),
    sourceDecisionId: text("source_decision_id"),
    issueSnapshot: jsonb("issue_snapshot").$type<ItemView>().notNull(),
    expected: jsonb("expected").$type<TestExpectation>().notNull(),
    lastResult: text("last_result", { enum: ["pass", "fail"] }),
    lastDiff: jsonb("last_diff").$type<Record<string, unknown> | null>(),
    lastRunAt: ms("last_run_at"),
    createdAt: ms("created_at").notNull(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id"),
  },
  (t) => [index("playbook_tests_playbook_idx").on(t.ownerEmail, t.playbookId)],
);

export const digests = pgTable("digests", {
  id: text("id").primaryKey(),
  periodStart: ms("period_start").notNull(),
  periodEnd: ms("period_end").notNull(),
  body: text("body").notNull(),
  stats: jsonb("stats").$type<Record<string, number>>().notNull(),
  deliveredTo: jsonb("delivered_to").$type<string[]>().notNull(),
  createdAt: ms("created_at").notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

export const apprenticeSettings = pgTable("apprentice_settings", {
  ownerEmail: text("owner_email").primaryKey(),
  orgId: text("org_id"),
  watchMode: integer("watch_mode").notNull().default(1),
  minSupport: integer("min_support").notNull().default(2),
  demoMode: integer("demo_mode").notNull().default(1),
  githubRepo: text("github_repo"),
  updatedAt: ms("updated_at").notNull(),
});
