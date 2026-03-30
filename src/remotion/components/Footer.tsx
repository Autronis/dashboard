import { interpolate, useCurrentFrame, Img, staticFile } from "remotion";

export const Footer: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15], [0, 0.8], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 36,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Img
        src={staticFile("logo.png")}
        style={{ width: 16, height: 16, objectFit: "contain", opacity: 0.5 }}
      />
      <span style={{ color: "#8B98A3", fontSize: 13, fontWeight: 500, letterSpacing: "0.03em" }}>
        autronis.nl ·{" "}
        <span style={{ fontStyle: "italic", opacity: 0.7 }}>
          Brengt structuur in je groei.
        </span>
      </span>
    </div>
  );
};
