interface FlowLinesProps {
  width: number;
  height: number;
}

// Exact same wave formula as the dashboard's WavesBackground (waves-background.tsx)
// 5 waves, evenly spread, with sine+sine+cos compound formula, t=0 (static)
function buildWavePath(width: number, height: number, waveIndex: number): string {
  const yBase = (height / 6) * (waveIndex + 1);
  const amplitude = 18 + waveIndex * 4;
  const frequency = 0.0015 + waveIndex * 0.0002;

  // Phase offsets matching the dashboard (at t=0)
  const offset1 = waveIndex * 0.8;
  const offset2 = waveIndex * 1.2;
  const offset3 = waveIndex * 0.5;

  const points: [number, number][] = [];
  for (let x = 0; x <= width; x += 4) {
    const y =
      yBase +
      Math.sin(x * frequency + offset1) * amplitude +
      Math.sin(x * frequency * 1.8 + offset2) * (amplitude * 0.35) +
      Math.cos(x * 0.0008 + offset3) * 5;
    points.push([x, y]);
  }

  if (points.length === 0) return "";

  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L${points[i][0].toFixed(2)},${points[i][1].toFixed(2)}`;
  }
  return d;
}

// Compute the Y-value of a wave at a given X position (for dot placement)
function getWaveY(x: number, height: number, waveIndex: number): number {
  const yBase = (height / 6) * (waveIndex + 1);
  const amplitude = 18 + waveIndex * 4;
  const frequency = 0.0015 + waveIndex * 0.0002;
  const offset1 = waveIndex * 0.8;
  const offset2 = waveIndex * 1.2;
  const offset3 = waveIndex * 0.5;
  return (
    yBase +
    Math.sin(x * frequency + offset1) * amplitude +
    Math.sin(x * frequency * 1.8 + offset2) * (amplitude * 0.35) +
    Math.cos(x * 0.0008 + offset3) * 5
  );
}

// Fixed dot position offsets per wave (0.0–1.0 fraction of width)
const DOT_POSITIONS = [0.18, 0.38, 0.55, 0.72, 0.88];

export function FlowLines({ width, height }: FlowLinesProps) {
  const waveOpacities = [0.08, 0.10, 0.08, 0.10, 0.08];

  return (
    <svg
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        {/* Radial glow gradient for traveling dots */}
        {[0, 1, 2, 3, 4].map((wi) => (
          <radialGradient
            key={wi}
            id={`dot-glow-${wi}`}
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop offset="0%" stopColor="#2DD4A8" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#2DD4A8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2DD4A8" stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      {/* 5 waves using the exact dashboard formula */}
      {[0, 1, 2, 3, 4].map((wi) => (
        <path
          key={wi}
          d={buildWavePath(width, height, wi)}
          fill="none"
          stroke="#2DD4A8"
          strokeWidth="0.7"
          opacity={waveOpacities[wi]}
          strokeLinecap="round"
        />
      ))}

      {/* No dots — clean lines only */}
    </svg>
  );
}
