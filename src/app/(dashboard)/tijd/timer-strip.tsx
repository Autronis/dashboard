"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, RotateCcw, AlertTriangle, X } from "lucide-react";
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

const WAARSCHUWING_UUR = 3; // uur aaneengesloten werken

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatDuurTekst(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}u`;
  return `${h}u ${m}m`;
}

interface StopPopupProps {
  duur: string;
  omschrijving: string;
  onClose: () => void;
}

function StopPopup({ duur, omschrijving, onClose }: StopPopupProps) {
  useEffect(() => {
    const id = setTimeout(onClose, 4000);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 bg-autronis-card border border-autronis-accent/30 rounded-2xl px-5 py-4 shadow-lg shadow-black/30 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="w-2 h-2 rounded-full bg-autronis-accent mt-1.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-autronis-text-primary">Timer gestopt</p>
        <p className="text-xs text-autronis-text-secondary mt-0.5">
          {duur} gewerkt
          {omschrijving ? ` aan ${omschrijving}` : ""}
        </p>
      </div>
      <button
        onClick={onClose}
        className="p-0.5 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function TimerStrip() {
  const timer = useTimer();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waarschuwingRef = useRef(false);

  const [expanded, setExpanded] = useState(false);
  const [localProjectId, setLocalProjectId] = useState<number | null>(null);
  const [localOmschrijving, setLocalOmschrijving] = useState("");
  const [localCategorie, setLocalCategorie] = useState<TijdCategorie>("development");
  const [stopPopup, setStopPopup] = useState<{ duur: string; omschrijving: string } | null>(null);

  const { data: projectenData } = useProjecten();
  const projecten = projectenData?.projecten ?? [];

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

  // Timer tick + waarschuwing na X uur
  useEffect(() => {
    if (timer.isRunning) {
      timer.tick();
      waarschuwingRef.current = false;
      intervalRef.current = setInterval(() => {
        timer.tick();
        // Waarschuwing na WAARSCHUWING_UUR uur aaneengesloten
        const elapsed = timer.elapsed;
        if (!waarschuwingRef.current && elapsed >= WAARSCHUWING_UUR * 3600) {
          waarschuwingRef.current = true;
          addToast(`Je werkt al ${WAARSCHUWING_UUR}u — pauze nemen?`, "fout");
        }
      }, 1000);
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
    if (!timer.registratieId || !timer.startTijd) return;

    const startMs = new Date(timer.startTijd).getTime();
    const elapsed = timer.elapsed;
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

      const omschrijving = timer.omschrijving;
      timer.stop();
      setLocalOmschrijving("");
      setExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["registraties"] });
      setStopPopup({ duur: formatDuurTekst(elapsed), omschrijving });
    } catch {
      addToast("Kon timer niet stoppen", "fout");
    }
  }

  async function handleHerhaalLaatste() {
    const last = timer.lastTimer;
    if (!last) return;

    if (timer.isRunning) {
      addToast("Stop eerst de lopende timer", "fout");
      return;
    }

    try {
      const res = await fetch("/api/tijdregistraties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: last.projectId,
          omschrijving: last.omschrijving || null,
          categorie: last.categorie,
        }),
      });

      if (!res.ok) throw new Error();
      const { registratie } = await res.json() as { registratie: { id: number } };
      timer.start(last.projectId, last.omschrijving, last.categorie, registratie.id);
      setExpanded(true);
      queryClient.invalidateQueries({ queryKey: ["registraties"] });
    } catch {
      addToast("Kon timer niet starten", "fout");
    }
  }

  // Collapsed state
  if (!expanded && !timer.isRunning) {
    return (
      <>
        <div className="flex items-center gap-2">
          {timer.lastTimer && (
            <button
              onClick={handleHerhaalLaatste}
              className="flex items-center gap-1.5 border border-autronis-border bg-autronis-card text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/40 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
              title={`Herhaal: ${timer.lastTimer.omschrijving || timer.lastTimer.categorie}`}
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline max-w-[120px] truncate">
                {timer.lastTimer.omschrijving || "Herhaal laatste"}
              </span>
            </button>
          )}
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 border border-autronis-border bg-autronis-card text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-text-secondary/40 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            Timer starten
          </button>
        </div>
        {stopPopup && (
          <StopPopup
            duur={stopPopup.duur}
            omschrijving={stopPopup.omschrijving}
            onClose={() => setStopPopup(null)}
          />
        )}
      </>
    );
  }

  const isRunning = timer.isRunning;
  const currentProjectId = isRunning ? (timer.projectId ?? "") : (localProjectId ?? "");
  const currentOmschrijving = isRunning ? timer.omschrijving : localOmschrijving;
  const currentCategorie = isRunning ? timer.categorie : localCategorie;
  const isLangWerken = isRunning && timer.elapsed >= WAARSCHUWING_UUR * 3600;

  return (
    <>
      <div className={cn(
        "flex flex-wrap items-center gap-2 bg-autronis-card border rounded-xl px-3 py-2",
        isRunning
          ? isLangWerken
            ? "border-amber-500/40"
            : "border-autronis-accent/40"
          : "border-autronis-border"
      )}>
        {/* Pulsing dot when running */}
        {isRunning && (
          <span className={cn(
            "animate-pulse rounded-full w-2 h-2 flex-shrink-0",
            isLangWerken ? "bg-amber-400" : "bg-autronis-accent"
          )} />
        )}

        {/* Lange sessie waarschuwing icon */}
        {isLangWerken && (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
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
          <span className={cn(
            "font-mono tabular-nums text-sm font-semibold min-w-[60px]",
            isLangWerken ? "text-amber-400" : "text-autronis-accent"
          )}>
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

      {stopPopup && (
        <StopPopup
          duur={stopPopup.duur}
          omschrijving={stopPopup.omschrijving}
          onClose={() => setStopPopup(null)}
        />
      )}
    </>
  );
}
