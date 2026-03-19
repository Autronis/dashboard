import type { BannerIllustration } from "@/types/content";

interface BgIllustrationProps {
  type: BannerIllustration;
  width: number;
  height: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

// Autronis teal + background color for double-line effect
const C = "#17B8A5";
const BG = "#0A1214";

/**
 * Large, clean SVG background illustrations with double-line effect.
 * Renders icon twice: outer thick teal stroke, inner cutout in bg color = double lines.
 */
export function BgIllustration({ type, width, height, scale = 1, offsetX = 0, offsetY = 0 }: BgIllustrationProps) {
  const cx = width / 2 + offsetX;
  // For tall formats, shift up to align with capsule (which sits at width/height * 50%)
  const cy = (height > width ? height * (width / height) * 0.5 : height * 0.5) + offsetY;
  const s = Math.min(width, height) * 0.45 * (scale ?? 1);
  const op = 0.18;

  return (
    <svg
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Pass 1: outer thin teal stroke */}
      <g opacity={op} stroke={C} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {renderIcon(type, cx, cy, s)}
      </g>
      {/* Pass 2: cutout gap in background color */}
      <g opacity={op} stroke={BG} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {renderIcon(type, cx, cy, s)}
      </g>
    </svg>
  );
}

function renderIcon(type: BannerIllustration, cx: number, cy: number, s: number) {
  switch (type) {

    // ─── Gear: clean settings-style cog (like iOS/Android settings icon) ───
    case "gear":
      return (
        <>
          {/* Inner circle (hole) */}
          <circle cx={cx} cy={cy} r={s * 0.16} />
          {/* Smooth cog outline with 8 rounded teeth */}
          <path d={Array.from({ length: 8 }, (_, i) => {
            const toothAngle = (Math.PI * 2) / 8;
            const a = i * toothAngle - Math.PI / 2;
            const innerR = s * 0.32;
            const outerR = s * 0.44;
            const halfTooth = toothAngle * 0.22;
            const halfGap = toothAngle * 0.28;
            // Tooth: go out, arc across top, come back in, arc along inner
            const points = [
              // Start of tooth (inner)
              `${i === 0 ? "M" : "L"}${cx + Math.cos(a - halfGap) * innerR},${cy + Math.sin(a - halfGap) * innerR}`,
              // Go to outer
              `L${cx + Math.cos(a - halfTooth) * outerR},${cy + Math.sin(a - halfTooth) * outerR}`,
              // Arc across tooth top
              `A${outerR},${outerR} 0 0 1 ${cx + Math.cos(a + halfTooth) * outerR},${cy + Math.sin(a + halfTooth) * outerR}`,
              // Back to inner
              `L${cx + Math.cos(a + halfGap) * innerR},${cy + Math.sin(a + halfGap) * innerR}`,
              // Arc along inner to next tooth
              `A${innerR},${innerR} 0 0 1 ${cx + Math.cos(a + toothAngle - halfGap) * innerR},${cy + Math.sin(a + toothAngle - halfGap) * innerR}`,
            ];
            return points.join(" ");
          }).join(" ") + " Z"} />
        </>
      );

    // ─── Nodes: connected network of 5 nodes ───
    case "nodes":
      return (
        <>
          {/* Central node */}
          <circle cx={cx} cy={cy} r={s * 0.1} />
          <circle cx={cx} cy={cy} r={s * 0.035} fill={C} stroke="none" />
          {/* 4 outer nodes with lines */}
          {[
            { x: -0.38, y: -0.3 },
            { x: 0.38, y: -0.25 },
            { x: -0.35, y: 0.32 },
            { x: 0.4, y: 0.3 },
          ].map((pos, i) => (
            <g key={i}>
              <line x1={cx} y1={cy} x2={cx + pos.x * s} y2={cy + pos.y * s} strokeDasharray="6 4" />
              <circle cx={cx + pos.x * s} cy={cy + pos.y * s} r={s * 0.07} />
              <circle cx={cx + pos.x * s} cy={cy + pos.y * s} r={s * 0.025} fill={C} stroke="none" />
            </g>
          ))}
          {/* Cross connections */}
          <line x1={cx - s * 0.38} y1={cy - s * 0.3} x2={cx + s * 0.38} y2={cy - s * 0.25} strokeDasharray="4 6" strokeWidth={1} />
          <line x1={cx - s * 0.35} y1={cy + s * 0.32} x2={cx + s * 0.4} y2={cy + s * 0.3} strokeDasharray="4 6" strokeWidth={1} />
        </>
      );

    // ─── Chart: bar chart + trend line + axis ───
    case "chart":
      return (
        <>
          {/* Y axis */}
          <line x1={cx - s * 0.42} y1={cy - s * 0.42} x2={cx - s * 0.42} y2={cy + s * 0.4} />
          {/* X axis */}
          <line x1={cx - s * 0.42} y1={cy + s * 0.4} x2={cx + s * 0.45} y2={cy + s * 0.4} />
          {/* 5 bars */}
          {[0.25, 0.5, 0.38, 0.72, 0.6].map((h, i) => {
            const bw = s * 0.1;
            const gap = s * 0.16;
            const bx = cx - s * 0.32 + i * gap;
            const bh = s * h * 0.9;
            return <rect key={i} x={bx} y={cy + s * 0.4 - bh} width={bw} height={bh} rx={s * 0.015} />;
          })}
          {/* Trend line with dots */}
          <polyline points={`${cx - s * 0.27},${cy + s * 0.18} ${cx - s * 0.11},${cy - s * 0.02} ${cx + s * 0.05},${cy + s * 0.06} ${cx + s * 0.21},${cy - s * 0.2} ${cx + s * 0.37},${cy - s * 0.12}`} strokeWidth={1.5} />
          {[
            { x: -0.27, y: 0.18 }, { x: -0.11, y: -0.02 }, { x: 0.05, y: 0.06 },
            { x: 0.21, y: -0.2 }, { x: 0.37, y: -0.12 },
          ].map((p, i) => (
            <circle key={i} cx={cx + p.x * s} cy={cy + p.y * s} r={s * 0.02} fill={C} stroke="none" />
          ))}
          {/* Horizontal grid lines */}
          {[0.05, -0.15, -0.35].map((y, i) => (
            <line key={i} x1={cx - s * 0.4} y1={cy + y * s} x2={cx + s * 0.44} y2={cy + y * s} strokeWidth={0.5} strokeDasharray="4 6" />
          ))}
        </>
      );

    // ─── Flow: vertical flowchart with 4 steps ───
    case "flow":
      return (
        <>
          {/* 4 nodes vertically */}
          {[-0.4, -0.13, 0.13, 0.4].map((y, i) => (
            <g key={i}>
              <circle cx={cx} cy={cy + y * s} r={s * 0.09} />
              <circle cx={cx} cy={cy + y * s} r={s * 0.03} fill={C} stroke="none" />
            </g>
          ))}
          {/* Connecting lines with arrows */}
          {[-0.27, 0, 0.27].map((y, i) => (
            <g key={i}>
              <line x1={cx} y1={cy + (y - 0.04) * s} x2={cx} y2={cy + (y + 0.04) * s} />
              <line x1={cx - s * 0.03} y1={cy + (y + 0.02) * s} x2={cx} y2={cy + (y + 0.04) * s} />
              <line x1={cx + s * 0.03} y1={cy + (y + 0.02) * s} x2={cx} y2={cy + (y + 0.04) * s} />
            </g>
          ))}
          {/* Side labels (horizontal lines) */}
          {[-0.4, -0.13, 0.13, 0.4].map((y, i) => (
            <line key={`l${i}`} x1={cx + s * 0.12} y1={cy + y * s} x2={cx + s * 0.3} y2={cy + y * s} strokeWidth={1} strokeDasharray="3 4" />
          ))}
        </>
      );

    // ─── Shield: shield with lock + circuit pattern ───
    case "shield":
      return (
        <>
          {/* Shield shape */}
          <path d={`M${cx},${cy - s * 0.52} L${cx + s * 0.42},${cy - s * 0.32} L${cx + s * 0.42},${cy + s * 0.08} Q${cx + s * 0.42},${cy + s * 0.48} ${cx},${cy + s * 0.55} Q${cx - s * 0.42},${cy + s * 0.48} ${cx - s * 0.42},${cy + s * 0.08} L${cx - s * 0.42},${cy - s * 0.32} Z`} />
          {/* Inner shield outline */}
          <path d={`M${cx},${cy - s * 0.38} L${cx + s * 0.3},${cy - s * 0.22} L${cx + s * 0.3},${cy + s * 0.06} Q${cx + s * 0.3},${cy + s * 0.34} ${cx},${cy + s * 0.4} Q${cx - s * 0.3},${cy + s * 0.34} ${cx - s * 0.3},${cy + s * 0.06} L${cx - s * 0.3},${cy - s * 0.22} Z`} strokeWidth={1} />
          {/* Keyhole */}
          <circle cx={cx} cy={cy - s * 0.06} r={s * 0.1} />
          <path d={`M${cx - s * 0.05},${cy + s * 0.03} L${cx},${cy + s * 0.22} L${cx + s * 0.05},${cy + s * 0.03}`} />
        </>
      );

    // ─── Brain: neural network with nodes + connections ───
    case "brain":
      return (
        <>
          {/* Central brain circle */}
          <circle cx={cx} cy={cy} r={s * 0.2} />
          <circle cx={cx} cy={cy} r={s * 0.07} fill={C} stroke="none" />
          {/* Inner pattern */}
          <path d={`M${cx - s * 0.12},${cy - s * 0.08} Q${cx},${cy - s * 0.18} ${cx + s * 0.12},${cy - s * 0.08}`} strokeWidth={1} />
          <path d={`M${cx - s * 0.12},${cy + s * 0.08} Q${cx},${cy + s * 0.18} ${cx + s * 0.12},${cy + s * 0.08}`} strokeWidth={1} />
          {/* 8 radiating connections with end nodes */}
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const x1 = cx + Math.cos(a) * s * 0.2;
            const y1 = cy + Math.sin(a) * s * 0.2;
            const x2 = cx + Math.cos(a) * s * 0.48;
            const y2 = cy + Math.sin(a) * s * 0.48;
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} />
                <circle cx={x2} cy={y2} r={s * 0.055} />
                <circle cx={x2} cy={y2} r={s * 0.02} fill={C} stroke="none" />
              </g>
            );
          })}
          {/* Cross connections between outer nodes */}
          {[0, 2, 4, 6].map((i) => {
            const a1 = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const a2 = ((i + 1) / 8) * Math.PI * 2 - Math.PI / 2;
            return (
              <line key={i} x1={cx + Math.cos(a1) * s * 0.48} y1={cy + Math.sin(a1) * s * 0.48} x2={cx + Math.cos(a2) * s * 0.48} y2={cy + Math.sin(a2) * s * 0.48} strokeWidth={1} strokeDasharray="3 5" />
            );
          })}
        </>
      );

    // ─── Lightbulb: detailed bulb with rays ───
    case "lightbulb":
      return (
        <>
          {/* Bulb */}
          <circle cx={cx} cy={cy - s * 0.14} r={s * 0.3} />
          {/* Connection to base */}
          <path d={`M${cx - s * 0.18},${cy + s * 0.12} Q${cx - s * 0.18},${cy + s * 0.2} ${cx - s * 0.14},${cy + s * 0.2}`} />
          <path d={`M${cx + s * 0.18},${cy + s * 0.12} Q${cx + s * 0.18},${cy + s * 0.2} ${cx + s * 0.14},${cy + s * 0.2}`} />
          {/* Screw base */}
          <line x1={cx - s * 0.14} y1={cy + s * 0.22} x2={cx + s * 0.14} y2={cy + s * 0.22} />
          <line x1={cx - s * 0.12} y1={cy + s * 0.27} x2={cx + s * 0.12} y2={cy + s * 0.27} />
          <line x1={cx - s * 0.1} y1={cy + s * 0.32} x2={cx + s * 0.1} y2={cy + s * 0.32} />
          {/* Tip */}
          <path d={`M${cx - s * 0.06},${cy + s * 0.32} Q${cx},${cy + s * 0.38} ${cx + s * 0.06},${cy + s * 0.32}`} />
          {/* Filament */}
          <path d={`M${cx - s * 0.08},${cy + s * 0.02} L${cx - s * 0.04},${cy - s * 0.12} L${cx + s * 0.04},${cy - s * 0.04} L${cx + s * 0.08},${cy - s * 0.18}`} strokeWidth={1.5} />
          {/* Rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const a = (deg * Math.PI) / 180;
            const inner = s * 0.38;
            const outer = s * 0.46;
            return <line key={deg} x1={cx + Math.cos(a) * inner} y1={cy - s * 0.14 + Math.sin(a) * inner} x2={cx + Math.cos(a) * outer} y2={cy - s * 0.14 + Math.sin(a) * outer} strokeWidth={1} />;
          })}
        </>
      );

    // ─── Target: magnifying glass with crosshair ───
    case "target":
      return (
        <>
          {/* Glass circle */}
          <circle cx={cx - s * 0.08} cy={cy - s * 0.08} r={s * 0.34} />
          {/* Inner circle */}
          <circle cx={cx - s * 0.08} cy={cy - s * 0.08} r={s * 0.2} strokeDasharray="4 4" strokeWidth={1} />
          {/* Crosshair */}
          <line x1={cx - s * 0.08} y1={cy - s * 0.08 - s * 0.15} x2={cx - s * 0.08} y2={cy - s * 0.08 + s * 0.15} strokeWidth={1} />
          <line x1={cx - s * 0.08 - s * 0.15} y1={cy - s * 0.08} x2={cx - s * 0.08 + s * 0.15} y2={cy - s * 0.08} strokeWidth={1} />
          {/* Center dot */}
          <circle cx={cx - s * 0.08} cy={cy - s * 0.08} r={s * 0.03} fill={C} stroke="none" />
          {/* Handle */}
          <line x1={cx + s * 0.16} y1={cy + s * 0.16} x2={cx + s * 0.48} y2={cy + s * 0.48} strokeWidth={3} />
          <line x1={cx + s * 0.42} y1={cy + s * 0.48} x2={cx + s * 0.48} y2={cy + s * 0.42} strokeWidth={2} />
        </>
      );

    // ─── Puzzle: crossed wrench & screwdriver ───
    case "puzzle":
      return (
        <>
          {/* Wrench */}
          <line x1={cx - s * 0.4} y1={cy + s * 0.4} x2={cx + s * 0.15} y2={cy - s * 0.15} strokeWidth={2.5} />
          <circle cx={cx - s * 0.4} cy={cy + s * 0.4} r={s * 0.12} />
          <circle cx={cx - s * 0.4} cy={cy + s * 0.4} r={s * 0.05} />
          {/* Screwdriver */}
          <line x1={cx + s * 0.4} y1={cy + s * 0.4} x2={cx - s * 0.15} y2={cy - s * 0.15} strokeWidth={2.5} />
          {/* Screwdriver tip */}
          <path d={`M${cx - s * 0.18},${cy - s * 0.18} L${cx - s * 0.25},${cy - s * 0.35} L${cx - s * 0.2},${cy - s * 0.4} L${cx - s * 0.12},${cy - s * 0.22}`} />
          {/* Screwdriver handle */}
          <rect x={cx + s * 0.32} y={cy + s * 0.28} width={s * 0.16} height={s * 0.22} rx={s * 0.04} transform={`rotate(45 ${cx + s * 0.4} ${cy + s * 0.4})`} />
        </>
      );

    // ─── Circuit: toolbox with tools ───
    case "circuit":
      return (
        <>
          {/* Box body */}
          <rect x={cx - s * 0.42} y={cy - s * 0.12} width={s * 0.84} height={s * 0.48} rx={s * 0.04} />
          {/* Lid line */}
          <line x1={cx - s * 0.42} y1={cy - s * 0.12} x2={cx + s * 0.42} y2={cy - s * 0.12} strokeWidth={2.5} />
          {/* Handle */}
          <path d={`M${cx - s * 0.18},${cy - s * 0.12} L${cx - s * 0.18},${cy - s * 0.28} Q${cx - s * 0.18},${cy - s * 0.34} ${cx - s * 0.12},${cy - s * 0.34} L${cx + s * 0.12},${cy - s * 0.34} Q${cx + s * 0.18},${cy - s * 0.34} ${cx + s * 0.18},${cy - s * 0.28} L${cx + s * 0.18},${cy - s * 0.12}`} />
          {/* Latch */}
          <rect x={cx - s * 0.07} y={cy - s * 0.17} width={s * 0.14} height={s * 0.06} rx={s * 0.02} />
          {/* Dividers inside */}
          <line x1={cx - s * 0.14} y1={cy - s * 0.12} x2={cx - s * 0.14} y2={cy + s * 0.36} strokeWidth={1} />
          <line x1={cx + s * 0.14} y1={cy - s * 0.12} x2={cx + s * 0.14} y2={cy + s * 0.36} strokeWidth={1} />
        </>
      );

    // ─── Rocket: monitor with play button + detail ───
    case "rocket":
      return (
        <>
          {/* Screen bezel */}
          <rect x={cx - s * 0.42} y={cy - s * 0.32} width={s * 0.84} height={s * 0.52} rx={s * 0.04} />
          {/* Inner screen */}
          <rect x={cx - s * 0.36} y={cy - s * 0.26} width={s * 0.72} height={s * 0.38} rx={s * 0.02} strokeWidth={1} />
          {/* Stand neck */}
          <line x1={cx} y1={cy + s * 0.2} x2={cx} y2={cy + s * 0.32} strokeWidth={2} />
          {/* Stand base */}
          <path d={`M${cx - s * 0.2},${cy + s * 0.38} Q${cx},${cy + s * 0.32} ${cx + s * 0.2},${cy + s * 0.38}`} strokeWidth={2} />
          {/* Play triangle */}
          <path d={`M${cx - s * 0.1},${cy - s * 0.15} L${cx + s * 0.15},${cy - s * 0.02} L${cx - s * 0.1},${cy + s * 0.08} Z`} />
        </>
      );

    // ─── Cloud: with upload arrow ───
    case "cloud":
      return (
        <>
          <path d={`M${cx - s * 0.38},${cy + s * 0.1} Q${cx - s * 0.52},${cy + s * 0.1} ${cx - s * 0.52},${cy - s * 0.06} Q${cx - s * 0.52},${cy - s * 0.22} ${cx - s * 0.32},${cy - s * 0.22} Q${cx - s * 0.28},${cy - s * 0.42} ${cx - s * 0.05},${cy - s * 0.38} Q${cx + s * 0.18},${cy - s * 0.48} ${cx + s * 0.32},${cy - s * 0.28} Q${cx + s * 0.52},${cy - s * 0.28} ${cx + s * 0.52},${cy - s * 0.06} Q${cx + s * 0.52},${cy + s * 0.1} ${cx + s * 0.38},${cy + s * 0.1} Z`} />
          {/* Upload arrow */}
          <line x1={cx} y1={cy + s * 0.28} x2={cx} y2={cy - s * 0.05} />
          <line x1={cx - s * 0.1} y1={cy + s * 0.05} x2={cx} y2={cy - s * 0.05} />
          <line x1={cx + s * 0.1} y1={cy + s * 0.05} x2={cx} y2={cy - s * 0.05} />
        </>
      );

    // ─── Calendar: with date grid ───
    case "calendar":
      return (
        <>
          <rect x={cx - s * 0.38} y={cy - s * 0.32} width={s * 0.76} height={s * 0.65} rx={s * 0.04} />
          {/* Header bar */}
          <rect x={cx - s * 0.38} y={cy - s * 0.32} width={s * 0.76} height={s * 0.15} rx={s * 0.04} fill={C} stroke="none" opacity={0.08} />
          <line x1={cx - s * 0.38} y1={cy - s * 0.17} x2={cx + s * 0.38} y2={cy - s * 0.17} />
          {/* Hooks */}
          <line x1={cx - s * 0.18} y1={cy - s * 0.38} x2={cx - s * 0.18} y2={cy - s * 0.26} strokeWidth={2.5} />
          <line x1={cx + s * 0.18} y1={cy - s * 0.38} x2={cx + s * 0.18} y2={cy - s * 0.26} strokeWidth={2.5} />
          {/* Date grid 4x3 */}
          {[0, 1, 2].map((row) =>
            [0, 1, 2, 3].map((col) => (
              <circle key={`${row}-${col}`} cx={cx - s * 0.22 + col * s * 0.15} cy={cy - s * 0.04 + row * s * 0.14} r={s * 0.025} fill={C} stroke="none" />
            ))
          )}
          {/* Highlighted date */}
          <circle cx={cx + s * 0.08} cy={cy + s * 0.1} r={s * 0.05} strokeWidth={1.5} />
        </>
      );

    // ─── Magnet: horseshoe with field lines ───
    case "magnet":
      return (
        <>
          <path d={`M${cx - s * 0.3},${cy - s * 0.2} L${cx - s * 0.3},${cy + s * 0.15} A${s * 0.3},${s * 0.3} 0 0 0 ${cx + s * 0.3},${cy + s * 0.15} L${cx + s * 0.3},${cy - s * 0.2}`} strokeWidth={2.5} />
          {/* Pole markings */}
          <line x1={cx - s * 0.3} y1={cy - s * 0.1} x2={cx - s * 0.18} y2={cy - s * 0.1} strokeWidth={2} />
          <line x1={cx + s * 0.3} y1={cy - s * 0.1} x2={cx + s * 0.18} y2={cy - s * 0.1} strokeWidth={2} />
          {/* Field lines */}
          {[0.4, 0.5, 0.6].map((r, i) => (
            <path key={i} d={`M${cx - s * 0.15},${cy - s * 0.2} Q${cx},${cy - s * r * 1.2} ${cx + s * 0.15},${cy - s * 0.2}`} strokeWidth={1} strokeDasharray="3 4" />
          ))}
          {/* Small particles */}
          {[
            { x: -0.05, y: -0.38 }, { x: 0.08, y: -0.42 }, { x: -0.1, y: -0.35 },
          ].map((p, i) => (
            <circle key={i} cx={cx + p.x * s} cy={cy + p.y * s} r={s * 0.015} fill={C} stroke="none" />
          ))}
        </>
      );

    // ─── Handshake: two hands with cuffs ───
    case "handshake":
      return (
        <>
          {/* Left hand outline */}
          <path d={`M${cx - s * 0.45},${cy + s * 0.05} L${cx - s * 0.2},${cy + s * 0.05} L${cx - s * 0.05},${cy - s * 0.08} L${cx + s * 0.1},${cy + s * 0.02}`} strokeWidth={2.5} />
          {/* Right hand outline */}
          <path d={`M${cx + s * 0.45},${cy - s * 0.05} L${cx + s * 0.2},${cy - s * 0.05} L${cx + s * 0.05},${cy + s * 0.08} L${cx - s * 0.1},${cy - s * 0.02}`} strokeWidth={2.5} />
          {/* Grip overlap */}
          <path d={`M${cx - s * 0.12},${cy - s * 0.02} Q${cx},${cy - s * 0.12} ${cx + s * 0.12},${cy + s * 0.02}`} strokeWidth={1.5} />
          {/* Left cuff */}
          <rect x={cx - s * 0.55} y={cy - s * 0.06} width={s * 0.12} height={s * 0.2} rx={s * 0.03} />
          {/* Right cuff */}
          <rect x={cx + s * 0.43} y={cy - s * 0.14} width={s * 0.12} height={s * 0.2} rx={s * 0.03} />
        </>
      );

    // ─── Globe: with latitude/longitude lines ───
    case "globe":
      return (
        <>
          <circle cx={cx} cy={cy} r={s * 0.42} />
          {/* Equator */}
          <ellipse cx={cx} cy={cy} rx={s * 0.42} ry={s * 0.12} />
          {/* Tropics */}
          <ellipse cx={cx} cy={cy - s * 0.18} rx={s * 0.36} ry={s * 0.08} strokeDasharray="4 4" strokeWidth={1} />
          <ellipse cx={cx} cy={cy + s * 0.18} rx={s * 0.36} ry={s * 0.08} strokeDasharray="4 4" strokeWidth={1} />
          {/* Meridians */}
          <ellipse cx={cx} cy={cy} rx={s * 0.12} ry={s * 0.42} />
          <ellipse cx={cx} cy={cy} rx={s * 0.3} ry={s * 0.42} />
        </>
      );

    // ─── Infinity ───
    case "infinity":
      return (
        <>
          <path d={`M${cx},${cy} C${cx - s * 0.18},${cy - s * 0.28} ${cx - s * 0.52},${cy - s * 0.28} ${cx - s * 0.52},${cy} C${cx - s * 0.52},${cy + s * 0.28} ${cx - s * 0.18},${cy + s * 0.28} ${cx},${cy} C${cx + s * 0.18},${cy - s * 0.28} ${cx + s * 0.52},${cy - s * 0.28} ${cx + s * 0.52},${cy} C${cx + s * 0.52},${cy + s * 0.28} ${cx + s * 0.18},${cy + s * 0.28} ${cx},${cy}`} strokeWidth={2.5} />
          {/* Data particles along path */}
          {[-0.42, -0.2, 0.2, 0.42].map((x, i) => (
            <circle key={i} cx={cx + x * s} cy={cy + (i % 2 === 0 ? -0.12 : 0.12) * s} r={s * 0.02} fill={C} stroke="none" />
          ))}
        </>
      );

    // ─── DNA: double helix with bridges ───
    case "dna":
      return (
        <>
          {Array.from({ length: 12 }, (_, i) => {
            const y = cy - s * 0.48 + i * s * 0.088;
            const offset = Math.sin(i * 0.65) * s * 0.24;
            return (
              <g key={i}>
                {i % 2 === 0 && <line x1={cx - offset} y1={y} x2={cx + offset} y2={y} strokeWidth={1} />}
                <circle cx={cx - offset} cy={y} r={s * 0.025} fill={C} stroke="none" />
                <circle cx={cx + offset} cy={y} r={s * 0.025} fill={C} stroke="none" />
              </g>
            );
          })}
          {/* Spine curves */}
          <path d={Array.from({ length: 12 }, (_, i) => {
            const y = cy - s * 0.48 + i * s * 0.088;
            const x = cx - Math.sin(i * 0.65) * s * 0.24;
            return `${i === 0 ? "M" : "L"}${x},${y}`;
          }).join(" ")} strokeWidth={1.5} />
          <path d={Array.from({ length: 12 }, (_, i) => {
            const y = cy - s * 0.48 + i * s * 0.088;
            const x = cx + Math.sin(i * 0.65) * s * 0.24;
            return `${i === 0 ? "M" : "L"}${x},${y}`;
          }).join(" ")} strokeWidth={1.5} />
        </>
      );

    // ─── Matrix: 4x4 dot grid with connections ───
    case "matrix":
      return (
        <>
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3].map((col) => (
              <circle key={`${row}-${col}`} cx={cx - s * 0.3 + col * s * 0.2} cy={cy - s * 0.3 + row * s * 0.2} r={s * 0.035} />
            ))
          )}
          {/* Diagonal connections */}
          <line x1={cx - s * 0.3} y1={cy - s * 0.3} x2={cx + s * 0.3} y2={cy + s * 0.3} strokeWidth={1} />
          <line x1={cx + s * 0.3} y1={cy - s * 0.3} x2={cx - s * 0.3} y2={cy + s * 0.3} strokeWidth={1} />
          {/* Horizontal/vertical */}
          <line x1={cx - s * 0.3} y1={cy} x2={cx + s * 0.3} y2={cy} strokeWidth={1} strokeDasharray="4 4" />
          <line x1={cx} y1={cy - s * 0.3} x2={cx} y2={cy + s * 0.3} strokeWidth={1} strokeDasharray="4 4" />
        </>
      );

    // ─── Wave: multiple flowing lines ───
    case "wave":
      return (
        <>
          {[-2, -1, 0, 1, 2].map((i) => (
            <path key={i} d={`M${cx - s * 0.5},${cy + i * s * 0.12} Q${cx - s * 0.25},${cy + i * s * 0.12 - s * 0.1} ${cx},${cy + i * s * 0.12} Q${cx + s * 0.25},${cy + i * s * 0.12 + s * 0.1} ${cx + s * 0.5},${cy + i * s * 0.12}`} strokeWidth={i === 0 ? 2 : 1.2} />
          ))}
        </>
      );

    // ─── Radar: sweep with blips ───
    case "radar":
      return (
        <>
          {[0.18, 0.3, 0.42].map((r, i) => (
            <circle key={i} cx={cx} cy={cy} r={s * r} strokeDasharray={i === 2 ? "none" : "4 4"} strokeWidth={i === 2 ? 2 : 1} />
          ))}
          {/* Sweep line */}
          <line x1={cx} y1={cy} x2={cx + s * 0.38} y2={cy - s * 0.2} strokeWidth={2} />
          {/* Cross */}
          <line x1={cx - s * 0.42} y1={cy} x2={cx + s * 0.42} y2={cy} strokeWidth={0.8} />
          <line x1={cx} y1={cy - s * 0.42} x2={cx} y2={cy + s * 0.42} strokeWidth={0.8} />
          {/* Blips */}
          <circle cx={cx + s * 0.25} cy={cy - s * 0.15} r={s * 0.025} fill={C} stroke="none" />
          <circle cx={cx - s * 0.12} cy={cy + s * 0.22} r={s * 0.02} fill={C} stroke="none" />
          <circle cx={cx + s * 0.08} cy={cy - s * 0.32} r={s * 0.018} fill={C} stroke="none" />
        </>
      );

    // ─── Funnel: with items flowing through ───
    case "funnel":
      return (
        <>
          <path d={`M${cx - s * 0.42},${cy - s * 0.38} L${cx + s * 0.42},${cy - s * 0.38} L${cx + s * 0.07},${cy + s * 0.1} L${cx + s * 0.07},${cy + s * 0.38} L${cx - s * 0.07},${cy + s * 0.38} L${cx - s * 0.07},${cy + s * 0.1} Z`} />
          {/* Inner level lines */}
          <line x1={cx - s * 0.28} y1={cy - s * 0.22} x2={cx + s * 0.28} y2={cy - s * 0.22} strokeWidth={1} />
          <line x1={cx - s * 0.16} y1={cy - s * 0.06} x2={cx + s * 0.16} y2={cy - s * 0.06} strokeWidth={1} />
          {/* Items entering */}
          {[-0.25, -0.08, 0.1, 0.28].map((x, i) => (
            <circle key={i} cx={cx + x * s} cy={cy - s * 0.32} r={s * 0.02} fill={C} stroke="none" />
          ))}
          {/* Item exiting */}
          <circle cx={cx} cy={cy + s * 0.45} r={s * 0.025} fill={C} stroke="none" />
        </>
      );

    // ─── Server: 3 stacked units ───
    case "server":
      return (
        <>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={cx - s * 0.38} y={cy - s * 0.38 + i * s * 0.26} width={s * 0.76} height={s * 0.2} rx={s * 0.03} />
              {/* Status dot */}
              <circle cx={cx + s * 0.26} cy={cy - s * 0.28 + i * s * 0.26} r={s * 0.025} fill={C} stroke="none" />
              {/* Lines */}
              <line x1={cx - s * 0.24} y1={cy - s * 0.28 + i * s * 0.26} x2={cx + s * 0.12} y2={cy - s * 0.28 + i * s * 0.26} strokeWidth={1} />
            </g>
          ))}
        </>
      );

    // ─── Chatbot: speech bubble with content ───
    case "chatbot":
      return (
        <>
          <rect x={cx - s * 0.38} y={cy - s * 0.32} width={s * 0.76} height={s * 0.48} rx={s * 0.1} />
          {/* Tail */}
          <path d={`M${cx - s * 0.12},${cy + s * 0.16} L${cx - s * 0.22},${cy + s * 0.38} L${cx + s * 0.06},${cy + s * 0.16}`} />
          {/* Three dots */}
          {[-1, 0, 1].map((i) => (
            <circle key={i} cx={cx + i * s * 0.14} cy={cy - s * 0.08} r={s * 0.04} fill={C} stroke="none" />
          ))}
        </>
      );

    // ─── Lock: padlock with detail ───
    case "lock":
      return (
        <>
          {/* Body */}
          <rect x={cx - s * 0.28} y={cy - s * 0.05} width={s * 0.56} height={s * 0.44} rx={s * 0.06} />
          {/* Shackle */}
          <path d={`M${cx - s * 0.18},${cy - s * 0.05} L${cx - s * 0.18},${cy - s * 0.25} A${s * 0.18},${s * 0.18} 0 0 1 ${cx + s * 0.18},${cy - s * 0.25} L${cx + s * 0.18},${cy - s * 0.05}`} strokeWidth={2.5} />
          {/* Keyhole */}
          <circle cx={cx} cy={cy + s * 0.1} r={s * 0.07} />
          <path d={`M${cx - s * 0.03},${cy + s * 0.16} L${cx},${cy + s * 0.28} L${cx + s * 0.03},${cy + s * 0.16}`} />
        </>
      );

    // ─── Speedometer: gauge with ticks ───
    case "speedometer":
      return (
        <>
          {/* Outer arc */}
          <path d={`M${cx - s * 0.42},${cy + s * 0.08} A${s * 0.42},${s * 0.42} 0 0 1 ${cx + s * 0.42},${cy + s * 0.08}`} strokeWidth={2.5} />
          {/* Inner arc */}
          <path d={`M${cx - s * 0.32},${cy + s * 0.06} A${s * 0.32},${s * 0.32} 0 0 1 ${cx + s * 0.32},${cy + s * 0.06}`} strokeWidth={1} strokeDasharray="3 3" />
          {/* Base line */}
          <line x1={cx - s * 0.42} y1={cy + s * 0.08} x2={cx + s * 0.42} y2={cy + s * 0.08} />
          {/* Needle */}
          <line x1={cx} y1={cy + s * 0.05} x2={cx + s * 0.25} y2={cy - s * 0.28} strokeWidth={2.5} />
          <circle cx={cx} cy={cy + s * 0.05} r={s * 0.05} fill={C} stroke="none" />
          {/* Tick marks */}
          {Array.from({ length: 15 }, (_, i) => {
            const a = Math.PI + (i / 14) * Math.PI;
            const isMajor = i % 3 === 0;
            return <line key={i} x1={cx + Math.cos(a) * s * (isMajor ? 0.36 : 0.38)} y1={cy + s * 0.05 + Math.sin(a) * s * (isMajor ? 0.36 : 0.38)} x2={cx + Math.cos(a) * s * 0.42} y2={cy + s * 0.05 + Math.sin(a) * s * 0.42} strokeWidth={isMajor ? 2 : 1} />;
          })}
        </>
      );

    // ─── Hierarchy: org chart with detail ───
    case "hierarchy":
      return (
        <>
          {/* Top node */}
          <rect x={cx - s * 0.12} y={cy - s * 0.42} width={s * 0.24} height={s * 0.14} rx={s * 0.03} />
          {/* Lines down */}
          <line x1={cx} y1={cy - s * 0.28} x2={cx} y2={cy - s * 0.12} />
          <line x1={cx - s * 0.35} y1={cy - s * 0.12} x2={cx + s * 0.35} y2={cy - s * 0.12} />
          {/* 3 bottom nodes */}
          {[-1, 0, 1].map((i) => (
            <g key={i}>
              <line x1={cx + i * s * 0.35} y1={cy - s * 0.12} x2={cx + i * s * 0.35} y2={cy + s * 0.02} />
              <rect x={cx + i * s * 0.35 - s * 0.1} y={cy + s * 0.02} width={s * 0.2} height={s * 0.12} rx={s * 0.03} />
            </g>
          ))}
          {/* Sub-nodes from middle */}
          <line x1={cx} y1={cy + s * 0.14} x2={cx} y2={cy + s * 0.22} />
          <line x1={cx - s * 0.18} y1={cy + s * 0.22} x2={cx + s * 0.18} y2={cy + s * 0.22} />
          {[-1, 1].map((i) => (
            <g key={`s${i}`}>
              <line x1={cx + i * s * 0.18} y1={cy + s * 0.22} x2={cx + i * s * 0.18} y2={cy + s * 0.3} />
              <circle cx={cx + i * s * 0.18} cy={cy + s * 0.34} r={s * 0.04} />
            </g>
          ))}
        </>
      );

    // ─── Pipeline: 3 stages with arrows ───
    case "pipeline":
      return (
        <>
          {[-1, 0, 1].map((i) => (
            <g key={i}>
              <circle cx={cx + i * s * 0.38} cy={cy} r={s * 0.12} />
              <circle cx={cx + i * s * 0.38} cy={cy} r={s * 0.04} fill={C} stroke="none" />
            </g>
          ))}
          {/* Arrows between */}
          {[-1, 1].map((dir, i) => {
            const x = cx + (dir * 0.5 - 0.5 + i) * s * 0.38;
            return (
              <g key={i}>
                <line x1={x - s * 0.05} y1={cy} x2={x + s * 0.12} y2={cy} strokeWidth={1.5} />
                <line x1={x + s * 0.08} y1={cy - s * 0.04} x2={x + s * 0.12} y2={cy} />
                <line x1={x + s * 0.08} y1={cy + s * 0.04} x2={x + s * 0.12} y2={cy} />
              </g>
            );
          })}
          {/* Labels */}
          {[-1, 0, 1].map((i) => (
            <line key={`l${i}`} x1={cx + i * s * 0.38 - s * 0.06} y1={cy + s * 0.2} x2={cx + i * s * 0.38 + s * 0.06} y2={cy + s * 0.2} strokeWidth={1} />
          ))}
        </>
      );

    // ─── Antenna: with signal waves ───
    case "antenna":
      return (
        <>
          {/* Mast */}
          <line x1={cx} y1={cy + s * 0.38} x2={cx} y2={cy - s * 0.12} strokeWidth={2.5} />
          {/* Base */}
          <line x1={cx - s * 0.18} y1={cy + s * 0.38} x2={cx + s * 0.18} y2={cy + s * 0.38} strokeWidth={2} />
          {/* Tripod */}
          <line x1={cx} y1={cy + s * 0.2} x2={cx - s * 0.22} y2={cy + s * 0.38} strokeWidth={1.5} />
          <line x1={cx} y1={cy + s * 0.2} x2={cx + s * 0.22} y2={cy + s * 0.38} strokeWidth={1.5} />
          {/* Signal arcs */}
          {[0.15, 0.26, 0.38].map((r, i) => (
            <path key={i} d={`M${cx - s * r * 0.75},${cy - s * 0.12 - s * r * 0.75} A${s * r},${s * r} 0 0 1 ${cx + s * r * 0.75},${cy - s * 0.12 - s * r * 0.75}`} strokeWidth={i === 2 ? 1 : 1.5} />
          ))}
          {/* Tip */}
          <circle cx={cx} cy={cy - s * 0.12} r={s * 0.04} fill={C} stroke="none" />
        </>
      );

    // ─── Microscope ───
    case "microscope":
      return (
        <>
          <rect x={cx - s * 0.07} y={cy - s * 0.44} width={s * 0.14} height={s * 0.1} rx={s * 0.03} />
          <line x1={cx} y1={cy - s * 0.34} x2={cx} y2={cy + s * 0.08} strokeWidth={2.5} />
          <rect x={cx - s * 0.05} y={cy + s * 0.08} width={s * 0.1} height={s * 0.08} rx={s * 0.02} />
          <line x1={cx - s * 0.24} y1={cy + s * 0.2} x2={cx + s * 0.24} y2={cy + s * 0.2} strokeWidth={2.5} />
          <path d={`M${cx},${cy - s * 0.18} L${cx + s * 0.15},${cy - s * 0.18} L${cx + s * 0.15},${cy + s * 0.28}`} strokeWidth={2} />
          <line x1={cx - s * 0.18} y1={cy + s * 0.4} x2={cx + s * 0.28} y2={cy + s * 0.4} strokeWidth={2.5} />
          <line x1={cx + s * 0.15} y1={cy + s * 0.28} x2={cx + s * 0.15} y2={cy + s * 0.4} strokeWidth={2} />
          {/* Focus knob */}
          <circle cx={cx + s * 0.2} cy={cy} r={s * 0.04} />
        </>
      );

    // ─── Diamond: faceted gem ───
    case "diamond":
      return (
        <>
          {/* Crown */}
          <path d={`M${cx},${cy - s * 0.45} L${cx + s * 0.2},${cy - s * 0.18} L${cx + s * 0.35},${cy - s * 0.12} L${cx},${cy + s * 0.45} L${cx - s * 0.35},${cy - s * 0.12} L${cx - s * 0.2},${cy - s * 0.18} Z`} />
          {/* Girdle line */}
          <line x1={cx - s * 0.35} y1={cy - s * 0.12} x2={cx + s * 0.35} y2={cy - s * 0.12} />
          {/* Facet lines */}
          <line x1={cx - s * 0.2} y1={cy - s * 0.18} x2={cx} y2={cy - s * 0.12} strokeWidth={1} />
          <line x1={cx + s * 0.2} y1={cy - s * 0.18} x2={cx} y2={cy - s * 0.12} strokeWidth={1} />
          <line x1={cx} y1={cy - s * 0.12} x2={cx} y2={cy + s * 0.45} strokeWidth={1} />
          {/* Light ray */}
          <line x1={cx + s * 0.15} y1={cy - s * 0.55} x2={cx + s * 0.08} y2={cy - s * 0.38} strokeWidth={1} />
          <line x1={cx + s * 0.25} y1={cy - s * 0.52} x2={cx + s * 0.18} y2={cy - s * 0.35} strokeWidth={1} />
        </>
      );

    // ─── Hourglass: with sand particles ───
    case "hourglass":
      return (
        <>
          {/* Frame */}
          <line x1={cx - s * 0.28} y1={cy - s * 0.42} x2={cx + s * 0.28} y2={cy - s * 0.42} strokeWidth={2.5} />
          <line x1={cx - s * 0.28} y1={cy + s * 0.42} x2={cx + s * 0.28} y2={cy + s * 0.42} strokeWidth={2.5} />
          {/* Glass shape */}
          <path d={`M${cx - s * 0.24},${cy - s * 0.42} L${cx - s * 0.04},${cy - s * 0.02} L${cx - s * 0.24},${cy + s * 0.42}`} />
          <path d={`M${cx + s * 0.24},${cy - s * 0.42} L${cx + s * 0.04},${cy - s * 0.02} L${cx + s * 0.24},${cy + s * 0.42}`} />
          {/* Neck */}
          <line x1={cx} y1={cy - s * 0.06} x2={cx} y2={cy + s * 0.06} strokeWidth={1} />
          {/* Sand in top */}
          <path d={`M${cx - s * 0.12},${cy - s * 0.18} L${cx + s * 0.12},${cy - s * 0.18}`} strokeWidth={1} />
          {/* Sand in bottom */}
          <path d={`M${cx - s * 0.14},${cy + s * 0.32} L${cx + s * 0.14},${cy + s * 0.32}`} strokeWidth={1} />
          {/* Falling particles */}
          {[0.08, 0.15, 0.22].map((y, i) => (
            <circle key={i} cx={cx} cy={cy + y * s} r={s * 0.012} fill={C} stroke="none" />
          ))}
        </>
      );

    // ─── Compass: with rose detail ───
    case "compass":
      return (
        <>
          <circle cx={cx} cy={cy} r={s * 0.42} />
          <circle cx={cx} cy={cy} r={s * 0.38} strokeWidth={1} />
          {/* Needle */}
          <path d={`M${cx},${cy - s * 0.32} L${cx + s * 0.06},${cy} L${cx},${cy + s * 0.32} L${cx - s * 0.06},${cy} Z`} />
          {/* Center */}
          <circle cx={cx} cy={cy} r={s * 0.04} fill={C} stroke="none" />
          {/* Cardinal marks */}
          {[0, 90, 180, 270].map((deg) => {
            const a = ((deg - 90) * Math.PI) / 180;
            return (
              <g key={deg}>
                <line x1={cx + Math.cos(a) * s * 0.34} y1={cy + Math.sin(a) * s * 0.34} x2={cx + Math.cos(a) * s * 0.42} y2={cy + Math.sin(a) * s * 0.42} strokeWidth={2} />
              </g>
            );
          })}
          {/* Minor marks */}
          {[45, 135, 225, 315].map((deg) => {
            const a = ((deg - 90) * Math.PI) / 180;
            return <line key={deg} x1={cx + Math.cos(a) * s * 0.36} y1={cy + Math.sin(a) * s * 0.36} x2={cx + Math.cos(a) * s * 0.42} y2={cy + Math.sin(a) * s * 0.42} strokeWidth={1} />;
          })}
        </>
      );

    // ─── Fingerprint: concentric arches ───
    case "fingerprint":
      return (
        <>
          {[0.08, 0.15, 0.22, 0.3, 0.38].map((r, i) => (
            <path key={i} d={`M${cx - s * r},${cy + s * 0.06} A${s * r},${s * r * 1.3} 0 0 1 ${cx + s * r},${cy + s * 0.06}`} />
          ))}
          {[0.08, 0.15, 0.22, 0.3].map((r, i) => (
            <path key={`b${i}`} d={`M${cx - s * r * 0.85},${cy - s * 0.06} A${s * r * 0.9},${s * r * 1.1} 0 0 0 ${cx + s * r * 0.85},${cy - s * 0.06}`} />
          ))}
        </>
      );

    // ─── Telescope: on tripod with stars ───
    case "telescope":
      return (
        <>
          {/* Tube body */}
          <line x1={cx - s * 0.34} y1={cy - s * 0.22} x2={cx + s * 0.22} y2={cy + s * 0.12} strokeWidth={3} />
          {/* Lens */}
          <circle cx={cx - s * 0.38} cy={cy - s * 0.25} r={s * 0.1} />
          {/* Eyepiece */}
          <rect x={cx + s * 0.2} y={cy + s * 0.08} width={s * 0.12} height={s * 0.08} rx={s * 0.02} />
          {/* Tripod */}
          <line x1={cx - s * 0.02} y1={cy} x2={cx - s * 0.2} y2={cy + s * 0.38} strokeWidth={1.5} />
          <line x1={cx - s * 0.02} y1={cy} x2={cx + s * 0.18} y2={cy + s * 0.38} strokeWidth={1.5} />
          <line x1={cx - s * 0.02} y1={cy} x2={cx - s * 0.02} y2={cy + s * 0.34} strokeWidth={1.5} />
          {/* Stars */}
          {[
            { x: -0.5, y: -0.42 }, { x: 0.42, y: -0.38 }, { x: -0.35, y: -0.5 },
            { x: 0.28, y: -0.48 }, { x: 0.5, y: -0.3 },
          ].map((p, i) => (
            <circle key={i} cx={cx + p.x * s} cy={cy + p.y * s} r={s * (i % 2 === 0 ? 0.015 : 0.02)} fill={C} stroke="none" />
          ))}
        </>
      );

    default:
      return <circle cx={cx} cy={cy} r={s * 0.38} />;
  }
}
