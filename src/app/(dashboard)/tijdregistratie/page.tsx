"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, Plus, Pencil, Trash2, Download, RotateCcw, Clock, Timer } from "lucide-react";
import { useTimer, loadTimerFromStorage } from "@/hooks/use-timer";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn, formatUren } from "@/lib/utils";
import type { TijdCategorie } from "@/types";
import { HandmatigModal } from "./handmatig-modal";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

// ============ TYPES ============

interface Project {
  id: number;
  naam: string;
  klantId: number;
  klantNaam: string;
  status: string;
}

interface Registratie {
  id: number;
  projectId: number;
  omschrijving: string | null;
  startTijd: string;
  eindTijd: string | null;
  duurMinuten: number | null;
  categorie: string;
  isHandmatig: number;
  projectNaam: string | null;
  klantNaam: string | null;
}

type Periode = "dag" | "week" | "maand";

// ============ CONSTANTS ============

const CATEGORIE_LABELS: Record<string, string> = {
  development: "Development",
  meeting: "Meeting",
  administratie: "Administratie",
  overig: "Overig",
};

const CATEGORIE_KLEUREN: Record<string, string> = {
  development: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  meeting: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  administratie: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  overig: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

const CATEGORIE_BAR_KLEUREN: Record<string, string> = {
  development: "bg-blue-500",
  meeting: "bg-purple-500",
  administratie: "bg-amber-500",
  overig: "bg-slate-500",
};

const DAGEN = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
const DAGEN_KORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const MAANDEN = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

// ============ HELPERS ============

function formatTijd(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatTijdstip(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatDuurKort(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function formatUrenTotaal(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  return `${h}u ${m}m`;
}

function getWeekRange(date: Date): { van: string; tot: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const maandag = new Date(d.setDate(diff));
  maandag.setHours(0, 0, 0, 0);
  const zondag = new Date(maandag);
  zondag.setDate(zondag.getDate() + 6);
  return {
    van: maandag.toISOString().split("T")[0],
    tot: zondag.toISOString().split("T")[0],
  };
}

function getDagRange(date: Date): { van: string; tot: string } {
  const d = date.toISOString().split("T")[0];
  return { van: d, tot: d };
}

function getMaandRange(date: Date): { van: string; tot: string } {
  const jaar = date.getFullYear();
  const maand = date.getMonth();
  const eerste = new Date(jaar, maand, 1);
  const laatste = new Date(jaar, maand + 1, 0);
  return {
    van: eerste.toISOString().split("T")[0],
    tot: laatste.toISOString().split("T")[0],
  };
}

function getPeriodeRange(periode: Periode, date: Date): { van: string; tot: string } {
  switch (periode) {
    case "dag": return getDagRange(date);
    case "week": return getWeekRange(date);
    case "maand": return getMaandRange(date);
  }
}

function dagLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const vandaag = new Date();
  vandaag.setHours(12, 0, 0, 0);
  const gisteren = new Date(vandaag);
  gisteren.setDate(gisteren.getDate() - 1);

  const dagNaam = DAGEN[d.getDay()];
  const dag = d.getDate();
  const maand = MAANDEN[d.getMonth()];

  if (d.toDateString() === vandaag.toDateString()) {
    return `Vandaag — ${dagNaam} ${dag} ${maand}`;
  }
  if (d.toDateString() === gisteren.toDateString()) {
    return `Gisteren — ${dagNaam} ${dag} ${maand}`;
  }
  return `${dagNaam} ${dag} ${maand}`;
}

/** Get week days (ma-zo) starting from the Monday of the given date */
function getWeekDagen(date: Date): string[] {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const maandag = new Date(d.setDate(diff));
  maandag.setHours(0, 0, 0, 0);

  const dagen: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dag = new Date(maandag);
    dag.setDate(dag.getDate() + i);
    dagen.push(dag.toISOString().split("T")[0]);
  }
  return dagen;
}

// ============ WEEKOVERZICHT COMPONENT ============

function WeekOverzicht({ registraties }: { registraties: Registratie[] }) {
  const weekDagen = getWeekDagen(new Date());
  const vandaag = new Date().toISOString().split("T")[0];

  // Calculate minutes per day
  const minutenPerDag: Record<string, number> = {};
  for (const dag of weekDagen) {
    minutenPerDag[dag] = 0;
  }
  for (const reg of registraties) {
    const dag = reg.startTijd.split("T")[0];
    if (minutenPerDag[dag] !== undefined) {
      if (reg.eindTijd && reg.duurMinuten) {
        minutenPerDag[dag] += reg.duurMinuten;
      } else if (!reg.eindTijd) {
        minutenPerDag[dag] += Math.round((Date.now() - new Date(reg.startTijd).getTime()) / 60000);
      }
    }
  }

  const maxMinuten = Math.max(...Object.values(minutenPerDag), 60); // minimum 1 hour scale

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow">
      <div className="flex items-end justify-between gap-2 h-32">
        {weekDagen.map((dag, i) => {
          const minuten = minutenPerDag[dag];
          const hoogte = maxMinuten > 0 ? (minuten / maxMinuten) * 100 : 0;
          const isVandaag = dag === vandaag;
          const heeftUren = minuten > 0;

          return (
            <div key={dag} className="flex flex-col items-center gap-1.5 flex-1">
              {/* Duration label */}
              <span className={cn(
                "text-xs font-mono tabular-nums transition-opacity",
                heeftUren ? "text-autronis-text-secondary" : "text-transparent"
              )}>
                {formatDuurKort(minuten)}
              </span>

              {/* Bar */}
              <div className="w-full flex justify-center" style={{ height: "80px" }}>
                <div className="w-full max-w-[40px] flex items-end h-full">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: heeftUren ? `${Math.max(hoogte, 5)}%` : "3px" }}
                    transition={{ duration: 0.5, delay: i * 0.07, ease: "easeOut" }}
                    className={cn(
                      "w-full rounded-t-lg",
                      isVandaag ? "bg-autronis-accent" : "bg-autronis-accent/40",
                      !heeftUren && "bg-autronis-border min-h-[3px]"
                    )}
                  />
                </div>
              </div>

              {/* Day label */}
              <span className={cn(
                "text-sm font-medium",
                isVandaag ? "text-autronis-accent" : "text-autronis-text-secondary"
              )}>
                {DAGEN_KORT[i]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ LIVE TIMER DUUR (re-renders every second for active entries) ============

function LiveDuur({ startTijd }: { startTijd: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const minuten = Math.round((Date.now() - new Date(startTijd).getTime()) / 60000);
  return <>{formatDuurKort(minuten)}</>;
}

// ============ MAIN PAGE ============

export default function TijdregistratiePage() {
  const router = useRouter();
  const timer = useTimer();
  const { addToast } = useToast();

  const [projecten, setProjecten] = useState<Project[]>([]);
  const [registraties, setRegistraties] = useState<Registratie[]>([]);
  const [periode, setPeriode] = useState<Periode>("week");
  const [laden, setLaden] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [bewerkRegistratie, setBewerkRegistratie] = useState<Registratie | null>(null);
  const [verwijderConfirm, setVerwijderConfirm] = useState<number | null>(null);

  // Timer form state (for when timer is NOT running)
  const [timerProjectId, setTimerProjectId] = useState<number | null>(null);
  const [timerOmschrijving, setTimerOmschrijving] = useState("");
  const [timerCategorie, setTimerCategorie] = useState<TijdCategorie>("development");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const omschrijvingRef = useRef<HTMLInputElement>(null);

  // Calculate period range
  const range = getPeriodeRange(periode, new Date());

  // Load projects
  useEffect(() => {
    fetch("/api/projecten")
      .then((r) => r.json())
      .then((data) => {
        setProjecten(data.projecten || []);
        if (data.projecten?.length > 0 && !timerProjectId) {
          setTimerProjectId(data.projecten[0].id);
        }
      })
      .catch(() => addToast("Kon projecten niet laden", "fout"));
  }, []);

  // Load registrations
  const laadRegistraties = useCallback(() => {
    fetch(`/api/tijdregistraties?van=${range.van}&tot=${range.tot}`)
      .then((r) => r.json())
      .then((data) => {
        setRegistraties(data.registraties || []);
        setLaden(false);
      })
      .catch(() => {
        addToast("Kon registraties niet laden", "fout");
        setLaden(false);
      });
  }, [range.van, range.tot]);

  useEffect(() => {
    laadRegistraties();
  }, [laadRegistraties]);

  // Restore timer from localStorage / active DB entry on mount
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
    } else {
      // Check server for active timer
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

  // Keyboard shortcut: Enter to start timer (when focus is in omschrijving)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Enter anywhere to start/stop
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        if (timer.isRunning) {
          handleStop();
        } else {
          handleStart();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [timer.isRunning, timerProjectId, timerOmschrijving, timerCategorie]);

  // Start timer
  async function handleStart() {
    if (!timerProjectId) {
      addToast("Selecteer eerst een project", "fout");
      return;
    }

    try {
      const res = await fetch("/api/tijdregistraties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: timerProjectId,
          omschrijving: timerOmschrijving || null,
          categorie: timerCategorie,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Kon timer niet starten");
      }

      const { registratie } = await res.json();
      timer.start(timerProjectId, timerOmschrijving, timerCategorie, registratie.id);
      laadRegistraties();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Kon timer niet starten", "fout");
    }
  }

  // Stop timer
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
      setTimerOmschrijving("");
      laadRegistraties();
      addToast("Timer gestopt");
    } catch {
      addToast("Kon timer niet stoppen", "fout");
    }
  }

  // Delete registration
  async function handleVerwijder(id: number) {
    try {
      const res = await fetch(`/api/tijdregistraties/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      laadRegistraties();
      addToast("Registratie verwijderd");
    } catch {
      addToast("Kon registratie niet verwijderen", "fout");
    }
  }

  // Repeat entry
  async function handleHerhaal(reg: Registratie) {
    setTimerProjectId(reg.projectId);
    setTimerOmschrijving(reg.omschrijving || "");
    setTimerCategorie(reg.categorie as TijdCategorie);

    try {
      const res = await fetch("/api/tijdregistraties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: reg.projectId,
          omschrijving: reg.omschrijving,
          categorie: reg.categorie,
        }),
      });

      if (!res.ok) throw new Error();
      const { registratie } = await res.json();
      timer.start(reg.projectId, reg.omschrijving || "", reg.categorie as TijdCategorie, registratie.id);
      laadRegistraties();
      addToast("Timer gestart");
    } catch {
      addToast("Kon timer niet starten", "fout");
    }
  }

  // Export CSV
  function handleExport() {
    window.open(`/api/tijdregistraties/export?van=${range.van}&tot=${range.tot}`, "_blank");
  }

  // Group registrations by day
  const groepen = registraties.reduce<Record<string, Registratie[]>>((acc, reg) => {
    const dag = reg.startTijd.split("T")[0];
    if (!acc[dag]) acc[dag] = [];
    acc[dag].push(reg);
    return acc;
  }, {});

  const gesorteerdeGroepen = Object.entries(groepen).sort(([a], [b]) => b.localeCompare(a));

  // Totals
  const totaalMinuten = registraties.reduce((sum, r) => {
    if (r.eindTijd && r.duurMinuten) return sum + r.duurMinuten;
    if (!r.eindTijd && r.startTijd) {
      return sum + Math.round((Date.now() - new Date(r.startTijd).getTime()) / 60000);
    }
    return sum;
  }, 0);

  const periodeLabel = periode === "dag" ? "Vandaag" : periode === "week" ? "Deze week" : "Deze maand";

  return (
    <PageTransition>
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Timer Section */}
      <div className={cn(
        "bg-autronis-card border rounded-2xl p-5 lg:p-8 transition-colors",
        timer.isRunning ? "border-autronis-accent/40" : "border-autronis-border"
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          {/* Timer display */}
          <div className={cn(
            "text-5xl lg:text-6xl font-bold font-mono min-w-[200px] tabular-nums transition-colors",
            timer.isRunning ? "text-autronis-accent" : "text-autronis-text-primary"
          )}>
            {timer.isRunning ? formatTijd(timer.elapsed) : "0:00:00"}
          </div>

          {/* Controls */}
          <div className="flex flex-1 flex-col sm:flex-row gap-3">
            {/* Project selector */}
            <select
              value={timer.isRunning ? timer.projectId || "" : timerProjectId || ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (timer.isRunning) {
                  timer.setProjectId(id);
                  if (timer.registratieId) {
                    fetch(`/api/tijdregistraties/${timer.registratieId}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ projectId: id }),
                    });
                  }
                } else {
                  setTimerProjectId(id);
                }
              }}
              className="bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-lg px-4 py-3 text-sm min-w-[220px]"
            >
              <option value="">Selecteer project...</option>
              {projecten.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam} — {p.klantNaam}
                </option>
              ))}
            </select>

            {/* Description */}
            <input
              ref={omschrijvingRef}
              type="text"
              placeholder="Waar werk je aan?"
              value={timer.isRunning ? timer.omschrijving : timerOmschrijving}
              onChange={(e) => {
                if (timer.isRunning) {
                  timer.setOmschrijving(e.target.value);
                } else {
                  setTimerOmschrijving(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !timer.isRunning) {
                  e.preventDefault();
                  handleStart();
                }
              }}
              onBlur={() => {
                if (timer.isRunning && timer.registratieId) {
                  fetch(`/api/tijdregistraties/${timer.registratieId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ omschrijving: timer.omschrijving || null }),
                  });
                }
              }}
              className="flex-1 bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-lg px-4 py-3 text-sm placeholder:text-autronis-text-secondary/50"
            />

            {/* Category */}
            <select
              value={timer.isRunning ? timer.categorie : timerCategorie}
              onChange={(e) => {
                const cat = e.target.value as TijdCategorie;
                if (timer.isRunning) {
                  timer.setCategorie(cat);
                  if (timer.registratieId) {
                    fetch(`/api/tijdregistraties/${timer.registratieId}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ categorie: cat }),
                    });
                  }
                } else {
                  setTimerCategorie(cat);
                }
              }}
              className="bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-lg px-4 py-3 text-sm min-w-[150px]"
            >
              {Object.entries(CATEGORIE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Start/Stop button */}
          {timer.isRunning ? (
            <button
              onClick={handleStop}
              className="flex items-center gap-2.5 bg-red-500 hover:bg-red-600 text-white px-7 py-3 rounded-xl font-semibold text-base transition-colors shadow-lg shadow-red-500/20"
            >
              <Square className="w-5 h-5" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="flex items-center gap-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg px-7 py-3 rounded-xl font-semibold text-base transition-colors shadow-lg shadow-autronis-accent/20"
            >
              <Play className="w-5 h-5" />
              Start
            </button>
          )}
        </div>

        {/* Keyboard hint */}
        {!timer.isRunning && (
          <div className="mt-4 text-xs text-autronis-text-secondary/50">
            Tip: druk <kbd className="px-1.5 py-0.5 bg-autronis-bg rounded border border-autronis-border text-[11px] font-mono">Enter</kbd> in het omschrijving veld of <kbd className="px-1.5 py-0.5 bg-autronis-bg rounded border border-autronis-border text-[11px] font-mono">Ctrl+Enter</kbd> overal om te starten
          </div>
        )}
      </div>

      {/* Weekoverzicht (only show in week view) */}
      {periode === "week" && !laden && registraties.length > 0 && (
        <WeekOverzicht registraties={registraties} />
      )}

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-autronis-text-primary">Registraties</h2>
          <span className="text-sm text-autronis-text-secondary">
            {periodeLabel} — {formatUrenTotaal(totaalMinuten)} totaal
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Period filter */}
          <div className="flex bg-autronis-card border border-autronis-border rounded-lg overflow-hidden">
            {(["dag", "week", "maand"] as Periode[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriode(p)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  periode === p
                    ? "bg-autronis-accent text-autronis-bg"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Export */}
          <button
            onClick={handleExport}
            className="p-2.5 bg-autronis-card border border-autronis-border rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            title="Exporteer als CSV"
          >
            <Download className="w-5 h-5" />
          </button>

          {/* Manual entry */}
          <button
            onClick={() => {
              setBewerkRegistratie(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 bg-autronis-card border border-autronis-border text-autronis-text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-autronis-border transition-colors"
          >
            <Plus className="w-4 h-4" />
            Handmatig
          </button>
        </div>
      </div>

      {/* Registration list */}
      {laden ? (
        <div className="space-y-6">
          {/* Header skeleton */}
          <div>
            <Skeleton className="h-5 w-40 mb-2" />
            <Skeleton className="h-4 w-56" />
          </div>
          {/* Timer card skeleton */}
          <div className="rounded-2xl border border-autronis-border bg-autronis-card p-6">
            <div className="flex items-center gap-5">
              <Skeleton className="h-14 w-48" />
              <Skeleton className="h-10 w-52 rounded-lg" />
              <Skeleton className="h-10 flex-1 rounded-lg" />
              <Skeleton className="h-10 w-36 rounded-lg" />
              <Skeleton className="h-10 w-24 rounded-xl" />
            </div>
          </div>
          {/* Filter tabs skeleton */}
          <div className="flex gap-2">
            <Skeleton className="h-9 w-16 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
          {/* 5 registratie row skeletons */}
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-autronis-border bg-autronis-card px-5 py-4.5 flex items-center gap-4"
              >
                <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
                <div className="flex-1 min-w-0">
                  <Skeleton className="h-4 w-1/3 mb-2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-6 w-20 rounded-lg" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-14" />
              </div>
            ))}
          </div>
        </div>
      ) : gesorteerdeGroepen.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="w-20 h-20 rounded-2xl bg-autronis-accent/10 flex items-center justify-center">
            <Clock className="w-10 h-10 text-autronis-accent/60" />
          </div>
          <div className="text-center">
            <p className="text-lg text-autronis-text-primary font-medium mb-1">Nog geen registraties</p>
            <p className="text-base text-autronis-text-secondary">
              Start een timer of voeg handmatig uren toe
            </p>
          </div>
          <div className="flex gap-3 mt-1">
            <button
              onClick={() => omschrijvingRef.current?.focus()}
              className="flex items-center gap-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <Play className="w-5 h-5" />
              Start timer
            </button>
            <button
              onClick={() => {
                setBewerkRegistratie(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-2 bg-autronis-card border border-autronis-border text-autronis-text-primary px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-autronis-border transition-colors"
            >
              <Plus className="w-5 h-5" />
              Handmatig
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {gesorteerdeGroepen.map(([dag, entries]) => {
            const dagTotaal = entries.reduce((sum, r) => {
              if (r.eindTijd && r.duurMinuten) return sum + r.duurMinuten;
              if (!r.eindTijd) return sum + Math.round((Date.now() - new Date(r.startTijd).getTime()) / 60000);
              return sum;
            }, 0);

            return (
              <div key={dag}>
                {/* Day header */}
                <div className="flex items-center gap-4 mb-3 px-1">
                  <span className="text-sm font-semibold uppercase text-autronis-text-secondary tracking-wide">
                    {dagLabel(dag)}
                  </span>
                  <div className="flex-1 h-px bg-autronis-border" />
                  <span className="text-sm font-mono font-semibold text-autronis-text-secondary tabular-nums">
                    {formatUrenTotaal(dagTotaal)}
                  </span>
                </div>

                {/* Entries */}
                <div className="flex flex-col gap-2">
                  {entries.map((reg) => {
                    const isActief = !reg.eindTijd;
                    const duur = isActief
                      ? Math.round((Date.now() - new Date(reg.startTijd).getTime()) / 60000)
                      : reg.duurMinuten || 0;

                    return (
                      <div
                        key={reg.id}
                        className={cn(
                          "group bg-autronis-card border rounded-2xl px-5 py-4.5 flex items-center justify-between transition-all",
                          isActief
                            ? "border-autronis-accent shadow-sm shadow-autronis-accent/10"
                            : "border-autronis-border hover:border-autronis-text-secondary/20"
                        )}
                      >
                        {/* Left */}
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          {/* Status dot */}
                          <div
                            className={cn(
                              "w-2.5 h-2.5 rounded-full flex-shrink-0",
                              isActief ? "bg-autronis-accent animate-pulse" : "bg-autronis-text-secondary/40"
                            )}
                          />
                          <div className="min-w-0">
                            <div className="text-base font-medium text-autronis-text-primary truncate">
                              {reg.omschrijving || "(geen omschrijving)"}
                            </div>
                            <div className="text-sm text-autronis-text-secondary truncate mt-0.5">
                              {reg.projectNaam} — {reg.klantNaam}
                            </div>
                          </div>
                        </div>

                        {/* Right */}
                        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                          {/* Action buttons (hover) */}
                          <div className="hidden group-hover:flex items-center gap-1">
                            {!isActief && (
                              <button
                                onClick={() => handleHerhaal(reg)}
                                className="p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary hover:text-autronis-accent transition-colors"
                                title="Herhaal"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setBewerkRegistratie(reg);
                                setModalOpen(true);
                              }}
                              className="p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                              title="Bewerken"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setVerwijderConfirm(reg.id)}
                              className="p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary hover:text-red-400 transition-colors"
                              title="Verwijderen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Category badge with color */}
                          <span className={cn(
                            "hidden sm:inline-block text-xs px-2.5 py-1 rounded-lg border font-medium",
                            CATEGORIE_KLEUREN[reg.categorie] || "bg-autronis-bg text-autronis-text-secondary"
                          )}>
                            {CATEGORIE_LABELS[reg.categorie] || reg.categorie}
                          </span>

                          {/* Times */}
                          {!isActief && reg.eindTijd && (
                            <span className="hidden sm:inline text-sm text-autronis-text-secondary tabular-nums">
                              {formatTijdstip(reg.startTijd)} – {formatTijdstip(reg.eindTijd)}
                            </span>
                          )}

                          {/* Duration — live-updating for active timer */}
                          <span className={cn(
                            "font-bold text-base font-mono tabular-nums min-w-[55px] text-right",
                            isActief ? "text-autronis-accent" : "text-autronis-text-primary"
                          )}>
                            {isActief ? <LiveDuur startTijd={reg.startTijd} /> : formatDuurKort(duur)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Handmatig Modal */}
      <HandmatigModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setBewerkRegistratie(null);
        }}
        projecten={projecten}
        registratie={bewerkRegistratie}
        onOpgeslagen={() => {
          setModalOpen(false);
          setBewerkRegistratie(null);
          laadRegistraties();
        }}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={verwijderConfirm !== null}
        onClose={() => setVerwijderConfirm(null)}
        onBevestig={() => {
          if (verwijderConfirm !== null) {
            handleVerwijder(verwijderConfirm);
          }
        }}
        titel="Registratie verwijderen"
        bericht="Weet je zeker dat je deze tijdregistratie wilt verwijderen? Dit kan niet ongedaan gemaakt worden."
        bevestigTekst="Verwijderen"
      />
    </div>
    </PageTransition>
  );
}
