import { defineAction } from "@agent-native/core/action";
import { writeAppState } from "@agent-native/core/application-state";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { startLesson } from "../server/apprentice/services/lessons.js";

export default defineAction({
  description: "Start recording a lesson: everything the user does by hand until finish-lesson becomes one narrated demonstration.",
  schema: z.object({}),
  audit: { target: () => ({ type: "lesson", id: "new" }), summary: () => "Started a lesson" },
  run: async (_args, ctx) => {
    const lesson = await startLesson(requireScope(ctx));
    await writeAppState("apprentice:lesson", { lessonId: lesson.id, startedAt: lesson.startedAt }).catch(() => undefined);
    return { lessonId: lesson.id, startedAt: lesson.startedAt };
  },
});
