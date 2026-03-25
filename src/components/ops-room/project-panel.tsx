"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { FolderOpen, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProjectColor } from "./project-colors";
import { PixelAvatar } from "./pixel-avatar";
import type { Agent } from "./types";

interface ProjectPanelProps {
  agents: Agent[];
}

interface DbProject {
  id: number;
  naam: string;
  status: string;
  voortgangPercentage: number | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  actief: { bg: "bg-green-500/15", text: "text-green-400", label: "Actief" },
  in_progress: { bg: "bg-amber-500/15", text: "text-amber-400", label: "In progress" },
  concept: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Concept" },
  afgerond: { bg: "bg-gray-500/15", text: "text-gray-400", label: "Afgerond" },
  gepauzeerd: { bg: "bg-gray-500/15", text: "text-gray-500", label: "Gepauzeerd" },
};

export function ProjectPanel({ agents }: ProjectPanelProps) {
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);

  const { data: dbProjects } = useQuery<DbProject[]>({
    queryKey: ["projecten-lookup"],
    queryFn: async () => {
      const res = await fetch("/api/projecten");
      if (!res.ok) return [];
      const data = await res.json();
      return (data.projecten ?? data ?? []).map((p: Record<string, unknown>) => ({
        id: p.id,
        naam: p.naam,
        status: p.status ?? "actief",
        voortgangPercentage: p.voortgangPercentage ?? null,
      }));
    },
    staleTime: 60_000,
  });

  // Normalize project name for grouping: lowercase, strip hyphens/spaces
  function normalizeKey(s: string): string {
    return s.toLowerCase().replace(/[-_\s]/g, "");
  }

  const activeProjects = useMemo(() => {
    // Use normalized key for grouping, keep best display name (prefer capitalized)
    const keyToDisplay = new Map<string, string>();
    const map = new Map<string, { agents: Agent[]; hasError: boolean; files: string[] }>();
    agents.forEach((a) => {
      if (a.huidigeTaak) {
        const proj = a.huidigeTaak.project;
        const key = normalizeKey(proj);
        // Prefer the display name that has uppercase or spaces (more human-readable)
        if (!keyToDisplay.has(key) || proj.match(/[A-Z\s]/)) {
          keyToDisplay.set(key, proj);
        }
        const display = keyToDisplay.get(key)!;
        if (!map.has(display)) {
          // Move existing key if needed
          if (map.has(proj) && display !== proj) {
            map.set(display, map.get(proj)!);
            map.delete(proj);
          } else {
            map.set(display, { agents: [], hasError: false, files: [] });
          }
        }
        const entry = map.get(display)!;
        if (!entry.agents.find((e) => e.id === a.id)) {
          entry.agents.push(a);
        }
        if (a.status === "error") entry.hasError = true;
        const fileMatch = a.huidigeTaak.beschrijving.match(/[\w-]+\.(tsx?|jsx?|css|json|md)/g);
        if (fileMatch) entry.files.push(...fileMatch);
      }
    });
    return map;
  }, [agents]);

  const projectIdMap = useMemo(() => {
    const map = new Map<string, DbProject>();
    if (!dbProjects) return map;
    for (const dbp of dbProjects) {
      map.set(dbp.naam.toLowerCase(), dbp);
    }
    return map;
  }, [dbProjects]);

  function normalizeForMatch(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function findDbProject(projectName: string): DbProject | null {
    const lower = projectName.toLowerCase();
    if (projectIdMap.has(lower)) return projectIdMap.get(lower)!;
    for (const [dbName, proj] of projectIdMap) {
      if (lower.includes(dbName) || dbName.includes(lower)) return proj;
    }
    const norm = normalizeForMatch(projectName);
    for (const [dbName, proj] of projectIdMap) {
      if (normalizeForMatch(dbName) === norm) return proj;
      if (norm.includes(normalizeForMatch(dbName)) || normalizeForMatch(dbName).includes(norm)) return proj;
    }
    return null;
  }

  if (activeProjects.size === 0) return null;

  return (
    <div className="rounded-xl border border-autronis-border/50 bg-autronis-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-autronis-border/30">
        <FolderOpen className="w-4 h-4 text-autronis-accent" />
        <span className="text-sm font-semibold text-autronis-text-primary">Projecten</span>
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-autronis-accent/15 text-autronis-accent">
          {activeProjects.size}
        </span>
      </div>
      <div className="p-3 space-y-2">
        {Array.from(activeProjects.entries()).map(([proj, { agents: projAgents, hasError, files }]) => {
          const color = getProjectColor(proj);
          const dbProject = findDbProject(proj);
          const voortgang = dbProject?.voortgangPercentage ?? null;
          const status = dbProject?.status ?? "actief";
          const statusStyle = STATUS_COLORS[status] ?? STATUS_COLORS.actief;
          const isHovered = hoveredProject === proj;
          const uniqueFiles = [...new Set(files)].slice(0, 4);

          const content = (
            <div className="relative">
              <div className="flex items-center gap-3">
                {/* Color bar */}
                <div
                  className="w-1.5 self-stretch rounded-full shrink-0 transition-all"
                  style={{
                    backgroundColor: color,
                    boxShadow: isHovered ? `0 0 8px ${color}60` : "none",
                  }}
                />

                <div className="flex-1 min-w-0">
                  {/* Project name + status */}
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold text-autronis-text-primary truncate">
                      {proj}
                    </p>
                    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0", statusStyle.bg, statusStyle.text)}>
                      {statusStyle.label}
                    </span>
                    {hasError && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/15 text-red-400 shrink-0">
                        Error
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {voortgang !== null && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-autronis-border/30 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${voortgang}%`,
                            backgroundColor: voortgang === 100 ? "#4ade80" : color,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
                        {voortgang}%
                      </span>
                    </div>
                  )}

                  {/* Agent pixel avatars + names */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1">
                      {projAgents.slice(0, 5).map((agent) => (
                        <div
                          key={agent.id}
                          className="shrink-0 border border-autronis-border/30 rounded bg-autronis-card"
                          title={agent.naam}
                        >
                          <PixelAvatar agentId={agent.id} size={20} />
                        </div>
                      ))}
                      {projAgents.length > 5 && (
                        <div className="w-5 h-5 rounded border border-autronis-border/30 bg-autronis-card flex items-center justify-center text-[8px] font-bold text-autronis-text-tertiary shrink-0">
                          +{projAgents.length - 5}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-autronis-text-tertiary truncate">
                      {projAgents.slice(0, 3).map(a => a.naam).join(", ")}
                      {projAgents.length > 3 ? ` +${projAgents.length - 3}` : ""}
                    </span>
                  </div>
                </div>

                {/* Activity dot */}
                <span
                  className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0 transition-all",
                    hasError ? "bg-red-400" : "bg-green-400 animate-pulse"
                  )}
                />
              </div>

              {/* Hover tooltip: affected files */}
              {isHovered && uniqueFiles.length > 0 && (
                <div className="mt-2 pt-2 border-t border-autronis-border/20">
                  <p className="text-[9px] text-autronis-text-tertiary uppercase tracking-wider mb-1 flex items-center gap-1">
                    <FileCode className="w-2.5 h-2.5" />
                    Bestanden
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {uniqueFiles.map((file) => (
                      <span
                        key={file}
                        className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-autronis-border/20 text-autronis-text-secondary"
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );

          if (dbProject?.id) {
            return (
              <Link
                key={proj}
                href={`/projecten/${dbProject.id}`}
                className="block px-3 py-2.5 rounded-lg hover:bg-autronis-card-hover transition-all group cursor-pointer"
                onMouseEnter={() => setHoveredProject(proj)}
                onMouseLeave={() => setHoveredProject(null)}
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={proj}
              className="px-3 py-2.5 rounded-lg hover:bg-autronis-card-hover transition-all"
              onMouseEnter={() => setHoveredProject(proj)}
              onMouseLeave={() => setHoveredProject(null)}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
