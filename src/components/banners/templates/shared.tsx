// Shared banner components — neon capsule design system
// All styles are inline (no Tailwind) for server-side ImageResponse rendering

const NEON = "#2DD4A8";
const BG_DARK = "#0B1A1F";
const BG_DARKER = "#061217";
const WHITE = "#F3F5F7";
const GRAY = "#8B98A3";
const FONT = "Inter, sans-serif";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IllustrationType = "gear" | "brain" | "chart" | "nodes" | "lightbulb" | "network";

export type CapsuleIconType =
  | "cog"
  | "zap"
  | "bar-chart"
  | "link"
  | "lightbulb"
  | "users"
  | "target"
  | "euro"
  | "brain";

// ─── BackgroundIllustration ────────────────────────────────────────────────────

interface BackgroundIllustrationProps {
  type: IllustrationType;
  width: number;
  height: number;
}

export function BackgroundIllustration({ type, width, height }: BackgroundIllustrationProps) {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.32;

  function renderShape() {
    if (type === "gear") {
      // Large cog: outer circle with 12 teeth + inner circle
      const teeth = 12;
      const outerR = r;
      const innerR = r * 0.72;
      const toothR = r * 1.08;
      const toothW = (Math.PI * 2) / teeth / 3;
      let path = "";
      for (let i = 0; i < teeth; i++) {
        const a0 = (i / teeth) * Math.PI * 2 - Math.PI / 2;
        const a1 = a0 + toothW;
        const a2 = a0 + toothW * 2;
        const a3 = a0 + (1 / teeth) * Math.PI * 2;
        path += `M ${cx + Math.cos(a0) * outerR} ${cy + Math.sin(a0) * outerR} `;
        path += `A ${toothR} ${toothR} 0 0 1 ${cx + Math.cos(a1) * toothR} ${cy + Math.sin(a1) * toothR} `;
        path += `L ${cx + Math.cos(a2) * toothR} ${cy + Math.sin(a2) * toothR} `;
        path += `A ${outerR} ${outerR} 0 0 1 ${cx + Math.cos(a3) * outerR} ${cy + Math.sin(a3) * outerR} Z `;
      }
      return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <path d={path} fill="none" stroke={NEON} strokeWidth="3" opacity="0.08" />
          <circle cx={cx} cy={cy} r={innerR} fill="none" stroke={NEON} strokeWidth="3" opacity="0.08" />
          <circle cx={cx} cy={cy} r={r * 0.28} fill="none" stroke={NEON} strokeWidth="3" opacity="0.08" />
        </svg>
      );
    }

    if (type === "brain") {
      // Abstract brain with lobes + connection nodes
      const lw = r * 1.1;
      const lh = r * 0.9;
      const nodes = [
        [cx - r * 0.6, cy - r * 0.2],
        [cx - r * 0.2, cy - r * 0.6],
        [cx + r * 0.3, cy - r * 0.55],
        [cx + r * 0.65, cy - r * 0.1],
        [cx + r * 0.5, cy + r * 0.4],
        [cx - r * 0.1, cy + r * 0.55],
        [cx - r * 0.6, cy + r * 0.3],
      ];
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0],
        [1, 3], [2, 5], [0, 4],
      ];
      return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <ellipse cx={cx - r * 0.18} cy={cy} rx={lw * 0.48} ry={lh} fill="none" stroke={NEON} strokeWidth="2.5" opacity="0.07" />
          <ellipse cx={cx + r * 0.18} cy={cy} rx={lw * 0.48} ry={lh} fill="none" stroke={NEON} strokeWidth="2.5" opacity="0.07" />
          {connections.map(([a, b], i) => (
            <line
              key={i}
              x1={nodes[a][0]} y1={nodes[a][1]}
              x2={nodes[b][0]} y2={nodes[b][1]}
              stroke={NEON} strokeWidth="1.5" opacity="0.07"
            />
          ))}
          {nodes.map(([nx, ny], i) => (
            <circle key={i} cx={nx} cy={ny} r={r * 0.045} fill={NEON} opacity="0.1" />
          ))}
        </svg>
      );
    }

    if (type === "chart") {
      // Rising line chart with data points and grid lines
      const points: [number, number][] = [
        [cx - r * 1.1, cy + r * 0.5],
        [cx - r * 0.7, cy + r * 0.2],
        [cx - r * 0.3, cy + r * 0.35],
        [cx + r * 0.1, cy - r * 0.1],
        [cx + r * 0.5, cy - r * 0.4],
        [cx + r * 0.9, cy - r * 0.65],
        [cx + r * 1.1, cy - r * 0.8],
      ];
      const pathD = points.map(([px, py], i) => `${i === 0 ? "M" : "L"} ${px} ${py}`).join(" ");
      return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* grid lines */}
          {[-0.6, -0.2, 0.2, 0.6].map((offset, i) => (
            <line key={i} x1={cx - r * 1.2} y1={cy + r * offset} x2={cx + r * 1.2} y2={cy + r * offset} stroke={NEON} strokeWidth="1" opacity="0.04" />
          ))}
          {/* chart line */}
          <path d={pathD} fill="none" stroke={NEON} strokeWidth="3" opacity="0.1" strokeLinejoin="round" />
          {/* area fill */}
          <path d={`${pathD} L ${points[points.length - 1][0]} ${cy + r * 0.7} L ${points[0][0]} ${cy + r * 0.7} Z`} fill={NEON} opacity="0.03" />
          {/* data points */}
          {points.map(([px, py], i) => (
            <circle key={i} cx={px} cy={py} r={r * 0.04} fill={NEON} opacity="0.12" />
          ))}
        </svg>
      );
    }

    if (type === "nodes") {
      // Connected nodes network
      const nodePos: [number, number][] = [
        [cx, cy],
        [cx - r * 0.8, cy - r * 0.5],
        [cx + r * 0.8, cy - r * 0.5],
        [cx + r * 0.9, cy + r * 0.3],
        [cx - r * 0.9, cy + r * 0.3],
        [cx, cy - r * 0.85],
        [cx, cy + r * 0.75],
      ];
      const edges = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,5],[2,5],[3,6],[4,6],[1,4],[2,3]];
      return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {edges.map(([a, b], i) => (
            <line key={i} x1={nodePos[a][0]} y1={nodePos[a][1]} x2={nodePos[b][0]} y2={nodePos[b][1]} stroke={NEON} strokeWidth="2" opacity="0.07" />
          ))}
          {nodePos.map(([nx, ny], i) => (
            <circle key={i} cx={nx} cy={ny} r={i === 0 ? r * 0.09 : r * 0.055} fill="none" stroke={NEON} strokeWidth={i === 0 ? "3" : "2"} opacity="0.1" />
          ))}
        </svg>
      );
    }

    if (type === "lightbulb") {
      const bulbR = r * 0.55;
      const stemW = r * 0.2;
      const stemH = r * 0.25;
      const stemY = cy + bulbR * 0.6;
      return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* bulb circle */}
          <circle cx={cx} cy={cy - r * 0.05} r={bulbR} fill="none" stroke={NEON} strokeWidth="3" opacity="0.08" />
          {/* stem base */}
          <rect x={cx - stemW / 2} y={stemY} width={stemW} height={stemH} rx={stemW * 0.2} fill="none" stroke={NEON} strokeWidth="2.5" opacity="0.08" />
          {/* filament lines inside */}
          <line x1={cx} y1={cy - bulbR * 0.4} x2={cx - r * 0.12} y2={cy + bulbR * 0.1} stroke={NEON} strokeWidth="2" opacity="0.08" />
          <line x1={cx} y1={cy - bulbR * 0.4} x2={cx + r * 0.12} y2={cy + bulbR * 0.1} stroke={NEON} strokeWidth="2" opacity="0.08" />
          {/* glow rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = cx + Math.cos(rad) * (bulbR + r * 0.05);
            const y1 = (cy - r * 0.05) + Math.sin(rad) * (bulbR + r * 0.05);
            const x2 = cx + Math.cos(rad) * (bulbR + r * 0.18);
            const y2 = (cy - r * 0.05) + Math.sin(rad) * (bulbR + r * 0.18);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={NEON} strokeWidth="2" opacity="0.06" />;
          })}
        </svg>
      );
    }

    // network — grid of connected dots
    const cols = 6;
    const rows = 5;
    const gapX = (r * 2.2) / (cols - 1);
    const gapY = (r * 1.8) / (rows - 1);
    const startX = cx - r * 1.1;
    const startY = cy - r * 0.9;
    const gridNodes: [number, number][] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        gridNodes.push([startX + col * gapX, startY + row * gapY]);
      }
    }
    const gridEdges: [number, number][] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        if (col < cols - 1) gridEdges.push([idx, idx + 1]);
        if (row < rows - 1) gridEdges.push([idx, idx + cols]);
      }
    }
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {gridEdges.map(([a, b], i) => (
          <line key={i} x1={gridNodes[a][0]} y1={gridNodes[a][1]} x2={gridNodes[b][0]} y2={gridNodes[b][1]} stroke={NEON} strokeWidth="1.5" opacity="0.06" />
        ))}
        {gridNodes.map(([nx, ny], i) => (
          <circle key={i} cx={nx} cy={ny} r={r * 0.032} fill={NEON} opacity="0.09" />
        ))}
      </svg>
    );
  }

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width, height, overflow: "hidden" }}>
      {renderShape()}
    </div>
  );
}

// ─── FlowLines ─────────────────────────────────────────────────────────────────

interface FlowLinesProps {
  width: number;
  height: number;
}

export function FlowLines({ width, height }: FlowLinesProps) {
  const w = width;
  const h = height;
  return (
    <svg
      style={{ position: "absolute", top: 0, left: 0 }}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      {/* Line at ~30% height */}
      <path
        d={`M0,${h * 0.3} C${w * 0.15},${h * 0.22} ${w * 0.35},${h * 0.38} ${w * 0.55},${h * 0.28} S${w * 0.8},${h * 0.32} ${w},${h * 0.26}`}
        fill="none"
        stroke={NEON}
        strokeWidth="2"
        opacity="0.07"
      />
      {/* Line at ~50% height */}
      <path
        d={`M0,${h * 0.5} C${w * 0.2},${h * 0.42} ${w * 0.4},${h * 0.58} ${w * 0.6},${h * 0.46} S${w * 0.85},${h * 0.54} ${w},${h * 0.48}`}
        fill="none"
        stroke={NEON}
        strokeWidth="1.5"
        opacity="0.055"
      />
      {/* Line at ~70% height */}
      <path
        d={`M0,${h * 0.7} C${w * 0.25},${h * 0.62} ${w * 0.45},${h * 0.76} ${w * 0.65},${h * 0.66} S${w * 0.88},${h * 0.72} ${w},${h * 0.68}`}
        fill="none"
        stroke={NEON}
        strokeWidth="1"
        opacity="0.05"
      />
    </svg>
  );
}

// ─── BannerBackground ─────────────────────────────────────────────────────────

interface BannerBackgroundProps {
  width: number;
  height: number;
  illustration: IllustrationType;
  children: React.ReactNode;
}

export function BannerBackground({ width, height, illustration, children }: BannerBackgroundProps) {
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        background: `linear-gradient(145deg, ${BG_DARK} 0%, ${BG_DARKER} 100%)`,
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      {/* Radial glow behind center */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: Math.round(width * 0.7),
          height: Math.round(height * 0.5),
          background: `radial-gradient(ellipse at center, rgba(45,212,168,0.07) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* SVG background illustration */}
      <BackgroundIllustration type={illustration} width={width} height={height} />
      {/* Flowing lines */}
      <FlowLines width={width} height={height} />
      {children}
    </div>
  );
}

// ─── BannerHeader ─────────────────────────────────────────────────────────────

interface BannerHeaderProps {
  width: number;
}

export function BannerHeader({ width }: BannerHeaderProps) {
  const scale = width / 1080;
  const iconSize = Math.round(26 * scale);
  const gap = Math.round(10 * scale);
  return (
    <div
      style={{
        position: "absolute",
        top: Math.round(40 * scale),
        left: Math.round(48 * scale),
        display: "flex",
        alignItems: "center",
        gap,
      }}
    >
      {/* Geometric icon: two overlapping squares rotated */}
      <svg width={iconSize} height={iconSize} viewBox="0 0 26 26" fill="none">
        <rect x="2" y="6" width="14" height="14" rx="2" stroke={NEON} strokeWidth="2" transform="rotate(-8 9 13)" />
        <rect x="10" y="6" width="14" height="14" rx="2" fill={`${NEON}22`} stroke={NEON} strokeWidth="2" transform="rotate(8 17 13)" />
      </svg>
      <span
        style={{
          fontFamily: FONT,
          fontSize: Math.round(18 * scale),
          fontWeight: 700,
          color: WHITE,
          letterSpacing: "0.04em",
        }}
      >
        Autronis
      </span>
    </div>
  );
}

// ─── BannerFooter ─────────────────────────────────────────────────────────────

interface BannerFooterProps {
  width: number;
  height: number;
}

export function BannerFooter({ width, height }: BannerFooterProps) {
  const scale = width / 1080;
  return (
    <div
      style={{
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
      }}
    >
      autronis.nl · Brengt structuur in je groei. · zakelijk@autronis.com
    </div>
  );
}

// ─── CapsuleIcon (inline SVG per icon name) ───────────────────────────────────

function CapsuleIcon({ icon, size }: { icon: CapsuleIconType; size: number }) {
  const s = size;
  const stroke = NEON;
  const sw = "2";

  if (icon === "cog") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke={stroke} strokeWidth={sw} />
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "zap") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "bar-chart") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="12" width="4" height="9" rx="1" stroke={stroke} strokeWidth={sw} />
        <rect x="10" y="7" width="4" height="14" rx="1" stroke={stroke} strokeWidth={sw} />
        <rect x="17" y="3" width="4" height="18" rx="1" stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }
  if (icon === "link") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "lightbulb") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.22-1.2 4.16-3 5.2V17H9v-2.8A6 6 0 0 1 6 9a6 6 0 0 1 6-6z" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === "users") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" stroke={stroke} strokeWidth={sw} />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "target") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={stroke} strokeWidth={sw} />
        <circle cx="12" cy="12" r="6" stroke={stroke} strokeWidth={sw} />
        <circle cx="12" cy="12" r="2" stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }
  if (icon === "euro") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M17 7.5A7 7 0 1 0 17 16.5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <line x1="4" y1="10" x2="14" y2="10" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <line x1="4" y1="14" x2="14" y2="14" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
  }
  // brain
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C9 2 7 4 7 6c-2 0-4 2-4 4 0 1.5.8 2.8 2 3.5C5 15 6 17 8 18v2h8v-2c2-1 3-3 3-4.5 1.2-.7 2-2 2-3.5 0-2-2-4-4-4 0-2-2-4-5-4z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      <line x1="12" y1="6" x2="12" y2="18" stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

// ─── NeonCapsule ──────────────────────────────────────────────────────────────

interface NeonCapsuleProps {
  icon: CapsuleIconType;
  text: string;
  width: number;
}

export function NeonCapsule({ icon, text, width }: NeonCapsuleProps) {
  const scale = width / 1080;
  const iconSize = Math.round(32 * scale);
  const paddingV = Math.round(18 * scale);
  const paddingH = Math.round(36 * scale);
  const gap = Math.round(16 * scale);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap,
        padding: `${paddingV}px ${paddingH}px`,
        borderRadius: "999px",
        border: `${Math.round(2 * scale)}px solid ${NEON}`,
        background: "rgba(45,212,168,0.08)",
        boxShadow: `0 0 ${Math.round(20 * scale)}px rgba(45,212,168,0.4), 0 0 ${Math.round(60 * scale)}px rgba(45,212,168,0.15)`,
      }}
    >
      <CapsuleIcon icon={icon} size={iconSize} />
      <span
        style={{
          fontFamily: FONT,
          fontSize: Math.round(28 * scale),
          fontWeight: 800,
          color: NEON,
          textShadow: `0 0 ${Math.round(10 * scale)}px rgba(45,212,168,0.5)`,
          letterSpacing: "0.01em",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
    </div>
  );
}
