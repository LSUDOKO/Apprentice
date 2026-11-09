import { defineAction } from "@agent-native/core/action";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireScope } from "../server/apprentice/services/core.js";
import { toItemView } from "../server/apprentice/services/issues.js";
import { listPlaybookRows } from "../server/apprentice/services/playbooks.js";
import { evaluate } from "../server/apprentice/engine/triggers.js";
import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description:
    "List issues in the triage queue with labels, priority, assignee and which active playbooks match. Filters: state, label, untriaged (no labels, no assignee), q (title search).",
  schema: z.object({
    state: z.enum(["open", "closed", "all"]).default("open").describe("Issue state filter"),
    label: z.string().optional().describe("Only issues with this label"),
    untriaged: z.boolean().optional().describe("Only open issues with no labels and no assignee"),
    q: z.string().max(200).optional().describe("Case-insensitive title search"),
    limit: z.number().int().min(1).max(200).default(100).describe("Max rows"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async (args, ctx) => {
    const scope = requireScope(ctx);
    const where =
      args.state === "all"
        ? eq(schema.issues.ownerEmail, scope.ownerEmail)
        : and(eq(schema.issues.ownerEmail, scope.ownerEmail), eq(schema.issues.state, args.state));
    const [rows, playbooks] = await Promise.all([
      getDb().select().from(schema.issues).where(where).orderBy(desc(schema.issues.createdAt)).limit(300),
      listPlaybookRows(scope, "active"),
    ]);
    const q = args.q?.toLowerCase().trim();
    const filtered = rows.filter(
      (r) =>
        (!args.label || r.labels.includes(args.label)) &&
        (!args.untriaged || (r.state === "open" && r.labels.length === 0 && !r.assignee)) &&
        (!q || r.title.toLowerCase().includes(q) || String(r.number) === q.replace("#", "")),
    );
    const issues = filtered.slice(0, args.limit).map((r) => {
      const view = toItemView(r);
      return {
        id: r.id,
        number: r.number,
        title: r.title,
        author: r.author,
        source: r.source,
        state: r.state,
        labels: r.labels,
        priority: r.priority,
        component: r.component,
        assignee: r.assignee,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        kind: r.features.kind,
        hasVersion: r.features.hasVersion,
        matchedBy: r.state === "open" ? playbooks.filter((p) => evaluate(p.trigger, view).deterministicMatch).map((p) => ({ id: p.id, name: p.name })) : [],
      };
    });
    return { issues, total: filtered.length };
  },
});
