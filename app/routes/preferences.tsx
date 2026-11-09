import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { ErrorState, RowsSkeleton } from "@/components/apprentice/primitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function Section({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-border bg-card p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {description ? <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export default function Preferences() {
  const { data, isPending, error, refetch } = useActionQuery("get-settings", {});
  const update = useActionMutation("update-settings", { onSuccess: () => toast.success("Saved"), onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't save.") });
  const [repo, setRepo] = useState("");
  const importGh = useActionMutation("import-github-issues", {
    onSuccess: (r) => toast.success(`Imported ${r.imported} new issue(s) from ${r.repo} (${r.skipped} already there).`),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Import failed."),
  });
  const reset = useActionMutation("reset-demo", { onSuccess: () => toast.success("Demo reset: fresh data loaded."), onError: (e) => toast.error(actionErrorMessage(e) ?? "Reset failed.") });
  const simulate = useActionMutation("simulate-new-issues", {
    onSuccess: (r) => (r.added.length ? toast.success(`${r.added.length} new issues arrived.`) : toast.info("No more demo issues to deliver.")),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't add issues."),
  });
  const install = useActionMutation("install-autopilot", {
    onSuccess: (r) => toast.success(`Autopilot scheduled (${r.schedule}). Run it now from Settings › Automations.`),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't install the automation."),
  });
  if (isPending) return <RowsSkeleton className="p-6" rows={5} />;
  if (error || !data) return <div className="p-6"><ErrorState error={error} onRetry={() => void refetch()} /></div>;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Section title="Learning">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="watch" className="text-[13px] font-normal">
            <span className="block font-medium">Watch mode</span>
            <span className="text-muted-foreground">Record your own triage clicks as demonstrations.</span>
          </Label>
          <Switch id="watch" checked={data.watchMode} onCheckedChange={(v) => update.mutate({ watchMode: v })} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="support" className="text-[13px] font-normal">
            <span className="block font-medium">Min support</span>
            <span className="text-muted-foreground">Similar demonstrations needed before Apprentice proposes a playbook.</span>
          </Label>
          <select id="support" className="h-8 rounded-md border border-input bg-card px-2 text-[13px]" value={data.minSupport} onChange={(e) => update.mutate({ minSupport: Number(e.target.value) })}>
            {[2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
      </Section>

      <Section title="Trust thresholds" description={data.demoMode ? "Demo mode: lower bars so the ladder can be climbed in a short demo." : "Normal thresholds."}>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="demo" className="text-[13px] font-medium">Demo mode</Label>
          <Switch id="demo" checked={data.demoMode} onCheckedChange={(v) => update.mutate({ demoMode: v })} />
        </div>
        <table className="tabular w-full text-[13px]">
          <thead className="text-xs text-muted-foreground"><tr><th className="text-start font-medium">Promotion</th><th className="text-end font-medium">Reviewed</th><th className="text-end font-medium">Agreement</th><th className="text-end font-medium">Executed</th></tr></thead>
          <tbody>
            {([["Suggest → Draft", data.thresholds.toDraft], ["Draft → Act", data.thresholds.toAct], ["Act → Auto", data.thresholds.toAuto]] as const).map(([name, r]) => (
              <tr key={name}><td>{name}</td><td className="text-end">≥ {r.reviewed}</td><td className="text-end">≥ {Math.round(r.agreement * 100)}%</td><td className="text-end">{r.executed ? `≥ ${r.executed}` : "—"}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">All promotions also need every regression test passing and a human click. An override at Act or Auto steps the playbook back one level.</p>
      </Section>

      <Section title="Data" description="Apprentice keeps a local mirror; it never writes to GitHub.">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (repo.trim()) importGh.mutate({ repo: repo.trim(), limit: 30 });
          }}
        >
          <div className="min-w-56 flex-1">
            <Label htmlFor="repo" className="mb-1 block text-xs text-muted-foreground">Import open issues from a public GitHub repo</Label>
            <Input id="repo" placeholder="owner/name" value={repo} onChange={(e) => setRepo(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" disabled={!repo.trim() || importGh.isPending}>{importGh.isPending ? "Importing…" : "Import"}</Button>
        </form>
        {data.demoMode ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => simulate.mutate({ count: 4 })} disabled={simulate.isPending}>Simulate 4 new issues</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Reset demo…</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset the demo?</AlertDialogTitle>
                  <AlertDialogDescription>Deletes your issues, playbooks, runs, tests and demonstrations, then reloads the demo dataset.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep my data</AlertDialogCancel>
                  <AlertDialogAction onClick={() => reset.mutate({ confirm: "reset" })}>Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </Section>

      <Section title="Autopilot & digest" description="A scheduled automation runs your active playbooks on new issues, then posts a digest.">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => install.mutate({ schedule: "13 * * * *", enabled: true })} disabled={install.isPending}>Install hourly autopilot</Button>
          <Link to="/settings/automations" className="text-[13px] text-primary hover:underline">Open Automations (Run now) →</Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Slack: connect it under <Link className="underline" to="/settings">Settings › Messaging</Link>, then ask the agent in Slack to “post the Apprentice digest here every hour”. Digests always appear on the Insights page, with or without Slack.
        </p>
      </Section>

      <Section title="Use Apprentice from Claude, ChatGPT or Cursor" description="Apprentice's actions are served over MCP. Featured tools: list-playbooks, run-playbook, review-batch, get-insights, export-skill.">
        <ol className="list-decimal space-y-1 ps-5 text-[13px]">
          <li>Add a custom connector in your chat app with this URL: <code className="rounded bg-muted px-1 font-mono text-xs">{origin}/mcp</code></li>
          <li>Sign in when asked. Then try: “review today's Apprentice batch”.</li>
          <li>For the inline review card, turn on <em>App cards in chat apps</em> in Settings › Labs and reconnect. Without it you get a deep link to the review screen.</li>
        </ol>
      </Section>
    </div>
  );
}
