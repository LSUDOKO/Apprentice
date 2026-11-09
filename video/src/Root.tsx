import { Composition, Still } from "remotion";

import { Film } from "./Film";
import { FPS, TOTAL } from "./timeline";
import { Thumb } from "./Thumb";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="ApprenticeFilm" component={Film} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    <Still id="Thumbnail" component={Thumb} width={1280} height={720} />
  </>
);
