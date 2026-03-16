"use client";

import type { BannerFormaat, BannerIcon, BannerIllustration } from "@/types/content";
import { BANNER_FORMAAT_SIZES, BANNER_ILLUSTRATION_BACKGROUNDS } from "@/types/content";
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
  illustrationScale?: number;
  illustrationOffsetX?: number;
  illustrationOffsetY?: number;
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
}: BannerRendererProps) {
  const { width, height } = BANNER_FORMAAT_SIZES[formaat];

  const fontSize = Math.min(Math.round(40 * scale), Math.round(height * scale * 0.04));
  const iconSize = Math.round(44 * scale);
  const headerFontSize = Math.round(18 * scale);
  const footerFontSize = Math.round(14 * scale);

  const paddingV = Math.round(24 * scale);
  const paddingH = Math.round(48 * scale);
  const capsuleGap = Math.round(18 * scale);

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
      {/* 1. Background — PNG if available, otherwise flow lines + SVG */}
      {BANNER_ILLUSTRATION_BACKGROUNDS[illustration] ? (
        <>
          {/* Real PNG background from Lovable covers */}
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${BANNER_ILLUSTRATION_BACKGROUNDS[illustration]})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.85,
          }} />
          {/* Dark overlay to ensure capsule readability */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at center, rgba(11,26,31,0.3) 0%, rgba(11,26,31,0.6) 70%)",
          }} />
        </>
      ) : (
        <>
          {/* Fallback: flow lines + SVG illustration */}
          <FlowLines width={width * scale} height={height * scale} />
          <BgIllustration
            type={illustration}
            width={width * scale}
            height={height * scale}
            scale={illustrationScale}
            offsetX={illustrationOffsetX}
            offsetY={illustrationOffsetY}
          />
        </>
      )}

      {/* 3. Radial glow behind capsule */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: width * scale * 0.9,
          height: height * scale * 0.55,
          background: "radial-gradient(ellipse at center, rgba(45,212,168,0.18) 0%, rgba(45,212,168,0.06) 40%, transparent 70%)",
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
            boxShadow: `0 0 ${Math.round(30 * scale)}px rgba(45,212,168,0.5), 0 0 ${Math.round(80 * scale)}px rgba(45,212,168,0.25), 0 0 ${Math.round(120 * scale)}px rgba(45,212,168,0.1)`,
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
