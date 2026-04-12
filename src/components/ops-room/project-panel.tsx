"use client";

import { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FolderOpen, FileCode, UserPlus, User } from "lucide-react";
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

interface TeamMember {
  naam: string;
  taak: string;
}

interface TeamLiveData {
  projectStatus: Array<{
    projectId: number;
    projectNaam: string;
    medewerkers: TeamMember[];
  }>;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  actief: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Actief" },
  in_progress: { bg: "bg-amber-500/15", text: "text-amber-400", label: "In progress" },
  concept: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Concept" },
  afgerond: { bg: "bg-gray-500/15", text: "text-gray-400", label: "Afgerond" },
  gepauzeerd: { bg: "bg-gray-500/15", text: "text-gray-500", label: "Gepauzeerd" },
};

// Avatar colors for team members
const MEMBER_COLORS: Record<string, string> = {
  sem: "#17B8A5",
  syb: "#a855f7",
};

function getMemberColor(naam: string): string {
  const key = naam.toLowerCase();
  return MEMBER_COLORS[key] || "#6b7280";
}

function getInitials(naam: string): string {
  return naam.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export function ProjectPanel({ agents }: ProjectPanelProps) {
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [dragOverProject, setDragOverProject] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const queryClient = useQueryClient();

  const handleDrop = useCallback(async (projectNaam: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverProject(null);
    const agentId = e.dataTransfer.getData("application/agent-id");
    if (!agentId) return;

    setAssigning(true);
    try {
      const res = await fetch("/api/ops-room/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ops-token": "autronis-ops-2026" },
        body: JSON.stringify({ agentId, projectNaam }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["ops-room"] });
      }
    } catch { /* ignore */ }
    setAssigning(false);
  }, [queryClient]);

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

  // Fetch team/live data to see which humans are working on which projects
  const { data: teamLive } = useQuery<TeamLiveData>({
    queryKey: ["team-live-ops"],
    queryFn: async () => {
      const res = await fetch("/api/team/live");
      if (!res.ok) return { projectStatus: [] };
      return res.json();
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  // Normalize project name for grouping: lowercase, strip hyphens/spaces
  function normalizeKey(s: string): string {
    return s.toLowerCase().replace(/[-_\s]/g, "");
  }

  // Build map of projectId → team members working on it
  const teamByProjectId = useMemo(() => {
    const map = new Map<number, TeamMember[]>();
    if (!teamLive?.projectStatus) return map;
    for (const ps of teamLive.projectStatus) {
      map.set(ps.projectId, ps.medewerkers);
    }
    return map;
  }, [teamLive]);

  const activeProjects = useMemo(() => {
    // Use normalized key for grouping, keep best display name (prefer capitalized)
    const keyToDisplay = new Map<string, string>();
    const map = new Map<string, { agents: Agent[]; hasError: boolean; files: string[]; teamMembers: TeamMember[]; dbProjectId: number | null }>();

    // First: add projects from active agents
    agents.forEach((a) => {
      if (a.huidigeTaak) {
        const proj = a.huidigeTaak.project;
        const key = normalizeKey(proj);
        if (!keyToDisplay.has(key) || proj.match(/[A-Z\s]/)) {
          keyToDisplay.set(key, proj);
        }
        const display = keyToDisplay.get(key)!;
        if (!map.has(display)) {
          if (map.has(proj) && display !== proj) {
            map.set(display, map.get(proj)!);
            map.delete(proj);
          } else {
            map.set(display, { agents: [], hasError: false, files: [], teamMembers: [], dbProjectId: null });
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

    // Second: add projects from team/live (human users working on tasks)
    if (dbProjects && teamLive?.projectStatus) {
      for (const ps of teamLive.projectStatus) {
        const dbp = dbProjects.find(p => p.id === ps.projectId);
        const projName = ps.projectNaam || dbp?.naam || `Project ${ps.projectId}`;
        const key = normalizeKey(projName);

        // Find existing entry or create new
        let existingKey: string | null = null;
        for (const [k] of map) {
          if (normalizeKey(k) === key) { existingKey = k; break; }
        }

        if (existingKey) {
          const entry = map.get(existingKey)!;
          entry.teamMembers = ps.medewerkers;
          entry.dbProjectId = ps.projectId;
        } else {
          map.set(projName, {
            agents: [],
            hasError: false,
            files: [],
            teamMembers: ps.medewerkers,
            dbProjectId: ps.projectId,
          });
        }
      }
    }

    return map;
  }, [agents, dbProjects, teamLive]);

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

  function findDbProject(projectName: string, dbProjectId?: number | null): DbProject | null {
    if (dbProjectId && dbProjects) {
      const found = dbProjects.find(p => p.id === dbProjectId);
      if (found) return found;
    }
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
        {Array.from(activeProjects.entries()).map(([proj, { agents: projAgents, hasError, files, teamMembers, dbProjectId }]) => {
          const color = getProjectColor(proj);
          const dbProject = findDbProject(proj, dbProjectId);
          const voortgang = dbProject?.voortgangPercentage ?? null;
          const status = dbProject?.status ?? "actief";
          const statusStyle = STATUS_COLORS[status] ?? STATUS_COLORS.actief;
          const isHovered = hoveredProject === proj;
          const uniqueFiles = [...new Set(files)].slice(0, 4);
          const hasActivity = projAgents.length > 0 || teamMembers.length > 0;

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

                  {/* Team members + Agent pixel avatars */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1">
                      {/* Human team members first */}
                      {teamMembers.map((member) => (
                        <div
                          key={`member-${member.naam}`}
                          className="relative shrink-0 w-5 h-5 rounded-full border-2 border-autronis-card flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ backgroundColor: getMemberColor(member.naam) }}
                          title={`${member.naam}: ${member.taak}`}
                        >
                          {getInitials(member.naam)}
                          {/* Green pulse to show active */}
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-autronis-card animate-pulse" />
                        </div>
                      ))}
                      {/* Agent avatars */}
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
                      {[
                        ...teamMembers.map(m => m.naam),
                        ...projAgents.slice(0, 3).map(a => a.naam),
                      ].slice(0, 3).join(", ")}
                      {(teamMembers.length + projAgents.length) > 3
                        ? ` +${teamMembers.length + projAgents.length - 3}`
                        : ""}
                    </span>
                  </div>
                </div>

                {/* Activity dot */}
                <span
                  className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0 transition-all",
                    hasError ? "bg-red-400" : hasActivity ? "bg-green-400 animate-pulse" : "bg-gray-500"
                  )}
                />
              </div>

              {/* Hover tooltip: team tasks + affected files */}
              {isHovered && (teamMembers.length > 0 || uniqueFiles.length > 0) && (
                <div className="mt-2 pt-2 border-t border-autronis-border/20">
                  {teamMembers.length > 0 && (
                    <div className="mb-1.5">
                      <p className="text-[9px] text-autronis-text-tertiary uppercase tracking-wider mb-1 flex items-center gap-1">
                        <User className="w-2.5 h-2.5" />
                        Actief
                      </p>
                      <div className="space-y-0.5">
                        {teamMembers.map((m) => (
                          <div key={m.naam} className="flex items-center gap-1.5">
                            <span
                              className="w-3 h-3 rounded-full flex items-center justify-center text-[6px] font-bold text-white shrink-0"
                              style={{ backgroundColor: getMemberColor(m.naam) }}
                            >
                              {getInitials(m.naam)}
                            </span>
                            <span className="text-[9px] text-autronis-text-secondary truncate">
                              {m.naam}: {m.taak}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {uniqueFiles.length > 0 && (
                    <>
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
                    </>
                  )}
                </div>
              )}
            </div>
          );

          const dropHandlers = {
            onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverProject(proj); },
            onDragLeave: () => setDragOverProject(null),
            onDrop: (e: React.DragEvent) => handleDrop(proj, e),
          };
          const isDragTarget = dragOverProject === proj;

          if (dbProject?.id) {
            return (
              <Link
                key={proj}
                href={`/projecten/${dbProject.id}`}
                className={cn(
                  "block px-3 py-2.5 rounded-lg hover:bg-autronis-card-hover transition-all group cursor-pointer",
                  isDragTarget && "ring-2 ring-autronis-accent/50 bg-autronis-accent/5"
                )}
                onMouseEnter={() => setHoveredProject(proj)}
                onMouseLeave={() => setHoveredProject(null)}
                {...dropHandlers}
              >
                {content}
                {isDragTarget && (
                  <div className="mt-1.5 flex items-center gap-1 text-[9px] text-autronis-accent font-medium">
                    <UserPlus className="w-3 h-3" />
                    Agent toewijzen aan {proj}
                  </div>
                )}
              </Link>
            );
          }

          return (
            <div
              key={proj}
              className={cn(
                "px-3 py-2.5 rounded-lg hover:bg-autronis-card-hover transition-all",
                isDragTarget && "ring-2 ring-autronis-accent/50 bg-autronis-accent/5"
              )}
              onMouseEnter={() => setHoveredProject(proj)}
              onMouseLeave={() => setHoveredProject(null)}
              {...dropHandlers}
            >
              {content}
              {isDragTarget && (
                <div className="mt-1.5 flex items-center gap-1 text-[9px] text-autronis-accent font-medium">
                  <UserPlus className="w-3 h-3" />
                  Agent toewijzen aan {proj}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
