import { setClientAppState, useActionQuery, useDbSync } from "@agent-native/core/client/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useNavigate, useParams, useSearchParams } from "react-router";

import { PatternCards } from "@/components/apprentice/PatternCard";
import { ApprenticeGlyph, EmptyState, ErrorState, LabelChip, PriorityDot, RowsSkeleton, timeAgo } from "@/components/apprentice/primitives";
import { isTypingTarget } from "@/components/apprentice/WorkspaceChrome";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "untriaged", label: "Untriaged" },
  { id: "open", label: "All open" },
  { id: "needs-info", label: "Needs info" },
  { id: "closed", label: "Closed" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function paramsFor(filter: FilterId, q: string) {
  const base = q ? { q } : {};
  if (filter === "untriaged") return { state: "open" as const, untriaged: true, ...base };
  if (filter === "needs-info") return { state: "open" as const, label: "needs-info", ...base };
  if (filter === "closed") return { state: "closed" as const, ...base };
  return { state: "open" as const, ...base };
}

export default function QueueLayout() {
  const qc = useQueryClient();
  useDbSync({ queryClient: qc, realtime: { reason: "autopilot triages issues in the background" } });
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (FILTERS.find((f) => f.id === searchParams.get("filter"))?.id ?? "untriaged") as FilterId;
  const [q, setQ] = useState("");
  const params = useMemo(() => paramsFor(filter, q.trim()), [filter, q]);
  const { data, isPending, error, refetch } = useActionQuery("list-issues", params);
  const { issueId } = useParams();
  const navigate = useNavigate();
  const listRef = useRef<HTMLUListElement>(null);
  const [cursor, setCursor] = useState(0);
  const issues = data?.issues ?? [];

  useEffect(() => {
    const i = issues.findIndex((x) => x.id === issueId);
    if (i >= 0) setCursor(i);
  }, [issueId, issues]);

  useEffect(() => {
    const selected = issues[cursor];
    void setClientAppState("selection", selected ? { kind: "issues", ids: [selected.id], numbers: [selected.number] } : null);
  }, [cursor, issues]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target) || !issues.length) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        setCursor((c) => {
          const next = Math.max(0, Math.min(issues.length - 1, c + (e.key === "j" ? 1 : -1)));
          listRef.current?.querySelectorAll("a")[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "Enter" && issues[cursor] && !(e.target as HTMLElement).closest("a,button")) {
        navigate(`/issues/${issues[cursor]?.id}?filter=${filter}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [issues, cursor, navigate, filter]);

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-full max-w-[400px] shrink-0 flex-col border-e border-border bg-background md:w-[380px]">
        <div className="space-y-2 border-b border-border p-3">
          <div role="tablist" aria-label="Filter issues" className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setSearchParams({ filter: f.id })}
                className={cn(
                  "rounded-md px-2 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  filter === f.id ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <label htmlFor="issue-search" className="sr-only">
              Search issues
            </label>
            <Input id="issue-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or #number" className="h-8 ps-7" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-3 pb-0">
            <PatternCards />
          </div>
          {isPending ? (
            <RowsSkeleton className="p-3" rows={8} />
          ) : error ? (
            <div className="p-3">
              <ErrorState error={error} onRetry={() => void refetch()} />
            </div>
          ) : issues.length === 0 ? (
            <div className="p-3">
              <EmptyState
                title={filter === "untriaged" ? "Nothing untriaged. Nice." : "No issues here."}
                body={filter === "untriaged" ? "New issues land here. Apprentice's autopilot handles the ones your playbooks cover." : undefined}
              />
            </div>
          ) : (
            <ul ref={listRef} className="p-2" aria-label="Issues">
              {issues.map((issue, i) => (
                <li key={issue.id}>
                  <Link
                    to={`/issues/${issue.id}?filter=${filter}`}
                    aria-current={issue.id === issueId ? "page" : undefined}
                    onFocus={() => setCursor(i)}
                    className={cn(
                      "block rounded-md border border-transparent px-2.5 py-2 transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring",
                      issue.id === issueId && "border-border bg-card",
                      i === cursor && issue.id !== issueId && "bg-secondary/60",
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="tabular font-mono text-[11px] text-muted-foreground">#{issue.number}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{issue.title}</span>
                      {issue.matchedBy.length ? (
                        <span title={`Matched by ${issue.matchedBy.map((m) => m.name).join(", ")}`}>
                          <ApprenticeGlyph className="size-4 text-[9px]" />
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {issue.labels.map((l) => (
                        <LabelChip key={l} label={l} />
                      ))}
                      <PriorityDot priority={issue.priority} />
                      {issue.assignee ? <span className="font-mono text-[11px] text-muted-foreground">@{issue.assignee}</span> : null}
                      <span className="ms-auto text-[11px] text-muted-foreground">{timeAgo(issue.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          <kbd className="font-mono">j</kbd>/<kbd className="font-mono">k</kbd> move · <kbd className="font-mono">Enter</kbd> open · <kbd className="font-mono">?</kbd> help
          {data ? <span className="tabular float-end">{data.total} issues</span> : null}
        </p>
      </aside>
      <section className="hidden min-w-0 flex-1 md:block">
        <Outlet />
      </section>
    </div>
  );
}
