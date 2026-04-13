"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitPullRequest, X } from "lucide-react";
import Link from "next/link";

interface RemoteCommit {
  id: number;
  projectId: number | null;
  projectNaam: string | null;
  sha: string;
  auteurNaam: string | null;
  bericht: string | null;
  branch: string | null;
  pushedOp: string | null;
}

const DISMISS_KEY = "autronis-remote-commits-dismiss";

function useRemoteCommits() {
  return useQuery({
    queryKey: ["remote-commits"],
    queryFn: async (): Promise<RemoteCommit[]> => {
      const res = await fetch("/api/remote-commits");
      if (!res.ok) return [];
      const data = await res.json();
      return data.commits ?? [];
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/** Dismiss state in localStorage: map van projectId → laatst gedismisset sha. */
function useDismissed() {
  const [dismissed, setDismissed] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      if (raw) setDismissed(JSON.parse(raw));
    } catch {}
  }, []);

  const markSeen = (projectId: number | null, sha: string) => {
    const key = String(projectId ?? "null");
    const next = { ...dismissed, [key]: sha };
    setDismissed(next);
    try { window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch {}
  };

  return { dismissed, markSeen };
}

/**
 * Home page banner — aggregeert commits per project.
 * "Syb heeft 3 nieuwe commits op autronis-dashboard" × N projecten.
 */
export function RemoteCommitsBanner() {
  const { data: commits = [] } = useRemoteCommits();
  const { dismissed, markSeen } = useDismissed();

  const perProject = useMemo(() => {
    const map = new Map<string, { projectId: number | null; projectNaam: string; auteur: string; count: number; latestSha: string }>();
    for (const c of commits) {
      const key = String(c.projectId ?? "null");
      const dismissSha = dismissed[key];
      // Skip als deze sha al gedismisset is
      if (dismissSha && dismissSha === c.sha) continue;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, {
          projectId: c.projectId,
          projectNaam: c.projectNaam ?? "Onbekend project",
          auteur: c.auteurNaam ?? "Iemand",
          count: 1,
          latestSha: c.sha,
        });
      }
    }
    return Array.from(map.values());
  }, [commits, dismissed]);

  if (perProject.length === 0) return null;

  return (
    <div className="space-y-2">
      {perProject.map((p) => (
        <div
          key={String(p.projectId)}
          className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-2.5"
        >
          <GitPullRequest className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <span className="text-sm text-autronis-text-primary flex-1 min-w-0 truncate">
            <span className="font-semibold text-purple-300">{p.auteur.split(" ")[0]}</span> heeft{" "}
            <span className="font-semibold tabular-nums">{p.count}</span> nieuwe commit{p.count !== 1 ? "s" : ""} op{" "}
            <span className="font-medium">{p.projectNaam}</span>
          </span>
          {p.projectId && (
            <Link
              href={`/projecten/${p.projectId}`}
              className="text-xs text-purple-300 hover:text-purple-200 font-medium flex-shrink-0"
            >
              Bekijk →
            </Link>
          )}
          <button
            onClick={() => markSeen(p.projectId, p.latestSha)}
            className="text-purple-300/60 hover:text-purple-200 flex-shrink-0"
            title="Dismissen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Project detail page banner — commits specifiek voor dit project.
 */
export function ProjectRemoteCommitsBanner({ projectId }: { projectId: number }) {
  const { data: commits = [] } = useRemoteCommits();
  const { dismissed, markSeen } = useDismissed();

  const relevant = useMemo(() => {
    const key = String(projectId);
    const dismissSha = dismissed[key];
    return commits.filter((c) => c.projectId === projectId && c.sha !== dismissSha);
  }, [commits, dismissed, projectId]);

  if (relevant.length === 0) return null;

  const auteur = relevant[0].auteurNaam?.split(" ")[0] ?? "Iemand";
  const latestSha = relevant[0].sha;

  return (
    <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <GitPullRequest className="w-5 h-5 text-purple-400" />
        <p className="text-sm font-semibold text-autronis-text-primary flex-1">
          {auteur} heeft {relevant.length} nieuwe commit{relevant.length !== 1 ? "s" : ""} gepusht
        </p>
        <button
          onClick={() => markSeen(projectId, latestSha)}
          className="text-purple-300/60 hover:text-purple-200"
          title="Dismissen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-autronis-text-secondary mb-3">
        Pull voor je begint te editten om conflicten te voorkomen.
      </p>
      <ul className="space-y-1.5">
        {relevant.slice(0, 5).map((c) => (
          <li key={c.id} className="text-xs text-autronis-text-secondary">
            <span className="font-mono text-purple-300/80">{c.sha.slice(0, 7)}</span>{" "}
            {c.bericht?.split("\n")[0] ?? "(geen bericht)"}
          </li>
        ))}
        {relevant.length > 5 && (
          <li className="text-xs text-autronis-text-secondary/60">+ {relevant.length - 5} meer</li>
        )}
      </ul>
    </div>
  );
}
