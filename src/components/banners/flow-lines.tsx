interface FlowLinesProps {
  width: number;
  height: number;
}

// Compound wave path — like the Lovable cover waves
function buildWavePath(width: number, height: number, waveIndex: number): string {
  const yBase = (height / 7) * (waveIndex + 1.5);
  const amplitude = 14 + waveIndex * 5;
  const frequency = 0.0018 + waveIndex * 0.00015;
  const phase1 = waveIndex * 0.9;
  const phase2 = waveIndex * 1.4;

  const points: [number, number][] = [];
  for (let x = 0; x <= width; x += 4) {
    const y =
      yBase +
      Math.sin(x * frequency + phase1) * amplitude +
      Math.sin(x * frequency * 1.6 + phase2) * (amplitude * 0.3);
    points.push([x, y]);
  }

  if (points.length === 0) return "";

  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L${points[i][0].toFixed(1)},${points[i][1].toFixed(1)}`;
  }
  return d;
}

export function FlowLines({ width, height }: FlowLinesProps) {
  const waveCount = 5;

  return (
    <svg
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {Array.from({ length: waveCount }, (_, wi) => (
        <path
          key={wi}
          d={buildWavePath(width, height, wi)}
          fill="none"
          stroke="#2DD4A8"
          strokeWidth="1"
          opacity={0.08 + (wi % 2) * 0.03}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
