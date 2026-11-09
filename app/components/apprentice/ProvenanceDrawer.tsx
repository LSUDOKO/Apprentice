import { useActionQuery } from "@agent-native/core/client/hooks";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { Link } from "react-router";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { PlainSteps } from "./Steps";
import { ErrorState, LEVEL_NAMES, RowsSkeleton, timeAgo } from "./primitives";

function Body({ decisionId }: { decisionId: string }) {
  const { data, isPending, error, refetch } = useActionQuery("explain-decision", { decisionId });
  if (isPending) return <RowsSkeleton rows={5} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const { decision, playbook, conditions, demonstrations, auditEvents, tests } = data;
  return (
    <div className="space-y-5 text-sm">
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Playbook</h3>
        <p className="mt-1">
          <Link className="font-medium underline-offset-2 hover:underline" to={`/playbooks/${playbook.id}`}>
            {playbook.name}
          </Link>{" "}
          <span className="font-mono text-xs text-muted-foreground">
            v{playbook.version}
            {playbook.currentVersion !== playbook.version ? ` (now v${playbook.currentVersion})` : ""} · {LEVEL_NAMES[playbook.trustLevel]}
          </span>
        </p>
        <p className="mt-1 text-muted-foreground">
          Confidence {decision.confidence}% · tests {tests.passing}/{tests.total} passing · {decision.verdict ? `you ${decision.verdict}` : decision.status}
          {decision.reviewer ? ` (${decision.reviewer})` : ""}
        </p>
      </section>
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why it matched #{decision.number}</h3>
        <ul className="mt-1 space-y-1">
          {conditions.map((c, i) => (
            <li key={i} className="flex items-start gap-2">
              {c.pass ? <IconCircleCheck className="mt-0.5 size-4 text-ok" aria-label="passed" /> : <IconCircleX className="mt-0.5 size-4 text-bad" aria-label="failed" />}
              <span>
                {c.text} <span className="font-mono text-xs text-muted-foreground">(was {String(c.actual ?? "empty")})</span>
              </span>
            </li>
          ))}
        </ul>
        {decision.judgment ? <p className="mt-2 text-param-agent">✦ Agent judged: {decision.judgment.matches ? "applies" : "doesn't apply"} — {decision.judgment.reason}</p> : null}
      </section>
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Who taught me this</h3>
        {demonstrations.length ? (
          <ol className="mt-2 space-y-3">
            {demonstrations.map((d) => (
              <li key={d.episodeId} className="rounded-md border border-border p-2.5">
                <p>
                  <span className="font-medium">{d.actorEmail}</span> on{" "}
                  <Link className="underline-offset-2 hover:underline" to={`/issues/${d.issueId}`}>
                    #{d.number} {d.title}
                  </Link>{" "}
                  <span className="text-xs text-muted-foreground">· {timeAgo(d.at)} · {d.source === "lesson" ? "recorded lesson" : "watched"}</span>
                </p>
                <div className="mt-1.5">
                  <PlainSteps steps={d.steps} />
                </div>
                {d.narration ? <p className="mt-1.5 italic text-muted-foreground">“{d.narration}”</p> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-muted-foreground">This playbook was written by hand.</p>
        )}
      </section>
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Audit log on this issue</h3>
        {auditEvents.length ? (
          <ul className="mt-1 space-y-1 font-mono text-xs">
            {auditEvents.slice(0, 10).map((e) => (
              <li key={e.id} className="flex gap-2">
                <span className="text-muted-foreground">{timeAgo(e.createdAt)}</span>
                <span>{e.action}</span>
                <span className="text-muted-foreground">
                  {e.actorKind}/{e.caller} · {e.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted-foreground">No framework audit events recorded for this issue yet.</p>
        )}
      </section>
    </div>
  );
}

/** "Who taught you this?" (F10). */
export function ProvenanceDrawer({ decisionId, onClose }: { decisionId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!decisionId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Who taught me this?</SheetTitle>
          <SheetDescription>The playbook, the conditions that matched, and the demonstrations it was learned from.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">{decisionId ? <Body decisionId={decisionId} /> : null}</div>
      </SheetContent>
    </Sheet>
  );
}
