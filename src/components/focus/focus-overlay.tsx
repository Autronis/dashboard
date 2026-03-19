"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, Square, Target, Volume2, VolumeX } from "lucide-react";
import { useFocus } from "@/hooks/use-focus";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

// Ambient sound via Web Audio API (brown noise)
function useAmbientSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const toggle = useCallback(() => {
    if (isPlaying) {
      // Stop
      try {
        sourceRef.current?.stop();
        sourceRef.current = null;
      } catch { /* already stopped */ }
      setIsPlaying(false);
      return;
    }

    // Start brown noise
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const bufferSize = ctx.sampleRate * 60; // 60 sec loop
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // volume boost
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = ctx.createGain();
      gain.gain.value = 0.15;

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      sourceRef.current = source;
      gainRef.current = gain;
      setIsPlaying(true);
    } catch { /* Audio not supported */ }
  }, [isPlaying]);

  const cleanup = useCallback(() => {
    try { sourceRef.current?.stop(); } catch { /* noop */ }
    sourceRef.current = null;
    setIsPlaying(false);
  }, []);

  return { isPlaying, toggle, cleanup };
}

function formatCountdown(seconden: number): string {
  const min = Math.floor(seconden / 60);
  const sec = seconden % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function FocusOverlay() {
  const focus = useFocus();
  const [showStopDialog, setShowStopDialog] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ambient = useAmbientSound();

  // Cleanup ambient when overlay closes
  useEffect(() => {
    if (!focus.showOverlay || !focus.isActive) {
      ambient.cleanup();
    }
  }, [focus.showOverlay, focus.isActive, ambient.cleanup]);

  // Tick interval
  useEffect(() => {
    if (!focus.isActive || focus.isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    // Immediate tick
    focus.tick();

    intervalRef.current = setInterval(() => {
      focus.tick();
    }, 1000);

    // Backup timeout for exact completion
    if (focus.resterend > 0) {
      timeoutRef.current = setTimeout(() => {
        focus.tick();
      }, focus.resterend * 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.isActive, focus.isPaused]);

  // Visibility change — force tick when tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && focus.isActive) {
        focus.tick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.isActive]);

  // Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focus.showOverlay) {
        setShowStopDialog(true);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [focus.showOverlay]);

  const progress =
    focus.geplandeDuur > 0
      ? ((focus.geplandeDuur - focus.resterend) / focus.geplandeDuur) * 100
      : 0;

  const circumference = 2 * Math.PI * 140; // radius 140
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const handleStop = () => {
    setShowStopDialog(false);
    // Show reflectie modal instead of stopping directly
    useFocus.setState({ showReflectie: true, showOverlay: false });
  };

  return (
    <>
      <AnimatePresence>
        {focus.showOverlay && focus.isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
            style={{
              background:
                "radial-gradient(ellipse at center, #1a2a2e 0%, #0E1719 70%)",
            }}
          >
            {/* Progress ring + timer */}
            <div className="relative flex items-center justify-center">
              <svg width="320" height="320" className="transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="160"
                  cy="160"
                  r="140"
                  fill="none"
                  stroke="#2A3538"
                  strokeWidth="6"
                />
                {/* Progress circle */}
                <circle
                  cx="160"
                  cy="160"
                  r="140"
                  fill="none"
                  stroke="#17B8A5"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </svg>

              {/* Timer text centered in ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-7xl font-mono font-bold text-autronis-text-primary tabular-nums tracking-tight">
                  {formatCountdown(focus.resterend)}
                </span>
                {focus.isPaused && (
                  <span className="text-sm text-autronis-accent mt-2 animate-pulse">
                    Gepauzeerd
                  </span>
                )}
              </div>
            </div>

            {/* Project + taak info */}
            <div className="mt-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Target className="w-4 h-4 text-autronis-accent" />
                <span className="text-lg font-medium text-autronis-text-primary">
                  {focus.projectNaam}
                </span>
              </div>
              {focus.taakTitel && (
                <p className="text-sm text-autronis-text-secondary">
                  {focus.taakTitel}
                </p>
              )}
            </div>

            {/* Controls */}
            <div className="mt-10 flex items-center gap-4">
              <button
                onClick={() =>
                  focus.isPaused ? focus.resume() : focus.pause()
                }
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-autronis-card border border-autronis-border text-autronis-text-primary hover:border-autronis-accent/50 transition-colors"
              >
                {focus.isPaused ? (
                  <>
                    <Play className="w-5 h-5" />
                    Hervatten
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5" />
                    Pauze
                  </>
                )}
              </button>

              <button
                onClick={ambient.toggle}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 rounded-xl border transition-colors",
                  ambient.isPlaying
                    ? "bg-autronis-accent/10 border-autronis-accent/30 text-autronis-accent"
                    : "bg-autronis-card border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/50"
                )}
                title={ambient.isPlaying ? "Geluid uit" : "Ambient geluid"}
              >
                {ambient.isPlaying ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setShowStopDialog(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <Square className="w-5 h-5" />
                Stop
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={showStopDialog}
        onClose={() => setShowStopDialog(false)}
        onBevestig={handleStop}
        titel="Focus sessie stoppen?"
        bericht="De timer stopt en de tijd tot nu toe wordt geregistreerd."
        bevestigTekst="Stoppen"
        variant="warning"
      />
    </>
  );
}
