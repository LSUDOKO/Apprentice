import type { MigrationEntry } from "@agent-native/core/db";

/** Additive migrations for the Apprentice tables. Never edit an applied entry; append a new one. */
export const APPRENTICE_MIGRATIONS: MigrationEntry[] = [
  {
    version: 1,
    name: "apprentice-core",
    sql: `CREATE TABLE IF NOT EXISTS issues (
id TEXT NOT NULL,
source TEXT NOT NULL CHECK (source IN ('seed', 'github', 'app')),
repo TEXT NOT NULL,
number INTEGER NOT NULL,
title TEXT NOT NULL,
body TEXT NOT NULL,
author TEXT NOT NULL,
state TEXT NOT NULL CHECK (state IN ('open', 'closed')),
close_reason TEXT,
duplicate_of TEXT,
labels JSONB NOT NULL DEFAULT '[]',
priority TEXT,
component TEXT,
assignee TEXT,
author_is_first_time INTEGER NOT NULL DEFAULT 0,
features JSONB NOT NULL,
created_at BIGINT NOT NULL,
updated_at BIGINT NOT NULL,
owner_email TEXT NOT NULL,
org_id TEXT,
PRIMARY KEY (owner_email, id)
);
CREATE INDEX IF NOT EXISTS issues_owner_state_updated_idx ON issues (owner_email, state, updated_at);
CREATE TABLE IF NOT EXISTS issue_comments (
id TEXT PRIMARY KEY,
issue_id TEXT NOT NULL,
author TEXT NOT NULL,
body TEXT NOT NULL,
by_agent INTEGER NOT NULL DEFAULT 0,
run_id TEXT,
retracted INTEGER NOT NULL DEFAULT 0,
created_at BIGINT NOT NULL,
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE INDEX IF NOT EXISTS issue_comments_owner_issue_idx ON issue_comments (owner_email, issue_id);
CREATE TABLE IF NOT EXISTS activity (
id TEXT PRIMARY KEY,
issue_id TEXT NOT NULL,
actor_email TEXT NOT NULL,
actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human', 'agent', 'automation')),
action TEXT NOT NULL,
summary TEXT NOT NULL,
decision_id TEXT,
run_id TEXT,
demonstration INTEGER NOT NULL DEFAULT 0,
created_at BIGINT NOT NULL,
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE INDEX IF NOT EXISTS activity_owner_issue_idx ON activity (owner_email, issue_id, created_at);
CREATE TABLE IF NOT EXISTS episodes (
id TEXT PRIMARY KEY,
issue_id TEXT NOT NULL,
actor_email TEXT NOT NULL,
actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human', 'agent')),
source TEXT NOT NULL CHECK (source IN ('watch', 'lesson', 'seed')),
status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
steps JSONB NOT NULL DEFAULT '[]',
context_start JSONB NOT NULL,
context JSONB,
signature TEXT,
narration TEXT,
lesson_id TEXT,
started_at BIGINT NOT NULL,
ended_at BIGINT,
last_step_at BIGINT NOT NULL,
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE INDEX IF NOT EXISTS episodes_owner_status_issue_idx ON episodes (owner_email, status, issue_id);
CREATE INDEX IF NOT EXISTS episodes_signature_idx ON episodes (signature);
CREATE TABLE IF NOT EXISTS pattern_candidates (
id TEXT PRIMARY KEY,
signature TEXT NOT NULL,
status TEXT NOT NULL CHECK (status IN ('new', 'accepted', 'dismissed', 'conflict')),
actor_email TEXT NOT NULL,
episode_ids JSONB NOT NULL DEFAULT '[]',
trigger JSONB NOT NULL,
steps JSONB NOT NULL,
support INTEGER NOT NULL,
weak_trigger INTEGER NOT NULL DEFAULT 0,
conflict_with JSONB,
suggested_name TEXT NOT NULL,
playbook_id TEXT,
created_at BIGINT NOT NULL,
updated_at BIGINT NOT NULL,
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE INDEX IF NOT EXISTS pattern_candidates_owner_status_idx ON pattern_candidates (owner_email, status);
CREATE TABLE IF NOT EXISTS lessons (
id TEXT PRIMARY KEY,
status TEXT NOT NULL CHECK (status IN ('recording', 'done', 'cancelled')),
started_at BIGINT NOT NULL,
ended_at BIGINT,
recorder_report JSONB,
narration TEXT,
episode_ids JSONB NOT NULL DEFAULT '[]',
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE TABLE IF NOT EXISTS suggestion_events (
id TEXT PRIMARY KEY,
issue_id TEXT NOT NULL,
source_id TEXT NOT NULL,
step_index INTEGER NOT NULL,
action TEXT NOT NULL,
outcome TEXT NOT NULL CHECK (outcome IN ('accepted', 'dismissed')),
created_at BIGINT NOT NULL,
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE TABLE IF NOT EXISTS playbooks (
id TEXT PRIMARY KEY,
name TEXT NOT NULL,
description TEXT NOT NULL,
status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'archived')),
trust_level INTEGER NOT NULL CHECK (trust_level BETWEEN 0 AND 4),
trigger JSONB NOT NULL,
steps JSONB NOT NULL,
version INTEGER NOT NULL,
signature TEXT NOT NULL,
source_episode_ids JSONB NOT NULL DEFAULT '[]',
skill_markdown TEXT NOT NULL,
stats JSONB NOT NULL,
visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'org')),
demotion_reason TEXT,
created_by TEXT NOT NULL,
created_at BIGINT NOT NULL,
updated_at BIGINT NOT NULL,
last_promoted_at BIGINT,
last_demoted_at BIGINT,
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE INDEX IF NOT EXISTS playbooks_owner_status_idx ON playbooks (owner_email, status);
CREATE TABLE IF NOT EXISTS playbook_versions (
id TEXT PRIMARY KEY,
playbook_id TEXT NOT NULL,
version INTEGER NOT NULL,
snapshot JSONB NOT NULL,
change_note TEXT NOT NULL,
created_by TEXT NOT NULL,
created_at BIGINT NOT NULL,
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE INDEX IF NOT EXISTS playbook_versions_playbook_idx ON playbook_versions (owner_email, playbook_id);
CREATE TABLE IF NOT EXISTS runs (
id TEXT PRIMARY KEY,
playbook_id TEXT NOT NULL,
playbook_version INTEGER NOT NULL,
mode TEXT NOT NULL CHECK (mode IN ('shadow', 'draft', 'act', 'auto')),
trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'schedule', 'mcp', 'chat', 'ghost')),
status TEXT NOT NULL CHECK (status IN ('running', 'awaiting_judgment', 'done', 'undone', 'failed')),
item_count INTEGER NOT NULL,
summary JSONB NOT NULL,
started_at BIGINT NOT NULL,
finished_at BIGINT,
created_by TEXT NOT NULL,
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE INDEX IF NOT EXISTS runs_owner_playbook_idx ON runs (owner_email, playbook_id, started_at);
CREATE TABLE IF NOT EXISTS decisions (
id TEXT PRIMARY KEY,
run_id TEXT NOT NULL,
playbook_id TEXT NOT NULL,
issue_id TEXT NOT NULL,
playbook_version INTEGER NOT NULL,
issue_view JSONB NOT NULL,
proposed_steps JSONB NOT NULL,
needs_judgment INTEGER NOT NULL DEFAULT 0,
judgment JSONB,
confidence INTEGER NOT NULL,
explanation TEXT NOT NULL,
status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'edited', 'overridden', 'skipped', 'executing', 'executed', 'undone', 'failed')),
verdict TEXT CHECK (verdict IN ('approved', 'edited', 'overridden', 'skipped')),
human_steps JSONB,
reviewer TEXT,
review_note TEXT,
reviewed_at BIGINT,
executed_at BIGINT,
created_at BIGINT NOT NULL,
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE INDEX IF NOT EXISTS decisions_run_idx ON decisions (run_id);
CREATE INDEX IF NOT EXISTS decisions_playbook_status_idx ON decisions (playbook_id, status);
CREATE INDEX IF NOT EXISTS decisions_issue_idx ON decisions (issue_id);
CREATE TABLE IF NOT EXISTS step_executions (
id TEXT PRIMARY KEY,
decision_id TEXT NOT NULL,
run_id TEXT NOT NULL,
issue_id TEXT NOT NULL,
step_id TEXT NOT NULL,
action TEXT NOT NULL,
args JSONB NOT NULL,
before JSONB NOT NULL,
after JSONB NOT NULL,
created_comment_id TEXT,
status TEXT NOT NULL CHECK (status IN ('done', 'undone', 'failed')),
error TEXT,
executed_at BIGINT NOT NULL,
undone_at BIGINT,
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE INDEX IF NOT EXISTS step_executions_run_idx ON step_executions (run_id);
CREATE TABLE IF NOT EXISTS playbook_tests (
id TEXT PRIMARY KEY,
playbook_id TEXT NOT NULL,
number INTEGER NOT NULL,
origin TEXT NOT NULL CHECK (origin IN ('override', 'edit', 'manual', 'seed')),
source_decision_id TEXT,
issue_snapshot JSONB NOT NULL,
expected JSONB NOT NULL,
last_result TEXT CHECK (last_result IN ('pass', 'fail')),
last_diff JSONB,
last_run_at BIGINT,
created_at BIGINT NOT NULL,
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE INDEX IF NOT EXISTS playbook_tests_playbook_idx ON playbook_tests (owner_email, playbook_id);
CREATE TABLE IF NOT EXISTS digests (
id TEXT PRIMARY KEY,
period_start BIGINT NOT NULL,
period_end BIGINT NOT NULL,
body TEXT NOT NULL,
stats JSONB NOT NULL,
delivered_to JSONB NOT NULL DEFAULT '[]',
created_at BIGINT NOT NULL,
owner_email TEXT NOT NULL,
org_id TEXT
);
CREATE TABLE IF NOT EXISTS apprentice_settings (
owner_email TEXT PRIMARY KEY,
org_id TEXT,
watch_mode INTEGER NOT NULL DEFAULT 1,
min_support INTEGER NOT NULL DEFAULT 2,
demo_mode INTEGER NOT NULL DEFAULT 1,
github_repo TEXT,
updated_at BIGINT NOT NULL
)`,
  },
];
