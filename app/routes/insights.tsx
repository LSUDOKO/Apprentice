import { useActionMutation, useActionQuery, actionErrorMessage } from "@agent-native/core/client/hooks";
import { Link } from "react-router";
import { toast } from "sonner";

import { AreaChart, BarList, Donut, LineChart, Ring, Staircase } from "@/components/apprentice/Charts";
import { ErrorState, LEVEL_NAMES, pct, RowsSkeleton, timeAgo } from "@/components/apprentice/primitives";
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
  const mix = data.decisionMix;
  const reasons = Object.entries(data.exceptionsByReason).map(([k, v]) => ({ label: k.toLowerCase().replace(/_/g, " "), value: v }));
  const kpis = [
    { label: "Estimated time saved", value: t.minutesSaved >= 60 ? `${t.hoursSaved}h` : `${t.minutesSaved}m`, hint: data.method, ring: null },
    { label: "Handled by Apprentice", value: String(t.itemsHandled), hint: "Decisions executed in the last 30 days", ring: null },
    { label: "Agreement with you", value: t.agreement === null ? "—" : pct(t.agreement), hint: `${t.reviewed} reviewed decisions`, ring: t.agreement },
    { label: "Ghost suggestions taken", value: t.suggestionsShown ? `${t.suggestionsAccepted}/${t.suggestionsShown}` : "—", hint: "Tab-accepted next steps", ring: t.suggestionsShown ? t.suggestionsAccepted / t.suggestionsShown : null },
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Last 30 days</p>
          <h1 className="text-2xl font-semibold tracking-tight">What your apprentice did</h1>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => autopilot.mutate({ maxItems: 50 })} disabled={autopilot.isPending}>Run autopilot now</Button>
          <Button size="sm" onClick={() => build.mutate({})} disabled={build.isPending}>Build digest now</Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="glass-panel relative overflow-hidden rounded-[14px] border border-border bg-card p-4" title={k.hint}>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="tabular text-[32px] font-semibold leading-none tracking-tight">{k.value}</p>
              {k.ring !== null ? <Ring value={k.ring} /> : null}
            </div>
            <p className="mt-2 truncate text-[11px] text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="glass-panel rounded-[14px] border border-border bg-card p-5 lg:col-span-3" aria-labelledby="weekly">
          <div className="flex items-baseline justify-between">
            <h2 id="weekly" className="text-sm font-medium">Minutes saved per week</h2>
            <span className="text-[11px] text-muted-foreground">estimated*</span>
          </div>
          <AreaChart className="mt-3" unit="minutes" data={data.weekly.map((w) => ({ label: w.weekStart.slice(5), value: w.minutesSaved }))} />
        </section>
        <section className="glass-panel rounded-[14px] border border-border bg-card p-5 lg:col-span-2" aria-labelledby="mix">
          <h2 id="mix" className="text-sm font-medium">Decisions</h2>
          <Donut
            className="mt-4"
            center={String(mix.approved + mix.corrected + mix.pending)}
            sub="decisions"
            segments={[
              { label: "Approved by you", value: mix.approved, color: "hsl(var(--primary))" },
              { label: "Corrected (became tests)", value: mix.corrected, color: "var(--bad)" },
              { label: "Waiting for review", value: mix.pending, color: "hsl(var(--muted-foreground))" },
            ]}
          />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="glass-panel rounded-[14px] border border-border bg-card p-5 lg:col-span-3" aria-labelledby="trend">
          <h2 id="trend" className="text-sm font-medium">Agreement as you review</h2>
          <p className="text-[11px] text-muted-foreground">Running share of decisions you approved, per playbook. Dashed lines are the promotion gates.</p>
          <LineChart className="mt-3" series={data.agreementSeries} thresholds={[{ at: 0.8, label: "Draft gate 80%" }, { at: 0.9, label: "Auto gate 90%" }]} />
        </section>
        <section className="glass-panel rounded-[14px] border border-border bg-card p-5 lg:col-span-2" aria-labelledby="autonomy">
          <h2 id="autonomy" className="text-sm font-medium">Trust ladder</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">Playbooks at each level of autonomy.</p>
          <Staircase rungs={data.autonomy} />
        </section>
      </div>

      <section className="glass-panel rounded-[14px] border border-border bg-card p-5" aria-labelledby="exc">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="exc" className="text-sm font-medium">Why items still need you</h2>
          <Link to="/exceptions" className="text-xs text-muted-foreground hover:text-foreground">Open exceptions</Link>
        </div>
        <BarList items={reasons} />
      </section>
      <p className="text-xs text-muted-foreground" title={data.method}>* {data.method}</p>

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
