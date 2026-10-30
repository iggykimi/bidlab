import { Composition } from "remotion";
import { BidLabVideo } from "./Video";
import { FPS, TOTAL_FRAMES } from "./timeline";

export function Root() {
  return (
    <Composition
      id="BidLab"
      component={BidLabVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
}
