import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { C, clamp, EXPO, IN, MONO, SANS } from "./brand";
import type { TransIn } from "./timeline";

/* ---------- Backdrop: grid, crosshairs, orb, grain, vignette ---------- */

export const Backdrop: React.FC<{ orb?: { x: number; y: number; r: number; o?: number }; grid?: number; drift?: number; tint?: number }> = ({ orb, grid = 1, drift = 1, tint = 0 }) => {
  const frame = useCurrentFrame();
  const dx = Math.sin(frame / 240) * 30 * drift;
  const dy = Math.cos(frame / 300) * 18 * drift;
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          opacity: 0.055 * grid,
          backgroundImage: `linear-gradient(${C.text} 1px, transparent 1px), linear-gradient(90deg, ${C.text} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          backgroundPosition: `${dx}px ${dy}px`,
        }}
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ position: "absolute", left: 160 * (i * 2 + 1) + dx - 6, top: (i % 2 ? 240 : 800) + dy - 14, color: C.muted, fontFamily: MONO, fontSize: 22, opacity: 0.5 * grid }}>+</span>
      ))}
      {orb ? (
        <div
          style={{
            position: "absolute",
            width: orb.r * 2,
            height: orb.r * 2,
            left: orb.x - orb.r + dx * 0.6,
            top: orb.y - orb.r + dy * 0.6,
            borderRadius: "50%",
            opacity: orb.o ?? 1,
            background: "radial-gradient(circle at 50% 18%, #f4ffb8 0%, #DDF26B 18%, #8fa035 46%, #2a3112 72%, #11140a 100%)",
            boxShadow: "inset 0 3px 0 rgb(255 255 255 / .45), 0 0 180px -10px rgb(221 242 107 / .45)",
          }}
        />
      ) : null}
      {tint ? <AbsoluteFill style={{ background: C.bad, mixBlendMode: "overlay", opacity: tint }} /> : null}
      <Grain />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgb(0 0 0 / .55) 100%)" }} />
    </AbsoluteFill>
  );
};

export const Grain: React.FC<{ o?: number }> = ({ o = 0.1 }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 8;
  return (
    <AbsoluteFill style={{ opacity: o, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id={`g${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

/* ---------- Logo ---------- */

export const LogoMark: React.FC<{ size: number; draw?: number }> = ({ size, draw = 1 }) => (
  <svg viewBox="0 0 64 64" width={size} height={size}>
    <rect x="0.5" y="0.5" width="63" height="63" rx="14" fill={C.surface} stroke={C.line} />
    <path
      d="M14 46 L28 16 h8 L50 46 h-9 l-3-7 H26 l-3 7Z M29 31 h6 l-3-8Z"
      fill={C.lime}
      fillOpacity={interpolate(draw, [0.55, 1], [0, 1], clamp)}
      stroke={C.lime}
      strokeWidth={1.2}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - Math.min(1, draw * 1.4)}
    />
  </svg>
);

/* ---------- Kinetic type: word-by-word mask reveal ---------- */

export const Words: React.FC<{
  text: string;
  at?: number;
  size?: number;
  weight?: number;
  color?: string;
  hi?: string[];
  stagger?: number;
  align?: "left" | "center";
  exitAt?: number;
  style?: React.CSSProperties;
  font?: string;
  tracking?: string;
}> = ({ text, at = 0, size = 120, weight = 600, color = C.text, hi = [], stagger = 3, align = "center", exitAt, style, font = SANS, tracking = "-0.045em" }) => {
  const frame = useCurrentFrame();
  const lines = text.split("\n");
  let k = 0;
  const exit = exitAt === undefined ? 0 : interpolate(frame, [exitAt, exitAt + 14], [0, 1], { ...clamp, easing: IN });
  return (
    <div style={{ fontFamily: font, fontSize: size, fontWeight: weight, letterSpacing: tracking, lineHeight: 1.0, color, textAlign: align, opacity: 1 - exit, transform: `translateY(${-exit * 24}px)`, filter: `blur(${exit * 8}px)`, ...style }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", gap: `0 ${size * 0.26}px` }}>
          {line.split(" ").map((w, wi) => {
            const p = interpolate(frame, [at + k * stagger, at + k * stagger + 26], [0, 1], { ...clamp, easing: EXPO });
            k++;
            const isHi = hi.some((h) => w.toLowerCase().replace(/[^a-z0-9.-]/g, "").startsWith(h.toLowerCase()));
            return (
              <span key={wi} style={{ display: "inline-block", overflow: "hidden", padding: `${size * 0.04}px 0 ${size * 0.14}px`, margin: `${-size * 0.04}px 0 ${-size * 0.04}px` }}>
                <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 100}%)`, filter: `blur(${(1 - p) * 8}px)`, opacity: p, color: isHi ? C.lime : undefined }}>{w}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export const Mono: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 18, color = C.muted, style }) => (
  <div style={{ fontFamily: MONO, fontSize: size, letterSpacing: "0.12em", textTransform: "uppercase", color, ...style }}>{children}</div>
);

/* ---------- Glass chip, key chip, callout ---------- */

export const Chip: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties; size?: number }> = ({ children, color = C.lime, style, size = 26 }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      padding: `${size * 0.42}px ${size * 0.8}px`,
      borderRadius: 10,
      background: "linear-gradient(180deg, rgb(255 255 255 / .09), rgb(255 255 255 / .03)), rgb(19 22 14 / .78)",
      border: `1px solid ${color}55`,
      boxShadow: `inset 0 1px 0 rgb(255 255 255 / .18), 0 10px 40px -10px ${color}55, 0 0 0 1px rgb(0 0 0 / .4)`,
      backdropFilter: "blur(14px) saturate(160%)",
      color: C.text,
      fontFamily: SANS,
      fontWeight: 500,
      fontSize: size,
      letterSpacing: "-0.01em",
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    <span style={{ width: 9, height: 9, borderRadius: 9, background: color, boxShadow: `0 0 12px ${color}` }} />
    {children}
  </div>
);

export const Pop: React.FC<{ at: number; until?: number; children: React.ReactNode; style?: React.CSSProperties; from?: "up" | "left" | "scale" }> = ({ at, until, children, style, from = "up" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 200, mass: 0.6 } });
  const out = until === undefined ? 0 : interpolate(frame, [until, until + 12], [0, 1], { ...clamp, easing: IN });
  const tr = from === "up" ? `translateY(${(1 - p) * 26 - out * 12}px)` : from === "left" ? `translateX(${(1 - p) * -40}px)` : `scale(${0.85 + p * 0.15})`;
  if (frame < at) return null;
  return <div style={{ position: "absolute", opacity: p * (1 - out), transform: tr, filter: `blur(${(1 - p) * 6 + out * 6}px)`, ...style }}>{children}</div>;
};

export const KeyCap: React.FC<{ k: string }> = ({ k }) => (
  <div
    style={{
      minWidth: 64,
      height: 64,
      padding: "0 18px",
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: MONO,
      fontSize: 26,
      color: C.text,
      background: "linear-gradient(180deg, #23281a, #14170f)",
      border: `1px solid ${C.line}`,
      boxShadow: `inset 0 1px 0 rgb(255 255 255 / .15), 0 4px 0 #0a0c07, 0 0 30px -8px ${C.lime}66`,
    }}
  >
    {k}
  </div>
);

/* ---------- Scene transition shell ---------- */

export const Shell: React.FC<{ tin: TransIn; inFrames: number; dur: number; outNext: TransIn | null; outFrames: number; children: React.ReactNode }> = ({ tin, inFrames, dur, outNext, outFrames, children }) => {
  const frame = useCurrentFrame();
  const pi = inFrames ? interpolate(frame, [0, inFrames], [0, 1], { ...clamp, easing: EXPO }) : 1;
  const po = outFrames ? interpolate(frame, [dur - outFrames, dur], [0, 1], { ...clamp, easing: IN }) : 0;
  let transform = "";
  let filter = "";
  let opacity = 1;
  let clipPath: string | undefined;
  let edge: React.ReactNode = null;
  if (tin === "whip" && pi < 1) { transform += `translateX(${(1 - pi) * 100}%) `; filter += `blur(${(1 - pi) * 40}px) `; }
  if (tin === "roll" && pi < 1) { transform += `perspective(1600px) translateY(${(1 - pi) * 180}px) rotateX(${(1 - pi) * 10}deg) `; opacity = pi; }
  if (tin === "zoom" && pi < 1) { transform += `scale(${1 + (1 - pi) * 0.7}) `; filter += `blur(${(1 - pi) * 14}px) `; opacity = Math.min(1, pi * 2); }
  if (tin === "dissolve" && pi < 1) { opacity = interpolate(frame, [0, inFrames], [0, 1], clamp); filter += `blur(${Math.sin(pi * Math.PI) * 6}px) `; }
  if (tin === "wipe" && pi < 1) {
    clipPath = `inset(0 0 0 ${(1 - pi) * 100}%)`;
    edge = <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(1 - pi) * 100}%`, width: 3, background: C.lime, boxShadow: `0 0 30px 6px ${C.lime}88` }} />;
  }
  if (outNext === "whip" && po > 0) { transform += `translateX(${-po * 100}%) `; filter += `blur(${po * 40}px) `; }
  if (outNext === "zoom" && po > 0) { transform += `scale(${1 + po * 0.8}) `; filter += `blur(${po * 14}px) `; opacity *= 1 - po; }
  if (outNext === "roll" && po > 0) { transform += `scale(${1 - po * 0.06}) `; filter += `brightness(${1 - po * 0.6}) `; }
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: transform || undefined, filter: filter || undefined, opacity, clipPath }}>{children}</AbsoluteFill>
      {edge}
      {tin === "glitch" ? <Glitch at={0} /> : null}
    </AbsoluteFill>
  );
};

/* ---------- Glitch + light leak + block overlays ---------- */

export const Glitch: React.FC<{ at: number; len?: number }> = ({ at, len = 10 }) => {
  const frame = useCurrentFrame() - at;
  if (frame < 0 || frame > len) return null;
  const slices = [0, 1, 2, 3].map((i) => ({ y: random(`gy${frame}${i}`) * 1080, h: 8 + random(`gh${frame}${i}`) * 50, x: (random(`gx${frame}${i}`) - 0.5) * 80 }));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: C.bad, mixBlendMode: "screen", opacity: 0.16 * (1 - frame / len) }} />
      {slices.map((s, i) => (
        <div key={i} style={{ position: "absolute", left: s.x, right: -s.x, top: s.y, height: s.h, background: i % 2 ? `${C.bad}66` : "rgb(94 234 212 / .35)", mixBlendMode: "screen" }} />
      ))}
    </AbsoluteFill>
  );
};

export const LightLeak: React.FC<{ at: number; len?: number }> = ({ at, len = 40 }) => {
  const frame = useCurrentFrame() - at;
  if (frame < 0 || frame > len) return null;
  const p = frame / len;
  const o = Math.sin(p * Math.PI) * 0.55;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: o,
        background: `radial-gradient(ellipse 60% 80% at ${-20 + p * 140}% 40%, rgb(221 242 107 / .9), rgb(245 196 81 / .45) 40%, transparent 70%)`,
      }}
    />
  );
};

/** Object block: a giant logo mark slides across the lens and hides the cut. */
export const BlockWipe: React.FC<{ center: number }> = ({ center }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [center - 14, center + 14], [0, 1], clamp);
  if (p <= 0 || p >= 1) return null;
  const x = interpolate(p, [0, 1], [2100, -2300], { easing: (t) => t });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: x, top: -260, filter: "blur(3px)" }}>
        <LogoMark size={1600} />
      </div>
    </AbsoluteFill>
  );
};
