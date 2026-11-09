import { AbsoluteFill } from "remotion";

import { C, MONO, SANS } from "./brand";
import { Backdrop, LogoMark } from "./ui";

export const Thumb: React.FC = () => (
  <AbsoluteFill style={{ transform: "scale(0.6667)", transformOrigin: "0 0", width: 1920, height: 1080 }}>
    <Backdrop orb={{ x: 1500, y: 640, r: 420, o: 0.95 }} drift={0} />
    <div style={{ position: "absolute", left: 120, top: 200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <LogoMark size={96} />
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 60, color: C.text, letterSpacing: "-0.04em" }}>Apprentice</div>
      </div>
      <div style={{ marginTop: 60, fontFamily: SANS, fontWeight: 600, fontSize: 150, lineHeight: 0.95, letterSpacing: "-0.05em", color: C.text }}>
        Show it once.<br /><span style={{ color: C.lime }}>Delegate forever.</span>
      </div>
      <div style={{ marginTop: 50, fontFamily: MONO, fontSize: 26, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>Agent-Native Hackathon · demo film</div>
    </div>
  </AbsoluteFill>
);
