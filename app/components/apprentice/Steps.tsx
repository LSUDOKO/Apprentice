import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { ParamOwner, ParamSpec, StepSpec } from "../../../server/apprentice/engine/types";
import { CheckpointFlag, formatValue, ParamChip } from "./primitives";

type ResolvedLike = {
  stepId: string;
  action: string;
  args: Record<string, unknown>;
  owners: Record<string, ParamOwner>;
  checkpoint: boolean;
  destructive: boolean;
  pendingAgentParams: string[];
};

function specValue(p: ParamSpec): ReactNode {
  if (p.owner === "fixed") return formatValue(p.value);
  if (p.owner === "fromItem") return `issue.${p.path}`;
  return p.instruction;
}

function hideParam(key: string, p: ParamSpec): boolean {
  return key === "remove" && p.owner === "fixed" && Array.isArray(p.value) && p.value.length === 0;
}

/** Read-only recipe steps with color-coded parameter owners. */
export function SpecSteps({ steps, dense }: { steps: StepSpec[]; dense?: boolean }) {
  return (
    <ol className={cn("space-y-2", dense && "space-y-1.5")}>
      {steps.map((s, i) => (
        <li key={s.id} className={cn("rounded-md border border-border bg-card px-3 py-2", s.destructive && "border-s-2 border-s-bad")}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{i + 1}</span>
            <span className="font-mono text-[13px] font-medium">{s.action}</span>
            {s.checkpoint ? <CheckpointFlag /> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(s.params)
              .filter(([k, p]) => !hideParam(k, p))
              .map(([k, p]) => (
                <ParamChip key={k} name={k} owner={p.owner} value={specValue(p)} />
              ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Steps resolved for one issue (what Apprentice would do). */
export function ResolvedSteps({ steps, instructions }: { steps: ResolvedLike[]; instructions?: Record<string, Record<string, string>> }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={s.stepId} className={cn("rounded-md border border-border bg-card px-3 py-2", s.destructive && "border-s-2 border-s-bad")}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{i + 1}</span>
            <span className="font-mono text-[13px] font-medium">{s.action}</span>
            {s.checkpoint || s.destructive ? <CheckpointFlag /> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(s.owners)
              .filter(([k]) => !(k === "remove" && Array.isArray(s.args[k]) && (s.args[k] as unknown[]).length === 0))
              .map(([k, owner]) => {
                const pending = s.pendingAgentParams.includes(k);
                const value = k === "message" || k === "body" ? String(s.args[k] ?? "") : formatValue(s.args[k]);
                return <ParamChip key={k} name={k} owner={owner} pending={pending} value={pending ? undefined : value.length > 90 ? `${value.slice(0, 87)}…` : value} />;
              })}
          </div>
          {s.pendingAgentParams.map((p) =>
            instructions?.[s.stepId]?.[p] ? (
              <p key={p} className="mt-1 text-xs text-param-agent">
                ✦ {p}: {(instructions[s.stepId]?.[p] ?? "").length > 160 ? `${(instructions[s.stepId]?.[p] ?? "").slice(0, 157)}…` : instructions[s.stepId]?.[p]}
              </p>
            ) : null,
          )}
        </li>
      ))}
    </ol>
  );
}

/** Plain steps (action + args), e.g. a demonstration or a test expectation. */
export function PlainSteps({ steps }: { steps: { action: string; args: Record<string, unknown>; label?: string }[] }) {
  if (!steps.length) return <p className="text-sm text-muted-foreground">No steps — the playbook should not apply.</p>;
  return (
    <ol className="space-y-1">
      {steps.map((s, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-2 text-[13px]">
          <span className="font-mono text-[11px] text-muted-foreground">{i + 1}</span>
          <span className="font-mono font-medium">{s.action}</span>
          <span className="text-muted-foreground">
            {Object.entries(s.args)
              .filter(([k, v]) => !(k === "remove" && Array.isArray(v) && v.length === 0) && k !== "message" && k !== "body")
              .map(([k, v]) => `${k}: ${formatValue(v)}`)
              .join(" · ")}
          </span>
        </li>
      ))}
    </ol>
  );
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Inline markdown only (code spans, bold) — for one-line texts like trigger descriptions. */
export function InlineMd({ text }: { text: string }) {
  return <>{inline(text)}</>;
}

/** Tiny safe markdown: fenced code, bullet/numbered lists, paragraphs, inline code and bold. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) code.push(lines[i++] ?? "");
      i++;
      blocks.push(<pre key={blocks.length}>{code.join("\n")}</pre>);
      continue;
    }
    if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+[.)])\s+/.test(lines[i] ?? "")) items.push((lines[i++] ?? "").replace(/^\s*([-*]|\d+[.)])\s+/, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={blocks.length}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </List>,
      );
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && (lines[i] ?? "").trim() && !(lines[i] ?? "").startsWith("```") && !/^\s*([-*]|\d+[.)])\s+/.test(lines[i] ?? "")) para.push(lines[i++] ?? "");
    blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>);
  }
  return <div className={cn("ap-markdown text-sm leading-relaxed", className)}>{blocks}</div>;
}
