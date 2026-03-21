"use client";

import { motion } from "framer-motion";
import {
  Hammer, Search, Compass, Bot, Cog, Crown,
  Clock, Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getProjectColor } from "./project-colors";
import type { Agent, AgentRole, AgentStatus } from "./types";

const roleConfig: Record<AgentRole, { icon: typeof Bot; label: string; color: string }> = {
  manager: { icon: Crown, label: "Manager", color: "text-amber-400" },
  builder: { icon: Hammer, label: "Builder", color: "text-blue-400" },
  reviewer: { icon: Search, label: "Reviewer", color: "text-purple-400" },
  architect: { icon: Compass, label: "Architect", color: "text-amber-400" },
  assistant: { icon: Bot, label: "Research & Docs", color: "text-autronis-accent" },
  automation: { icon: Cog, label: "Automatisering", color: "text-green-400" },
};

const statusConfig: Record<AgentStatus, { label: string; dotClass: string; borderClass: string }> = {
  idle: { label: "Stand-by", dotClass: "bg-gray-400", borderClass: "border-gray-500/20" },
  working: { label: "Actief", dotClass: "bg-green-400", borderClass: "border-green-500/25" },
  reviewing: { label: "Reviewen", dotClass: "bg-purple-400", borderClass: "border-purple-500/25" },
  error: { label: "Fout", dotClass: "bg-red-400", borderClass: "border-red-500/25" },
  offline: { label: "Offline", dotClass: "bg-gray-600", borderClass: "border-gray-600/15" },
};

function runtimeMinutes(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}u${min % 60}m`;
}

interface AgentStationProps {
  agent: Agent;
  index: number;
  onClick: (agent: Agent) => void;
}

export function AgentStation({ agent, index, onClick }: AgentStationProps) {
  const role = roleConfig[agent.rol];
  const status = statusConfig[agent.status];
  const RoleIcon = role.icon;
  const isActive = agent.status === "working" || agent.status === "reviewing";
  const projectColor = agent.huidigeTaak ? getProjectColor(agent.huidigeTaak.project) : undefined;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={() => onClick(agent)}
      className={cn(
        "relative flex flex-col gap-2.5 p-4 rounded-xl border cursor-pointer transition-all",
        "bg-autronis-card hover:bg-autronis-card-hover",
        status.borderClass,
        isActive && "shadow-md",
        agent.status === "offline" && "opacity-50",
        "group w-full text-left"
      )}
    >
      {/* Top row: icon + name + status dot */}
      <div className="flex items-center gap-2.5">
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-lg",
          "bg-autronis-border/40",
          isActive && "ring-1.5 ring-autronis-accent/30"
        )}>
          <RoleIcon className={cn("w-4.5 h-4.5", role.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-autronis-text-primary text-sm leading-tight">{agent.naam}</p>
            <span className="relative flex h-2 w-2 shrink-0">
              {isActive && (
                <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-60", status.dotClass)} />
              )}
              <span className={cn("relative inline-flex rounded-full h-2 w-2", status.dotClass)} />
            </span>
          </div>
          <p className="text-[10px] text-autronis-text-tertiary leading-tight">{role.label}</p>
        </div>
      </div>

      {/* Task info */}
      {agent.huidigeTaak ? (
        <div className="w-full">
          <p className="text-xs text-autronis-text-primary truncate leading-snug">
            {agent.huidigeTaak.beschrijving}
          </p>
          <div className="flex items-center gap-2.5 mt-1 text-[10px] text-autronis-text-tertiary">
            <span style={{ color: projectColor }} className="font-medium truncate">
              {agent.huidigeTaak.project}
            </span>
            <span className="flex items-center gap-0.5 shrink-0">
              <Clock className="w-2.5 h-2.5" />
              {runtimeMinutes(agent.huidigeTaak.startedAt)}
            </span>
            <span className="flex items-center gap-0.5 shrink-0 text-amber-400">
              <Coins className="w-2.5 h-2.5" />
              {"\u20AC"}{agent.kosten.kostenVandaag.toFixed(2)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-autronis-text-tertiary">{status.label}</p>
      )}
    </motion.button>
  );
}
