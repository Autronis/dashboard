import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { contentBanners } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import type { BannerFormaat, BannerIcon, BannerIllustration } from "@/types/content";
import { BANNER_FORMAAT_SIZES, BANNER_ILLUSTRATION_BACKGROUNDS } from "@/types/content";

async function getLogoBase64(): Promise<string> {
  try {
    const logoBuffer = await readFile(join(process.cwd(), "public", "logo.png"));
    return `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    return "";
  }
}

const BG = "#0B1A1F";
const NEON = "#2DD4A8";
const WHITE = "#F3F5F7";
const GRAY = "#8B98A3";
const FONT = "Inter, sans-serif";

// ─── Simplified OG-safe icon ────────────────────────────────────────────────
function OgIcon({ icon, size }: { icon: BannerIcon; size: number }) {
  const s = size;
  const sw = "2";

  switch (icon) {
    case "cog":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke={NEON} strokeWidth={sw} />
          <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "brain":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "bar-chart":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="12" width="4" height="9" rx="1" stroke={NEON} strokeWidth={sw} />
          <rect x="10" y="7" width="4" height="14" rx="1" stroke={NEON} strokeWidth={sw} />
          <rect x="17" y="3" width="4" height="18" rx="1" stroke={NEON} strokeWidth={sw} />
        </svg>
      );
    case "link":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "lightbulb":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.22-1.2 4.16-3 5.2V17H9v-2.8A6 6 0 0 1 6 9a6 6 0 0 1 6-6z" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "target":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={NEON} strokeWidth={sw} />
          <circle cx="12" cy="12" r="6" stroke={NEON} strokeWidth={sw} />
          <circle cx="12" cy="12" r="2" stroke={NEON} strokeWidth={sw} />
        </svg>
      );
    case "git-branch":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <line x1="6" y1="3" x2="6" y2="15" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="18" cy="6" r="3" stroke={NEON} strokeWidth={sw} />
          <circle cx="6" cy="18" r="3" stroke={NEON} strokeWidth={sw} />
          <path d="M18 9a9 9 0 0 1-9 9" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "zap":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      );
    case "plug":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 22V12M5 12H2a10 10 0 0 0 20 0h-3" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <rect x="7" y="2" width="3" height="5" rx="1" stroke={NEON} strokeWidth={sw} />
          <rect x="14" y="2" width="3" height="5" rx="1" stroke={NEON} strokeWidth={sw} />
          <path d="M7 7v2a5 5 0 0 0 10 0V7" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "users":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="9" cy="7" r="4" stroke={NEON} strokeWidth={sw} />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "euro":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M4 10h12M4 14h12" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <path d="M19.5 7.5A7 7 0 1 0 19.5 16.5" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "shield":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "database":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="5" rx="9" ry="3" stroke={NEON} strokeWidth={sw} />
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" stroke={NEON} strokeWidth={sw} />
        </svg>
      );
    case "mail":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke={NEON} strokeWidth={sw} />
          <path d="M2 7l10 7 10-7" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "globe":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={NEON} strokeWidth={sw} />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke={NEON} strokeWidth={sw} />
        </svg>
      );
    case "rocket":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2L4.5 16.5z" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "clock":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={NEON} strokeWidth={sw} />
          <polyline points="12 6 12 12 16 14" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "layers":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polygon points="12 2 2 7 12 12 22 7 12 2" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
          <polyline points="2 17 12 22 22 17" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="2 12 12 17 22 12" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "trending-up":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="17 6 23 6 23 12" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "cpu":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="9" y="9" width="6" height="6" stroke={NEON} strokeWidth={sw} />
          <rect x="4" y="4" width="16" height="16" rx="2" stroke={NEON} strokeWidth={sw} />
          <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "cloud":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke={NEON} strokeWidth={sw} />
          <line x1="16" y1="2" x2="16" y2="6" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <line x1="8" y1="2" x2="8" y2="6" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <line x1="3" y1="10" x2="21" y2="10" stroke={NEON} strokeWidth={sw} />
        </svg>
      );
    case "key":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="7.5" cy="15.5" r="5.5" stroke={NEON} strokeWidth={sw} />
          <path d="M21 2l-9.6 9.6M15.5 7.5l3 3L21 8l-3-3" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "heart":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "workflow":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="5" cy="6" r="2" stroke={NEON} strokeWidth={sw} />
          <circle cx="19" cy="6" r="2" stroke={NEON} strokeWidth={sw} />
          <circle cx="12" cy="18" r="2" stroke={NEON} strokeWidth={sw} />
          <path d="M7 6h5M14 6h3M5 8v4l5 4M19 8v4l-5 4" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "api":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M8 6L3 12l5 6" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 6l5 6-5 6" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <line x1="13" y1="4" x2="11" y2="20" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "chat":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
          <line x1="8" y1="10" x2="16" y2="10" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <line x1="8" y1="13" x2="13" y2="13" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "check":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={NEON} strokeWidth={sw} />
          <path d="M8 12l3 3 5-5" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "settings":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke={NEON} strokeWidth={sw} />
          <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "search":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke={NEON} strokeWidth={sw} />
          <line x1="21" y1="21" x2="16.65" y2="16.65" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "star":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "diamond":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M2 12l4-8h12l4 8-10 10L2 12z" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
          <line x1="2" y1="12" x2="22" y2="12" stroke={NEON} strokeWidth={sw} />
        </svg>
      );
    case "code":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polyline points="16 18 22 12 16 6" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="8 6 2 12 8 18" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "truck":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="1" y="3" width="15" height="13" rx="1" stroke={NEON} strokeWidth={sw} />
          <path d="M16 8h4l3 5v3h-7V8z" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
          <circle cx="5.5" cy="18.5" r="2.5" stroke={NEON} strokeWidth={sw} />
          <circle cx="18.5" cy="18.5" r="2.5" stroke={NEON} strokeWidth={sw} />
        </svg>
      );
    case "building":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="2" width="12" height="20" rx="1" stroke={NEON} strokeWidth={sw} />
          <rect x="15" y="8" width="6" height="14" rx="1" stroke={NEON} strokeWidth={sw} />
          <line x1="3" y1="22" x2="21" y2="22" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <rect x="6" y="5" width="3" height="3" stroke={NEON} strokeWidth="1.5" />
          <rect x="10" y="5" width="3" height="3" stroke={NEON} strokeWidth="1.5" />
        </svg>
      );
    case "chart-pie":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "filter":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "repeat":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <polyline points="17 1 21 5 17 9" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <polyline points="7 23 3 19 7 15" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "send":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <line x1="22" y1="2" x2="11" y2="13" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "wifi":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M1.42 9a16 16 0 0 1 21.16 0" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <path d="M5 12.55a11 11 0 0 1 14.08 0" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="12" cy="20" r="1" fill={NEON} />
        </svg>
      );
  }
}

// ─── OG-safe simplified illustration ────────────────────────────────────────
function OgIllustration({
  type, width, height, scale = 1, offsetX = 0, offsetY = 0,
}: { type: BannerIllustration; width: number; height: number; scale?: number; offsetX?: number; offsetY?: number }) {
  const cx = width / 2 + offsetX;
  const cy = height / 2 + offsetY;
  const r = Math.min(width, height) * 0.38 * scale;

  function renderLines() {
    switch (type) {
      case "gear":
        return (
          <>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={NEON} strokeWidth="2" />
            <circle cx={cx} cy={cy} r={r * 0.55} fill="none" stroke={NEON} strokeWidth="2" />
            <circle cx={cx} cy={cy} r={r * 0.22} fill="none" stroke={NEON} strokeWidth="2" />
            {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              return <line key={i} x1={cx + Math.cos(rad) * r} y1={cy + Math.sin(rad) * r} x2={cx + Math.cos(rad) * (r * 1.22)} y2={cy + Math.sin(rad) * (r * 1.22)} stroke={NEON} strokeWidth="6" strokeLinecap="round" />;
            })}
          </>
        );
      case "brain":
        return (
          <>
            <ellipse cx={cx - r * 0.22} cy={cy} rx={r * 0.52} ry={r * 0.62} fill="none" stroke={NEON} strokeWidth="2" />
            <ellipse cx={cx + r * 0.22} cy={cy} rx={r * 0.52} ry={r * 0.62} fill="none" stroke={NEON} strokeWidth="2" />
            {[[cx-r*0.5,cy-r*0.2],[cx,cy-r*0.4],[cx+r*0.5,cy-r*0.2],[cx-r*0.5,cy+r*0.2],[cx,cy+r*0.4],[cx+r*0.5,cy+r*0.2]].map(([x,y], i) => (
              <circle key={i} cx={x} cy={y} r={r*0.06} fill={NEON} />
            ))}
          </>
        );
      case "chart":
        return (
          <>
            <line x1={cx-r} y1={cy+r*0.6} x2={cx+r} y2={cy+r*0.6} stroke={NEON} strokeWidth="2" />
            <line x1={cx-r} y1={cy-r*0.5} x2={cx-r} y2={cy+r*0.6} stroke={NEON} strokeWidth="2" />
            <path d={`M${cx-r*0.7},${cy+r*0.3} L${cx-r*0.3},${cy} L${cx+r*0.1},${cy-r*0.3} L${cx+r*0.7},${cy-r*0.9}`} fill="none" stroke={NEON} strokeWidth="2.5" strokeLinejoin="round" />
          </>
        );
      case "nodes":
        return (
          <>
            {[[cx,cy],[cx-r*0.6,cy-r*0.4],[cx+r*0.6,cy-r*0.4],[cx-r*0.6,cy+r*0.4],[cx+r*0.6,cy+r*0.4]].map(([x,y],i) => (
              <circle key={i} cx={x} cy={y} r={i===0?r*0.12:r*0.08} fill="none" stroke={NEON} strokeWidth="2" />
            ))}
            {[[0,1],[0,2],[0,3],[0,4],[1,3],[2,4]].map(([a,b],i) => {
              const pts = [[cx,cy],[cx-r*0.6,cy-r*0.4],[cx+r*0.6,cy-r*0.4],[cx-r*0.6,cy+r*0.4],[cx+r*0.6,cy+r*0.4]];
              return <line key={i} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} stroke={NEON} strokeWidth="1.5" />;
            })}
          </>
        );
      case "target":
        return (
          <>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={NEON} strokeWidth="2" />
            <circle cx={cx} cy={cy} r={r*0.65} fill="none" stroke={NEON} strokeWidth="2" />
            <circle cx={cx} cy={cy} r={r*0.32} fill="none" stroke={NEON} strokeWidth="2" />
          </>
        );
      case "puzzle":
        return (
          <>
            {[
              { x: cx - r * 0.5, y: cy - r * 0.5 },
              { x: cx,           y: cy - r * 0.5 },
              { x: cx - r * 0.5, y: cy            },
              { x: cx,           y: cy            },
            ].map((p, i) => (
              <rect key={i} x={p.x} y={p.y} width={r * 0.46} height={r * 0.46} rx={r * 0.05} fill="none" stroke={NEON} strokeWidth="2" opacity="0.7" />
            ))}
            <circle cx={cx} cy={cy - r * 0.27} r={r * 0.09} fill="none" stroke={NEON} strokeWidth="2" opacity="0.6" />
            <circle cx={cx - r * 0.27} cy={cy} r={r * 0.09} fill="none" stroke={NEON} strokeWidth="2" opacity="0.6" />
          </>
        );
      case "rocket":
        return (
          <>
            <path d={`M${cx},${cy - r * 0.9} Q${cx + r * 0.35},${cy - r * 0.3} ${cx + r * 0.35},${cy + r * 0.2} L${cx - r * 0.35},${cy + r * 0.2} Q${cx - r * 0.35},${cy - r * 0.3} ${cx},${cy - r * 0.9}`} fill="none" stroke={NEON} strokeWidth="2" opacity="0.7" />
            <circle cx={cx} cy={cy - r * 0.2} r={r * 0.16} fill="none" stroke={NEON} strokeWidth="2" opacity="0.8" />
            <path d={`M${cx - r * 0.35},${cy + r * 0.1} L${cx - r * 0.6},${cy + r * 0.4} L${cx - r * 0.35},${cy + r * 0.4}`} fill="none" stroke={NEON} strokeWidth="2" opacity="0.6" />
            <path d={`M${cx + r * 0.35},${cy + r * 0.1} L${cx + r * 0.6},${cy + r * 0.4} L${cx + r * 0.35},${cy + r * 0.4}`} fill="none" stroke={NEON} strokeWidth="2" opacity="0.6" />
          </>
        );
      case "calendar":
        return (
          <>
            <rect x={cx - r * 0.7} y={cy - r * 0.6} width={r * 1.4} height={r * 1.2} rx={r * 0.07} fill="none" stroke={NEON} strokeWidth="2" opacity="0.6" />
            <line x1={cx - r * 0.7} y1={cy - r * 0.3} x2={cx + r * 0.7} y2={cy - r * 0.3} stroke={NEON} strokeWidth="2" opacity="0.5" />
            {[-0.35, 0, 0.35].map((xo, i) =>
              [-0.05, 0.25].map((yo, j) => (
                <rect key={`${i}-${j}`} x={cx + xo * r - r * 0.12} y={cy + yo * r} width={r * 0.22} height={r * 0.2} rx={r * 0.03} fill="none" stroke={NEON} strokeWidth="1.5" opacity="0.4" />
              ))
            )}
          </>
        );
      case "cloud":
        return (
          <>
            <ellipse cx={cx} cy={cy} rx={r * 0.8} ry={r * 0.42} fill="none" stroke={NEON} strokeWidth="2" opacity="0.6" />
            <circle cx={cx - r * 0.35} cy={cy - r * 0.28} r={r * 0.3} fill="none" stroke={NEON} strokeWidth="2" opacity="0.6" />
            <circle cx={cx + r * 0.2} cy={cy - r * 0.38} r={r * 0.35} fill="none" stroke={NEON} strokeWidth="2" opacity="0.6" />
            {[-0.3, 0, 0.3].map((xo, i) => (
              <line key={i} x1={cx + xo * r} y1={cy + r * 0.45} x2={cx + xo * r} y2={cy + r * 0.75} stroke={NEON} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            ))}
          </>
        );
      case "magnet":
        return (
          <>
            <path d={`M${cx - r * 0.55},${cy - r * 0.7} L${cx - r * 0.55},${cy + r * 0.1} A${r * 0.2},${r * 0.2} 0 0 0 ${cx - r * 0.15},${cy + r * 0.1} L${cx - r * 0.15},${cy - r * 0.7}`} fill="none" stroke={NEON} strokeWidth="3" strokeLinejoin="round" opacity="0.7" />
            <path d={`M${cx + r * 0.15},${cy - r * 0.7} L${cx + r * 0.15},${cy + r * 0.1} A${r * 0.2},${r * 0.2} 0 0 0 ${cx + r * 0.55},${cy + r * 0.1} L${cx + r * 0.55},${cy - r * 0.7}`} fill="none" stroke={NEON} strokeWidth="3" strokeLinejoin="round" opacity="0.7" />
            <rect x={cx - r * 0.55} y={cy - r * 0.9} width={r * 1.1} height={r * 0.22} rx={r * 0.05} fill="none" stroke={NEON} strokeWidth="2" opacity="0.8" />
          </>
        );
      case "handshake":
        return (
          <>
            <line x1={cx - r * 0.8} y1={cy + r * 0.1} x2={cx - r * 0.1} y2={cy - r * 0.1} stroke={NEON} strokeWidth="6" strokeLinecap="round" opacity="0.4" />
            <line x1={cx + r * 0.8} y1={cy + r * 0.1} x2={cx + r * 0.1} y2={cy - r * 0.1} stroke={NEON} strokeWidth="6" strokeLinecap="round" opacity="0.4" />
            <ellipse cx={cx} cy={cy} rx={r * 0.22} ry={r * 0.3} fill="none" stroke={NEON} strokeWidth="2" opacity="0.8" />
          </>
        );
      default:
        // flow / circuit / lightbulb — use parallel angled lines
        return (
          <>
            {[0.2,0.35,0.5,0.65,0.8].map((f, i) => (
              <line key={i} x1={cx - r * 1.1} y1={cy - r * 0.8 + height * f * 0.5} x2={cx + r * 1.1} y2={cy - r * 0.8 + height * f * 0.5 + r * 0.15} stroke={NEON} strokeWidth="1.5" />
            ))}
          </>
        );
    }
  }

  return (
    <svg
      style={{ position: "absolute", top: 0, left: 0 }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      opacity={0.10}
    >
      {renderLines()}
    </svg>
  );
}

// ─── OG-safe flow lines (dashboard wave formula, static t=0) ─────────────────
function buildOgWavePath(width: number, height: number, waveIndex: number): string {
  const yBase = (height / 6) * (waveIndex + 1);
  const amplitude = 18 + waveIndex * 4;
  const frequency = 0.0015 + waveIndex * 0.0002;
  const offset1 = waveIndex * 0.8;
  const offset2 = waveIndex * 1.2;
  const offset3 = waveIndex * 0.5;

  const step = 8; // larger step for OG rendering (performance)
  const points: string[] = [];
  for (let x = 0; x <= width; x += step) {
    const y =
      yBase +
      Math.sin(x * frequency + offset1) * amplitude +
      Math.sin(x * frequency * 1.8 + offset2) * (amplitude * 0.35) +
      Math.cos(x * 0.0008 + offset3) * 5;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  if (points.length === 0) return "";
  return `M${points[0]} ` + points.slice(1).map((p) => `L${p}`).join(" ");
}

function OgFlowLines({ width, height }: { width: number; height: number }) {
  const opacities = [0.08, 0.10, 0.08, 0.10, 0.08];
  return (
    <svg style={{ position: "absolute", top: 0, left: 0 }} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[0, 1, 2, 3, 4].map((wi) => (
        <path
          key={wi}
          d={buildOgWavePath(width, height, wi)}
          fill="none"
          stroke={NEON}
          strokeWidth="0.7"
          opacity={String(opacities[wi])}
        />
      ))}
    </svg>
  );
}

// ─── Main OG banner layout ────────────────────────────────────────────────────
function OgBanner({
  onderwerp,
  icon,
  illustration,
  width,
  height,
  logoSrc,
  illustrationScale,
  illustrationOffsetX,
  illustrationOffsetY,
  aiBgBase64,
}: {
  onderwerp: string;
  icon: BannerIcon;
  illustration: BannerIllustration;
  width: number;
  height: number;
  logoSrc: string;
  illustrationScale?: number;
  illustrationOffsetX?: number;
  illustrationOffsetY?: number;
  aiBgBase64?: string;
}) {
  const scale = width / 1080;
  const iconSize = Math.round(44 * scale);
  const fontSize = Math.min(Math.round(40 * scale), Math.round(height * 0.04));
  const paddingV = Math.round(24 * scale);
  const paddingH = Math.round(48 * scale);
  const capsuleGap = Math.round(18 * scale);

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        background: `radial-gradient(ellipse at 50% 40%, #0F2B30 0%, ${BG} 50%, #081215 100%)`,
        display: "flex",
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      {/* Flow lines */}
      <OgFlowLines width={width} height={height} />

      {/* Background: AI image or SVG illustration */}
      {aiBgBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={aiBgBase64}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            objectFit: "cover",
            opacity: 0.5,
          }}
        />
      ) : (
        <OgIllustration
          type={illustration}
          width={width}
          height={height}
          scale={illustrationScale}
          offsetX={illustrationOffsetX}
          offsetY={illustrationOffsetY}
        />
      )}

      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: Math.round(width * 0.9),
          height: Math.round(height * 0.55),
          background: "radial-gradient(ellipse at center, rgba(45,212,168,0.35) 0%, rgba(45,212,168,0.18) 25%, rgba(45,212,168,0.08) 45%, rgba(45,212,168,0.02) 65%, transparent 80%)",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Header */}
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
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} width={Math.round(40 * scale)} height={Math.round(40 * scale)} style={{ objectFit: "contain" }} alt="Autronis" />
        )}
        <div
          style={{
            fontFamily: FONT,
            fontSize: Math.round(18 * scale),
            fontWeight: 600,
            color: WHITE,
            letterSpacing: "0.02em",
            display: "flex",
          }}
        >
          Autronis
        </div>
      </div>

      {/* Footer */}
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
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} width={Math.round(24 * scale)} height={Math.round(24 * scale)} style={{ objectFit: "contain", opacity: 0.6 }} alt="Autronis" />
        )}
        <div
          style={{
            fontFamily: FONT,
            fontSize: Math.round(14 * scale),
            color: GRAY,
            letterSpacing: "0.02em",
            display: "flex",
          }}
        >
          autronis.nl · Brengt structuur in je groei. · zakelijk@autronis.com
        </div>
      </div>

      {/* Centered capsule */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          transform: "translateY(-50%)",
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
            boxShadow: `0 0 ${Math.round(25 * scale)}px rgba(45,212,168,0.8), 0 0 ${Math.round(70 * scale)}px rgba(45,212,168,0.5), 0 0 ${Math.round(140 * scale)}px rgba(45,212,168,0.2), inset 0 0 ${Math.round(40 * scale)}px rgba(45,212,168,0.1)`,
          }}
        >
          <OgIcon icon={icon} size={iconSize} />
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
    </div>
  );
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bannerId = parseInt(id, 10);

  try {
    await requireAuth();

    if (isNaN(bannerId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const banner = await db
      .select()
      .from(contentBanners)
      .where(eq(contentBanners.id, bannerId))
      .get();

    if (!banner) {
      return NextResponse.json({ fout: "Banner niet gevonden" }, { status: 404 });
    }

    const parsed = JSON.parse(banner.data) as {
      onderwerp?: string;
      icon?: string;
      illustration?: string;
      illustrationScale?: number;
      illustrationOffsetX?: number;
      illustrationOffsetY?: number;
      aiBgUrl?: string;
    };

    const onderwerp = parsed.onderwerp ?? "Autronis";
    const icon = (parsed.icon ?? "cog") as BannerIcon;
    const illustration = (parsed.illustration ?? "gear") as BannerIllustration;
    const illustrationScale = typeof parsed.illustrationScale === "number" ? parsed.illustrationScale : 1.0;
    const illustrationOffsetX = typeof parsed.illustrationOffsetX === "number" ? parsed.illustrationOffsetX : 0;
    const illustrationOffsetY = typeof parsed.illustrationOffsetY === "number" ? parsed.illustrationOffsetY : 0;
    const aiBgUrl = parsed.aiBgUrl ?? undefined;
    const formaat = (banner.formaat ?? "instagram") as BannerFormaat;
    const { width, height } = BANNER_FORMAAT_SIZES[formaat];

    // Priority: AI bg > pre-generated PNG > SVG fallback
    const bgImagePath = aiBgUrl || BANNER_ILLUSTRATION_BACKGROUNDS[illustration as BannerIllustration];
    let aiBgBase64: string | undefined;
    if (bgImagePath) {
      try {
        const bgBuffer = await readFile(join(process.cwd(), "public", bgImagePath));
        aiBgBase64 = `data:image/png;base64,${bgBuffer.toString("base64")}`;
      } catch {
        // Fall back to SVG illustration if file not found
      }
    }

    const logoSrc = await getLogoBase64();

    const jsx = (
      <OgBanner
        onderwerp={onderwerp}
        icon={icon}
        illustration={illustration}
        width={width}
        height={height}
        logoSrc={logoSrc}
        illustrationScale={illustrationScale}
        illustrationOffsetX={illustrationOffsetX}
        illustrationOffsetY={illustrationOffsetY}
        aiBgBase64={aiBgBase64}
      />
    );

    const imageResponse = new ImageResponse(jsx, { width, height });
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `banner-${bannerId}-${Date.now()}.png`;
    const publicDir = join(process.cwd(), "public", "banners");
    await mkdir(publicDir, { recursive: true });
    await writeFile(join(publicDir, fileName), buffer);

    const imagePath = `/banners/${fileName}`;

    await db
      .update(contentBanners)
      .set({ imagePath, status: "klaar" })
      .where(eq(contentBanners.id, bannerId));

    return NextResponse.json({ ok: true, imagePath });
  } catch (error) {
    if (!isNaN(bannerId)) {
      await db
        .update(contentBanners)
        .set({ status: "fout" })
        .where(eq(contentBanners.id, bannerId))
        .catch(() => undefined);
    }

    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Renderen mislukt" },
      { status: 500 }
    );
  }
}
