interface FlowLinesProps {
  width: number;
  height: number;
}

export function FlowLines({ width, height }: FlowLinesProps) {
  const h = height;
  const w = width;

  // 6 wavy lines at different vertical positions with varying amplitudes
  const lines = [
    { y: h * 0.15, amp: h * 0.04, freq: 1.2, sw: 1.5, op: 0.07 },
    { y: h * 0.28, amp: h * 0.035, freq: 0.9, sw: 1, op: 0.055 },
    { y: h * 0.42, amp: h * 0.05, freq: 1.1, sw: 2, op: 0.08 },
    { y: h * 0.57, amp: h * 0.03, freq: 1.4, sw: 1, op: 0.05 },
    { y: h * 0.71, amp: h * 0.045, freq: 0.85, sw: 1.5, op: 0.065 },
    { y: h * 0.86, amp: h * 0.038, freq: 1.15, sw: 1, op: 0.06 },
  ];

  function buildPath(y: number, amp: number, freq: number): string {
    // Build a smooth S-curve wave using cubic bezier segments
    const segments = 4;
    const segW = w / segments;
    let d = `M0,${y}`;

    for (let i = 0; i < segments; i++) {
      const x0 = i * segW;
      const x1 = x0 + segW;
      const cp1x = x0 + segW * 0.3;
      const cp2x = x0 + segW * 0.7;
      const sign = i % 2 === 0 ? 1 : -1;
      const cp1y = y + amp * sign * freq;
      const cp2y = y - amp * sign * freq;
      const ey = y + (i % 2 === 0 ? amp * 0.1 : -amp * 0.1);
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${x1},${ey}`;
    }

    return d;
  }

  return (
    <svg
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      {lines.map((line, i) => (
        <path
          key={i}
          d={buildPath(line.y, line.amp, line.freq)}
          fill="none"
          stroke="#2DD4A8"
          strokeWidth={line.sw}
          opacity={line.op}
        />
      ))}
    </svg>
  );
}
