import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { contentBanners } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { BannerData, QuoteData, StatData, TipData, CaseStudyData } from "@/types/content";

const BG_DARK = "#0B1A1F";
const BG_DARKER = "#061217";
const NEON = "#2DD4A8";
const WHITE = "#F3F5F7";
const GRAY = "#8B98A3";
const FONT = "Inter, sans-serif";

const FORMAAT_SIZES = {
  instagram: { width: 1080, height: 1350 },
  linkedin: { width: 1200, height: 627 },
  instagram_story: { width: 1080, height: 1920 },
} as const;

// ─── Shared OG components ─────────────────────────────────────────────────────

function OgHeader({ scale }: { scale: number }) {
  const iconSize = Math.round(26 * scale);
  return (
    <div style={{ position: "absolute", top: Math.round(40 * scale), left: Math.round(48 * scale), display: "flex", alignItems: "center", gap: Math.round(10 * scale) }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 26 26">
        <rect x="2" y="6" width="14" height="14" rx="2" stroke={NEON} strokeWidth="2" fill="none" transform="rotate(-8 9 13)" />
        <rect x="10" y="6" width="14" height="14" rx="2" fill={`${NEON}22`} stroke={NEON} strokeWidth="2" transform="rotate(8 17 13)" />
      </svg>
      <span style={{ fontFamily: FONT, fontSize: Math.round(18 * scale), fontWeight: 700, color: WHITE, letterSpacing: "0.04em" }}>Autronis</span>
    </div>
  );
}

function OgFooter({ width, scale }: { width: number; scale: number }) {
  return (
    <div style={{
      position: "absolute",
      bottom: Math.round(36 * scale),
      left: 0,
      width,
      display: "flex",
      justifyContent: "center",
      fontFamily: FONT,
      fontSize: Math.round(14 * scale),
      color: GRAY,
      letterSpacing: "0.03em",
    }}>
      autronis.nl · Brengt structuur in je groei. · zakelijk@autronis.com
    </div>
  );
}

function OgBackground({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: "relative",
      width,
      height,
      background: `linear-gradient(145deg, ${BG_DARK} 0%, ${BG_DARKER} 100%)`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily: FONT,
    }}>
      {/* Radial glow */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: Math.round(width * 0.7),
        height: Math.round(height * 0.5),
        background: "radial-gradient(ellipse at center, rgba(45,212,168,0.07) 0%, transparent 70%)",
        transform: "translate(-50%, -50%)",
      }} />
      {/* Flow lines */}
      <svg style={{ position: "absolute", top: 0, left: 0 }} width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path d={`M0,${height * 0.3} C${width * 0.15},${height * 0.22} ${width * 0.35},${height * 0.38} ${width * 0.55},${height * 0.28} S${width * 0.8},${height * 0.32} ${width},${height * 0.26}`} fill="none" stroke={NEON} strokeWidth="2" opacity="0.07" />
        <path d={`M0,${height * 0.5} C${width * 0.2},${height * 0.42} ${width * 0.4},${height * 0.58} ${width * 0.6},${height * 0.46} S${width * 0.85},${height * 0.54} ${width},${height * 0.48}`} fill="none" stroke={NEON} strokeWidth="1.5" opacity="0.055" />
        <path d={`M0,${height * 0.7} C${width * 0.25},${height * 0.62} ${width * 0.45},${height * 0.76} ${width * 0.65},${height * 0.66} S${width * 0.88},${height * 0.72} ${width},${height * 0.68}`} fill="none" stroke={NEON} strokeWidth="1" opacity="0.05" />
      </svg>
      {children}
    </div>
  );
}

type CapsuleIconType = "cog" | "zap" | "chart" | "link" | "bulb" | "users" | "target";

function OgCapsule({ text, scale, icon }: { text: string; scale: number; icon: CapsuleIconType }) {
  const iconSize = Math.round(32 * scale);
  const paddingV = Math.round(18 * scale);
  const paddingH = Math.round(36 * scale);
  const gap = Math.round(16 * scale);
  const sw = "2";
  const s = iconSize;

  function renderIcon() {
    if (icon === "cog") return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke={NEON} strokeWidth={sw} />
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
    if (icon === "zap") return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke={NEON} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
    if (icon === "chart") return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="12" width="4" height="9" rx="1" stroke={NEON} strokeWidth={sw} />
        <rect x="10" y="7" width="4" height="14" rx="1" stroke={NEON} strokeWidth={sw} />
        <rect x="17" y="3" width="4" height="18" rx="1" stroke={NEON} strokeWidth={sw} />
      </svg>
    );
    if (icon === "link") return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
    if (icon === "bulb") return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.22-1.2 4.16-3 5.2V17H9v-2.8A6 6 0 0 1 6 9a6 6 0 0 1 6-6z" stroke={NEON} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
    if (icon === "users") return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" stroke={NEON} strokeWidth={sw} />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={NEON} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
    // target
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={NEON} strokeWidth={sw} />
        <circle cx="12" cy="12" r="6" stroke={NEON} strokeWidth={sw} />
        <circle cx="12" cy="12" r="2" stroke={NEON} strokeWidth={sw} />
      </svg>
    );
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap,
      padding: `${paddingV}px ${paddingH}px`,
      borderRadius: "999px",
      border: `${Math.round(2 * scale)}px solid ${NEON}`,
      background: "rgba(45,212,168,0.08)",
      boxShadow: `0 0 ${Math.round(20 * scale)}px rgba(45,212,168,0.4), 0 0 ${Math.round(60 * scale)}px rgba(45,212,168,0.15)`,
    }}>
      {renderIcon()}
      <span style={{
        fontFamily: FONT,
        fontSize: Math.round(28 * scale),
        fontWeight: 800,
        color: NEON,
        textShadow: `0 0 ${Math.round(10 * scale)}px rgba(45,212,168,0.5)`,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}>
        {text}
      </span>
    </div>
  );
}

// ─── Template renderers ────────────────────────────────────────────────────────

function renderQuote(data: QuoteData, variant: number, width: number, height: number): React.ReactElement {
  const scale = width / 1080;
  const v = variant % 4;

  const serviceConfigs: { capsule: string; icon: CapsuleIconType }[] = [
    { capsule: "Process Automation", icon: "cog" },
    { capsule: "AI Integration", icon: "cog" },
    { capsule: "Data & Dashboards", icon: "chart" },
    { capsule: "System Integration", icon: "link" },
  ];
  const config = serviceConfigs[v];

  return (
    <OgBackground width={width} height={height}>
      <OgHeader scale={scale} />
      <OgFooter width={width} scale={scale} />
      <div style={{
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
      }}>
        <OgCapsule text={config.capsule} scale={scale} icon={config.icon} />
        {data.tekst ? (
          <p style={{ fontFamily: FONT, fontSize: Math.min(Math.round(34 * scale), Math.round(height * 0.05)), fontWeight: 600, color: WHITE, margin: 0, textAlign: "center", lineHeight: 1.4, opacity: 0.85 }}>
            {data.tekst}
          </p>
        ) : null}
        {data.auteur ? (
          <p style={{ fontFamily: FONT, fontSize: Math.round(16 * scale), color: NEON, margin: 0, fontWeight: 500, opacity: 0.8 }}>
            — {data.auteur}
          </p>
        ) : null}
      </div>
    </OgBackground>
  );
}

function renderStat(data: StatData, variant: number, width: number, height: number): React.ReactElement {
  const scale = width / 1080;
  const v = variant % 3;
  const numSize = Math.min(Math.round(96 * scale), Math.round(height * 0.14));

  let capsuleText: string;
  if (v === 0) capsuleText = `${data.van} → ${data.naar}${data.eenheid ? ` ${data.eenheid}` : ""}`;
  else if (v === 1) capsuleText = data.label;
  else capsuleText = `${data.naar}${data.eenheid ? ` ${data.eenheid}` : ""}`;

  const capsuleIcon: CapsuleIconType = v % 2 === 0 ? "chart" : "zap";

  return (
    <OgBackground width={width} height={height}>
      <OgHeader scale={scale} />
      <OgFooter width={width} scale={scale} />
      <div style={{
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
      }}>
        <OgCapsule text={capsuleText} scale={scale} icon={capsuleIcon} />
        <p style={{ fontFamily: FONT, fontSize: Math.round(22 * scale), fontWeight: 400, color: GRAY, margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {data.label}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: Math.round(32 * scale) }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontFamily: FONT, fontSize: numSize, fontWeight: 900, color: GRAY, lineHeight: "1", textDecoration: "line-through", opacity: 0.7 }}>{data.van}</div>
            {data.eenheid ? <div style={{ fontFamily: FONT, fontSize: Math.round(20 * scale), color: GRAY, marginTop: Math.round(8 * scale), opacity: 0.7 }}>{data.eenheid}</div> : null}
          </div>
          <div style={{ fontFamily: FONT, fontSize: Math.round(52 * scale), fontWeight: 700, color: NEON, lineHeight: "1", textShadow: "0 0 15px rgba(45,212,168,0.5)" }}>→</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontFamily: FONT, fontSize: Math.round(numSize * 1.3), fontWeight: 900, color: NEON, lineHeight: "1", textShadow: "0 0 20px rgba(45,212,168,0.4)" }}>{data.naar}</div>
            {data.eenheid ? <div style={{ fontFamily: FONT, fontSize: Math.round(20 * scale), color: NEON, marginTop: Math.round(8 * scale), opacity: 0.8 }}>{data.eenheid}</div> : null}
          </div>
        </div>
      </div>
    </OgBackground>
  );
}

function renderTip(data: TipData, variant: number, width: number, height: number): React.ReactElement {
  const scale = width / 1080;
  const capsuleText = variant % 3 === 0 ? "AI Tip" : variant % 3 === 1 ? "Automation Hack" : "Weekly Insight";
  const capsuleIcon: CapsuleIconType = variant % 2 === 1 ? "zap" : "bulb";
  const pointGap = Math.round(Math.min(height * 0.045, 48 * scale));
  const pointFontSize = Math.min(Math.round(24 * scale), Math.round(height * 0.034));

  return (
    <OgBackground width={width} height={height}>
      <OgHeader scale={scale} />
      <OgFooter width={width} scale={scale} />
      <div style={{
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
      }}>
        <OgCapsule text={capsuleText} scale={scale} icon={capsuleIcon} />
        <p style={{ fontFamily: FONT, fontSize: Math.min(Math.round(36 * scale), Math.round(height * 0.052)), fontWeight: 700, color: WHITE, margin: 0, textAlign: "center", lineHeight: 1.3 }}>
          {data.titel}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: pointGap, width: "100%", maxWidth: Math.round(700 * scale) }}>
          {data.punten.map((punt, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: Math.round(14 * scale) }}>
              <div style={{ width: Math.round(8 * scale), height: Math.round(8 * scale), borderRadius: "50%", background: NEON, opacity: idx === 0 ? 0.9 : 0.5, flexShrink: 0, marginTop: Math.round(8 * scale) }} />
              <p style={{ fontFamily: FONT, fontSize: pointFontSize, color: idx === 0 ? WHITE : GRAY, margin: 0, lineHeight: 1.45, fontWeight: idx === 0 ? 500 : 400, opacity: idx === 0 ? 0.85 : 0.6 }}>
                {punt}
              </p>
            </div>
          ))}
        </div>
      </div>
    </OgBackground>
  );
}

function renderCaseStudy(data: CaseStudyData, variant: number, width: number, height: number): React.ReactElement {
  const scale = width / 1080;
  const v = variant % 3;

  let capsuleText: string;
  if (v === 0) capsuleText = `${data.klantNaam} Case Study`;
  else if (v === 1) capsuleText = "Client Results";
  else capsuleText = data.klantNaam;

  const capsuleIcon: CapsuleIconType = v % 2 === 0 ? "users" : "target";
  const resultFontSize = Math.min(Math.round(34 * scale), Math.round(height * 0.05));
  const descFontSize = Math.min(Math.round(20 * scale), Math.round(height * 0.03));

  return (
    <OgBackground width={width} height={height}>
      <OgHeader scale={scale} />
      <OgFooter width={width} scale={scale} />
      <div style={{
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
      }}>
        <OgCapsule text={capsuleText} scale={scale} icon={capsuleIcon} />
        <p style={{ fontFamily: FONT, fontSize: resultFontSize, fontWeight: 700, color: NEON, margin: 0, textAlign: "center", lineHeight: 1.35, textShadow: "0 0 20px rgba(45,212,168,0.25)" }}>
          {data.resultaat}
        </p>
        {data.beschrijving ? (
          <p style={{ fontFamily: FONT, fontSize: descFontSize, fontWeight: 400, color: GRAY, margin: 0, textAlign: "center", lineHeight: 1.55, opacity: 0.75, maxWidth: Math.round(720 * scale) }}>
            {data.beschrijving}
          </p>
        ) : null}
        {v === 1 ? (
          <p style={{ fontFamily: FONT, fontSize: Math.round(18 * scale), fontWeight: 600, color: WHITE, margin: 0, opacity: 0.7, letterSpacing: "0.05em" }}>
            {data.klantNaam}
          </p>
        ) : (
          <div style={{ width: Math.round(60 * scale), height: Math.round(2 * scale), background: NEON, opacity: 0.4, borderRadius: Math.round(2 * scale) }} />
        )}
      </div>
    </OgBackground>
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

    const data = JSON.parse(banner.data) as BannerData;
    const formaat = banner.formaat as "instagram" | "linkedin" | "instagram_story";
    const { width, height } = FORMAAT_SIZES[formaat];
    const variant = banner.templateVariant ?? 0;

    let jsx: React.ReactElement;
    switch (banner.templateType) {
      case "quote":
        jsx = renderQuote(data as QuoteData, variant, width, height);
        break;
      case "stat":
        jsx = renderStat(data as StatData, variant, width, height);
        break;
      case "tip":
        jsx = renderTip(data as TipData, variant, width, height);
        break;
      case "case_study":
        jsx = renderCaseStudy(data as CaseStudyData, variant, width, height);
        break;
      default:
        return NextResponse.json({ fout: "Onbekend templateType" }, { status: 400 });
    }

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
