"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, AlertCircle, Code2, Bot, Cog, Pencil, Eye, Terminal, FileSearch, FileOutput } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProjectColor } from "./project-colors";
import { PixelAvatar } from "./pixel-avatar";
import type { TaskLogEntry, ToolType } from "./types";

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "nu";
  if (seconds < 60) return `${seconds}s geleden`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}u geleden`;
  return `${Math.floor(hours / 24)}d geleden`;
}

function getTimeGroup(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 15) return "Zojuist";
  if (minutes < 60) return "Afgelopen uur";
  return "Vandaag";
}

function getCategory(project: string): "dev" | "system" | "docs" {
  if (project === "Systeem" || project === "Alle projecten") return "system";
  if (project === "Documenten") return "docs";
  return "dev";
}

// Infer tool type from beschrijving if not explicitly set
function inferToolType(beschrijving: string): ToolType {
  const lower = beschrijving.toLowerCase();
  if (lower.includes("error") || lower.includes("fout") || lower.includes("crash") || lower.includes("failed")) return "error";
  if (lower.includes("edit") || lower.includes("gewijzigd") || lower.includes("aangepast") || lower.includes("gebouwd") || lower.includes("toegevoegd") || lower.includes("refactor")) return "edit";
  if (lower.includes("gelezen") || lower.includes("review") || lower.includes("geanalyseerd") || lower.includes("bekeken")) return "read";
  if (lower.includes("bash") || lower.includes("command") || lower.includes("npm") || lower.includes("deploy") || lower.includes("build") || lower.includes("test")) return "bash";
  if (lower.includes("grep") || lower.includes("gezocht") || lower.includes("scan")) return "grep";
  if (lower.includes("geschreven") || lower.includes("aangemaakt") || lower.includes("nieuw bestand")) return "write";
  return "other";
}

const TOOL_COLORS: Record<ToolType, string> = {
  edit: "#23C6B7",     // turquoise
  read: "#64748b",     // grijs
  bash: "#eab308",     // geel
  write: "#3b82f6",    // blauw
  grep: "#a855f7",     // paars
  error: "#ef4444",    // rood
  other: "#94a3b8",    // licht grijs
};

const TOOL_ICONS: Record<ToolType, typeof Pencil> = {
  edit: Pencil,
  read: Eye,
  bash: Terminal,
  write: FileOutput,
  grep: FileSearch,
  error: AlertCircle,
  other: Code2,
};

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
  onAgentClick?: (agentId: string) => void;
}

// Group consecutive entries from same agent
interface GroupedEntry {
  agent: { id: string; naam: string };
  entries: TaskLogEntry[];
  toolTypes: ToolType[];
}

export function TaskFeed({ entries, onAgentClick }: TaskFeedProps) {
  const [filter, setFilter] = useState<FilterType>("alle");

  const filtered = useMemo(() => {
    if (filter === "alle") return entries;
    return entries.filter((e) => getCategory(e.project) === filter);
  }, [entries, filter]);

  // Group consecutive entries by agent (within 2 min window)
  const grouped = useMemo(() => {
    const timeGroups: Record<string, GroupedEntry[]> = {};

    filtered.forEach((entry) => {
      const timeGroup = getTimeGroup(entry.tijdstip);
      if (!timeGroups[timeGroup]) timeGroups[timeGroup] = [];
      const groups = timeGroups[timeGroup];

      const toolType = entry.toolType ?? inferToolType(entry.beschrijving);
      const lastGroup = groups[groups.length - 1];

      // Group if same agent and within 2 minutes
      if (lastGroup && lastGroup.agent.id === entry.agentId) {
        const lastTime = new Date(lastGroup.entries[lastGroup.entries.length - 1].tijdstip).getTime();
        const thisTime = new Date(entry.tijdstip).getTime();
        if (Math.abs(lastTime - thisTime) < 120_000) {
          lastGroup.entries.push(entry);
          lastGroup.toolTypes.push(toolType);
          return;
        }
      }

      groups.push({
        agent: { id: entry.agentId, naam: entry.agentNaam },
        entries: [entry],
        toolTypes: [toolType],
      });
    });

    return timeGroups;
  }, [filtered]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "alle", label: "Alle" },
    { key: "dev", label: "Dev" },
    { key: "system", label: "Systeem" },
    { key: "docs", label: "AI" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-autronis-text-primary tracking-tight">
          Activiteit
        </h3>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
              filter === f.key
                ? "bg-autronis-accent/15 text-autronis-accent"
                : "text-autronis-text-tertiary hover:text-autronis-text-secondary hover:bg-autronis-border/10"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grouped entries */}
      <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
        {Object.entries(grouped).map(([groupName, agentGroups]) => (
          <div key={groupName}>
            <p className="text-[10px] font-semibold text-autronis-text-tertiary uppercase tracking-wider mb-2 px-1">
              {groupName}
            </p>
            <div className="flex flex-col gap-1.5">
              {agentGroups.map((group, gi) => {
                const firstEntry = group.entries[0];
                const projectColor = getProjectColor(firstEntry.project);
                const hasMultiple = group.entries.length > 1;

                return (
                  <motion.div
                    key={`${group.agent.id}-${gi}`}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: gi * 0.03, duration: 0.2 }}
                    onClick={() => onAgentClick?.(group.agent.id)}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-autronis-card-hover transition-colors cursor-pointer"
                  >
                    {/* Agent pixel avatar */}
                    <div
                      className="shrink-0 mt-0.5 rounded border border-autronis-border/30 bg-autronis-card overflow-hidden"
                      style={{
                        boxShadow: `0 0 6px ${firstEntry.status === "fout" ? "#ef444440" : `${projectColor}25`}`,
                      }}
                    >
                      <PixelAvatar agentId={group.agent.id} size={28} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Agent name + timestamp */}
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-autronis-text-primary">
                          {group.agent.naam}
                        </span>
                        <span className="text-[10px] text-autronis-text-tertiary">
                          {timeAgo(firstEntry.tijdstip)}
                        </span>
                        {hasMultiple && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-autronis-border/20 text-autronis-text-tertiary font-medium">
                            {group.entries.length}x
                          </span>
                        )}
                      </div>

                      {/* Entries with tool type colors */}
                      {group.entries.map((entry, ei) => {
                        const toolType = group.toolTypes[ei];
                        const toolColor = TOOL_COLORS[toolType];
                        const ToolIcon = TOOL_ICONS[toolType];

                        return (
                          <div key={entry.id} className="flex items-start gap-1.5 mt-1">
                            <ToolIcon
                              className="w-3 h-3 mt-0.5 shrink-0"
                              style={{ color: toolColor }}
                            />
                            <p className="text-[12px] text-autronis-text-secondary leading-relaxed">
                              {entry.beschrijving}
                            </p>
                          </div>
                        );
                      })}

                      {/* Project tag */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                          style={{
                            backgroundColor: `${projectColor}15`,
                            color: projectColor,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: projectColor }}
                          />
                          {firstEntry.project}
                        </span>
                      </div>
                    </div>

                    {/* Status indicator */}
                    <div className="shrink-0 mt-1">
                      {firstEntry.status === "bezig" && (
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                      )}
                      {firstEntry.status === "afgerond" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      )}
                      {firstEntry.status === "fout" && (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
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
