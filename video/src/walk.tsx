import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { C, clamp, EXPO, INOUT, MONO, SANS } from "./brand";
import manifest from "../public/shots/manifest.json";
import { Chip, KeyCap, Pop } from "./ui";

type Box = { x: number; y: number; width: number; height: number } | null;
const M = manifest as Record<string, { box: Box }>;

/** Center of the element captured with a shot, in CSS px of the 1440×810 app viewport. */
export const at = (shot: string, dx = 0, dy = 0): [number, number] => {
  const b = M[shot]?.box;
  return b ? [b.x + b.width / 2 + dx, b.y + b.height / 2 + dy] : [720, 405];
};

export type Step = {
  img: string;
  w?: number;
  cam?: [number, number, number];
  cur?: [number, number];
  click?: boolean;
  key?: string;
  callout?: { text: string; x: number; y: number; color?: string };
};

const APP_W = 1440;
const FW = 1600;
const FH = 900;
const K = FW / APP_W;
const LEFT = (1920 - FW) / 2;
const TOP = 96;
const BAR = 0;

function camAt(c: [number, number, number] | undefined): { tx: number; ty: number; s: number } {
  const [x, y, s] = c ?? [720, 405, 1];
  const tx = Math.min(0, Math.max(FW - FW * s, FW / 2 - x * K * s));
  const ty = Math.min(0, Math.max(FH - FH * s, FH / 2 - y * K * s));
  return { tx, ty, s };
}

function bez(a: [number, number], b: [number, number], t: number): [number, number] {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const cx = mx - dy * 0.22, cy = my + dx * 0.22;
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]];
}

export const Walk: React.FC<{ steps: Step[]; dur: number; tag?: string }> = ({ steps, dur, tag }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = steps.reduce((s, x) => s + (x.w ?? 1), 0);
  let acc = 0;
  const T = steps.map((s) => {
    const from = Math.round((acc / total) * dur);
    acc += s.w ?? 1;
    return { ...s, from, len: Math.round((acc / total) * dur) - from };
  });
  const i = Math.max(0, T.findIndex((s, k) => frame >= s.from && (k === T.length - 1 || frame < T[k + 1]!.from)));
  const cur = T[i]!;
  const prev = T[i - 1];
  const lf = frame - cur.from;

  // camera
  const camPrev = camAt(prev?.cam ?? cur.cam);
  const camNow = camAt(cur.cam);
  const cp = interpolate(lf, [0, 36], [0, 1], { ...clamp, easing: INOUT });
  const breathe = 1 + Math.sin(frame / 90) * 0.004;
  const cam = { tx: camPrev.tx + (camNow.tx - camPrev.tx) * cp, ty: camPrev.ty + (camNow.ty - camPrev.ty) * cp, s: (camPrev.s + (camNow.s - camPrev.s) * cp) * breathe };

  // image crossfade (state change)
  const fade = interpolate(lf, [0, 8], [0, 1], clamp);

  // cursor
  const lastCur = [...T.slice(0, i)].reverse().find((s) => s.cur)?.cur;
  const target = cur.cur ?? lastCur;
  const startPt = lastCur ?? (target ? [target[0] + 260, target[1] + 180] as [number, number] : undefined);
  const mvEnd = Math.max(14, Math.round(cur.len * 0.42));
  const mt = cur.cur ? spring({ frame: lf, fps, durationInFrames: mvEnd, config: { damping: 18, stiffness: 120, mass: 0.7 } }) : 1;
  const pos = target && startPt ? bez(startPt, target, Math.min(1.04, mt)) : null;
  const clickAt = mvEnd + 4;
  const press = cur.click ? interpolate(lf, [clickAt, clickAt + 4, clickAt + 10], [1, 0.82, 1], clamp) : 1;
  const ripple = cur.click ? interpolate(lf, [clickAt, clickAt + 26], [0, 1], clamp) : 0;

  const sc = (p: [number, number]) => [LEFT + cam.tx + p[0] * K * cam.s, TOP + BAR + cam.ty + p[1] * K * cam.s] as const;

  return (
    <AbsoluteFill>
      {/* browser frame */}
      <div
        style={{
          position: "absolute",
          left: LEFT,
          top: TOP,
          width: FW,
          height: FH + BAR,
          borderRadius: 14,
          overflow: "hidden",
          border: `1px solid ${C.line}`,
          background: C.surface,
          boxShadow: `0 40px 120px -30px rgb(0 0 0 / .8), 0 0 90px -40px ${C.lime}55`,
        }}
      >
        <div style={{ position: "absolute", left: 0, top: BAR, width: FW, height: FH, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: FW, height: FH, transformOrigin: "0 0", transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})` }}>
            {prev && fade < 1 ? <Img src={staticFile(`shots/${prev.img}.png`)} style={{ position: "absolute", width: FW, height: FH }} /> : null}
            <Img src={staticFile(`shots/${cur.img}.png`)} style={{ position: "absolute", width: FW, height: FH, opacity: prev ? fade : 1 }} />
          </div>
        </div>
      </div>

      {/* cursor */}
      {pos ? (
        <div style={{ position: "absolute", left: sc(pos)[0], top: sc(pos)[1], pointerEvents: "none" }}>
          {ripple > 0 && ripple < 1 ? (
            <div style={{ position: "absolute", left: -48 * ripple, top: -48 * ripple, width: 96 * ripple, height: 96 * ripple, borderRadius: "50%", border: `3px solid ${C.lime}`, opacity: 0.7 * (1 - ripple), boxShadow: `0 0 24px ${C.lime}` }} />
          ) : null}
          <svg width="34" height="40" viewBox="0 0 24 28" style={{ transform: `scale(${press})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 4px 10px rgb(0 0 0 / .6))" }}>
            <path d="M2 2 L2 22 L7.5 17 L11 25.5 L14.5 24 L11 15.8 L18.5 15.8 Z" fill={C.text} stroke={C.bg} strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>
      ) : null}

      {/* key chip */}
      {T.map((s, k) =>
        s.key ? (
          <Pop key={`k${k}`} at={s.from + Math.round(s.len * 0.25)} until={s.from + s.len - 10} from="scale" style={{ left: LEFT + 28, top: TOP + FH - 110 }}>
            <KeyCap k={s.key} />
          </Pop>
        ) : null,
      )}

      {/* callouts */}
      {T.map((s, k) =>
        s.callout ? (
          <Pop key={`c${k}`} at={s.from + 18} until={s.from + s.len - 8} style={{ left: s.callout.x, top: s.callout.y }}>
            <Chip color={s.callout.color ?? C.lime}>{s.callout.text}</Chip>
          </Pop>
        ) : null,
      )}

      {tag ? (
        <div style={{ position: "absolute", left: LEFT, top: TOP + FH + 22, display: "flex", gap: 18, alignItems: "center", fontFamily: MONO, fontSize: 17, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: C.lime, boxShadow: `0 0 10px ${C.lime}` }} />
          {tag}
        </div>
      ) : null}

      {/* SFX: clicks + keys */}
      {T.map((s, k) =>
        s.click ? (
          <Sequence key={`sc${k}`} from={s.from + clickAt0(s.len)} durationInFrames={20} layout="none">
            <Audio src={staticFile("sfx/click.wav")} volume={0.55} />
          </Sequence>
        ) : null,
      )}
      {T.map((s, k) =>
        s.key ? (
          <Sequence key={`sk${k}`} from={s.from + Math.round(s.len * 0.25) + 4} durationInFrames={20} layout="none">
            <Audio src={staticFile("sfx/key.wav")} volume={0.6} />
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  );
};

const clickAt0 = (len: number) => Math.max(14, Math.round(len * 0.42)) + 4;

export const SANS_ = SANS;
export const EXPO_ = EXPO;
