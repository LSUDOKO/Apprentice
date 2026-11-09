import type { ActionRunContext } from "@agent-native/core/action";
import { fail } from "@agent-native/core/action";
import { and, desc, eq, gte } from "drizzle-orm";

import { deriveFeatures } from "../engine/features.js";
import { savedMs, TIME_SAVED_METHOD } from "../engine/metrics.js";
import { LEVEL_NAMES } from "../engine/trust.js";
import { getDb, schema } from "../../db/index.js";
import { listExceptions } from "./assist.js";
import { firstRow, newId, type Scope } from "./core.js";
import { runPlaybook, type RunResult } from "./executor.js";
import { getEligibility, listPlaybookRows, refreshPlaybook } from "./playbooks.js";

const DAY = 86_400_000;

export async function runAutopilot(scope: Scope, ctx: ActionRunContext | undefined, maxItems: number) {
  const playbooks = (await listPlaybookRows(scope, "active")).filter((p) => p.trustLevel >= 1).sort((a, b) => b.trustLevel - a.trustLevel);
  const runs: (Pick<RunResult, "runId" | "mode" | "status" | "counts" | "awaitingJudgment" | "toExecute"> & { playbookId: string; playbookName: string })[] = [];
  let budget = maxItems;
  for (const pb of playbooks) {
    if (budget <= 0) break;
    const result = await runPlaybook(scope, ctx, { playbookId: pb.id, scope: { openUntriaged: true }, trigger: ctx?.caller === "automation" ? "schedule" : "manual" });
    budget -= result.counts.considered ?? 0;
    runs.push({ playbookId: pb.id, playbookName: pb.name, runId: result.runId, mode: result.mode, status: result.status, counts: result.counts, awaitingJudgment: result.awaitingJudgment, toExecute: result.toExecute });
  }
  return { runs, playbooksRun: runs.length };
}

export async function buildDigest(scope: Scope, sinceMs?: number) {
  const db = getDb();
  const [last] = await db
    .select({ periodEnd: schema.digests.periodEnd })
    .from(schema.digests)
    .where(eq(schema.digests.ownerEmail, scope.ownerEmail))
    .orderBy(desc(schema.digests.periodEnd))
    .limit(1);
  const now = Date.now();
  const periodStart = sinceMs ?? last?.periodEnd ?? now - DAY;
  const decisions = await db
    .select({ status: schema.decisions.status, executedAt: schema.decisions.executedAt, playbookId: schema.decisions.playbookId })
    .from(schema.decisions)
    .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), gte(schema.decisions.createdAt, periodStart)))
    .limit(2000);
  const playbooks = await listPlaybookRows(scope);
  const handled = decisions.filter((d) => d.executedAt !== null && d.status === "executed").length;
  const pending = decisions.filter((d) => d.status === "pending").length;
  const exceptions = await listExceptions(scope, 100);
  const ready: string[] = [];
  let saved = 0;
  for (const pb of playbooks) {
    if ((await getEligibility(scope, pb)).eligible && pb.trustLevel >= 1) ready.push(pb.name);
    const executedHere = decisions.filter((d) => d.playbookId === pb.id && d.status === "executed").length;
    saved += savedMs(executedHere, pb.stats.medianHumanMs);
  }
  const needYou = pending + exceptions.items.length;
  const minutes = Math.round(saved / 60_000);
  const body = [
    `**Apprentice digest** · ${new Date(periodStart).toISOString().slice(0, 16).replace("T", " ")} → ${new Date(now).toISOString().slice(0, 16).replace("T", " ")} UTC`,
    "",
    `Handled ${handled} · ${needYou} need you · ${ready.length} playbook${ready.length === 1 ? "" : "s"} ready to promote`,
    "",
    ...(minutes ? [`Estimated time saved: ~${minutes} min.`] : []),
    ...(pending ? [`- ${pending} decision(s) waiting for review`] : []),
    ...(exceptions.items.length ? [`- ${exceptions.items.length} exception(s): ${Object.entries(exceptions.counts).filter(([, v]) => v).map(([k, v]) => `${v} ${k.toLowerCase().replace(/_/g, " ")}`).join(", ")}`] : []),
    ...ready.map((name) => `- Ready to promote: ${name}`),
    "",
    "Review: /review · Exceptions: /exceptions",
  ].join("\n");
  const stats = { handled, needYou, pending, exceptions: exceptions.items.length, readyToPromote: ready.length, savedMs: saved };
  const row = firstRow(
    await db
      .insert(schema.digests)
      .values({ id: newId("dig"), periodStart, periodEnd: now, body, stats, deliveredTo: ["in-app"], createdAt: now, ownerEmail: scope.ownerEmail, orgId: scope.orgId })
      .returning(),
  );
  return { digestId: row.id, body, stats };
}

export async function listDigests(scope: Scope, limit: number) {
  return getDb().select().from(schema.digests).where(eq(schema.digests.ownerEmail, scope.ownerEmail)).orderBy(desc(schema.digests.createdAt)).limit(limit);
}

function weekStart(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.getTime();
}

/** Insights / time-saved ledger (F20). All time numbers are estimates. */
export async function getInsights(scope: Scope, rangeDays: number) {
  const db = getDb();
  const since = Date.now() - rangeDays * DAY;
  const playbooks = await Promise.all((await listPlaybookRows(scope)).map((p) => refreshPlaybook(scope, p.id)));
  const [decisions, suggestions] = await Promise.all([
    db
      .select({ playbookId: schema.decisions.playbookId, status: schema.decisions.status, verdict: schema.decisions.verdict, reviewedAt: schema.decisions.reviewedAt, executedAt: schema.decisions.executedAt })
      .from(schema.decisions)
      .where(and(eq(schema.decisions.ownerEmail, scope.ownerEmail), gte(schema.decisions.createdAt, since)))
      .limit(5000),
    db
      .select({ outcome: schema.suggestionEvents.outcome })
      .from(schema.suggestionEvents)
      .where(and(eq(schema.suggestionEvents.ownerEmail, scope.ownerEmail), gte(schema.suggestionEvents.createdAt, since)))
      .limit(5000),
  ]);
  const pbById = new Map(playbooks.map((p) => [p.id, p]));
  const executed = decisions.filter((d) => d.status === "executed" && d.executedAt !== null);
  const reviewed = decisions.filter((d) => d.verdict && d.verdict !== "skipped");
  const weeks = new Map<number, number>();
  for (let i = 4; i >= 0; i--) weeks.set(weekStart(Date.now() - i * 7 * DAY), 0);
  let totalSaved = 0;
  for (const d of executed) {
    const s = savedMs(1, pbById.get(d.playbookId)?.stats.medianHumanMs ?? null);
    totalSaved += s;
    const w = weekStart(d.executedAt ?? 0);
    if (weeks.has(w)) weeks.set(w, (weeks.get(w) ?? 0) + s);
  }
  const agreementSeries = playbooks.map((pb) => {
    const rows = reviewed.filter((d) => d.playbookId === pb.id).sort((a, b) => (a.reviewedAt ?? 0) - (b.reviewedAt ?? 0));
    let approved = 0;
    return { playbookId: pb.id, name: pb.name, points: rows.map((r, i) => ({ n: i + 1, agreement: (approved += r.verdict === "approved" ? 1 : 0) / (i + 1) })) };
  });
  const accepted = suggestions.filter((s) => s.outcome === "accepted").length;
  const exceptions = await listExceptions(scope, 200);
  return {
    method: TIME_SAVED_METHOD,
    rangeDays,
    totals: {
      hoursSaved: Math.round((totalSaved / 3_600_000) * 10) / 10,
      minutesSaved: Math.round(totalSaved / 60_000),
      itemsHandled: executed.length,
      agreement: reviewed.length ? reviewed.filter((d) => d.verdict === "approved").length / reviewed.length : null,
      reviewed: reviewed.length,
      suggestionsShown: suggestions.length,
      suggestionsAccepted: accepted,
      exceptions: exceptions.items.length,
    },
    perPlaybook: playbooks.map((pb) => {
      const ex = executed.filter((d) => d.playbookId === pb.id).length;
      return {
        id: pb.id,
        name: pb.name,
        trustLevel: pb.trustLevel,
        levelName: LEVEL_NAMES[pb.trustLevel] ?? "Watch",
        executed: ex,
        minutesSaved: Math.round(savedMs(ex, pb.stats.medianHumanMs) / 60_000),
        medianHumanSec: pb.stats.medianHumanMs ? Math.round(pb.stats.medianHumanMs / 1000) : null,
        agreement: pb.stats.rollingAgreement,
      };
    }),
    weekly: [...weeks.entries()].map(([start, ms]) => ({ weekStart: new Date(start).toISOString().slice(0, 10), minutesSaved: Math.round(ms / 60_000) })),
    agreementSeries,
    autonomy: LEVEL_NAMES.map((name, level) => ({ level, name, count: playbooks.filter((p) => p.trustLevel === level).length })),
    exceptionsByReason: exceptions.counts,
    decisionMix: {
      approved: reviewed.filter((d) => d.verdict === "approved").length,
      corrected: reviewed.filter((d) => d.verdict !== "approved").length,
      executed: executed.length,
      pending: decisions.filter((d) => !d.verdict && d.status !== "executed").length,
    },
  };
}

type GithubIssue = { number: number; title: string; body: string | null; user: { login: string } | null; labels: ({ name?: string } | string)[]; state: string; created_at: string; updated_at: string; pull_request?: unknown; author_association?: string };

/** Read-only GitHub import (08 §8.8). Idempotent by gh_<repo>_<number>. Never writes to GitHub. */
export async function importGithubIssues(scope: Scope, repo: string, limit: number) {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=${Math.min(limit, 100)}`, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "apprentice-agent-native" },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => fail("Couldn't reach GitHub. Check your connection and try again.", { errorCode: "GITHUB_UNREACHABLE", statusCode: 502 }));
  if (res.status === 404) fail(`Repository ${repo} not found (or private).`, { errorCode: "GITHUB_NOT_FOUND", statusCode: 404 });
  if (res.status === 403 || res.status === 429) fail("GitHub rate limit reached (60 requests/hour without a token). Try again later.", { errorCode: "GITHUB_RATE_LIMIT", statusCode: 429 });
  if (!res.ok) fail(`GitHub returned ${res.status}.`, { errorCode: "GITHUB_ERROR", statusCode: 502 });
  const items = ((await res.json()) as GithubIssue[]).filter((i) => !i.pull_request).slice(0, limit);
  const safeRepo = repo.replace(/[^a-zA-Z0-9_.-]/g, "_");
  let imported = 0;
  for (const gh of items) {
    const labels = gh.labels.map((l) => (typeof l === "string" ? l : (l.name ?? ""))).filter(Boolean);
    const snap = { labels, priority: null, component: null, assignee: null, state: "open" as const, closeReason: null, duplicateOf: null };
    const body = (gh.body ?? "").slice(0, 20_000);
    const firstTime = gh.author_association === "FIRST_TIME_CONTRIBUTOR" || gh.author_association === "FIRST_TIMER";
    const row = {
      id: `gh_${safeRepo}_${gh.number}`,
      source: "github" as const,
      repo,
      number: gh.number,
      title: gh.title.slice(0, 500),
      body,
      author: gh.user?.login ?? "unknown",
      ...snap,
      authorIsFirstTime: firstTime ? 1 : 0,
      features: deriveFeatures({ ...snap, title: gh.title, body, authorIsFirstTime: firstTime }),
      createdAt: Date.parse(gh.created_at),
      updatedAt: Date.parse(gh.updated_at),
      ownerEmail: scope.ownerEmail,
      orgId: scope.orgId,
    };
    const inserted = await getDb().insert(schema.issues).values(row).onConflictDoNothing().returning({ id: schema.issues.id });
    imported += inserted.length;
  }
  return { repo, fetched: items.length, imported, skipped: items.length - imported };
}
