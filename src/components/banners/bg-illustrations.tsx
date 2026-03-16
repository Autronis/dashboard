import type { BannerIllustration } from "@/types/content";

interface BgIllustrationProps {
  type: BannerIllustration;
  width: number;
  height: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

const N = "#2DD4A8"; // neon color

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

function gearPath(x: number, y: number, r: number, teeth: number): string {
  const outer = r;
  const inner = r * 0.78;
  const tip = r * 1.12;
  const tw = Math.PI / teeth * 0.45;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const base = (i / teeth) * Math.PI * 2 - Math.PI / 2;
    const p = (n: number, rad: number) => `${x + Math.cos(n) * rad} ${y + Math.sin(n) * rad}`;
    if (i === 0) d += `M ${p(base - tw, inner)} `;
    d += `L ${p(base - tw * 0.6, tip)} L ${p(base + tw * 0.6, tip)} L ${p(base + tw, inner)} `;
    const next = ((i + 1) / teeth) * Math.PI * 2 - Math.PI / 2;
    d += `A ${inner} ${inner} 0 0 1 ${p(next - tw, inner)} `;
  }
  d += "Z";
  return d;
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

// ─── GEAR (Mechanisme) — Like the reference: single large smooth gear ────────

function smoothGearPath(x: number, y: number, outerR: number, innerR: number, teeth: number): string {
  // Creates a smooth gear with rounded teeth (not sharp/angular)
  const points: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const aBase = (i / teeth) * Math.PI * 2 - Math.PI / 2;
    const aNext = ((i + 1) / teeth) * Math.PI * 2 - Math.PI / 2;
    const toothWidth = (Math.PI * 2) / teeth;
    // Tooth tip (outer)
    const a1 = aBase + toothWidth * 0.15;
    const a2 = aBase + toothWidth * 0.35;
    // Valley (inner)
    const a3 = aBase + toothWidth * 0.65;
    const a4 = aBase + toothWidth * 0.85;

    if (i === 0) {
      points.push(`M ${x + Math.cos(a1) * innerR} ${y + Math.sin(a1) * innerR}`);
    }
    // Rise to tooth tip
    points.push(`Q ${x + Math.cos(a1) * outerR} ${y + Math.sin(a1) * outerR} ${x + Math.cos((a1 + a2) / 2) * outerR} ${y + Math.sin((a1 + a2) / 2) * outerR}`);
    // Tooth tip arc
    points.push(`Q ${x + Math.cos(a2) * outerR} ${y + Math.sin(a2) * outerR} ${x + Math.cos(a3) * innerR} ${y + Math.sin(a3) * innerR}`);
    // Valley
    points.push(`Q ${x + Math.cos((a3 + a4) / 2) * (innerR * 0.97)} ${y + Math.sin((a3 + a4) / 2) * (innerR * 0.97)} ${x + Math.cos(a4) * innerR} ${y + Math.sin(a4) * innerR}`);
  }
  points.push("Z");
  return points.join(" ");
}

function GearIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const gr = r * 0.95;
  const outerR = gr;
  const innerR = gr * 0.82;

  return (
    <>
      {/* Main gear — smooth rounded teeth */}
      <path d={smoothGearPath(cx, cy, outerR, innerR, 12)}
        fill="none" stroke={N} strokeWidth="2.5" opacity="0.2" />

      {/* Concentric inner rings — like the reference with distinct spacing */}
      {ring(cx, cy, gr * 0.72, 0.16, 2)}
      {ring(cx, cy, gr * 0.62, 0.12, 1.5)}
      {ring(cx, cy, gr * 0.42, 0.14, 1.8)}
      {ring(cx, cy, gr * 0.32, 0.12, 1.2)}

      {/* Center hub — filled circle */}
      {ring(cx, cy, gr * 0.2, 0.2, 2.5)}
      <circle cx={cx} cy={cy} r={gr * 0.2} fill={N} opacity="0.04" />
      {ring(cx, cy, gr * 0.12, 0.15, 1.5)}
      {dot(cx, cy, gr * 0.04, 0.25)}

      {/* 6 thick spokes connecting hub to mid ring — like reference */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const cos = Math.cos(a), sin = Math.sin(a);
        const halfW = gr * 0.03; // spoke half-width
        // Draw spoke as a thin rectangle path
        const perpCos = Math.cos(a + Math.PI / 2) * halfW;
        const perpSin = Math.sin(a + Math.PI / 2) * halfW;
        const x1i = cx + cos * gr * 0.22, y1i = cy + sin * gr * 0.22;
        const x2o = cx + cos * gr * 0.6, y2o = cy + sin * gr * 0.6;
        return <path key={`spoke${i}`}
          d={`M ${x1i + perpCos} ${y1i + perpSin} L ${x2o + perpCos} ${y2o + perpSin} L ${x2o - perpCos} ${y2o - perpSin} L ${x1i - perpCos} ${y1i - perpSin} Z`}
          fill={N} opacity="0.06" stroke={N} strokeWidth="1" />;
      })}

      {/* Cutout holes in the gear body (between spokes) — like reference */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        const hx = cx + Math.cos(a) * gr * 0.48;
        const hy = cy + Math.sin(a) * gr * 0.48;
        return <g key={`hole${i}`}>
          {ring(hx, hy, gr * 0.08, 0.1, 1.2)}
          <circle cx={hx} cy={hy} r={gr * 0.08} fill="#0B1A1F" opacity="0.5" />
        </g>;
      })}

      {/* Subtle tick marks on outermost ring */}
      {tickMarks(cx, cy, gr * 0.74, gr * 0.78, 48, 0.06)}
    </>
  );
}

// ─── BRAIN (Neuraal Netwerk) — Large brain with circuit board patterns inside ─

function BrainIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const br = r * 0.9; // brain radius - fills most of canvas
  // Dense circuit traces inside the brain shape (like reference)
  const traces: [number, number, number, number][] = [
    // Left hemisphere horizontal traces
    [-0.7, -0.4, -0.15, -0.4], [-0.65, -0.15, -0.1, -0.15], [-0.6, 0.1, -0.1, 0.1],
    [-0.55, 0.35, -0.15, 0.35], [-0.5, -0.55, -0.2, -0.55],
    // Right hemisphere horizontal traces
    [0.15, -0.4, 0.7, -0.4], [0.1, -0.15, 0.65, -0.15], [0.1, 0.1, 0.6, 0.1],
    [0.15, 0.35, 0.55, 0.35], [0.2, -0.55, 0.5, -0.55],
    // Vertical connections left
    [-0.45, -0.55, -0.45, -0.15], [-0.3, -0.4, -0.3, 0.1], [-0.55, 0.1, -0.55, 0.35],
    [-0.15, -0.55, -0.15, 0.35],
    // Vertical connections right
    [0.45, -0.55, 0.45, -0.15], [0.3, -0.4, 0.3, 0.1], [0.55, 0.1, 0.55, 0.35],
    [0.15, -0.4, 0.15, 0.35],
    // Cross-hemisphere connections
    [-0.1, -0.25, 0.1, -0.25], [-0.1, 0, 0.1, 0], [-0.1, 0.2, 0.1, 0.2],
    // Diagonal branches
    [-0.45, -0.15, -0.3, 0.1], [0.45, -0.15, 0.3, 0.1],
    [-0.65, -0.15, -0.55, 0.1], [0.65, -0.15, 0.55, 0.1],
  ];
  // Nodes at circuit junctions
  const nodes: [number, number, number][] = [
    [-0.45, -0.55, 3], [-0.45, -0.4, 4], [-0.45, -0.15, 4.5], [-0.3, -0.4, 3.5],
    [-0.3, 0.1, 4], [-0.55, 0.1, 3], [-0.55, 0.35, 3], [-0.15, -0.55, 3.5],
    [-0.15, -0.4, 5], [-0.15, -0.15, 4], [-0.15, 0.1, 4.5], [-0.15, 0.35, 3.5],
    [0.45, -0.55, 3], [0.45, -0.4, 4], [0.45, -0.15, 4.5], [0.3, -0.4, 3.5],
    [0.3, 0.1, 4], [0.55, 0.1, 3], [0.55, 0.35, 3], [0.15, -0.4, 5],
    [0.15, -0.15, 4], [0.15, 0.1, 4.5], [0.15, 0.35, 3.5],
    [0, -0.25, 3], [0, 0, 3], [0, 0.2, 3],
  ];
  return (
    <>
      {/* Brain outline — two overlapping lobes */}
      <ellipse cx={cx - r * 0.22} cy={cy - r * 0.05} rx={br * 0.55} ry={br * 0.82} fill="none" stroke={N} strokeWidth="2.5" opacity="0.16" />
      <ellipse cx={cx + r * 0.22} cy={cy - r * 0.05} rx={br * 0.55} ry={br * 0.82} fill="none" stroke={N} strokeWidth="2.5" opacity="0.16" />
      {/* Brain stem */}
      <path d={`M ${cx - r * 0.08} ${cy + br * 0.7} Q ${cx} ${cy + br * 0.9} ${cx + r * 0.08} ${cy + br * 0.7}`}
        fill="none" stroke={N} strokeWidth="2" opacity="0.12" />
      {/* Center division — dashed vertical */}
      {ln(cx, cy - br * 0.75, cx, cy + br * 0.65, 0.08, 1, "6 4")}
      {/* Brain folds (sulci) — curved lines inside */}
      {arc(cx - r * 0.4, cy - r * 0.2, r * 0.35, -70, 50, 0.08, 1.2)}
      {arc(cx + r * 0.4, cy - r * 0.2, r * 0.35, 130, 250, 0.08, 1.2)}
      {arc(cx - r * 0.3, cy + r * 0.25, r * 0.28, 0, 140, 0.06, 1)}
      {arc(cx + r * 0.3, cy + r * 0.25, r * 0.28, 40, 180, 0.06, 1)}
      {arc(cx - r * 0.15, cy - r * 0.45, r * 0.2, -40, 80, 0.07, 1)}
      {arc(cx + r * 0.15, cy - r * 0.45, r * 0.2, 100, 220, 0.07, 1)}
      {/* Circuit traces inside brain (dense network) */}
      {traces.map(([x1, y1, x2, y2], i) => (
        <line key={`ct${i}`} x1={cx + x1 * br} y1={cy + y1 * br} x2={cx + x2 * br} y2={cy + y2 * br}
          stroke={N} strokeWidth="1" opacity="0.12" />
      ))}
      {/* Circuit nodes at junctions */}
      {nodes.map(([nx, ny, nr], i) => (
        <g key={`cn${i}`}>
          <circle cx={cx + nx * br} cy={cy + ny * br} r={nr} fill={N} opacity="0.18" />
          {nr >= 4.5 && <circle cx={cx + nx * br} cy={cy + ny * br} r={nr * 2.2} fill="none" stroke={N} strokeWidth="0.6" opacity="0.1" />}
        </g>
      ))}
      {/* Bright pulse points (active synapses) */}
      {[[-0.15, -0.4], [0.15, -0.4], [-0.15, 0.1], [0.15, 0.1], [0, 0], [-0.45, -0.15], [0.45, -0.15]].map(([px, py], i) => (
        <circle key={`pulse${i}`} cx={cx + px * br} cy={cy + py * br} r={5} fill={N} opacity="0.06" />
      ))}
    </>
  );
}

// ─── SHIELD (Beveiliging) ──────────────────────────────────────────────────────

function ShieldIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const sw = r * 0.7, sh = r * 0.9;
  const shieldPath = `M ${cx} ${cy - sh} Q ${cx + sw} ${cy - sh * 0.6} ${cx + sw} ${cy} Q ${cx + sw * 0.6} ${cy + sh * 0.7} ${cx} ${cy + sh} Q ${cx - sw * 0.6} ${cy + sh * 0.7} ${cx - sw} ${cy} Q ${cx - sw} ${cy - sh * 0.6} ${cx} ${cy - sh} Z`;
  return (
    <>
      {/* Outer shield */}
      <path d={shieldPath} fill="none" stroke={N} strokeWidth="2.5" opacity="0.25" />
      {/* Inner shield layer */}
      {(() => { const s2 = 0.82; const w2 = sw * s2, h2 = sh * s2;
        return <path d={`M ${cx} ${cy - h2} Q ${cx + w2} ${cy - h2 * 0.6} ${cx + w2} ${cy} Q ${cx + w2 * 0.6} ${cy + h2 * 0.7} ${cx} ${cy + h2} Q ${cx - w2 * 0.6} ${cy + h2 * 0.7} ${cx - w2} ${cy} Q ${cx - w2} ${cy - h2 * 0.6} ${cx} ${cy - h2} Z`} fill="none" stroke={N} strokeWidth="1" opacity="0.16" />;
      })()}
      {/* Lock icon inside */}
      {/* Lock body */}
      <rect x={cx - r * 0.15} y={cy - r * 0.05} width={r * 0.3} height={r * 0.25} rx={r * 0.03} fill="none" stroke={N} strokeWidth="2" opacity="0.28" />
      {/* Lock shackle */}
      {arc(cx, cy - r * 0.05, r * 0.1, 180, 360, 0.12, 2)}
      {/* Keyhole */}
      {dot(cx, cy + r * 0.05, r * 0.03, 0.12)}
      {ln(cx, cy + r * 0.05, cx, cy + r * 0.13, 0.1, 1.5)}
      {/* Hex pattern overlay */}
      {hexGrid(cx, cy, r * 0.85, r * 0.12, 0.03)}
      {/* Shield detail lines */}
      {ln(cx - sw * 0.5, cy - sh * 0.3, cx + sw * 0.5, cy - sh * 0.3, 0.04, 0.7, "3 6")}
      {ln(cx - sw * 0.4, cy + sh * 0.3, cx + sw * 0.4, cy + sh * 0.3, 0.04, 0.7, "3 6")}
      {/* Corner accent marks */}
      {[[-0.5, -0.5], [0.5, -0.5], [-0.4, 0.5], [0.4, 0.5]].map(([ox, oy], i) => (
        <g key={`c${i}`}>
          {dot(cx + ox * r, cy + oy * r, 2, 0.06)}
        </g>
      ))}
      {/* Checkmark at top */}
      <path d={`M ${cx - r * 0.06} ${cy - sh * 0.55} L ${cx - r * 0.02} ${cy - sh * 0.5} L ${cx + r * 0.06} ${cy - sh * 0.62}`} fill="none" stroke={N} strokeWidth="1.5" opacity="0.20" />
    </>
  );
}

// ─── NODES (Verbonden Netwerk) ─────────────────────────────────────────────────

function NodesIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts: [number, number, number][] = [
    [0, 0, 12], [-0.6, -0.4, 8], [0.5, -0.5, 9], [0.7, 0.2, 7],
    [-0.7, 0.3, 7], [0, -0.75, 6], [0.2, 0.6, 8], [-0.4, 0.65, 6],
    [-0.85, -0.1, 5], [0.85, -0.25, 5], [-0.3, -0.6, 5], [0.6, 0.55, 5],
    [-0.15, 0.35, 6], [0.35, -0.2, 7], [-0.45, -0.05, 6], [0.15, -0.35, 5],
  ];
  const edges: [number, number][] = [
    [0,1],[0,2],[0,3],[0,4],[0,6],[0,13],[0,14],[1,10],[1,8],[1,14],[2,5],[2,9],[2,15],
    [3,9],[3,11],[3,13],[4,8],[4,7],[4,12],[5,10],[5,15],[6,7],[6,11],[6,12],
    [7,4],[10,15],[13,15],[12,14],[11,9],
  ];
  return (
    <>
      {/* Background subtle grid */}
      {Array.from({ length: 7 }, (_, i) => {
        const y = cy + (i - 3) * r * 0.3;
        return <line key={`g${i}`} x1={cx - r} y1={y} x2={cx + r} y2={y} stroke={N} strokeWidth="0.3" opacity="0.02" />;
      })}
      {/* Connections */}
      {edges.map(([a, b], i) => {
        const [ax, ay] = pts[a], [bx, by] = pts[b];
        return <line key={`e${i}`} x1={cx + ax * r} y1={cy + ay * r} x2={cx + bx * r} y2={cy + by * r}
          stroke={N} strokeWidth={a === 0 || b === 0 ? 1.2 : 0.8} opacity={a === 0 || b === 0 ? 0.07 : 0.05}
          strokeDasharray={i % 3 === 0 ? "4 4" : undefined} />;
      })}
      {/* Nodes */}
      {pts.map(([nx, ny, nr], i) => (
        <g key={`n${i}`}>
          <circle cx={cx + nx * r} cy={cy + ny * r} r={nr} fill="none" stroke={N} strokeWidth={i === 0 ? 2 : 1.2} opacity={i === 0 ? 0.12 : 0.08} />
          {i < 5 && <circle cx={cx + nx * r} cy={cy + ny * r} r={nr * 0.5} fill={N} opacity="0.16" />}
          <circle cx={cx + nx * r} cy={cy + ny * r} r={nr * 0.25} fill={N} opacity="0.25" />
        </g>
      ))}
      {/* Data flow dots on some edges */}
      {[[0.3, -0.25], [-0.3, -0.2], [0.1, 0.3], [-0.25, 0.15], [0.5, 0.1]].map(([dx, dy], i) => (
        <circle key={`fd${i}`} cx={cx + dx * r} cy={cy + dy * r} r={2} fill={N} opacity="0.30" />
      ))}
    </>
  );
}

// ─── CHART (Data Dashboard) — Tablet/screen frame with dashboard inside ──────

function ChartIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  // Outer tablet/screen frame
  const fw = r * 1.5, fh = r * 1.2;
  const fl = cx - fw / 2, ft = cy - fh / 2, fr = cx + fw / 2, fb = cy + fh / 2;
  // Inner content area
  const pad = r * 0.08;
  const il = fl + pad, it = ft + pad + r * 0.1, ir = fr - pad, ib = fb - pad;
  const iw = ir - il, ih = ib - it;

  return (
    <>
      {/* Screen/tablet frame */}
      <rect x={fl} y={ft} width={fw} height={fh} rx={r * 0.04} fill="none" stroke={N} strokeWidth="2.5" opacity="0.16" />
      {/* Top bar (like a browser/app bar) */}
      {ln(fl, ft + r * 0.1, fr, ft + r * 0.1, 0.12, 1.5)}
      {/* Top bar elements — menu icon + title lines */}
      <rect x={fl + pad} y={ft + pad * 0.4} width={r * 0.05} height={r * 0.003} rx={1} fill={N} opacity="0.15" />
      <rect x={fl + pad} y={ft + pad * 0.55} width={r * 0.05} height={r * 0.003} rx={1} fill={N} opacity="0.15" />
      <rect x={fl + pad} y={ft + pad * 0.7} width={r * 0.05} height={r * 0.003} rx={1} fill={N} opacity="0.15" />
      <rect x={fl + pad + r * 0.08} y={ft + pad * 0.4} width={r * 0.15} height={r * 0.005} rx={1} fill={N} opacity="0.12" />
      <rect x={fl + pad + r * 0.08} y={ft + pad * 0.65} width={r * 0.1} height={r * 0.004} rx={1} fill={N} opacity="0.08" />

      {/* Bar chart — 10 bars with varying heights */}
      {Array.from({ length: 10 }, (_, i) => {
        const bw = iw * 0.07;
        const gap = iw * 0.03;
        const bx = il + i * (bw + gap) + gap;
        const heights = [0.4, 0.6, 0.5, 0.75, 0.65, 0.85, 0.7, 0.9, 0.55, 0.8];
        const bh = ih * 0.55 * heights[i];
        const by = ib - bh;
        return <g key={`bar${i}`}>
          <rect x={bx} y={by} width={bw} height={bh} fill={N} opacity="0.06" rx={2} />
          <rect x={bx} y={by} width={bw} height={bh} fill="none" stroke={N} strokeWidth="1" opacity="0.15" rx={2} />
        </g>;
      })}

      {/* Line chart overlay on top of bars */}
      {(() => {
        const pts: [number, number][] = [
          [0, 0.6], [0.1, 0.45], [0.2, 0.5], [0.3, 0.3], [0.4, 0.38],
          [0.5, 0.2], [0.6, 0.32], [0.7, 0.15], [0.8, 0.42], [0.9, 0.22], [1, 0.1],
        ];
        const points = pts.map(([px, py]) => `${il + px * iw},${it + ih * 0.15 + py * ih * 0.6}`).join(" ");
        return <>
          <polyline points={points} fill="none" stroke={N} strokeWidth="2" opacity="0.2" strokeLinejoin="round" />
          {/* Area fill under line */}
          <path d={`M ${il},${ib} ${pts.map(([px, py]) => `L ${il + px * iw} ${it + ih * 0.15 + py * ih * 0.6}`).join(" ")} L ${ir},${ib} Z`}
            fill={N} opacity="0.03" />
          {/* Data points */}
          {pts.filter((_, i) => i % 2 === 0).map(([px, py], i) => {
            const x = il + px * iw, y = it + ih * 0.15 + py * ih * 0.6;
            return <g key={`dp${i}`}>{ring(x, y, 4, 0.12, 1.2)}{dot(x, y, 2, 0.15)}</g>;
          })}
        </>;
      })()}

      {/* Axis lines */}
      {ln(il, ib, ir, ib, 0.1, 1)}
      {ln(il, it + ih * 0.15, il, ib, 0.1, 1)}

      {/* Horizontal grid lines */}
      {Array.from({ length: 5 }, (_, i) => {
        const y = it + ih * 0.15 + i * ih * 0.17;
        return <line key={`hg${i}`} x1={il} y1={y} x2={ir} y2={y} stroke={N} strokeWidth="0.5" opacity="0.04" />;
      })}

      {/* Second smaller chart area (bottom-left of frame, like a mini widget) */}
      <rect x={il} y={ib - ih * 0.2} width={iw * 0.35} height={ih * 0.18} rx={3} fill="none" stroke={N} strokeWidth="0.8" opacity="0.08" />
      {/* Mini bars inside */}
      {Array.from({ length: 5 }, (_, i) => {
        const mx = il + r * 0.02 + i * iw * 0.06;
        const mh = ih * 0.08 * (0.4 + Math.sin(i * 1.5) * 0.3);
        return <rect key={`mb${i}`} x={mx} y={ib - ih * 0.04 - mh} width={iw * 0.04} height={mh} fill={N} opacity="0.08" rx={1} />;
      })}
    </>
  );
}

// ─── TARGET (Precisie Doel) ───────────────────────────────────────────────────

function TargetIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      {/* Concentric rings with tick marks */}
      {[0.9, 0.68, 0.46, 0.24].map((s, i) => (
        <g key={`r${i}`}>
          {ring(cx, cy, r * s, i === 0 ? 0.06 : 0.08, i === 0 ? 1 : 1.5)}
          {i < 2 && tickMarks(cx, cy, r * s - 3, r * s + 3, i === 0 ? 72 : 36, 0.04)}
        </g>
      ))}
      {dot(cx, cy, r * 0.08, 0.12)}
      {/* Crosshair */}
      {ln(cx - r, cy, cx - r * 0.28, cy, 0.06, 1)}{ln(cx + r * 0.28, cy, cx + r, cy, 0.06, 1)}
      {ln(cx, cy - r, cx, cy - r * 0.28, 0.06, 1)}{ln(cx, cy + r * 0.28, cx, cy + r, 0.06, 1)}
      {/* Scanning arc */}
      {arc(cx, cy, r * 0.82, -15, 45, 0.1, 2.5)}
      {arc(cx, cy, r * 0.55, 160, 230, 0.07, 2)}
      {/* Detection blips */}
      {dot(cx + r * 0.35, cy - r * 0.2, 3, 0.15)}{dot(cx - r * 0.15, cy + r * 0.4, 2.5, 0.12)}
      {dot(cx + r * 0.55, cy + r * 0.1, 2, 0.1)}{dot(cx - r * 0.4, cy - r * 0.35, 2, 0.1)}
      {/* Readout rectangles */}
      <rect x={cx + r * 0.6} y={cy - r * 0.85} width={r * 0.28} height={r * 0.08} rx={2} fill="none" stroke={N} strokeWidth="0.7" opacity="0.14" />
      <rect x={cx - r * 0.88} y={cy + r * 0.7} width={r * 0.25} height={r * 0.06} rx={2} fill="none" stroke={N} strokeWidth="0.7" opacity="0.14" />
      {/* Arrow pointing inward */}
      <path d={`M ${cx + r * 0.65} ${cy - r * 0.65} L ${cx + r * 0.25} ${cy - r * 0.25}`} fill="none" stroke={N} strokeWidth="1.5" opacity="0.22" />
      <path d={`M ${cx + r * 0.35} ${cy - r * 0.35} L ${cx + r * 0.25} ${cy - r * 0.25} L ${cx + r * 0.35} ${cy - r * 0.25}`} fill="none" stroke={N} strokeWidth="1.5" opacity="0.22" />
    </>
  );
}

// ─── FLOW (Procesflow) ────────────────────────────────────────────────────────

function FlowIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const box = (x: number, y: number, w: number, h: number, o: number) => (
    <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={4} fill="none" stroke={N} strokeWidth="1.5" opacity={o} />
  );
  const diamond = (x: number, y: number, s: number, o: number) => (
    <rect x={x - s / 2} y={y - s / 2} width={s} height={s} rx={3} fill="none" stroke={N} strokeWidth="1.5" opacity={o}
      transform={`rotate(45 ${x} ${y})`} />
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number, o: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={N} strokeWidth="1.2" opacity={o} markerEnd="url(#arrowhead)" />
  );
  return (
    <>
      <defs><marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
        <path d="M 0 0 L 6 2 L 0 4" fill="none" stroke={N} strokeWidth="1" opacity="0.25" />
      </marker></defs>
      {/* Start */}
      {ring(cx - r * 0.7, cy - r * 0.5, r * 0.08, 0.1, 1.5)}
      {dot(cx - r * 0.7, cy - r * 0.5, 3, 0.1)}
      {arrow(cx - r * 0.6, cy - r * 0.5, cx - r * 0.35, cy - r * 0.5, 0.08)}
      {/* Process boxes */}
      {box(cx - r * 0.2, cy - r * 0.5, r * 0.25, r * 0.12, 0.09)}
      {arrow(cx - r * 0.06, cy - r * 0.5, cx + r * 0.12, cy - r * 0.5, 0.08)}
      {/* Decision diamond */}
      {diamond(cx + r * 0.3, cy - r * 0.5, r * 0.12, 0.09)}
      {/* Branch down */}
      {arrow(cx + r * 0.3, cy - r * 0.38, cx + r * 0.3, cy - r * 0.1, 0.07)}
      {box(cx + r * 0.3, cy + r * 0.05, r * 0.25, r * 0.12, 0.08)}
      {/* Branch right */}
      {arrow(cx + r * 0.42, cy - r * 0.5, cx + r * 0.6, cy - r * 0.5, 0.07)}
      {box(cx + r * 0.75, cy - r * 0.5, r * 0.22, r * 0.12, 0.08)}
      {/* Continue down from right */}
      {arrow(cx + r * 0.75, cy - r * 0.38, cx + r * 0.75, cy + r * 0.05, 0.06)}
      {box(cx + r * 0.75, cy + r * 0.2, r * 0.22, r * 0.12, 0.07)}
      {/* Merge */}
      {arrow(cx + r * 0.3, cy + r * 0.12, cx + r * 0.3, cy + r * 0.35, 0.07)}
      {arrow(cx + r * 0.63, cy + r * 0.2, cx + r * 0.43, cy + r * 0.42, 0.06)}
      {/* End decision */}
      {diamond(cx + r * 0.3, cy + r * 0.5, r * 0.1, 0.08)}
      {/* Loop back */}
      {arc(cx - r * 0.4, cy, r * 0.55, 90, 270, 0.05, 1)}
      {/* End */}
      {arrow(cx + r * 0.3, cy + r * 0.58, cx + r * 0.3, cy + r * 0.75, 0.07)}
      {ring(cx + r * 0.3, cy + r * 0.82, r * 0.06, 0.09, 2)}{dot(cx + r * 0.3, cy + r * 0.82, 3, 0.09)}
      {/* Parallel lane indicator */}
      {ln(cx - r * 0.05, cy - r * 0.75, cx - r * 0.05, cy + r * 0.85, 0.03, 0.5, "2 8")}
    </>
  );
}

// ─── CIRCUIT (Circuit Board) ──────────────────────────────────────────────────

function CircuitIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const traces: [number, number, number, number][] = [];
  const vias: [number, number][] = [];
  // Generate grid-aligned circuit traces
  const step = r * 0.15;
  for (let row = -4; row <= 4; row++) {
    const y = cy + row * step;
    const startX = cx - r * 0.8 + Math.abs(row) * step * 0.3;
    const endX = cx + r * 0.8 - Math.abs(row) * step * 0.3;
    if (row % 2 === 0) {
      traces.push([startX, y, endX, y]);
      vias.push([startX, y], [endX, y]);
    }
  }
  for (let col = -4; col <= 4; col++) {
    const x = cx + col * step;
    if (col % 2 !== 0) {
      const startY = cy - r * 0.5 + Math.abs(col) * step * 0.2;
      const endY = cy + r * 0.5 - Math.abs(col) * step * 0.2;
      traces.push([x, startY, x, endY]);
      vias.push([x, startY], [x, endY]);
    }
  }
  return (
    <>
      {/* Traces */}
      {traces.map(([x1, y1, x2, y2], i) => (
        <line key={`t${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={N} strokeWidth={i < 5 ? 1.5 : 0.8} opacity={0.06 + (i % 3) * 0.01} />
      ))}
      {/* Via holes */}
      {vias.map(([vx, vy], i) => (
        <g key={`v${i}`}><circle cx={vx} cy={vy} r={2.5} fill="none" stroke={N} strokeWidth="1" opacity="0.20" />
        <circle cx={vx} cy={vy} r={1} fill={N} opacity="0.20" /></g>
      ))}
      {/* IC chip rectangles */}
      <rect x={cx - r * 0.18} y={cy - r * 0.12} width={r * 0.36} height={r * 0.24} rx={3} fill="none" stroke={N} strokeWidth="1.8" opacity="0.25" />
      {/* IC pins */}
      {Array.from({ length: 6 }, (_, i) => {
        const px = cx - r * 0.15 + i * r * 0.06;
        return <g key={`p${i}`}>
          {ln(px, cy - r * 0.12, px, cy - r * 0.2, 0.07, 1)}
          {ln(px, cy + r * 0.12, px, cy + r * 0.2, 0.07, 1)}
        </g>;
      })}
      {dot(cx - r * 0.12, cy - r * 0.06, 2.5, 0.1)}
      {/* Second smaller IC */}
      <rect x={cx + r * 0.35} y={cy - r * 0.35} width={r * 0.2} height={r * 0.15} rx={2} fill="none" stroke={N} strokeWidth="1.2" opacity="0.18" />
      {/* Ground symbol */}
      {ln(cx - r * 0.6, cy + r * 0.4, cx - r * 0.6, cy + r * 0.5, 0.06, 1.5)}
      {ln(cx - r * 0.68, cy + r * 0.5, cx - r * 0.52, cy + r * 0.5, 0.06, 1.5)}
      {ln(cx - r * 0.64, cy + r * 0.54, cx - r * 0.56, cy + r * 0.54, 0.05, 1)}
      {ln(cx - r * 0.62, cy + r * 0.57, cx - r * 0.58, cy + r * 0.57, 0.04, 0.8)}
    </>
  );
}

// ─── LIGHTBULB (Innovatie) ────────────────────────────────────────────────────

function LightbulbIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const bulbR = r * 0.42;
  return (
    <>
      {/* Main bulb */}
      {ring(cx, cy - r * 0.1, bulbR, 0.1, 2)}
      {/* Inner glow ring */}
      {ring(cx, cy - r * 0.1, bulbR * 0.7, 0.05, 1)}
      {/* Filament */}
      <path d={`M ${cx - r * 0.08} ${cy + r * 0.1} Q ${cx - r * 0.12} ${cy - r * 0.15} ${cx} ${cy - r * 0.3} Q ${cx + r * 0.12} ${cy - r * 0.15} ${cx + r * 0.08} ${cy + r * 0.1}`}
        fill="none" stroke={N} strokeWidth="1.5" opacity="0.22" />
      {/* Stem */}
      <rect x={cx - r * 0.1} y={cy + bulbR * 0.7} width={r * 0.2} height={r * 0.18} rx={r * 0.02} fill="none" stroke={N} strokeWidth="1.5" opacity="0.20" />
      {ln(cx - r * 0.08, cy + bulbR * 0.75, cx + r * 0.08, cy + bulbR * 0.75, 0.06, 1)}
      {ln(cx - r * 0.07, cy + bulbR * 0.82, cx + r * 0.07, cy + bulbR * 0.82, 0.06, 1)}
      {/* Glow rays */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const inner = bulbR + r * 0.06;
        const outer = bulbR + r * (0.12 + (i % 2) * 0.08);
        return <line key={`r${i}`} x1={cx + Math.cos(a) * inner} y1={(cy - r * 0.1) + Math.sin(a) * inner}
          x2={cx + Math.cos(a) * outer} y2={(cy - r * 0.1) + Math.sin(a) * outer}
          stroke={N} strokeWidth={i % 2 ? 1 : 1.5} opacity={i % 2 ? 0.05 : 0.07} />;
      })}
      {/* Orbiting idea bubbles */}
      {[45, 135, 225, 315, 0, 180].map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        const orbitR = bulbR + r * 0.28;
        const bx = cx + Math.cos(a) * orbitR;
        const by = (cy - r * 0.1) + Math.sin(a) * orbitR;
        return <g key={`b${i}`}>
          {ring(bx, by, r * 0.06, 0.06, 1)}{dot(bx, by, 2, 0.08)}
          {ln(cx + Math.cos(a) * (bulbR + r * 0.05), (cy - r * 0.1) + Math.sin(a) * (bulbR + r * 0.05), bx, by, 0.03, 0.5, "2 4")}
        </g>;
      })}
      {/* Sparkle crosses */}
      {[[0.5, -0.6], [-0.55, -0.5], [0.6, 0.2], [-0.6, 0.25]].map(([ox, oy], i) => (
        <g key={`sp${i}`}>
          {ln(cx + ox * r - 5, cy + oy * r, cx + ox * r + 5, cy + oy * r, 0.06, 0.8)}
          {ln(cx + ox * r, cy + oy * r - 5, cx + ox * r, cy + oy * r + 5, 0.06, 0.8)}
        </g>
      ))}
    </>
  );
}

// ─── Simple illustrations for remaining types ─────────────────────────────────

function SimpleIllustration({ cx, cy, r, type }: { cx: number; cy: number; r: number; type: string }) {
  switch (type) {
    case "puzzle":
      return (<>
        {/* 4 puzzle pieces interlocking */}
        <rect x={cx - r * 0.4} y={cy - r * 0.4} width={r * 0.35} height={r * 0.35} rx={4} fill="none" stroke={N} strokeWidth="1.5" opacity="0.20" />
        <rect x={cx + r * 0.05} y={cy - r * 0.4} width={r * 0.35} height={r * 0.35} rx={4} fill="none" stroke={N} strokeWidth="1.5" opacity="0.20" />
        <rect x={cx - r * 0.4} y={cy + r * 0.05} width={r * 0.35} height={r * 0.35} rx={4} fill="none" stroke={N} strokeWidth="1.5" opacity="0.20" />
        <rect x={cx + r * 0.05} y={cy + r * 0.05} width={r * 0.35} height={r * 0.35} rx={4} fill="none" stroke={N} strokeWidth="1.5" opacity="0.20" />
        {/* Connectors (tabs) */}
        {arc(cx + r * 0.025, cy - r * 0.22, r * 0.06, 0, 180, 0.07, 1.5)}
        {arc(cx + r * 0.025, cy + r * 0.22, r * 0.06, 180, 360, 0.07, 1.5)}
        {arc(cx - r * 0.22, cy + r * 0.025, r * 0.06, 270, 90, 0.07, 1.5)}
        {arc(cx + r * 0.22, cy + r * 0.025, r * 0.06, 90, 270, 0.07, 1.5)}
        {/* Floating piece */}
        <rect x={cx + r * 0.55} y={cy - r * 0.65} width={r * 0.25} height={r * 0.25} rx={3} fill="none" stroke={N} strokeWidth="1" opacity="0.14" transform={`rotate(15 ${cx + r * 0.675} ${cy - r * 0.525})`} />
        {ln(cx + r * 0.5, cy - r * 0.45, cx + r * 0.55, cy - r * 0.5, 0.04, 0.8, "3 3")}
      </>);

    case "cloud":
      return (<>
        {/* Cloud shape */}
        <path d={`M ${cx - r * 0.5} ${cy} A ${r * 0.3} ${r * 0.3} 0 1 1 ${cx - r * 0.15} ${cy - r * 0.35} A ${r * 0.25} ${r * 0.25} 0 1 1 ${cx + r * 0.25} ${cy - r * 0.3} A ${r * 0.35} ${r * 0.35} 0 1 1 ${cx + r * 0.55} ${cy} Z`}
          fill="none" stroke={N} strokeWidth="2" opacity="0.22" />
        {/* Upload arrow */}
        <path d={`M ${cx - r * 0.1} ${cy + r * 0.3} L ${cx - r * 0.1} ${cy + r * 0.1} L ${cx - r * 0.2} ${cy + r * 0.1} L ${cx} ${cy - r * 0.05} L ${cx + r * 0.2} ${cy + r * 0.1} L ${cx + r * 0.1} ${cy + r * 0.1} L ${cx + r * 0.1} ${cy + r * 0.3}`}
          fill="none" stroke={N} strokeWidth="1.5" opacity="0.18" />
        {/* Data dots streaming up */}
        {[-0.15, 0, 0.15].map((ox, i) => (
          <g key={`dd${i}`}>
            {dot(cx + ox * r, cy + r * (0.45 + i * 0.08), 2, 0.08)}
            {dot(cx + ox * r, cy + r * (0.55 + i * 0.06), 1.5, 0.05)}
          </g>
        ))}
        {/* Devices below */}
        <rect x={cx - r * 0.5} y={cy + r * 0.55} width={r * 0.2} height={r * 0.12} rx={2} fill="none" stroke={N} strokeWidth="1" opacity="0.14" />
        <rect x={cx - r * 0.1} y={cy + r * 0.6} width={r * 0.08} height={r * 0.14} rx={1} fill="none" stroke={N} strokeWidth="1" opacity="0.14" />
        <rect x={cx + r * 0.2} y={cy + r * 0.55} width={r * 0.25} height={r * 0.15} rx={2} fill="none" stroke={N} strokeWidth="1" opacity="0.14" />
      </>);

    case "rocket":
      return (<>
        {/* Rocket body */}
        <path d={`M ${cx} ${cy - r * 0.65} Q ${cx + r * 0.15} ${cy - r * 0.4} ${cx + r * 0.15} ${cy + r * 0.1} L ${cx + r * 0.25} ${cy + r * 0.3} L ${cx - r * 0.25} ${cy + r * 0.3} L ${cx - r * 0.15} ${cy + r * 0.1} Q ${cx - r * 0.15} ${cy - r * 0.4} ${cx} ${cy - r * 0.65}`}
          fill="none" stroke={N} strokeWidth="2" opacity="0.22" />
        {/* Porthole */}
        {ring(cx, cy - r * 0.2, r * 0.08, 0.08, 1.5)}
        {/* Fins */}
        <path d={`M ${cx - r * 0.15} ${cy + r * 0.05} L ${cx - r * 0.3} ${cy + r * 0.35} L ${cx - r * 0.15} ${cy + r * 0.3}`} fill="none" stroke={N} strokeWidth="1.5" opacity="0.18" />
        <path d={`M ${cx + r * 0.15} ${cy + r * 0.05} L ${cx + r * 0.3} ${cy + r * 0.35} L ${cx + r * 0.15} ${cy + r * 0.3}`} fill="none" stroke={N} strokeWidth="1.5" opacity="0.18" />
        {/* Exhaust */}
        {arc(cx, cy + r * 0.35, r * 0.08, 0, 180, 0.08, 1.5)}
        {arc(cx, cy + r * 0.42, r * 0.12, 10, 170, 0.05, 1)}
        {/* Trajectory arc */}
        {arc(cx - r * 0.8, cy + r * 0.8, r * 1.2, -70, -20, 0.04, 1)}
        {/* Stars */}
        {[[0.5, -0.5], [-0.5, -0.3], [0.6, 0.1], [-0.6, 0.4], [0.4, -0.7]].map(([ox, oy], i) => (
          <g key={`s${i}`}>
            {ln(cx + ox * r - 4, cy + oy * r, cx + ox * r + 4, cy + oy * r, 0.06, 0.7)}
            {ln(cx + ox * r, cy + oy * r - 4, cx + ox * r, cy + oy * r + 4, 0.06, 0.7)}
          </g>
        ))}
      </>);

    case "globe":
      return (<>
        {ring(cx, cy, r * 0.7, 0.09, 2)}
        {/* Latitude lines */}
        {[-0.4, -0.15, 0.15, 0.4].map((f, i) => (
          <ellipse key={`lat${i}`} cx={cx} cy={cy + r * f} rx={r * 0.7 * Math.cos(Math.asin(f / 0.7))} ry={r * 0.06} fill="none" stroke={N} strokeWidth="0.8" opacity="0.14" />
        ))}
        {/* Longitude lines */}
        {[0, 45, 90, 135].map((deg, i) => (
          <ellipse key={`lon${i}`} cx={cx} cy={cy} rx={r * 0.7 * Math.cos(deg * Math.PI / 180)} ry={r * 0.7} fill="none" stroke={N} strokeWidth="0.8" opacity="0.14" transform={`rotate(0 ${cx} ${cy})`} />
        ))}
        {/* Connection arcs between "cities" */}
        {arc(cx - r * 0.3, cy - r * 0.15, r * 0.4, -40, 40, 0.06, 1)}
        {arc(cx + r * 0.1, cy + r * 0.2, r * 0.35, 200, 300, 0.06, 1)}
        {/* City dots */}
        {[[0.3, -0.25], [-0.25, 0.15], [0.1, -0.45], [-0.35, -0.3], [0.4, 0.2]].map(([ox, oy], i) => (
          <g key={`city${i}`}>{dot(cx + ox * r, cy + oy * r, 3, 0.1)}{ring(cx + ox * r, cy + oy * r, 6, 0.05, 0.5)}</g>
        ))}
        {/* Orbit ring */}
        <ellipse cx={cx} cy={cy} rx={r * 0.9} ry={r * 0.25} fill="none" stroke={N} strokeWidth="0.8" opacity="0.28" transform={`rotate(-20 ${cx} ${cy})`} />
        {dot(cx + r * 0.85, cy - r * 0.15, 3, 0.08)}
      </>);

    case "infinity":
      return (<>
        {/* Infinity loop made of dots */}
        {Array.from({ length: 60 }, (_, i) => {
          const t = (i / 60) * Math.PI * 2;
          const scale = r * 0.55;
          const x = cx + (scale * Math.cos(t)) / (1 + Math.sin(t) ** 2);
          const y = cy + (scale * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2);
          return <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.5 : 1.5} fill={N} opacity={0.06 + (i % 5) * 0.01} />;
        })}
        {/* Gear at crossover */}
        <path d={gearPath(cx, cy, r * 0.12, 8)} fill="none" stroke={N} strokeWidth="1.5" opacity="0.20" />
        {dot(cx, cy, 3, 0.1)}
        {/* Flow arrows along the path */}
        {[30, 150, 210, 330].map((deg, i) => {
          const t = (deg / 360) * Math.PI * 2;
          const scale = r * 0.55;
          const x = cx + (scale * Math.cos(t)) / (1 + Math.sin(t) ** 2);
          const y = cy + (scale * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2);
          return <circle key={`a${i}`} cx={x} cy={y} r={4} fill={N} opacity="0.28" />;
        })}
      </>);

    case "dna":
      return (<>
        {Array.from({ length: 30 }, (_, i) => {
          const t = (i / 30) * Math.PI * 3;
          const y = cy - r * 0.7 + (i / 30) * r * 1.4;
          const x1 = cx + Math.cos(t) * r * 0.25;
          const x2 = cx - Math.cos(t) * r * 0.25;
          return <g key={i}>
            {dot(x1, y, 2.5, 0.08)}{dot(x2, y, 2.5, 0.08)}
            {i % 3 === 0 && <line x1={x1} y1={y} x2={x2} y2={y} stroke={N} strokeWidth="0.8" opacity="0.14" />}
          </g>;
        })}
        {/* Backbone curves */}
        <path d={`M ${Array.from({ length: 30 }, (_, i) => {
          const t = (i / 30) * Math.PI * 3;
          const y = cy - r * 0.7 + (i / 30) * r * 1.4;
          return `${i === 0 ? "M" : "L"} ${cx + Math.cos(t) * r * 0.25} ${y}`;
        }).join(" ")}`} fill="none" stroke={N} strokeWidth="1.2" opacity="0.18" />
        <path d={`M ${Array.from({ length: 30 }, (_, i) => {
          const t = (i / 30) * Math.PI * 3;
          const y = cy - r * 0.7 + (i / 30) * r * 1.4;
          return `${i === 0 ? "M" : "L"} ${cx - Math.cos(t) * r * 0.25} ${y}`;
        }).join(" ")}`} fill="none" stroke={N} strokeWidth="1.2" opacity="0.18" />
      </>);

    case "matrix":
      return (<>
        {Array.from({ length: 8 }, (_, col) =>
          Array.from({ length: 12 }, (_, row) => {
            const x = cx - r * 0.6 + col * r * 0.18;
            const y = cy - r * 0.7 + row * r * 0.13;
            const fade = Math.max(0, 1 - row / 12);
            return <rect key={`${col}-${row}`} x={x} y={y} width={r * 0.06} height={r * 0.06} rx={1}
              fill={N} opacity={0.02 + fade * 0.04} />;
          })
        )}
        {/* Scanning line */}
        {ln(cx - r * 0.7, cy - r * 0.1, cx + r * 0.7, cy - r * 0.1, 0.08, 1)}
        {/* Column highlights */}
        <rect x={cx - r * 0.06} y={cy - r * 0.75} width={r * 0.12} height={r * 1.5} fill={N} opacity="0.02" />
        <rect x={cx + r * 0.3} y={cy - r * 0.75} width={r * 0.12} height={r * 1.5} fill={N} opacity="0.015" />
      </>);

    case "wave":
      return (<>
        {/* Oscilloscope frame */}
        <rect x={cx - r * 0.8} y={cy - r * 0.5} width={r * 1.6} height={r * 1} rx={4} fill="none" stroke={N} strokeWidth="1.5" opacity="0.16" />
        {/* Grid */}
        {Array.from({ length: 9 }, (_, i) => ln(cx - r * 0.8, cy - r * 0.5 + i * r * 0.125, cx + r * 0.8, cy - r * 0.5 + i * r * 0.125, 0.02, 0.5))}
        {Array.from({ length: 13 }, (_, i) => ln(cx - r * 0.8 + i * r * 0.133, cy - r * 0.5, cx - r * 0.8 + i * r * 0.133, cy + r * 0.5, 0.02, 0.5))}
        {/* Sine wave */}
        <polyline points={Array.from({ length: 80 }, (_, i) => {
          const x = cx - r * 0.75 + (i / 80) * r * 1.5;
          const y = cy + Math.sin((i / 80) * Math.PI * 4) * r * 0.3;
          return `${x},${y}`;
        }).join(" ")} fill="none" stroke={N} strokeWidth="2" opacity="0.25" />
        {/* Spectrum bars */}
        {Array.from({ length: 16 }, (_, i) => {
          const x = cx - r * 0.75 + i * r * 0.1;
          const h = r * (0.05 + Math.abs(Math.sin(i * 0.8)) * 0.15);
          return <rect key={`sp${i}`} x={x} y={cy + r * 0.55} width={r * 0.06} height={h} fill={N} opacity="0.14" rx={1} />;
        })}
      </>);

    case "calendar":
      return (<>
        {/* Calendar grid */}
        <rect x={cx - r * 0.55} y={cy - r * 0.55} width={r * 1.1} height={r * 1.1} rx={6} fill="none" stroke={N} strokeWidth="1.5" opacity="0.20" />
        {/* Header */}
        <rect x={cx - r * 0.55} y={cy - r * 0.55} width={r * 1.1} height={r * 0.18} rx={6} fill={N} opacity="0.03" />
        {/* Grid lines */}
        {Array.from({ length: 5 }, (_, i) => ln(cx - r * 0.55, cy - r * 0.37 + i * r * 0.18, cx + r * 0.55, cy - r * 0.37 + i * r * 0.18, 0.04, 0.5))}
        {Array.from({ length: 6 }, (_, i) => ln(cx - r * 0.55 + (i + 1) * r * 0.157, cy - r * 0.37, cx - r * 0.55 + (i + 1) * r * 0.157, cy + r * 0.55, 0.03, 0.5))}
        {/* Checkmarks in some cells */}
        {[[1, 0], [3, 1], [5, 1], [2, 2], [4, 3]].map(([col, row], i) => {
          const x = cx - r * 0.48 + col * r * 0.157;
          const y = cy - r * 0.28 + row * r * 0.18;
          return <path key={`ch${i}`} d={`M ${x} ${y + 4} L ${x + 4} ${y + 8} L ${x + 10} ${y}`} fill="none" stroke={N} strokeWidth="1.2" opacity="0.20" />;
        })}
        {/* Today marker */}
        {ring(cx - r * 0.48 + 3 * r * 0.157 + 5, cy - r * 0.28 + 2 * r * 0.18 + 4, 8, 0.1, 1.5)}
      </>);

    case "magnet":
      return (<>
        {/* Horseshoe magnet */}
        {arc(cx, cy - r * 0.1, r * 0.35, 180, 360, 0.1, 2.5)}
        {ln(cx - r * 0.35, cy - r * 0.1, cx - r * 0.35, cy + r * 0.3, 0.1, 2.5)}
        {ln(cx + r * 0.35, cy - r * 0.1, cx + r * 0.35, cy + r * 0.3, 0.1, 2.5)}
        {/* Pole caps */}
        <rect x={cx - r * 0.42} y={cy + r * 0.25} width={r * 0.14} height={r * 0.08} fill={N} opacity="0.16" />
        <rect x={cx + r * 0.28} y={cy + r * 0.25} width={r * 0.14} height={r * 0.08} fill={N} opacity="0.16" />
        {/* Force field arcs */}
        {[0.5, 0.65, 0.8].map((s, i) => (
          <g key={`f${i}`}>
            {arc(cx, cy + r * 0.35, r * s, 200, 340, 0.05 - i * 0.01, 1)}
          </g>
        ))}
        {/* Attracted particles */}
        {[[0, 0.55], [-0.15, 0.5], [0.15, 0.5], [-0.08, 0.62], [0.08, 0.62], [0, 0.7]].map(([ox, oy], i) => (
          <circle key={`p${i}`} cx={cx + ox * r} cy={cy + oy * r} r={2.5 - i * 0.3} fill={N} opacity={0.1 - i * 0.01} />
        ))}
      </>);

    case "handshake":
      return (<>
        {/* Two hands reaching */}
        <path d={`M ${cx - r * 0.6} ${cy + r * 0.1} Q ${cx - r * 0.3} ${cy - r * 0.1} ${cx - r * 0.05} ${cy}`} fill="none" stroke={N} strokeWidth="2" opacity="0.22" />
        <path d={`M ${cx + r * 0.6} ${cy + r * 0.1} Q ${cx + r * 0.3} ${cy - r * 0.1} ${cx + r * 0.05} ${cy}`} fill="none" stroke={N} strokeWidth="2" opacity="0.22" />
        {/* Energy connection */}
        {[- 0.08, 0, 0.08].map((oy, i) => (
          <line key={`e${i}`} x1={cx - r * 0.05} y1={cy + oy * r} x2={cx + r * 0.05} y2={cy + oy * r} stroke={N} strokeWidth="1.5" opacity="0.28" />
        ))}
        {/* Glow at connection point */}
        {ring(cx, cy, r * 0.15, 0.06, 1)}
        {ring(cx, cy, r * 0.25, 0.04, 0.7)}
        {/* Surrounding network */}
        {[[-0.7, -0.3], [0.7, -0.3], [-0.5, 0.5], [0.5, 0.5], [0, -0.5], [-0.8, 0.1], [0.8, 0.1]].map(([ox, oy], i) => (
          <g key={`n${i}`}>
            {ring(cx + ox * r, cy + oy * r, 5, 0.05, 0.8)}
            {dot(cx + ox * r, cy + oy * r, 2, 0.06)}
            {ln(cx + ox * r, cy + oy * r, cx, cy, 0.02, 0.5, "3 6")}
          </g>
        ))}
      </>);

    default:
      return <>{ring(cx, cy, r * 0.5, 0.06)}</>;
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
        {type === "gear" && <GearIllustration {...props} />}
        {type === "brain" && <BrainIllustration {...props} />}
        {type === "shield" && <ShieldIllustration {...props} />}
        {type === "nodes" && <NodesIllustration {...props} />}
        {type === "chart" && <ChartIllustration {...props} />}
        {type === "target" && <TargetIllustration {...props} />}
        {type === "flow" && <FlowIllustration {...props} />}
        {type === "circuit" && <CircuitIllustration {...props} />}
        {type === "lightbulb" && <LightbulbIllustration {...props} />}
        {!["gear", "brain", "shield", "nodes", "chart", "target", "flow", "circuit", "lightbulb"].includes(type) && (
          <SimpleIllustration {...props} type={type} />
        )}
      </svg>
    </div>
  );
}
