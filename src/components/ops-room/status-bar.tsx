"use client";

import { motion } from "framer-motion";
import { Activity, CheckCircle2, AlertTriangle, Power, Users, Coins } from "lucide-react";
import type { Agent } from "./types";

interface StatusBarProps {
  agents: Agent[];
  isLive?: boolean;
}

export function StatusBar({ agents, isLive = false }: StatusBarProps) {
  const active = agents.filter((a) => a.status === "working" || a.status === "reviewing").length;
  const idle = agents.filter((a) => a.status === "idle").length;
  const offline = agents.filter((a) => a.status === "offline").length;
  const errors = agents.filter((a) => a.status === "error").length;
  const totalTasks = agents.reduce((sum, a) => sum + a.voltooideVandaag, 0);
  const totalKosten = agents.reduce((sum, a) => sum + a.kosten.kostenVandaag, 0);

  const stats = [
    { label: "Actief", value: active.toString(), icon: Activity, color: "text-green-400" },
    { label: "Stand-by", value: `${idle + offline}`, icon: Power, color: "text-gray-400", sub: `${idle} idle · ${offline} offline` },
    { label: "Team", value: agents.length.toString(), icon: Users, color: "text-blue-400" },
    { label: "Fouten", value: errors.toString(), icon: AlertTriangle, color: errors > 0 ? "text-red-400" : "text-gray-500" },
    { label: "Taken vandaag", value: totalTasks.toString(), icon: CheckCircle2, color: "text-autronis-accent", mock: !isLive },
    { label: "Kosten vandaag", value: `\u20AC${totalKosten.toFixed(2)}`, icon: Coins, color: "text-amber-400", mock: !isLive },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.3 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-autronis-card border border-autronis-border/50 relative"
        >
          <stat.icon className={`w-4.5 h-4.5 shrink-0 ${stat.color}`} />
          <div className="min-w-0">
            <p className="text-lg font-bold text-autronis-text-primary leading-tight">{stat.value}</p>
            <p className="text-[10px] text-autronis-text-tertiary truncate">{stat.label}</p>
          </div>
          {stat.mock && (
            <span className="absolute top-1.5 right-1.5 text-[7px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-500/60 font-medium">
              mock
            </span>
          )}
        </motion.div>
      ))}
    </div>
  );
}
