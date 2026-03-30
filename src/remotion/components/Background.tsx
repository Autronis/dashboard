import { interpolate, useCurrentFrame } from "remotion";
import { DataWaves } from "./DataWaves";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1080;

export const Background: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle breathing glow animation
  const glowPulse = interpolate(
    Math.sin(frame * 0.03),
    [-1, 1],
    [0.06, 0.12]
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        background: "radial-gradient(ellipse at 30% 30%, #0B1E24 0%, #061217 50%, #030D10 100%)",
        overflow: "hidden",
      }}
    >
      {/* Turquoise radial glow top-left — breathing */}
      <div
        style={{
          position: "absolute",
          top: -150,
          left: -150,
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(35,198,183,${glowPulse}) 0%, rgba(35,198,183,0.03) 50%, transparent 75%)`,
          pointerEvents: "none",
        }}
      />

      {/* Bottom-right accent glow */}
      <div
        style={{
          position: "absolute",
          bottom: -100,
          right: -100,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(35,198,183,${glowPulse * 0.5}) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Subtle noise/grain texture overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          background: "repeating-conic-gradient(rgba(255,255,255,0.01) 0% 25%, transparent 0% 50%) 0 0 / 4px 4px",
          pointerEvents: "none",
          opacity: 0.4,
        }}
      />

      <DataWaves />
    </div>
  );
};
