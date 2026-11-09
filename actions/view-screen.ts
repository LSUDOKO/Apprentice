import { defineAction } from "@agent-native/core/action";
import { readAppState } from "@agent-native/core/application-state";
import { z } from "zod";

import { describeTrigger } from "../server/apprentice/engine/triggers.js";
import { predictForIssue } from "../server/apprentice/services/assist.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { listDecisionRows } from "../server/apprentice/services/executor.js";
import { listComments, loadIssue } from "../server/apprentice/services/issues.js";
import { activeLesson } from "../server/apprentice/services/lessons.js";
import { listCandidates } from "../server/apprentice/services/patterns.js";
import { getEligibility, loadPlaybook } from "../server/apprentice/services/playbooks.js";
import { getSettings } from "../server/apprentice/services/settings.js";
import { getDb } from "../server/db/index.js";

type Nav = { view?: string; path?: string; issueId?: string; playbookId?: string; runId?: string; decisionId?: string; tab?: string; compare?: string[] };

export default defineAction({
  description:
    "See what the user is looking at right now: the open issue (with features, recent comments and the ghost suggestion), playbook, review run and focused decision, selection, pattern candidates, active lesson and watch mode. Call before acting on 'this', 'here' or 'these'.",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async (_args, ctx) => {
    const scope = requireScope(ctx);
    const [navigation, selection, url] = await Promise.all([readAppState("navigation"), readAppState("selection"), readAppState("__url__")]);
    const nav = (navigation ?? {}) as Nav;
    const screen: Record<string, unknown> = { navigation, url, selection };
    if (nav.issueId) {
      const issue = await loadIssue(getDb(), scope, nav.issueId);
      if (issue) {
        const comments = await listComments(scope, issue.id);
        screen.issue = {
          id: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body.slice(0, 2000),
          author: issue.author,
          state: issue.state,
          labels: issue.labels,
          priority: issue.priority,
          component: issue.component,
          assignee: issue.assignee,
          features: issue.features,
          comments: comments.filter((c) => !c.retracted).slice(-5).map((c) => ({ author: c.author, body: c.body.slice(0, 500) })),
        };
        screen.ghostSuggestion = await predictForIssue(scope, issue.id);
      }
    }
    if (nav.playbookId) {
      const pb = await loadPlaybook(scope, nav.playbookId);
      if (pb) {
        screen.playbook = {
          id: pb.id,
          name: pb.name,
          status: pb.status,
          trustLevel: pb.trustLevel,
          version: pb.version,
          trigger: pb.trigger,
          triggerText: describeTrigger(pb.trigger),
          steps: pb.steps,
          stats: pb.stats,
          eligibility: await getEligibility(scope, pb),
          tab: nav.tab ?? "recipe",
        };
      }
    }
    if (nav.view === "review") {
      const decisions = await listDecisionRows(scope, { ...(nav.runId ? { runId: nav.runId } : { status: "pending" as const }), limit: 50 });
      const focused = decisions.find((d) => d.id === nav.decisionId) ?? decisions.find((d) => d.status === "pending");
      screen.run = { runId: nav.runId ?? focused?.runId ?? null, pending: decisions.filter((d) => d.status === "pending").length, total: decisions.length };
      if (focused) {
        screen.focusedDecision = {
          id: focused.id,
          issueId: focused.issueId,
          number: focused.issueView.number,
          title: focused.issueView.title,
          status: focused.status,
          confidence: focused.confidence,
          explanation: focused.explanation,
          steps: focused.proposedSteps.map((s) => ({ stepId: s.stepId, action: s.action, args: s.args, pendingAgentParams: s.pendingAgentParams })),
        };
      }
    }
    const [candidates, lesson, settings] = await Promise.all([listCandidates(scope), activeLesson(scope), getSettings(scope)]);
    screen.patternCandidates = candidates.map((c) => ({ id: c.id, name: c.suggestedName, status: c.status, support: c.support, triggerText: describeTrigger(c.trigger) }));
    screen.lesson = lesson ? { id: lesson.id, startedAt: lesson.startedAt } : null;
    screen.watchMode = settings.watchMode ? "on" : "off";
    return screen;
  },
});
