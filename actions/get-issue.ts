import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { listDecisionRows } from "../server/apprentice/services/executor.js";
import { listActivity, listComments, requireIssue } from "../server/apprentice/services/issues.js";
import { getDb } from "../server/db/index.js";

export default defineAction({
  description: "Read one issue with its body, derived features, comments, activity timeline (human vs agent) and Apprentice's latest decision on it.",
  schema: z.object({ issueId: z.string().min(1).describe("Issue id, e.g. seed-031") }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ issueId }, ctx) => {
    const scope = requireScope(ctx);
    const issue = await requireIssue(getDb(), scope, issueId);
    const [comments, activity, decisions] = await Promise.all([
      listComments(scope, issueId),
      listActivity(scope, issueId),
      listDecisionRows(scope, { issueId, limit: 5 }),
    ]);
    const latest = decisions[0];
    return {
      issue: {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        author: issue.author,
        source: issue.source,
        repo: issue.repo,
        state: issue.state,
        closeReason: issue.closeReason,
        duplicateOf: issue.duplicateOf,
        labels: issue.labels,
        priority: issue.priority,
        component: issue.component,
        assignee: issue.assignee,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        features: issue.features,
      },
      comments: comments.map((c) => ({ id: c.id, author: c.author, body: c.body, byAgent: c.byAgent === 1, retracted: c.retracted === 1, createdAt: c.createdAt })),
      activity: activity.map((a) => ({
        id: a.id,
        actorEmail: a.actorEmail,
        actorKind: a.actorKind,
        action: a.action,
        summary: a.summary,
        decisionId: a.decisionId,
        runId: a.runId,
        demonstration: a.demonstration === 1,
        createdAt: a.createdAt,
      })),
      latestDecision: latest
        ? { id: latest.id, runId: latest.runId, playbookId: latest.playbookId, status: latest.status, verdict: latest.verdict, confidence: latest.confidence }
        : null,
    };
  },
});
