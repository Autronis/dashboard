"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { useTimer, loadTimerFromStorage } from "@/hooks/use-timer";
import { useProjecten } from "@/hooks/queries/use-tijdregistraties";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { TijdCategorie } from "@/types";

const CATEGORIE_LABELS: Record<string, string> = {
  development: "Development",
  meeting: "Meeting",
  administratie: "Administratie",
  overig: "Overig",
};

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function TimerStrip() {
  const timer = useTimer();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [expanded, setExpanded] = useState(false);
  const [localProjectId, setLocalProjectId] = useState<number | null>(null);
  const [localOmschrijving, setLocalOmschrijving] = useState("");
  const [localCategorie, setLocalCategorie] = useState<TijdCategorie>("development");

  const { data: projecten = [] } = useProjecten();

  // Set default project when projecten load
  useEffect(() => {
    if (projecten.length > 0 && !localProjectId) {
      setLocalProjectId(projecten[0].id);
    }
  }, [projecten, localProjectId]);

  // Restore timer on mount
  useEffect(() => {
    const stored = loadTimerFromStorage();
    if (stored?.isRunning && stored.startTijd && stored.registratieId && stored.projectId) {
      timer.restore({
        startTijd: stored.startTijd,
        projectId: stored.projectId,
        omschrijving: stored.omschrijving || "",
        categorie: (stored.categorie as TijdCategorie) || "development",
        registratieId: stored.registratieId,
      });
      setExpanded(true);
    } else {
      fetch("/api/tijdregistraties/actief")
        .then((r) => r.json())
        .then((data) => {
          if (data.actief) {
            timer.restore({
              startTijd: data.actief.startTijd,
              projectId: data.actief.projectId,
              omschrijving: data.actief.omschrijving || "",
              categorie: data.actief.categorie || "development",
              registratieId: data.actief.id,
            });
            setExpanded(true);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Timer tick
  useEffect(() => {
    if (timer.isRunning) {
      timer.tick();
      intervalRef.current = setInterval(() => timer.tick(), 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [timer.isRunning]);

  async function handleStart() {
    const projectId = localProjectId;
    if (!projectId) {
      addToast("Selecteer eerst een project", "fout");
      return;
    }

    try {
      const res = await fetch("/api/tijdregistraties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          omschrijving: localOmschrijving || null,
          categorie: localCategorie,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error((data as { fout?: string }).fout || "Kon timer niet starten");
      }

      const { registratie } = await res.json() as { registratie: { id: number } };
      timer.start(projectId, localOmschrijving, localCategorie, registratie.id);
      queryClient.invalidateQueries({ queryKey: ["registraties"] });
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon timer niet starten", "fout");
    }
  }

  async function handleStop() {
    if (!timer.registratieId) return;

    const startMs = new Date(timer.startTijd!).getTime();
    const duurMinuten = Math.round((Date.now() - startMs) / 60000);

    try {
      const res = await fetch(`/api/tijdregistraties/${timer.registratieId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eindTijd: new Date().toISOString(),
          duurMinuten,
          omschrijving: timer.omschrijving || null,
          categorie: timer.categorie,
        }),
      });

      if (!res.ok) throw new Error("Kon timer niet stoppen");

      timer.stop();
      setLocalOmschrijving("");
      setExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["registraties"] });
      addToast("Timer gestopt");
    } catch {
      addToast("Kon timer niet stoppen", "fout");
    }
  }

  // Collapsed state
  if (!expanded && !timer.isRunning) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 border border-autronis-border bg-autronis-card text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-text-secondary/40 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
      >
        <Play className="w-4 h-4" />
        Timer starten
      </button>
    );
  }

  const isRunning = timer.isRunning;
  const currentProjectId = isRunning ? (timer.projectId ?? "") : (localProjectId ?? "");
  const currentOmschrijving = isRunning ? timer.omschrijving : localOmschrijving;
  const currentCategorie = isRunning ? timer.categorie : localCategorie;

  return (
    <div className={cn(
      "flex flex-wrap items-center gap-2 bg-autronis-card border rounded-xl px-3 py-2",
      isRunning ? "border-autronis-accent/40" : "border-autronis-border"
    )}>
      {/* Pulsing dot when running */}
      {isRunning && (
        <span className="animate-pulse bg-autronis-accent rounded-full w-2 h-2 flex-shrink-0" />
      )}

      {/* Project dropdown */}
      <select
        value={currentProjectId}
        onChange={(e) => {
          const id = Number(e.target.value);
          if (isRunning) {
            timer.setProjectId(id);
            if (timer.registratieId) {
              fetch(`/api/tijdregistraties/${timer.registratieId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId: id }),
              }).catch(() => {});
            }
          } else {
            setLocalProjectId(id);
          }
        }}
        className="bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-lg px-3 py-1.5 text-sm min-w-[160px] transition-colors"
      >
        <option value="">Selecteer project...</option>
        {projecten.map((p) => (
          <option key={p.id} value={p.id}>
            {p.naam} — {p.klantNaam}
          </option>
        ))}
      </select>

      {/* Description input */}
      <input
        type="text"
        placeholder="Waar werk je aan?"
        value={currentOmschrijving}
        onChange={(e) => {
          if (isRunning) {
            timer.setOmschrijving(e.target.value);
          } else {
            setLocalOmschrijving(e.target.value);
          }
        }}
        onBlur={() => {
          if (isRunning && timer.registratieId) {
            fetch(`/api/tijdregistraties/${timer.registratieId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ omschrijving: timer.omschrijving || null }),
            }).catch(() => {});
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isRunning) {
            e.preventDefault();
            handleStart();
          }
        }}
        className="flex-1 min-w-[140px] bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-lg px-3 py-1.5 text-sm placeholder:text-autronis-text-secondary/50 transition-colors"
      />

      {/* Category select */}
      <select
        value={currentCategorie}
        onChange={(e) => {
          const cat = e.target.value as TijdCategorie;
          if (isRunning) {
            timer.setCategorie(cat);
            if (timer.registratieId) {
              fetch(`/api/tijdregistraties/${timer.registratieId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ categorie: cat }),
              }).catch(() => {});
            }
          } else {
            setLocalCategorie(cat);
          }
        }}
        className="bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-lg px-3 py-1.5 text-sm min-w-[130px] transition-colors"
      >
        {Object.entries(CATEGORIE_LABELS).map(([val, label]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </select>

      {/* Elapsed time */}
      {isRunning && (
        <span className="font-mono tabular-nums text-sm font-semibold text-autronis-accent min-w-[60px]">
          {formatElapsed(timer.elapsed)}
        </span>
      )}

      {/* Start / Stop button */}
      {isRunning ? (
        <button
          onClick={handleStop}
          className="flex items-center gap-1.5 bg-red-500/80 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
        >
          <Square className="w-3.5 h-3.5" />
          Stop
        </button>
      ) : (
        <button
          onClick={handleStart}
          className="flex items-center gap-1.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
        >
          <Play className="w-3.5 h-3.5" />
          Start
        </button>
      )}
    </div>
  );
}
