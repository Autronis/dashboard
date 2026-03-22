"use client";

import { motion } from "framer-motion";
import {
  CircleCheck,
  AlertTriangle,
  Coins,
  TrendingUp,
  Users,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "./types";

type HealthLevel = "green" | "yellow" | "red";

interface CommandBarProps {
  agents: Agent[];
  isLive?: boolean;
}

export function CommandBar({ agents, isLive = false }: CommandBarProps) {
  const active = agents.filter((a) => a.status === "working" || a.status === "reviewing").length;
  const errors = agents.filter((a) => a.status === "error").length;
  // Only count real completed tasks (agents with live data have tokensVandaag > 0)
  const hasLive = agents.some((a) => a.kosten.tokensVandaag > 0 || a.status === "working");
  const totalTasks = hasLive
    ? agents.filter((a) => a.kosten.tokensVandaag > 0).reduce((sum, a) => sum + a.voltooideVandaag, 0)
    : agents.reduce((sum, a) => sum + a.voltooideVandaag, 0);
  // Only count costs from agents that are actually active (not mock data)
  const totalKosten = agents
    .filter((a) => a.status === "working" || a.status === "reviewing" || a.kosten.tokensVandaag > 0)
    .reduce((sum, a) => sum + a.kosten.kostenVandaag, 0);

  // Determine health level
  let health: HealthLevel = "green";
  if (errors > 0) health = "red";
  else if (totalKosten > 10 || active === 0) health = "yellow";

  const borderColor = {
    green: "border-green-500/30",
    yellow: "border-amber-500/30",
    red: "border-red-500/30",
  }[health];

  const bgColor = {
    green: "bg-green-500/5",
    yellow: "bg-amber-500/5",
    red: "bg-red-500/5",
  }[health];

  const dotColor = {
    green: "bg-green-400",
    yellow: "bg-amber-400",
    red: "bg-red-400",
  }[health];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex items-center gap-5 px-5 py-3.5 rounded-xl border transition-colors overflow-x-auto",
        borderColor, bgColor
      )}
    >
      {/* Health dot */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-60", dotColor)} />
          <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", dotColor)} />
        </span>
        {!isLive && (
          <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-500/70 font-semibold">
            DEMO
          </span>
        )}
      </div>

      <div className="h-5 w-px bg-autronis-border/50 shrink-0" />

      {/* Metrics */}
      <div className="flex items-center gap-5 text-[13px] font-medium">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-green-400">
          <Users className="w-3.5 h-3.5" />
          <strong>{active}</strong>
          <span className="text-autronis-text-tertiary font-normal text-xs">agents actief</span>
        </span>

        <span className={cn(
          "flex items-center gap-1.5 whitespace-nowrap",
          errors > 0 ? "text-red-400" : "text-autronis-text-tertiary"
        )}>
          <AlertTriangle className="w-3.5 h-3.5" />
          <strong>{errors}</strong>
          <span className="font-normal text-xs">errors</span>
        </span>

        <span className="flex items-center gap-1.5 whitespace-nowrap text-amber-400">
          <Coins className="w-3.5 h-3.5" />
          <strong>{"\u20AC"}{totalKosten.toFixed(2)}</strong>
          <span className="text-autronis-text-tertiary font-normal text-xs">vandaag</span>
        </span>

        <span className="flex items-center gap-1.5 whitespace-nowrap text-autronis-accent">
          <TrendingUp className="w-3.5 h-3.5" />
          <strong>{totalTasks}</strong>
          <span className="text-autronis-text-tertiary font-normal text-xs">taken voltooid</span>
        </span>
      </div>
    </motion.div>
  );
}
