"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Download, RotateCcw, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTimer } from "@/hooks/use-timer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TijdCategorie } from "@/types";
import {
  type Periode,
  berekenVanTot,
  navigeerDatum,
  datumLabel,
  CategorieBadge,
} from "./constants";
import { HandmatigModal } from "./handmatig-modal";
import {
  useProjecten,
  useRegistraties,
  type Registratie,
} from "@/hooks/queries/use-tijdregistraties";

// ============ HELPERS ============

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

const MAANDEN = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];
const DAGEN = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

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

// ============ LIVE TIMER DUUR ============

function LiveDuur({ startTijd }: { startTijd: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const minuten = Math.round((Date.now() - new Date(startTijd).getTime()) / 60000);
  return <>{formatDuurKort(minuten)}</>;
}

// ============ MAIN COMPONENT ============

export function TabRegistraties() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const timer = useTimer();

  const [periode, setPeriode] = useState<Periode>("week");
  const [huidigeDatum, setHuidigeDatum] = useState<Date>(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [bewerkRegistratie, setBewerkRegistratie] = useState<Registratie | null>(null);
  const [verwijderConfirm, setVerwijderConfirm] = useState<number | null>(null);

  const range = berekenVanTot(huidigeDatum, periode);

  const { data: projecten = [] } = useProjecten();
  const { data: registraties = [], isLoading: laden } = useRegistraties(range.van, range.tot);

  const invalidateRegistraties = () =>
    queryClient.invalidateQueries({ queryKey: ["registraties"] });

  // Delete registration
  const verwijderMutatie = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/tijdregistraties/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kon registratie niet verwijderen");
    },
    onSuccess: () => {
      invalidateRegistraties();
      addToast("Registratie verwijderd");
    },
    onError: () => addToast("Kon registratie niet verwijderen", "fout"),
  });

  // Repeat entry — starts a new timer
  async function handleHerhaal(reg: Registratie) {
    if (timer.isRunning) {
      addToast("Stop eerst de lopende timer", "fout");
      return;
    }
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
      const { registratie } = (await res.json()) as { registratie: { id: number } };
      timer.start(reg.projectId, reg.omschrijving ?? "", reg.categorie as TijdCategorie, registratie.id);
      invalidateRegistraties();
      addToast("Timer gestart");
    } catch {
      addToast("Kon timer niet starten", "fout");
    }
  }

  // Export CSV
  function handleExport() {
    window.open(`/api/tijdregistraties/export?van=${range.van}&tot=${range.tot}`, "_blank");
  }

  // Group by day
  const groepen = registraties.reduce<Record<string, Registratie[]>>((acc, reg) => {
    const dag = reg.startTijd.split("T")[0];
    if (!acc[dag]) acc[dag] = [];
    acc[dag].push(reg);
    return acc;
  }, {});

  const gesorteerdeGroepen = Object.entries(groepen).sort(([a], [b]) => b.localeCompare(a));

  const totaalMinuten = registraties.reduce((sum, r) => {
    if (r.eindTijd && r.duurMinuten) return sum + r.duurMinuten;
    if (!r.eindTijd && r.startTijd) {
      return sum + Math.round((Date.now() - new Date(r.startTijd).getTime()) / 60000);
    }
    return sum;
  }, 0);

  const periodeLabels: Record<Periode, string> = {
    dag: "Vandaag",
    week: "Deze week",
    maand: "Deze maand",
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-autronis-text-primary">Registraties</h2>
          <span className="text-sm text-autronis-text-secondary">
            {periodeLabels[periode]} — {formatUrenTotaal(totaalMinuten)} totaal
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Period filter */}
          <div className="flex bg-autronis-card border border-autronis-border rounded-lg overflow-hidden">
            {(["dag", "week", "maand"] as Periode[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriode(p);
                  setHuidigeDatum(new Date());
                }}
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

          {/* Date navigation */}
          <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-lg overflow-hidden">
            <button
              onClick={() => setHuidigeDatum((d) => navigeerDatum(d, periode, -1))}
              className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              title="Vorige periode"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-autronis-text-secondary px-2 min-w-[120px] text-center">
              {datumLabel(huidigeDatum, periode)}
            </span>
            <button
              onClick={() => setHuidigeDatum((d) => navigeerDatum(d, periode, 1))}
              className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              title="Volgende periode"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
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
        <div className="space-y-8">
          {Array.from({ length: 2 }).map((_, gi) => (
            <div key={gi}>
              <div className="flex items-center gap-4 mb-3 px-1">
                <Skeleton className="h-4 w-40" />
                <div className="flex-1 h-px bg-autronis-border" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-autronis-border bg-autronis-card px-5 py-4 flex items-center gap-4"
                  >
                    <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Skeleton className="h-4 w-1/3 mb-2" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-14" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : gesorteerdeGroepen.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="w-20 h-20 rounded-2xl bg-autronis-accent/10 flex items-center justify-center">
            <Clock className="w-10 h-10 text-autronis-accent/60" />
          </div>
          <div className="text-center">
            <p className="text-lg text-autronis-text-primary font-medium mb-1">Geen registraties</p>
            <p className="text-base text-autronis-text-secondary">
              Geen tijdregistraties gevonden voor deze periode
            </p>
          </div>
          <button
            onClick={() => {
              setBewerkRegistratie(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 bg-autronis-card border border-autronis-border text-autronis-text-primary px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-autronis-border transition-colors"
          >
            <Plus className="w-5 h-5" />
            Handmatig invoeren
          </button>
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
                      : (reg.duurMinuten ?? 0);

                    return (
                      <div
                        key={reg.id}
                        className={cn(
                          "group bg-autronis-card border rounded-2xl px-5 py-4 flex items-center justify-between transition-all",
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
                              isActief
                                ? "bg-autronis-accent animate-pulse"
                                : "bg-autronis-text-secondary/40"
                            )}
                          />
                          <div className="min-w-0">
                            <div className="text-base font-medium text-autronis-text-primary truncate">
                              {reg.omschrijving ?? "(geen omschrijving)"}
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

                          {/* Category badge */}
                          <span className="hidden sm:inline-flex">
                            <CategorieBadge categorie={reg.categorie} />
                          </span>

                          {/* Time range */}
                          {!isActief && reg.eindTijd && (
                            <span className="hidden sm:inline text-sm text-autronis-text-secondary tabular-nums">
                              {formatTijdstip(reg.startTijd)} – {formatTijdstip(reg.eindTijd)}
                            </span>
                          )}

                          {/* Duration */}
                          <span
                            className={cn(
                              "font-bold text-base font-mono tabular-nums min-w-[55px] text-right",
                              isActief ? "text-autronis-accent" : "text-autronis-text-primary"
                            )}
                          >
                            {isActief ? (
                              <LiveDuur startTijd={reg.startTijd} />
                            ) : (
                              formatDuurKort(duur)
                            )}
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
          invalidateRegistraties();
        }}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={verwijderConfirm !== null}
        onClose={() => setVerwijderConfirm(null)}
        onBevestig={() => {
          if (verwijderConfirm !== null) {
            verwijderMutatie.mutate(verwijderConfirm);
            setVerwijderConfirm(null);
          }
        }}
        titel="Registratie verwijderen"
        bericht="Weet je zeker dat je deze tijdregistratie wilt verwijderen? Dit kan niet ongedaan gemaakt worden."
        bevestigTekst="Verwijderen"
      />
    </div>
  );
}
