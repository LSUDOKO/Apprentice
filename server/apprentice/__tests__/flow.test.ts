/**
 * End-to-end service test on in-memory PGlite: the whole Apprentice loop
 * (watch → pattern → playbook → backtest → shadow review → tests → trust → act → undo).
 */
import type { ActionRunContext } from "@agent-native/core/action";
import { getDbExec } from "@agent-native/core/db";
import { beforeAll, describe, expect, it } from "vitest";

import { APPRENTICE_MIGRATIONS } from "../../db/migrations.js";
import { predictForIssue } from "../services/assist.js";
import { explainDecision, listDecisionRows, reviewDecision, runPlaybook, undoRun } from "../services/executor.js";
import { loadIssue, mutateIssue } from "../services/issues.js";
import { listCandidates } from "../services/patterns.js";
import { backtestRecipe, createFromCandidate, setTrustLevel, updatePlaybook } from "../services/playbooks.js";
import { endDemonstration } from "../services/record-step.js";
import { seedDemoData } from "../services/seed.js";
import { getDb } from "../../db/index.js";

const ME = "alice@example.com";
const scope = { ownerEmail: ME, orgId: null };
const ui: ActionRunContext = { userEmail: ME, orgId: null, caller: "frontend" };

async function triageLikeTheDemo(issueId: string) {
  const issue = await loadIssue(getDb(), scope, issueId);
  await mutateIssue(ui, "label-issue", { issueId, add: ["bug"], remove: [] });
  await mutateIssue(ui, "label-issue", { issueId, add: ["needs-info"], remove: [] });
  await mutateIssue(ui, "request-repro", { issueId, missing: ["version", "steps"], message: `Thanks @${issue?.author}! Which version are you on, and what are the steps?` });
  await mutateIssue(ui, "assign-issue", { issueId, assignee: "triage" });
}

beforeAll(async () => {
  for (const m of APPRENTICE_MIGRATIONS) {
    const sql = typeof m.sql === "string" ? m.sql : (m.sql.postgres ?? "");
    for (const stmt of sql.split(/;\s*\n/)) await getDbExec().execute(stmt);
  }
  await seedDemoData(scope);
});

describe("Apprentice loop", () => {
  it("seeds 60 issues and stays idempotent", async () => {
    const again = await seedDemoData(scope);
    expect(again.seeded).toBe(false);
    const { rows } = await getDbExec().execute({ sql: "SELECT count(*)::int AS n FROM issues WHERE owner_email = ?", args: [ME] });
    expect((rows[0] as { n: number }).n).toBe(60);
  });

  it("seed history alone does not propose the needs-info pattern", async () => {
    expect(await listCandidates(scope)).toHaveLength(0);
  });

  it("proposes a pattern after two live demonstrations", async () => {
    await triageLikeTheDemo("seed-031");
    await triageLikeTheDemo("seed-032");
    const candidates = await listCandidates(scope);
    expect(candidates).toHaveLength(1);
    const c = candidates[0]!;
    expect(c.support).toBe(2);
    expect(c.steps.map((s) => s.action)).toEqual(["label-issue", "request-repro", "assign-issue"]);
    expect(c.steps[0]!.params.add).toEqual({ owner: "fixed", value: ["bug", "needs-info"] });
    expect(c.steps[1]!.params.message?.owner).toBe("agent");
    expect(c.steps[2]!.params.assignee).toEqual({ owner: "fixed", value: "triage" });
    expect(c.trigger.all).toEqual(
      expect.arrayContaining([
        { field: "kind", op: "eq", value: "bug" },
        { field: "hasVersion", op: "eq", value: false },
      ]),
    );
    expect(c.status).toBe("conflict");
    expect(c.conflictWith?.[0]?.actorEmail).toBe("bob@demo.local");
  });

  it("ghost-suggests the next step on a third matching issue", async () => {
    await endDemonstration(scope, "seed-032");
    await mutateIssue(ui, "label-issue", { issueId: "seed-033", add: ["needs-info"], remove: [] });
    const s = await predictForIssue(scope, "seed-033");
    expect(s?.action).toBe("label-issue");
    expect(s?.args.add).toEqual(["bug"]);
    await mutateIssue(ui, "label-issue", { issueId: "seed-033", add: ["bug"], remove: [] });
    const next = await predictForIssue(scope, "seed-033");
    expect(next?.action).toBe("request-repro");
    expect(next?.needsAgent).toBe(false);
  });

  it("makes a playbook, backtests it, reviews in shadow mode and earns trust", async () => {
    const c = (await listCandidates(scope))[0]!;
    const pb = await createFromCandidate(scope, c.id);
    expect(pb.trustLevel).toBe(1);
    expect(pb.skillMarkdown).toContain("## Steps");
    expect(pb.stats.testsTotal).toBe(2);
    expect(pb.stats.testsPassing).toBe(2);

    const bt = await backtestRecipe(scope, pb.trigger, pb.steps);
    expect(bt.matched).toBeGreaterThanOrEqual(15);
    expect(bt.agreed).toBeGreaterThanOrEqual(14);
    expect(bt.disagreed.length).toBe(3);

    const run = await runPlaybook(scope, ui, { playbookId: pb.id, scope: { openUntriaged: true }, trigger: "manual" });
    expect(run.mode).toBe("shadow");
    const decisions = await listDecisionRows(scope, { runId: run.runId, limit: 50 });
    const ids = decisions.map((d) => d.issueId).sort();
    expect(ids).toEqual(["seed-034", "seed-035", "seed-036", "seed-037", "seed-038"]);

    for (const d of decisions.filter((x) => x.issueId !== "seed-038")) await reviewDecision(scope, { decisionId: d.id, verdict: "approve" });
    const odd = decisions.find((d) => d.issueId === "seed-038")!;
    const review = await reviewDecision(scope, { decisionId: odd.id, verdict: "override", humanSteps: [] });
    expect(review.testNumber).toBe(3);

    // The override test fails until the recipe excludes that case → promotion is blocked.
    await expect(setTrustLevel(scope, pb.id, 2, "test")).rejects.toThrow(/Not eligible/);
    const fixed = await updatePlaybook(scope, pb.id, { trigger: { all: [...pb.trigger.all, { field: "hasCodeBlock", op: "eq", value: false }] } }, { changeNote: "Exclude pasted config" });
    expect(fixed.playbook.stats.testsPassing).toBe(3);
    // An edit that would break a passing test is refused.
    await expect(updatePlaybook(scope, pb.id, { trigger: { all: [{ field: "kind", op: "eq", value: "feature" }] } }, {})).rejects.toThrow(/test\(s\) would fail/);

    const draft = await setTrustLevel(scope, pb.id, 2, "evidence");
    expect(draft.trustLevel).toBe(2);
  });

  it("acts at level 3, explains itself and undoes a whole run", async () => {
    const pbId = ((await getDbExec().execute({ sql: "SELECT id FROM playbooks WHERE owner_email = ?", args: [ME] })).rows as { id: string }[])[0]!.id;
    // Draft-level decisions approved by the human count toward Act.
    await getDbExec().execute({ sql: "UPDATE playbooks SET trust_level = 3 WHERE id = ?", args: [pbId] });
    const { simulateIncoming } = await import("../services/seed.js");
    const incoming = await simulateIncoming(scope, 8);
    expect(incoming.added).toHaveLength(8);
    const run = await runPlaybook(scope, { userEmail: ME, orgId: null, caller: "automation" }, { playbookId: pbId, scope: { openUntriaged: true }, trigger: "schedule" });
    expect(run.mode).toBe("act");
    expect(run.counts.executed).toBe(5);
    const after = await loadIssue(getDb(), scope, "seed-061");
    expect(after?.labels.sort()).toEqual(["bug", "needs-info"]);
    expect(after?.assignee).toBe("triage");

    const decision = (await listDecisionRows(scope, { runId: run.runId, limit: 10 }))[0]!;
    const why = await explainDecision(scope, decision.id);
    expect(why.demonstrations.map((d) => d.issueId).sort()).toEqual(["seed-031", "seed-032"]);

    const undo = await undoRun(scope, run.runId);
    expect(undo.conflicts).toHaveLength(0);
    expect(undo.undone).toBe(15);
    const restored = await loadIssue(getDb(), scope, "seed-061");
    expect(restored?.labels).toEqual([]);
    expect(restored?.assignee).toBeNull();
  });
});
