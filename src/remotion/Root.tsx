import { Composition } from "remotion";
import { AutronisVideo } from "./AutronisVideo";
import { VideoSchema } from "./types";

const defaultScenes = [
  {
    tekst: [
      "Data wordt overgetypt.",
      "Updates lopen achter.",
      "Overzicht verdwijnt.",
    ],
    accentRegel: 2,
    accentKleur: "geel" as const,
    icon: "database",
    duur: 4,
  },
  {
    tekst: ["System integrations", "verbinden die stappen."],
    accentRegel: 1,
    accentKleur: "turquoise" as const,
    icon: "flow",
    duur: 3,
  },
  {
    tekst: ["Breng structuur", "in je data flows."],
    accentRegel: 1,
    accentKleur: "turquoise" as const,
    icon: "shield",
    duur: 4,
    isCta: true,
  },
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Square — 1:1 (Instagram feed, default) */}
      <Composition
        id="AutronisVideo"
        component={AutronisVideo}
        durationInFrames={1350}
        fps={30}
        width={1080}
        height={1080}
        schema={VideoSchema}
        defaultProps={{ scenes: defaultScenes }}
      />
      <Composition
        id="AutronisVideoSquare"
        component={AutronisVideo}
        durationInFrames={1350}
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
        durationInFrames={1350}
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
        durationInFrames={1350}
        fps={30}
        width={1080}
        height={1350}
        schema={VideoSchema}
        defaultProps={{ scenes: defaultScenes }}
      />

      {/* YouTube — 16:9 */}
      <Composition
        id="AutronisVideoYouTube"
        component={AutronisVideo}
        durationInFrames={1350}
        fps={30}
        width={1920}
        height={1080}
        schema={VideoSchema}
        defaultProps={{ scenes: defaultScenes }}
      />
    </>
  );
};
