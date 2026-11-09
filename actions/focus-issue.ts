import { defineAction, fail } from "@agent-native/core/action";
import { writeAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";

export default defineAction({
  description:
    "Move the user's screen to what you are talking about: an issue, a playbook (optionally a tab), a review run, two issues side by side (compareIssueIds), or any app path. Use instead of describing where to click.",
  schema: z.object({
    issueId: z.string().optional(),
    playbookId: z.string().optional(),
    tab: z.enum(["recipe", "backtest", "tests", "provenance", "history", "skill"]).optional().describe("Playbook tab"),
    runId: z.string().optional().describe("Open the review screen for this run"),
    compareIssueIds: z.tuple([z.string(), z.string()]).optional(),
    path: z.string().startsWith("/").optional().describe("Any app path, e.g. /exceptions"),
  }),
  http: false,
  audit: { enabled: false },
  run: async (args) => {
    const path = args.compareIssueIds
      ? `/compare?a=${encodeURIComponent(args.compareIssueIds[0])}&b=${encodeURIComponent(args.compareIssueIds[1])}`
      : args.issueId
        ? `/issues/${encodeURIComponent(args.issueId)}`
        : args.playbookId
          ? `/playbooks/${encodeURIComponent(args.playbookId)}${args.tab ? `?tab=${args.tab}` : ""}`
          : args.runId
            ? `/review?run=${encodeURIComponent(args.runId)}`
            : (args.path ?? fail("Pass issueId, playbookId, runId, compareIssueIds or path.", { errorCode: "INVALID_INPUT", statusCode: 400 }));
    await writeAppStateForCurrentTab("navigate", { path, _writeId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    return { navigatedTo: path };
  },
});
