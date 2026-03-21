"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, AlertCircle, Code2, Bot, Cog } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProjectColor } from "./project-colors";
import type { TaskLogEntry } from "./types";

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "zojuist";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}u`;
  return `${Math.floor(hours / 24)}d`;
}

function getTimeGroup(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 15) return "Zojuist";
  if (minutes < 60) return "Afgelopen uur";
  return "Vandaag";
}

// Categorize by project type
function getCategory(project: string): "dev" | "system" | "docs" {
  if (project === "Systeem" || project === "Alle projecten") return "system";
  if (project === "Documenten") return "docs";
  return "dev";
}

const categoryIcons = {
  dev: Code2,
  system: Cog,
  docs: Bot,
};

const statusIcons = {
  afgerond: { icon: CheckCircle2, color: "text-green-400" },
  bezig: { icon: Loader2, color: "text-blue-400" },
  fout: { icon: AlertCircle, color: "text-red-400" },
} as const;

type FilterType = "alle" | "dev" | "system" | "docs";

interface TaskFeedProps {
  entries: TaskLogEntry[];
  isDemo?: boolean;
  onAgentClick?: (agentId: string) => void;
}

export function TaskFeed({ entries, isDemo = true, onAgentClick }: TaskFeedProps) {
  const [filter, setFilter] = useState<FilterType>("alle");

  const filtered = useMemo(() => {
    if (filter === "alle") return entries;
    return entries.filter((e) => getCategory(e.project) === filter);
  }, [entries, filter]);

  // Group by time
  const grouped = useMemo(() => {
    const groups: Record<string, TaskLogEntry[]> = {};
    filtered.forEach((e) => {
      const group = getTimeGroup(e.tijdstip);
      if (!groups[group]) groups[group] = [];
      groups[group].push(e);
    });
    return groups;
  }, [filtered]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "alle", label: "Alle" },
    { key: "dev", label: "Dev" },
    { key: "system", label: "Systeem" },
    { key: "docs", label: "AI" },
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider">
          Activiteit
        </h3>
        {isDemo && (
          <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-500/60 font-semibold">
            DEMO
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-2 py-1 rounded text-[10px] font-medium transition-colors",
              filter === f.key
                ? "bg-autronis-accent/15 text-autronis-accent"
                : "text-autronis-text-tertiary hover:text-autronis-text-secondary"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grouped entries */}
      <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto scrollbar-thin">
        {Object.entries(grouped).map(([groupName, items]) => (
          <div key={groupName}>
            <p className="text-[9px] font-semibold text-autronis-text-tertiary uppercase tracking-wider mb-1.5 px-1">
              {groupName}
            </p>
            <div className="flex flex-col gap-1">
              {items.map((entry, i) => {
                const { icon: StatusIcon, color } = statusIcons[entry.status];
                const projectColor = getProjectColor(entry.project);
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    onClick={() => onAgentClick?.(entry.agentId)}
                    className="flex items-start gap-2 px-2.5 py-2 rounded-lg hover:bg-autronis-card-hover transition-colors cursor-pointer"
                  >
                    <StatusIcon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", color)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-autronis-text-primary leading-snug">
                        <span className="font-medium" style={{ color: projectColor }}>{entry.agentNaam}</span>
                        {" "}{entry.beschrijving}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px]" style={{ color: projectColor }}>{entry.project}</span>
                        <span className="text-[9px] text-autronis-text-tertiary">{timeAgo(entry.tijdstip)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
