"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Euro,
  Clock,
  FolderKanban,
  AlertTriangle,
  Play,
  Square,
  CheckCircle2,
  CalendarDays,
  AlertCircle,
  ListTodo,
} from "lucide-react";
import { cn, formatUren, formatBedrag, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTimer } from "@/hooks/use-timer";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Sparkline } from "@/components/ui/sparkline";
import { BriefingModal } from "@/components/ui/briefing-modal";
import { CheckBurst } from "@/components/ui/confetti";
import type { TijdCategorie } from "@/types";

interface DashboardData {
  gebruiker: { id: number; naam: string };
  kpis: {
    omzetDezeMaand: number;
    urenDezeWeek: { totaal: number; eigen: number; teamgenoot: number };
    actieveProjecten: number;
    deadlinesDezeWeek: number;
  };
  mijnTaken: {
    id: number;
    titel: string;
    omschrijving: string | null;
    status: string;
    deadline: string | null;
    prioriteit: string;
    projectId: number | null;
    projectNaam: string | null;
    klantId: number | null;
  }[];
  deadlines: {
    projectId: number;
    projectNaam: string;
    klantId: number | null;
    klantNaam: string;
    deadline: string;
    voortgang: number | null;
  }[];
  teamgenoot: {
    id: number;
    naam: string;
    email: string;
    actieveTimer: {
      id: number;
      omschrijving: string | null;
      startTijd: string;
      projectNaam: string | null;
    } | null;
    urenPerDag: number[];
    urenTotaal: number;
    taken: { id: number; titel: string; projectNaam: string | null }[];
  } | null;
  projecten: { id: number; naam: string; klantNaam: string }[];
}

function getBegroeting(): string {
  const uur = new Date().getHours();
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

function getDatumString(): string {
  return new Date().toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function deadlineKleur(deadline: string): string {
  const nu = new Date();
  nu.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - nu.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "text-red-400";
  if (diff <= 1) return "text-red-400";
  if (diff <= 7) return "text-amber-400";
  return "text-autronis-text-secondary";
}

function deadlineLabel(deadline: string): string {
  const nu = new Date();
  nu.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - nu.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Verlopen";
  if (diff === 0) return "Vandaag";
  if (diff === 1) return "Morgen";
  return formatDatum(deadline);
}

const prioriteitConfig: Record<string, { color: string; border: string }> = {
  hoog: { color: "text-red-400", border: "border-red-500" },
  normaal: { color: "text-amber-400", border: "border-amber-500" },
  laag: { color: "text-slate-400", border: "border-slate-500" },
};

export default function DashboardPage() {
  const { addToast } = useToast();
  const timer = useTimer();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Timer form state
  const [timerProjectId, setTimerProjectId] = useState<string>("");
  const [timerOmschrijving, setTimerOmschrijving] = useState("");
  const [timerCategorie, setTimerCategorie] = useState<TijdCategorie>("development");

  // CheckBurst animation state
  const [completedTaskId, setCompletedTaskId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      addToast("Kon dashboard niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Timer tick
  useEffect(() => {
    if (!timer.isRunning) return;
    const interval = setInterval(() => timer.tick(), 1000);
    return () => clearInterval(interval);
  }, [timer.isRunning, timer]);

  // Timer in browser tab
  useEffect(() => {
    if (!timer.isRunning) {
      document.title = "Dashboard | Autronis";
      return;
    }

    const projectNaam = data?.projecten.find((p) => p.id === timer.projectId)?.naam || "Project";

    const updateTitle = () => {
      const elapsed = timer.elapsed;
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      const formatted = `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      document.title = `⏱ ${formatted} — ${projectNaam} | Autronis`;
    };

    updateTitle();
    const interval = setInterval(updateTitle, 1000);
    return () => {
      clearInterval(interval);
      document.title = "Dashboard | Autronis";
    };
  }, [timer.isRunning, timer.elapsed, timer.projectId, data?.projecten]);

  const handleStartTimer = async () => {
    if (!timerProjectId) {
      addToast("Selecteer een project", "fout");
      return;
    }

    try {
      const res = await fetch("/api/tijdregistraties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(timerProjectId),
          omschrijving: timerOmschrijving || null,
          categorie: timerCategorie,
        }),
      });

      if (!res.ok) throw new Error();
      const { registratie } = await res.json();

      timer.start(
        Number(timerProjectId),
        timerOmschrijving,
        timerCategorie,
        registratie.id
      );

      addToast("Timer gestart", "succes");
      setTimerOmschrijving("");
    } catch {
      addToast("Kon timer niet starten", "fout");
    }
  };

  const handleStopTimer = async () => {
    if (!timer.registratieId) return;

    try {
      const eindTijd = new Date().toISOString();
      const startMs = new Date(timer.startTijd!).getTime();
      const duurMinuten = Math.round((Date.now() - startMs) / 60000);

      const res = await fetch(`/api/tijdregistraties/${timer.registratieId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eindTijd, duurMinuten }),
      });

      if (!res.ok) throw new Error();
      timer.stop();
      addToast("Timer gestopt", "succes");
      fetchData();
    } catch {
      addToast("Kon timer niet stoppen", "fout");
    }
  };

  const handleTaakAfvinken = async (taakId: number) => {
    try {
      const res = await fetch(`/api/taken/${taakId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "afgerond" }),
      });
      if (!res.ok) throw new Error();

      setCompletedTaskId(taakId);
      setTimeout(() => setCompletedTaskId(null), 500);

      fetchData();
    } catch {
      addToast("Kon taak niet bijwerken", "fout");
    }
  };

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        <SkeletonDashboard />
      </div>
    );
  }

  if (!data) return null;

  const { gebruiker, kpis, mijnTaken, deadlines, teamgenoot, projecten } = data;
  const maxUrenDag = teamgenoot ? Math.max(...teamgenoot.urenPerDag, 1) : 1;

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Begroeting */}
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">
            {getBegroeting()}, {gebruiker.naam.split(" ")[0]}
          </h1>
          <p className="text-base text-autronis-text-secondary mt-1 capitalize">
            {getDatumString()}
          </p>
        </div>

        {/* KPI balk */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow kpi-gradient-omzet relative overflow-hidden">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                <Euro className="w-5 h-5 text-autronis-accent" />
              </div>
            </div>
            <p className="text-3xl font-bold text-autronis-accent">
              <AnimatedNumber value={kpis.omzetDezeMaand} format={(n) => formatBedrag(n)} />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              Omzet deze maand
            </p>
            <div className="absolute bottom-2 right-2 opacity-60">
              <Sparkline data={[3, 5, 2, 8, 4, 7, 6]} />
            </div>
          </div>

          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow kpi-gradient-uren relative overflow-hidden">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                <Clock className="w-5 h-5 text-autronis-accent" />
              </div>
            </div>
            <p className="text-3xl font-bold text-autronis-text-primary">
              <AnimatedNumber value={kpis.urenDezeWeek.totaal} format={(n) => formatUren(n)} />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              Uren deze week
            </p>
            <p className="text-sm text-autronis-text-secondary mt-0.5">
              {gebruiker.naam.split(" ")[0]} {formatUren(kpis.urenDezeWeek.eigen)} · {teamgenoot?.naam.split(" ")[0] || "Team"} {formatUren(kpis.urenDezeWeek.teamgenoot)}
            </p>
            <div className="absolute bottom-2 right-2 opacity-60">
              <Sparkline data={[120, 90, 150, 180, 140, 160, 200]} />
            </div>
          </div>

          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow kpi-gradient-projecten relative overflow-hidden">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                <FolderKanban className="w-5 h-5 text-autronis-accent" />
              </div>
            </div>
            <p className="text-3xl font-bold text-autronis-text-primary">
              <AnimatedNumber value={kpis.actieveProjecten} />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              Actieve projecten
            </p>
          </div>

          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow kpi-gradient-deadlines relative overflow-hidden">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "p-2.5 rounded-xl",
                kpis.deadlinesDezeWeek > 0 ? "bg-red-500/10" : "bg-autronis-accent/10"
              )}>
                <AlertTriangle className={cn(
                  "w-5 h-5",
                  kpis.deadlinesDezeWeek > 0 ? "text-red-400" : "text-autronis-accent"
                )} />
              </div>
            </div>
            <p className={cn(
              "text-3xl font-bold",
              kpis.deadlinesDezeWeek > 0 ? "text-red-400" : "text-autronis-text-primary"
            )}>
              <AnimatedNumber value={kpis.deadlinesDezeWeek} />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              Deadlines deze week
            </p>
          </div>
        </div>

        {/* Twee-kolom layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
          {/* Links: Mijn werkplek */}
          <div className="space-y-8">
            {/* Snel starten / Actieve timer */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
              {timer.isRunning ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      <h2 className="text-lg font-semibold text-autronis-text-primary">
                        Timer loopt
                      </h2>
                    </div>
                    <span className="text-3xl font-bold text-autronis-accent font-mono tabular-nums">
                      {formatElapsed(timer.elapsed)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-autronis-bg/50 rounded-xl p-4">
                    <div>
                      <p className="text-base font-medium text-autronis-text-primary">
                        {timer.omschrijving || "Geen omschrijving"}
                      </p>
                      <p className="text-sm text-autronis-text-secondary mt-1">
                        {projecten.find((p) => p.id === timer.projectId)?.naam || "Project"} — {projecten.find((p) => p.id === timer.projectId)?.klantNaam || ""}
                      </p>
                    </div>
                    <button
                      onClick={handleStopTimer}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-autronis-text-primary mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-autronis-accent" />
                    Snel starten
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={timerProjectId}
                      onChange={(e) => setTimerProjectId(e.target.value)}
                      className="bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors sm:flex-1"
                    >
                      <option value="">Selecteer project...</option>
                      {projecten.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.naam} — {p.klantNaam}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={timerOmschrijving}
                      onChange={(e) => setTimerOmschrijving(e.target.value)}
                      placeholder="Waar werk je aan?"
                      className="bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors sm:flex-[1.5]"
                      onKeyDown={(e) => e.key === "Enter" && handleStartTimer()}
                    />
                    <select
                      value={timerCategorie}
                      onChange={(e) => setTimerCategorie(e.target.value as TijdCategorie)}
                      className="bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors sm:w-40"
                    >
                      <option value="development">Development</option>
                      <option value="meeting">Meeting</option>
                      <option value="administratie">Administratie</option>
                      <option value="overig">Overig</option>
                    </select>
                    <button
                      onClick={handleStartTimer}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 whitespace-nowrap"
                    >
                      <Play className="w-4 h-4" />
                      Start
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mijn Taken */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-autronis-accent" />
                  Mijn taken
                </h2>
                <span className="text-sm text-autronis-accent font-medium">
                  {mijnTaken.length} open
                </span>
              </div>
              {mijnTaken.length === 0 ? (
                <p className="text-base text-autronis-text-secondary">
                  Geen openstaande taken — lekker bezig!
                </p>
              ) : (
                <div className="space-y-3">
                  {mijnTaken.map((taak) => {
                    const prio = prioriteitConfig[taak.prioriteit] || prioriteitConfig.normaal;
                    return (
                      <div
                        key={taak.id}
                        className="bg-autronis-bg/50 rounded-xl p-4 flex items-center gap-4 group relative"
                      >
                        <button
                          onClick={() => handleTaakAfvinken(taak.id)}
                          className={cn(
                            "w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors hover:bg-green-500/20",
                            prio.border
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-medium text-autronis-text-primary truncate">
                            {taak.titel}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {taak.projectNaam && (
                              <span className="text-sm text-autronis-text-secondary">
                                {taak.projectNaam}
                              </span>
                            )}
                            {taak.deadline && (
                              <span className={cn("text-sm flex items-center gap-1", deadlineKleur(taak.deadline))}>
                                · {deadlineLabel(taak.deadline)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={cn("text-xs font-semibold flex-shrink-0", prio.color)}>
                          {taak.prioriteit === "hoog" && <AlertCircle className="w-4 h-4" />}
                        </span>
                        <CheckBurst active={completedTaskId === taak.id} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Aankomende Deadlines */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <h2 className="text-lg font-semibold text-autronis-text-primary mb-5 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-autronis-accent" />
                Aankomende deadlines
              </h2>
              {deadlines.length === 0 ? (
                <p className="text-base text-autronis-text-secondary">
                  Geen projecten met deadlines.
                </p>
              ) : (
                <div className="space-y-3">
                  {deadlines.map((dl) => (
                    <Link
                      key={dl.projectId}
                      href={`/klanten/${dl.klantId}/projecten/${dl.projectId}`}
                      className="bg-autronis-bg/50 rounded-xl p-4 flex items-center justify-between gap-4 hover:bg-autronis-bg/80 transition-colors block"
                    >
                      <div className="min-w-0">
                        <p className="text-base font-medium text-autronis-text-primary truncate">
                          {dl.projectNaam}
                        </p>
                        <p className="text-sm text-autronis-text-secondary mt-0.5">
                          {dl.klantNaam}
                        </p>
                      </div>
                      <span className={cn("text-sm font-semibold flex-shrink-0", deadlineKleur(dl.deadline))}>
                        {deadlineLabel(dl.deadline)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rechts: Teamgenoot status */}
          <div className="space-y-8">
            {teamgenoot ? (
              <>
                {/* Live status */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-autronis-accent flex items-center justify-center text-sm font-bold text-autronis-bg">
                      {teamgenoot.naam.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-autronis-text-primary">
                        {teamgenoot.naam}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          teamgenoot.actieveTimer ? "bg-green-500 status-pulse" : "bg-slate-500"
                        )} />
                        <span className={cn(
                          "text-sm",
                          teamgenoot.actieveTimer ? "text-green-400" : "text-autronis-text-secondary"
                        )}>
                          {teamgenoot.actieveTimer ? "Aan het werk" : "Offline"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {teamgenoot.actieveTimer && (
                    <div className="bg-autronis-bg/50 rounded-xl p-4 border-l-3 border-autronis-accent" style={{ borderLeftWidth: "3px" }}>
                      <p className="text-xs text-autronis-text-secondary">Bezig met</p>
                      <p className="text-base font-medium text-autronis-text-primary mt-1">
                        {teamgenoot.actieveTimer.omschrijving || "Geen omschrijving"}
                      </p>
                      <p className="text-sm text-autronis-text-secondary mt-1">
                        {teamgenoot.actieveTimer.projectNaam}
                      </p>
                    </div>
                  )}
                </div>

                {/* Week overzicht */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                  <h3 className="text-base font-semibold text-autronis-text-primary mb-4">
                    {teamgenoot.naam.split(" ")[0]}&apos;s week
                  </h3>
                  <div className="flex items-end gap-2 h-20 mb-2">
                    {["Ma", "Di", "Wo", "Do", "Vr"].map((dag, i) => {
                      const minuten = teamgenoot.urenPerDag[i] || 0;
                      const hoogte = maxUrenDag > 0 ? (minuten / maxUrenDag) * 100 : 0;
                      return (
                        <div key={dag} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full relative" style={{ height: "80px" }}>
                            <motion.div
                              className={cn(
                                "absolute bottom-0 w-full rounded-t-md",
                                minuten > 0 ? "bg-autronis-accent" : "bg-autronis-border"
                              )}
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(hoogte, 4)}%` }}
                              transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between px-1">
                    {["Ma", "Di", "Wo", "Do", "Vr"].map((dag) => (
                      <span key={dag} className="text-xs text-autronis-text-secondary flex-1 text-center">
                        {dag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-bold text-autronis-text-primary">
                      {formatUren(teamgenoot.urenTotaal)}
                    </p>
                    <p className="text-sm text-autronis-text-secondary">uren deze week</p>
                  </div>
                </div>

                {/* Taken */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-autronis-text-primary">
                      {teamgenoot.naam.split(" ")[0]}&apos;s taken
                    </h3>
                    <span className="text-xs text-autronis-text-secondary">
                      {teamgenoot.taken.length} open
                    </span>
                  </div>
                  {teamgenoot.taken.length === 0 ? (
                    <p className="text-sm text-autronis-text-secondary">Geen open taken.</p>
                  ) : (
                    <div className="space-y-2">
                      {teamgenoot.taken.map((taak) => (
                        <div
                          key={taak.id}
                          className="bg-autronis-bg/50 rounded-lg p-3"
                        >
                          <p className="text-sm font-medium text-autronis-text-primary truncate">
                            {taak.titel}
                          </p>
                          {taak.projectNaam && (
                            <p className="text-xs text-autronis-text-secondary mt-1">
                              {taak.projectNaam}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                <p className="text-base text-autronis-text-secondary">
                  Geen teamgenoten gevonden.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Briefing Modal */}
        <BriefingModal data={{
          takenVandaag: mijnTaken.length,
          deadlinesDezeWeek: kpis.deadlinesDezeWeek,
          openstaandeFacturen: 0,
        }} />
      </div>
    </PageTransition>
  );
}
