import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { importGithubIssues } from "../server/apprentice/services/ops.js";

export default defineAction({
  description:
    "Import open issues from a public GitHub repository into the local triage queue (read-only mirror; Apprentice never writes to GitHub). Idempotent; pull requests are skipped.",
  schema: z.object({
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Use owner/name").describe("Repository as owner/name, e.g. BuilderIO/agent-native"),
    limit: z.number().int().min(1).max(100).default(30).describe("Max issues to import"),
  }),
  retrySafe: true,
  audit: { target: (a) => ({ type: "repo", id: a.repo }), summary: (a) => `Imported GitHub issues from ${a.repo}` },
  run: async ({ repo, limit }, ctx) => importGithubIssues(requireScope(ctx), repo, limit),
});
