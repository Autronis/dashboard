"use client";

import { motion } from "framer-motion";
import { TrendingUp, Coins, CheckCircle2, Zap, Users } from "lucide-react";
import type { Agent } from "./types";

interface DailySummaryProps {
  agents: Agent[];
  isLive?: boolean;
}

export function DailySummary({ agents, isLive = false }: DailySummaryProps) {
  const totalTasks = agents.reduce((sum, a) => sum + a.voltooideVandaag, 0);
  const totalKosten = agents.reduce((sum, a) => sum + a.kosten.kostenVandaag, 0);
  const activeAgents = agents.filter((a) => a.status === "working" || a.status === "reviewing").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center gap-6 px-5 py-3 rounded-xl bg-autronis-card/50 border border-autronis-border/30 overflow-x-auto"
    >
      <div className="flex items-center gap-2 text-autronis-text-secondary">
        <TrendingUp className="w-4 h-4 text-autronis-accent shrink-0" />
        <span className="text-xs font-medium whitespace-nowrap">Dagoverzicht</span>
      </div>

      <div className="h-4 w-px bg-autronis-border shrink-0" />

      <div className="flex items-center gap-4 text-[12px]">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-autronis-text-primary">
          <Zap className="w-3.5 h-3.5 text-green-400" />
          <strong>{activeAgents}</strong>/{agents.length} actief
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap text-autronis-text-primary">
          <CheckCircle2 className="w-3.5 h-3.5 text-autronis-accent" />
          <strong>{totalTasks}</strong> taken
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap text-amber-400">
          <Coins className="w-3.5 h-3.5" />
          <strong>{"\u20AC"}{totalKosten.toFixed(2)}</strong>
        </span>
        {!isLive && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500/60 font-medium whitespace-nowrap">
            demo data
          </span>
        )}
      </div>
    </motion.div>
  );
}
