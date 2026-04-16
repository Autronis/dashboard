// src/components/proposal-deck/DemoMode.tsx
"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function DemoMode({
  slides,
  onExit,
}: {
  slides: ReactNode[];
  onExit: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = slides.length;
  const next = () => setIdx((i) => Math.min(i + 1, total - 1));
  const prev = () => setIdx((i) => Math.max(i - 1, 0));

  // Enter fullscreen on mount
  useEffect(() => {
    const el = containerRef.current;
    if (el && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // fullscreen rejected (e.g. iOS) — component still works in-page
      });
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prev();
          break;
        case "Home":
          e.preventDefault();
          setIdx(0);
          break;
        case "End":
          e.preventDefault();
          setIdx(total - 1);
          break;
        case "Escape":
          e.preventDefault();
          onExit();
          break;
        case "f":
        case "F":
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            containerRef.current?.requestFullscreen().catch(() => {});
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, onExit]);

  // Detect fullscreen exit (ESC or browser UI)
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        onExit();
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [onExit]);

  // Auto-hide cursor after 2s idle
  useEffect(() => {
    const resetTimer = () => {
      setCursorVisible(true);
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
      cursorTimer.current = setTimeout(() => setCursorVisible(false), 2000);
    };
    resetTimer();
    window.addEventListener("mousemove", resetTimer);
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-[#0E1719] z-[9999]"
      style={{ cursor: cursorVisible ? "default" : "none" }}
      onClick={next}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full"
        >
          {slides[idx]}
        </motion.div>
      </AnimatePresence>

      {/* Progress bar */}
      <div className="fixed bottom-0 left-0 right-0 h-[2px] bg-white/10 z-[10000]">
        <div
          className="h-full bg-[#17B8A5] transition-[width] duration-300"
          style={{ width: `${((idx + 1) / total) * 100}%` }}
        />
      </div>

      {/* Slide counter */}
      <div
        className={`fixed bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/40 text-white/80 text-xs font-semibold tabular-nums backdrop-blur transition-opacity z-[10000] ${
          cursorVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {idx + 1} / {total}
      </div>
    </div>
  );
}
