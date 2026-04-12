"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Coins } from "lucide-react";
import type { Agent } from "./types";

interface StatusBarProps {
  agents: Agent[];
  isLive?: boolean;
}

// SVG donut ring showing segment breakdown
function OccupancyRing({ active, idle, error, offline, total }: {
  active: number; idle: number; error: number; offline: number; total: number;
}) {
  const R = 22;
  const circumference = 2 * Math.PI * R;
  const safeTotal = total || 1;

  // Segments: working (green), error (red), idle (gray), offline (dark)
  const segs = [
    { count: active, color: "#4ade80" },
    { count: error,  color: "#f87171" },
    { count: idle,   color: "#6b7280" },
    { count: offline,color: "#374151" },
  ];

  let offset = 0;
  const arcs = segs.map((seg) => {
    const dash = (seg.count / safeTotal) * circumference;
    const arc = { dash, offset, color: seg.color };
    offset += dash;
    return arc;
  });

  return (
    <svg width={56} height={56} viewBox="0 0 56 56" className="shrink-0">
      <circle cx={28} cy={28} r={R} fill="none" stroke="var(--border)" strokeWidth={6} opacity={0.3} />
      {arcs.map((arc, i) => arc.dash > 0 && (
        <circle
          key={i}
          cx={28} cy={28} r={R}
          fill="none"
          stroke={arc.color}
          strokeWidth={6}
          strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
          strokeDashoffset={circumference / 4 - arc.offset}
          strokeLinecap="butt"
        />
      ))}
      <text x={28} y={31} textAnchor="middle" fontSize={11} fontWeight={700} fill="white">
        {active}/{total}
      </text>
    </svg>
  );
}

function costColorClass(cost: number): string {
  if (cost < 1) return "text-emerald-400";
  if (cost < 5) return "text-amber-400";
  return "text-red-400";
}

export function StatusBar({ agents, isLive = false }: StatusBarProps) {
  const active = agents.filter((a) => a.status === "working" || a.status === "reviewing").length;
  const idle = agents.filter((a) => a.status === "idle").length;
  const offline = agents.filter((a) => a.status === "offline").length;
  const errors = agents.filter((a) => a.status === "error").length;
  const totalTasks = agents.reduce((sum, a) => sum + a.voltooideVandaag, 0);
  const totalKosten = agents.reduce((sum, a) => sum + a.kosten.kostenVandaag, 0);

  const teamSem = agents.filter((a) => a.team === "sem");
  const teamSyb = agents.filter((a) => a.team === "syb");
  const activeSem = teamSem.filter((a) => a.status === "working" || a.status === "reviewing").length;
  const activeSyb = teamSyb.filter((a) => a.status === "working" || a.status === "reviewing").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-wrap gap-3 p-4 rounded-xl bg-autronis-card border border-autronis-border/50"
    >
      {/* Bezettingsgraad ring */}
      <div className="flex items-center gap-4">
        <OccupancyRing active={active} idle={idle} error={errors} offline={offline} total={agents.length} />
        <div className="space-y-1 min-w-[100px]">
          <p className="text-xs font-semibold text-autronis-text-primary">Bezetting</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {active > 0 && <span className="text-[10px] text-emerald-400 font-medium">{active} actief</span>}
            {idle > 0 && <span className="text-[10px] text-gray-400">{idle} idle</span>}
            {errors > 0 && <span className="text-[10px] text-red-400 font-medium">{errors} fout</span>}
            {offline > 0 && <span className="text-[10px] text-gray-600">{offline} offline</span>}
          </div>
          {/* Team breakdown */}
          <div className="flex gap-3 pt-0.5">
            <span className="text-[9px] text-autronis-text-tertiary">
              Sem: <span className="text-autronis-accent font-medium">{activeSem}/{teamSem.length}</span>
            </span>
            {teamSyb.length > 0 && (
              <span className="text-[9px] text-autronis-text-tertiary">
                Syb: <span className="text-blue-400 font-medium">{activeSyb}/{teamSyb.length}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-autronis-border/30 self-stretch mx-1 hidden md:block" />

      {/* Stat pills */}
      <div className="flex flex-wrap items-center gap-3 flex-1">
        {/* Taken vandaag */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-autronis-bg border border-autronis-border/30 relative">
          <CheckCircle2 className="w-3.5 h-3.5 text-autronis-accent shrink-0" />
          <div>
            <p className="text-sm font-bold text-autronis-text-primary leading-tight">{totalTasks}</p>
            <p className="text-[9px] text-autronis-text-tertiary">taken vandaag</p>
          </div>
          {!isLive && (
            <span className="absolute -top-1 -right-1 text-[7px] px-1 rounded bg-amber-500/15 text-amber-500/70 font-medium">mock</span>
          )}
        </div>

        {/* Kosten vandaag */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-autronis-bg border border-autronis-border/30 relative">
          <Coins className={`w-3.5 h-3.5 shrink-0 ${costColorClass(totalKosten)}`} />
          <div>
            <p className={`text-sm font-bold leading-tight tabular-nums ${costColorClass(totalKosten)}`}>
              {"\u20AC"}{totalKosten.toFixed(2)}
            </p>
            <p className="text-[9px] text-autronis-text-tertiary">kosten vandaag</p>
          </div>
          {!isLive && (
            <span className="absolute -top-1 -right-1 text-[7px] px-1 rounded bg-amber-500/15 text-amber-500/70 font-medium">mock</span>
          )}
        </div>

        {/* Fouten */}
        {errors > 0 && (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-400 leading-tight">{errors}</p>
              <p className="text-[9px] text-red-400/70">fouten</p>
            </div>
          </motion.div>
        )}

        {/* Live indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
          <span className="text-[10px] text-autronis-text-tertiary">{isLive ? "LIVE" : "mock"}</span>
        </div>
      </div>
    </motion.div>
  );
}
