import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, callAction, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { IconCircleCheck, IconCircleX, IconCopy, IconDownload, IconPlayerPlay, IconSparkles } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { EmptyState, ErrorState, LEVEL_NAMES, OwnerLegend, pct, RowsSkeleton, Stat, timeAgo, TrustLadder } from "@/components/apprentice/primitives";
import { AddStep, ConditionRow, StepsEditor, TriggerEditor } from "@/components/apprentice/RecipeEditor";
import { Markdown, PlainSteps, SpecSteps } from "@/components/apprentice/Steps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { zipFiles } from "@/lib/zip";

import type { StepSpec, TriggerSpec } from "../../server/apprentice/engine/types";

const TABS = [
  { id: "recipe", label: "Recipe" },
  { id: "backtest", label: "Backtest" },
  { id: "tests", label: "Tests" },
  { id: "provenance", label: "Provenance" },
  { id: "history", label: "History" },
  { id: "skill", label: "SKILL.md" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function PlaybookEditor() {
  const { playbookId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "recipe") as Tab;
  const { data, isPending, error, refetch } = useActionQuery("get-playbook", { playbookId });
  const navigate = useNavigate();

  const promote = useActionMutation("set-trust-level", {
    onSuccess: (r) => toast.success(`Trust level: ${LEVEL_NAMES[r.trustLevel]}`),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't change the trust level."),
  });
  const run = useActionMutation("run-playbook", {
    onSuccess: (r) => {
      const c = r.counts as Record<string, number>;
      toast.success(`Ran in ${r.mode} mode: ${c.matched ?? 0} matched · ${c.executed ?? 0} executed · ${c.pending ?? 0} to review`);
      navigate(r.reviewPath);
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Run failed."),
  });

  async function exportSkill() {
    try {
      const out = await callAction("export-skill", { playbookId }, { method: "GET" });
      const bytes = zipFiles(out.files.map((f) => ({ path: `${out.folder}/${f.path}`, content: f.content })));
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${out.folder}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Skill exported: SKILL.md + playbook.json");
    } catch (e) {
      toast.error(actionErrorMessage(e) ?? (e instanceof Error ? `Export failed: ${e.message}` : "Export failed."));
    }
  }

  if (isPending) return <RowsSkeleton className="p-6" rows={6} />;
  if (error || !data)
    return (
      <div className="p-6">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  const { playbook: pb, eligibility, tests } = data;
  const evidence = [
    `Reviewed ${eligibility.evidence.reviewed} · agreement ${pct(eligibility.evidence.agreement)}`,
    `Executed ${eligibility.evidence.executed} · undone ${eligibility.evidence.undone}`,
    `Tests ${eligibility.evidence.testsPassing}/${eligibility.evidence.testsTotal} passing`,
    ...(eligibility.blockers.length ? ["", "Blockers:", ...eligibility.blockers] : []),
  ].join("\n");

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-muted-foreground">
              <Link to="/playbooks" className="hover:underline">
                Playbooks
              </Link>{" "}
              · v{pb.version} · {pb.status}
            </p>
            <NameEditor id={pb.id} name={pb.name} />
            <p className="mt-1 text-[13px] text-muted-foreground">{pb.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => run.mutate({ playbookId, scope: { openUntriaged: true }, trigger: "manual" })} disabled={run.isPending || pb.status !== "active" || pb.trustLevel < 1}>
              <IconPlayerPlay className="size-3.5" /> {run.isPending ? "Running…" : "Run on untriaged"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void exportSkill()}>
              <IconDownload className="size-3.5" /> Export skill
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TrustLadder level={pb.trustLevel} eligible={eligibility.eligible} evidence={evidence} />
          <Button
            size="sm"
            disabled={!eligibility.eligible || eligibility.nextLevel === null || promote.isPending}
            onClick={() => eligibility.nextLevel !== null && promote.mutate({ playbookId, level: eligibility.nextLevel, reason: "Promoted from the editor with evidence" })}
            title={eligibility.eligible ? evidence : eligibility.blockers.join(" ")}
          >
            {eligibility.nextLevel !== null ? `Promote to ${LEVEL_NAMES[eligibility.nextLevel]}` : "At highest level"}
          </Button>
          {pb.trustLevel > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => promote.mutate({ playbookId, level: pb.trustLevel - 1, reason: "Lowered by hand" })} disabled={promote.isPending}>
              Step back
            </Button>
          ) : null}
          <span className="tabular text-xs text-muted-foreground">
            {eligibility.eligible ? (
              <span className="text-primary">
                Ready: {eligibility.evidence.reviewed} reviewed · {pct(eligibility.evidence.agreement)} agreed · {tests.passing} tests passing
              </span>
            ) : (
              eligibility.blockers[0]
            )}
          </span>
        </div>
        {pb.demotionReason ? (
          <p className="rounded-md border border-warn/30 bg-warn/10 px-3 py-1.5 text-[13px] text-warn">
            {pb.demotionReason} {pb.lastDemotedAt ? `· ${timeAgo(pb.lastDemotedAt)}` : ""}
          </p>
        ) : null}
      </header>

      <nav role="tablist" aria-label="Playbook" className="mt-5 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams({ tab: t.id }, { replace: true })}
            className={cn("-mb-px border-b-2 px-3 py-2 text-[13px]", tab === t.id ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
            {t.id === "tests" ? (
              <span className={cn("tabular ms-1.5 font-mono text-[11px]", tests.failing.length ? "text-bad" : "text-ok")}>
                {tests.passing}/{tests.total}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "recipe" ? <RecipeTab key={pb.version} playbookId={pb.id} trigger={pb.trigger} steps={pb.steps} active={pb.status === "active"} /> : null}
        {tab === "backtest" ? <BacktestTab playbookId={pb.id} trigger={pb.trigger} name={pb.name} /> : null}
        {tab === "tests" ? <TestsTab playbookId={pb.id} /> : null}
        {tab === "provenance" ? <ProvenanceTab sourceEpisodeIds={pb.sourceEpisodeIds} /> : null}
        {tab === "history" ? <HistoryTab playbookId={pb.id} /> : null}
        {tab === "skill" ? <SkillTab markdown={pb.skillMarkdown} /> : null}
      </div>
    </div>
  );
}

function NameEditor({ id, name }: { id: string; name: string }) {
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name]);
  const save = useActionMutation("update-playbook", { onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't rename.") });
  return (
    <input
      aria-label="Playbook name"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value.trim() && value !== name && save.mutate({ playbookId: id, patch: { name: value.trim() }, changeNote: "Renamed" })}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="mt-1 w-full rounded-md bg-transparent text-xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function RecipeTab({ playbookId, trigger, steps, active }: { playbookId: string; trigger: TriggerSpec; steps: StepSpec[]; active: boolean }) {
  const [draftTrigger, setDraftTrigger] = useState<TriggerSpec>(trigger);
  const [draftSteps, setDraftSteps] = useState<StepSpec[]>(steps);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const dirty = JSON.stringify(draftTrigger) !== JSON.stringify(trigger) || JSON.stringify(draftSteps) !== JSON.stringify(steps);
  const save = useActionMutation("update-playbook", {
    onSuccess: (r) => {
      setBlocked(null);
      setNote("");
      toast.success(`Saved v${r.version} · tests ${r.tests.passing}/${r.tests.total} passing${r.status === "draft" ? " · saved as draft" : ""}`);
    },
    onError: (e) => {
      const msg = actionErrorMessage(e) ?? "Couldn't save.";
      if (msg.includes("test")) setBlocked(msg);
      toast.error(msg);
    },
  });
  function submit(saveAsDraft = false) {
    save.mutate({ playbookId, patch: { trigger: draftTrigger, steps: draftSteps }, changeNote: note || "Edited recipe", saveAsDraft });
  }
  return (
    <div className="space-y-6">
      <section aria-labelledby="trigger-h" className="rounded-[10px] border border-border bg-card p-4">
        <h2 id="trigger-h" className="mb-3 text-sm font-medium">
          Trigger <span className="font-normal text-muted-foreground">— all of these must be true</span>
        </h2>
        <TriggerEditor trigger={draftTrigger} onChange={setDraftTrigger} />
      </section>
      <section aria-labelledby="steps-h">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="steps-h" className="text-sm font-medium">
            Steps
          </h2>
          <OwnerLegend />
        </div>
        <StepsEditor steps={draftSteps} onChange={setDraftSteps} selected={selected} onSelect={setSelected} />
        <div className="mt-2">
          <AddStep onAdd={(s) => setDraftSteps([...draftSteps, s])} />
        </div>
      </section>
      <section className="sticky bottom-0 -mx-6 flex flex-wrap items-center gap-2 border-t border-border bg-background/95 px-6 py-3 backdrop-blur">
        <label htmlFor="change-note" className="sr-only">
          Change note
        </label>
        <Input id="change-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Change note (shown in History)" className="h-8 max-w-sm" />
        <Button size="sm" onClick={() => submit(false)} disabled={!dirty || save.isPending}>
          {save.isPending ? "Saving…" : "Save version"}
        </Button>
        {blocked && active ? (
          <Button size="sm" variant="outline" onClick={() => submit(true)} disabled={save.isPending}>
            Save as draft anyway
          </Button>
        ) : null}
        {dirty ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraftTrigger(trigger);
              setDraftSteps(steps);
              setBlocked(null);
            }}
          >
            Discard
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No changes.</span>
        )}
        {blocked ? (
          <p role="alert" className="w-full text-[13px] text-bad">
            {blocked}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

function BacktestTab({ playbookId, trigger, name }: { playbookId: string; trigger: TriggerSpec; name: string }) {
  const [enabled, setEnabled] = useState<boolean[]>(() => trigger.all.map(() => true));
  const [conds, setConds] = useState(trigger.all);
  const [open, setOpen] = useState<null | { title: string; number: number; issueId: string; predicted: { action: string; args: Record<string, unknown> }[] | null; actual: { action: string; args: Record<string, unknown> }[] }>(null);
  const override = useMemo<TriggerSpec>(() => ({ all: conds.filter((_, i) => enabled[i]), judgment: trigger.judgment ?? null }), [conds, enabled, trigger.judgment]);
  const changed = JSON.stringify(override.all) !== JSON.stringify(trigger.all);
  const debounced = useDebounced(override, 250);
  const { data, isPending, isFetching, error, refetch } = useActionQuery("backtest-playbook", { playbookId, triggerOverride: debounced }, { placeholderData: (prev) => prev });
  const apply = useActionMutation("update-playbook", {
    onSuccess: (r) => toast.success(`Applied as v${r.version}`),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't apply."),
  });
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <h2 className="text-sm font-medium">Try the trigger</h2>
        <p className="text-xs text-muted-foreground">Toggle conditions; numbers update live against your own triage history. Nothing is saved until you apply.</p>
        <div className="space-y-2 rounded-[10px] border border-border bg-card p-3">
          {conds.map((c, i) => (
            <ConditionRow
              key={i}
              cond={c}
              enabled={enabled[i] ?? true}
              onToggle={() => setEnabled(enabled.map((e, j) => (j === i ? !e : e)))}
              onChange={(nc) => setConds(conds.map((x, j) => (j === i ? nc : x)))}
              onRemove={() => {
                setConds(conds.filter((_, j) => j !== i));
                setEnabled(enabled.filter((_, j) => j !== i));
              }}
            />
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setConds([...conds, { field: "hasCodeBlock", op: "eq", value: false }]);
              setEnabled([...enabled, true]);
            }}
          >
            + Add condition
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!changed || apply.isPending} onClick={() => apply.mutate({ playbookId, patch: { trigger: override }, changeNote: "Tuned in backtest" })}>
            Apply trigger
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              sendToAgentChat({
                message: `Let me tune the "${name}" playbook.`,
                context: `Playbook id: ${playbookId}. Current trigger: ${JSON.stringify(trigger)}. Render the interactive tuner (apprentice-teacher skill → Interactive tuner).`,
                submit: true,
                openSidebar: true,
              })
            }
          >
            <IconSparkles className="size-3.5" /> Tune with agent
          </Button>
        </div>
      </aside>
      <section aria-live="polite" className={cn("space-y-4 transition-opacity", isFetching && "opacity-70")}>
        {isPending ? (
          <RowsSkeleton rows={3} />
        ) : error || !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Considered" value={data.considered} hint="Your closed demonstrations" />
              <Stat label="Matched" value={data.matched} />
              <Stat label="Agreed" value={data.agreed} tone="ok" />
              <Stat label="Missed" value={data.missedCount} tone={data.missedCount ? "warn" : undefined} hint="You did these steps but the trigger didn't match" />
              <Stat label="False positives" value={data.falsePositives} tone={data.falsePositives ? "bad" : undefined} hint="Matched, but you did something else" />
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Agreement on matched</span>
                <span className="tabular">{pct(data.agreement)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(data.agreement * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-ok transition-all" style={{ width: `${data.agreement * 100}%` }} />
              </div>
              {data.needsJudgmentCount ? <p className="mt-1 text-xs text-param-agent">✦ {data.needsJudgmentCount} matches also need the agent's judgment (not scored here).</p> : null}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Disagreements & misses</h3>
              {[...data.disagreed, ...data.missed].length === 0 ? (
                <p className="text-[13px] text-muted-foreground">None — the playbook did exactly what you did every time it matched.</p>
              ) : (
                <ul className="divide-y divide-border rounded-[10px] border border-border bg-card">
                  {[...data.disagreed, ...data.missed].map((d) => (
                    <li key={d.episodeId}>
                      <button type="button" onClick={() => setOpen(d)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] hover:bg-secondary">
                        <span className={cn("rounded px-1.5 py-px text-[11px]", d.kind === "missed" ? "bg-warn/10 text-warn" : "bg-bad/10 text-bad")}>
                          {d.kind === "missed" ? "missed" : d.kind === "actions" ? "different steps" : "different values"}
                        </span>
                        <span className="tabular font-mono text-xs text-muted-foreground">#{d.number}</span>
                        <span className="min-w-0 flex-1 truncate">{d.title}</span>
                        <span className="text-xs text-muted-foreground">{d.actorEmail.split("@")[0]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              #{open?.number} {open?.title}
            </SheetTitle>
            <SheetDescription>What the playbook would do vs. what was actually done.</SheetDescription>
          </SheetHeader>
          {open ? (
            <div className="space-y-4 px-4 text-sm">
              <div>
                <h4 className="mb-1 text-xs font-medium uppercase text-muted-foreground">Predicted</h4>
                {open.predicted ? <PlainSteps steps={open.predicted} /> : <p className="text-muted-foreground">Trigger didn't match.</p>}
              </div>
              <div>
                <h4 className="mb-1 text-xs font-medium uppercase text-muted-foreground">Actual</h4>
                <PlainSteps steps={open.actual} />
              </div>
              <Link className="text-primary underline-offset-2 hover:underline" to={`/issues/${open.issueId}`}>
                Open issue →
              </Link>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TestsTab({ playbookId }: { playbookId: string }) {
  const { data, isPending, error, refetch } = useActionQuery("list-playbook-tests", { playbookId });
  const run = useActionMutation("run-playbook-tests", {
    onSuccess: (r) => toast.success(`${r.passing}/${r.total} tests passing`),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't run tests."),
  });
  if (isPending) return <RowsSkeleton rows={3} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">Every demonstration it learned from and every correction you made is a regression test. Promotion and edits are blocked while one fails.</p>
        <Button size="sm" variant="outline" onClick={() => run.mutate({ playbookId })} disabled={run.isPending}>
          {run.isPending ? "Running…" : "Run tests"}
        </Button>
      </div>
      {data.tests.length === 0 ? (
        <EmptyState title="No tests yet" body="Override or edit a decision in Review and it becomes a test here." />
      ) : (
        <ul className="space-y-2">
          {data.tests.map((t) => {
            const diff = t.lastDiff as { predicted?: { action: string; args: Record<string, unknown> }[] | null; failedConditions?: string[] } | null;
            return (
              <li key={t.id} className={cn("rounded-[10px] border bg-card p-3", t.lastResult === "fail" ? "border-bad/40" : "border-border")}>
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  {t.lastResult === "pass" ? <IconCircleCheck className="size-4 text-ok" aria-label="pass" /> : <IconCircleX className="size-4 text-bad" aria-label="fail" />}
                  <span className="font-medium">Test #{t.number}</span>
                  <span className="rounded border border-border px-1.5 py-px text-[11px] text-muted-foreground">{t.origin === "seed" ? "demonstration" : t.origin}</span>
                  <Link to={`/issues/${t.issueId}`} className="min-w-0 truncate text-muted-foreground hover:underline">
                    #{t.issueNumber} {t.issueTitle}
                  </Link>
                </div>
                <div className="mt-2 grid gap-3 text-[13px] sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Expected</p>
                    {t.expected.applies ? <PlainSteps steps={t.expected.steps} /> : <p>Should not apply</p>}
                  </div>
                  {t.lastResult === "fail" && diff ? (
                    <div>
                      <p className="mb-1 text-xs text-bad">Playbook would do</p>
                      {diff.predicted ? <PlainSteps steps={diff.predicted} /> : <p>Nothing (didn't match: {diff.failedConditions?.join("; ")})</p>}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProvenanceTab({ sourceEpisodeIds }: { sourceEpisodeIds: string[] }) {
  const { data, isPending } = useActionQuery("list-demonstrations", { includeHistory: true, limit: 200 });
  if (isPending) return <RowsSkeleton rows={3} />;
  const sources = (data?.demonstrations ?? []).filter((d) => sourceEpisodeIds.includes(d.id));
  if (!sources.length) return <EmptyState title="Written by hand" body="This playbook wasn't learned from demonstrations." />;
  return (
    <ol className="space-y-3">
      {sources.map((d) => (
        <li key={d.id} className="rounded-[10px] border border-border bg-card p-3 text-[13px]">
          <p>
            <span className="font-medium">{d.actorEmail}</span> demonstrated on{" "}
            <Link to={`/issues/${d.issueId}`} className="hover:underline">
              #{d.number} {d.title}
            </Link>{" "}
            <span className="text-xs text-muted-foreground">· {timeAgo(d.startedAt)} · {d.source}</span>
          </p>
          <div className="mt-2">
            <PlainSteps steps={d.steps} />
          </div>
          {d.narration ? <p className="mt-2 italic text-muted-foreground">“{d.narration}”</p> : null}
        </li>
      ))}
    </ol>
  );
}

function HistoryTab({ playbookId }: { playbookId: string }) {
  const { data, isPending } = useActionQuery("list-playbook-versions", { playbookId });
  if (isPending) return <RowsSkeleton rows={3} />;
  const versions = data?.versions ?? [];
  return (
    <ol className="space-y-3">
      {versions.map((v, i) => {
        const prev = versions[i + 1];
        const triggerChanged = prev && JSON.stringify(prev.snapshot.trigger) !== JSON.stringify(v.snapshot.trigger);
        const stepsChanged = prev && JSON.stringify(prev.snapshot.steps) !== JSON.stringify(v.snapshot.steps);
        const levelChanged = prev && prev.snapshot.trustLevel !== v.snapshot.trustLevel;
        return (
          <li key={v.id} className="rounded-[10px] border border-border bg-card p-3 text-[13px]">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">v{v.version}</span>
              <span className="font-medium">{v.changeNote}</span>
              <span className="text-xs text-muted-foreground">
                {v.createdBy} · {timeAgo(v.createdAt)}
              </span>
            </p>
            {triggerChanged || stepsChanged || levelChanged ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {levelChanged ? (
                  <p className="text-xs text-muted-foreground">
                    Trust: {LEVEL_NAMES[prev.snapshot.trustLevel]} → <span className="text-foreground">{LEVEL_NAMES[v.snapshot.trustLevel]}</span>
                  </p>
                ) : null}
                {triggerChanged ? (
                  <div className="text-xs">
                    <p className="text-muted-foreground">Trigger before: {prev.snapshot.trigger.all.length} conditions</p>
                    <p>After: {v.snapshot.trigger.all.map((c) => `${c.field} ${c.op}${"value" in c ? ` ${String(c.value)}` : ""}`).join(" · ")}</p>
                  </div>
                ) : null}
                {stepsChanged ? (
                  <div className="sm:col-span-2">
                    <SpecSteps steps={v.snapshot.steps} dense />
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function SkillTab({ markdown }: { markdown: string }) {
  const [raw, setRaw] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(markdown).then(() => toast.success("SKILL.md copied"));
          }}
        >
          <IconCopy className="size-3.5" /> Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRaw(!raw)}>
          {raw ? "Rendered" : "Raw"}
        </Button>
        <p className="self-center text-xs text-muted-foreground">Standard SKILL.md format — works in Claude Code and other skill-aware agents. Regenerated on every save.</p>
      </div>
      <div className="rounded-[10px] border border-border bg-card p-4">
        {raw ? <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap">{markdown}</pre> : <SkillRendered markdown={markdown} />}
      </div>
    </div>
  );
}

function SkillRendered({ markdown }: { markdown: string }) {
  const [front, body] = useMemo(() => {
    const m = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    return m ? [m[1] ?? "", m[2] ?? ""] : ["", markdown];
  }, [markdown]);
  return (
    <div className="space-y-3">
      {front ? <pre className="rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">{front}</pre> : null}
      {body.split(/\n(?=#)/).map((section, i) => {
        const [head, ...rest] = section.split("\n");
        const level = head?.match(/^#+/)?.[0].length ?? 0;
        return (
          <div key={i}>
            {level ? <p className={cn("font-semibold", level === 1 ? "text-lg" : "mt-2 text-sm")}>{head?.replace(/^#+\s*/, "")}</p> : null}
            <Markdown text={level ? rest.join("\n") : (section ?? "")} />
          </div>
        );
      })}
    </div>
  );
}

