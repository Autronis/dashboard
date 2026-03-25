"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Coins,
  TrendingUp,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "./types";

function useSessionTimer(): string {
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 10000);
    return () => clearInterval(id);
  }, []);
  const min = Math.floor(elapsed / 60000);
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}u${min % 60}m`;
}

// Mini donut ring for occupancy
function OccupancyRing({ active, idle, error, total }: { active: number; idle: number; error: number; total: number }) {
  const R = 13;
  const circ = 2 * Math.PI * R;
  const safe = total || 1;
  const segs = [
    { count: active, color: "#4ade80" },
    { count: error,  color: "#f87171" },
    { count: idle,   color: "#374151" },
  ];
  let offset = 0;
  const arcs = segs.map((s) => {
    const dash = (s.count / safe) * circ;
    const arc = { dash, offset, color: s.color };
    offset += dash;
    return arc;
  });
  return (
    <svg width={34} height={34} viewBox="0 0 34 34" className="shrink-0" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={17} cy={17} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      {arcs.map((arc, i) => arc.dash > 0 && (
        <circle key={i} cx={17} cy={17} r={R} fill="none" stroke={arc.color} strokeWidth={5}
          strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
          strokeDashoffset={circ / 4 - arc.offset} />
      ))}
    </svg>
  );
}

function costColor(cost: number): string {
  if (cost < 1) return "text-green-400";
  if (cost < 5) return "text-amber-400";
  return "text-red-400";
}

type HealthLevel = "green" | "yellow" | "red";

interface CommandBarProps {
  agents: Agent[];
  isLive?: boolean;
}

export function CommandBar({ agents, isLive = false }: CommandBarProps) {
  const sessionTime = useSessionTimer();
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

  const idle = agents.filter((a) => a.status === "idle" || a.status === "offline").length;
  const teamSem = agents.filter((a) => a.team === "sem");
  const teamSyb = agents.filter((a) => a.team === "syb");
  const activeSem = teamSem.filter((a) => a.status === "working" || a.status === "reviewing").length;
  const activeSyb = teamSyb.filter((a) => a.status === "working" || a.status === "reviewing").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex items-center gap-4 px-4 py-2.5 rounded-xl border transition-colors overflow-x-auto",
        borderColor, bgColor
      )}
    >
      {/* Occupancy ring */}
      <div className="relative flex items-center justify-center shrink-0">
        <OccupancyRing active={active} idle={idle} error={errors} total={agents.length} />
        <span className="absolute text-[9px] font-bold text-white tabular-nums" style={{ transform: "translateY(-1px)" }}>
          {active}
        </span>
      </div>

      {/* Team breakdown */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-autronis-accent shrink-0" />
          <span className="text-[10px] text-autronis-text-tertiary">Sem</span>
          <span className="text-[10px] font-semibold text-autronis-text-primary tabular-nums">{activeSem}/{teamSem.length}</span>
        </div>
        {teamSyb.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
            <span className="text-[10px] text-autronis-text-tertiary">Syb</span>
            <span className="text-[10px] font-semibold text-autronis-text-primary tabular-nums">{activeSyb}/{teamSyb.length}</span>
          </div>
        )}
      </div>

      <div className="h-5 w-px bg-autronis-border/50 shrink-0" />

      {/* Metrics */}
      <div className="flex items-center gap-4 text-[12px] font-medium flex-1 flex-wrap">
        {errors > 0 && (
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="flex items-center gap-1.5 whitespace-nowrap text-red-400"
          >
            <AlertTriangle className="w-3 h-3" />
            <strong>{errors}</strong>
            <span className="font-normal text-[10px]">fouten</span>
          </motion.span>
        )}

        <span className={cn("flex items-center gap-1.5 whitespace-nowrap tabular-nums", costColor(totalKosten))}>
          <Coins className="w-3 h-3" />
          <strong>{"\u20AC"}{totalKosten.toFixed(2)}</strong>
          <span className="text-autronis-text-tertiary font-normal text-[10px]">vandaag</span>
        </span>

        <span className="flex items-center gap-1.5 whitespace-nowrap text-autronis-accent">
          <TrendingUp className="w-3 h-3" />
          <strong>{totalTasks}</strong>
          <span className="text-autronis-text-tertiary font-normal text-[10px]">taken</span>
        </span>

        <span className="ml-auto flex items-center gap-1 text-[9px] text-autronis-text-tertiary shrink-0 tabular-nums">
          <Timer className="w-2.5 h-2.5" />
          {sessionTime}
        </span>

        {!isLive && (
          <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-500/70 font-semibold shrink-0">
            DEMO
          </span>
        )}
      </div>
    </motion.div>
  );
}
