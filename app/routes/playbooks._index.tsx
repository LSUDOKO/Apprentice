import { useActionQuery } from "@agent-native/core/client/hooks";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { Link } from "react-router";

import { PatternCards } from "@/components/apprentice/PatternCard";
import { EmptyState, ErrorState, pct, RowsSkeleton, TrustLadder } from "@/components/apprentice/primitives";
import { InlineMd } from "@/components/apprentice/Steps";

export default function PlaybooksIndex() {
  const { data, isPending, error, refetch } = useActionQuery("list-playbooks", {});
  const playbooks = data?.playbooks ?? [];
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="max-w-xl">
        <PatternCards />
      </div>
      {isPending ? (
        <RowsSkeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : playbooks.length === 0 ? (
        <EmptyState
          title="No playbooks yet"
          body="Triage two similar issues by hand in the Queue. Apprentice notices the pattern and offers to turn it into a playbook you can edit, prove and promote."
          action={
            <Link to="/issues" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
              Go to the Queue →
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {playbooks.map((p) => (
            <li key={p.id}>
              <Link
                to={`/playbooks/${p.id}`}
                className="block h-full rounded-[10px] border border-border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium leading-snug">{p.name}</h2>
                  {p.eligible && p.nextLevel !== null ? (
                    <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">Ready to promote</span>
                  ) : p.status !== "active" ? (
                    <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">{p.status}</span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
                  When <InlineMd text={p.triggerText} />
                </p>
                <div className="mt-3">
                  <TrustLadder level={p.trustLevel} eligible={p.eligible} compact />
                </div>
                <dl className="tabular mt-3 grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Agreement</dt>
                    <dd className="font-medium">{p.stats.reviewed ? pct(p.stats.rollingAgreement) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Tests</dt>
                    <dd className="flex items-center gap-1 font-medium">
                      {p.stats.testsPassing === p.stats.testsTotal ? <IconCircleCheck className="size-3.5 text-ok" aria-label="all passing" /> : <IconCircleX className="size-3.5 text-bad" aria-label="failing" />}
                      {p.stats.testsPassing}/{p.stats.testsTotal}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Executed</dt>
                    <dd className="font-medium">{p.stats.executed}</dd>
                  </div>
                  <div title="Estimated">
                    <dt className="text-muted-foreground">Saved*</dt>
                    <dd className="font-medium">{p.minutesSaved}m</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
