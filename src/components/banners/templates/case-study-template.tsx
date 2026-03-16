// Case study template — neon capsule design with network illustration
import type { CaseStudyData } from "@/types/content";
import { BannerBackground, BannerHeader, BannerFooter, NeonCapsule } from "./shared";
import type { CapsuleIconType } from "./shared";

interface CaseStudyTemplateProps {
  data: CaseStudyData;
  variant: number;
  width: number;
  height: number;
}

const WHITE = "#F3F5F7";
const GRAY = "#8B98A3";
const NEON = "#2DD4A8";
const FONT = "Inter, sans-serif";

function getCapsuleIcon(variant: number): CapsuleIconType {
  return variant % 2 === 0 ? "users" : "target";
}

function getCapsuleText(data: CaseStudyData, variant: number): string {
  const v = variant % 3;
  if (v === 0) return `${data.klantNaam} Case Study`;
  if (v === 1) return "Client Results";
  return `${data.klantNaam}`;
}

export function CaseStudyTemplate({ data, variant, width, height }: CaseStudyTemplateProps) {
  const scale = width / 1080;
  const capsuleText = getCapsuleText(data, variant);
  const capsuleIcon = getCapsuleIcon(variant);

  const resultFontSize = Math.min(Math.round(34 * scale), Math.round(height * 0.05));
  const descFontSize = Math.min(Math.round(20 * scale), Math.round(height * 0.03));

  return (
    <BannerBackground width={width} height={height} illustration="network">
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
          gap: Math.round(30 * scale),
          padding: `0 ${Math.round(72 * scale)}px`,
        }}
      >
        <NeonCapsule icon={capsuleIcon} text={capsuleText} width={width} />

        {/* Result — prominent below capsule */}
        <p
          style={{
            fontFamily: FONT,
            fontSize: resultFontSize,
            fontWeight: 700,
            color: NEON,
            margin: 0,
            textAlign: "center",
            lineHeight: 1.35,
            textShadow: `0 0 20px rgba(45,212,168,0.25)`,
          }}
        >
          {data.resultaat}
        </p>

        {/* Description — subtle */}
        {data.beschrijving && (
          <p
            style={{
              fontFamily: FONT,
              fontSize: descFontSize,
              fontWeight: 400,
              color: GRAY,
              margin: 0,
              textAlign: "center",
              lineHeight: 1.55,
              opacity: 0.75,
              maxWidth: Math.round(720 * scale),
            }}
          >
            {data.beschrijving}
          </p>
        )}

        {/* Divider line */}
        {variant % 3 !== 1 && (
          <div
            style={{
              width: Math.round(60 * scale),
              height: Math.round(2 * scale),
              background: NEON,
              opacity: 0.4,
              borderRadius: Math.round(2 * scale),
            }}
          />
        )}

        {/* Client name label — shown when capsule text is generic */}
        {variant % 3 === 1 && (
          <p
            style={{
              fontFamily: FONT,
              fontSize: Math.round(18 * scale),
              fontWeight: 600,
              color: WHITE,
              margin: 0,
              opacity: 0.7,
              letterSpacing: "0.05em",
            }}
          >
            {data.klantNaam}
          </p>
        )}
      </div>
    </BannerBackground>
  );
}
