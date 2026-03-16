import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { contentBanners } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { BannerData, QuoteData, StatData, TipData, CaseStudyData } from "@/types/content";

const BG = "#061217";
const TEAL = "#23C6B7";
const WHITE = "#F3F5F7";
const GRAY = "#8B98A3";
const FONT = "Inter, sans-serif";

const FORMAAT_SIZES = {
  instagram: { width: 1080, height: 1350 },
  linkedin: { width: 1200, height: 627 },
} as const;

function OgHeader({ scale }: { scale: number }) {
  return (
    <div style={{ position: "absolute", top: Math.round(40 * scale), left: Math.round(48 * scale), display: "flex", alignItems: "center", gap: Math.round(8 * scale) }}>
      <div style={{ width: Math.round(8 * scale), height: Math.round(8 * scale), borderRadius: "50%", background: TEAL }} />
      <span style={{ fontFamily: FONT, fontSize: Math.round(18 * scale), fontWeight: 600, color: WHITE }}>Autronis</span>
    </div>
  );
}

function OgFooter({ width, scale }: { width: number; height?: number; scale: number }) {
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
    }}>
      autronis.nl · Brengt structuur in je groei.
    </div>
  );
}

function renderQuote(data: QuoteData, variant: number, width: number, height: number): React.ReactElement {
  const scale = width / 1080;
  const v = variant % 4;
  const fontSize = Math.min(Math.round(52 * scale), Math.round(height * 0.08));

  if (v === 1) {
    return (
      <div style={{ position: "relative", width, height, background: BG, display: "flex", flexDirection: "column" }}>
        <OgHeader scale={scale} />
        <OgFooter width={width} height={height} scale={scale} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: Math.round(8 * scale), background: `linear-gradient(90deg, transparent, ${TEAL}, transparent)` }} />
        <div style={{
          position: "absolute",
          top: "50%",
          left: Math.round(80 * scale),
          right: Math.round(80 * scale),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: "translateY(-50%)",
        }}>
          <span style={{ fontFamily: FONT, fontSize: Math.round(100 * scale), fontWeight: 900, color: TEAL, lineHeight: "0.8", opacity: 0.6 }}>&ldquo;</span>
          <p style={{ fontFamily: FONT, fontSize: Math.min(Math.round(48 * scale), Math.round(height * 0.075)), fontWeight: 700, color: WHITE, lineHeight: 1.35, margin: 0, textAlign: "center" }}>{data.tekst}</p>
          {data.auteur ? <p style={{ fontFamily: FONT, fontSize: Math.round(20 * scale), color: GRAY, margin: `${Math.round(20 * scale)}px 0 0` }}>{data.auteur}</p> : null}
        </div>
      </div>
    );
  }

  if (v === 2 || v === 3) {
    return (
      <div style={{ position: "relative", width, height, background: BG, display: "flex", flexDirection: "column" }}>
        <OgHeader scale={scale} />
        <OgFooter width={width} height={height} scale={scale} />
        {v === 3 && (
          <div style={{ position: "absolute", top: 0, left: 0, width: Math.round(width * 0.08), height, background: `linear-gradient(180deg, ${TEAL}22, ${TEAL}66, ${TEAL}22)` }} />
        )}
        <div style={{
          position: "absolute",
          top: "50%",
          left: v === 3 ? Math.round(width * 0.08) + Math.round(60 * scale) : Math.round(80 * scale),
          right: Math.round(60 * scale),
          display: "flex",
          flexDirection: "column",
          transform: "translateY(-50%)",
        }}>
          <p style={{ fontFamily: FONT, fontSize, fontWeight: 700, color: WHITE, lineHeight: 1.35, margin: 0 }}>{data.tekst}</p>
          {data.auteur ? (
            <div style={{ display: "flex", alignItems: "center", gap: Math.round(12 * scale), marginTop: Math.round(28 * scale) }}>
              <div style={{ width: Math.round(32 * scale), height: Math.round(2 * scale), background: TEAL }} />
              <p style={{ fontFamily: FONT, fontSize: Math.round(18 * scale), color: TEAL, margin: 0, fontWeight: 600 }}>{data.auteur}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // v === 0
  return (
    <div style={{ position: "relative", width, height, background: BG, display: "flex", flexDirection: "column" }}>
      <OgHeader scale={scale} />
      <OgFooter width={width} height={height} scale={scale} />
      <div style={{
        position: "absolute",
        top: "50%",
        left: Math.round(72 * scale),
        right: Math.round(72 * scale),
        display: "flex",
        gap: Math.round(32 * scale),
        transform: "translateY(-50%)",
      }}>
        <div style={{ width: Math.round(4 * scale), background: TEAL, borderRadius: Math.round(2 * scale), alignSelf: "stretch" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <p style={{ fontFamily: FONT, fontSize, fontWeight: 700, color: WHITE, lineHeight: 1.3, margin: 0 }}>{data.tekst}</p>
          {data.auteur ? <p style={{ fontFamily: FONT, fontSize: Math.round(20 * scale), color: TEAL, marginTop: Math.round(24 * scale), fontWeight: 500 }}>— {data.auteur}</p> : null}
        </div>
      </div>
    </div>
  );
}

function renderStat(data: StatData, variant: number, width: number, height: number): React.ReactElement {
  const scale = width / 1080;
  const v = variant % 3;
  const numSize = Math.min(Math.round(96 * scale), Math.round(height * 0.14));

  if (v === 1) {
    return (
      <div style={{ position: "relative", width, height, background: BG, display: "flex", flexDirection: "column" }}>
        <OgHeader scale={scale} />
        <OgFooter width={width} height={height} scale={scale} />
        <div style={{ position: "absolute", top: 0, left: 0, width: Math.round(width / 2), height, background: "rgba(255,255,255,0.015)" }} />
        <div style={{ position: "absolute", top: Math.round(height * 0.28), left: 0, right: 0, display: "flex", justifyContent: "center", fontFamily: FONT, fontSize: Math.round(20 * scale), color: GRAY }}>
          {data.label}
        </div>
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, display: "flex", transform: "translateY(-50%)" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: `0 ${Math.round(40 * scale)}px` }}>
            <div style={{ fontFamily: FONT, fontSize: Math.round(14 * scale), color: GRAY, letterSpacing: "0.12em", marginBottom: Math.round(16 * scale) }}>VOOR</div>
            <div style={{ fontFamily: FONT, fontSize: numSize, fontWeight: 900, color: GRAY, textDecoration: "line-through" }}>{data.van}</div>
            {data.eenheid ? <div style={{ fontFamily: FONT, fontSize: Math.round(18 * scale), color: GRAY, marginTop: Math.round(10 * scale) }}>{data.eenheid}</div> : null}
          </div>
          <div style={{ width: Math.round(2 * scale), background: TEAL, opacity: 0.3, margin: `${Math.round(40 * scale)}px 0` }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: `0 ${Math.round(40 * scale)}px` }}>
            <div style={{ fontFamily: FONT, fontSize: Math.round(14 * scale), color: TEAL, letterSpacing: "0.12em", marginBottom: Math.round(16 * scale) }}>NA</div>
            <div style={{ fontFamily: FONT, fontSize: Math.round(numSize * 1.25), fontWeight: 900, color: TEAL }}>{data.naar}</div>
            {data.eenheid ? <div style={{ fontFamily: FONT, fontSize: Math.round(18 * scale), color: TEAL, marginTop: Math.round(10 * scale) }}>{data.eenheid}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width, height, background: BG, display: "flex", flexDirection: "column" }}>
      <OgHeader scale={scale} />
      <OgFooter width={width} height={height} scale={scale} />
      <div style={{ position: "absolute", top: "50%", left: Math.round(60 * scale), right: Math.round(60 * scale), display: "flex", flexDirection: "column", alignItems: "center", transform: "translateY(-50%)" }}>
        <p style={{ fontFamily: FONT, fontSize: Math.round(22 * scale), color: GRAY, margin: `0 0 ${Math.round(28 * scale)}px`, letterSpacing: "0.08em" }}>{data.label}</p>
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(32 * scale) }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontFamily: FONT, fontSize: numSize, fontWeight: 900, color: GRAY }}>{data.van}</div>
            {data.eenheid ? <div style={{ fontFamily: FONT, fontSize: Math.round(20 * scale), color: GRAY, marginTop: Math.round(8 * scale) }}>{data.eenheid}</div> : null}
          </div>
          <div style={{ fontFamily: FONT, fontSize: Math.round(60 * scale), fontWeight: 700, color: TEAL }}>→</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontFamily: FONT, fontSize: Math.round(numSize * 1.3), fontWeight: 900, color: TEAL }}>{data.naar}</div>
            {data.eenheid ? <div style={{ fontFamily: FONT, fontSize: Math.round(20 * scale), color: TEAL, marginTop: Math.round(8 * scale) }}>{data.eenheid}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderTip(data: TipData, variant: number, width: number, height: number): React.ReactElement {
  const scale = width / 1080;
  const itemGap = Math.round(Math.min(height * 0.06, 60 * scale));

  return (
    <div style={{ position: "relative", width, height, background: BG, display: "flex", flexDirection: "column" }}>
      <OgHeader scale={scale} />
      <OgFooter width={width} height={height} scale={scale} />
      <div style={{ position: "absolute", top: "50%", left: Math.round(72 * scale), right: Math.round(72 * scale), display: "flex", flexDirection: "column", transform: "translateY(-50%)" }}>
        <h2 style={{ fontFamily: FONT, fontSize: Math.min(Math.round(42 * scale), Math.round(height * 0.06)), fontWeight: 800, color: WHITE, margin: `0 0 ${Math.round(36 * scale)}px` }}>{data.titel}</h2>
        {data.punten.map((punt, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: Math.round(20 * scale), marginBottom: idx < 2 ? itemGap : 0 }}>
            <span style={{ fontFamily: FONT, fontSize: Math.round(32 * scale), fontWeight: 900, color: TEAL, lineHeight: "1", minWidth: Math.round(36 * scale) }}>
              {variant % 3 === 1 ? "✓" : `${idx + 1}.`}
            </span>
            <p style={{ fontFamily: FONT, fontSize: Math.min(Math.round(26 * scale), Math.round(height * 0.038)), color: idx === 0 ? WHITE : GRAY, margin: 0, lineHeight: 1.4, fontWeight: idx === 0 ? 600 : 400 }}>{punt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderCaseStudy(data: CaseStudyData, variant: number, width: number, height: number): React.ReactElement {
  const scale = width / 1080;
  const v = variant % 3;

  if (v === 1) {
    return (
      <div style={{ position: "relative", width, height, background: BG, display: "flex", flexDirection: "column" }}>
        <OgHeader scale={scale} />
        <OgFooter width={width} height={height} scale={scale} />
        <div style={{ position: "absolute", top: 0, left: 0, width: Math.round(width / 2), height, background: `${TEAL}06` }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, display: "flex", transform: "translateY(-50%)" }}>
          <div style={{ flex: 1, padding: `0 ${Math.round(48 * scale)}px`, display: "flex", flexDirection: "column", borderRight: `2px solid ${TEAL}33` }}>
            <div style={{ fontFamily: FONT, fontSize: Math.round(13 * scale), color: GRAY, letterSpacing: "0.1em", marginBottom: Math.round(12 * scale) }}>KLANT</div>
            <h2 style={{ fontFamily: FONT, fontSize: Math.min(Math.round(52 * scale), Math.round(height * 0.09)), fontWeight: 900, color: WHITE, margin: 0 }}>{data.klantNaam}</h2>
          </div>
          <div style={{ flex: 1, padding: `0 ${Math.round(48 * scale)}px`, display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: FONT, fontSize: Math.round(13 * scale), color: TEAL, letterSpacing: "0.1em", marginBottom: Math.round(12 * scale), fontWeight: 600 }}>RESULTAAT</div>
            <p style={{ fontFamily: FONT, fontSize: Math.min(Math.round(30 * scale), Math.round(height * 0.044)), color: TEAL, margin: 0, fontWeight: 700, lineHeight: 1.35 }}>{data.resultaat}</p>
            {data.beschrijving ? <p style={{ fontFamily: FONT, fontSize: Math.min(Math.round(18 * scale), Math.round(height * 0.027)), color: GRAY, margin: `${Math.round(16 * scale)}px 0 0`, lineHeight: 1.5 }}>{data.beschrijving}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width, height, background: BG, display: "flex", flexDirection: "column" }}>
      <OgHeader scale={scale} />
      <OgFooter width={width} height={height} scale={scale} />
      <div style={{ position: "absolute", top: "50%", left: Math.round(72 * scale), right: Math.round(72 * scale), display: "flex", flexDirection: "column", transform: "translateY(-50%)" }}>
        <div style={{ fontFamily: FONT, fontSize: Math.round(14 * scale), color: TEAL, letterSpacing: "0.14em", marginBottom: Math.round(16 * scale), fontWeight: 600 }}>CASE STUDY</div>
        <h2 style={{ fontFamily: FONT, fontSize: Math.min(Math.round(64 * scale), Math.round(height * 0.1)), fontWeight: 900, color: WHITE, margin: `0 0 ${Math.round(20 * scale)}px` }}>{data.klantNaam}</h2>
        <div style={{ width: Math.round(60 * scale), height: Math.round(3 * scale), background: TEAL, marginBottom: Math.round(24 * scale) }} />
        <p style={{ fontFamily: FONT, fontSize: Math.min(Math.round(32 * scale), Math.round(height * 0.048)), color: TEAL, margin: 0, fontWeight: 700, lineHeight: 1.3 }}>{data.resultaat}</p>
        {data.beschrijving ? <p style={{ fontFamily: FONT, fontSize: Math.min(Math.round(20 * scale), Math.round(height * 0.03)), color: GRAY, margin: `${Math.round(20 * scale)}px 0 0`, lineHeight: 1.5 }}>{data.beschrijving}</p> : null}
      </div>
    </div>
  );
}

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
    const formaat = banner.formaat as "instagram" | "linkedin";
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
