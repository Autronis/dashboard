"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { FolderOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProjectColor } from "./project-colors";
import type { Agent } from "./types";

interface ProjectPanelProps {
  agents: Agent[];
}

interface DbProject {
  id: number;
  naam: string;
}

export function ProjectPanel({ agents }: ProjectPanelProps) {
  // Fetch all projects from DB to match names to IDs
  const { data: dbProjects } = useQuery<DbProject[]>({
    queryKey: ["projecten-lookup"],
    queryFn: async () => {
      const res = await fetch("/api/projecten");
      if (!res.ok) return [];
      const data = await res.json();
      return (data.projecten ?? data ?? []).map((p: Record<string, unknown>) => ({
        id: p.id,
        naam: p.naam,
      }));
    },
    staleTime: 60_000,
  });

  const activeProjects = useMemo(() => {
    const map = new Map<string, { names: string[]; hasError: boolean }>();
    agents.forEach((a) => {
      if (a.huidigeTaak) {
        const proj = a.huidigeTaak.project;
        if (!map.has(proj)) map.set(proj, { names: [], hasError: false });
        const entry = map.get(proj)!;
        entry.names.push(a.naam);
        if (a.status === "error") entry.hasError = true;
      }
    });
    return map;
  }, [agents]);

  // Build a name→id lookup (case-insensitive, partial match)
  const projectIdMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!dbProjects) return map;
    for (const dbp of dbProjects) {
      map.set(dbp.naam.toLowerCase(), dbp.id);
    }
    return map;
  }, [dbProjects]);

  function normalizeForMatch(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function findProjectId(projectName: string): number | null {
    const lower = projectName.toLowerCase();
    // Exact match
    if (projectIdMap.has(lower)) return projectIdMap.get(lower)!;
    // Partial match (project name contains DB name or vice versa)
    for (const [dbName, id] of projectIdMap) {
      if (lower.includes(dbName) || dbName.includes(lower)) return id;
    }
    // Normalized match (strip all non-alphanumeric chars)
    const norm = normalizeForMatch(projectName);
    for (const [dbName, id] of projectIdMap) {
      if (normalizeForMatch(dbName) === norm) return id;
      if (norm.includes(normalizeForMatch(dbName)) || normalizeForMatch(dbName).includes(norm)) return id;
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
      <div className="p-2 space-y-1">
        {Array.from(activeProjects.entries()).map(([proj, { names, hasError }]) => {
          const color = getProjectColor(proj);
          const projectId = findProjectId(proj);
          const content = (
            <>
              <div
                className="w-1 h-8 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-autronis-text-primary truncate">
                  {proj}
                </p>
                <p className="text-[10px] text-autronis-text-tertiary truncate">
                  {names.slice(0, 3).join(", ")}
                  {names.length > 3 ? ` +${names.length - 3}` : ""}
                </p>
              </div>
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  hasError ? "bg-red-400" : "bg-green-400 animate-pulse"
                )}
              />
            </>
          );

          if (projectId) {
            return (
              <Link
                key={proj}
                href={`/projecten/${projectId}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-autronis-card-hover transition-colors group cursor-pointer"
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={proj}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-autronis-card-hover transition-colors"
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
