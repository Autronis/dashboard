"use client";

import { motion } from "framer-motion";
import {
  Hammer,
  Search,
  Compass,
  Bot,
  Cog,
  Coins,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, AgentRole, AgentStatus } from "./types";

const roleConfig: Record<AgentRole, { icon: typeof Bot; color: string; bgGradient: string }> = {
  manager: { icon: Crown, color: "text-amber-400", bgGradient: "from-amber-500/10 to-amber-500/5" },
  builder: { icon: Hammer, color: "text-blue-400", bgGradient: "from-blue-500/10 to-blue-500/5" },
  reviewer: { icon: Search, color: "text-purple-400", bgGradient: "from-purple-500/10 to-purple-500/5" },
  architect: { icon: Compass, color: "text-amber-400", bgGradient: "from-amber-500/10 to-amber-500/5" },
  assistant: { icon: Bot, color: "text-autronis-accent", bgGradient: "from-autronis-accent/10 to-autronis-accent/5" },
  automation: { icon: Cog, color: "text-green-400", bgGradient: "from-green-500/10 to-green-500/5" },
};

const statusDotColor: Record<AgentStatus, string> = {
  idle: "bg-gray-400",
  working: "bg-green-400",
  reviewing: "bg-purple-400",
  error: "bg-red-400",
  offline: "bg-gray-600",
};

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}

interface IsometricGridProps {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (agent: Agent) => void;
}

export function IsometricGrid({ agents, selectedId, onSelect }: IsometricGridProps) {
  return (
    <div className="relative w-full">
      {/* Isometric floor grid (decorative) */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(30deg, var(--accent) 1px, transparent 1px),
              linear-gradient(150deg, var(--accent) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Agent desks */}
      <div className="relative grid grid-cols-2 md:grid-cols-3 gap-5 p-4" style={{ perspective: "1200px" }}>
        {agents.map((agent, i) => {
          const role = roleConfig[agent.rol];
          const RoleIcon = role.icon;
          const isActive = agent.status === "working" || agent.status === "reviewing";
          const isSelected = selectedId === agent.id;

          return (
            <motion.button
              key={agent.id}
              initial={{ opacity: 0, y: 40, rotateX: 10 }}
              animate={{
                opacity: 1,
                y: 0,
                rotateX: 0,
                scale: isSelected ? 1.03 : 1,
              }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
              whileHover={{
                y: -8,
                rotateX: -2,
                scale: 1.03,
                transition: { duration: 0.2 },
              }}
              onClick={() => onSelect(agent)}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-2xl border p-5 cursor-pointer transition-all",
                "bg-gradient-to-b",
                role.bgGradient,
                isSelected
                  ? "border-autronis-accent/50 ring-1 ring-autronis-accent/30"
                  : "border-autronis-border/40 hover:border-autronis-border",
                agent.status === "offline" && "opacity-50",
                "group text-left w-full",
              )}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Desk surface shadow (3D effect) */}
              <div
                className="absolute -bottom-2 left-3 right-3 h-3 rounded-b-2xl bg-black/10 blur-md"
                style={{ transform: "translateZ(-10px)" }}
              />

              {/* Status indicator */}
              <div className="absolute top-3 right-3">
                <span className="relative flex h-2.5 w-2.5">
                  {isActive && (
                    <span className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      statusDotColor[agent.status]
                    )} />
                  )}
                  <span className={cn(
                    "relative inline-flex rounded-full h-2.5 w-2.5",
                    statusDotColor[agent.status]
                  )} />
                </span>
              </div>

              {/* Agent icon (the "person at desk") */}
              <motion.div
                animate={isActive ? {
                  y: [0, -3, 0],
                  rotate: agent.rol === "automation" ? [0, 360] : undefined,
                } : {}}
                transition={isActive ? {
                  duration: agent.rol === "automation" ? 4 : 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                } : {}}
                className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-xl",
                  "bg-autronis-card/80 border border-autronis-border/50",
                  isActive && "shadow-lg"
                )}
              >
                <RoleIcon className={cn("w-6 h-6", role.color)} />
              </motion.div>

              {/* Name plate */}
              <div className="text-center">
                <p className="font-semibold text-sm text-autronis-text-primary">{agent.naam}</p>
                {agent.huidigeTaak ? (
                  <p className="text-[10px] text-autronis-text-secondary mt-0.5 truncate max-w-[140px]">
                    {agent.huidigeTaak.beschrijving}
                  </p>
                ) : (
                  <p className="text-[10px] text-autronis-text-tertiary mt-0.5">
                    {agent.status === "offline" ? "Offline" : "Stand-by"}
                  </p>
                )}
              </div>

              {/* Desk items: mini monitor with last terminal line */}
              {agent.terminal.length > 0 && (
                <div className="w-full mt-1 px-1">
                  <div className="bg-[#0d1117] rounded-md px-2 py-1.5 border border-[#1a2530]">
                    <p className="text-[9px] font-mono text-green-400/80 truncate">
                      {agent.terminal[agent.terminal.length - 1].tekst}
                    </p>
                  </div>
                </div>
              )}

              {/* Bottom stats */}
              <div className="flex items-center justify-between w-full text-[10px] text-autronis-text-tertiary mt-1">
                <span>{agent.voltooideVandaag} taken</span>
                <span className="flex items-center gap-0.5">
                  <Coins className="w-2.5 h-2.5" />
                  {"\u20AC"}{agent.kosten.kostenVandaag.toFixed(2)}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
