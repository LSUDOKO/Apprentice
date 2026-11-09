import { useActionQuery } from "@agent-native/core/client/hooks";
import { Link, useSearchParams } from "react-router";

import { ErrorState, LabelChip, RowsSkeleton, timeAgo } from "@/components/apprentice/primitives";
import { Markdown } from "@/components/apprentice/Steps";

function Pane({ issueId }: { issueId: string }) {
  const { data, isPending, error } = useActionQuery("get-issue", { issueId });
  if (isPending) return <RowsSkeleton rows={4} />;
  if (error || !data) return <ErrorState error={error} />;
  return (
    <article className="min-w-0 space-y-3">
      <p className="font-mono text-xs text-muted-foreground">#{data.issue.number} · @{data.issue.author}</p>
      <h2 className="font-semibold"><Link to={`/issues/${issueId}`} className="hover:underline">{data.issue.title}</Link></h2>
      <div className="flex flex-wrap gap-1">{data.issue.labels.map((l) => <LabelChip key={l} label={l} />)}</div>
      <div className="rounded-[10px] border border-border bg-card p-3"><Markdown text={data.issue.body} /></div>
      <ol className="space-y-1 text-[13px]">
        {data.activity.map((a) => (
          <li key={a.id}>
            <span className="font-medium">{a.actorKind === "human" ? a.actorEmail.split("@")[0] : "Apprentice"}</span> <span className="text-muted-foreground">{a.summary} · {timeAgo(a.createdAt)}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

export default function Compare() {
  const [params] = useSearchParams();
  const a = params.get("a");
  const b = params.get("b");
  if (!a || !b) return <div className="p-6 text-[13px] text-muted-foreground">Ask Apprentice to compare two issues (it opens them here side by side).</div>;
  return (
    <div className="grid gap-6 p-6 lg:grid-cols-2">
      <Pane issueId={a} />
      <Pane issueId={b} />
    </div>
  );
}
