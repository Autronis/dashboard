import type { BannerIllustration } from "@/types/content";

interface BgIllustrationProps {
  type: BannerIllustration;
  width: number;
  height: number;
}

const NEON = "#2DD4A8";
const SW = "2";
const FILL_SUBTLE = "rgba(45,212,168,0.04)";

function GearIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const teeth = 12;
  const outerR = r;
  const innerR = r * 0.78;
  const toothW = r * 0.18;
  const points: string[] = [];

  for (let i = 0; i < teeth; i++) {
    const a1 = (i / teeth) * Math.PI * 2 - Math.PI / teeth * 0.4;
    const a2 = (i / teeth) * Math.PI * 2 + Math.PI / teeth * 0.4;
    const a3 = ((i + 0.5) / teeth) * Math.PI * 2 - Math.PI / teeth * 0.4;
    const a4 = ((i + 0.5) / teeth) * Math.PI * 2 + Math.PI / teeth * 0.4;

    points.push(`${cx + Math.cos(a1) * innerR},${cy + Math.sin(a1) * innerR}`);
    points.push(`${cx + Math.cos(a1) * (outerR + toothW)},${cy + Math.sin(a1) * (outerR + toothW)}`);
    points.push(`${cx + Math.cos(a2) * (outerR + toothW)},${cy + Math.sin(a2) * (outerR + toothW)}`);
    points.push(`${cx + Math.cos(a2) * innerR},${cy + Math.sin(a2) * innerR}`);
    points.push(`${cx + Math.cos(a3) * innerR},${cy + Math.sin(a3) * innerR}`);
    points.push(`${cx + Math.cos(a4) * innerR},${cy + Math.sin(a4) * innerR}`);
  }

  return (
    <>
      <polygon points={points.join(" ")} fill={FILL_SUBTLE} stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={r * 0.35} fill="none" stroke={NEON} strokeWidth={SW} />
      <circle cx={cx} cy={cy} r={r * 0.18} fill={FILL_SUBTLE} stroke={NEON} strokeWidth={SW} />
    </>
  );
}

function BrainIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const nodes = [
    { x: cx - r * 0.6, y: cy - r * 0.3 }, { x: cx - r * 0.2, y: cy - r * 0.55 },
    { x: cx + r * 0.2, y: cy - r * 0.55 }, { x: cx + r * 0.6, y: cy - r * 0.3 },
    { x: cx - r * 0.7, y: cy + r * 0.1 }, { x: cx - r * 0.25, y: cy + r * 0.15 },
    { x: cx + r * 0.25, y: cy + r * 0.15 }, { x: cx + r * 0.7, y: cy + r * 0.1 },
    { x: cx - r * 0.45, y: cy + r * 0.5 }, { x: cx, y: cy + r * 0.55 },
    { x: cx + r * 0.45, y: cy + r * 0.5 },
  ];
  const connections = [
    [0,1],[1,2],[2,3],[0,4],[1,5],[2,6],[3,7],[4,5],[5,6],[6,7],
    [4,8],[5,9],[6,9],[7,10],[8,9],[9,10],[1,6],[2,5]
  ];

  return (
    <>
      {/* Left brain lobe outline */}
      <ellipse cx={cx - r * 0.22} cy={cy} rx={r * 0.52} ry={r * 0.62} fill="none" stroke={NEON} strokeWidth={SW} opacity="0.4" />
      {/* Right brain lobe outline */}
      <ellipse cx={cx + r * 0.22} cy={cy} rx={r * 0.52} ry={r * 0.62} fill="none" stroke={NEON} strokeWidth={SW} opacity="0.4" />
      {/* Center divider */}
      <line x1={cx} y1={cy - r * 0.55} x2={cx} y2={cy + r * 0.55} stroke={NEON} strokeWidth="1" opacity="0.3" strokeDasharray="6,6" />
      {/* Connections */}
      {connections.map(([a, b], i) => (
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={NEON} strokeWidth="1" opacity="0.5" />
      ))}
      {/* Nodes */}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={r * 0.045} fill={NEON} opacity="0.6" />
      ))}
    </>
  );
}

function NodesIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const nodes = [
    { x: cx, y: cy, r: r * 0.1 },
    { x: cx - r * 0.55, y: cy - r * 0.35, r: r * 0.07 },
    { x: cx + r * 0.55, y: cy - r * 0.35, r: r * 0.07 },
    { x: cx - r * 0.6, y: cy + r * 0.35, r: r * 0.08 },
    { x: cx + r * 0.6, y: cy + r * 0.35, r: r * 0.08 },
    { x: cx, y: cy - r * 0.65, r: r * 0.06 },
    { x: cx, y: cy + r * 0.65, r: r * 0.06 },
  ];
  const links = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,5],[2,5],[3,6],[4,6],[1,3],[2,4]];

  return (
    <>
      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={NEON} strokeWidth={SW} opacity="0.4" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={FILL_SUBTLE} stroke={NEON} strokeWidth={SW} />
      ))}
    </>
  );
}

function ChartIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const baseY = cy + r * 0.55;
  const leftX = cx - r * 0.7;
  const rightX = cx + r * 0.7;

  const dataPoints = [
    { x: leftX, y: baseY - r * 0.1 },
    { x: cx - r * 0.4, y: baseY - r * 0.3 },
    { x: cx - r * 0.1, y: baseY - r * 0.5 },
    { x: cx + r * 0.2, y: baseY - r * 0.75 },
    { x: rightX, y: baseY - r * 1.1 },
  ];

  const lineD = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaD = `${lineD} L${rightX},${baseY} L${leftX},${baseY} Z`;

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => baseY - r * 1.1 * f);

  return (
    <>
      {/* Grid */}
      {gridLines.map((y, i) => (
        <line key={i} x1={leftX} y1={y} x2={rightX} y2={y} stroke={NEON} strokeWidth="0.8" opacity="0.2" strokeDasharray="8,8" />
      ))}
      {/* Axes */}
      <line x1={leftX} y1={cy - r * 0.6} x2={leftX} y2={baseY} stroke={NEON} strokeWidth={SW} opacity="0.5" />
      <line x1={leftX} y1={baseY} x2={rightX} y2={baseY} stroke={NEON} strokeWidth={SW} opacity="0.5" />
      {/* Area fill */}
      <path d={areaD} fill="rgba(45,212,168,0.05)" stroke="none" />
      {/* Line */}
      <path d={lineD} fill="none" stroke={NEON} strokeWidth={SW} strokeLinejoin="round" />
      {/* Dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={r * 0.045} fill={NEON} opacity="0.7" />
      ))}
    </>
  );
}

function TargetIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={NEON} strokeWidth={SW} opacity="0.4" />
      <circle cx={cx} cy={cy} r={r * 0.72} fill="none" stroke={NEON} strokeWidth={SW} opacity="0.5" />
      <circle cx={cx} cy={cy} r={r * 0.46} fill="none" stroke={NEON} strokeWidth={SW} opacity="0.6" />
      <circle cx={cx} cy={cy} r={r * 0.22} fill={FILL_SUBTLE} stroke={NEON} strokeWidth={SW} opacity="0.8" />
      {/* Crosshair */}
      <line x1={cx} y1={cy - r * 1.12} x2={cx} y2={cy - r * 0.85} stroke={NEON} strokeWidth={SW} opacity="0.5" />
      <line x1={cx} y1={cy + r * 1.12} x2={cx} y2={cy + r * 0.85} stroke={NEON} strokeWidth={SW} opacity="0.5" />
      <line x1={cx - r * 1.12} y1={cy} x2={cx - r * 0.85} y2={cy} stroke={NEON} strokeWidth={SW} opacity="0.5" />
      <line x1={cx + r * 1.12} y1={cy} x2={cx + r * 0.85} y2={cy} stroke={NEON} strokeWidth={SW} opacity="0.5" />
      {/* Arrow */}
      <path d={`M${cx + r * 0.7},${cy - r * 0.7} L${cx + r * 0.22},${cy - r * 0.22}`} stroke={NEON} strokeWidth={SW} strokeLinecap="round" opacity="0.9" />
      <path d={`M${cx + r * 0.7},${cy - r * 0.7} L${cx + r * 0.42},${cy - r * 0.7} M${cx + r * 0.7},${cy - r * 0.7} L${cx + r * 0.7},${cy - r * 0.42}`} stroke={NEON} strokeWidth={SW} strokeLinecap="round" opacity="0.9" />
    </>
  );
}

function FlowIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const bw = r * 0.55;
  const bh = r * 0.28;

  const boxes = [
    { x: cx - r * 0.9, y: cy - r * 0.55 },
    { x: cx + r * 0.25, y: cy - r * 0.55 },
    { x: cx - r * 0.33, y: cy - r * 0.1 },
    { x: cx - r * 0.9, y: cy + r * 0.35 },
    { x: cx + r * 0.25, y: cy + r * 0.35 },
  ];

  function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    const ax = x2 - Math.cos(angle) * len * 0.05;
    const ay = y2 - Math.sin(angle) * len * 0.05;
    return (
      <>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={NEON} strokeWidth="1.5" opacity="0.55" />
        <path d={`M${ax - Math.cos(angle - 0.5) * 10},${ay - Math.sin(angle - 0.5) * 10} L${x2},${y2} L${ax - Math.cos(angle + 0.5) * 10},${ay - Math.sin(angle + 0.5) * 10}`} fill="none" stroke={NEON} strokeWidth="1.5" opacity="0.55" strokeLinejoin="round" />
      </>
    );
  }

  return (
    <>
      {boxes.map((b, i) => (
        <rect key={i} x={b.x - bw / 2} y={b.y - bh / 2} width={bw} height={bh} rx={bh * 0.2} fill={FILL_SUBTLE} stroke={NEON} strokeWidth={SW} />
      ))}
      <Arrow x1={boxes[0].x + bw/2} y1={boxes[0].y} x2={boxes[1].x - bw/2} y2={boxes[1].y} />
      <Arrow x1={boxes[0].x + bw/4} y1={boxes[0].y + bh/2} x2={boxes[2].x - bw/4} y2={boxes[2].y - bh/2} />
      <Arrow x1={boxes[1].x} y1={boxes[1].y + bh/2} x2={boxes[4].x} y2={boxes[4].y - bh/2} />
      <Arrow x1={boxes[2].x - bw/4} y1={boxes[2].y + bh/2} x2={boxes[3].x + bw/4} y2={boxes[3].y - bh/2} />
      <Arrow x1={boxes[2].x + bw/4} y1={boxes[2].y + bh/2} x2={boxes[4].x - bw/4} y2={boxes[4].y - bh/2} />
    </>
  );
}

function CircuitIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const nodes: Array<{ x: number; y: number }> = [];
  const segs: Array<[number, number, number, number]> = [];

  // Horizontal rails
  const yLevels = [cy - r * 0.6, cy - r * 0.2, cy + r * 0.2, cy + r * 0.6];
  const xLevels = [cx - r * 0.8, cx - r * 0.3, cx + r * 0.2, cx + r * 0.7];

  yLevels.forEach((y) => {
    segs.push([cx - r * 0.9, y, cx + r * 0.8, y]);
  });
  xLevels.forEach((x) => {
    segs.push([x, cy - r * 0.7, x, cy + r * 0.7]);
  });

  // Nodes at intersections
  yLevels.forEach((y) => {
    xLevels.forEach((x) => {
      if (Math.random() > 0.3) nodes.push({ x, y });
    });
  });

  return (
    <>
      {segs.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={NEON} strokeWidth="1" opacity="0.3" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={r * 0.04} fill={FILL_SUBTLE} stroke={NEON} strokeWidth="1.5" opacity="0.7" />
      ))}
      {/* Component boxes */}
      <rect x={cx - r * 0.15} y={cy - r * 0.25} width={r * 0.3} height={r * 0.5} rx={r * 0.04} fill={FILL_SUBTLE} stroke={NEON} strokeWidth={SW} opacity="0.6" />
      <rect x={cx - r * 0.65} y={cy - r * 0.12} width={r * 0.25} height={r * 0.24} rx={r * 0.04} fill={FILL_SUBTLE} stroke={NEON} strokeWidth={SW} opacity="0.6" />
    </>
  );
}

function LightbulbIllustration({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const bulbR = r * 0.52;
  const stemY = cy + bulbR * 0.55;
  const stemH = r * 0.28;

  return (
    <>
      {/* Glow rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = cx + Math.cos(rad) * (bulbR + r * 0.1);
        const y1 = cy + Math.sin(rad) * (bulbR + r * 0.1);
        const x2 = cx + Math.cos(rad) * (bulbR + r * 0.28);
        const y2 = cy + Math.sin(rad) * (bulbR + r * 0.28);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={NEON} strokeWidth="1.5" opacity="0.35" strokeLinecap="round" />;
      })}
      {/* Bulb circle */}
      <circle cx={cx} cy={cy} r={bulbR} fill={FILL_SUBTLE} stroke={NEON} strokeWidth={SW} />
      {/* Filament */}
      <path d={`M${cx - bulbR * 0.25},${cy + bulbR * 0.1} L${cx - bulbR * 0.1},${cy - bulbR * 0.15} L${cx + bulbR * 0.1},${cy + bulbR * 0.1} L${cx + bulbR * 0.25},${cy - bulbR * 0.15}`} fill="none" stroke={NEON} strokeWidth="1.5" strokeLinejoin="round" opacity="0.8" strokeLinecap="round" />
      {/* Stem */}
      <rect x={cx - bulbR * 0.28} y={stemY} width={bulbR * 0.56} height={stemH} rx={bulbR * 0.06} fill={FILL_SUBTLE} stroke={NEON} strokeWidth={SW} />
      {/* Base */}
      <rect x={cx - bulbR * 0.22} y={stemY + stemH} width={bulbR * 0.44} height={stemH * 0.45} rx={bulbR * 0.05} fill={FILL_SUBTLE} stroke={NEON} strokeWidth="1.5" />
    </>
  );
}

export function BgIllustration({ type, width, height }: BgIllustrationProps) {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.3;

  function renderShape() {
    switch (type) {
      case "gear": return <GearIllustration cx={cx} cy={cy} r={r} />;
      case "brain": return <BrainIllustration cx={cx} cy={cy} r={r} />;
      case "nodes": return <NodesIllustration cx={cx} cy={cy} r={r} />;
      case "chart": return <ChartIllustration cx={cx} cy={cy} r={r} />;
      case "target": return <TargetIllustration cx={cx} cy={cy} r={r} />;
      case "flow": return <FlowIllustration cx={cx} cy={cy} r={r} />;
      case "circuit": return <CircuitIllustration cx={cx} cy={cy} r={r} />;
      case "lightbulb": return <LightbulbIllustration cx={cx} cy={cy} r={r} />;
    }
  }

  return (
    <svg
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      opacity={0.08}
    >
      {renderShape()}
    </svg>
  );
}
