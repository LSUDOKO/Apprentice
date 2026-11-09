import { useActionQuery } from "@agent-native/core/client/hooks";
import { Link } from "react-router";

import { EmptyState, ErrorState, RowsSkeleton } from "@/components/apprentice/primitives";
import { cn } from "@/lib/utils";

const REASON: Record<string, { label: string; tone: string; help: string }> = {
  NO_MATCH: { label: "No playbook matches", tone: "border-border bg-muted text-muted-foreground", help: "Handle it by hand — that's a demonstration Apprentice can learn from." },
  LOW_CONFIDENCE: { label: "Low confidence", tone: "border-warn/40 bg-warn/10 text-warn", help: "A playbook matched but isn't sure. Review it." },
  CHECKPOINT_WAITING: { label: "Checkpoint waiting", tone: "border-warn/40 bg-warn/10 text-warn", help: "Acting playbook paused at a step you asked to approve." },
  AWAITING_JUDGMENT: { label: "Awaiting judgment", tone: "border-param-agent/40 bg-param-agent/10 text-param-agent", help: "The agent still has to answer the judgment question." },
  CONFLICT: { label: "Team conflict", tone: "border-bad/40 bg-bad/10 text-bad", help: "Teammates handle this kind of issue differently. Pick one." },
};

export default function Exceptions() {
  const { data, isPending, error, refetch } = useActionQuery("list-exceptions", { limit: 200 });
  if (isPending) return <RowsSkeleton className="p-6" rows={8} />;
  if (error || !data) return <div className="p-6"><ErrorState error={error} onRetry={() => void refetch()} /></div>;
  const groups = Object.keys(REASON).map((r) => ({ reason: r, items: data.items.filter((i) => i.reason === r) })).filter((g) => g.items.length);
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <p className="text-[13px] text-muted-foreground">Everything Apprentice handed back to you. Opening an issue and triaging it by hand is itself a demonstration.</p>
      {groups.length === 0 ? (
        <EmptyState title="No exceptions" body="Every open issue is covered by a playbook or already handled." />
      ) : (
        groups.map((g) => {
          const meta = REASON[g.reason]!;
          return (
            <section key={g.reason} aria-labelledby={`g-${g.reason}`}>
              <h2 id={`g-${g.reason}`} className="mb-2 flex items-center gap-2 text-sm font-medium">
                <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px]", meta.tone)}>{meta.label}</span>
                <span className="tabular text-muted-foreground">{g.items.length}</span>
                <span className="text-xs font-normal text-muted-foreground">— {meta.help}</span>
              </h2>
              <ul className="divide-y divide-border rounded-[10px] border border-border bg-card">
                {g.items.map((i, k) => (
                  <li key={`${i.issueId}-${k}`}>
                    <Link
                      to={i.reason === "CONFLICT" ? "/issues" : i.decisionId ? `/review?run=${i.runId}&decision=${i.decisionId}` : `/issues/${i.issueId}`}
                      className="flex items-center gap-3 px-3 py-2 text-[13px] hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {i.number ? <span className="tabular font-mono text-xs text-muted-foreground">#{i.number}</span> : null}
                      <span className="min-w-0 flex-1 truncate">{i.title}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">{i.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
