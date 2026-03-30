import { interpolate, useCurrentFrame, Img, staticFile } from "remotion";

export const Header: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const slideX = interpolate(frame, [0, 12], [-20, 0], { extrapolateRight: "clamp" });
  const glowOpacity = interpolate(frame, [0, 20, 30], [0, 0.6, 0.3], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 48,
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity,
        transform: `translateX(${slideX}px)`,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Real Autronis logo */}
      <div style={{ position: "relative" }}>
        <div style={{
          position: "absolute",
          top: -8,
          left: -8,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(35,198,183,0.3) 0%, transparent 70%)",
          opacity: glowOpacity,
        }} />
        <Img
          src={staticFile("logo.png")}
          style={{ width: 32, height: 32, objectFit: "contain" }}
        />
      </div>

      <span
        style={{
          color: "#F3F5F7",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "0.06em",
        }}
      >
        Autronis
      </span>
    </div>
  );
};
