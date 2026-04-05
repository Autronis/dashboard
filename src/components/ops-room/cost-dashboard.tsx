"use client";

import { useMemo } from "react";
import { Coins, TrendingUp, Users, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProjectColor } from "./project-colors";
import { PixelAvatar } from "./pixel-avatar";
import type { Agent } from "./types";

interface CostDashboardProps {
  agents: Agent[];
}

interface ProjectCost {
  project: string;
  totalTokens: number;
  totalCost: number;
  agents: { id: string; naam: string; tokens: number; cost: number }[];
}

export function CostDashboard({ agents }: CostDashboardProps) {
  const projectCosts = useMemo(() => {
    const map = new Map<string, ProjectCost>();

    agents.forEach((agent) => {
      if (!agent.huidigeTaak || agent.kosten.tokensVandaag === 0) return;
      const proj = agent.huidigeTaak.project;
      if (!map.has(proj)) {
        map.set(proj, { project: proj, totalTokens: 0, totalCost: 0, agents: [] });
      }
      const entry = map.get(proj)!;
      entry.totalTokens += agent.kosten.tokensVandaag;
      entry.totalCost += agent.kosten.kostenVandaag;
      if (!entry.agents.find((a) => a.id === agent.id)) {
        entry.agents.push({
          id: agent.id,
          naam: agent.naam,
          tokens: agent.kosten.tokensVandaag,
          cost: agent.kosten.kostenVandaag,
        });
      }
    });

    // Sort by cost descending
    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [agents]);

  const totalCost = projectCosts.reduce((sum, p) => sum + p.totalCost, 0);
  const totalTokens = projectCosts.reduce((sum, p) => sum + p.totalTokens, 0);
  const maxCost = projectCosts[0]?.totalCost ?? 1;

  if (projectCosts.length === 0) return null;

  return (
    <div className="rounded-xl border border-autronis-border/50 bg-autronis-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-autronis-border/30">
        <Coins className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-autronis-text-primary">Kosten per project</span>
        <span className="ml-auto text-xs font-bold text-amber-400">
          {"\u20AC"}{totalCost.toFixed(2)} totaal
        </span>
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2 border-b border-autronis-border/20 flex items-center gap-4 text-[10px] text-autronis-text-tertiary">
        <span className="flex items-center gap-1">
          <FolderOpen className="w-3 h-3" />
          {projectCosts.length} projecten
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(0)}k` : totalTokens} tokens
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {new Set(projectCosts.flatMap((p) => p.agents.map((a) => a.id))).size} agents
        </span>
      </div>

      <div className="p-3 space-y-2">
        {projectCosts.map((project) => {
          const color = getProjectColor(project.project);
          const barWidth = Math.max(4, (project.totalCost / maxCost) * 100);

          return (
            <div key={project.project} className="p-2.5 rounded-lg hover:bg-autronis-card-hover transition-colors">
              {/* Project header */}
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className="w-1.5 h-5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs font-semibold text-autronis-text-primary flex-1 truncate">
                  {project.project}
                </span>
                <span className="text-xs font-bold text-amber-400 shrink-0">
                  {"\u20AC"}{project.totalCost.toFixed(2)}
                </span>
              </div>

              {/* Cost bar */}
              <div className="h-1.5 rounded-full bg-autronis-border/20 overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%`, backgroundColor: color }}
                />
              </div>

              {/* Agent breakdown */}
              <div className="flex flex-wrap gap-1.5">
                {project.agents
                  .sort((a, b) => b.cost - a.cost)
                  .map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-autronis-bg border border-autronis-border/30"
                    >
                      <PixelAvatar agentId={agent.id} size={16} />
                      <span className="text-[10px] text-autronis-text-secondary">{agent.naam}</span>
                      <span className="text-[10px] font-medium text-amber-400">
                        {"\u20AC"}{agent.cost.toFixed(2)}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Token count */}
              <p className="text-[9px] text-autronis-text-tertiary mt-1">
                {project.totalTokens >= 1000
                  ? `${(project.totalTokens / 1000).toFixed(1)}k`
                  : project.totalTokens} tokens
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
