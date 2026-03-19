"use client";

import type { BannerFormaat, BannerIcon, BannerIllustration } from "@/types/content";
import { BANNER_FORMAAT_SIZES, BANNER_ILLUSTRATION_BACKGROUNDS } from "@/types/content";
import { FlowLines } from "./flow-lines";
import { BgIllustration } from "./bg-illustrations";
import { CapsuleIcon } from "./capsule-icons";

const BG = "#0A1214";
const NEON = "#17B8A5";
const WHITE = "#F3F5F7";
const GRAY = "#8B98A3";
const FONT = "Inter, sans-serif";

interface BannerRendererProps {
  onderwerp: string;
  icon: BannerIcon;
  illustration: BannerIllustration;
  formaat: BannerFormaat;
  scale?: number;
  illustrationScale?: number;
  illustrationOffsetX?: number;
  illustrationOffsetY?: number;
  aiBgUrl?: string;
}

export function BannerRenderer({
  onderwerp,
  icon,
  illustration,
  formaat,
  scale = 1,
  illustrationScale,
  illustrationOffsetX,
  illustrationOffsetY,
  aiBgUrl,
}: BannerRendererProps) {
  const { width, height } = BANNER_FORMAAT_SIZES[formaat];

  // Priority: AI bg > pre-generated PNG > SVG fallback
  const bgImageUrl = aiBgUrl || BANNER_ILLUSTRATION_BACKGROUNDS[illustration];

  const fontSize = Math.min(Math.round(52 * scale), Math.round(height * scale * 0.05));
  const iconSize = Math.round(56 * scale);
  const headerFontSize = Math.round(18 * scale);
  const footerFontSize = Math.round(14 * scale);

  const paddingV = Math.round(32 * scale);
  const paddingH = Math.round(64 * scale);
  const capsuleGap = Math.round(22 * scale);

  // For tall formats (4:5, story), shift capsule up so it sits in the
  // center of the top square crop (grid/cover view)
  const isVertical = height > width;
  const capsuleTop = isVertical ? `${Math.round((width / height) * 50)}%` : "50%";

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

      {/* 2. Background: PNG image (AI or pre-generated) or SVG fallback */}
      {bgImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgImageUrl}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: width * scale,
            height: height * scale,
            objectFit: "cover",
            opacity: 0.7,
          }}
        />
      ) : (
        <BgIllustration
          type={illustration}
          width={width * scale}
          height={height * scale}
          scale={illustrationScale}
          offsetX={illustrationOffsetX}
          offsetY={illustrationOffsetY}
        />
      )}

      {/* 3. Radial glow behind capsule — strong bloom */}
      <div
        style={{
          position: "absolute",
          top: capsuleTop,
          left: "50%",
          width: width * scale * 1.1,
          height: height * scale * 0.6,
          background: "radial-gradient(ellipse at center, rgba(23,184,165,0.25) 0%, rgba(23,184,165,0.12) 30%, rgba(23,184,165,0.04) 55%, transparent 75%)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* 4. Neon capsule — centered (shifted up for tall formats) */}
      <div
        style={{
          position: "absolute",
          top: capsuleTop,
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
            background: "rgba(23,184,165,0.12)",
            boxShadow: `0 0 ${Math.round(20 * scale)}px rgba(23,184,165,0.7), 0 0 ${Math.round(60 * scale)}px rgba(23,184,165,0.4), 0 0 ${Math.round(120 * scale)}px rgba(23,184,165,0.15), inset 0 0 ${Math.round(30 * scale)}px rgba(23,184,165,0.08)`,
          }}
        >
          <CapsuleIcon icon={icon} size={iconSize} />
          <span
            style={{
              fontFamily: FONT,
              fontSize,
              fontWeight: 800,
              color: NEON,
              textShadow: `0 0 ${Math.round(8 * scale)}px rgba(23,184,165,0.8), 0 0 ${Math.round(20 * scale)}px rgba(23,184,165,0.4)`,
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {onderwerp}
          </span>
        </div>
      </div>

      {/* 5. Header top-center */}
      <div
        style={{
          position: "absolute",
          top: Math.round(36 * scale),
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: Math.round(10 * scale),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Autronis"
          style={{ height: Math.round(40 * scale), width: "auto", objectFit: "contain" }}
        />
        <span
          style={{
            fontFamily: FONT,
            fontSize: headerFontSize,
            fontWeight: 600,
            color: WHITE,
            letterSpacing: "0.02em",
          }}
        >
          Autronis
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
          alignItems: "center",
          gap: Math.round(8 * scale),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Autronis"
          style={{ height: Math.round(24 * scale), width: "auto", objectFit: "contain", opacity: 0.6 }}
        />
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
