"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, Download, RotateCcw, Clock, ChevronLeft, ChevronRight, Copy, Check, Building2, Home } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTimer } from "@/hooks/use-timer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TijdCategorie } from "@/types";
import { detectLocatie } from "@/lib/detect-locatie";
import {
  type Periode,
  berekenVanTot,
  navigeerDatum,
  datumLabel,
  CategorieBadge,
  LocatieBadge,
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

// ============ INLINE EDIT ROW ============

const CATEGORIE_OPTIES: TijdCategorie[] = ["development", "meeting", "administratie", "overig"];
const CATEGORIE_LABELS: Record<TijdCategorie, string> = {
  development: "Development",
  meeting: "Meeting",
  administratie: "Administratie",
  overig: "Overig",
  focus: "Focus",
};

interface InlineEditProps {
  reg: Registratie;
  onSave: (data: { omschrijving: string; startTijdStr: string; eindTijdStr: string; categorie: TijdCategorie }) => void;
  onCancel: () => void;
}

function InlineEdit({ reg, onSave, onCancel }: InlineEditProps) {
  const [omschrijving, setOmschrijving] = useState(reg.omschrijving ?? "");
  const [startStr, setStartStr] = useState(
    reg.startTijd ? formatTijdstip(reg.startTijd) : "09:00"
  );
  const [eindStr, setEindStr] = useState(
    reg.eindTijd ? formatTijdstip(reg.eindTijd) : "10:00"
  );
  const [categorie, setCategorie] = useState<TijdCategorie>(reg.categorie as TijdCategorie ?? "development");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") onSave({ omschrijving, startTijdStr: startStr, eindTijdStr: eindStr, categorie });
    if (e.key === "Escape") onCancel();
  }

  const datumStr = reg.startTijd.split("T")[0];

  return (
    <div className="bg-autronis-card border border-autronis-accent/50 rounded-2xl px-3 sm:px-5 py-3 space-y-3">
      <input
        ref={inputRef}
        type="text"
        value={omschrijving}
        onChange={(e) => setOmschrijving(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Omschrijving..."
        className="w-full bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-lg px-3 py-1.5 text-sm placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="time"
          value={startStr}
          onChange={(e) => setStartStr(e.target.value)}
          className="bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-autronis-accent transition-colors"
        />
        <span className="text-autronis-text-secondary text-sm">–</span>
        <input
          type="time"
          value={eindStr}
          onChange={(e) => setEindStr(e.target.value)}
          className="bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-autronis-accent transition-colors"
        />
        <select
          value={categorie}
          onChange={(e) => setCategorie(e.target.value as TijdCategorie)}
          className="bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-autronis-accent transition-colors"
        >
          {CATEGORIE_OPTIES.map((c) => (
            <option key={c} value={c}>{CATEGORIE_LABELS[c]}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => onSave({ omschrijving, startTijdStr: startStr, eindTijdStr: eindStr, categorie })}
            className="px-3 py-1.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-lg text-xs font-semibold transition-colors"
          >
            Opslaan
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-autronis-text-secondary hover:text-autronis-text-primary text-xs transition-colors"
          >
            Annuleer
          </button>
        </div>
      </div>
    </div>
  );
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
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [kopieerdSucces, setKopieerdSucces] = useState(false);

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

  // Inline save
  const handleInlineSave = useCallback(async (
    reg: Registratie,
    data: { omschrijving: string; startTijdStr: string; eindTijdStr: string; categorie: TijdCategorie }
  ) => {
    const datumStr = reg.startTijd.split("T")[0];
    const startISO = new Date(`${datumStr}T${data.startTijdStr}:00`).toISOString();
    const eindISO = new Date(`${datumStr}T${data.eindTijdStr}:00`).toISOString();
    const duurMinuten = Math.round((new Date(eindISO).getTime() - new Date(startISO).getTime()) / 60000);

    try {
      const res = await fetch(`/api/tijdregistraties/${reg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          omschrijving: data.omschrijving || null,
          startTijd: startISO,
          eindTijd: eindISO,
          duurMinuten,
          categorie: data.categorie,
        }),
      });
      if (!res.ok) throw new Error();
      setInlineEditId(null);
      invalidateRegistraties();
    } catch {
      addToast("Kon registratie niet opslaan", "fout");
    }
  }, []);

  // Repeat entry — starts a new timer
  async function handleHerhaal(reg: Registratie) {
    if (timer.isRunning) {
      addToast("Stop eerst de lopende timer", "fout");
      return;
    }
    try {
      const locatie = detectLocatie();
      const res = await fetch("/api/tijdregistraties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: reg.projectId,
          omschrijving: reg.omschrijving,
          categorie: reg.categorie,
          locatie,
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

  // Copy as table (clipboard)
  async function handleKopieer() {
    const voltooide = registraties.filter((r) => r.eindTijd && r.duurMinuten);
    const header = "Datum\tProject\tOmschrijving\tCategorie\tDuur";
    const rows = voltooide.map((r) => {
      const datum = r.startTijd ? new Date(r.startTijd).toLocaleDateString("nl-NL") : "";
      const duur = r.duurMinuten ? formatUrenTotaal(r.duurMinuten) : "";
      return [datum, r.projectNaam ?? "", r.omschrijving ?? "", r.categorie ?? "", duur].join("\t");
    });
    const tekst = [header, ...rows].join("\n");
    try {
      await navigator.clipboard.writeText(tekst);
      setKopieerdSucces(true);
      setTimeout(() => setKopieerdSucces(false), 2000);
    } catch {
      addToast("Kon niet kopiëren", "fout");
    }
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

  const locatieSplit = registraties.reduce(
    (acc, r) => {
      const min = r.eindTijd && r.duurMinuten
        ? r.duurMinuten
        : !r.eindTijd && r.startTijd
          ? Math.round((Date.now() - new Date(r.startTijd).getTime()) / 60000)
          : 0;
      if (r.locatie === "kantoor") acc.kantoor += min;
      else if (r.locatie === "thuis") acc.thuis += min;
      else acc.onbekend += min;
      return acc;
    },
    { kantoor: 0, thuis: 0, onbekend: 0 }
  );

  const periodeLabels: Record<Periode, string> = {
    dag: "Vandaag",
    week: "Deze week",
    maand: "Deze maand",
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-autronis-text-primary">Registraties</h2>
            <span className="text-xs sm:text-sm text-autronis-text-secondary">
              {periodeLabels[periode]} — {formatUrenTotaal(totaalMinuten)} totaal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleKopieer}
              className={cn(
                "p-2 border rounded-lg transition-colors",
                kopieerdSucces
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-autronis-card border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
              title="Kopieer als tabel"
            >
              {kopieerdSucces ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleExport}
              className="p-2 bg-autronis-card border border-autronis-border rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              title="Exporteer als CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setBewerkRegistratie(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-autronis-card border border-autronis-border text-autronis-text-primary px-3 py-2 rounded-lg text-sm font-medium hover:bg-autronis-border transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Handmatig</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
                  "px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors",
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
              className="p-1.5 sm:p-2 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              title="Vorige periode"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm text-autronis-text-secondary px-1 sm:px-2 min-w-[90px] sm:min-w-[120px] text-center">
              {datumLabel(huidigeDatum, periode)}
            </span>
            <button
              onClick={() => setHuidigeDatum((d) => navigeerDatum(d, periode, 1))}
              className="p-1.5 sm:p-2 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              title="Volgende periode"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Locatie split bar */}
      {totaalMinuten > 0 && (locatieSplit.kantoor > 0 || locatieSplit.thuis > 0) && (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-autronis-text-secondary uppercase tracking-wide font-medium">Locatie</span>
            <div className="flex items-center gap-4 text-xs text-autronis-text-secondary">
              {locatieSplit.kantoor > 0 && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-blue-400" />
                  Kantoor {formatUrenTotaal(locatieSplit.kantoor)}
                </span>
              )}
              {locatieSplit.thuis > 0 && (
                <span className="flex items-center gap-1">
                  <Home className="w-3 h-3 text-orange-400" />
                  Thuis {formatUrenTotaal(locatieSplit.thuis)}
                </span>
              )}
            </div>
          </div>
          <div className="w-full h-2.5 bg-autronis-border/30 rounded-full overflow-hidden flex">
            {locatieSplit.kantoor > 0 && (
              <div
                className="h-full bg-blue-400 rounded-l-full"
                style={{ width: `${(locatieSplit.kantoor / totaalMinuten) * 100}%` }}
              />
            )}
            {locatieSplit.thuis > 0 && (
              <div
                className="h-full bg-orange-400 rounded-r-full"
                style={{ width: `${(locatieSplit.thuis / totaalMinuten) * 100}%` }}
              />
            )}
          </div>
        </div>
      )}

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

                    if (inlineEditId === reg.id) {
                      return (
                        <InlineEdit
                          key={reg.id}
                          reg={reg}
                          onSave={(data) => handleInlineSave(reg, data)}
                          onCancel={() => setInlineEditId(null)}
                        />
                      );
                    }

                    return (
                      <div
                        key={reg.id}
                        className={cn(
                          "group bg-autronis-card border rounded-2xl px-3 sm:px-5 py-3 sm:py-4 transition-all card-glow cursor-default",
                          isActief
                            ? "border-autronis-accent shadow-sm shadow-autronis-accent/10 animated-border"
                            : "border-autronis-border hover:border-autronis-text-secondary/20"
                        )}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          {/* Status dot */}
                          <div
                            className={cn(
                              "w-2.5 h-2.5 rounded-full flex-shrink-0",
                              isActief
                                ? "bg-autronis-accent animate-pulse"
                                : "bg-autronis-text-secondary/40"
                            )}
                          />
                          {/* Content — click omschrijving to inline edit */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "text-sm sm:text-base font-medium text-autronis-text-primary truncate",
                                  !isActief && "cursor-pointer hover:text-autronis-accent transition-colors"
                                )}
                                onClick={() => !isActief && setInlineEditId(reg.id)}
                                title={!isActief ? "Klik om te bewerken" : undefined}
                              >
                                {reg.omschrijving ?? "(geen omschrijving)"}
                              </span>
                              <span
                                className={cn(
                                  "font-bold text-sm sm:text-base font-mono tabular-nums flex-shrink-0",
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
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs sm:text-sm text-autronis-text-secondary truncate">
                                {reg.projectNaam}
                              </span>
                              <CategorieBadge categorie={reg.categorie} />
                              <LocatieBadge locatie={reg.locatie} />
                              {!isActief && reg.eindTijd && (
                                <span className="text-xs text-autronis-text-secondary tabular-nums ml-auto">
                                  {formatTijdstip(reg.startTijd)}–{formatTijdstip(reg.eindTijd)}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Action buttons (hover, desktop only) */}
                          <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
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
                              onClick={() => setVerwijderConfirm(reg.id)}
                              className="p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary hover:text-red-400 transition-colors"
                              title="Verwijderen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
