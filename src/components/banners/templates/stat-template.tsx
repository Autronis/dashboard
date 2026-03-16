import type { StatData } from "@/types/content";

interface StatTemplateProps {
  data: StatData;
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
    </svg>
  );
}

// Variant 0: Big numbers centered with arrow between
function StatVariant0({ data, scale, width, height }: { data: StatData; scale: number; width: number; height: number }) {
  const numSize = Math.min(96 * scale, height * 0.14);
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
        textAlign: "center",
        padding: `0 ${60 * scale}px`,
      }}>
        <p style={{ fontFamily: FONT, fontSize: 22 * scale, color: GRAY, marginBottom: 28 * scale, margin: `0 0 ${28 * scale}px`, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {data.label}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32 * scale }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: FONT, fontSize: numSize, fontWeight: 900, color: GRAY, lineHeight: 1 }}>
              {data.van}
            </div>
            {data.eenheid && (
              <div style={{ fontFamily: FONT, fontSize: 20 * scale, color: GRAY, marginTop: 8 * scale }}>
                {data.eenheid}
              </div>
            )}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 60 * scale, fontWeight: 700, color: TEAL }}>
            →
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: FONT, fontSize: numSize * 1.3, fontWeight: 900, color: TEAL, lineHeight: 1 }}>
              {data.naar}
            </div>
            {data.eenheid && (
              <div style={{ fontFamily: FONT, fontSize: 20 * scale, color: TEAL, marginTop: 8 * scale }}>
                {data.eenheid}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Variant 1: Before/after side by side with labels
function StatVariant1({ data, scale, width, height }: { data: StatData; scale: number; width: number; height: number }) {
  const numSize = Math.min(80 * scale, height * 0.12);
  return (
    <div style={{ position: "relative", width, height, background: BG, overflow: "hidden" }}>
      <WavePattern width={width} height={height} />
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "50%",
        height: "100%",
        background: "rgba(255,255,255,0.015)",
      }} />
      <Header scale={scale} />
      <Footer scale={scale} width={width} height={height} />
      <div style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        display: "flex",
      }}>
        <div style={{ flex: 1, textAlign: "center", padding: `0 ${40 * scale}px` }}>
          <div style={{ fontFamily: FONT, fontSize: 14 * scale, color: GRAY, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 * scale }}>
            Voor
          </div>
          <div style={{ fontFamily: FONT, fontSize: numSize, fontWeight: 900, color: GRAY, lineHeight: 1, textDecoration: "line-through" }}>
            {data.van}
          </div>
          {data.eenheid && (
            <div style={{ fontFamily: FONT, fontSize: 18 * scale, color: GRAY, marginTop: 10 * scale }}>{data.eenheid}</div>
          )}
        </div>
        <div style={{ width: 2 * scale, background: TEAL, opacity: 0.3, alignSelf: "stretch", margin: `${40 * scale}px 0` }} />
        <div style={{ flex: 1, textAlign: "center", padding: `0 ${40 * scale}px` }}>
          <div style={{ fontFamily: FONT, fontSize: 14 * scale, color: TEAL, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 * scale }}>
            Na
          </div>
          <div style={{ fontFamily: FONT, fontSize: numSize * 1.25, fontWeight: 900, color: TEAL, lineHeight: 1 }}>
            {data.naar}
          </div>
          {data.eenheid && (
            <div style={{ fontFamily: FONT, fontSize: 18 * scale, color: TEAL, marginTop: 10 * scale }}>{data.eenheid}</div>
          )}
        </div>
      </div>
      <div style={{
        position: "absolute",
        top: height * 0.3 - 16 * scale,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT,
        fontSize: 20 * scale,
        color: GRAY,
        letterSpacing: "0.06em",
      }}>
        {data.label}
      </div>
    </div>
  );
}

// Variant 2: Single big number with label
function StatVariant2({ data, scale, width, height }: { data: StatData; scale: number; width: number; height: number }) {
  const numSize = Math.min(160 * scale, height * 0.22);
  return (
    <div style={{ position: "relative", width, height, background: BG, overflow: "hidden" }}>
      <WavePattern width={width} height={height} />
      <div style={{
        position: "absolute",
        top: "45%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        fontFamily: FONT,
        fontSize: numSize * 2.5,
        fontWeight: 900,
        color: TEAL,
        opacity: 0.04,
        whiteSpace: "nowrap",
        userSelect: "none",
      }}>
        {data.naar}
      </div>
      <Header scale={scale} />
      <Footer scale={scale} width={width} height={height} />
      <div style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        textAlign: "center",
        padding: `0 ${60 * scale}px`,
      }}>
        <p style={{ fontFamily: FONT, fontSize: 20 * scale, color: GRAY, margin: `0 0 ${20 * scale}px`, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {data.label}
        </p>
        <div style={{ fontFamily: FONT, fontSize: numSize, fontWeight: 900, color: TEAL, lineHeight: 1 }}>
          {data.naar}
        </div>
        {data.eenheid && (
          <div style={{ fontFamily: FONT, fontSize: 28 * scale, color: WHITE, marginTop: 12 * scale, fontWeight: 500 }}>
            {data.eenheid}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 * scale, marginTop: 24 * scale }}>
          <span style={{ fontFamily: FONT, fontSize: 18 * scale, color: GRAY }}>was</span>
          <span style={{ fontFamily: FONT, fontSize: 24 * scale, color: GRAY, fontWeight: 700, textDecoration: "line-through" }}>
            {data.van}{data.eenheid ? ` ${data.eenheid}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

export function StatTemplate({ data, variant, width, height }: StatTemplateProps) {
  const scale = width / 1080;
  const v = variant % 3;
  if (v === 0) return <StatVariant0 data={data} scale={scale} width={width} height={height} />;
  if (v === 1) return <StatVariant1 data={data} scale={scale} width={width} height={height} />;
  return <StatVariant2 data={data} scale={scale} width={width} height={height} />;
}
