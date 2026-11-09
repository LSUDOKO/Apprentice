import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { Easing } from "remotion";

export const { fontFamily: SANS } = loadGeist("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
export const { fontFamily: MONO } = loadGeistMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

/** Apprentice brand tokens (from app/global.css dark theme + docs/brand). */
export const C = {
  bg: "#0B0D08",
  surface: "#13160E",
  line: "#2A2F1D",
  text: "#ECEEDF",
  dim: "#B8BEA6",
  muted: "#8E957D",
  lime: "#DDF26B",
  ok: "#B5E655",
  warn: "#F5C451",
  bad: "#FF7A6B",
  fixed: "#B4B9A4",
  item: "#5EEAD4",
  agent: "#C4B5FD",
};

export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const IN = Easing.bezier(0.7, 0, 0.84, 0);
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1);

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
