"use client";

import type { BannerFormaat, BannerIcon, BannerIllustration } from "@/types/content";
import { BANNER_FORMAAT_SIZES } from "@/types/content";
import { FlowLines } from "./flow-lines";
import { BgIllustration } from "./bg-illustrations";
import { CapsuleIcon } from "./capsule-icons";

const BG = "#0B1A1F";
const NEON = "#2DD4A8";
const WHITE = "#F3F5F7";
const GRAY = "#8B98A3";
const FONT = "Inter, sans-serif";

interface BannerRendererProps {
  onderwerp: string;
  icon: BannerIcon;
  illustration: BannerIllustration;
  formaat: BannerFormaat;
  scale?: number;
}

export function BannerRenderer({
  onderwerp,
  icon,
  illustration,
  formaat,
  scale = 1,
}: BannerRendererProps) {
  const { width, height } = BANNER_FORMAAT_SIZES[formaat];

  const fontSize = Math.min(Math.round(32 * scale), Math.round(height * scale * 0.035));
  const iconSize = Math.round(32 * scale);
  const headerFontSize = Math.round(18 * scale);
  const footerFontSize = Math.round(14 * scale);

  const paddingV = Math.round(20 * scale);
  const paddingH = Math.round(40 * scale);
  const capsuleGap = Math.round(16 * scale);

  return (
    <div
      style={{
        position: "relative",
        width: width * scale,
        height: height * scale,
        background: BG,
        overflow: "hidden",
        fontFamily: FONT,
        flexShrink: 0,
      }}
    >
      {/* 1. Flow lines */}
      <FlowLines width={width * scale} height={height * scale} />

      {/* 2. Background illustration */}
      <BgIllustration type={illustration} width={width * scale} height={height * scale} />

      {/* 3. Radial glow behind capsule */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: width * scale * 0.65,
          height: height * scale * 0.4,
          background: "radial-gradient(ellipse at center, rgba(45,212,168,0.08) 0%, transparent 70%)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* 4. Neon capsule — vertically centered */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: "translateY(-50%)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: capsuleGap,
            padding: `${paddingV}px ${paddingH}px`,
            borderRadius: "999px",
            border: `${Math.round(2 * scale)}px solid ${NEON}`,
            background: "rgba(45,212,168,0.08)",
            boxShadow: `0 0 ${Math.round(20 * scale)}px rgba(45,212,168,0.4), 0 0 ${Math.round(60 * scale)}px rgba(45,212,168,0.15)`,
          }}
        >
          <CapsuleIcon icon={icon} size={iconSize} />
          <span
            style={{
              fontFamily: FONT,
              fontSize,
              fontWeight: 800,
              color: NEON,
              textShadow: `0 0 ${Math.round(10 * scale)}px rgba(45,212,168,0.5)`,
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {onderwerp}
          </span>
        </div>
      </div>

      {/* 5. Header top-left */}
      <div
        style={{
          position: "absolute",
          top: Math.round(36 * scale),
          left: Math.round(44 * scale),
          display: "flex",
          alignItems: "center",
          gap: Math.round(8 * scale),
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontSize: headerFontSize,
            fontWeight: 600,
            color: WHITE,
            letterSpacing: "0.02em",
          }}
        >
          ✦ Autronis
        </span>
      </div>

      {/* 6. Footer bottom center */}
      <div
        style={{
          position: "absolute",
          bottom: Math.round(32 * scale),
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontSize: footerFontSize,
            color: GRAY,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          autronis.nl · Brengt structuur in je groei. · zakelijk@autronis.com
        </span>
      </div>
    </div>
  );
}
