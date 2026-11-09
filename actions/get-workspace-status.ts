import { defineAction } from "@agent-native/core/action";
import { and, eq, gte, ne } from "drizzle-orm";
import { z } from "zod";

import { listExceptions, pendingReviewCount } from "../server/apprentice/services/assist.js";
import { requireScope } from "../server/apprentice/services/core.js";
import { activeLesson } from "../server/apprentice/services/lessons.js";
import { hasIssues } from "../server/apprentice/services/seed.js";
import { getSettings } from "../server/apprentice/services/settings.js";
import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description: "Workspace summary for the app chrome: pending reviews, exceptions, watch/demo mode, demonstrations recorded today, active lesson and recent demotions.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  agentTool: false,
  run: async (_args, ctx) => {
    const scope = requireScope(ctx);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [settings, seeded, pending, exceptions, lesson, today, demoted] = await Promise.all([
      getSettings(scope),
      hasIssues(scope),
      pendingReviewCount(scope),
      listExceptions(scope, 200),
      activeLesson(scope),
      getDb()
        .select({ id: schema.episodes.id })
        .from(schema.episodes)
        .where(and(eq(schema.episodes.ownerEmail, scope.ownerEmail), ne(schema.episodes.source, "seed"), gte(schema.episodes.startedAt, startOfDay.getTime())))
        .limit(500),
      getDb()
        .select({ id: schema.playbooks.id, name: schema.playbooks.name, reason: schema.playbooks.demotionReason, at: schema.playbooks.lastDemotedAt })
        .from(schema.playbooks)
        .where(and(eq(schema.playbooks.ownerEmail, scope.ownerEmail), gte(schema.playbooks.lastDemotedAt, Date.now() - 86_400_000)))
        .limit(5),
    ]);
    return {
      hasIssues: seeded,
      watchMode: settings.watchMode,
      demoMode: settings.demoMode,
      pendingReview: pending,
      exceptions: exceptions.items.length,
      demonstrationsToday: today.length,
      lesson: lesson ? { id: lesson.id, startedAt: lesson.startedAt } : null,
      demotions: demoted.filter((d) => d.reason).map((d) => ({ playbookId: d.id, name: d.name, reason: d.reason ?? "", at: d.at ?? 0 })),
    };
  },
});
