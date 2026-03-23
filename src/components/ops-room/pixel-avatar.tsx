"use client";

import { useRef, useEffect } from "react";
import { drawSprite, getCharacterDef } from "./pixel-sprites";

interface PixelAvatarProps {
  agentId: string;
  size?: number;
  className?: string;
}

export function PixelAvatar({ agentId, size = 24, className }: PixelAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const charDef = getCharacterDef(agentId);
    const scale = Math.max(1, Math.floor(size / Math.max(charDef.rows, charDef.cols)));
    const w = charDef.cols * scale;
    const h = charDef.rows * scale;

    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);

    drawSprite(ctx, charDef.sprite, 0, 0, scale);
  }, [agentId, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
      }}
    />
  );
}
