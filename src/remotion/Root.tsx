import { Composition } from "remotion";
import { AutronisVideo } from "./AutronisVideo";
import { VideoSchema } from "./types";

import type { Scene } from "./types";

// Try to load preview props from file (written by Video Studio)
let previewScenes: Scene[] | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require("./preview-props.json") as { scenes?: Scene[] };
  if (loaded?.scenes) previewScenes = loaded.scenes;
} catch {
  // File doesn't exist yet — use defaults
}

const defaultScenes: Scene[] = previewScenes ?? [
  {
    tekst: ["Handmatig werk", "kost je uren.", "Elke. Week."],
    accentRegel: 2,
    accentKleur: "geel" as const,
    icon: "clock",
    duur: 3,
  },
  {
    tekst: ["Wij automatiseren", "je herhalende taken."],
    accentRegel: 1,
    accentKleur: "turquoise" as const,
    icon: "zap",
    duur: 3,
  },
  {
    tekst: ["Zonder omkijken."],
    accentRegel: 0,
    accentKleur: "turquoise" as const,
    icon: "check",
    duur: 2,
  },
  {
    tekst: ["Autronis.nl", "Plan een gesprek →"],
    accentRegel: 0,
    accentKleur: "turquoise" as const,
    icon: "rocket",
    duur: 3,
    isCta: true,
  },
];

const totalDuur = (defaultScenes as { duur?: number }[]).reduce((s, sc) => s + (sc.duur ?? 3), 0);
const totalFrames = totalDuur * 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Square — 1:1 (Instagram feed, default) */}
      <Composition
        id="AutronisVideo"
        component={AutronisVideo}
        durationInFrames={totalFrames}
        fps={30}
        width={1080}
        height={1080}
        schema={VideoSchema}
        defaultProps={{ scenes: defaultScenes }}
      />
      <Composition
        id="AutronisVideoSquare"
        component={AutronisVideo}
        durationInFrames={totalFrames}
        fps={30}
        width={1080}
        height={1080}
        schema={VideoSchema}
        defaultProps={{ scenes: defaultScenes }}
      />

      {/* Reels — 9:16 (Instagram Reels, TikTok) */}
      <Composition
        id="AutronisVideoReels"
        component={AutronisVideo}
        durationInFrames={totalFrames}
        fps={30}
        width={1080}
        height={1920}
        schema={VideoSchema}
        defaultProps={{ scenes: defaultScenes }}
      />

      {/* Feed — 4:5 (Instagram portrait feed) */}
      <Composition
        id="AutronisVideoFeed"
        component={AutronisVideo}
        durationInFrames={totalFrames}
        fps={30}
        width={1080}
        height={1350}
        schema={VideoSchema}
        defaultProps={{ scenes: defaultScenes }}
      />

      {/* YouTube / LinkedIn — 16:9 */}
      <Composition
        id="AutronisVideoYouTube"
        component={AutronisVideo}
        durationInFrames={totalFrames}
        fps={30}
        width={1920}
        height={1080}
        schema={VideoSchema}
        defaultProps={{ scenes: defaultScenes }}
      />
    </>
  );
};
