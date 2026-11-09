import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { activeLesson, listLessons } from "../server/apprentice/services/lessons.js";

export default defineAction({
  description: "List recorded lessons with the demonstrations and narration captured in each, plus the active recording if any.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async (_args, ctx) => {
    const scope = requireScope(ctx);
    const [lessons, active] = await Promise.all([listLessons(scope), activeLesson(scope)]);
    return {
      active: active ? { id: active.id, startedAt: active.startedAt } : null,
      lessons: lessons.map((l) => ({ id: l.id, status: l.status, startedAt: l.startedAt, endedAt: l.endedAt, narration: l.narration, events: (l.recorderReport as { events?: unknown[] } | null)?.events?.length ?? 0, demonstrations: l.demonstrations })),
    };
  },
});
