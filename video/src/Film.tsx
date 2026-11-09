import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile } from "remotion";

import { C } from "./brand";
import { Breaker, Hood, Hook, Impact, Outro, Problem, Title, Turn, WAct, WBacktest, WGhost, WImport, WOverride, WPattern, WShadow, WTeach31, WTeach32 } from "./scenes";
import { OVERLAP, SCENES, scene, TOTAL, type SceneT } from "./timeline";
import { BlockWipe, Glitch, LightLeak, Shell } from "./ui";

const VIEW: Record<string, React.FC<{ s: SceneT }>> = {
  hook: Hook,
  title: Title,
  problem: Problem,
  breaker1: () => <Breaker text="What if it just watched?" hi={["watched?"]} />,
  turn: Turn,
  "w-import": WImport,
  "w-teach31": WTeach31,
  "w-teach32": WTeach32,
  "w-ghost": WGhost,
  "w-pattern": WPattern,
  "w-backtest": WBacktest,
  "w-shadow": WShadow,
  "w-act": WAct,
  "w-override": WOverride,
  hood: Hood,
  impact: Impact,
  breaker2: () => <Breaker text="Show it once." hi={["once."]} />,
  outro: Outro,
};

const SFX: React.FC<{ at: number; src: string; v?: number }> = ({ at, src, v = 0.8 }) => (
  <Sequence from={Math.max(0, at)} durationInFrames={150} layout="none">
    <Audio src={staticFile(`sfx/${src}.wav`)} volume={v} />
  </Sequence>
);

/** Music sits at full level between lines and ducks ~15 dB under the voice. */
const VO_SPANS = SCENES.flatMap((s) => s.vo.map((v) => [s.from + v.from, s.from + v.from + v.dur] as const));
const musicVolume = (f: number) => {
  let duck = 0;
  for (const [a, b] of VO_SPANS) duck = Math.max(duck, interpolate(f, [a - 10, a, b, b + 18], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const fadeIn = interpolate(f, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  return 0.55 * fadeIn * (1 - duck * 0.82);
};

export const Film: React.FC = () => {
  const title = scene("title");
  const shadow = scene("w-shadow");
  const override = scene("w-override");
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {SCENES.map((s, i) => {
        const V = VIEW[s.id]!;
        const next = SCENES[i + 1];
        return (
          <Sequence key={s.id} name={s.id} from={s.from} durationInFrames={s.dur}>
            <Shell tin={s.in} inFrames={OVERLAP[s.in]} dur={s.dur} outNext={next?.in ?? null} outFrames={s.outOverlap}>
              <V s={s} />
            </Shell>
            {s.vo.map((v) => (
              <Sequence key={v.id} from={v.from} durationInFrames={v.dur + 6} layout="none">
                <Audio src={staticFile(`vo/${v.id}.wav`)} volume={1} />
              </Sequence>
            ))}
          </Sequence>
        );
      })}

      {/* film-level transition overlays */}
      {SCENES.filter((s) => s.in === "block").map((s) => (
        <BlockWipe key={`b${s.id}`} center={s.from} />
      ))}
      <LightLeak at={shadow.from + Math.round(shadow.dur * (1 - 1.4 / 8.15))} len={46} />
      <Glitch at={override.from + Math.round(override.dur * (2.7 / 9.5))} len={8} />

      {/* music + sound design */}
      <Audio src={staticFile("music.wav")} volume={musicVolume} />
      <SFX at={title.from - 100} src="riser" v={0.5} />
      <SFX at={title.from + 60} src="hit" v={0.9} />
      <SFX at={scene("hook").from + scene("hook").vo[1]!.from} src="hit" v={0.7} />
      {SCENES.filter((s) => ["whip", "zoom", "block", "roll", "wipe"].includes(s.in)).map((s) => (
        <SFX key={`w${s.id}`} at={s.from - 10} src="whoosh" v={0.45} />
      ))}
      {["breaker1", "breaker2"].map((id) => (
        <SFX key={id} at={scene(id).from} src="hit" v={0.6} />
      ))}
      <SFX at={override.from} src="glitch" v={0.35} />
      <SFX at={override.from + Math.round(override.dur * (2.7 / 9.5))} src="glitch" v={0.3} />
      <SFX at={override.from + Math.round(override.dur * (4.6 / 9.5))} src="chime" v={0.5} />
      <SFX at={shadow.from + Math.round(shadow.dur * (1 - 1.4 / 8.15))} src="chime" v={0.45} />
      <SFX at={scene("outro").from + scene("outro").vo[1]!.from - 10} src="hit" v={0.8} />
    </AbsoluteFill>
  );
};

export const FILM_FRAMES = TOTAL;
