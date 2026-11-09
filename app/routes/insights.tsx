import { useActionMutation, useActionQuery, actionErrorMessage } from "@agent-native/core/client/hooks";
import { Link } from "react-router";
import { toast } from "sonner";

import { ErrorState, LEVEL_NAMES, pct, RowsSkeleton, Stat, timeAgo } from "@/components/apprentice/primitives";
import { Markdown } from "@/components/apprentice/Steps";
import { Button } from "@/components/ui/button";

export default function Insights() {
  const { data, isPending, error, refetch } = useActionQuery("get-insights", { rangeDays: 30 });
  const digests = useActionQuery("list-digests", { limit: 5 });
  const build = useActionMutation("build-digest", { onSuccess: () => toast.success("Digest built"), onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't build the digest.") });
  const autopilot = useActionMutation("run-autopilot", {
    onSuccess: (r) => toast.success(`Autopilot ran ${r.playbooksRun} playbook(s)`),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Autopilot failed."),
  });
  if (isPending) return <RowsSkeleton className="p-6" rows={6} />;
  if (error || !data) return <div className="p-6"><ErrorState error={error} onRetry={() => void refetch()} /></div>;
  const t = data.totals;
  const maxWeek = Math.max(1, ...data.weekly.map((w) => w.minutesSaved));
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Estimated time saved" value={t.minutesSaved >= 60 ? `${t.hoursSaved}h` : `${t.minutesSaved}m`} hint={data.method} />
        <Stat label="Items handled by Apprentice" value={t.itemsHandled} />
        <Stat label="Agreement (30d)" value={t.agreement === null ? "—" : pct(t.agreement)} hint={`${t.reviewed} reviewed decisions`} />
        <Stat label="Suggestions accepted" value={t.suggestionsShown ? `${t.suggestionsAccepted}/${t.suggestionsShown}` : "—"} />
      </div>
      <p className="text-xs text-muted-foreground" title={data.method}>* {data.method}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[10px] border border-border bg-card p-4" aria-labelledby="weekly">
          <h2 id="weekly" className="text-sm font-medium">Minutes saved per week (estimated)</h2>
          <div className="mt-4 flex items-end gap-3" role="img" aria-label={data.weekly.map((w) => `${w.weekStart}: ${w.minutesSaved} minutes`).join(", ")}>
            {data.weekly.map((w) => (
              <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1">
                <span className="tabular text-[11px] text-muted-foreground">{w.minutesSaved}</span>
                <div className="flex h-24 w-full items-end">
                  <div className="w-full rounded-t-sm bg-primary/80" style={{ height: `${(w.minutesSaved / maxWeek) * 100}%`, minHeight: w.minutesSaved ? 3 : 1 }} />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{w.weekStart.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-[10px] border border-border bg-card p-4" aria-labelledby="autonomy">
          <h2 id="autonomy" className="text-sm font-medium">Autonomy</h2>
          <ul className="mt-3 space-y-1.5">
            {data.autonomy.map((a) => (
              <li key={a.level} className="flex items-center gap-2 text-[13px]">
                <span className="w-16 text-muted-foreground">{a.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${(a.count / Math.max(1, data.perPlaybook.length)) * 100}%` }} />
                </div>
                <span className="tabular w-6 text-end">{a.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="per-pb">
        <h2 id="per-pb" className="mb-2 text-sm font-medium">Per playbook</h2>
        <div className="overflow-x-auto rounded-[10px] border border-border bg-card">
          <table className="tabular w-full text-[13px]">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-medium">Playbook</th>
                <th className="px-3 py-2 text-start font-medium">Level</th>
                <th className="px-3 py-2 text-end font-medium">Agreement</th>
                <th className="px-3 py-2 text-end font-medium">Executed</th>
                <th className="px-3 py-2 text-end font-medium">Median human time</th>
                <th className="px-3 py-2 text-end font-medium">Saved*</th>
              </tr>
            </thead>
            <tbody>
              {data.perPlaybook.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2"><Link to={`/playbooks/${p.id}`} className="hover:underline">{p.name}</Link></td>
                  <td className="px-3 py-2">{LEVEL_NAMES[p.trustLevel]}</td>
                  <td className="px-3 py-2 text-end">{pct(p.agreement)}</td>
                  <td className="px-3 py-2 text-end">{p.executed}</td>
                  <td className="px-3 py-2 text-end">{p.medianHumanSec ? `${p.medianHumanSec}s` : "—"}</td>
                  <td className="px-3 py-2 text-end">{p.minutesSaved}m</td>
                </tr>
              ))}
              {data.perPlaybook.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-4 text-muted-foreground">No playbooks yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="digests" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="digests" className="text-sm font-medium">Digests</h2>
          <span className="text-xs text-muted-foreground">The scheduled autopilot posts one after each run (to Slack when Messaging is set up).</span>
          <div className="ms-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => autopilot.mutate({ maxItems: 50 })} disabled={autopilot.isPending}>Run autopilot now</Button>
            <Button size="sm" onClick={() => build.mutate({})} disabled={build.isPending}>Build digest now</Button>
          </div>
        </div>
        {(digests.data?.digests ?? []).length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No digests yet.</p>
        ) : (
          <ul className="space-y-2">
            {digests.data?.digests.map((g) => (
              <li key={g.id} className="rounded-[10px] border border-border bg-card p-3">
                <p className="mb-1 text-xs text-muted-foreground">{timeAgo(g.createdAt)} · delivered: {g.deliveredTo.join(", ")}</p>
                <Markdown text={g.body} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
