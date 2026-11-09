import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, setClientAppState, useActionMutation, useActionQuery, useDbSync } from "@agent-native/core/client/hooks";
import { IconArrowBackUp, IconCheck, IconPencil, IconPlayerSkipForward, IconSparkles, IconX } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

import { EmptyState, ErrorState, LabelChip, LEVEL_NAMES, pct, RowsSkeleton, timeAgo } from "@/components/apprentice/primitives";
import { DOMAIN_ACTION_PARAMS } from "@/components/apprentice/RecipeEditor";
import { InlineMd, Markdown, ResolvedSteps } from "@/components/apprentice/Steps";
import { isTypingTarget } from "@/components/apprentice/WorkspaceChrome";
import { ASSIGNEES, COMPONENTS, LABELS, MISSING, PRIORITIES } from "@/components/apprentice/vocab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Step = { action: string; args: Record<string, unknown> };

function ConfidenceRing({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const tone = value >= 80 ? "var(--ok)" : value >= 60 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="relative size-12 shrink-0" role="img" aria-label={`Confidence ${value}%`}>
      <svg viewBox="0 0 44 44" className="size-12 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={tone} strokeWidth="4" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} strokeLinecap="round" />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center text-[11px] font-semibold">{value}</span>
    </div>
  );
}

const ARG_INPUT: Record<string, readonly string[]> = { priority: PRIORITIES, component: COMPONENTS, assignee: ASSIGNEES, reason: ["completed", "invalid", "wontfix"] };

function StepRowEditor({ step, onChange, onRemove }: { step: Step; onChange: (s: Step) => void; onRemove: () => void }) {
  const params = DOMAIN_ACTION_PARAMS[step.action] ?? [];
  return (
    <li className="space-y-2 rounded-md border border-border bg-card p-2.5">
      <div className="flex items-center gap-2">
        <select
          aria-label="Action"
          className="h-8 rounded-md border border-input bg-card px-2 font-mono text-[13px]"
          value={step.action}
          onChange={(e) => onChange({ action: e.target.value, args: Object.fromEntries((DOMAIN_ACTION_PARAMS[e.target.value] ?? []).map((p) => [p.key, p.kind === "labels" || p.kind === "multi" ? [] : null])) })}
        >
          {Object.keys(DOMAIN_ACTION_PARAMS).map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <Button size="icon" variant="ghost" className="ms-auto size-7" onClick={onRemove} aria-label="Remove step">
          <IconX className="size-3.5" />
        </Button>
      </div>
      {params.map((p) => {
        const v = step.args[p.key];
        const set = (nv: unknown) => onChange({ ...step, args: { ...step.args, [p.key]: nv } });
        if (p.kind === "labels" || p.kind === "multi") {
          const opts = p.kind === "labels" ? LABELS : (p.options ?? MISSING);
          const cur = Array.isArray(v) ? (v as string[]) : [];
          return (
            <div key={p.key} className="flex flex-wrap items-center gap-1">
              <span className="w-16 font-mono text-[11px] text-muted-foreground">{p.key}</span>
              {opts.map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={cur.includes(o)}
                  onClick={() => set(cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o])}
                  className={cn("rounded border px-1.5 font-mono text-[11px]", cur.includes(o) ? "border-primary/50 bg-primary/10" : "border-border text-muted-foreground")}
                >
                  {o}
                </button>
              ))}
            </div>
          );
        }
        if (p.kind === "select" || ARG_INPUT[p.key]) {
          return (
            <label key={p.key} className="flex items-center gap-2 text-[13px]">
              <span className="w-16 font-mono text-[11px] text-muted-foreground">{p.key}</span>
              <select className="h-7 rounded-md border border-input bg-card px-2" value={String(v ?? "")} onChange={(e) => set(e.target.value || null)}>
                <option value="">none</option>
                {(p.options ?? ARG_INPUT[p.key] ?? []).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          );
        }
        if (p.kind === "longtext") {
          return (
            <label key={p.key} className="block text-[13px]">
              <span className="font-mono text-[11px] text-muted-foreground">{p.key}</span>
              <Textarea rows={3} value={String(v ?? "")} onChange={(e) => set(e.target.value || undefined)} />
            </label>
          );
        }
        return (
          <label key={p.key} className="flex items-center gap-2 text-[13px]">
            <span className="w-16 font-mono text-[11px] text-muted-foreground">{p.key}</span>
            <Input className="h-7" value={String(v ?? "")} onChange={(e) => set(e.target.value)} />
          </label>
        );
      })}
    </li>
  );
}

function CorrectionSheet({
  mode,
  initial,
  onClose,
  onSubmit,
  busy,
}: {
  mode: "edit" | "override" | null;
  initial: Step[];
  onClose: () => void;
  onSubmit: (steps: Step[], applyNow: boolean) => void;
  busy: boolean;
}) {
  const [steps, setSteps] = useState<Step[]>(initial);
  const [noApply, setNoApply] = useState(false);
  useEffect(() => {
    setSteps(initial);
    setNoApply(false);
  }, [initial, mode]);
  return (
    <Sheet open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? "Edit the values" : "What should happen instead?"}</SheetTitle>
          <SheetDescription>Your correction is saved as a regression test. The playbook has to pass it before it can be promoted again.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          {mode === "override" ? (
            <label className="flex items-center gap-2 rounded-md border border-border bg-card p-2.5 text-[13px]">
              <input type="checkbox" checked={noApply} onChange={(e) => setNoApply(e.target.checked)} className="accent-[hsl(var(--primary))]" />
              This playbook shouldn't apply here
            </label>
          ) : null}
          {!noApply ? (
            <>
              <ol className="space-y-2">
                {steps.map((s, i) => (
                  <StepRowEditor key={i} step={s} onChange={(ns) => setSteps(steps.map((x, j) => (j === i ? ns : x)))} onRemove={() => setSteps(steps.filter((_, j) => j !== i))} />
                ))}
              </ol>
              {mode === "override" ? (
                <Button size="sm" variant="ghost" onClick={() => setSteps([...steps, { action: "label-issue", args: { add: [], remove: [] } }])}>
                  + Add step
                </Button>
              ) : null}
            </>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => onSubmit(noApply ? [] : steps, false)} disabled={busy}>
              Save {mode === "edit" ? "edit" : "override"} as test
            </Button>
            {!noApply ? (
              <Button variant="outline" onClick={() => onSubmit(steps, true)} disabled={busy || steps.length === 0}>
                Save & apply my steps
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Review() {
  const qc = useQueryClient();
  useDbSync({ queryClient: qc, realtime: { reason: "agent runs update decisions while reviewing" } });
  const [params, setParams] = useSearchParams();
  const runsQ = useActionQuery("list-runs", { limit: 20 });
  const runs = runsQ.data?.runs ?? [];
  const runId = params.get("run") ?? runs.find((r) => (r.summary as Record<string, number>).pending)?.id ?? runs[0]?.id ?? "";
  const decisionsQ = useActionQuery("list-decisions", { runId, limit: 100 }, { enabled: !!runId });
  const decisions = decisionsQ.data?.decisions ?? [];
  const run = runs.find((r) => r.id === runId);
  const focusedId = params.get("decision") ?? decisions.find((d) => d.status === "pending")?.id ?? decisions[0]?.id ?? null;
  const index = Math.max(0, decisions.findIndex((d) => d.id === focusedId));
  const d = decisions[index];
  const [correction, setCorrection] = useState<"edit" | "override" | null>(null);
  const eligibilityQ = useActionQuery("get-promotion-eligibility", { playbookId: run?.playbookId ?? "" }, { enabled: !!run?.playbookId });

  function focus(id: string | undefined) {
    if (!id) return;
    const next = new URLSearchParams(params);
    if (runId) next.set("run", runId);
    next.set("decision", id);
    setParams(next, { replace: true });
  }

  useEffect(() => {
    void setClientAppState("selection", d ? { kind: "decision", ids: [d.id], issueId: d.issueId } : null);
  }, [d]);

  const review = useActionMutation("review-decision", {
    onSuccess: (r) => {
      if (r.demoted) toast.warning(`Apprentice stepped back to ${LEVEL_NAMES[r.demoted.to]}: ${r.demoted.reason}`);
      if (r.testNumber) toast.success(`Saved as test #${r.testNumber}`, { description: "The playbook must pass it before it can be promoted again." });
      else if (r.executed) toast.success("Approved and applied");
      setCorrection(null);
      const next = decisions.slice(index + 1).find((x) => x.status === "pending") ?? decisions.find((x) => x.status === "pending" && x.id !== d?.id);
      focus(next?.id);
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't save the review."),
  });
  const execute = useActionMutation("execute-decision", { onSuccess: () => toast.success("Applied"), onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't apply.") });
  const undoDecision = useActionMutation("undo-decision", {
    onSuccess: (r) => (r.conflicts.length ? toast.warning(r.conflicts[0]?.reason ?? "Kept newer changes") : toast.success("Undone")),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't undo."),
  });
  const undoRun = useActionMutation("undo-run", {
    onSuccess: (r) => (r.conflicts.length ? toast.warning(`Undid ${r.undone} steps; kept ${r.conflicts.length} newer changes.`) : toast.success(`Undid the whole run: ${r.undone} steps reverted.`)),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't undo the run."),
  });

  const pending = d?.status === "pending";
  const canApply = (d?.trustLevel ?? 0) >= 2;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!d || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target) || correction) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        focus(decisions[Math.max(0, Math.min(decisions.length - 1, index + (e.key === "j" ? 1 : -1)))]?.id);
      }
      if (!pending || review.isPending) return;
      if (e.key === "a") review.mutate({ decisionId: d.id, verdict: "approve", applyNow: canApply });
      else if (e.key === "s") review.mutate({ decisionId: d.id, verdict: "skip" });
      else if (e.key === "e") setCorrection("edit");
      else if (e.key === "o") setCorrection("override");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const stats = useMemo(() => {
    const reviewed = decisions.filter((x) => x.verdict && x.verdict !== "skipped");
    const approved = reviewed.filter((x) => x.verdict === "approved").length;
    return { reviewed: reviewed.length, approved, done: decisions.filter((x) => x.status !== "pending").length };
  }, [decisions]);
  const initialSteps = useMemo<Step[]>(() => (d ? d.steps.map((s) => ({ action: s.action, args: { ...s.args } })) : []), [d]);

  if (runsQ.isPending) return <RowsSkeleton className="p-6" rows={6} />;
  if (runsQ.error) return <div className="p-6"><ErrorState error={runsQ.error} onRetry={() => void runsQ.refetch()} /></div>;
  if (!runs.length)
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState
          title="Nothing to review yet"
          body="Run a playbook on untriaged issues. At Suggest level it only proposes — you review each decision here, and every correction becomes a test."
          action={<Link className="text-sm font-medium text-primary hover:underline" to="/playbooks">Open playbooks →</Link>}
        />
      </div>
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <label htmlFor="run" className="sr-only">Run</label>
        <select
          id="run"
          value={runId}
          onChange={(e) => setParams({ run: e.target.value })}
          className="h-8 max-w-xs rounded-md border border-input bg-card px-2 text-[13px]"
        >
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.playbookName} · {r.mode} · {timeAgo(r.startedAt)}
              {r.status === "undone" ? " · undone" : ""}
            </option>
          ))}
        </select>
        {run ? <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] uppercase">{run.mode}</span> : null}
        <div className="flex min-w-48 items-center gap-2 text-xs">
          <span className="text-muted-foreground">Agreement</span>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-ok" style={{ width: `${stats.reviewed ? (stats.approved / stats.reviewed) * 100 : 0}%` }} />
          </div>
          <span className="tabular">{stats.reviewed ? `${stats.approved}/${stats.reviewed}` : "—"}</span>
        </div>
        <span className="tabular text-xs text-muted-foreground">
          {decisions.length ? `${index + 1} / ${decisions.length}` : "0"} · {stats.done} done
        </span>
        {run && (run.summary as Record<string, number>).executed && run.status !== "undone" ? (
          <Button size="sm" variant="outline" className="ms-auto" onClick={() => undoRun.mutate({ runId })} disabled={undoRun.isPending}>
            <IconArrowBackUp className="size-3.5" /> Undo run
          </Button>
        ) : null}
      </div>

      {decisionsQ.isPending ? (
        <RowsSkeleton className="p-6" rows={5} />
      ) : !d ? (
        <div className="p-6">
          <EmptyState title="This run had no matching issues." body="Every untriaged issue was either already handled or didn't match the trigger." />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
          <article className="min-h-0 overflow-y-auto border-e border-border p-5">
            <p className="font-mono text-xs text-muted-foreground">#{d.number} · @{d.author}</p>
            <h1 className="mt-1 text-lg font-semibold">
              <Link to={`/issues/${d.issueId}`} className="hover:underline">{d.title}</Link>
            </h1>
            <div className="mt-2 flex flex-wrap gap-1">{d.labels.map((l) => <LabelChip key={l} label={l} />)}</div>
            <div className="mt-3 rounded-[10px] border border-border bg-card p-4">
              <Markdown text={d.body} />
            </div>
            <nav aria-label="Decisions" className="mt-5">
              <ol className="flex flex-wrap gap-1">
                {decisions.map((x, i) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => focus(x.id)}
                      aria-current={x.id === d.id}
                      title={`#${x.number} ${x.status}`}
                      className={cn(
                        "tabular h-6 min-w-6 rounded border px-1 font-mono text-[10px]",
                        x.id === d.id ? "border-primary" : "border-border",
                        x.verdict === "approved" && "bg-ok/15",
                        (x.verdict === "overridden" || x.verdict === "edited") && "bg-bad/15",
                        x.status === "executed" && "bg-ok/30",
                      )}
                    >
                      {i + 1}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </article>

          <section aria-label="What I'd do" className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="flex items-start gap-3">
                <ConfidenceRing value={d.confidence} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">What I'd do <span className="font-normal text-muted-foreground">· {d.playbookName}</span></p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground"><InlineMd text={d.explanation} /></p>
                </div>
              </div>
              {d.needsJudgment ? (
                <div className="rounded-md border border-param-agent/30 bg-param-agent/5 p-3 text-[13px]">
                  <p className="font-medium text-param-agent">✦ Waiting for the agent's judgment</p>
                  <p className="mt-1 text-muted-foreground">The agent answers the judgment question and writes agent-decides values. You can also approve it yourself.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() =>
                      sendToAgentChat({ message: `Resolve the judgments for Apprentice run ${runId}.`, context: `Follow the playbook-runner skill: get-issue for each awaiting decision, then call resolve-judgments once.`, submit: true, openSidebar: true })
                    }
                  >
                    <IconSparkles className="size-3.5" /> Ask Apprentice to resolve
                  </Button>
                </div>
              ) : null}
              {d.judgment ? <p className="text-[13px] text-param-agent">✦ Agent: {d.judgment.matches ? "applies" : "doesn't apply"} — {d.judgment.reason}</p> : null}
              <ResolvedSteps steps={d.steps} instructions={Object.fromEntries(d.steps.map((s) => [s.stepId, s.instructions]))} />
              {d.humanSteps ? (
                <div className="rounded-md border border-bad/30 bg-bad/5 p-3 text-[13px]">
                  <p className="font-medium">You said instead:</p>
                  {d.humanSteps.length ? <ResolvedSteps steps={d.humanSteps.map((s, i) => ({ stepId: `h${i}`, action: s.action, args: s.args, owners: Object.fromEntries(Object.keys(s.args).map((k) => [k, "fixed" as const])), checkpoint: false, destructive: false, pendingAgentParams: [] }))} /> : <p>This playbook shouldn't apply here.</p>}
                </div>
              ) : null}
              {!pending ? (
                <p className="text-[13px] text-muted-foreground">
                  {d.verdict ? `You ${d.verdict}` : `Status: ${d.status}`}
                  {d.reviewedAt ? ` · ${timeAgo(d.reviewedAt)}` : ""}
                  {d.status === "executed" ? " · applied" : ""}
                </p>
              ) : null}
              {stats.done === decisions.length && eligibilityQ.data?.eligible ? (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-[13px]">
                  <p className="font-medium">Batch reviewed — {d.playbookName} is ready for {LEVEL_NAMES[eligibilityQ.data.nextLevel ?? 0]}.</p>
                  <p className="text-muted-foreground">
                    {eligibilityQ.data.evidence.reviewed} reviewed · {pct(eligibilityQ.data.evidence.agreement)} agreement · {eligibilityQ.data.evidence.testsPassing} tests passing
                  </p>
                  <Link to={`/playbooks/${d.playbookId}`} className="mt-1 inline-block font-medium text-primary hover:underline">Promote →</Link>
                </div>
              ) : null}
            </div>
            <footer className="flex flex-wrap items-center gap-2 border-t border-border p-3">
              {pending ? (
                <>
                  <Button size="sm" onClick={() => review.mutate({ decisionId: d.id, verdict: "approve", applyNow: canApply })} disabled={review.isPending}>
                    <IconCheck className="size-3.5" /> {canApply ? "Approve & apply" : "Approve"} <kbd className="font-mono text-[10px] opacity-70">a</kbd>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCorrection("edit")}>
                    <IconPencil className="size-3.5" /> Edit <kbd className="font-mono text-[10px] opacity-60">e</kbd>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCorrection("override")}>
                    <IconX className="size-3.5" /> Override <kbd className="font-mono text-[10px] opacity-60">o</kbd>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => review.mutate({ decisionId: d.id, verdict: "skip" })} disabled={review.isPending}>
                    <IconPlayerSkipForward className="size-3.5" /> Skip <kbd className="font-mono text-[10px] opacity-60">s</kbd>
                  </Button>
                </>
              ) : d.status === "approved" && canApply ? (
                <Button size="sm" onClick={() => execute.mutate({ decisionId: d.id })} disabled={execute.isPending}>Apply now</Button>
              ) : d.status === "executed" ? (
                <Button size="sm" variant="outline" onClick={() => undoDecision.mutate({ decisionId: d.id })} disabled={undoDecision.isPending}>
                  <IconArrowBackUp className="size-3.5" /> Undo
                </Button>
              ) : null}
              <span className="ms-auto text-[11px] text-muted-foreground">j/k move</span>
            </footer>
          </section>
        </div>
      )}
      <CorrectionSheet
        mode={correction}
        initial={initialSteps}
        busy={review.isPending}
        onClose={() => setCorrection(null)}
        onSubmit={(steps, applyNow) => d && correction && review.mutate({ decisionId: d.id, verdict: correction, humanSteps: steps, applyNow })}
      />
    </div>
  );
}
