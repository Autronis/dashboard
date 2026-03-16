// Quote template rewritten as "dienst/service" banner — neon capsule design
import type { QuoteData } from "@/types/content";
import { BannerBackground, BannerHeader, BannerFooter, NeonCapsule } from "./shared";
import type { IllustrationType, CapsuleIconType } from "./shared";

interface QuoteTemplateProps {
  data: QuoteData;
  variant: number;
  width: number;
  height: number;
}

const WHITE = "#F3F5F7";
const GRAY = "#8B98A3";
const NEON = "#2DD4A8";
const FONT = "Inter, sans-serif";

// variant 0-3 maps to 4 service types
const SERVICE_CONFIG: {
  illustration: IllustrationType;
  capsuleText: string;
  icon: CapsuleIconType;
  subtitel: string;
}[] = [
  {
    illustration: "gear",
    capsuleText: "Process Automation",
    icon: "cog",
    subtitel: "Slimmer werken met workflow automatisering",
  },
  {
    illustration: "brain",
    capsuleText: "AI Integration",
    icon: "brain",
    subtitel: "AI-gedreven oplossingen voor jouw bedrijf",
  },
  {
    illustration: "chart",
    capsuleText: "Data & Dashboards",
    icon: "bar-chart",
    subtitel: "Realtime inzicht in jouw KPIs en processen",
  },
  {
    illustration: "nodes",
    capsuleText: "System Integration",
    icon: "link",
    subtitel: "Koppelingen tussen al jouw systemen",
  },
];

export function QuoteTemplate({ data, variant, width, height }: QuoteTemplateProps) {
  const scale = width / 1080;
  const v = variant % 4;
  const config = SERVICE_CONFIG[v];

  // Optional: show quote text if provided, as a subtle tagline below capsule
  const hasQuote = Boolean(data.tekst && data.tekst.trim().length > 0);

  return (
    <BannerBackground width={width} height={height} illustration={config.illustration}>
      <BannerHeader width={width} />
      <BannerFooter width={width} height={height} />

      {/* Center content */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: Math.round(28 * scale),
          padding: `0 ${Math.round(60 * scale)}px`,
        }}
      >
        <NeonCapsule icon={config.icon} text={config.capsuleText} width={width} />

        <p
          style={{
            fontFamily: FONT,
            fontSize: Math.round(22 * scale),
            fontWeight: 400,
            color: GRAY,
            margin: 0,
            textAlign: "center",
            letterSpacing: "0.02em",
          }}
        >
          {config.subtitel}
        </p>

        {hasQuote && (
          <p
            style={{
              fontFamily: FONT,
              fontSize: Math.min(Math.round(34 * scale), Math.round(height * 0.05)),
              fontWeight: 600,
              color: WHITE,
              margin: `${Math.round(8 * scale)}px 0 0`,
              textAlign: "center",
              lineHeight: 1.4,
              opacity: 0.85,
            }}
          >
            {data.tekst}
          </p>
        )}

        {data.auteur && (
          <p
            style={{
              fontFamily: FONT,
              fontSize: Math.round(16 * scale),
              color: NEON,
              margin: 0,
              fontWeight: 500,
              opacity: 0.8,
            }}
          >
            — {data.auteur}
          </p>
        )}
      </div>
    </BannerBackground>
  );
}
