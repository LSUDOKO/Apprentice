import { IconAlertTriangle, IconFlag, IconRefresh } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { ParamOwner } from "../../../server/apprentice/engine/types";

export const LEVEL_NAMES = ["Watch", "Suggest", "Draft", "Act", "Auto"] as const;

export const OWNER_META: Record<ParamOwner, { glyph: string; label: string; className: string }> = {
  fixed: { glyph: "◆", label: "Fixed", className: "text-param-fixed border-param-fixed/40 bg-param-fixed/10" },
  fromItem: { glyph: "⇢", label: "From issue", className: "text-param-item border-param-item/40 bg-param-item/10" },
  agent: { glyph: "✦", label: "Agent decides", className: "text-param-agent border-param-agent/40 bg-param-agent/10" },
};

export function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** A parameter value with its owner shown by glyph + text + color (never color alone). */
export function ParamChip({ name, owner, value, pending }: { name: string; owner: ParamOwner; value?: ReactNode; pending?: boolean }) {
  const meta = OWNER_META[owner];
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 text-[13px]">
      <span className="font-mono text-xs text-muted-foreground">{name}</span>
      <span className={cn("inline-flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs", meta.className)} title={meta.label}>
        <span aria-hidden>{meta.glyph}</span>
        <span className="sr-only">{meta.label}:</span>
        <span className="truncate">{pending ? (owner === "agent" ? "agent writes at run time" : "—") : value}</span>
      </span>
    </span>
  );
}

export function OwnerLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {(Object.keys(OWNER_META) as ParamOwner[]).map((o) => (
        <span key={o} className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5", OWNER_META[o].className)}>
          <span aria-hidden>{OWNER_META[o].glyph}</span> {OWNER_META[o].label}
        </span>
      ))}
    </div>
  );
}

/** Five connected segments: Watch · Suggest · Draft · Act · Auto. */
export function TrustLadder({ level, eligible, compact, evidence }: { level: number; eligible?: boolean; compact?: boolean; evidence?: string }) {
  const body = compact ? (
    <span className="inline-flex items-center gap-1" aria-label={`Trust level ${LEVEL_NAMES[level]}`}>
      {LEVEL_NAMES.map((name, i) => (
        <span
          key={name}
          className={cn(
            "size-2 rounded-full border",
            i <= level ? "border-primary bg-primary" : i === level + 1 && eligible ? "border-dashed border-primary" : "border-border bg-muted",
          )}
        />
      ))}
      <span className="ms-1 text-xs font-medium">{LEVEL_NAMES[level]}</span>
    </span>
  ) : (
    <ol className="flex items-stretch overflow-hidden rounded-md border border-border text-xs" aria-label={`Trust level ${LEVEL_NAMES[level]}`}>
      {LEVEL_NAMES.map((name, i) => {
        const active = i <= level;
        const next = i === level + 1;
        return (
          <li
            key={name}
            aria-current={i === level ? "step" : undefined}
            className={cn(
              "flex items-center gap-1 border-e border-border px-2.5 py-1 last:border-e-0",
              active ? "bg-primary font-medium text-primary-foreground" : "bg-card text-muted-foreground",
              next && eligible && "outline-1 -outline-offset-2 outline-dashed outline-primary text-primary",
            )}
          >
            <span className="font-mono text-[10px] opacity-70">{i}</span>
            {name}
            {next && eligible ? <span className="font-medium">· Ready</span> : null}
          </li>
        );
      })}
    </ol>
  );
  if (!evidence) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-ring">
          {body}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs whitespace-pre-line">{evidence}</TooltipContent>
    </Tooltip>
  );
}

export function LabelChip({ label }: { label: string }) {
  const tone =
    label === "bug" || label === "p1-crash"
      ? "border-bad/30 bg-bad/10 text-bad"
      : label === "needs-info"
        ? "border-warn/30 bg-warn/10 text-warn"
        : label === "invalid" || label === "duplicate"
          ? "border-border bg-muted text-muted-foreground"
          : label === "feature" || label === "good first issue"
            ? "border-param-item/30 bg-param-item/10 text-param-item"
            : "border-border bg-secondary text-secondary-foreground";
  return <span className={cn("inline-flex items-center rounded-md border px-1.5 py-px text-[11px] font-medium", tone)}>{label}</span>;
}

export function PriorityDot({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const tone = priority === "p0" || priority === "p1" ? "bg-bad" : priority === "p2" ? "bg-warn" : "bg-param-fixed";
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground" title={`Priority ${priority}`}>
      <span className={cn("size-1.5 rounded-full", tone)} aria-hidden />
      {priority}
    </span>
  );
}

export function CheckpointFlag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-warn/40 bg-warn/10 px-1.5 py-px text-[11px] font-medium text-warn">
      <IconFlag className="size-3" aria-hidden /> Checkpoint
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="rounded-md border border-dashed border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide text-muted-foreground" title="Invented demo data">
      Demo data
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string | undefined; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[10px] border border-dashed border-border bg-card/50 p-6">
      <p className="text-sm font-medium">{title}</p>
      {body ? <p className="max-w-prose text-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div role="alert" className="flex items-start gap-3 rounded-[10px] border border-bad/30 bg-bad/5 p-4 text-sm">
      <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Couldn't load this.</p>
        <p className="mt-0.5 break-words text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <IconRefresh className="size-3.5" /> Retry
        </Button>
      ) : null}
    </div>
  );
}

export function RowsSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "ok" | "bad" | "warn" }) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-3" title={hint}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1 text-[28px] font-semibold leading-none tracking-tight", tone === "ok" && "text-ok", tone === "bad" && "text-bad", tone === "warn" && "text-warn")}>{value}</p>
    </div>
  );
}

export function ApprenticeGlyph({ className }: { className?: string }) {
  return (
    <span aria-label="Apprentice" className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-[11px] font-semibold text-primary-foreground", className)}>
      A
    </span>
  );
}

export function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `${Math.round(n * 100)}%`;
}
