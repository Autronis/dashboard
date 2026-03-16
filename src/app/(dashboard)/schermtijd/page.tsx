"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Monitor,
  Clock,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Users,
  Shield,
  Lightbulb,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Check,
  X,
  AppWindow,
  Globe,
  LayoutGrid,
  Loader2,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Pause,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useScreenTime,
  useScreenTimeRegels,
  useScreenTimeRegelMutatie,
  useScreenTimeSuggesties,
  useScreenTimeSuggestieMutatie,
  useCategoriseer,
  useSessies,
  useWeekSessies,
  useSamenvatting,
  useGenereerSamenvatting,
} from "@/hooks/queries/use-screen-time";
import type { WeekDagData } from "@/hooks/queries/use-screen-time";
import { useGebruikers } from "@/hooks/queries/use-doelen";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ScreenTimeRegel,
  ScreenTimeSuggestie,
  ScreenTimeCategorie,
  ScreenTimeSessie,
} from "@/types";

// ============ CONSTANTS ============

const CATEGORIE_KLEUREN: Record<string, string> = {
  development: "#17B8A5",
  communicatie: "#3B82F6",
  design: "#A855F7",
  administratie: "#F59E0B",
  afleiding: "#EF4444",
  overig: "#6B7280",
  inactief: "#4B5563",
};

const CATEGORIE_LABELS: Record<string, string> = {
  development: "Development",
  communicatie: "Communicatie",
  design: "Design",
  administratie: "Administratie",
  afleiding: "Afleiding",
  overig: "Overig",
  inactief: "Inactief",
};

const PRODUCTIEF_CATEGORIEEN: ScreenTimeCategorie[] = [
  "development",
  "design",
  "administratie",
];

type Periode = "dag" | "week" | "maand";
type TabId = "overzicht" | "team" | "regels" | "suggesties";

const TABS: { id: TabId; label: string; icon: typeof Monitor }[] = [
  { id: "overzicht", label: "Overzicht", icon: Monitor },
  { id: "team", label: "Team", icon: Users },
  { id: "regels", label: "Regels", icon: Shield },
  { id: "suggesties", label: "Suggesties", icon: Lightbulb },
];

// ============ HELPERS ============

function formatTijd(seconden: number): string {
  const uren = Math.floor(seconden / 3600);
  const minuten = Math.round((seconden % 3600) / 60);
  if (uren === 0) return `${minuten}m`;
  if (minuten === 0) return `${uren}u`;
  return `${uren}u ${minuten}m`;
}

function datumLabel(datum: Date, periode: Periode): string {
  const opties: Intl.DateTimeFormatOptions =
    periode === "dag"
      ? { weekday: "long", day: "numeric", month: "long" }
      : periode === "week"
        ? { day: "numeric", month: "short" }
        : { month: "long", year: "numeric" };
  if (periode === "week") {
    const einde = new Date(datum);
    einde.setDate(einde.getDate() + 6);
    return `${datum.toLocaleDateString("nl-NL", opties)} - ${einde.toLocaleDateString("nl-NL", opties)}`;
  }
  return datum.toLocaleDateString("nl-NL", opties);
}

function berekenVanTot(datum: Date, periode: Periode): { van: string; tot: string } {
  const d = new Date(datum);
  let van: Date;
  let tot: Date;
  if (periode === "dag") {
    van = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    tot = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  } else if (periode === "week") {
    const dag = d.getDay();
    const maandag = d.getDate() - ((dag + 6) % 7);
    van = new Date(d.getFullYear(), d.getMonth(), maandag);
    tot = new Date(van.getFullYear(), van.getMonth(), van.getDate() + 7);
  } else {
    van = new Date(d.getFullYear(), d.getMonth(), 1);
    tot = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return {
    van: van.toISOString().split("T")[0],
    tot: tot.toISOString().split("T")[0],
  };
}

function navigeerDatum(datum: Date, periode: Periode, richting: -1 | 1): Date {
  const d = new Date(datum);
  if (periode === "dag") d.setDate(d.getDate() + richting);
  else if (periode === "week") d.setDate(d.getDate() + richting * 7);
  else d.setMonth(d.getMonth() + richting);
  return d;
}

// ============ SUB-COMPONENTS ============

function CategorieBadge({ categorie }: { categorie: string }) {
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${CATEGORIE_KLEUREN[categorie] ?? "#6B7280"}20`,
        color: CATEGORIE_KLEUREN[categorie] ?? "#6B7280",
      }}
    >
      {CATEGORIE_LABELS[categorie] ?? categorie}
    </span>
  );
}

function TypeIcon({ type }: { type: ScreenTimeRegel["type"] }) {
  const Icon = type === "app" ? AppWindow : type === "url" ? Globe : LayoutGrid;
  return <Icon className="w-4 h-4 text-autronis-text-secondary" />;
}

// ============ HELPERS: SESSIES ============

function parseBestandenUitTitels(titels: string[]): string[] {
  return [...new Set(titels.map((t) => t.split(" \u2014 ")[0]?.trim()).filter(Boolean))];
}

function formatTijdRange(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function gisterenDatum(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

// ============ TAB: OVERZICHT ============

type OverzichtView = "dag" | "week";

const DAY_START = 0;
const DAY_END = 24;
const TOTAL_HOURS = 24;
const HOUR_LABELS = Array.from({ length: 25 }, (_, i) => i); // 0-24

function getTimePosition(timeStr: string): number {
  const d = new Date(timeStr);
  const hours = d.getHours() + d.getMinutes() / 60;
  return Math.max(0, Math.min(100, ((hours - DAY_START) / TOTAL_HOURS) * 100));
}

function getBlockHeight(duurSeconden: number): number {
  return Math.max(1.5, (duurSeconden / 3600 / TOTAL_HOURS) * 100);
}

function getCurrentTimePosition(): number | null {
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60;
  return ((hours - DAY_START) / TOTAL_HOURS) * 100;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

function getWeekStart(datum: string): string {
  const d = new Date(datum);
  const day = d.getDay();
  const maandag = d.getDate() - ((day + 6) % 7);
  const start = new Date(d.getFullYear(), d.getMonth(), maandag);
  return start.toISOString().split("T")[0];
}

interface SessieDetail {
  app: string;
  categorie: string;
  projectNaam: string | null;
  klantNaam: string | null;
  startTijd: string;
  eindTijd: string;
  duurSeconden: number;
  venstertitels: string[];
  isIdle: boolean;
  beschrijving: string;
}

function SessieDetailPanel({
  sessie,
  onClose,
}: {
  sessie: SessieDetail;
  onClose: () => void;
}) {
  const bestanden = parseBestandenUitTitels(sessie.venstertitels);
  const kleur = CATEGORIE_KLEUREN[sessie.categorie] ?? "#6B7280";

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 space-y-4 animate-in slide-in-from-right-2 duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${kleur}20` }}
          >
            <AppWindow className="w-5 h-5" style={{ color: kleur }} />
          </div>
          <div>
            <p className="text-base font-semibold text-autronis-text-primary">{sessie.app}</p>
            <CategorieBadge categorie={sessie.categorie} />
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {sessie.beschrijving && sessie.beschrijving !== sessie.app && (
        <p className="text-sm text-autronis-text-primary leading-relaxed">
          {sessie.beschrijving}
        </p>
      )}

      {(sessie.projectNaam || sessie.klantNaam) && (
        <div className="flex items-center gap-2 text-sm">
          {sessie.projectNaam && (
            <span className="text-autronis-accent font-medium">{sessie.projectNaam}</span>
          )}
          {sessie.klantNaam && (
            <span className="text-autronis-text-secondary">
              {sessie.projectNaam ? `(${sessie.klantNaam})` : sessie.klantNaam}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-autronis-bg rounded-xl p-3">
          <p className="text-xs text-autronis-text-secondary mb-1">Tijdspan</p>
          <p className="text-sm font-medium text-autronis-text-primary tabular-nums">
            {formatTijdRange(sessie.startTijd)} - {formatTijdRange(sessie.eindTijd)}
          </p>
        </div>
        <div className="bg-autronis-bg rounded-xl p-3">
          <p className="text-xs text-autronis-text-secondary mb-1">Duur</p>
          <p className="text-sm font-medium text-autronis-text-primary tabular-nums">
            {formatTijd(sessie.duurSeconden)}
          </p>
        </div>
      </div>

      {bestanden.length > 0 && (
        <div>
          <p className="text-xs text-autronis-text-secondary mb-2 uppercase tracking-wide">Bestanden / pagina&apos;s</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {bestanden.slice(0, 10).map((b, i) => (
              <p key={i} className="text-xs text-autronis-text-primary truncate px-2 py-1 bg-autronis-bg rounded-lg">
                {b}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DagTimeline({
  sessies,
  datum,
  selectedSessie,
  onSelect,
}: {
  sessies: ScreenTimeSessie[];
  datum: string;
  selectedSessie: number | null;
  onSelect: (idx: number | null) => void;
}) {
  const vandaag = isToday(datum);

  // Filter out idle sessions — show as gaps instead of blocks
  const visibleSessions = sessies.filter(s => !s.isIdle);

  // Auto-zoom: compute visible range from sessions
  const firstHour = visibleSessions.length > 0
    ? Math.max(0, Math.floor(new Date(visibleSessions[0].startTijd).getHours()) - 1)
    : 7;
  const lastHour = visibleSessions.length > 0
    ? Math.min(24, Math.ceil(new Date(visibleSessions[visibleSessions.length - 1].eindTijd).getHours()) + 1)
    : 23;
  const visibleStart = firstHour;
  const visibleEnd = lastHour;
  const visibleHours = visibleEnd - visibleStart;
  const hourLabels = Array.from({ length: visibleHours + 1 }, (_, i) => i + visibleStart);

  // Current time position within visible range
  const currentPos = useMemo(() => {
    if (!vandaag) return null;
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    if (hours < visibleStart || hours > visibleEnd) return null;
    return ((hours - visibleStart) / visibleHours) * 100;
  }, [vandaag, visibleStart, visibleEnd, visibleHours]);

  // Position blocks at their actual time — no overlap hack
  const positionedBlocks = useMemo(() => {
    return visibleSessions.map((sessie) => {
      const startDate = new Date(sessie.startTijd);
      const startHour = startDate.getHours() + startDate.getMinutes() / 60;
      const top = ((startHour - visibleStart) / visibleHours) * 100;
      const height = Math.max(1.2, (sessie.duurSeconden / 3600 / visibleHours) * 100);
      return { sessie, originalIdx: sessies.indexOf(sessie), top, height };
    });
  }, [visibleSessions, sessies, visibleStart, visibleHours]);

  return (
    <div className="relative flex" style={{ minHeight: `${visibleHours * 64}px` }}>
      {/* Hour gutter */}
      <div className="w-14 shrink-0 relative">
        {hourLabels.map((hour) => {
          const top = ((hour - visibleStart) / visibleHours) * 100;
          return (
            <div
              key={hour}
              className="absolute right-3 -translate-y-1/2 text-xs text-autronis-text-secondary tabular-nums select-none"
              style={{ top: `${top}%` }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          );
        })}
      </div>

      {/* Timeline area */}
      <div className="flex-1 relative border-l border-autronis-border/40">
        {/* Hour lines */}
        {hourLabels.map((hour) => {
          const top = ((hour - visibleStart) / visibleHours) * 100;
          return (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-autronis-border/20"
              style={{ top: `${top}%` }}
            />
          );
        })}

        {/* Session blocks — positioned at actual time, no overlap hack */}
        {positionedBlocks.map(({ sessie, originalIdx, top, height }) => {
          const kleur = CATEGORIE_KLEUREN[sessie.categorie] ?? "#6B7280";
          const isSelected = selectedSessie === originalIdx;

          return (
            <button
              key={originalIdx}
              onClick={() => onSelect(isSelected ? null : originalIdx)}
              className={cn(
                "absolute left-2 right-2 rounded-lg overflow-hidden text-left transition-all duration-150 cursor-pointer",
                "hover:brightness-110 hover:scale-[1.01]",
                isSelected && "ring-2 ring-autronis-accent ring-offset-1 ring-offset-autronis-bg"
              )}
              style={{
                top: `${top}%`,
                height: `${height}%`,
                backgroundColor: `${kleur}CC`,
                minHeight: "24px",
              }}
            >
              <div className="px-2.5 py-1 h-full flex flex-col justify-center overflow-hidden">
                <span className="text-[11px] font-semibold text-white truncate leading-tight">
                  {sessie.beschrijving || sessie.app}
                </span>
                {height > 2.5 && (
                  <span className="text-[10px] text-white/60 truncate">
                    {new Date(sessie.startTijd).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })} - {new Date(sessie.eindTijd).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })} &middot; {formatTijd(sessie.duurSeconden)}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {/* Current time indicator */}
        {currentPos !== null && (
          <div
            className="absolute left-0 right-0 z-10 pointer-events-none"
            style={{ top: `${currentPos}%` }}
          >
            <div className="relative flex items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] shadow-lg shadow-red-500/30" />
              <div className="flex-1 h-[2px] bg-red-500 shadow-lg shadow-red-500/20" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekTimeline({
  weekData,
  onSelectSessie,
}: {
  weekData: WeekDagData[];
  onSelectSessie: (sessie: ScreenTimeSessie) => void;
}) {
  const DAG_NAMEN = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  return (
    <div className="relative flex" style={{ minHeight: `${TOTAL_HOURS * 56}px` }}>
      {/* Hour gutter */}
      <div className="w-10 shrink-0 relative">
        {HOUR_LABELS.map((hour) => {
          const top = ((hour - DAY_START) / TOTAL_HOURS) * 100;
          return (
            <div
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[10px] text-autronis-text-secondary tabular-nums select-none"
              style={{ top: `${top}%` }}
            >
              {String(hour).padStart(2, "0")}
            </div>
          );
        })}
      </div>

      {/* 7 day columns */}
      <div className="flex-1 grid grid-cols-7">
        {weekData.map((dag, dagIdx) => {
          const dagDate = new Date(dag.datum);
          const dagNr = dagDate.getDate();
          const vandaag = isToday(dag.datum);
          const currentPos = vandaag ? getCurrentTimePosition() : null;

          return (
            <div
              key={dag.datum}
              className={cn(
                "relative border-l border-autronis-border/20",
                dagIdx === 0 && "border-l-autronis-border/40"
              )}
            >
              {/* Day header */}
              <div className={cn(
                "sticky top-0 z-10 text-center py-1.5 text-xs border-b border-autronis-border/20 bg-autronis-card/95 backdrop-blur-sm",
                vandaag ? "text-autronis-accent font-semibold" : "text-autronis-text-secondary"
              )}>
                {DAG_NAMEN[dagIdx]} {dagNr}
              </div>

              {/* Hour lines */}
              {HOUR_LABELS.map((hour) => {
                const top = ((hour - DAY_START) / TOTAL_HOURS) * 100;
                return (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-autronis-border/10"
                    style={{ top: `${top}%` }}
                  />
                );
              })}

              {/* Session blocks (idle filtered out) */}
              {dag.sessies.filter(s => !s.isIdle).map((sessie, sIdx) => {
                const top = getTimePosition(sessie.startTijd);
                const height = getBlockHeight(sessie.duurSeconden);
                const kleur = CATEGORIE_KLEUREN[sessie.categorie] ?? "#6B7280";

                return (
                  <div
                    key={sIdx}
                    onClick={() => onSelectSessie(sessie)}
                    className="absolute left-[2px] right-[2px] rounded cursor-pointer group hover:brightness-125"
                    style={{
                      top: `${top}%`,
                      height: `${Math.max(height, 0.8)}%`,
                      backgroundColor: `${kleur}BB`,
                      minHeight: "4px",
                    }}
                  >
                    {/* Hover tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20 pointer-events-none">
                      <div className="bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 shadow-xl max-w-xs text-xs">
                        <p className="text-autronis-text-primary font-medium truncate">
                          {sessie.beschrijving && sessie.beschrijving !== sessie.app
                            ? sessie.beschrijving
                            : sessie.app}
                        </p>
                        {sessie.projectNaam && (
                          <p className="text-autronis-accent text-[10px]">{sessie.projectNaam}</p>
                        )}
                        <p className="text-autronis-text-secondary tabular-nums text-[10px] whitespace-nowrap">
                          {formatTijdRange(sessie.startTijd)} - {formatTijdRange(sessie.eindTijd)} &middot; {formatTijd(sessie.duurSeconden)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Current time */}
              {currentPos !== null && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: `${currentPos}%` }}
                >
                  <div className="h-[2px] bg-red-500 shadow-sm shadow-red-500/30" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabOverzicht({ datum }: { datum: string }) {
  const [view, setView] = useState<OverzichtView>("dag");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [weekSelectedSessie, setWeekSelectedSessie] = useState<ScreenTimeSessie | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const weekStart = useMemo(() => getWeekStart(datum), [datum]);
  const { data: sessiesData, isLoading: sessiesLoading } = useSessies(datum);
  const { data: weekData, isLoading: weekLoading } = useWeekSessies(weekStart);
  const { data: samenvatting, isLoading: samenvattingLoading } = useSamenvatting(datum);
  const genereer = useGenereerSamenvatting();

  // Lazy auto-generation for yesterday's summary
  useEffect(() => {
    const lastCheck = sessionStorage.getItem("lastSummaryCheck");
    const vandaag = new Date().toISOString().split("T")[0];
    if (lastCheck === vandaag) return;
    sessionStorage.setItem("lastSummaryCheck", vandaag);

    const gisteren = gisterenDatum();
    fetch(`/api/screen-time/samenvatting?datum=${gisteren}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.samenvatting) {
          genereer.mutate(gisteren);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sessies = sessiesData?.sessies ?? [];
  const stats = sessiesData?.stats;
  const selectedSessie = selectedIdx !== null ? sessies[selectedIdx] ?? null : null;

  // Reset selection when datum changes
  useEffect(() => {
    setSelectedIdx(null);
    setWeekSelectedSessie(null);
  }, [datum, view]);

  const isLoading = view === "dag" ? sessiesLoading : weekLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-[600px] rounded-2xl" />
      </div>
    );
  }

  const activeSessieDetail = view === "dag" ? selectedSessie : weekSelectedSessie;

  return (
    <div className="space-y-4">
      {/* 1. View toggle + AI Samenvatting row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View toggle */}
        <div className="flex bg-autronis-card border border-autronis-border rounded-xl p-1">
          {(["dag", "week"] as OverzichtView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                view === v
                  ? "bg-autronis-accent text-autronis-bg"
                  : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Compact AI summary */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          {samenvattingLoading ? (
            <Skeleton className="h-4 w-48 rounded" />
          ) : samenvatting?.samenvattingKort ? (
            <p className="text-xs text-autronis-text-secondary truncate">
              {samenvatting.samenvattingKort}
            </p>
          ) : (
            <p className="text-xs text-autronis-text-secondary opacity-50">Geen samenvatting</p>
          )}
          {samenvatting?.samenvattingDetail && (
            <button
              onClick={() => setDetailOpen(!detailOpen)}
              className="text-[10px] text-autronis-text-secondary hover:text-autronis-text-primary shrink-0 transition-colors"
            >
              {detailOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        <button
          onClick={() => genereer.mutate(datum)}
          disabled={genereer.isPending}
          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-autronis-accent bg-autronis-accent/10 rounded-lg hover:bg-autronis-accent/20 transition-colors disabled:opacity-50 shrink-0"
        >
          {genereer.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {samenvatting ? "Opnieuw" : "Genereer"}
        </button>
      </div>

      {/* Expandable detail */}
      {detailOpen && samenvatting?.samenvattingDetail && (
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-4">
          <p className="text-xs text-autronis-text-secondary leading-relaxed whitespace-pre-wrap">
            {samenvatting.samenvattingDetail}
          </p>
        </div>
      )}

      {/* 2. Compact KPI row */}
      {stats && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3.5 py-2">
            <Clock className="w-3.5 h-3.5 text-autronis-accent" />
            <span className="text-sm font-semibold text-autronis-accent tabular-nums">{formatTijd(stats.totaalActief)}</span>
            <span className="text-[10px] text-autronis-text-secondary uppercase">Actief</span>
          </div>
          <div className="flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3.5 py-2">
            <Pause className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-400 tabular-nums">{formatTijd(stats.totaalIdle)}</span>
            <span className="text-[10px] text-autronis-text-secondary uppercase">Idle</span>
          </div>
          <div className="flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3.5 py-2">
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            <span className="text-sm font-semibold text-green-400 tabular-nums">{stats.productiefPercentage}%</span>
            <span className="text-[10px] text-autronis-text-secondary uppercase">Productief</span>
          </div>
          <div className="flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3.5 py-2">
            <Hash className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-sm font-semibold text-blue-400 tabular-nums">{stats.aantalSessies}</span>
            <span className="text-[10px] text-autronis-text-secondary uppercase">Sessies</span>
          </div>
        </div>
      )}

      {/* 3. Calendar Timeline + Detail panel */}
      <div className="flex gap-4">
        {/* Main timeline */}
        <div className="flex-1 bg-autronis-card border border-autronis-border rounded-2xl p-4 overflow-hidden">
          {view === "dag" ? (
            sessies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Monitor className="w-12 h-12 text-autronis-text-secondary opacity-30 mb-4" />
                <p className="text-autronis-text-secondary text-sm">Geen data voor deze dag</p>
              </div>
            ) : (
              <DagTimeline
                sessies={sessies}
                datum={datum}
                selectedSessie={selectedIdx}
                onSelect={setSelectedIdx}
              />
            )
          ) : (
            weekData && weekData.length > 0 ? (
              <WeekTimeline
                weekData={weekData}
                onSelectSessie={setWeekSelectedSessie}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <Monitor className="w-12 h-12 text-autronis-text-secondary opacity-30 mb-4" />
                <p className="text-autronis-text-secondary text-sm">Geen data voor deze week</p>
              </div>
            )
          )}
        </div>

        {/* Detail panel */}
        {activeSessieDetail && (
          <div className="w-72 shrink-0 hidden lg:block">
            <SessieDetailPanel
              sessie={activeSessieDetail}
              onClose={() => {
                setSelectedIdx(null);
                setWeekSelectedSessie(null);
              }}
            />
          </div>
        )}
      </div>

      {/* Mobile detail (bottom sheet style) */}
      {activeSessieDetail && (
        <div className="lg:hidden">
          <SessieDetailPanel
            sessie={activeSessieDetail}
            onClose={() => {
              setSelectedIdx(null);
              setWeekSelectedSessie(null);
            }}
          />
        </div>
      )}

      {/* 4. Category legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
        {Object.entries(CATEGORIE_KLEUREN).map(([cat, kleur]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: kleur, opacity: cat === "inactief" ? 0.5 : 0.85 }}
            />
            <span className="text-[11px] text-autronis-text-secondary">
              {CATEGORIE_LABELS[cat]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ TAB: TEAM ============

function TabTeam({ van, tot }: { van: string; tot: string }) {
  const { data: gebruikers } = useGebruikers();
  const { data: alleEntries, isLoading } = useScreenTime(van, tot);

  const perGebruiker = useMemo(() => {
    if (!gebruikers || !alleEntries) return [];
    return gebruikers.map((g) => {
      const entries = alleEntries.filter((e) => e.gebruikerId === g.id);
      const totaal = entries.reduce((s, e) => s + e.duurSeconden, 0);
      const perCategorie: Record<string, number> = {};
      const perApp: Record<string, number> = {};
      for (const e of entries) {
        perCategorie[e.categorie] = (perCategorie[e.categorie] ?? 0) + e.duurSeconden;
        perApp[e.app] = (perApp[e.app] ?? 0) + e.duurSeconden;
      }
      const topApps = Object.entries(perApp)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([app]) => app);
      return { id: g.id, naam: g.naam, totaal, perCategorie, topApps };
    });
  }, [gebruikers, alleEntries]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!perGebruiker.length) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
        <Users className="w-12 h-12 text-autronis-text-secondary mx-auto mb-4 opacity-40" />
        <p className="text-autronis-text-secondary text-lg">Geen teamgegevens beschikbaar</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {perGebruiker.map((g) => {
        const maxCat = Math.max(...Object.values(g.perCategorie), 1);
        return (
          <div
            key={g.id}
            className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-autronis-accent/10 flex items-center justify-center">
                <span className="text-sm font-bold text-autronis-accent">
                  {g.naam.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-base font-semibold text-autronis-text-primary">{g.naam}</p>
                <p className="text-sm text-autronis-text-secondary tabular-nums">
                  {formatTijd(g.totaal)}
                </p>
              </div>
            </div>

            {/* Category mini-bars */}
            <div className="space-y-2 mb-5">
              {Object.entries(g.perCategorie)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, sec]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-xs text-autronis-text-secondary w-24 truncate shrink-0">
                      {CATEGORIE_LABELS[cat] ?? cat}
                    </span>
                    <div className="flex-1 h-3 bg-autronis-bg rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(sec / maxCat) * 100}%`,
                          backgroundColor: CATEGORIE_KLEUREN[cat] ?? "#6B7280",
                        }}
                      />
                    </div>
                    <span className="text-xs text-autronis-text-secondary tabular-nums w-14 text-right shrink-0">
                      {formatTijd(sec)}
                    </span>
                  </div>
                ))}
            </div>

            {/* Top 3 apps */}
            {g.topApps.length > 0 && (
              <div>
                <p className="text-xs text-autronis-text-secondary mb-2 uppercase tracking-wide">
                  Top apps
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.topApps.map((app) => (
                    <span
                      key={app}
                      className="px-2.5 py-1 bg-autronis-bg rounded-lg text-xs text-autronis-text-primary"
                    >
                      {app}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============ TAB: REGELS ============

function TabRegels() {
  const { addToast } = useToast();
  const { data: regels, isLoading } = useScreenTimeRegels();
  const { create, update, remove } = useScreenTimeRegelMutatie();
  const categoriseer = useCategoriseer();

  const [toonForm, setToonForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formType, setFormType] = useState<ScreenTimeRegel["type"]>("app");
  const [formPatroon, setFormPatroon] = useState("");
  const [formCategorie, setFormCategorie] = useState<ScreenTimeCategorie>("development");

  const resetForm = useCallback(() => {
    setToonForm(false);
    setEditId(null);
    setFormType("app");
    setFormPatroon("");
    setFormCategorie("development");
  }, []);

  const handleOpslaan = useCallback(async () => {
    if (!formPatroon.trim()) return;
    try {
      if (editId !== null) {
        await update.mutateAsync({
          id: editId,
          body: { type: formType, patroon: formPatroon.trim(), categorie: formCategorie },
        });
        addToast("Regel bijgewerkt", "succes");
      } else {
        await create.mutateAsync({
          type: formType,
          patroon: formPatroon.trim(),
          categorie: formCategorie,
        });
        addToast("Regel aangemaakt", "succes");
      }
      resetForm();
    } catch {
      addToast("Kon regel niet opslaan", "fout");
    }
  }, [formPatroon, formType, formCategorie, editId, create, update, addToast, resetForm]);

  const handleVerwijder = useCallback(
    async (id: number) => {
      try {
        await remove.mutateAsync(id);
        addToast("Regel verwijderd", "succes");
      } catch {
        addToast("Kon regel niet verwijderen", "fout");
      }
    },
    [remove, addToast]
  );

  const handleBewerk = useCallback((regel: ScreenTimeRegel) => {
    setEditId(regel.id);
    setFormType(regel.type);
    setFormPatroon(regel.patroon);
    setFormCategorie(regel.categorie);
    setToonForm(true);
  }, []);

  const handleCategoriseer = useCallback(async () => {
    try {
      await categoriseer.mutateAsync({ entryIds: [] });
      addToast("AI categorisering gestart", "succes");
    } catch {
      addToast("Kon niet categoriseren", "fout");
    }
  }, [categoriseer, addToast]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-lg" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { resetForm(); setToonForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-autronis-accent text-autronis-bg rounded-xl font-medium text-sm hover:bg-autronis-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nieuwe regel
        </button>
        <button
          onClick={handleCategoriseer}
          disabled={categoriseer.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-autronis-card border border-autronis-border text-autronis-text-primary rounded-xl font-medium text-sm hover:border-autronis-accent/40 transition-colors disabled:opacity-50"
        >
          {categoriseer.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-yellow-400" />
          )}
          AI Categoriseren
        </button>
      </div>

      {/* Inline form */}
      {toonForm && (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-autronis-text-primary">
            {editId !== null ? "Regel bewerken" : "Nieuwe regel"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-autronis-text-secondary mb-1.5">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as ScreenTimeRegel["type"])}
                className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
              >
                <option value="app">App</option>
                <option value="url">URL</option>
                <option value="venstertitel">Venster</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-autronis-text-secondary mb-1.5">Patroon</label>
              <input
                type="text"
                value={formPatroon}
                onChange={(e) => setFormPatroon(e.target.value)}
                placeholder="bijv. VS Code, *slack*"
                className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-autronis-text-secondary mb-1.5">Categorie</label>
              <select
                value={formCategorie}
                onChange={(e) => setFormCategorie(e.target.value as ScreenTimeCategorie)}
                className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
              >
                {Object.entries(CATEGORIE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpslaan}
              disabled={!formPatroon.trim() || create.isPending || update.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-autronis-accent text-autronis-bg rounded-lg font-medium text-sm hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Opslaan
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2 text-autronis-text-secondary hover:text-autronis-text-primary text-sm transition-colors"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {!regels?.length && !toonForm ? (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
          <Shield className="w-12 h-12 text-autronis-text-secondary mx-auto mb-4 opacity-40" />
          <p className="text-autronis-text-secondary text-lg">Nog geen regels ingesteld</p>
          <p className="text-autronis-text-secondary text-sm mt-1 opacity-60">
            Regels koppelen apps en websites automatisch aan categorieeen.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {regels?.map((regel) => (
            <div
              key={regel.id}
              className="bg-autronis-card border border-autronis-border rounded-xl p-4 flex items-center gap-4 hover:border-autronis-accent/20 transition-colors"
            >
              <TypeIcon type={regel.type} />
              <span className="text-sm font-mono text-autronis-text-primary flex-1 truncate">
                {regel.patroon}
              </span>
              <CategorieBadge categorie={regel.categorie} />
              {(regel.projectNaam || regel.klantNaam) && (
                <span className="text-xs text-autronis-text-secondary truncate max-w-32">
                  {regel.projectNaam ?? regel.klantNaam}
                </span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleBewerk(regel)}
                  className="p-1.5 text-autronis-text-secondary hover:text-autronis-accent transition-colors rounded-lg hover:bg-autronis-accent/10"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleVerwijder(regel.id)}
                  className="p-1.5 text-autronis-text-secondary hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ TAB: SUGGESTIES ============

function TabSuggesties() {
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"openstaand" | "goedgekeurd" | "afgewezen">(
    "openstaand"
  );
  const { data: suggesties, isLoading } = useScreenTimeSuggesties(statusFilter);
  const mutatie = useScreenTimeSuggestieMutatie();

  const handleActie = useCallback(
    async (id: number, status: "goedgekeurd" | "afgewezen") => {
      try {
        await mutatie.mutateAsync({ id, status });
        addToast(status === "goedgekeurd" ? "Suggestie goedgekeurd" : "Suggestie afgewezen", "succes");
      } catch {
        addToast("Kon suggestie niet bijwerken", "fout");
      }
    },
    [mutatie, addToast]
  );

  const handleAllesGoedkeuren = useCallback(async () => {
    if (!suggesties?.length) return;
    try {
      await Promise.all(suggesties.map((s) => mutatie.mutateAsync({ id: s.id, status: "goedgekeurd" })));
      addToast(`${suggesties.length} suggesties goedgekeurd`, "succes");
    } catch {
      addToast("Kon niet alle suggesties goedkeuren", "fout");
    }
  }, [suggesties, mutatie, addToast]);

  const STATUS_TABS: { key: typeof statusFilter; label: string }[] = [
    { key: "openstaand", label: "Openstaand" },
    { key: "goedgekeurd", label: "Goedgekeurd" },
    { key: "afgewezen", label: "Afgewezen" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status filter + bulk action */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-autronis-card border border-autronis-border rounded-xl p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                statusFilter === t.key
                  ? "bg-autronis-accent text-autronis-bg"
                  : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {statusFilter === "openstaand" && (suggesties?.length ?? 0) > 1 && (
          <button
            onClick={handleAllesGoedkeuren}
            disabled={mutatie.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl text-sm font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            Alles goedkeuren ({suggesties?.length})
          </button>
        )}
      </div>

      {/* Suggestions list */}
      {!suggesties?.length ? (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
          <Lightbulb className="w-12 h-12 text-autronis-text-secondary mx-auto mb-4 opacity-40" />
          <p className="text-autronis-text-secondary text-lg">
            Geen {statusFilter === "openstaand" ? "openstaande" : statusFilter === "goedgekeurd" ? "goedgekeurde" : "afgewezen"} suggesties
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggesties.map((s) => (
            <div
              key={s.id}
              className="bg-autronis-card border border-autronis-border rounded-xl p-5 flex items-start gap-4 hover:border-autronis-accent/20 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      s.type === "categorie"
                        ? "bg-purple-500/15 text-purple-400"
                        : s.type === "tijdregistratie"
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-yellow-500/15 text-yellow-400"
                    )}
                  >
                    {s.type === "categorie"
                      ? "Categorie"
                      : s.type === "tijdregistratie"
                        ? "Tijdregistratie"
                        : "Project koppeling"}
                  </span>
                  <span className="text-xs text-autronis-text-secondary tabular-nums">
                    {new Date(s.startTijd).toLocaleString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" - "}
                    {new Date(s.eindTijd).toLocaleTimeString("nl-NL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-autronis-text-primary">{s.voorstel}</p>
              </div>
              {statusFilter === "openstaand" && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleActie(s.id, "goedgekeurd")}
                    disabled={mutatie.isPending}
                    className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Goedkeuren"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleActie(s.id, "afgewezen")}
                    disabled={mutatie.isPending}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Afwijzen"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ MAIN PAGE ============

export default function SchermtijdPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overzicht");
  const [periode, setPeriode] = useState<Periode>("dag");
  const [datum, setDatum] = useState(() => new Date());

  const { van, tot } = useMemo(() => berekenVanTot(datum, periode), [datum, periode]);

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">Schermtijd</h1>
            <p className="text-base text-autronis-text-secondary mt-1">
              Inzicht in app- en websitegebruik
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-autronis-card border border-autronis-border rounded-xl p-1 w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-autronis-accent text-autronis-bg"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Period selector (only for overzicht and team) */}
        {(activeTab === "overzicht" || activeTab === "team") && (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex bg-autronis-card border border-autronis-border rounded-xl p-1">
              {(["dag", "week", "maand"] as Periode[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriode(p)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors",
                    periode === p
                      ? "bg-autronis-accent text-autronis-bg"
                      : "text-autronis-text-secondary hover:text-autronis-text-primary"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDatum(navigeerDatum(datum, periode, -1))}
                className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary bg-autronis-card border border-autronis-border rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-autronis-text-primary font-medium min-w-48 text-center">
                {datumLabel(datum, periode)}
              </span>
              <button
                onClick={() => setDatum(navigeerDatum(datum, periode, 1))}
                className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary bg-autronis-card border border-autronis-border rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tab content */}
        {activeTab === "overzicht" && (
          <TabOverzicht datum={van} />
        )}
        {activeTab === "team" && <TabTeam van={van} tot={tot} />}
        {activeTab === "regels" && <TabRegels />}
        {activeTab === "suggesties" && <TabSuggesties />}
      </div>
    </PageTransition>
  );
}
