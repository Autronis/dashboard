// Stat template — neon capsule design with chart illustration
import type { StatData } from "@/types/content";
import { BannerBackground, BannerHeader, BannerFooter, NeonCapsule } from "./shared";
import type { CapsuleIconType } from "./shared";

interface StatTemplateProps {
  data: StatData;
  variant: number;
  width: number;
  height: number;
}

const WHITE = "#F3F5F7";
const GRAY = "#8B98A3";
const NEON = "#2DD4A8";
const FONT = "Inter, sans-serif";

function getCapsuleIcon(variant: number): CapsuleIconType {
  return variant % 2 === 0 ? "bar-chart" : "zap";
}

function getCapsuleText(data: StatData, variant: number): string {
  const v = variant % 3;
  if (v === 0) return `${data.van} → ${data.naar}${data.eenheid ? ` ${data.eenheid}` : ""}`;
  if (v === 1) return data.label;
  return `${data.naar}${data.eenheid ? ` ${data.eenheid}` : ""}`;
}

export function StatTemplate({ data, variant, width, height }: StatTemplateProps) {
  const scale = width / 1080;
  const capsuleText = getCapsuleText(data, variant);
  const capsuleIcon = getCapsuleIcon(variant);

  const numSize = Math.min(Math.round(96 * scale), Math.round(height * 0.14));
  const labelSize = Math.round(22 * scale);
  const unitSize = Math.round(20 * scale);
  const arrowSize = Math.round(52 * scale);

  return (
    <BannerBackground width={width} height={height} illustration="chart">
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
          gap: Math.round(36 * scale),
          padding: `0 ${Math.round(60 * scale)}px`,
        }}
      >
        <NeonCapsule icon={capsuleIcon} text={capsuleText} width={width} />

        {/* Label */}
        <p
          style={{
            fontFamily: FONT,
            fontSize: labelSize,
            fontWeight: 400,
            color: GRAY,
            margin: 0,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            textAlign: "center",
          }}
        >
          {data.label}
        </p>

        {/* Before → After numbers */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: Math.round(32 * scale),
          }}
        >
          {/* Van (before) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: numSize,
                fontWeight: 900,
                color: GRAY,
                lineHeight: 1,
                textDecoration: "line-through",
                opacity: 0.7,
              }}
            >
              {data.van}
            </div>
            {data.eenheid && (
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: unitSize,
                  color: GRAY,
                  marginTop: Math.round(8 * scale),
                  opacity: 0.7,
                }}
              >
                {data.eenheid}
              </div>
            )}
          </div>

          {/* Arrow */}
          <div
            style={{
              fontFamily: FONT,
              fontSize: arrowSize,
              fontWeight: 700,
              color: NEON,
              lineHeight: 1,
              textShadow: `0 0 15px rgba(45,212,168,0.5)`,
            }}
          >
            →
          </div>

          {/* Naar (after) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: Math.round(numSize * 1.3),
                fontWeight: 900,
                color: NEON,
                lineHeight: 1,
                textShadow: `0 0 20px rgba(45,212,168,0.4)`,
              }}
            >
              {data.naar}
            </div>
            {data.eenheid && (
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: unitSize,
                  color: NEON,
                  marginTop: Math.round(8 * scale),
                  opacity: 0.8,
                }}
              >
                {data.eenheid}
              </div>
            )}
          </div>
        </div>

        {/* Subtle secondary label when variant shows full stat in capsule */}
        {variant % 3 === 2 && (
          <p
            style={{
              fontFamily: FONT,
              fontSize: Math.round(18 * scale),
              color: GRAY,
              margin: 0,
              opacity: 0.6,
              textAlign: "center",
            }}
          >
            was: {data.van}{data.eenheid ? ` ${data.eenheid}` : ""}
          </p>
        )}
      </div>
    </BannerBackground>
  );
}
