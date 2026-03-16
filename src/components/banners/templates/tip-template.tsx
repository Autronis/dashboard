import type { TipData } from "@/types/content";

interface TipTemplateProps {
  data: TipData;
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

// Variant 0: Numbered list with turquoise numbers
function TipVariant0({ data, scale, width, height }: { data: TipData; scale: number; width: number; height: number }) {
  const itemSpacing = Math.min(height * 0.12, 130 * scale);
  return (
    <div style={{ position: "relative", width, height, background: BG, overflow: "hidden" }}>
      <WavePattern width={width} height={height} />
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
        <h2 style={{
          fontFamily: FONT,
          fontSize: Math.min(42 * scale, height * 0.06),
          fontWeight: 800,
          color: WHITE,
          margin: `0 0 ${36 * scale}px`,
          lineHeight: 1.2,
        }}>
          {data.titel}
        </h2>
        {data.punten.map((punt, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 20 * scale, marginBottom: idx < 2 ? itemSpacing * 0.5 : 0 }}>
            <span style={{
              fontFamily: FONT,
              fontSize: 32 * scale,
              fontWeight: 900,
              color: TEAL,
              lineHeight: 1,
              minWidth: 36 * scale,
              paddingTop: 4 * scale,
            }}>
              {idx + 1}.
            </span>
            <p style={{
              fontFamily: FONT,
              fontSize: Math.min(26 * scale, height * 0.038),
              color: idx === 0 ? WHITE : GRAY,
              margin: 0,
              lineHeight: 1.4,
              fontWeight: idx === 0 ? 600 : 400,
            }}>
              {punt}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Variant 1: Checkmark icons with items
function TipVariant1({ data, scale, width, height }: { data: TipData; scale: number; width: number; height: number }) {
  const itemSpacing = Math.min(height * 0.11, 120 * scale);
  return (
    <div style={{ position: "relative", width, height, background: BG, overflow: "hidden" }}>
      <WavePattern width={width} height={height} />
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
        <h2 style={{
          fontFamily: FONT,
          fontSize: Math.min(40 * scale, height * 0.058),
          fontWeight: 800,
          color: TEAL,
          margin: `0 0 ${36 * scale}px`,
          lineHeight: 1.2,
        }}>
          {data.titel}
        </h2>
        {data.punten.map((punt, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 18 * scale, marginBottom: idx < 2 ? itemSpacing * 0.5 : 0 }}>
            <div style={{
              width: 28 * scale,
              height: 28 * scale,
              borderRadius: "50%",
              background: `${TEAL}22`,
              border: `2px solid ${TEAL}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 2 * scale,
            }}>
              <svg width={14 * scale} height={14 * scale} viewBox="0 0 14 14" fill="none">
                <path d="M2 7l3.5 3.5L12 4" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p style={{
              fontFamily: FONT,
              fontSize: Math.min(24 * scale, height * 0.036),
              color: WHITE,
              margin: 0,
              lineHeight: 1.45,
              fontWeight: 400,
            }}>
              {punt}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Variant 2: Left turquoise bar + stacked items
function TipVariant2({ data, scale, width, height }: { data: TipData; scale: number; width: number; height: number }) {
  const itemH = (height - 200 * scale) / 3;
  return (
    <div style={{ position: "relative", width, height, background: BG, overflow: "hidden" }}>
      <WavePattern width={width} height={height} />
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
        <h2 style={{
          fontFamily: FONT,
          fontSize: Math.min(38 * scale, height * 0.055),
          fontWeight: 800,
          color: WHITE,
          margin: `0 0 ${32 * scale}px`,
          lineHeight: 1.2,
        }}>
          {data.titel}
        </h2>
        {data.punten.map((punt, idx) => (
          <div key={idx} style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            marginBottom: idx < 2 ? Math.min(16 * scale, itemH * 0.15) : 0,
          }}>
            <div style={{
              width: 4 * scale,
              background: idx === 0 ? TEAL : `${TEAL}${idx === 1 ? "88" : "44"}`,
              borderRadius: 2 * scale,
              flexShrink: 0,
              marginRight: 20 * scale,
            }} />
            <p style={{
              fontFamily: FONT,
              fontSize: Math.min(24 * scale, height * 0.035),
              color: idx === 0 ? WHITE : GRAY,
              margin: 0,
              lineHeight: 1.45,
              padding: `${8 * scale}px 0`,
              fontWeight: idx === 0 ? 600 : 400,
            }}>
              {punt}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TipTemplate({ data, variant, width, height }: TipTemplateProps) {
  const scale = width / 1080;
  const v = variant % 3;
  if (v === 0) return <TipVariant0 data={data} scale={scale} width={width} height={height} />;
  if (v === 1) return <TipVariant1 data={data} scale={scale} width={width} height={height} />;
  return <TipVariant2 data={data} scale={scale} width={width} height={height} />;
}
