import type { CaseStudyData } from "@/types/content";

interface CaseStudyTemplateProps {
  data: CaseStudyData;
  variant: number;
  width: number;
  height: number;
}

const BG = "#061217";
const TEAL = "#23C6B7";
const WHITE = "#F3F5F7";
const GRAY = "#8B98A3";
const FONT = "Inter, sans-serif";

function Header({ scale }: { scale: number }) {
  return (
    <div style={{ position: "absolute", top: 40 * scale, left: 48 * scale, display: "flex", alignItems: "center", gap: 8 * scale }}>
      <div style={{ width: 8 * scale, height: 8 * scale, borderRadius: "50%", background: TEAL }} />
      <span style={{ fontFamily: FONT, fontSize: 18 * scale, fontWeight: 600, color: WHITE, letterSpacing: "0.05em" }}>
        Autronis
      </span>
    </div>
  );
}

function Footer({ scale }: { scale: number; height?: number }) {
  return (
    <div style={{
      position: "absolute",
      bottom: 36 * scale,
      left: 0,
      right: 0,
      textAlign: "center",
      fontFamily: FONT,
      fontSize: 14 * scale,
      color: GRAY,
      letterSpacing: "0.03em",
    }}>
      autronis.nl · Brengt structuur in je groei.
    </div>
  );
}

function WavePattern({ width, height }: { width: number; height: number }) {
  return (
    <svg
      style={{ position: "absolute", bottom: 0, left: 0, opacity: 0.04 }}
      width={width}
      height={height * 0.4}
      viewBox={`0 0 ${width} ${height * 0.4}`}
      preserveAspectRatio="none"
    >
      <path
        d={`M0,${height * 0.2} C${width * 0.25},${height * 0.05} ${width * 0.5},${height * 0.3} ${width * 0.75},${height * 0.1} S${width},${height * 0.25} ${width},${height * 0.2}`}
        fill="none"
        stroke={TEAL}
        strokeWidth="2"
      />
    </svg>
  );
}

// Variant 0: Klant naam groot + resultaat in turquoise
function CaseVariant0({ data, scale, width, height }: { data: CaseStudyData; scale: number; width: number; height: number }) {
  return (
    <div style={{ position: "relative", width, height, background: BG, overflow: "hidden" }}>
      <WavePattern width={width} height={height} />
      <div style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: width * 0.3,
        height: height * 0.5,
        background: `radial-gradient(circle at top right, ${TEAL}08, transparent)`,
      }} />
      <Header scale={scale} />
      <Footer scale={scale} height={height} />
      <div style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        padding: `0 ${72 * scale}px`,
      }}>
        <div style={{ fontFamily: FONT, fontSize: 14 * scale, color: TEAL, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 * scale, fontWeight: 600 }}>
          Case Study
        </div>
        <h2 style={{
          fontFamily: FONT,
          fontSize: Math.min(64 * scale, height * 0.1),
          fontWeight: 900,
          color: WHITE,
          margin: `0 0 ${20 * scale}px`,
          lineHeight: 1.1,
        }}>
          {data.klantNaam}
        </h2>
        <div style={{ width: 60 * scale, height: 3 * scale, background: TEAL, marginBottom: 24 * scale, borderRadius: 2 }} />
        <p style={{
          fontFamily: FONT,
          fontSize: Math.min(32 * scale, height * 0.048),
          color: TEAL,
          margin: 0,
          fontWeight: 700,
          lineHeight: 1.3,
        }}>
          {data.resultaat}
        </p>
        {data.beschrijving && (
          <p style={{
            fontFamily: FONT,
            fontSize: Math.min(20 * scale, height * 0.03),
            color: GRAY,
            margin: `${20 * scale}px 0 0`,
            lineHeight: 1.5,
          }}>
            {data.beschrijving}
          </p>
        )}
      </div>
    </div>
  );
}

// Variant 1: Split — naam links, resultaat rechts
function CaseVariant1({ data, scale, width, height }: { data: CaseStudyData; scale: number; width: number; height: number }) {
  return (
    <div style={{ position: "relative", width, height, background: BG, overflow: "hidden" }}>
      <WavePattern width={width} height={height} />
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "50%",
        height: "100%",
        background: `${TEAL}06`,
      }} />
      <Header scale={scale} />
      <Footer scale={scale} height={height} />
      <div style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        display: "flex",
      }}>
        <div style={{
          flex: 1,
          padding: `0 ${48 * scale}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          borderRight: `2px solid ${TEAL}33`,
        }}>
          <div style={{ fontFamily: FONT, fontSize: 13 * scale, color: GRAY, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 * scale }}>
            Klant
          </div>
          <h2 style={{
            fontFamily: FONT,
            fontSize: Math.min(52 * scale, height * 0.09),
            fontWeight: 900,
            color: WHITE,
            margin: 0,
            lineHeight: 1.15,
          }}>
            {data.klantNaam}
          </h2>
        </div>
        <div style={{
          flex: 1,
          padding: `0 ${48 * scale}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}>
          <div style={{ fontFamily: FONT, fontSize: 13 * scale, color: TEAL, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 * scale, fontWeight: 600 }}>
            Resultaat
          </div>
          <p style={{
            fontFamily: FONT,
            fontSize: Math.min(30 * scale, height * 0.044),
            color: TEAL,
            margin: 0,
            fontWeight: 700,
            lineHeight: 1.35,
          }}>
            {data.resultaat}
          </p>
          {data.beschrijving && (
            <p style={{
              fontFamily: FONT,
              fontSize: Math.min(18 * scale, height * 0.027),
              color: GRAY,
              margin: `${16 * scale}px 0 0`,
              lineHeight: 1.5,
            }}>
              {data.beschrijving}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Variant 2: Centered with quote-style result
function CaseVariant2({ data, scale, width, height }: { data: CaseStudyData; scale: number; width: number; height: number }) {
  return (
    <div style={{ position: "relative", width, height, background: BG, overflow: "hidden" }}>
      <WavePattern width={width} height={height} />
      <div style={{
        position: "absolute",
        top: height * 0.1,
        left: "50%",
        transform: "translateX(-50%)",
        fontFamily: FONT,
        fontSize: 240 * scale,
        fontWeight: 900,
        color: TEAL,
        opacity: 0.04,
        userSelect: "none",
        lineHeight: 1,
      }}>
        ★
      </div>
      <Header scale={scale} />
      <Footer scale={scale} height={height} />
      <div style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        textAlign: "center",
        padding: `0 ${80 * scale}px`,
      }}>
        <div style={{
          display: "inline-block",
          background: `${TEAL}15`,
          border: `1px solid ${TEAL}44`,
          borderRadius: 8 * scale,
          padding: `8 * scale}px ${20 * scale}px`,
          fontFamily: FONT,
          fontSize: 15 * scale,
          color: TEAL,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: 24 * scale,
        }}>
          {data.klantNaam}
        </div>
        <p style={{
          fontFamily: FONT,
          fontSize: Math.min(44 * scale, height * 0.068),
          fontWeight: 800,
          color: WHITE,
          margin: `${24 * scale}px 0`,
          lineHeight: 1.3,
        }}>
          {data.resultaat}
        </p>
        {data.beschrijving && (
          <p style={{
            fontFamily: FONT,
            fontSize: Math.min(20 * scale, height * 0.03),
            color: GRAY,
            margin: 0,
            lineHeight: 1.55,
          }}>
            {data.beschrijving}
          </p>
        )}
      </div>
    </div>
  );
}

export function CaseStudyTemplate({ data, variant, width, height }: CaseStudyTemplateProps) {
  const scale = width / 1080;
  const v = variant % 3;
  if (v === 0) return <CaseVariant0 data={data} scale={scale} width={width} height={height} />;
  if (v === 1) return <CaseVariant1 data={data} scale={scale} width={width} height={height} />;
  return <CaseVariant2 data={data} scale={scale} width={width} height={height} />;
}
