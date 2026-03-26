"use client";

import { useEffect, useRef } from "react";

interface TravelingDot {
  waveIndex: number;
  position: number; // 0-1 along the wave
  speed: number;
  radius: number;
  opacity: number;
}

export function WavesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let dots: TravelingDot[] = [];
    let time = 0;

    const waveCount = 5;

    function getWaveY(x: number, waveIndex: number, t: number, h: number): number {
      const yBase = (h / (waveCount + 1)) * (waveIndex + 1);
      const amp = 18 + waveIndex * 4;
      const freq = 0.0015 + waveIndex * 0.0002;

      return (
        yBase +
        Math.sin(x * freq + t * 0.4 + waveIndex * 1.2) * amp +
        Math.sin(x * freq * 1.8 + t * 0.25 + waveIndex * 0.7) * (amp * 0.35) +
        Math.cos(x * 0.0008 + t * 0.12) * 5
      );
    }

    function initDots() {
      dots = [];
      // 1 dot per wave, slowly traveling along
      for (let w = 0; w < waveCount; w++) {
        dots.push({
          waveIndex: w,
          position: Math.random(),
          speed: 0.00008 + Math.random() * 0.00006,
          radius: 1.5 + Math.random() * 0.8,
          opacity: 0.5 + Math.random() * 0.3,
        });
      }
    }

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function drawWaves(ctx: CanvasRenderingContext2D) {
      if (!canvas) return;

      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(45, 212, 168, ${0.08 + w * 0.012})`;
        ctx.lineWidth = 0.7;

        for (let x = 0; x < canvas.width; x += 2) {
          const y = getWaveY(x, w, time, canvas.height);
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
    }

    function drawTravelingDots(ctx: CanvasRenderingContext2D) {
      if (!canvas) return;

      for (const dot of dots) {
        // Move dot along the wave
        dot.position += dot.speed;
        if (dot.position > 1) dot.position -= 1;

        const x = dot.position * canvas.width;
        const y = getWaveY(x, dot.waveIndex, time, canvas.height);

        // Glow
        ctx.beginPath();
        ctx.arc(x, y, dot.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(45, 212, 168, ${dot.opacity * 0.1})`;
        ctx.fill();

        // Dot
        ctx.beginPath();
        ctx.arc(x, y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(45, 212, 168, ${dot.opacity})`;
        ctx.fill();
      }
    }

    function animate() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawWaves(ctx);
      drawTravelingDots(ctx);

      time += 0.008;
      animationId = requestAnimationFrame(animate);
    }

    resize();
    initDots();
    animate();

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 hidden md:block"
    />
  );
}
