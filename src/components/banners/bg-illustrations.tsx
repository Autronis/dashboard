import type { BannerIllustration } from "@/types/content";

interface BgIllustrationProps {
  type: BannerIllustration;
  width: number;
  height: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

const N = "#2DD4A8";

// ─── Helper functions ──────────────────────────────────────────────────────────

function ring(x: number, y: number, r: number, o: number, sw = 1.5) {
  return <circle cx={x} cy={y} r={r} fill="none" stroke={N} strokeWidth={sw} opacity={o} />;
}

function dot(x: number, y: number, r: number, o: number) {
  return <circle cx={x} cy={y} r={r} fill={N} opacity={o} />;
}

function ln(x1: number, y1: number, x2: number, y2: number, o: number, sw = 1, dash?: string) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={N} strokeWidth={sw} opacity={o} strokeDasharray={dash} />;
}

function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number, o: number, sw = 1.5) {
  const s = (startDeg * Math.PI) / 180;
  const e = (endDeg * Math.PI) / 180;
  const x1 = cx + Math.cos(s) * r;
  const y1 = cy + Math.sin(s) * r;
  const x2 = cx + Math.cos(e) * r;
  const y2 = cy + Math.sin(e) * r;
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={N} strokeWidth={sw} opacity={o} />;
}

function tickMarks(cx: number, cy: number, innerR: number, outerR: number, count: number, o: number) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    lines.push(
      <line key={i} x1={cx + Math.cos(a) * innerR} y1={cy + Math.sin(a) * innerR}
        x2={cx + Math.cos(a) * outerR} y2={cy + Math.sin(a) * outerR}
        stroke={N} strokeWidth={i % 5 === 0 ? 1.5 : 0.7} opacity={o} />
    );
  }
  return <>{lines}</>;
}

function hexGrid(cx: number, cy: number, r: number, size: number, o: number) {
  const hexes = [];
  const h = size * Math.sqrt(3);
  const cols = Math.ceil(r * 2 / (size * 1.5));
  const rows = Math.ceil(r * 2 / h);
  for (let row = -rows; row <= rows; row++) {
    for (let col = -cols; col <= cols; col++) {
      const hx = cx + col * size * 1.5;
      const hy = cy + row * h + (col % 2 ? h / 2 : 0);
      const dist = Math.sqrt((hx - cx) ** 2 + (hy - cy) ** 2);
      if (dist > r) continue;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (i * 60 - 30) * Math.PI / 180;
        return `${hx + Math.cos(a) * size * 0.45},${hy + Math.sin(a) * size * 0.45}`;
      }).join(" ");
      hexes.push(<polygon key={`${row}-${col}`} points={pts} fill="none" stroke={N} strokeWidth="0.5" opacity={o * (1 - dist / r * 0.5)} />);
    }
  }
  return <>{hexes}</>;
}

// Smooth rounded gear path — wide teeth with smooth bezier curves
function gearPath(cx: number, cy: number, r: number, teeth: number): string {
  const outerR = r;
  const innerR = r * 0.78;
  const toothArc = (Math.PI * 2) / teeth;

  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = i * toothArc - Math.PI / 2;
    const riseStart  = a + toothArc * 0.05;
    const tipStart   = a + toothArc * 0.20;
    const tipEnd     = a + toothArc * 0.45;
    const fallEnd    = a + toothArc * 0.60;
    const nextRise   = a + toothArc * 1.05;

    const p = (angle: number, radius: number) =>
      `${cx + Math.cos(angle) * radius} ${cy + Math.sin(angle) * radius}`;

    if (i === 0) d += `M ${p(riseStart, innerR)} `;
    d += `C ${p(riseStart, innerR + (outerR - innerR) * 0.5)} ${p(tipStart, outerR)} ${p(tipStart, outerR)} `;
    d += `A ${outerR} ${outerR} 0 0 1 ${p(tipEnd, outerR)} `;
    d += `C ${p(tipEnd, outerR)} ${p(fallEnd, innerR + (outerR - innerR) * 0.5)} ${p(fallEnd, innerR)} `;
    d += `A ${innerR} ${innerR} 0 0 1 ${p(nextRise, innerR)} `;
  }
  d += "Z";
  return d;
}

// ─── GEAR — One massive gear, center-right, partially off-screen ─────────────
// Reference: huge gear extending beyond canvas edges, 10-12 wide rounded teeth,
// 3 concentric inner circles, small center dot. NO spokes, NO tick marks.

function GearIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  // Shift gear to center-right / slightly down, just like reference
  const gcx = cx + r * 0.25;
  const gcy = cy + r * 0.15;
  // Make it so large it blows past the canvas edges
  const gr = r * 1.55;
  const teeth = 11;

  return (
    <>
      {/* THE massive gear outline */}
      <path d={gearPath(gcx, gcy, gr, teeth)} fill="none" stroke={N} strokeWidth="3" opacity="0.18" strokeLinejoin="round" />

      {/* 3 concentric inner rings, evenly spaced */}
      {ring(gcx, gcy, gr * 0.62, 0.14, 2.5)}
      {ring(gcx, gcy, gr * 0.42, 0.12, 2)}
      {ring(gcx, gcy, gr * 0.22, 0.16, 2.5)}

      {/* Center dot */}
      {dot(gcx, gcy, gr * 0.05, 0.18)}
    </>
  );
}

// ─── BRAIN — Large brain with circuit board traces inside ─────────────────────
// Reference: two brain lobes, circuit traces (H+V grid), PCB-style via dots,
// clean and symmetrical, brain stem at bottom.

function BrainIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const br = r * 0.95;

  // Circuit traces — horizontal and vertical grid pattern inside brain contour
  const hTraces: [number, number, number, number][] = [
    // Left lobe horizontals
    [-0.68, -0.52, -0.12, -0.52],
    [-0.72, -0.30, -0.10, -0.30],
    [-0.72, -0.08, -0.10, -0.08],
    [-0.68,  0.14, -0.12,  0.14],
    [-0.58,  0.36, -0.15,  0.36],
    // Right lobe horizontals
    [ 0.12, -0.52,  0.68, -0.52],
    [ 0.10, -0.30,  0.72, -0.30],
    [ 0.10, -0.08,  0.72, -0.08],
    [ 0.12,  0.14,  0.68,  0.14],
    [ 0.15,  0.36,  0.58,  0.36],
    // Center bridge
    [-0.10, -0.20,  0.10, -0.20],
    [-0.10,  0.02,  0.10,  0.02],
    [-0.10,  0.24,  0.10,  0.24],
  ];
  const vTraces: [number, number, number, number][] = [
    // Left lobe verticals
    [-0.52, -0.52, -0.52,  0.36],
    [-0.32, -0.52, -0.32,  0.36],
    [-0.12, -0.52, -0.12,  0.36],
    [-0.68, -0.30, -0.68,  0.14],
    // Right lobe verticals
    [ 0.52, -0.52,  0.52,  0.36],
    [ 0.32, -0.52,  0.32,  0.36],
    [ 0.12, -0.52,  0.12,  0.36],
    [ 0.68, -0.30,  0.68,  0.14],
  ];

  // Via dots at grid intersections
  const vias: [number, number][] = [
    [-0.52, -0.52], [-0.52, -0.30], [-0.52, -0.08], [-0.52, 0.14], [-0.52, 0.36],
    [-0.32, -0.52], [-0.32, -0.30], [-0.32, -0.08], [-0.32, 0.14], [-0.32, 0.36],
    [-0.12, -0.52], [-0.12, -0.30], [-0.12, -0.08], [-0.12, 0.14], [-0.12, 0.36],
    [ 0.52, -0.52], [ 0.52, -0.30], [ 0.52, -0.08], [ 0.52, 0.14], [ 0.52, 0.36],
    [ 0.32, -0.52], [ 0.32, -0.30], [ 0.32, -0.08], [ 0.32, 0.14], [ 0.32, 0.36],
    [ 0.12, -0.52], [ 0.12, -0.30], [ 0.12, -0.08], [ 0.12, 0.14], [ 0.12, 0.36],
    [-0.68, -0.30], [-0.68,  0.14],
    [ 0.68, -0.30], [ 0.68,  0.14],
    [-0.10, -0.20], [ 0.10, -0.20],
    [-0.10,  0.02], [ 0.10,  0.02],
    [-0.10,  0.24], [ 0.10,  0.24],
  ];

  return (
    <>
      {/* Left brain lobe */}
      <ellipse cx={cx - r * 0.24} cy={cy - r * 0.04} rx={br * 0.56} ry={br * 0.82}
        fill="rgba(45,212,168,0.03)" stroke={N} strokeWidth="2.5" opacity="0.16" />
      {/* Right brain lobe */}
      <ellipse cx={cx + r * 0.24} cy={cy - r * 0.04} rx={br * 0.56} ry={br * 0.82}
        fill="rgba(45,212,168,0.03)" stroke={N} strokeWidth="2.5" opacity="0.16" />

      {/* Brain stem */}
      <path d={`M ${cx - r * 0.09} ${cy + br * 0.68} Q ${cx} ${cy + br * 0.88} ${cx + r * 0.09} ${cy + br * 0.68}`}
        fill="none" stroke={N} strokeWidth="2" opacity="0.14" />

      {/* Center dividing groove */}
      {ln(cx, cy - br * 0.78, cx, cy + br * 0.62, 0.07, 1, "5 5")}

      {/* Horizontal circuit traces */}
      {hTraces.map(([x1, y1, x2, y2], i) => (
        <line key={`ht${i}`}
          x1={cx + x1 * br} y1={cy + y1 * br}
          x2={cx + x2 * br} y2={cy + y2 * br}
          stroke={N} strokeWidth="1.2" opacity="0.11" />
      ))}

      {/* Vertical circuit traces */}
      {vTraces.map(([x1, y1, x2, y2], i) => (
        <line key={`vt${i}`}
          x1={cx + x1 * br} y1={cy + y1 * br}
          x2={cx + x2 * br} y2={cy + y2 * br}
          stroke={N} strokeWidth="1.2" opacity="0.11" />
      ))}

      {/* PCB via dots at junctions */}
      {vias.map(([vx, vy], i) => (
        <g key={`via${i}`}>
          <circle cx={cx + vx * br} cy={cy + vy * br} r={3.5}
            fill="none" stroke={N} strokeWidth="1" opacity="0.18" />
          <circle cx={cx + vx * br} cy={cy + vy * br} r={1.5}
            fill={N} opacity="0.20" />
        </g>
      ))}
    </>
  );
}

// ─── CHART — Tablet/screen frame with bar chart + line chart inside ───────────
// Reference: rounded-rect screen frame, toolbar header, bar columns, line overlay.

function ChartIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const fw = r * 1.55, fh = r * 1.15;
  const fl = cx - fw / 2, ft = cy - fh / 2;
  const fr = cx + fw / 2, fb = cy + fh / 2;
  const headerH = fh * 0.12;
  const pad = r * 0.07;
  const il = fl + pad, it = ft + headerH + pad;
  const ir = fr - pad, ib = fb - pad;
  const iw = ir - il, ih = ib - it;

  const barHeights = [0.42, 0.62, 0.50, 0.78, 0.65, 0.88, 0.72, 0.92, 0.58, 0.80];
  const linePoints: [number, number][] = [
    [0, 0.58], [0.11, 0.42], [0.22, 0.48], [0.33, 0.28], [0.44, 0.36],
    [0.55, 0.18], [0.66, 0.30], [0.77, 0.14], [0.88, 0.40], [1, 0.10],
  ];

  return (
    <>
      {/* Screen / tablet frame */}
      <rect x={fl} y={ft} width={fw} height={fh} rx={r * 0.035}
        fill="none" stroke={N} strokeWidth="2.5" opacity="0.17" />

      {/* Top toolbar header bar */}
      {ln(fl, ft + headerH, fr, ft + headerH, 0.13, 1.5)}

      {/* Toolbar UI elements — hamburger lines + title stub */}
      {[0, 1, 2].map(i => (
        <rect key={`hb${i}`}
          x={fl + pad} y={ft + pad * 0.35 + i * (headerH * 0.22)}
          width={r * 0.055} height={r * 0.008} rx={1}
          fill={N} opacity="0.16" />
      ))}
      <rect x={fl + pad + r * 0.085} y={ft + pad * 0.35}
        width={r * 0.16} height={r * 0.007} rx={1} fill={N} opacity="0.13" />
      <rect x={fl + pad + r * 0.085} y={ft + pad * 0.58}
        width={r * 0.10} height={r * 0.006} rx={1} fill={N} opacity="0.09" />

      {/* Bar chart columns */}
      {barHeights.map((h, i) => {
        const bw = iw * 0.067;
        const gap = iw * 0.028;
        const bx = il + i * (bw + gap) + gap * 0.5;
        const bh = ih * 0.58 * h;
        const by = ib - bh;
        return (
          <g key={`bar${i}`}>
            <rect x={bx} y={by} width={bw} height={bh} rx={2}
              fill={N} opacity="0.05" />
            <rect x={bx} y={by} width={bw} height={bh} rx={2}
              fill="none" stroke={N} strokeWidth="1.2" opacity="0.14" />
          </g>
        );
      })}

      {/* Line chart overlay */}
      <polyline
        points={linePoints.map(([px, py]) =>
          `${il + px * iw},${it + ih * 0.12 + py * ih * 0.62}`).join(" ")}
        fill="none" stroke={N} strokeWidth="2" opacity="0.20" strokeLinejoin="round" />

      {/* Area fill under line */}
      <path
        d={`M ${il},${ib} ${linePoints.map(([px, py]) =>
          `L ${il + px * iw} ${it + ih * 0.12 + py * ih * 0.62}`).join(" ")} L ${ir},${ib} Z`}
        fill={N} opacity="0.03" />

      {/* Data point dots on line */}
      {linePoints.filter((_, i) => i % 2 === 0).map(([px, py], i) => {
        const x = il + px * iw;
        const y = it + ih * 0.12 + py * ih * 0.62;
        return <g key={`dp${i}`}>{ring(x, y, 3.5, 0.12, 1)}{dot(x, y, 1.8, 0.16)}</g>;
      })}

      {/* Axis lines */}
      {ln(il, ib, ir, ib, 0.10, 1)}
      {ln(il, it + ih * 0.12, il, ib, 0.10, 1)}

      {/* Horizontal grid lines */}
      {Array.from({ length: 4 }, (_, i) => {
        const y = it + ih * 0.14 + i * ih * 0.20;
        return <line key={`hg${i}`} x1={il} y1={y} x2={ir} y2={y}
          stroke={N} strokeWidth="0.5" opacity="0.04" />;
      })}
    </>
  );
}

// ─── NODES → CHAIN LINK — Two large interlocking chain links ─────────────────
// Reference: chain / ketting — two large oval links that overlap each other,
// thick smooth outlines, very simple and clean.

function NodesIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  // Two oval chain links side by side, overlapping in the center
  const lw = r * 0.52;  // link half-width
  const lh = r * 0.30;  // link half-height
  const offset = r * 0.40; // horizontal offset from center

  const leftCx  = cx - offset;
  const rightCx = cx + offset;

  return (
    <>
      {/* Left chain link — outer oval */}
      <ellipse cx={leftCx} cy={cy} rx={lw} ry={lh}
        fill="none" stroke={N} strokeWidth="3" opacity="0.18" />
      {/* Left chain link — inner oval (thickness illusion) */}
      <ellipse cx={leftCx} cy={cy} rx={lw * 0.72} ry={lh * 0.60}
        fill="none" stroke={N} strokeWidth="1.5" opacity="0.10" />

      {/* Right chain link — outer oval */}
      <ellipse cx={rightCx} cy={cy} rx={lw} ry={lh}
        fill="none" stroke={N} strokeWidth="3" opacity="0.18" />
      {/* Right chain link — inner oval */}
      <ellipse cx={rightCx} cy={cy} rx={lw * 0.72} ry={lh * 0.60}
        fill="none" stroke={N} strokeWidth="1.5" opacity="0.10" />

      {/* Overlap region — draw right link arc over left link to show interlock */}
      {/* Clip the right side of left link in the overlap zone with a mask */}
      <defs>
        <clipPath id="rightLinkClip">
          <rect x={cx - r * 0.02} y={cy - lh * 1.2} width={lw + r * 0.1} height={lh * 2.4} />
        </clipPath>
        <clipPath id="leftLinkClip">
          <rect x={cx - lw - r * 0.1} y={cy - lh * 1.2} width={lw + r * 0.1} height={lh * 2.4} />
        </clipPath>
      </defs>

      {/* Re-draw right oval over left in the overlap — creates interlocking illusion */}
      <ellipse cx={rightCx} cy={cy} rx={lw} ry={lh}
        fill="none" stroke={N} strokeWidth="3" opacity="0.18"
        clipPath="url(#leftLinkClip)" />
    </>
  );
}

// ─── SHIELD — Large shield with padlock inside + double border ────────────────
// Reference: pointed-bottom shield, inner shield outline, padlock (rect + shackle arc),
// inner circle behind lock, bold and clean.

function ShieldIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const sw = r * 0.72, sh = r * 0.90;

  const shieldD = (scale: number) => {
    const w = sw * scale, h = sh * scale;
    return `M ${cx} ${cy - h} Q ${cx + w} ${cy - h * 0.55} ${cx + w} ${cy - h * 0.05} Q ${cx + w * 0.55} ${cy + h * 0.68} ${cx} ${cy + h} Q ${cx - w * 0.55} ${cy + h * 0.68} ${cx - w} ${cy - h * 0.05} Q ${cx - w} ${cy - h * 0.55} ${cx} ${cy - h} Z`;
  };

  return (
    <>
      {/* Outer shield */}
      <path d={shieldD(1)} fill="rgba(45,212,168,0.03)" stroke={N} strokeWidth="3" opacity="0.18" />

      {/* Inner shield border */}
      <path d={shieldD(0.80)} fill="none" stroke={N} strokeWidth="1.5" opacity="0.12" />

      {/* Inner circle behind lock */}
      {ring(cx, cy + r * 0.05, r * 0.28, 0.08, 1.5)}

      {/* Lock body */}
      <rect x={cx - r * 0.13} y={cy + r * 0.02} width={r * 0.26} height={r * 0.22}
        rx={r * 0.025} fill="none" stroke={N} strokeWidth="2.5" opacity="0.20" />

      {/* Lock shackle arc */}
      {arc(cx, cy + r * 0.02, r * 0.10, 180, 360, 0.16, 2.5)}

      {/* Keyhole */}
      {dot(cx, cy + r * 0.10, r * 0.025, 0.14)}
      {ln(cx, cy + r * 0.10, cx, cy + r * 0.18, 0.12, 1.5)}
    </>
  );
}

// ─── FLOW — Process diagram: rounded rect boxes + right-angle connectors ──────
// Reference: 4-5 rounded rectangles connected with lines that have right-angle
// turns, branching pattern, very clean minimal diagram.

function FlowIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const bw = r * 0.32, bh = r * 0.16;

  // Box positions [x, y] — relative to center
  const boxes: [number, number][] = [
    [ 0,     -0.62],   // 0 top
    [ 0,     -0.28],   // 1 second
    [-0.42,   0.08],   // 2 branch left
    [ 0.42,   0.08],   // 3 branch right
    [ 0,      0.44],   // 4 bottom merge
  ];

  // Connector lines [from box, to box] drawn as right-angle paths
  // We'll define them manually as SVG paths for precise right-angle turns
  const connectors = [
    // 0 → 1 (straight down)
    `M ${cx} ${cy + (-0.62 + 0.08) * r} L ${cx} ${cy + (-0.28 - 0.08) * r}`,
    // 1 → 2 (down then left)
    `M ${cx} ${cy + (-0.28 + 0.08) * r} L ${cx} ${cy} L ${cx - 0.42 * r} ${cy} L ${cx - 0.42 * r} ${cy + 0.08 * r - bh / 2}`,
    // 1 → 3 (down then right)
    `M ${cx} ${cy + (-0.28 + 0.08) * r} L ${cx} ${cy} L ${cx + 0.42 * r} ${cy} L ${cx + 0.42 * r} ${cy + 0.08 * r - bh / 2}`,
    // 2 → 4 (down then right)
    `M ${cx - 0.42 * r} ${cy + (0.08 + 0.08) * r} L ${cx - 0.42 * r} ${cy + 0.34 * r} L ${cx} ${cy + 0.34 * r} L ${cx} ${cy + 0.44 * r - bh / 2}`,
    // 3 → 4 (down then left)
    `M ${cx + 0.42 * r} ${cy + (0.08 + 0.08) * r} L ${cx + 0.42 * r} ${cy + 0.34 * r} L ${cx} ${cy + 0.34 * r} L ${cx} ${cy + 0.44 * r - bh / 2}`,
  ];

  return (
    <>
      {/* Connector lines */}
      {connectors.map((d, i) => (
        <path key={`conn${i}`} d={d} fill="none" stroke={N}
          strokeWidth="2" opacity="0.14" strokeLinejoin="round" />
      ))}

      {/* Process boxes */}
      {boxes.map(([ox, oy], i) => (
        <rect key={`box${i}`}
          x={cx + ox * r - bw / 2} y={cy + oy * r - bh / 2}
          width={bw} height={bh} rx={5}
          fill="rgba(45,212,168,0.04)" stroke={N} strokeWidth="2.5" opacity="0.17" />
      ))}

      {/* Arrow tips at connector ends */}
      {[
        [cx, cy + (-0.28 - 0.08) * r, 90],
        [cx - 0.42 * r, cy + 0.08 * r - bh / 2, 90],
        [cx + 0.42 * r, cy + 0.08 * r - bh / 2, 90],
        [cx, cy + 0.44 * r - bh / 2, 90],
      ].map(([ax, ay, rot], i) => (
        <path key={`arr${i}`}
          d={`M ${ax as number - 5} ${ay as number + 5} L ${ax} ${ay} L ${ax as number + 5} ${ay as number + 5}`}
          fill="none" stroke={N} strokeWidth="1.5" opacity="0.14" />
      ))}
    </>
  );
}

// ─── CLOCK/MONEY — Clock face with clock hands + currency sign ────────────────
// Replaces the old "lightbulb" illustration with the clock reference design.
// Reference: large clock, hour markers, hands, euro/dollar sign, small gear accent.

function LightbulbIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const cr = r * 0.85; // clock radius

  return (
    <>
      {/* Clock outer circle */}
      {ring(cx, cy, cr, 0.18, 3)}
      {/* Clock inner rim */}
      {ring(cx, cy, cr * 0.88, 0.08, 1)}

      {/* Hour markers — 12 short tick marks */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const isMain = i % 3 === 0;
        const inner = cr * (isMain ? 0.74 : 0.80);
        const outer = cr * 0.88;
        return (
          <line key={`tick${i}`}
            x1={cx + Math.cos(a) * inner} y1={cy + Math.sin(a) * inner}
            x2={cx + Math.cos(a) * outer} y2={cy + Math.sin(a) * outer}
            stroke={N} strokeWidth={isMain ? 2 : 1} opacity={isMain ? 0.20 : 0.13} />
        );
      })}

      {/* Hour hand — pointing to ~10 o'clock */}
      <line x1={cx} y1={cy}
        x2={cx + Math.cos((10 / 12) * Math.PI * 2 - Math.PI / 2) * cr * 0.52}
        y2={cy + Math.sin((10 / 12) * Math.PI * 2 - Math.PI / 2) * cr * 0.52}
        stroke={N} strokeWidth="3" opacity="0.20" strokeLinecap="round" />

      {/* Minute hand — pointing to ~2 o'clock */}
      <line x1={cx} y1={cy}
        x2={cx + Math.cos((2 / 12) * Math.PI * 2 - Math.PI / 2) * cr * 0.70}
        y2={cy + Math.sin((2 / 12) * Math.PI * 2 - Math.PI / 2) * cr * 0.70}
        stroke={N} strokeWidth="2.5" opacity="0.18" strokeLinecap="round" />

      {/* Center hub */}
      {dot(cx, cy, cr * 0.04, 0.22)}
      {ring(cx, cy, cr * 0.07, 0.14, 1.5)}

      {/* Euro/dollar sign overlapping the clock — large, center */}
      <text x={cx + cr * 0.18} y={cy + cr * 0.12}
        fontSize={cr * 0.60} fontFamily="system-ui, sans-serif"
        fill="none" stroke={N} strokeWidth="1.5" opacity="0.13"
        textAnchor="middle" dominantBaseline="middle">€</text>

      {/* Small gear accent — bottom-right area */}
      <path d={gearPath(cx + cr * 0.68, cy + cr * 0.60, r * 0.14, 8)}
        fill="none" stroke={N} strokeWidth="1.5" opacity="0.12" />
      {ring(cx + cr * 0.68, cy + cr * 0.60, r * 0.06, 0.10, 1)}
    </>
  );
}

// ─── CIRCUIT — Circuit board grid with IC chip ─────────────────────────────────

function CircuitIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const step = r * 0.16;
  const traces: [number, number, number, number][] = [];
  const vias: [number, number][] = [];

  for (let row = -4; row <= 4; row++) {
    const y = cy + row * step;
    const startX = cx - r * 0.82 + Math.abs(row) * step * 0.28;
    const endX = cx + r * 0.82 - Math.abs(row) * step * 0.28;
    if (row % 2 === 0) {
      traces.push([startX, y, endX, y]);
      vias.push([startX, y], [endX, y]);
    }
  }
  for (let col = -4; col <= 4; col++) {
    const x = cx + col * step;
    if (col % 2 !== 0) {
      const startY = cy - r * 0.52 + Math.abs(col) * step * 0.18;
      const endY = cy + r * 0.52 - Math.abs(col) * step * 0.18;
      traces.push([x, startY, x, endY]);
      vias.push([x, startY], [x, endY]);
    }
  }

  return (
    <>
      {traces.map(([x1, y1, x2, y2], i) => (
        <line key={`t${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={N} strokeWidth={i < 5 ? 1.5 : 0.8} opacity={0.06 + (i % 3) * 0.01} />
      ))}
      {vias.map(([vx, vy], i) => (
        <g key={`v${i}`}>
          <circle cx={vx} cy={vy} r={2.5} fill="none" stroke={N} strokeWidth="1" opacity="0.20" />
          <circle cx={vx} cy={vy} r={1} fill={N} opacity="0.20" />
        </g>
      ))}
      <rect x={cx - r * 0.18} y={cy - r * 0.12} width={r * 0.36} height={r * 0.24}
        rx={3} fill="none" stroke={N} strokeWidth="1.8" opacity="0.25" />
      {Array.from({ length: 6 }, (_, i) => {
        const px = cx - r * 0.15 + i * r * 0.06;
        return (
          <g key={`p${i}`}>
            {ln(px, cy - r * 0.12, px, cy - r * 0.20, 0.07, 1)}
            {ln(px, cy + r * 0.12, px, cy + r * 0.20, 0.07, 1)}
          </g>
        );
      })}
      {dot(cx - r * 0.12, cy - r * 0.06, 2.5, 0.10)}
      <rect x={cx + r * 0.35} y={cy - r * 0.35} width={r * 0.20} height={r * 0.15}
        rx={2} fill="none" stroke={N} strokeWidth="1.2" opacity="0.18" />
      {ln(cx - r * 0.60, cy + r * 0.40, cx - r * 0.60, cy + r * 0.50, 0.06, 1.5)}
      {ln(cx - r * 0.68, cy + r * 0.50, cx - r * 0.52, cy + r * 0.50, 0.06, 1.5)}
      {ln(cx - r * 0.64, cy + r * 0.54, cx - r * 0.56, cy + r * 0.54, 0.05, 1)}
      {ln(cx - r * 0.62, cy + r * 0.57, cx - r * 0.58, cy + r * 0.57, 0.04, 0.8)}
    </>
  );
}

// ─── TARGET ───────────────────────────────────────────────────────────────────

function TargetIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      {[0.90, 0.68, 0.46, 0.24].map((s, i) => (
        <g key={`r${i}`}>
          {ring(cx, cy, r * s, i === 0 ? 0.07 : 0.09, i === 0 ? 1.2 : 1.8)}
          {i < 2 && tickMarks(cx, cy, r * s - 3, r * s + 3, i === 0 ? 72 : 36, 0.04)}
        </g>
      ))}
      {dot(cx, cy, r * 0.08, 0.14)}
      {ln(cx - r, cy, cx - r * 0.28, cy, 0.07, 1)}
      {ln(cx + r * 0.28, cy, cx + r, cy, 0.07, 1)}
      {ln(cx, cy - r, cx, cy - r * 0.28, 0.07, 1)}
      {ln(cx, cy + r * 0.28, cx, cy + r, 0.07, 1)}
      {arc(cx, cy, r * 0.82, -15, 45, 0.10, 2.5)}
      {arc(cx, cy, r * 0.55, 160, 230, 0.07, 2)}
      {dot(cx + r * 0.35, cy - r * 0.20, 3, 0.15)}
      {dot(cx - r * 0.15, cy + r * 0.40, 2.5, 0.12)}
      <rect x={cx + r * 0.60} y={cy - r * 0.85} width={r * 0.28} height={r * 0.08}
        rx={2} fill="none" stroke={N} strokeWidth="0.7" opacity="0.14" />
      <path d={`M ${cx + r * 0.65} ${cy - r * 0.65} L ${cx + r * 0.25} ${cy - r * 0.25}`}
        fill="none" stroke={N} strokeWidth="1.5" opacity="0.22" />
      <path d={`M ${cx + r * 0.35} ${cy - r * 0.35} L ${cx + r * 0.25} ${cy - r * 0.25} L ${cx + r * 0.35} ${cy - r * 0.25}`}
        fill="none" stroke={N} strokeWidth="1.5" opacity="0.22" />
    </>
  );
}

// ─── Remaining illustration types ─────────────────────────────────────────────

function SimpleIllustration({ cx, cy, r, type }: { cx: number; cy: number; r: number; type: string }) {
  switch (type) {
    case "puzzle":
      return (
        <>
          <rect x={cx - r * 0.40} y={cy - r * 0.40} width={r * 0.35} height={r * 0.35} rx={4}
            fill="none" stroke={N} strokeWidth="2" opacity="0.20" />
          <rect x={cx + r * 0.05} y={cy - r * 0.40} width={r * 0.35} height={r * 0.35} rx={4}
            fill="none" stroke={N} strokeWidth="2" opacity="0.20" />
          <rect x={cx - r * 0.40} y={cy + r * 0.05} width={r * 0.35} height={r * 0.35} rx={4}
            fill="none" stroke={N} strokeWidth="2" opacity="0.20" />
          <rect x={cx + r * 0.05} y={cy + r * 0.05} width={r * 0.35} height={r * 0.35} rx={4}
            fill="none" stroke={N} strokeWidth="2" opacity="0.20" />
          {arc(cx + r * 0.025, cy - r * 0.22, r * 0.06, 0, 180, 0.08, 1.5)}
          {arc(cx + r * 0.025, cy + r * 0.22, r * 0.06, 180, 360, 0.08, 1.5)}
          {arc(cx - r * 0.22, cy + r * 0.025, r * 0.06, 270, 90, 0.08, 1.5)}
          {arc(cx + r * 0.22, cy + r * 0.025, r * 0.06, 90, 270, 0.08, 1.5)}
        </>
      );

    case "cloud":
      return (
        <>
          <path d={`M ${cx - r * 0.52} ${cy + r * 0.05} A ${r * 0.32} ${r * 0.32} 0 1 1 ${cx - r * 0.12} ${cy - r * 0.38} A ${r * 0.26} ${r * 0.26} 0 1 1 ${cx + r * 0.28} ${cy - r * 0.32} A ${r * 0.36} ${r * 0.36} 0 1 1 ${cx + r * 0.58} ${cy + r * 0.05} Z`}
            fill="none" stroke={N} strokeWidth="2.5" opacity="0.18" />
          <path d={`M ${cx - r * 0.10} ${cy + r * 0.32} L ${cx - r * 0.10} ${cy + r * 0.10} L ${cx - r * 0.20} ${cy + r * 0.10} L ${cx} ${cy - r * 0.06} L ${cx + r * 0.20} ${cy + r * 0.10} L ${cx + r * 0.10} ${cy + r * 0.10} L ${cx + r * 0.10} ${cy + r * 0.32}`}
            fill="none" stroke={N} strokeWidth="1.5" opacity="0.18" />
        </>
      );

    case "rocket":
      return (
        <>
          <path d={`M ${cx} ${cy - r * 0.68} Q ${cx + r * 0.16} ${cy - r * 0.40} ${cx + r * 0.16} ${cy + r * 0.10} L ${cx + r * 0.26} ${cy + r * 0.32} L ${cx - r * 0.26} ${cy + r * 0.32} L ${cx - r * 0.16} ${cy + r * 0.10} Q ${cx - r * 0.16} ${cy - r * 0.40} ${cx} ${cy - r * 0.68}`}
            fill="none" stroke={N} strokeWidth="2.5" opacity="0.18" />
          {ring(cx, cy - r * 0.20, r * 0.09, 0.10, 1.5)}
          <path d={`M ${cx - r * 0.16} ${cy + r * 0.06} L ${cx - r * 0.32} ${cy + r * 0.36} L ${cx - r * 0.16} ${cy + r * 0.32}`}
            fill="none" stroke={N} strokeWidth="1.5" opacity="0.18" />
          <path d={`M ${cx + r * 0.16} ${cy + r * 0.06} L ${cx + r * 0.32} ${cy + r * 0.36} L ${cx + r * 0.16} ${cy + r * 0.32}`}
            fill="none" stroke={N} strokeWidth="1.5" opacity="0.18" />
          {arc(cx, cy + r * 0.36, r * 0.09, 0, 180, 0.10, 1.5)}
          {arc(cx, cy + r * 0.44, r * 0.13, 10, 170, 0.06, 1)}
          {[[-0.5, -0.5], [0.5, -0.5], [0.6, 0.1], [-0.6, 0.3], [0.3, -0.72]].map(([ox, oy], i) => (
            <g key={`s${i}`}>
              {ln(cx + ox * r - 4, cy + oy * r, cx + ox * r + 4, cy + oy * r, 0.07, 0.8)}
              {ln(cx + ox * r, cy + oy * r - 4, cx + ox * r, cy + oy * r + 4, 0.07, 0.8)}
            </g>
          ))}
        </>
      );

    case "globe":
      return (
        <>
          {ring(cx, cy, r * 0.72, 0.10, 2.5)}
          {[-0.40, -0.15, 0.15, 0.40].map((f, i) => (
            <ellipse key={`lat${i}`} cx={cx} cy={cy + r * f}
              rx={r * 0.72 * Math.cos(Math.asin(Math.min(Math.abs(f / 0.72), 1)))}
              ry={r * 0.065}
              fill="none" stroke={N} strokeWidth="1" opacity="0.14" />
          ))}
          {[0, 45, 90, 135].map((deg, i) => (
            <ellipse key={`lon${i}`} cx={cx} cy={cy}
              rx={r * 0.72 * Math.abs(Math.cos(deg * Math.PI / 180)) || r * 0.04}
              ry={r * 0.72}
              fill="none" stroke={N} strokeWidth="0.8" opacity="0.12" />
          ))}
          {[[0.30, -0.25], [-0.25, 0.15], [0.10, -0.45], [-0.35, -0.28], [0.40, 0.20]].map(([ox, oy], i) => (
            <g key={`city${i}`}>
              {dot(cx + ox * r, cy + oy * r, 3, 0.12)}
              {ring(cx + ox * r, cy + oy * r, 6, 0.06, 0.6)}
            </g>
          ))}
          <ellipse cx={cx} cy={cy} rx={r * 0.92} ry={r * 0.26}
            fill="none" stroke={N} strokeWidth="1" opacity="0.22"
            transform={`rotate(-20 ${cx} ${cy})`} />
        </>
      );

    case "infinity":
      return (
        <>
          {Array.from({ length: 60 }, (_, i) => {
            const t = (i / 60) * Math.PI * 2;
            const scale = r * 0.56;
            const x = cx + (scale * Math.cos(t)) / (1 + Math.sin(t) ** 2);
            const y = cy + (scale * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2);
            return <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.5 : 1.5}
              fill={N} opacity={0.06 + (i % 5) * 0.01} />;
          })}
          <path d={gearPath(cx, cy, r * 0.13, 8)} fill="none" stroke={N} strokeWidth="1.5" opacity="0.20" />
          {dot(cx, cy, 3, 0.12)}
          {[30, 150, 210, 330].map((deg, i) => {
            const t = (deg / 360) * Math.PI * 2;
            const scale = r * 0.56;
            const x = cx + (scale * Math.cos(t)) / (1 + Math.sin(t) ** 2);
            const y = cy + (scale * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2);
            return <circle key={`a${i}`} cx={x} cy={y} r={4} fill={N} opacity="0.28" />;
          })}
        </>
      );

    case "dna":
      return (
        <>
          {Array.from({ length: 30 }, (_, i) => {
            const t = (i / 30) * Math.PI * 3;
            const y = cy - r * 0.72 + (i / 30) * r * 1.44;
            const x1 = cx + Math.cos(t) * r * 0.26;
            const x2 = cx - Math.cos(t) * r * 0.26;
            return (
              <g key={i}>
                {dot(x1, y, 2.5, 0.09)}
                {dot(x2, y, 2.5, 0.09)}
                {i % 3 === 0 && <line x1={x1} y1={y} x2={x2} y2={y}
                  stroke={N} strokeWidth="1" opacity="0.14" />}
              </g>
            );
          })}
          <path d={Array.from({ length: 30 }, (_, i) => {
            const t = (i / 30) * Math.PI * 3;
            const y = cy - r * 0.72 + (i / 30) * r * 1.44;
            return `${i === 0 ? "M" : "L"} ${cx + Math.cos(t) * r * 0.26} ${y}`;
          }).join(" ")} fill="none" stroke={N} strokeWidth="1.2" opacity="0.18" />
          <path d={Array.from({ length: 30 }, (_, i) => {
            const t = (i / 30) * Math.PI * 3;
            const y = cy - r * 0.72 + (i / 30) * r * 1.44;
            return `${i === 0 ? "M" : "L"} ${cx - Math.cos(t) * r * 0.26} ${y}`;
          }).join(" ")} fill="none" stroke={N} strokeWidth="1.2" opacity="0.18" />
        </>
      );

    case "matrix":
      return (
        <>
          {Array.from({ length: 8 }, (_, col) =>
            Array.from({ length: 12 }, (_, row) => {
              const x = cx - r * 0.60 + col * r * 0.18;
              const y = cy - r * 0.72 + row * r * 0.13;
              const fade = Math.max(0, 1 - row / 12);
              return <rect key={`${col}-${row}`} x={x} y={y} width={r * 0.06} height={r * 0.06} rx={1}
                fill={N} opacity={0.02 + fade * 0.04} />;
            })
          )}
          {ln(cx - r * 0.72, cy - r * 0.10, cx + r * 0.72, cy - r * 0.10, 0.08, 1)}
          <rect x={cx - r * 0.06} y={cy - r * 0.75} width={r * 0.12} height={r * 1.50}
            fill={N} opacity="0.02" />
        </>
      );

    case "wave":
      return (
        <>
          <rect x={cx - r * 0.82} y={cy - r * 0.52} width={r * 1.64} height={r * 1.04} rx={4}
            fill="none" stroke={N} strokeWidth="2" opacity="0.16" />
          {Array.from({ length: 9 }, (_, i) =>
            ln(cx - r * 0.82, cy - r * 0.52 + i * r * 0.13, cx + r * 0.82, cy - r * 0.52 + i * r * 0.13, 0.025, 0.5)
          )}
          <polyline points={Array.from({ length: 80 }, (_, i) => {
            const x = cx - r * 0.76 + (i / 80) * r * 1.52;
            const y = cy + Math.sin((i / 80) * Math.PI * 4) * r * 0.30;
            return `${x},${y}`;
          }).join(" ")} fill="none" stroke={N} strokeWidth="2.5" opacity="0.22" />
          {Array.from({ length: 14 }, (_, i) => {
            const x = cx - r * 0.76 + i * r * 0.115;
            const h = r * (0.05 + Math.abs(Math.sin(i * 0.8)) * 0.14);
            return <rect key={`sp${i}`} x={x} y={cy + r * 0.56} width={r * 0.07} height={h}
              fill={N} opacity="0.13" rx={1} />;
          })}
        </>
      );

    case "calendar":
      return (
        <>
          <rect x={cx - r * 0.58} y={cy - r * 0.58} width={r * 1.16} height={r * 1.16} rx={6}
            fill="none" stroke={N} strokeWidth="2" opacity="0.20" />
          <rect x={cx - r * 0.58} y={cy - r * 0.58} width={r * 1.16} height={r * 0.20} rx={6}
            fill={N} opacity="0.03" />
          {Array.from({ length: 5 }, (_, i) =>
            ln(cx - r * 0.58, cy - r * 0.38 + i * r * 0.19, cx + r * 0.58, cy - r * 0.38 + i * r * 0.19, 0.04, 0.5)
          )}
          {Array.from({ length: 6 }, (_, i) =>
            ln(cx - r * 0.58 + (i + 1) * r * 0.166, cy - r * 0.38, cx - r * 0.58 + (i + 1) * r * 0.166, cy + r * 0.58, 0.03, 0.5)
          )}
          {[[1, 0], [3, 1], [5, 1], [2, 2], [4, 3]].map(([col, row], i) => {
            const x = cx - r * 0.50 + col * r * 0.166;
            const y = cy - r * 0.28 + row * r * 0.19;
            return <path key={`ch${i}`} d={`M ${x} ${y + 4} L ${x + 4} ${y + 8} L ${x + 10} ${y}`}
              fill="none" stroke={N} strokeWidth="1.2" opacity="0.20" />;
          })}
        </>
      );

    case "magnet":
      return (
        <>
          {arc(cx, cy - r * 0.10, r * 0.36, 180, 360, 0.12, 3)}
          {ln(cx - r * 0.36, cy - r * 0.10, cx - r * 0.36, cy + r * 0.32, 0.12, 3)}
          {ln(cx + r * 0.36, cy - r * 0.10, cx + r * 0.36, cy + r * 0.32, 0.12, 3)}
          <rect x={cx - r * 0.44} y={cy + r * 0.26} width={r * 0.16} height={r * 0.09}
            fill={N} opacity="0.16" />
          <rect x={cx + r * 0.28} y={cy + r * 0.26} width={r * 0.16} height={r * 0.09}
            fill={N} opacity="0.16" />
          {[0.52, 0.66, 0.82].map((s, i) => (
            arc(cx, cy + r * 0.36, r * s, 200, 340, 0.05 - i * 0.01, 1)
          ))}
          {[[0, 0.56], [-0.14, 0.50], [0.14, 0.50], [-0.07, 0.64], [0.07, 0.64]].map(([ox, oy], i) => (
            <circle key={`p${i}`} cx={cx + ox * r} cy={cy + oy * r}
              r={2.5 - i * 0.3} fill={N} opacity={0.10 - i * 0.01} />
          ))}
        </>
      );

    case "handshake":
      return (
        <>
          <path d={`M ${cx - r * 0.65} ${cy + r * 0.12} Q ${cx - r * 0.32} ${cy - r * 0.10} ${cx - r * 0.06} ${cy}`}
            fill="none" stroke={N} strokeWidth="2.5" opacity="0.20" />
          <path d={`M ${cx + r * 0.65} ${cy + r * 0.12} Q ${cx + r * 0.32} ${cy - r * 0.10} ${cx + r * 0.06} ${cy}`}
            fill="none" stroke={N} strokeWidth="2.5" opacity="0.20" />
          {[-0.08, 0, 0.08].map((oy, i) => (
            <line key={`e${i}`} x1={cx - r * 0.06} y1={cy + oy * r} x2={cx + r * 0.06} y2={cy + oy * r}
              stroke={N} strokeWidth="1.5" opacity="0.28" />
          ))}
          {ring(cx, cy, r * 0.16, 0.07, 1)}
          {ring(cx, cy, r * 0.28, 0.04, 0.8)}
          {[[-0.72, -0.28], [0.72, -0.28], [-0.50, 0.52], [0.50, 0.52], [0, -0.52]].map(([ox, oy], i) => (
            <g key={`n${i}`}>
              {ring(cx + ox * r, cy + oy * r, 5, 0.06, 0.8)}
              {dot(cx + ox * r, cy + oy * r, 2, 0.07)}
              {ln(cx + ox * r, cy + oy * r, cx, cy, 0.02, 0.5, "3 6")}
            </g>
          ))}
        </>
      );

    default:
      return <>{ring(cx, cy, r * 0.5, 0.07)}</>;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function BgIllustration({ type, width, height, scale = 1, offsetX = 0, offsetY = 0 }: BgIllustrationProps) {
  const cx = width / 2 + offsetX;
  const cy = height / 2 + offsetY;
  const r = Math.min(width, height) * 0.38 * scale;

  const props = { cx, cy, r };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {type === "gear"      && <GearIllustration {...props} />}
        {type === "brain"     && <BrainIllustration {...props} />}
        {type === "chart"     && <ChartIllustration {...props} />}
        {type === "nodes"     && <NodesIllustration {...props} />}
        {type === "shield"    && <ShieldIllustration {...props} />}
        {type === "flow"      && <FlowIllustration {...props} />}
        {type === "lightbulb" && <LightbulbIllustration {...props} />}
        {type === "circuit"   && <CircuitIllustration {...props} />}
        {type === "target"    && <TargetIllustration {...props} />}
        {!["gear", "brain", "chart", "nodes", "shield", "flow", "lightbulb", "circuit", "target"].includes(type) && (
          <SimpleIllustration {...props} type={type} />
        )}
      </svg>
    </div>
  );
}
