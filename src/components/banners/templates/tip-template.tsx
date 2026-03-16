// Tip template — neon capsule design with lightbulb illustration
import type { TipData } from "@/types/content";
import { BannerBackground, BannerHeader, BannerFooter, NeonCapsule } from "./shared";
import type { CapsuleIconType } from "./shared";

interface TipTemplateProps {
  data: TipData;
  variant: number;
  width: number;
  height: number;
}

const WHITE = "#F3F5F7";
const GRAY = "#8B98A3";
const NEON = "#2DD4A8";
const FONT = "Inter, sans-serif";

// variant 0 → lightbulb, 1 → zap, 2 → lightbulb (alternates)
function getCapsuleIcon(variant: number): CapsuleIconType {
  return variant % 2 === 1 ? "zap" : "lightbulb";
}

function getCapsuleText(data: TipData, variant: number): string {
  const v = variant % 3;
  if (v === 0) return data.titel.length > 0 ? `AI Tip` : "AI Tip";
  if (v === 1) return "Automation Hack";
  return "Weekly Insight";
}

export function TipTemplate({ data, variant, width, height }: TipTemplateProps) {
  const scale = width / 1080;
  const capsuleText = getCapsuleText(data, variant);
  const capsuleIcon = getCapsuleIcon(variant);

  // spacing between tip points depends on available height
  const pointGap = Math.round(Math.min(height * 0.045, 48 * scale));
  const pointFontSize = Math.min(Math.round(24 * scale), Math.round(height * 0.034));

  return (
    <BannerBackground width={width} height={height} illustration="lightbulb">
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
          gap: Math.round(32 * scale),
          padding: `0 ${Math.round(72 * scale)}px`,
        }}
      >
        <NeonCapsule icon={capsuleIcon} text={capsuleText} width={width} />

        {/* Tip title */}
        <p
          style={{
            fontFamily: FONT,
            fontSize: Math.min(Math.round(36 * scale), Math.round(height * 0.052)),
            fontWeight: 700,
            color: WHITE,
            margin: 0,
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          {data.titel}
        </p>

        {/* Tip points — subtle below title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: pointGap,
            width: "100%",
            maxWidth: Math.round(700 * scale),
          }}
        >
          {data.punten.map((punt, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: Math.round(14 * scale),
              }}
            >
              {/* Bullet dot */}
              <div
                style={{
                  width: Math.round(8 * scale),
                  height: Math.round(8 * scale),
                  borderRadius: "50%",
                  background: NEON,
                  opacity: idx === 0 ? 0.9 : 0.5,
                  flexShrink: 0,
                  marginTop: Math.round(8 * scale),
                }}
              />
              <p
                style={{
                  fontFamily: FONT,
                  fontSize: pointFontSize,
                  color: idx === 0 ? WHITE : GRAY,
                  margin: 0,
                  lineHeight: 1.45,
                  fontWeight: idx === 0 ? 500 : 400,
                  opacity: idx === 0 ? 0.85 : 0.6,
                }}
              >
                {punt}
              </p>
            </div>
          ))}
        </div>
      </div>
    </BannerBackground>
  );
}
