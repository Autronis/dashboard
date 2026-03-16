import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { contentBanners } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { BannerFormaat, BannerIcon, BannerIllustration } from "@/types/content";
import { BANNER_FORMAAT_SIZES } from "@/types/content";

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
  }
}

// ─── OG-safe simplified illustration ────────────────────────────────────────
function OgIllustration({ type, width, height }: { type: BannerIllustration; width: number; height: number }) {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.28;

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
      opacity={0.07}
    >
      {renderLines()}
    </svg>
  );
}

// ─── OG-safe flow lines ───────────────────────────────────────────────────────
function OgFlowLines({ width, height }: { width: number; height: number }) {
  const w = width;
  const h = height;
  return (
    <svg style={{ position: "absolute", top: 0, left: 0 }} width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={`M0,${h*0.2} C${w*0.25},${h*0.15} ${w*0.5},${h*0.25} ${w*0.75},${h*0.18} S${w},${h*0.22} ${w},${h*0.2}`} fill="none" stroke={NEON} strokeWidth="1.5" opacity="0.07" />
      <path d={`M0,${h*0.38} C${w*0.2},${h*0.32} ${w*0.45},${h*0.44} ${w*0.65},${h*0.36} S${w*0.88},${h*0.42} ${w},${h*0.38}`} fill="none" stroke={NEON} strokeWidth="1" opacity="0.055" />
      <path d={`M0,${h*0.55} C${w*0.3},${h*0.48} ${w*0.55},${h*0.62} ${w*0.75},${h*0.52} S${w},${h*0.58} ${w},${h*0.55}`} fill="none" stroke={NEON} strokeWidth="2" opacity="0.08" />
      <path d={`M0,${h*0.72} C${w*0.15},${h*0.66} ${w*0.4},${h*0.78} ${w*0.6},${h*0.7} S${w*0.85},${h*0.75} ${w},${h*0.72}`} fill="none" stroke={NEON} strokeWidth="1" opacity="0.05" />
      <path d={`M0,${h*0.88} C${w*0.22},${h*0.82} ${w*0.48},${h*0.94} ${w*0.7},${h*0.86} S${w},${h*0.9} ${w},${h*0.88}`} fill="none" stroke={NEON} strokeWidth="1.5" opacity="0.065" />
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
}: {
  onderwerp: string;
  icon: BannerIcon;
  illustration: BannerIllustration;
  width: number;
  height: number;
}) {
  const scale = width / 1080;
  const iconSize = Math.round(32 * scale);
  const fontSize = Math.min(Math.round(32 * scale), Math.round(height * 0.034));
  const paddingV = Math.round(20 * scale);
  const paddingH = Math.round(40 * scale);
  const capsuleGap = Math.round(16 * scale);

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        background: BG,
        display: "flex",
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      {/* Flow lines */}
      <OgFlowLines width={width} height={height} />

      {/* Illustration */}
      <OgIllustration type={illustration} width={width} height={height} />

      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: Math.round(width * 0.65),
          height: Math.round(height * 0.4),
          background: "radial-gradient(ellipse at center, rgba(45,212,168,0.08) 0%, transparent 70%)",
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
          fontFamily: FONT,
          fontSize: Math.round(18 * scale),
          fontWeight: 600,
          color: WHITE,
          letterSpacing: "0.02em",
        }}
      >
        ✦ Autronis
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
          fontFamily: FONT,
          fontSize: Math.round(14 * scale),
          color: GRAY,
          letterSpacing: "0.02em",
        }}
      >
        autronis.nl · Brengt structuur in je groei. · zakelijk@autronis.com
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
            boxShadow: `0 0 ${Math.round(20 * scale)}px rgba(45,212,168,0.4), 0 0 ${Math.round(60 * scale)}px rgba(45,212,168,0.15)`,
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
    };

    const onderwerp = parsed.onderwerp ?? "Autronis";
    const icon = (parsed.icon ?? "cog") as BannerIcon;
    const illustration = (parsed.illustration ?? "gear") as BannerIllustration;
    const formaat = (banner.formaat ?? "instagram") as BannerFormaat;
    const { width, height } = BANNER_FORMAAT_SIZES[formaat];

    const jsx = (
      <OgBanner
        onderwerp={onderwerp}
        icon={icon}
        illustration={illustration}
        width={width}
        height={height}
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
