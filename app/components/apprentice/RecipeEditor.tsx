import { setClientAppState } from "@agent-native/core/client/hooks";
import { IconArrowDown, IconArrowUp, IconFlag, IconPlus, IconTrash } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { Condition, ParamOwner, ParamSpec, StepSpec, TriggerSpec } from "../../../server/apprentice/engine/types";
import { OWNER_META } from "./primitives";
import { ASSIGNEES, COMPONENTS, LABELS, MISSING, PRIORITIES } from "./vocab";

const BOOL_FIELDS = ["hasVersion", "hasRepro", "hasStackTrace", "hasCodeBlock", "mentionsDocs", "isLikelySpam", "authorIsFirstTime"] as const;
const TEXT_FIELDS = ["versionMentioned", "mentionsComponent", "priority", "component", "assignee"] as const;
const FIELD_LABEL: Record<string, string> = {
  kind: "kind",
  labels: "labels",
  hasVersion: "has a version",
  hasRepro: "has repro steps",
  hasStackTrace: "has a stack trace",
  hasCodeBlock: "has a code block",
  mentionsDocs: "mentions docs",
  isLikelySpam: "looks like spam",
  authorIsFirstTime: "first-time author",
  versionMentioned: "version mentioned",
  mentionsComponent: "mentions component",
  priority: "priority",
  component: "component",
  assignee: "assignee",
  title: "title",
  body: "body",
};
const FIELDS = ["kind", "labels", ...BOOL_FIELDS, ...TEXT_FIELDS, "title", "body"] as const;
const KINDS = ["bug", "feature", "question", "docs", "other"];
const ITEM_PATHS = ["author", "number", "features.mentionsComponent", "features.versionMentioned", "features.kind", "component", "assignee", "priority"];

export const DOMAIN_ACTION_PARAMS: Record<string, { key: string; kind: "labels" | "text" | "select" | "multi" | "longtext"; options?: readonly string[] }[]> = {
  "label-issue": [
    { key: "add", kind: "labels" },
    { key: "remove", kind: "labels" },
  ],
  "set-priority": [{ key: "priority", kind: "select", options: PRIORITIES }],
  "set-component": [{ key: "component", kind: "select", options: COMPONENTS }],
  "assign-issue": [{ key: "assignee", kind: "select", options: ASSIGNEES }],
  "comment-on-issue": [{ key: "body", kind: "longtext" }],
  "request-repro": [
    { key: "missing", kind: "multi", options: MISSING },
    { key: "message", kind: "longtext" },
  ],
  "mark-duplicate": [{ key: "duplicateOfId", kind: "text" }],
  "close-issue": [{ key: "reason", kind: "select", options: ["completed", "invalid", "wontfix"] }],
};

const selectCls = "h-8 rounded-md border border-input bg-card px-2 text-[13px] focus-visible:outline-2 focus-visible:outline-ring";

function defaultCondition(field: string): Condition {
  if (field === "labels") return { field: "labels", op: "includes", value: "bug" };
  if (field === "title" || field === "body") return { field, op: "matches", value: "crash" };
  if (field === "kind") return { field: "kind", op: "eq", value: "bug" };
  if ((BOOL_FIELDS as readonly string[]).includes(field)) return { field: field as (typeof BOOL_FIELDS)[number], op: "eq", value: false };
  return { field: field as (typeof TEXT_FIELDS)[number], op: "isEmpty" };
}

function ConditionRow({ cond, onChange, onRemove, enabled, onToggle }: { cond: Condition; onChange: (c: Condition) => void; onRemove: () => void; enabled?: boolean; onToggle?: () => void }) {
  const id = `${cond.field}-${cond.op}`;
  const isBool = (BOOL_FIELDS as readonly string[]).includes(cond.field);
  const isText = (TEXT_FIELDS as readonly string[]).includes(cond.field);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", enabled === false && "opacity-50")}>
      {onToggle ? <input type="checkbox" aria-label="Use this condition" checked={enabled} onChange={onToggle} className="accent-[hsl(var(--primary))]" /> : null}
      <select aria-label="Field" className={selectCls} value={cond.field} onChange={(e) => onChange(defaultCondition(e.target.value))}>
        {FIELDS.map((f) => (
          <option key={f} value={f}>
            {FIELD_LABEL[f]}
          </option>
        ))}
      </select>
      {isBool && "value" in cond ? (
        <select aria-label="Value" className={selectCls} value={String(cond.value)} onChange={(e) => onChange({ field: cond.field as (typeof BOOL_FIELDS)[number], op: "eq", value: e.target.value === "true" })}>
          <option value="true">is true</option>
          <option value="false">is false</option>
        </select>
      ) : cond.field === "kind" && "value" in cond ? (
        <>
          <select aria-label="Operator" className={selectCls} value={cond.op} onChange={(e) => onChange({ field: "kind", op: e.target.value as "eq" | "neq", value: cond.value })}>
            <option value="eq">is</option>
            <option value="neq">is not</option>
          </select>
          <select aria-label="Value" className={selectCls} value={String(cond.value)} onChange={(e) => onChange({ field: "kind", op: cond.op as "eq" | "neq", value: e.target.value })}>
            {KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </>
      ) : cond.field === "labels" && "value" in cond ? (
        <>
          <select aria-label="Operator" className={selectCls} value={cond.op} onChange={(e) => onChange({ field: "labels", op: e.target.value as "includes" | "excludes", value: String(cond.value) })}>
            <option value="includes">include</option>
            <option value="excludes">don't include</option>
          </select>
          <select aria-label="Label" className={selectCls} value={String(cond.value)} onChange={(e) => onChange({ field: "labels", op: cond.op as "includes" | "excludes", value: e.target.value })}>
            {LABELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </>
      ) : (cond.field === "title" || cond.field === "body") && "value" in cond ? (
        <>
          <span className="text-xs text-muted-foreground">matches /</span>
          <Input aria-label="Pattern" className="h-8 w-40 font-mono text-xs" value={String(cond.value)} onChange={(e) => onChange({ field: cond.field as "title" | "body", op: "matches", value: e.target.value })} />
          <span className="text-xs text-muted-foreground">/i</span>
        </>
      ) : isText ? (
        <>
          <select
            aria-label="Operator"
            className={selectCls}
            value={cond.op}
            onChange={(e) => {
              const op = e.target.value;
              onChange(op === "eq" ? { field: cond.field as (typeof TEXT_FIELDS)[number], op: "eq", value: "" } : { field: cond.field as (typeof TEXT_FIELDS)[number], op: op as "isEmpty" | "isNotEmpty" });
            }}
          >
            <option value="isEmpty">is empty</option>
            <option value="isNotEmpty">is set</option>
            <option value="eq">is</option>
          </select>
          {cond.op === "eq" && "value" in cond ? (
            <Input aria-label="Value" className="h-8 w-32 text-xs" value={String(cond.value ?? "")} onChange={(e) => onChange({ field: cond.field as (typeof TEXT_FIELDS)[number], op: "eq", value: e.target.value })} />
          ) : null}
        </>
      ) : null}
      <Button type="button" size="icon" variant="ghost" className="size-7" onClick={onRemove} aria-label={`Remove condition ${id}`}>
        <IconTrash className="size-3.5" />
      </Button>
    </div>
  );
}

export function TriggerEditor({ trigger, onChange }: { trigger: TriggerSpec; onChange: (t: TriggerSpec) => void }) {
  return (
    <div className="space-y-2">
      {trigger.all.map((c, i) => (
        <ConditionRow
          key={i}
          cond={c}
          onChange={(nc) => onChange({ ...trigger, all: trigger.all.map((x, j) => (j === i ? nc : x)) })}
          onRemove={() => onChange({ ...trigger, all: trigger.all.filter((_, j) => j !== i) })}
        />
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...trigger, all: [...trigger.all, defaultCondition("hasCodeBlock")] })}>
        <IconPlus className="size-3.5" /> Add condition
      </Button>
      <div className="rounded-md border border-param-agent/30 bg-param-agent/5 p-2.5">
        <label htmlFor="judgment" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-param-agent">
          ✦ Agent judges <span className="font-normal text-muted-foreground">(optional yes/no question, only when conditions can't express it)</span>
        </label>
        <Textarea
          id="judgment"
          rows={2}
          value={trigger.judgment ?? ""}
          onChange={(e) => onChange({ ...trigger, judgment: e.target.value || null })}
          placeholder="e.g. Does the report describe broken behavior rather than a usage question?"
          className="bg-card text-[13px]"
        />
      </div>
    </div>
  );
}

function FixedValueInput({ actionKey, param, value, onChange }: { actionKey: string; param: string; value: unknown; onChange: (v: unknown) => void }) {
  const meta = DOMAIN_ACTION_PARAMS[actionKey]?.find((p) => p.key === param);
  if (meta?.kind === "labels" || meta?.kind === "multi") {
    const options = meta.kind === "labels" ? LABELS : (meta.options ?? []);
    const current = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = current.includes(o);
          return (
            <button
              type="button"
              key={o}
              aria-pressed={on}
              onClick={() => onChange(on ? current.filter((x) => x !== o) : [...current, o])}
              className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[11px]", on ? "border-param-fixed/50 bg-param-fixed/15 text-foreground" : "border-border text-muted-foreground")}
            >
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  if (meta?.kind === "select") {
    return (
      <select aria-label={param} className={selectCls} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">none</option>
        {(meta.options ?? []).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (meta?.kind === "longtext") return <Textarea aria-label={param} rows={3} className="text-[13px]" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  return <Input aria-label={param} className="h-8 text-[13px]" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
}

function ParamRow({ step, name, spec, onChange }: { step: StepSpec; name: string; spec: ParamSpec; onChange: (p: ParamSpec) => void }) {
  function setOwner(owner: ParamOwner) {
    if (owner === spec.owner) return;
    if (owner === "fixed") onChange({ owner, value: spec.owner === "fixed" ? spec.value : null });
    else if (owner === "fromItem") onChange({ owner, path: "author" });
    else onChange({ owner, instruction: `Write the ${name} for this issue.` });
  }
  return (
    <div className="grid gap-1.5 border-t border-border/60 py-2 first:border-t-0 sm:grid-cols-[110px_minmax(0,1fr)]">
      <span className="pt-1 font-mono text-xs text-muted-foreground">{name}</span>
      <div className="space-y-1.5">
        <div role="radiogroup" aria-label={`Who sets ${name}`} className="inline-flex overflow-hidden rounded-md border border-border">
          {(Object.keys(OWNER_META) as ParamOwner[]).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={spec.owner === o}
              onClick={() => setOwner(o)}
              className={cn("border-e border-border px-2 py-0.5 text-[11px] last:border-e-0", spec.owner === o ? OWNER_META[o].className : "text-muted-foreground hover:bg-secondary")}
            >
              {OWNER_META[o].glyph} {OWNER_META[o].label}
            </button>
          ))}
        </div>
        {spec.owner === "fixed" ? (
          <FixedValueInput actionKey={step.action} param={name} value={spec.value} onChange={(value) => onChange({ owner: "fixed", value })} />
        ) : spec.owner === "fromItem" ? (
          <select aria-label={`${name} comes from`} className={selectCls} value={spec.path} onChange={(e) => onChange({ owner: "fromItem", path: e.target.value })}>
            {ITEM_PATHS.map((p) => (
              <option key={p} value={p}>
                issue.{p}
              </option>
            ))}
          </select>
        ) : (
          <Textarea aria-label={`Instruction for ${name}`} rows={2} className="border-param-agent/30 text-[13px]" value={spec.instruction} onChange={(e) => onChange({ owner: "agent", instruction: e.target.value })} />
        )}
      </div>
    </div>
  );
}

export function StepsEditor({ steps, onChange, selected, onSelect }: { steps: StepSpec[]; onChange: (s: StepSpec[]) => void; selected: string | null; onSelect: (id: string) => void }) {
  function update(i: number, next: StepSpec) {
    onChange(steps.map((s, j) => (j === i ? next : s)));
  }
  function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const copy = [...steps];
    [copy[i], copy[j]] = [copy[j] as StepSpec, copy[i] as StepSpec];
    onChange(copy);
  }
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li
          key={s.id}
          onFocusCapture={() => {
            if (selected !== s.id) {
              onSelect(s.id);
              void setClientAppState("selection", { kind: "playbook-step", ids: [s.id], action: s.action });
            }
          }}
          className={cn("ap-fade-in rounded-[10px] border border-border bg-card px-3 py-2", s.destructive && "border-s-2 border-s-bad", selected === s.id && "ring-1 ring-primary/40")}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{i + 1}</span>
            <span className="font-mono text-[13px] font-medium">{s.action}</span>
            {s.destructive ? <span className="text-[11px] text-bad">destructive</span> : null}
            <div className="ms-auto flex items-center gap-1">
              <button
                type="button"
                aria-pressed={s.checkpoint}
                disabled={s.destructive}
                onClick={() => update(i, { ...s, checkpoint: !s.checkpoint })}
                className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]", s.checkpoint ? "border-warn/50 bg-warn/10 text-warn" : "border-border text-muted-foreground")}
                title={s.destructive ? "Destructive steps are always checkpoints" : "Ask me before this step (until Auto)"}
              >
                <IconFlag className="size-3" /> {s.checkpoint ? "Ask me first" : "Checkpoint"}
              </button>
              <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move step up">
                <IconArrowUp className="size-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Move step down">
                <IconArrowDown className="size-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => onChange(steps.filter((_, j) => j !== i))} aria-label="Remove step" disabled={steps.length <= 1}>
                <IconTrash className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="mt-1">
            {Object.entries(s.params).map(([k, p]) => (
              <ParamRow key={k} step={s} name={k} spec={p} onChange={(np) => update(i, { ...s, params: { ...s.params, [k]: np } })} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AddStep({ onAdd }: { onAdd: (s: StepSpec) => void }) {
  return (
    <select
      aria-label="Add a step"
      className={selectCls}
      value=""
      onChange={(e) => {
        const action = e.target.value;
        if (!action) return;
        const params: Record<string, ParamSpec> = Object.fromEntries(
          (DOMAIN_ACTION_PARAMS[action] ?? []).map((p) => [p.key, p.kind === "longtext" ? { owner: "agent", instruction: `Write the ${p.key} for this issue.` } : { owner: "fixed", value: p.kind === "labels" || p.kind === "multi" ? [] : null }]),
        );
        const destructive = action === "close-issue" || action === "mark-duplicate";
        onAdd({ id: `s${Date.now().toString(36)}`, action, params, checkpoint: destructive, destructive });
      }}
    >
      <option value="">+ Add step…</option>
      {Object.keys(DOMAIN_ACTION_PARAMS).map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
}

export { ConditionRow };
