import plan from "./plan.json";
import durations from "./vo-durations.json";

export const FPS = plan.fps;
export type TransIn = "cut" | "block" | "whip" | "roll" | "wipe" | "jump" | "zoom" | "glitch" | "dissolve";

/** Frames each transition overlaps the previous scene by (cuts and blocks overlap 0). */
export const OVERLAP: Record<TransIn, number> = { cut: 0, block: 0, jump: 0, glitch: 0, whip: 14, roll: 24, wipe: 20, zoom: 18, dissolve: 26 };

export type VoCue = { id: string; from: number; dur: number };
export type SceneT = { id: string; from: number; dur: number; in: TransIn; outOverlap: number; vo: VoCue[] };

const D = durations as Record<string, number>;
const f = (s: number) => Math.round(s * FPS);

export const SCENES: SceneT[] = (() => {
  const out: SceneT[] = [];
  let cursor = 0;
  for (const s of plan.scenes) {
    const tin = s.in as TransIn;
    const from = Math.max(0, cursor - OVERLAP[tin]);
    let t = f(s.lead) + OVERLAP[tin];
    const vo: VoCue[] = [];
    s.vo.forEach((id, i) => {
      if (i > 0) t += f(s.gap);
      const dur = f(D[id] ?? 1);
      vo.push({ id, from: t, dur });
      t += dur;
    });
    t += f(s.tail);
    out.push({ id: s.id, from, dur: t, in: tin, outOverlap: 0, vo });
    cursor = from + t;
  }
  for (let i = 0; i < out.length - 1; i++) out[i]!.outOverlap = OVERLAP[out[i + 1]!.in];
  return out;
})();

export const TOTAL = SCENES[SCENES.length - 1]!.from + SCENES[SCENES.length - 1]!.dur;
export const scene = (id: string) => SCENES.find((s) => s.id === id)!;
