"use client";

import { motion } from "framer-motion";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TerminalLine } from "./types";

const lineColors: Record<TerminalLine["type"], string> = {
  command: "text-blue-400",
  info: "text-autronis-text-secondary",
  success: "text-emerald-400",
  error: "text-red-400",
};

const linePrefixes: Record<TerminalLine["type"], string> = {
  command: "$",
  info: ">",
  success: "OK",
  error: "!!",
};

interface MiniTerminalProps {
  lines: TerminalLine[];
  compact?: boolean;
}

export function MiniTerminal({ lines, compact = false }: MiniTerminalProps) {
  const visibleLines = lines.slice(-3);

  return (
    <div className={cn(
      "rounded-lg bg-[#0d1117] border border-[#1a2530] font-mono overflow-hidden",
      compact ? "p-2" : "p-3"
    )}>
      {/* Terminal header */}
      <div className="flex items-center gap-1.5 mb-2">
        <Terminal className="w-3 h-3 text-autronis-text-tertiary" />
        <span className="text-[10px] text-autronis-text-tertiary uppercase tracking-wider">Terminal</span>
        <div className="flex items-center gap-1 ml-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/60" />
          <span className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
        </div>
      </div>

      {/* Lines */}
      <div className="flex flex-col gap-0.5">
        {visibleLines.map((line, i) => (
          <motion.div
            key={line.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.2 }}
            className="flex items-start gap-1.5"
          >
            <span className={cn("text-[10px] shrink-0 w-3 text-right", lineColors[line.type])}>
              {linePrefixes[line.type]}
            </span>
            <span className={cn(
              "text-[10px] leading-relaxed truncate",
              lineColors[line.type]
            )}>
              {line.tekst}
            </span>
          </motion.div>
        ))}
        {/* Blinking cursor */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-autronis-text-tertiary w-3 text-right">$</span>
          <span className="w-1.5 h-3 bg-autronis-accent/70 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
