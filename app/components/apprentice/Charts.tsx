import { useId } from "react";

import { cn } from "@/lib/utils";

const P = "hsl(var(--primary))";
const MUTED = "hsl(var(--muted-foreground))";
const GRID = "hsl(var(--border))";

/** Catmull-Rom → cubic Bézier, so a handful of points reads as a smooth trend. */
function smooth(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  const first = pts[0]!;
  let d = `M${first[0]},${first[1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    // Clamp control points between the two endpoints so the curve never overshoots (no dips below zero).
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
    const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clamp(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clamp(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function AreaChart({ data, unit, className }: { data: { label: string; value: number }[]; unit: string; className?: string }) {
  const id = useId();
  const W = 520, H = 180, PAD = { l: 8, r: 8, t: 22, b: 24 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
  const line = smooth(pts);
  const area = pts.length ? `${line} L${x(data.length - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z` : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("w-full overflow-visible", className)} role="img" aria-label={data.map((d) => `${d.label}: ${d.value} ${unit}`).join(", ")}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={P} stopOpacity="0.45" />
          <stop offset="100%" stopColor={P} stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke={GRID} strokeDasharray="2 4" />
      ))}
      <path d={area} fill={`url(#${id}-fill)`} className="chart-fade" />
      <path d={line} fill="none" stroke={P} strokeWidth="2.5" strokeLinecap="round" filter={`url(#${id}-glow)`} pathLength={1} className="chart-draw" />
      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={x(i)} cy={y(d.value)} r="4" fill="hsl(var(--background))" stroke={P} strokeWidth="2" />
          <text x={x(i)} y={y(d.value) - 10} textAnchor="middle" fontSize="11" fill={d.value ? "hsl(var(--foreground))" : MUTED} className="tabular">{d.value}</text>
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill={MUTED} fontFamily="var(--font-mono)">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function LineChart({ series, thresholds, className }: { series: { name: string; points: { n: number; agreement: number }[] }[]; thresholds: { at: number; label: string }[]; className?: string }) {
  const W = 520, H = 200, PAD = { l: 34, r: 10, t: 12, b: 22 };
  const maxN = Math.max(2, ...series.flatMap((s) => s.points.map((p) => p.n)));
  const x = (n: number) => PAD.l + ((n - 1) * (W - PAD.l - PAD.r)) / (maxN - 1);
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  const colors = [P, "var(--ok)", "var(--warn)"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("w-full overflow-visible", className)} role="img" aria-label={`Agreement after each reviewed decision. ${series.map((s) => `${s.name}: ${Math.round((s.points[s.points.length - 1]?.agreement ?? 0) * 100)}%`).join("; ")}`}>
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={GRID} />
          <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill={MUTED} fontFamily="var(--font-mono)">{v * 100}%</text>
        </g>
      ))}
      {thresholds.map((t, i) => (
        <g key={t.label}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t.at)} y2={y(t.at)} stroke={MUTED} strokeDasharray="4 4" opacity="0.6" />
          <text x={PAD.l + 6} y={y(t.at) + (i % 2 ? -4 : 12)} fontSize="10" fill={MUTED}>{t.label}</text>
        </g>
      ))}
      {series.map((s, i) => {
        const pts = s.points.map((p) => [x(p.n), y(p.agreement)] as [number, number]);
        return (
          <g key={s.name}>
            <path d={smooth(pts)} fill="none" stroke={colors[i % colors.length]} strokeWidth="2.5" strokeLinecap="round" pathLength={1} className="chart-draw" />
            {pts.length ? <circle cx={pts[pts.length - 1]![0]} cy={pts[pts.length - 1]![1]} r="4.5" fill={colors[i % colors.length]} className="chart-pulse" /> : null}
          </g>
        );
      })}
      {series.every((s) => s.points.length === 0) ? (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="12" fill={MUTED}>Review a few decisions to see the trend</text>
      ) : null}
      <text x={W - PAD.r} y={H - 4} textAnchor="end" fontSize="10" fill={MUTED} fontFamily="var(--font-mono)">reviewed decisions →</text>
    </svg>
  );
}

export function Donut({ segments, center, sub, className }: { segments: { label: string; value: number; color: string }[]; center: string; sub: string; className?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className={cn("flex items-center gap-5", className)}>
      <svg viewBox="0 0 140 140" className="size-36 shrink-0 -rotate-90" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
        <circle cx="70" cy="70" r={R} fill="none" stroke={GRID} strokeWidth="14" />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.value / total) * C;
            const el = <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="14" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc} strokeLinecap="butt" />;
            acc += len;
            return el;
          })}
        <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="600" fill="hsl(var(--foreground))" transform="rotate(90 70 70)" className="tabular">{center}</text>
        <text x="70" y="86" textAnchor="middle" fontSize="10" fill={MUTED} transform="rotate(90 70 70)">{sub}</text>
      </svg>
      <ul className="space-y-2 text-[13px]">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="tabular ms-auto ps-4 font-medium">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Ring({ value, size = 44 }: { value: number | null; size?: number }) {
  const R = 18, C = 2 * Math.PI * R;
  const v = value ?? 0;
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={R} fill="none" stroke={GRID} strokeWidth="4" />
      <circle cx="22" cy="22" r={R} fill="none" stroke={P} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${v * C} ${C}`} style={{ filter: `drop-shadow(0 0 4px ${P})` }} />
    </svg>
  );
}

/** The trust ladder as a staircase: each rung's height is its level, its fill how many playbooks sit there. */
export function Staircase({ rungs }: { rungs: { level: number; name: string; count: number }[] }) {
  return (
    <div className="flex h-40 items-end gap-2" role="img" aria-label={rungs.map((r) => `${r.name}: ${r.count}`).join(", ")}>
      {rungs.map((r) => (
        <div key={r.level} className="flex flex-1 flex-col items-center gap-1.5">
          <span className={cn("tabular text-sm font-semibold", r.count ? "text-primary" : "text-muted-foreground")}>{r.count}</span>
          <div
            className={cn("w-full rounded-t-md border border-b-0 transition-colors", r.count ? "border-primary/60 bg-primary/25 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6),inset_0_1px_0_rgb(255_255_255/0.25)]" : "border-border bg-muted/40")}
            style={{ height: 18 + r.level * 22 }}
          />
          <span className="font-mono text-[10px] text-muted-foreground">{r.level} {r.name}</span>
        </div>
      ))}
    </div>
  );
}

export function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.every((i) => i.value === 0)) return <p className="text-[13px] text-muted-foreground">Nothing needs you.</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label} className="text-[13px]">
          <div className="mb-1 flex justify-between"><span className="text-muted-foreground">{i.label}</span><span className="tabular">{i.value}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="chart-grow h-full rounded-full bg-gradient-to-r from-primary/40 to-primary" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
