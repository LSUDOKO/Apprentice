import { defineAction } from "@agent-native/core/action";
import { deleteAppState } from "@agent-native/core/application-state";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { finishLesson } from "../server/apprentice/services/lessons.js";

export default defineAction({
  description: "Finish (or cancel) the recording lesson. Attaches the framework Recorder report and the user's narration to the demonstrations captured during it.",
  schema: z.object({
    lessonId: z.string().min(1),
    recorderReport: z.unknown().optional().describe("Recorder report from the browser (action/nav/state events are kept)"),
    narration: z.string().max(4000).optional().describe("What the user said or typed while teaching"),
    cancel: z.boolean().optional(),
  }),
  maxBodyBytes: 512_000,
  audit: { target: (a) => ({ type: "lesson", id: a.lessonId }), summary: () => "Finished a lesson", recordInputs: false },
  run: async (args, ctx) => {
    const result = await finishLesson(requireScope(ctx), args);
    await deleteAppState("apprentice:lesson").catch(() => undefined);
    return { lessonId: result.lesson.id, status: result.lesson.status, demonstrations: result.demonstrations, newCandidates: result.newCandidates };
  },
});
