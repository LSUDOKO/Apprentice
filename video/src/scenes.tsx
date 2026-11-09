import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { C, clamp, EXPO, IN, INOUT, MONO, SANS } from "./brand";
import type { SceneT } from "./timeline";
import { Backdrop, Chip, Glitch, LightLeak, LogoMark, Mono, Pop, Words } from "./ui";
import { at, Walk } from "./walk";

type P = { s: SceneT };
const vo = (s: SceneT, id: string) => s.vo.find((v) => v.id === id)!;

/* ================= 1. HOOK ================= */
const HOOK_CROPS = ["t31-2-needsinfo", "t31-3-bug", "t32-2-needsinfo", "t32-6-assigned", "t31-4-reprodialog", "t32-3-bug"];
export const Hook: React.FC<P> = ({ s }) => {
  const frame = useCurrentFrame();
  const h2 = vo(s, "h2");
  const cutLen = 22;
  const idx = Math.floor(frame / cutLen) % HOOK_CROPS.length;
  const showCuts = frame < h2.from - 6;
  const z = 1.9 + (frame % cutLen) * 0.004;
  const count = Math.min(101, 12 + Math.floor(frame * 1.1));
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {showCuts ? (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Img
            src={staticFile(`shots/${HOOK_CROPS[idx]}.png`)}
            style={{ position: "absolute", width: 1920 * z, height: 1080 * z, left: -1920 * z * 0.62 + 960, top: -1080 * z * 0.14 + 300, filter: "saturate(0.6) brightness(0.8)" }}
          />
          <AbsoluteFill style={{ background: "linear-gradient(90deg, rgb(11 13 8 / .96) 0%, rgb(11 13 8 / .85) 55%, rgb(11 13 8 / .35) 100%)" }} />
          <div style={{ position: "absolute", left: 96, bottom: 96 }}>
            <Mono size={22} color={C.dim}>issue #{count} · label · repro · assign</Mono>
          </div>
          <div style={{ position: "absolute", left: 96, top: 380, width: 1300 }}>
            <Words text={"Maya has clicked this\nexact sequence a hundred times."} at={vo(s, "h1").from} size={84} align="left" stagger={2} />
          </div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Backdrop grid={0.6} />
          <Words text="Again." at={h2.from} size={260} />
          <div style={{ position: "absolute", bottom: 300 }}>
            <Words text="Today it'll be a hundred and one." at={h2.from + 12} size={40} weight={400} color={C.dim} tracking="-0.01em" />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/* ================= 2. TITLE ================= */
export const Title: React.FC<P> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lock = 64;
  const orbY = interpolate(frame, [0, 90], [1500, 640], { ...clamp, easing: EXPO });
  const logo = spring({ frame: frame - 20, fps, config: { damping: 14, stiffness: 120 } });
  const draw = interpolate(frame, [20, lock], [0, 1], { ...clamp, easing: EXPO });
  const word = interpolate(frame, [lock - 6, lock + 20], [0, 1], { ...clamp, easing: EXPO });
  const gridIn = interpolate(frame, [0, 40], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Backdrop grid={gridIn} orb={{ x: 1500, y: orbY, r: 380, o: 0.9 }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36, transform: `translateY(-60px)` }}>
          <div style={{ transform: `scale(${logo})` }}>
            <LogoMark size={150} draw={draw} />
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 132, letterSpacing: "-0.05em", color: C.text, opacity: word, transform: `translateX(${(1 - word) * -30}px)`, filter: `blur(${(1 - word) * 10}px)` }}>Apprentice</div>
        </div>
        <div style={{ position: "absolute", top: 640 }}>
          <Words text="Show it once. Delegate forever." at={vo(s, "t1").from + 24} size={58} weight={500} hi={["delegate", "forever"]} tracking="-0.03em" />
        </div>
      </AbsoluteFill>
      <LightLeak at={lock - 8} len={50} />
    </AbsoluteFill>
  );
};

/* ================= 3. PROBLEM ================= */
const ISSUES = [
  ["#31", "Recurring job runs twice", "demo"],
  ["#8301", "Error screen: Something went wrong", "github"],
  ["#32", "MCP connector fails to connect", "demo"],
  ["#34", "Agent sidebar stuck on loading", "demo"],
  ["#8141", "Error screen: Something went wrong", "github"],
  ["#35", "Mobile layout is broken", "demo"],
  ["#33", "Markdown renders wrong in comments", "demo"],
  ["#36", "Voice input doesn't start", "demo"],
];
const IssueCard: React.FC<{ n: string; t: string; src: string; style?: React.CSSProperties; strike?: number }> = ({ n, t, src, style, strike = 0 }) => (
  <div style={{ width: 620, padding: "24px 28px", borderRadius: 12, background: "linear-gradient(180deg, rgb(255 255 255 / .06), rgb(255 255 255 / .02)), #13160E", border: `1px solid ${C.line}`, boxShadow: "0 30px 60px -20px rgb(0 0 0 / .7)", ...style }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 16, color: C.muted, letterSpacing: "0.06em" }}>
      <span>{n}</span>
      <span>{src === "github" ? "BuilderIO/agent-native" : "demo data"}</span>
    </div>
    <div style={{ fontFamily: SANS, fontSize: 30, fontWeight: 500, color: C.text, marginTop: 10, letterSpacing: "-0.02em" }}>{t}</div>
    <div style={{ display: "flex", gap: 16, marginTop: 14, fontFamily: MONO, fontSize: 17 }}>
      {["version: none", "steps: none"].map((x) => (
        <span key={x} style={{ position: "relative", color: strike ? C.bad : C.muted }}>
          {x}
          <span style={{ position: "absolute", left: 0, top: "52%", height: 2, width: `${strike * 100}%`, background: C.bad }} />
        </span>
      ))}
    </div>
  </div>
);

const PANELS: [string, [number, number, number], string][] = [
  ["t31-2-needsinfo", [1290, 140, 2.4], "+ needs-info"],
  ["t31-3-bug", [1290, 140, 2.4], "+ bug"],
  ["t31-4-reprodialog", [720, 430, 1.4], "request repro"],
  ["t31-6-assigned", [1300, 370, 2.4], "assign: triage"],
];
const Panel: React.FC<{ img: string; cam: [number, number, number]; label: string; style?: React.CSSProperties }> = ({ img, cam, label, style }) => {
  const W = 410, H = 300, s = cam[2] * (W / 1440) * 1.7;
  return (
    <div style={{ width: W, height: H, borderRadius: 12, overflow: "hidden", position: "relative", border: `1px solid ${C.line}`, background: C.surface, ...style }}>
      <Img src={staticFile(`shots/${img}.png`)} style={{ position: "absolute", width: 1440 * s, height: 810 * s, left: W / 2 - cam[0] * s, top: H / 2 - cam[1] * s }} />
      <div style={{ position: "absolute", left: 14, bottom: 12 }}><Mono size={15} color={C.text}>{label}</Mono></div>
    </div>
  );
};

export const Problem: React.FC<P> = ({ s }) => {
  const frame = useCurrentFrame();
  const p1 = vo(s, "p1"), p2 = vo(s, "p2"), p3 = vo(s, "p3"), p4 = vo(s, "p4");
  const phase = frame < p2.from ? 1 : frame < p3.from ? 2 : frame < p4.from ? 3 : 4;
  const tension = interpolate(frame, [0, s.dur], [0, 0.07], clamp);
  return (
    <AbsoluteFill>
      <Backdrop grid={0.8} tint={tension} drift={2} />
      {phase <= 2 ? (
        <AbsoluteFill style={{ perspective: 1800 }}>
          {ISSUES.map(([n, t, src], i) => {
            const st = p1.from + i * 7;
            const p = interpolate(frame, [st, st + 30], [0, 1], { ...clamp, easing: EXPO });
            const depth = (i % 3) * 140;
            const x = 140 + (i % 3) * 560 + Math.sin(frame / 80 + i) * 14 - (frame - st) * 0.06 * (1 + (i % 3) * 0.5);
            const y = 150 + Math.floor(i / 3) * 260 + (i % 2) * 60;
            const focus = phase === 2 && i < 3 ? interpolate(frame, [p2.from + i * 10, p2.from + i * 10 + 24], [0, 1], { ...clamp, easing: EXPO }) : 0;
            const dimOthers = phase === 2 && i >= 3 ? 0.25 : 1;
            return (
              <div key={n + i} style={{ position: "absolute", left: x, top: y, opacity: p * dimOthers, transform: `translateZ(${-depth + focus * 260}px) translateY(${(1 - p) * 60}px)`, filter: `blur(${(1 - p) * 8 + (phase === 2 && i >= 3 ? 4 : 0)}px)` }}>
                <IssueCard n={n} t={t} src={src} strike={phase === 2 && i < 3 ? interpolate(frame, [p2.from + 40 + i * 8, p2.from + 64 + i * 8], [0, 1], clamp) : 0} />
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 96, bottom: 90 }}>
            <Words text={phase === 1 ? "Every morning. A fresh pile." : "No version. No steps."} at={phase === 1 ? p1.from + 10 : p2.from} size={72} align="left" hi={phase === 2 ? ["no"] : []} />
          </div>
        </AbsoluteFill>
      ) : null}
      {phase === 3 ? <Timelapse from={p3.from} dur={p4.from - p3.from} /> : null}
      {phase === 4 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40, flexDirection: "column" }}>
          {["Write it a prompt?", "And trust it?"].map((t, i) => {
            const st = p4.from + 50 + i * 60;
            const strike = interpolate(frame, [st + 30, st + 44], [0, 1], { ...clamp, easing: EXPO });
            return (
              <div key={t} style={{ position: "relative" }}>
                <Words text={t} at={st} size={110} color={C.dim} />
                <div style={{ position: "absolute", left: -20, right: -20, top: "52%", height: 6, background: C.bad, transformOrigin: "left", transform: `scaleX(${strike})`, boxShadow: `0 0 20px ${C.bad}88` }} />
              </div>
            );
          })}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

const Timelapse: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const frame = useCurrentFrame() - from;
  const p = interpolate(frame, [0, dur], [0, 1], clamp);
  const mins = 9 * 60 + Math.floor(p * 220);
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  const beat = Math.floor(frame / 14);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 96, top: 110, display: "flex", gap: 24 }}>
        {PANELS.map(([img, cam, label], i) => {
          const on = beat % 4 === i;
          const app = interpolate(frame, [i * 8, i * 8 + 20], [0, 1], { ...clamp, easing: EXPO });
          return <Panel key={img} img={img} cam={cam} label={label} style={{ opacity: app * (on ? 1 : 0.45), transform: `translateY(${(1 - app) * 40}px) scale(${on ? 1.03 : 1})`, borderColor: on ? `${C.lime}88` : C.line, boxShadow: on ? `0 0 40px -10px ${C.lime}88` : undefined }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: 96, top: 480, fontFamily: MONO, fontSize: 200, color: C.text, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
        {hh}:{mm}
      </div>
      <div style={{ position: "absolute", left: 104, top: 700 }}>
        <Mono size={22}>label · repro · assign · next  ×  {12 + Math.floor(p * 37)}</Mono>
      </div>
      <div style={{ position: "absolute", right: 96, bottom: 110, width: 760 }}>
        <Words text={"Label. Repro. Assign.\nNext."} at={dur * 0.35} size={84} align="left" />
      </div>
    </AbsoluteFill>
  );
};

/* ================= breakers ================= */
export const Breaker: React.FC<{ text: string; hi?: string[] }> = ({ text, hi }) => (
  <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center" }}>
    <Words text={text} at={4} size={150} hi={hi} />
  </AbsoluteFill>
);

/* ================= 4. TURN: the trust ladder ================= */
const RUNGS = ["Watch", "Suggest", "Draft", "Act", "Auto"];
export const Turn: React.FC<P> = ({ s }) => {
  const frame = useCurrentFrame();
  const v = vo(s, "s1");
  const climb = interpolate(frame, [v.from + 60, v.from + v.dur], [0, 3], { ...clamp, easing: INOUT });
  return (
    <AbsoluteFill>
      <Backdrop orb={{ x: 1650, y: 180, r: 260, o: 0.7 }} />
      <div style={{ position: "absolute", left: 96, top: 120, width: 900 }}>
        <Words text={"Watch. Prove.\nThen act."} at={v.from} size={130} align="left" hi={["prove."]} stagger={5} />
      </div>
      <div style={{ position: "absolute", right: 120, bottom: 140, display: "flex", alignItems: "flex-end", gap: 14 }}>
        {RUNGS.map((r, i) => {
          const app = interpolate(frame, [v.from + i * 6, v.from + i * 6 + 30], [0, 1], { ...clamp, easing: EXPO });
          const lit = climb >= i - 0.2;
          return (
            <div key={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div style={{ width: 150, height: (60 + i * 70) * app, borderRadius: "10px 10px 0 0", border: `1px solid ${lit ? C.lime + "aa" : C.line}`, borderBottom: "none", background: lit ? `linear-gradient(180deg, ${C.lime}55, ${C.lime}12)` : "rgb(255 255 255 / .03)", boxShadow: lit ? `0 0 50px -10px ${C.lime}aa, inset 0 1px 0 rgb(255 255 255 / .3)` : undefined }} />
              <Mono size={18} color={lit ? C.text : C.muted}>{i} {r}</Mono>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 150 * climb + 14 * climb + 75 - 14, bottom: 60 + climb * 70 + 50, width: 28, height: 28, borderRadius: 28, background: C.lime, boxShadow: `0 0 30px ${C.lime}` }} />
      </div>
    </AbsoluteFill>
  );
};

/* ================= 5. WALKTHROUGH ================= */
const TAG_DEMO = "demo data · local app";
const TAG_REAL = "real open issues · github.com/BuilderIO/agent-native · read-only";
const L = (t: string) => t;

export const WImport: React.FC<P> = ({ s }) => (
  <W s={s} tag={TAG_REAL} steps={[
    { img: "a01-queue", w: 1, cam: [720, 405, 1] },
    { img: "a02-import-empty", w: 1.2, cam: [700, 600, 1.7], cur: at("a02-import-empty"), click: true, callout: { text: "Import open issues · read-only", x: 1140, y: 560 } },
    { img: "a03-import-typed", w: 1.1, cam: [800, 610, 1.9], cur: at("a03-import-typed"), click: true },
    { img: "a04-import-done", w: 1.2, cam: [300, 700, 1.7], callout: { text: "30 real issues imported", x: 640, y: 780 } },
    { img: "a06-real-issue", w: 1.6, cam: [700, 160, 1.45], callout: { text: L("BuilderIO/agent-native #8301 · real"), x: 1080, y: 160, color: C.item } },
  ]} />
);

const triage = (n: 31 | 32, fast = false): Step2[] => [
  { img: `t${n}-1-open`, w: fast ? 0.8 : 1, cam: [1150, 220, 1.6], cur: at(`t${n}-1-open`), click: true },
  { img: `t${n}-2-needsinfo`, w: 0.9, cam: [1150, 220, 1.6], cur: at(`t${n}-2-needsinfo`), click: true },
  ...(fast ? [] : [{ img: `t${n}-3-bug`, w: 0.9, cam: [1050, 650, 1.3], cur: at(`t${n}-3-bug`), click: true } as Step2]),
  { img: `t${n}-4-reprodialog`, w: 1.1, cam: [720, 420, 1.2], cur: at(`t${n}-4-reprodialog`), click: true, callout: fast ? undefined : { text: "Request repro: version, steps", x: 1240, y: 210 } },
  { img: `t${n}-5-reprodone`, w: 0.9, cam: [1250, 330, 1.7], cur: at(`t${n}-5-reprodone`), click: true },
  { img: `t${n}-6-assigned`, w: 1.2, cam: [880, 640, 1.5], callout: { text: "Recorded as a demonstration", x: 1180, y: 840 } },
];
type Step2 = Parameters<typeof Walk>[0]["steps"][number];

export const WTeach31: React.FC<P> = ({ s }) => <W s={s} tag={TAG_DEMO + " · issue #31"} steps={triage(31)} />;
export const WTeach32: React.FC<P> = ({ s }) => <W s={s} tag={TAG_DEMO + " · issue #32"} steps={triage(32, true)} />;

export const WGhost: React.FC<P> = ({ s }) => (
  <W s={s} tag={TAG_DEMO + " · issue #33"} steps={[
    { img: "t33-1-open", w: 1, cam: [1150, 220, 1.6], cur: at("t33-1-open"), click: true },
    { img: "t33-2-ghost", w: 1.6, cam: [870, 735, 2.1], callout: { text: "Predicted next step", x: 1180, y: 610 } },
    { img: "t33-3-tab1", w: 0.8, cam: [870, 735, 2.1], key: "Tab" },
    { img: "t33-3-tab2", w: 0.8, cam: [900, 600, 1.5], key: "Tab" },
    { img: "t33-3-tab3", w: 1.3, cam: [900, 520, 1.25], key: "Tab", callout: { text: "3 steps, one key each", x: 1230, y: 880 } },
  ]} />
);

export const WPattern: React.FC<P> = ({ s }) => (
  <W s={s} tag={TAG_DEMO} steps={[
    { img: "t33-3-tab3", w: 1.4, cam: [470, 330, 1.7], callout: { text: "Pattern found · seen 2×", x: 1000, y: 230 } },
    { img: "t33-3-tab3", w: 1.4, cam: [470, 525, 2.0], callout: { text: "Bob does it differently", x: 1010, y: 520, color: C.warn } },
    { img: "p01-pattern", w: 1, cam: [470, 560, 1.7], cur: at("p01-pattern"), click: true },
    { img: "p02-editor", w: 1.6, cam: [900, 560, 1.15], callout: { text: "Fixed · From the issue · Agent decides", x: 960, y: 900, color: C.agent } },
  ]} />
);

export const WBacktest: React.FC<P> = ({ s }) => (
  <W s={s} tag={TAG_DEMO + " · backtest on her own history"} steps={[
    { img: "p02-editor", w: 0.8, cam: [600, 200, 1.4], cur: at("p02-editor"), click: true },
    { img: "p03-backtest", w: 2.0, cam: [1150, 175, 1.9], callout: { text: "29 considered · 17 matched · 14 agreed", x: 760, y: 560 } },
    { img: "p03-backtest", w: 0.9, cam: [600, 380, 1.6], cur: at("p03-backtest"), click: true },
    { img: "p04-backtest-toggled", w: 1.8, cam: [1150, 175, 1.9], callout: { text: "False positives 3 → 7", x: 1120, y: 560, color: C.bad } },
    { img: "p03-backtest", w: 1.3, cam: [900, 300, 1.15], cur: at("p03-backtest"), click: true, callout: { text: "Kept tight", x: 420, y: 760 } },
  ]} />
);

export const WShadow: React.FC<P> = ({ s }) => (
  <W s={s} tag={TAG_DEMO + " · shadow mode"} steps={[
    { img: "p07-run-btn", w: 0.9, cam: [1100, 120, 1.7], cur: at("p07-run-btn"), click: true },
    { img: "r01-shadow", w: 1.3, cam: [720, 405, 1.05], callout: { text: "Shadow mode · nothing changes yet", x: 1050, y: 150 } },
    { img: "r02-approved1", w: 0.45, cam: [720, 405, 1.05], key: "A" },
    { img: "r02-approved2", w: 0.45, cam: [720, 405, 1.05], key: "A" },
    { img: "r02-approved3", w: 0.45, cam: [720, 405, 1.05], key: "A" },
    { img: "r02-approved4", w: 0.45, cam: [720, 405, 1.05], key: "A" },
    { img: "r02-approved5", w: 0.6, cam: [720, 405, 1.05], key: "A" },
    { img: "p08-ready", w: 1.1, cam: [620, 160, 1.8], cur: at("p08-ready"), click: true, callout: { text: "5 reviewed · 100% agreed", x: 1150, y: 190 } },
    { img: "p09-draft", w: 1, cam: [620, 160, 1.8], cur: at("p09-draft"), click: true },
    { img: "p10-act", w: 1.4, cam: [560, 150, 1.9], callout: { text: "Trust level: Act", x: 1160, y: 200 } },
  ]} />
);

export const WAct: React.FC<P> = ({ s }) => (
  <W s={s} tag={TAG_DEMO + " · act"} steps={[
    { img: "p11-act-run-btn", w: 0.9, cam: [1100, 120, 1.7], cur: at("p11-act-run-btn"), click: true },
    { img: "r03-act-run", w: 1.6, cam: [1000, 250, 1.35], cur: at("r03-act-run"), callout: { text: "4 handled · each with undo", x: 980, y: 860 } },
    { img: "w01-issue-handled", w: 1.1, cam: [900, 650, 1.6], cur: at("w01-issue-handled"), click: true },
    { img: "w02-why", w: 2.4, cam: [1290, 380, 1.55], callout: { text: "Taught by her: #31, #32", x: 300, y: 600 } },
  ]} />
);

export const WOverride: React.FC<P> = ({ s }) => (
  <W s={s} tag={TAG_REAL} steps={[
    { img: "o01-real-8918", w: 1.8, cam: [420, 230, 1.6], callout: { text: "Real issue #8918 · a feature request", x: 1010, y: 360, color: C.item } },
    { img: "o01-real-8918", w: 0.9, cam: [1000, 700, 1.4], cur: at("o01-real-8918"), click: true },
    { img: "o02-override-sheet", w: 0.9, cam: [1180, 160, 1.6], cur: at("o02-override-sheet"), click: true },
    { img: "o03-noapply", w: 0.9, cam: [1180, 200, 1.6], cur: at("o03-noapply"), click: true },
    { img: "o04-saved-test", w: 1.6, cam: [330, 700, 1.7], callout: { text: "Saved as test #3", x: 820, y: 690, color: C.ok } },
    { img: "o05-stepped-back", w: 1.7, cam: [620, 170, 1.6], callout: { text: "Stepped back to Draft", x: 1100, y: 330, color: C.warn } },
    { img: "o06-tests-failing", w: 1.7, cam: [780, 690, 1.35], callout: { text: "Must pass before promotion", x: 1020, y: 860, color: C.bad } },
  ]} />
);

const W: React.FC<{ s: SceneT; steps: Step2[]; tag: string }> = ({ s, steps, tag }) => (
  <AbsoluteFill>
    <Backdrop grid={0.7} orb={{ x: 1780, y: 1040, r: 300, o: 0.35 }} />
    <Walk steps={steps} dur={s.dur} tag={tag} />
  </AbsoluteFill>
);

/* ================= 6. UNDER THE HOOD ================= */
const CODE1 = `// actions/label-issue.ts
export default defineAction({
  schema: z.object({
    issueId, add, remove,
    playbookContext,
  }),
  ...domainAction("label-issue", …),
});`;
const CODE2 = `// server/apprentice/services/approval.ts
export function stepNeedsApproval(pb, stepId, action) {
  if (pb.trustLevel <= LEVELS.DRAFT) return true;
  if (pb.trustLevel === LEVELS.ACT)
    return !!step?.checkpoint || destructive;
  return false;
}`;

const Node: React.FC<{ x: number; y: number; label: string; sub?: string; lit: number; color?: string }> = ({ x, y, label, sub, lit, color = C.lime }) => (
  <div style={{ position: "absolute", left: x - 150, top: y - 50, width: 300, height: 100, borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `linear-gradient(180deg, rgb(255 255 255 / .06), rgb(255 255 255 / .01)), ${C.surface}`, border: `1px solid ${lit ? color + "cc" : C.line}`, boxShadow: lit ? `0 0 ${50 * lit}px -8px ${color}` : "none" }}>
    <div style={{ fontFamily: MONO, fontSize: 26, color: lit ? C.text : C.dim }}>{label}</div>
    {sub ? <div style={{ fontFamily: MONO, fontSize: 15, color: C.muted, marginTop: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>{sub}</div> : null}
  </div>
);

const Edge: React.FC<{ a: [number, number]; b: [number, number]; p: number; color?: string }> = ({ a, b, p, color = C.lime }) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const pulse = (p * 1.3) % 1;
  return (
    <div style={{ position: "absolute", left: a[0], top: a[1], width: len, height: 2, transformOrigin: "0 50%", transform: `rotate(${ang}rad)`, background: C.line }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: 2, width: `${Math.min(1, p) * 100}%`, background: `${color}88` }} />
      {p > 0 && p < 1.6 ? <div style={{ position: "absolute", left: `${pulse * 100}%`, top: -5, width: 12, height: 12, borderRadius: 12, background: color, boxShadow: `0 0 18px 4px ${color}` }} /> : null}
    </div>
  );
};

export const Hood: React.FC<P> = ({ s }) => {
  const frame = useCurrentFrame();
  const u1 = vo(s, "u1"), u2 = vo(s, "u2"), u3 = vo(s, "u3"), u4 = vo(s, "u4");
  const e = (st: number, len = 40) => interpolate(frame, [st, st + len], [0, 1], clamp);
  const statAt = u4.from + u4.dur + 10;
  return (
    <AbsoluteFill>
      <Backdrop grid={1} orb={{ x: 160, y: 1000, r: 260, o: 0.4 }} />
      <div style={{ position: "absolute", left: 96, top: 80 }}>
        <Mono size={20} color={C.lime}>under the hood · agent-native</Mono>
        <div style={{ marginTop: 18 }}><Words text="One action. Two callers." at={u1.from} size={76} align="left" exitAt={statAt - 10} /></div>
      </div>
      {frame < statAt ? (
        <>
          <Node x={330} y={470} label="UI click" sub="Maya" lit={e(u2.from)} color={C.item} />
          <Node x={330} y={700} label="Agent call" sub="tool use" lit={e(u2.from + 30)} color={C.agent} />
          <Edge a={[480, 470]} b={[760, 585]} p={e(u2.from, 50) * 1.5} color={C.item} />
          <Edge a={[480, 700]} b={[760, 585]} p={e(u2.from + 30, 50) * 1.5} color={C.agent} />
          <Node x={910} y={585} label="label-issue" sub="typed action" lit={e(u2.from + 60)} />
          <Pop at={u3.from} until={u4.from - 8} style={{ left: 1150, top: 300 }}>
            <Code text={CODE1} hi="playbookContext" />
          </Pop>
          <Pop at={u3.from + 40} until={u4.from - 8} style={{ left: 700, top: 760 }}>
            <Chip color={C.lime}>Every click = a clean demonstration</Chip>
          </Pop>
          {frame >= u4.from - 8 ? (
            <>
              <Edge a={[1060, 585]} b={[1290, 585]} p={e(u4.from, 40) * 1.4} />
              <Node x={1440} y={585} label="needsApproval" sub={frame > u4.from + 90 ? "gate open at Act" : "trust gate"} lit={e(u4.from + 40)} color={frame > u4.from + 90 ? C.ok : C.warn} />
              <Pop at={u4.from + 10} style={{ left: 1000, top: 700 }}>
                <Code text={CODE2} hi="LEVELS.ACT" />
              </Pop>
            </>
          ) : null}
        </>
      ) : (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24 }}>
          <Counter to={62} at={statAt} size={220} />
          <Words text="typed actions, shared by the UI and the agent" at={statAt + 10} size={44} weight={400} color={C.dim} tracking="-0.01em" />
          <Pop at={statAt + 40} style={{ position: "relative" }}><Mono size={20}>55 tests passing · typecheck clean</Mono></Pop>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const Code: React.FC<{ text: string; hi: string }> = ({ text, hi }) => {
  const frame = useCurrentFrame();
  const lines = text.split("\n");
  return (
    <div style={{ padding: "26px 30px", borderRadius: 14, background: "rgb(11 13 8 / .92)", border: `1px solid ${C.line}`, boxShadow: `0 30px 80px -20px rgb(0 0 0 / .8), 0 0 60px -30px ${C.lime}`, fontFamily: MONO, fontSize: 21, lineHeight: 1.55, color: C.dim, whiteSpace: "pre" }}>
      {lines.map((l, i) => {
        const shown = frame > i * 4;
        const isHi = l.includes(hi);
        return (
          <div key={i} style={{ opacity: shown ? 1 : 0, color: i === 0 ? C.muted : isHi ? C.lime : C.dim, textShadow: isHi ? `0 0 14px ${C.lime}88` : undefined }}>{l || " "}</div>
        );
      })}
    </div>
  );
};

const Counter: React.FC<{ to: number; at: number; size: number }> = ({ to, at: st, size }) => {
  const frame = useCurrentFrame();
  const v = Math.round(interpolate(frame, [st, st + 50], [0, to], { ...clamp, easing: EXPO }));
  return <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: size, letterSpacing: "-0.05em", color: C.lime, lineHeight: 1, fontVariantNumeric: "tabular-nums", textShadow: `0 0 60px ${C.lime}55` }}>{v}</div>;
};

/* ================= 7. IMPACT ================= */
export const Impact: React.FC<P> = ({ s }) => {
  const frame = useCurrentFrame();
  const i3 = vo(s, "i3");
  const chipsAt = i3.from + i3.dur + 6;
  const dim = interpolate(frame, [chipsAt - 6, chipsAt + 14], [0, 1], { ...clamp, easing: EXPO });
  return (
    <AbsoluteFill>
      <Backdrop grid={0.7} orb={{ x: 1780, y: 120, r: 280, o: 0.5 }} />
      <AbsoluteFill style={{ filter: `blur(${dim * 10}px) brightness(${1 - dim * 0.6})` }}>
        <Walk dur={chipsAt} tag="real numbers from this session · insights" steps={[
          { img: "i01-insights", w: 1, cam: [720, 405, 1] },
          { img: "i01-insights", w: 1.4, cam: [560, 180, 1.7] },
          { img: "i01-insights", w: 1.2, cam: [520, 330, 1.5] },
          { img: "p06-skill", w: 1.8, cam: [800, 420, 1.25] },
        ]} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 28 }}>
        {["Learns from your clicks", "Proves it before it acts", "Undo in one click"].map((t, i) => (
          <Pop key={t} at={chipsAt + i * 12} style={{ position: "relative" }}>
            <Chip size={46}>{t}</Chip>
          </Pop>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ================= 8. OUTRO ================= */
export const Outro: React.FC<P> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o1 = vo(s, "o1"), o2 = vo(s, "o2");
  const endAt = o2.from - 10;
  const logo = spring({ frame: frame - endAt, fps, config: { damping: 14, stiffness: 120 } });
  const fadeOut = interpolate(frame, [s.dur - 50, s.dur], [0, 1], clamp);
  return (
    <AbsoluteFill>
      {frame < endAt ? (
        <AbsoluteFill>
          <Backdrop grid={0.6} orb={{ x: 960, y: 1400 - interpolate(frame, [0, endAt], [0, 260], clamp), r: 520, o: 0.6 }} />
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 }}>
            <div style={{ fontFamily: MONO, fontSize: 150, color: C.text, letterSpacing: "-0.04em" }}>11:58</div>
            <Words text="Laptop closed before lunch." at={o1.from} size={64} weight={500} hi={["lunch."]} />
          </AbsoluteFill>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill>
          <Backdrop grid={1} orb={{ x: 1560, y: 760, r: 420, o: 0.85 }} />
          <div style={{ position: "absolute", left: 120, top: 250 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 30, transform: `scale(${0.9 + logo * 0.1})`, opacity: logo, transformOrigin: "left center" }}>
              <LogoMark size={110} draw={interpolate(frame, [endAt, endAt + 40], [0, 1], { ...clamp, easing: EXPO })} />
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 100, letterSpacing: "-0.05em", color: C.text }}>Apprentice</div>
            </div>
            <div style={{ marginTop: 50 }}>
              <Words text={"Show it once.\nDelegate forever."} at={endAt + 20} size={96} align="left" hi={["delegate", "forever."]} />
            </div>
            <Pop at={endAt + 80} style={{ position: "relative", marginTop: 60 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Mono size={22} color={C.text}>apprentice-agent.onrender.com</Mono>
                <Mono size={22} color={C.text}>github.com/LSUDOKO/Apprentice</Mono>
                <Mono size={18} style={{ marginTop: 18 }}>Built with Agent-Native · Builder.io Agent-Native Hackathon</Mono>
              </div>
            </Pop>
          </div>
          <LightLeak at={endAt} len={60} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut }} />
    </AbsoluteFill>
  );
};

export { Glitch, IN };
