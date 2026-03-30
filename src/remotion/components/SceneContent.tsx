import { interpolate, spring, useVideoConfig } from "remotion";
import { Scene } from "../types";
import { Icon } from "./Icon";

const ACCENT_COLORS: Record<string, string> = {
  turquoise: "#23C6B7",
  geel: "#F4C533",
};

interface SceneContentProps {
  scene: Scene;
  frame: number;
}

export const SceneContent: React.FC<SceneContentProps> = ({ scene, frame }) => {
  const { fps } = useVideoConfig();
  const { tekst, accentRegel, accentKleur = "turquoise", icon, isCta } = scene;
  const accentColor = ACCENT_COLORS[accentKleur];

  // Container fade + scale in
  const containerOpacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const containerScale = interpolate(frame, [0, 8], [0.95, 1], { extrapolateRight: "clamp" });

  // Each line slides up with spring
  const lineDelay = 6; // frames between each line

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 1080,
        height: 1080,
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
      }}
    >
      {/* Glow behind text area */}
      <div style={{
        position: "absolute",
        top: isCta ? 340 : 280,
        left: 20,
        right: 20,
        height: 300,
        background: `radial-gradient(ellipse at 30% 50%, ${accentColor}15 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* Text block */}
      <div
        style={{
          position: "absolute",
          top: isCta ? 360 : 300,
          left: 56,
          right: 56,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {tekst.map((line, i) => {
          const isAccent = i === accentRegel;
          const delay = i * lineDelay;

          // Spring animation per line
          const lineProgress = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 120 } });
          const lineOpacity = interpolate(lineProgress, [0, 1], [0, 1]);
          const lineY = interpolate(lineProgress, [0, 1], [30, 0]);

          // Font sizing — accent and CTA lines bigger
          const fontSize = isCta && i === tekst.length - 1 ? 58 : isAccent ? 64 : 54;
          const color = isAccent ? accentColor : "#F3F5F7";
          const fontWeight = isAccent ? 800 : 700;

          return (
            <div
              key={i}
              style={{
                display: "block",
                fontSize,
                fontWeight,
                color,
                lineHeight: 1.15,
                marginBottom: 8,
                letterSpacing: isAccent ? "0.01em" : "-0.02em",
                opacity: lineOpacity,
                transform: `translateY(${lineY}px)`,
                // Glow on accent text
                textShadow: isAccent
                  ? `0 0 40px ${accentColor}60, 0 0 80px ${accentColor}30`
                  : "none",
              }}
            >
              {line}
            </div>
          );
        })}

        {/* CTA underline accent bar */}
        {isCta && (() => {
          const barDelay = tekst.length * lineDelay + 4;
          const barProgress = spring({ frame: frame - barDelay, fps, config: { damping: 15, stiffness: 100 } });
          const barWidth = interpolate(barProgress, [0, 1], [0, 280]);
          return (
            <div style={{
              marginTop: 24,
              width: barWidth,
              height: 4,
              backgroundColor: accentColor,
              borderRadius: 2,
              boxShadow: `0 0 20px ${accentColor}80, 0 0 40px ${accentColor}40`,
            }} />
          );
        })()}
      </div>

      {/* Icon — bigger, with glow */}
      {icon && (() => {
        const iconDelay = tekst.length * lineDelay + 6;
        const iconProgress = spring({ frame: frame - iconDelay, fps, config: { damping: 18, stiffness: 100 } });
        const iconOpacity = interpolate(iconProgress, [0, 1], [0, 1]);
        const iconScale = interpolate(iconProgress, [0, 1], [0.5, 1]);

        return (
          <div style={{
            position: "absolute",
            bottom: 110,
            left: 56,
            opacity: iconOpacity,
            transform: `scale(${iconScale})`,
          }}>
            {/* Icon glow */}
            <div style={{
              position: "absolute",
              top: -20,
              left: -20,
              width: 112,
              height: 112,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${accentColor}25 0%, transparent 70%)`,
            }} />
            <Icon
              name={icon}
              color={accentColor}
              revealFrame={0}
              currentFrame={10}
            />
          </div>
        );
      })()}
    </div>
  );
};
