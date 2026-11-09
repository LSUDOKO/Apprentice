import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { IconMessage, IconCopy as IconDuplicate, IconCircleX, IconHelpCircle } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { GhostChip } from "@/components/apprentice/GhostChip";
import { ApprenticeGlyph, ErrorState, LabelChip, RowsSkeleton, timeAgo } from "@/components/apprentice/primitives";
import { ProvenanceDrawer } from "@/components/apprentice/ProvenanceDrawer";
import { Markdown } from "@/components/apprentice/Steps";
import { ASSIGNEES, COMPONENTS, LABELS, MISSING, PRIORITIES, reproMessage } from "@/components/apprentice/vocab";
import { isTypingTarget } from "@/components/apprentice/WorkspaceChrome";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function useDomain(name: "label-issue" | "set-priority" | "set-component" | "assign-issue" | "comment-on-issue" | "request-repro" | "mark-duplicate" | "close-issue" | "reopen-issue", ok?: string) {
  return useActionMutation(name, {
    onSuccess: (r: { demonstration?: boolean }) => {
      if (ok) toast.success(ok, { description: r?.demonstration ? "Recorded as a demonstration" : undefined });
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "That didn't work."),
  });
}

const selectClass =
  "h-8 w-full rounded-md border border-input bg-card px-2 text-[13px] focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60";

export default function IssueDetail() {
  const { issueId = "" } = useParams();
  const { data, isPending, error, refetch } = useActionQuery("get-issue", { issueId });
  const [why, setWhy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"repro" | "duplicate" | "close" | null>(null);
  const [comment, setComment] = useState("");
  const labelRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLSelectElement>(null);
  const endDemo = useActionMutation("end-demonstration", { skipActionQueryInvalidation: false });

  const label = useDomain("label-issue");
  const priority = useDomain("set-priority");
  const component = useDomain("set-component");
  const assign = useDomain("assign-issue");
  const commentM = useDomain("comment-on-issue", "Comment posted");
  const reopen = useDomain("reopen-issue", "Issue reopened");

  // Leaving an issue completes the demonstration on it.
  useEffect(() => {
    return () => {
      if (issueId) endDemo.mutate({ issueId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "l") {
        e.preventDefault();
        labelRef.current?.querySelector("button")?.focus();
      } else if (e.key === "p") {
        e.preventDefault();
        priorityRef.current?.focus();
      } else if (e.key === "r" && data?.issue.state === "open") {
        e.preventDefault();
        setDialog("repro");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data?.issue.state]);

  if (isPending) return <RowsSkeleton className="p-6" rows={7} />;
  if (error || !data)
    return (
      <div className="p-6">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  const { issue, comments, activity, latestDecision } = data;
  const open = issue.state === "open";
  const busy = label.isPending || priority.isPending || component.isPending || assign.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-5xl gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_240px]">
          <article className="min-w-0">
            <header>
              <p className="font-mono text-xs text-muted-foreground">
                {issue.repo} #{issue.number} · {issue.source === "seed" ? "demo data" : issue.source}
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">{issue.title}</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">@{issue.author}</span> opened {timeAgo(issue.createdAt)} ·{" "}
                <span className={cn("font-medium", open ? "text-ok" : "text-muted-foreground")}>{open ? "Open" : `Closed${issue.closeReason ? ` as ${issue.closeReason}` : ""}`}</span>
              </p>
            </header>
            <div className="mt-4 rounded-[10px] border border-border bg-card p-4">
              <Markdown text={issue.body} />
            </div>

            <section className="mt-6" aria-label="Comments">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Comments</h2>
              <ul className="mt-2 space-y-2">
                {comments.map((c) => (
                  <li key={c.id} className={cn("rounded-[10px] border border-border bg-card p-3", c.retracted && "opacity-50")}>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      {c.byAgent ? <ApprenticeGlyph className="size-4 text-[9px]" /> : null}
                      <span className="font-medium text-foreground">{c.byAgent ? "Apprentice" : c.author}</span> · {timeAgo(c.createdAt)}
                      {c.retracted ? <span className="rounded border border-border px-1">retracted by undo</span> : null}
                    </p>
                    <div className={cn("mt-1", c.retracted && "line-through")}>
                      <Markdown text={c.body} />
                    </div>
                  </li>
                ))}
                {comments.length === 0 ? <li className="text-[13px] text-muted-foreground">No comments yet.</li> : null}
              </ul>
              {open ? (
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!comment.trim()) return;
                    commentM.mutate({ issueId, body: comment.trim() }, { onSuccess: () => setComment("") });
                  }}
                >
                  <Label htmlFor="comment" className="sr-only">
                    Comment
                  </Label>
                  <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Leave a comment…" rows={3} />
                  <Button type="submit" size="sm" variant="outline" disabled={!comment.trim() || commentM.isPending}>
                    <IconMessage className="size-3.5" /> Comment
                  </Button>
                </form>
              ) : null}
            </section>

            <section className="mt-6" aria-label="Activity">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activity</h2>
              <ol className="mt-2 space-y-1.5 border-s border-border ps-4">
                {activity.map((a) => (
                  <li key={a.id} className="relative text-[13px]">
                    <span className="absolute -start-[21px] top-0.5">
                      {a.actorKind === "human" ? (
                        <span className="flex size-[11px] rounded-full border border-border bg-card" aria-hidden />
                      ) : (
                        <ApprenticeGlyph className="size-[11px] rounded-[3px] text-[0px]" />
                      )}
                    </span>
                    <span className="font-medium">{a.actorKind === "human" ? (a.actorEmail.split("@")[0] ?? a.actorEmail) : a.actorKind === "automation" ? "Autopilot" : "Apprentice"}</span>{" "}
                    <span className="text-muted-foreground">{a.summary}</span> <span className="text-xs text-muted-foreground">· {timeAgo(a.createdAt)}</span>
                    {a.demonstration ? <span className="ms-2 rounded border border-primary/30 px-1 text-[10px] text-primary">Recorded as demonstration</span> : null}
                    {a.decisionId ? (
                      <button type="button" className="ms-2 text-xs text-primary underline-offset-2 hover:underline" onClick={() => setWhy(a.decisionId)}>
                        Why?
                      </button>
                    ) : null}
                  </li>
                ))}
                {activity.length === 0 ? <li className="text-[13px] text-muted-foreground">Nothing yet.</li> : null}
              </ol>
            </section>
          </article>

          <aside data-triage className="space-y-4 text-[13px]" aria-label="Triage">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Labels <kbd className="font-mono text-[10px]">l</kbd>
              </p>
              <div ref={labelRef} className="flex flex-wrap gap-1">
                {LABELS.map((l) => {
                  const on = issue.labels.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      disabled={!open || busy}
                      aria-pressed={on}
                      onClick={() => label.mutate({ issueId, add: on ? [] : [l], remove: on ? [l] : [] })}
                      className={cn("rounded-md focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60", !on && "opacity-55 hover:opacity-100")}
                    >
                      <LabelChip label={on ? l : `+ ${l}`} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label htmlFor="priority" className="mb-1.5 block text-xs text-muted-foreground">
                Priority <kbd className="font-mono text-[10px]">p</kbd>
              </Label>
              <select
                id="priority"
                ref={priorityRef}
                className={selectClass}
                disabled={!open || busy}
                value={issue.priority ?? ""}
                onChange={(e) => priority.mutate({ issueId, priority: (e.target.value || null) as "p0" | "p1" | "p2" | "p3" | null })}
              >
                <option value="">None</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="component" className="mb-1.5 block text-xs text-muted-foreground">
                Component
              </Label>
              <select id="component" className={selectClass} disabled={!open || busy} value={issue.component ?? ""} onChange={(e) => component.mutate({ issueId, component: e.target.value || null })}>
                <option value="">None</option>
                {COMPONENTS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="assignee" className="mb-1.5 block text-xs text-muted-foreground">
                Assignee
              </Label>
              <select id="assignee" className={selectClass} disabled={!open || busy} value={issue.assignee ?? ""} onChange={(e) => assign.mutate({ issueId, assignee: e.target.value || null })}>
                <option value="">Nobody</option>
                {ASSIGNEES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-md border border-border bg-card p-2.5 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">What Apprentice sees</p>
              <p>
                kind <span className="font-mono text-foreground">{issue.features.kind}</span> · version <span className="font-mono text-foreground">{issue.features.versionMentioned ?? "none"}</span>
              </p>
              <p>
                repro <span className="font-mono text-foreground">{issue.features.hasRepro ? "yes" : "no"}</span> · stack trace{" "}
                <span className="font-mono text-foreground">{issue.features.hasStackTrace ? "yes" : "no"}</span> · code{" "}
                <span className="font-mono text-foreground">{issue.features.hasCodeBlock ? "yes" : "no"}</span>
              </p>
              {latestDecision ? (
                <p className="mt-1.5">
                  Latest decision:{" "}
                  <Link className="text-primary underline-offset-2 hover:underline" to={`/review?run=${latestDecision.runId}&decision=${latestDecision.id}`}>
                    {latestDecision.verdict ?? latestDecision.status}
                  </Link>{" "}
                  ·{" "}
                  <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setWhy(latestDecision.id)}>
                    Why?
                  </button>
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      <footer data-triage className="flex flex-wrap items-center gap-2 border-t border-border bg-background px-4 py-2.5" aria-label="Actions">
        {open ? <GhostChip issueId={issueId} /> : null}
        <div className="ms-auto flex flex-wrap gap-2">
          {open ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setDialog("repro")}>
                <IconHelpCircle className="size-3.5" /> Request repro <kbd className="font-mono text-[10px] opacity-60">r</kbd>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog("duplicate")}>
                <IconDuplicate className="size-3.5" /> Mark duplicate
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog("close")}>
                <IconCircleX className="size-3.5" /> Close
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => reopen.mutate({ issueId })} disabled={reopen.isPending}>
              Reopen
            </Button>
          )}
        </div>
      </footer>

      <ReproDialog open={dialog === "repro"} onOpenChange={(o) => setDialog(o ? "repro" : null)} issueId={issueId} author={issue.author} />
      <DuplicateDialog open={dialog === "duplicate"} onOpenChange={(o) => setDialog(o ? "duplicate" : null)} issueId={issueId} />
      <CloseDialog open={dialog === "close"} onOpenChange={(o) => setDialog(o ? "close" : null)} issueId={issueId} />
      <ProvenanceDrawer decisionId={why} onClose={() => setWhy(null)} />
    </div>
  );
}

function ReproDialog({ open, onOpenChange, issueId, author }: { open: boolean; onOpenChange: (o: boolean) => void; issueId: string; author: string }) {
  const [missing, setMissing] = useState<string[]>(["version", "steps"]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (open) setMessage(reproMessage(author, missing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, author]);
  const m = useDomain("request-repro", "Asked the reporter for details");
  function toggle(x: string) {
    const next = missing.includes(x) ? missing.filter((y) => y !== x) : [...missing, x];
    setMissing(next);
    setMessage(reproMessage(author, next));
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a reproduction</DialogTitle>
          <DialogDescription>Adds needs-info and asks @{author} for what's missing.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!missing.length) return;
            m.mutate({ issueId, missing: missing as ("version" | "steps" | "logs" | "environment")[], ...(message.trim() ? { message: message.trim() } : {}) }, { onSuccess: () => onOpenChange(false) });
          }}
        >
          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-1 text-xs text-muted-foreground">What's missing?</legend>
            {MISSING.map((x) => (
              <label key={x} className="inline-flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={missing.includes(x)} onChange={() => toggle(x)} className="accent-[hsl(var(--primary))]" /> {x}
              </label>
            ))}
          </fieldset>
          <div>
            <Label htmlFor="repro-message" className="mb-1 block text-xs text-muted-foreground">
              Message
            </Label>
            <Textarea id="repro-message" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!missing.length || m.isPending}>
              Request repro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateDialog({ open, onOpenChange, issueId }: { open: boolean; onOpenChange: (o: boolean) => void; issueId: string }) {
  const [target, setTarget] = useState("");
  const m = useDomain("mark-duplicate", "Closed as duplicate");
  const num = Number(target.replace("#", ""));
  const id = target.startsWith("seed-") || target.startsWith("gh_") ? target : Number.isFinite(num) && num > 0 ? `seed-${String(num).padStart(3, "0")}` : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as duplicate</DialogTitle>
          <DialogDescription>Closes this issue and links the original. This is a destructive step.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (id) m.mutate({ issueId, duplicateOfId: id }, { onSuccess: () => onOpenChange(false) });
          }}
        >
          <Label htmlFor="dup-of" className="block text-xs text-muted-foreground">
            Original issue (number or id)
          </Label>
          <Input id="dup-of" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="#5" autoFocus />
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={!id || m.isPending}>
              Close as duplicate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({ open, onOpenChange, issueId }: { open: boolean; onOpenChange: (o: boolean) => void; issueId: string }) {
  const [reason, setReason] = useState<"completed" | "invalid" | "wontfix">("invalid");
  const m = useDomain("close-issue", "Issue closed");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close issue</DialogTitle>
          <DialogDescription>Pick why. Apprentice learns from this too.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate({ issueId, reason }, { onSuccess: () => onOpenChange(false) });
          }}
        >
          <fieldset className="flex gap-4">
            <legend className="sr-only">Reason</legend>
            {(["completed", "invalid", "wontfix"] as const).map((r) => (
              <label key={r} className="inline-flex items-center gap-1.5 text-sm">
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-[hsl(var(--primary))]" /> {r}
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={m.isPending}>
              Close as {reason}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

