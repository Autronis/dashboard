"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X, Hammer, Search, Compass, Bot, Cog, Crown,
  Clock, CheckCircle2, Activity, Coins, Zap,
  FileCode, ExternalLink, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MiniTerminal } from "./mini-terminal";
import { getProjectColor } from "./project-colors";
import type { Agent, AgentRole } from "./types";
import type { TaskLogEntry } from "./types";

const roleIcons: Record<AgentRole, typeof Bot> = {
  manager: Crown, builder: Hammer, reviewer: Search,
  architect: Compass, assistant: Bot, automation: Cog,
};

const roleLabels: Record<AgentRole, string> = {
  manager: "Manager", builder: "Builder", reviewer: "Reviewer",
  architect: "Architect", assistant: "Assistent", automation: "Automation",
};

const roleColors: Record<AgentRole, string> = {
  manager: "text-amber-400", builder: "text-blue-400", reviewer: "text-purple-400",
  architect: "text-amber-400", assistant: "text-autronis-accent", automation: "text-green-400",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  idle: { label: "Stand-by", color: "text-gray-400" },
  working: { label: "Actief", color: "text-green-400" },
  reviewing: { label: "Reviewen", color: "text-purple-400" },
  error: { label: "Fout", color: "text-red-400" },
  offline: { label: "Offline", color: "text-gray-500" },
};

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "zojuist";
  if (min < 60) return `${min}m geleden`;
  return `${Math.floor(min / 60)}u geleden`;
}

function runtimeMinutes(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}u${min % 60}m`;
}

interface AgentDetailProps {
  agent: Agent | null;
  recentTasks: TaskLogEntry[];
  onClose: () => void;
}

export function AgentDetail({ agent, recentTasks, onClose }: AgentDetailProps) {
  return (
    <AnimatePresence>
      {agent && (
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 30 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="rounded-2xl border border-autronis-border bg-autronis-card p-4 flex flex-col gap-3"
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-lg"
                style={{ backgroundColor: `${agent.avatar}20` }}
              >
                {(() => {
                  const Icon = roleIcons[agent.rol];
                  return <Icon className={cn("w-5 h-5", roleColors[agent.rol])} />;
                })()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-autronis-text-primary text-sm">{agent.naam}</h3>
                  <span className={cn("text-[10px] font-medium", statusConfig[agent.status].color)}>
                    {statusConfig[agent.status].label}
                  </span>
                </div>
                <p className="text-[10px] text-autronis-text-tertiary">{roleLabels[agent.rol]}</p>
              </div>
            </div>
            <button onClick={onClose}
              className="p-1 rounded-md hover:bg-autronis-border/50 text-autronis-text-tertiary transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Current task */}
          {agent.huidigeTaak && (() => {
            const projectColor = getProjectColor(agent.huidigeTaak.project);
            return (
              <div className="p-3 rounded-lg bg-autronis-bg border border-autronis-border/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] font-semibold text-green-400">Huidige taak</span>
                </div>
                <p className="text-xs text-autronis-text-primary font-medium">{agent.huidigeTaak.beschrijving}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-autronis-text-tertiary">
                  <span style={{ color: projectColor }} className="font-medium">{agent.huidigeTaak.project}</span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {runtimeMinutes(agent.huidigeTaak.startedAt)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Zap className="w-2.5 h-2.5" />
                    {agent.kosten.tokensHuidigeTaak > 0 ? `${(agent.kosten.tokensHuidigeTaak / 1000).toFixed(1)}k` : "0"} tokens
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Errors */}
          {agent.status === "error" && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-400">Agent heeft een fout gemeld. Check de logs hieronder.</p>
            </div>
          )}

          {/* Terminal / Session logs */}
          {agent.terminal.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-autronis-text-tertiary uppercase tracking-wider mb-1.5">
                Sessie logs
              </p>
              <MiniTerminal lines={agent.terminal} />
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-autronis-bg border border-autronis-border/40 text-center">
              <p className="text-base font-bold text-autronis-text-primary">{agent.voltooideVandaag}</p>
              <p className="text-[9px] text-autronis-text-tertiary">Taken</p>
            </div>
            <div className="p-2 rounded-lg bg-autronis-bg border border-autronis-border/40 text-center">
              <p className="text-base font-bold text-autronis-text-primary">
                {agent.kosten.tokensVandaag >= 1000
                  ? `${(agent.kosten.tokensVandaag / 1000).toFixed(0)}k`
                  : agent.kosten.tokensVandaag}
              </p>
              <p className="text-[9px] text-autronis-text-tertiary">Tokens</p>
            </div>
            <div className="p-2 rounded-lg bg-autronis-bg border border-autronis-border/40 text-center">
              <p className="text-base font-bold text-amber-400">{"\u20AC"}{agent.kosten.kostenVandaag.toFixed(2)}</p>
              <p className="text-[9px] text-autronis-text-tertiary">Kosten</p>
            </div>
          </div>

          {/* Recent completed tasks */}
          {recentTasks.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-autronis-text-tertiary uppercase tracking-wider mb-1.5">
                Laatste acties
              </p>
              <div className="flex flex-col gap-1">
                {recentTasks.map((task) => (
                  <div key={task.id}
                    className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-autronis-bg/50 text-[11px]"
                  >
                    <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                    <span className="text-autronis-text-primary truncate flex-1">{task.beschrijving}</span>
                    <span className="text-autronis-text-tertiary shrink-0 text-[9px]">{timeAgo(task.tijdstip)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {agent.huidigeTaak && (
              <>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-accent/10 text-autronis-accent text-[11px] font-medium hover:bg-autronis-accent/20 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  Open project
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-border/30 text-autronis-text-secondary text-[11px] font-medium hover:bg-autronis-border/50 transition-colors">
                  <FileCode className="w-3 h-3" />
                  VS Code
                </button>
              </>
            )}
            {(agent.status === "working" || agent.status === "reviewing") && (
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors">
                <AlertCircle className="w-3 h-3" />
                Stop agent
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
