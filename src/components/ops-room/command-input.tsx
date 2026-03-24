"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Send, Loader2, AlertCircle, ShieldAlert, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOrchestrator } from "./orchestrator-store";

const SLASH_COMMANDS = [
  { cmd: "/plan", desc: "Maak een gedetailleerd plan zonder direct uit te voeren" },
  { cmd: "/review", desc: "Review de laatste agent output" },
  { cmd: "/status", desc: "Toon overzicht van alle agents" },
  { cmd: "/abort", desc: "Stop de huidige uitvoering direct" },
];

export function CommandInput() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [killArmed, setKillArmed] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { submitCommand, isProcessing, executingTaskId, killExecution } = useOrchestrator();

  // Auto-disarm after 3s
  useEffect(() => {
    if (killArmed) {
      armTimerRef.current = setTimeout(() => setKillArmed(false), 3000);
    }
    return () => { if (armTimerRef.current) clearTimeout(armTimerRef.current); };
  }, [killArmed]);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || isProcessing) return;

    if (trimmed === "/abort") {
      killExecution();
      setValue("");
      return;
    }

    setValue("");
    setError(null);
    setHistory((prev) => [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 30));
    setHistoryIndex(-1);
    try {
      await submitCommand(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opdracht mislukt");
    }
  }, [value, isProcessing, submitCommand, killExecution]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const nextIdx = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(nextIdx);
      if (history[nextIdx] !== undefined) setValue(history[nextIdx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIdx = Math.max(historyIndex - 1, -1);
      setHistoryIndex(nextIdx);
      setValue(nextIdx === -1 ? "" : (history[nextIdx] ?? ""));
    }
  }, [handleSubmit, historyIndex, history]);

  const showSlash = value.startsWith("/") && !value.includes(" ");
  const matchingSlash = SLASH_COMMANDS.filter((c) => c.cmd.startsWith(value.toLowerCase()));

  return (
    <div className="relative flex items-center gap-2">
      <div className="flex-1 relative">
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setHistoryIndex(-1); }}
          onKeyDown={handleKeyDown}
          placeholder="Geef een opdracht... (↑ geschiedenis · / commando's)"
          disabled={isProcessing}
          className="w-full px-4 py-2.5 rounded-xl bg-autronis-card border border-autronis-border/50 text-sm text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50 disabled:opacity-50 transition-colors"
        />
        {isProcessing && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-autronis-accent">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-[10px] font-medium">Theo maakt plan...</span>
          </div>
        )}

        {/* Slash command autocomplete */}
        <AnimatePresence>
          {showSlash && matchingSlash.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 right-0 mb-1.5 rounded-xl border border-autronis-border/50 bg-autronis-card shadow-xl overflow-hidden z-20"
            >
              {matchingSlash.map((c) => (
                <button
                  key={c.cmd}
                  onMouseDown={(e) => { e.preventDefault(); setValue(c.cmd + " "); }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-autronis-card-hover text-left transition-colors"
                >
                  <span className="text-xs font-mono font-bold text-autronis-accent w-16 shrink-0">{c.cmd}</span>
                  <span className="text-[11px] text-autronis-text-tertiary">{c.desc}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Kill switch: arm → confirm → fire */}
      {executingTaskId ? (
        <AnimatePresence mode="wait">
          {!killArmed ? (
            <motion.button
              key="arm"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setKillArmed(true)}
              className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-[11px] font-medium shrink-0"
              title="Stop uitvoering"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Stop
            </motion.button>
          ) : (
            <motion.button
              key="confirm"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: [1, 1.06, 1], opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => { killExecution(); setKillArmed(false); }}
              className="flex items-center gap-1.5 px-3 h-10 rounded-xl border border-red-500/60 bg-red-500/25 text-red-300 text-[11px] font-bold shrink-0 animate-pulse"
            >
              <Zap className="w-3.5 h-3.5" />
              Bevestig stop!
            </motion.button>
          )}
        </AnimatePresence>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isProcessing}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      )}

      {error && (
        <div className="absolute -bottom-8 left-0 flex items-center gap-1 text-red-400 text-[11px]">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}
