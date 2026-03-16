import type { QuoteData } from "@/types/content";

interface QuoteTemplateProps {
  data: QuoteData;
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

function Footer({ scale }: { scale: number; width: number; height: number }) {
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
      <path
        d={`M0,${height * 0.28} C${width * 0.3},${height * 0.12} ${width * 0.6},${height * 0.35} ${width * 0.85},${height * 0.18} S${width},${height * 0.3} ${width},${height * 0.28}`}
        fill="none"
        stroke={TEAL}
        strokeWidth="1.5"
      />
      <path
        d={`M0,${height * 0.35} C${width * 0.2},${height * 0.2} ${width * 0.55},${height * 0.38} ${width * 0.8},${height * 0.22} S${width},${height * 0.35} ${width},${height * 0.35}`}
        fill="none"
        stroke={TEAL}
        strokeWidth="1"
      />
    </svg>
  );
}

// Variant 0: Large centered quote with turquoise accent line left
function QuoteVariant0({ data, scale, width, height }: { data: QuoteData; scale: number; width: number; height: number }) {
  return (
    <div style={{ position: "relative", width, height, background: BG, overflow: "hidden" }}>
      <WavePattern width={width} height={height} />
      <Header scale={scale} />
      <Footer scale={scale} width={width} height={height} />
      <div style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        padding: `0 ${72 * scale}px`,
        display: "flex",
        gap: 32 * scale,
      }}>
        <div style={{ width: 4 * scale, flexShrink: 0, background: TEAL, borderRadius: 2 * scale }} />
        <div>
          <p style={{
            fontFamily: FONT,
            fontSize: Math.min(52 * scale, height * 0.08),
            fontWeight: 700,
            color: WHITE,
            lineHeight: 1.3,
            margin: 0,
          }}>
            {data.tekst}
          </p>
          {data.auteur && (
            <p style={{
              fontFamily: FONT,
              fontSize: 20 * scale,
              color: TEAL,
              marginTop: 24 * scale,
              fontWeight: 500,
            }}>
              — {data.auteur}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Variant 1: Quote with turquoise gradient bottom bar
function QuoteVariant1({ data, scale, width, height }: { data: QuoteData; scale: number; width: number; height: number }) {
  return (
    <div style={{ position: "relative", width, height, background: BG, overflow: "hidden" }}>
      <WavePattern width={width} height={height} />
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 8 * scale,
        background: `linear-gradient(90deg, transparent, ${TEAL}, transparent)`,
      }} />
      <Header scale={scale} />
      <Footer scale={scale} width={width} height={height} />
      <div style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        padding: `0 ${80 * scale}px`,
        textAlign: "center",
      }}>
        <span style={{
          fontFamily: FONT,
          fontSize: Math.min(100 * scale, height * 0.13),
          fontWeight: 900,
          color: TEAL,
          lineHeight: 0.8,
          display: "block",
          marginBottom: 16 * scale,
          opacity: 0.6,
        }}>
          &ldquo;
        </span>
        <p style={{
          fontFamily: FONT,
          fontSize: Math.min(48 * scale, height * 0.075),
          fontWeight: 700,
          color: WHITE,
          lineHeight: 1.35,
          margin: 0,
        }}>
          {data.tekst}
        </p>
        {data.auteur && (
          <p style={{
            fontFamily: FONT,
            fontSize: 20 * scale,
            color: GRAY,
            marginTop: 20 * scale,
            fontWeight: 400,
          }}>
            {data.auteur}
          </p>
        )}
      </div>
    </div>
  );
}

// Variant 2: Quote with large turquoise quotation mark behind
function QuoteVariant2({ data, scale, width, height }: { data: QuoteData; scale: number; width: number; height: number }) {
  return (
    <div style={{ position: "relative", width, height, background: BG, overflow: "hidden" }}>
      <WavePattern width={width} height={height} />
      <div style={{
        position: "absolute",
        top: height * 0.15,
        left: 40 * scale,
        fontFamily: FONT,
        fontSize: 280 * scale,
        fontWeight: 900,
        color: TEAL,
        opacity: 0.06,
        lineHeight: 1,
        userSelect: "none",
      }}>
        &ldquo;
      </div>
      <Header scale={scale} />
      <Footer scale={scale} width={width} height={height} />
      <div style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        padding: `0 ${80 * scale}px`,
      }}>
        <p style={{
          fontFamily: FONT,
          fontSize: Math.min(50 * scale, height * 0.078),
          fontWeight: 700,
          color: WHITE,
          lineHeight: 1.35,
          margin: 0,
        }}>
          {data.tekst}
        </p>
        {data.auteur && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 * scale, marginTop: 28 * scale }}>
            <div style={{ width: 32 * scale, height: 2 * scale, background: TEAL }} />
            <p style={{
              fontFamily: FONT,
              fontSize: 18 * scale,
              color: TEAL,
              margin: 0,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}>
              {data.auteur}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Variant 3: Split — turquoise left bar + quote right
function QuoteVariant3({ data, scale, width, height }: { data: QuoteData; scale: number; width: number; height: number }) {
  return (
    <div style={{ position: "relative", width, height, background: BG, overflow: "hidden" }}>
      <WavePattern width={width} height={height} />
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: width * 0.08,
        height: "100%",
        background: `linear-gradient(180deg, ${TEAL}22, ${TEAL}66, ${TEAL}22)`,
      }} />
      <Header scale={scale} />
      <Footer scale={scale} width={width} height={height} />
      <div style={{
        position: "absolute",
        top: "50%",
        left: width * 0.08 + 60 * scale,
        right: 60 * scale,
        transform: "translateY(-50%)",
      }}>
        <p style={{
          fontFamily: FONT,
          fontSize: Math.min(48 * scale, height * 0.075),
          fontWeight: 700,
          color: WHITE,
          lineHeight: 1.35,
          margin: 0,
        }}>
          {data.tekst}
        </p>
        {data.auteur && (
          <p style={{
            fontFamily: FONT,
            fontSize: 18 * scale,
            color: TEAL,
            marginTop: 24 * scale,
            fontWeight: 600,
            margin: `${24 * scale}px 0 0`,
          }}>
            — {data.auteur}
          </p>
        )}
      </div>
    </div>
  );
}

export function QuoteTemplate({ data, variant, width, height }: QuoteTemplateProps) {
  const scale = width / 1080;
  const v = variant % 4;
  if (v === 0) return <QuoteVariant0 data={data} scale={scale} width={width} height={height} />;
  if (v === 1) return <QuoteVariant1 data={data} scale={scale} width={width} height={height} />;
  if (v === 2) return <QuoteVariant2 data={data} scale={scale} width={width} height={height} />;
  return <QuoteVariant3 data={data} scale={scale} width={width} height={height} />;
}
