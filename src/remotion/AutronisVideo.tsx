import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { VideoProps } from "./types";
import { Background } from "./components/Background";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { SceneContent } from "./components/SceneContent";

const TRANSITION_FRAMES = 12;

interface SceneRange {
  start: number;
  end: number;
  durationFrames: number;
}

function buildSceneRanges(
  scenes: VideoProps["scenes"],
  fps: number
): SceneRange[] {
  const ranges: SceneRange[] = [];
  let cursor = 0;

  for (const scene of scenes) {
    const durationFrames = Math.round(scene.duur * fps);
    ranges.push({
      start: cursor,
      end: cursor + durationFrames,
      durationFrames,
    });
    cursor += durationFrames;
  }

  return ranges;
}

export const AutronisVideo: React.FC<VideoProps> = ({ scenes }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const ranges = buildSceneRanges(scenes, fps);

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Background />
      <Header />
      <Footer />

      {scenes.map((scene, i) => {
        const range = ranges[i];
        if (!range) return null;

        const localFrame = frame - range.start;

        // Fade in with spring
        const fadeIn = i === 0
          ? 1
          : spring({ frame: localFrame, fps, config: { damping: 20, stiffness: 100 } });

        // Fade out during transition to next scene
        const fadeOutStart = range.durationFrames - TRANSITION_FRAMES;
        const fadeOut = interpolate(
          localFrame,
          [fadeOutStart, range.durationFrames],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const sceneOpacity = Math.min(fadeIn, fadeOut);

        // Slight scale effect on scene enter
        const scaleIn = interpolate(fadeIn, [0, 1], [1.02, 1]);

        // Scene is only active in its own time window (with small overlap for crossfade)
        const isActive =
          frame >= range.start && frame < range.end + TRANSITION_FRAMES;

        if (!isActive) return null;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width,
              height,
              opacity: sceneOpacity,
              transform: `scale(${scaleIn})`,
            }}
          >
            <SceneContent scene={scene} frame={Math.max(0, localFrame)} />
          </div>
        );
      })}
    </div>
  );
};
