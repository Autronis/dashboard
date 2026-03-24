"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Monitor,
  Clock,
  TrendingUp,
  Sparkles,
  X,
  AppWindow,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Brain,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Lightbulb,
  Trophy,
  Shield,
  Shuffle,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSessies,
  useWeekSessies,
  useSamenvatting,
  useGenereerSamenvatting,
  useGenereerPeriodeSamenvatting,
} from "@/hooks/queries/use-screen-time";
import type { PeriodeSamenvatting, FocusInzicht, BesteFocusBlok } from "@/hooks/queries/use-screen-time";
import type { WeekDagData } from "@/hooks/queries/use-screen-time";
import { useRegistraties } from "@/hooks/queries/use-tijdregistraties";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScreenTimeCategorie, ScreenTimeSessie } from "@/types";
import {
  CATEGORIE_KLEUREN,
  CATEGORIE_LABELS,
  formatTijd,
  formatTijdRange,
  parseBestandenUitTitels,
  gisterenDatum,
  berekenVanTot,
  CategorieBadge,
} from "./constants";

// ============ TYPES ============

type TijdlijnView = "dag" | "week";

// ============ TIMELINE CONSTANTS ============

const DAY_START = 0;
const DAY_END = 24;
const TOTAL_HOURS = 24;
const HOUR_LABELS = Array.from({ length: 25 }, (_, i) => i); // 0-24

// ============ HELPERS ============

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
  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return dateStr === todayLocal;
}

function getWeekStart(datum: string): string {
  const d = new Date(datum);
  const day = d.getDay();
  const maandag = d.getDate() - ((day + 6) % 7);
  const start = new Date(d.getFullYear(), d.getMonth(), maandag);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
}

// ============ SESSIE DETAIL PANEL ============

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
  isHandmatig?: boolean;
}

function SessieDetailPanel({
  sessie,
  onClose,
}: {
  sessie: SessieDetail;
  onClose: () => void;
}) {
  const parsedTitels = parseBestandenUitTitels(sessie.venstertitels);
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
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-autronis-text-primary">{sessie.app}</p>
              {sessie.isHandmatig && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-autronis-accent/10 text-autronis-accent rounded-md">
                  Handmatig
                </span>
              )}
            </div>
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

      {parsedTitels.length > 0 && (
        <div>
          <p className="text-xs text-autronis-text-secondary mb-2 uppercase tracking-wide">Activiteiten</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {parsedTitels.slice(0, 12).map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-autronis-bg rounded-lg">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  p.type === "vscode" ? "bg-blue-400" :
                  p.type === "chrome" ? "bg-yellow-400" :
                  p.type === "tradingview" ? "bg-green-400" :
                  p.type === "discord" ? "bg-indigo-400" :
                  "bg-gray-400"
                )} />
                <p className="text-xs text-autronis-text-primary truncate">{p.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ DAG TIMELINE ============

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

  // Position sessions directly — API now returns properly merged blocks
  const positionedBlocks = useMemo(() => {
    return visibleSessions.map((sessie, idx) => {
      const startDate = new Date(sessie.startTijd);
      const startHour = startDate.getHours() + startDate.getMinutes() / 60;
      const endDate = new Date(sessie.eindTijd);
      const endHour = endDate.getHours() + endDate.getMinutes() / 60;
      const top = ((startHour - visibleStart) / visibleHours) * 100;
      const height = Math.max(1.5, ((endHour - startHour) / visibleHours) * 100);
      const originalIdx = sessies.indexOf(sessie);
      return { sessie, top, height, originalIdx };
    });
  }, [visibleSessions, sessies, visibleStart, visibleHours]);

  // Build a flat list of items: sessions + gaps (for pauze indicators)
  const timelineItems = useMemo(() => {
    const items: Array<{ type: "sessie"; sessie: typeof visibleSessions[0]; originalIdx: number } | { type: "pauze"; duurMin: number }> = [];
    for (let i = 0; i < positionedBlocks.length; i++) {
      // Check for gap before this block
      if (i > 0) {
        const prevEnd = new Date(positionedBlocks[i - 1].sessie.eindTijd).getTime();
        const thisStart = new Date(positionedBlocks[i].sessie.startTijd).getTime();
        const gapMin = (thisStart - prevEnd) / 60000;
        if (gapMin >= 20) {
          items.push({ type: "pauze", duurMin: Math.round(gapMin) });
        }
      }
      items.push({ type: "sessie", sessie: positionedBlocks[i].sessie, originalIdx: positionedBlocks[i].originalIdx });
    }
    return items;
  }, [positionedBlocks]);

  // Scale: 2px per minute, min 30px for readability
  const PX_PER_MIN = 2;
  const MIN_BLOCK_PX = 30;
  const PAUZE_PX_PER_MIN = 0.8; // pauzes are compressed

  return (
    <div className="relative flex">
      {/* Hour gutter — positioned by time */}
      <div className="w-14 shrink-0 relative">
        {timelineItems.map((item, idx) => {
          if (item.type !== "sessie") return null;
          const startTime = new Date(item.sessie.startTijd).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={`time-${idx}`} className="text-[11px] text-autronis-text-secondary/50 tabular-nums select-none" style={{ height: 0, position: "relative" }}>
              {/* Rendered inline — height handled by main column */}
            </div>
          );
        })}
      </div>

      {/* Main timeline column */}
      <div className="flex-1 space-y-0">
        {timelineItems.map((item, idx) => {
          if (item.type === "pauze") {
            const pxHeight = Math.max(24, Math.round(item.duurMin * PAUZE_PX_PER_MIN));
            const hours = Math.floor(item.duurMin / 60);
            const mins = item.duurMin % 60;
            const label = hours > 0 ? `${hours}u ${mins}m pauze` : `${mins}m pauze`;
            return (
              <div key={`pauze-${idx}`} className="flex items-center gap-3 px-2 relative" style={{ height: `${pxHeight}px` }}>
                <div className="absolute inset-0 bg-autronis-border/5 rounded-lg" />
                <div className="border-t border-dashed border-autronis-border/30 flex-1 relative z-10" />
                <span className="text-xs text-autronis-text-secondary/50 shrink-0 relative z-10">{label}</span>
                <div className="border-t border-dashed border-autronis-border/30 flex-1 relative z-10" />
              </div>
            );
          }

          const { sessie, originalIdx } = item;
          const kleur = CATEGORIE_KLEUREN[sessie.categorie] ?? "#6B7280";
          const isSelected = selectedSessie === originalIdx;
          const catLabel = CATEGORIE_LABELS[sessie.categorie] || sessie.categorie;
          const duurMin = Math.round((new Date(sessie.eindTijd).getTime() - new Date(sessie.startTijd).getTime()) / 60000);
          const pxHeight = Math.max(MIN_BLOCK_PX, Math.round(duurMin * PX_PER_MIN));
          const startTime = new Date(sessie.startTijd).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
          const endTime = new Date(sessie.eindTijd).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
          const beschrijving = sessie.beschrijving && sessie.beschrijving !== sessie.app ? sessie.beschrijving : catLabel;
          const showDetails = pxHeight >= 44;
          const showCategory = pxHeight >= 56;

          return (
            <button
              key={`${sessie.startTijd}-${originalIdx}`}
              onClick={() => onSelect(isSelected ? null : originalIdx)}
              className={cn(
                "w-full rounded-lg text-left transition-all duration-150 cursor-pointer group mb-1",
                "hover:brightness-110",
                isSelected && "ring-2 ring-white/60 ring-offset-1 ring-offset-autronis-bg"
              )}
              style={{
                height: `${pxHeight}px`,
                backgroundColor: `${kleur}30`,
                borderLeft: `4px solid ${kleur}`,
              }}
            >
              <div className="h-full flex flex-col justify-center px-2 sm:px-3.5 min-w-0">
                {/* Row 1: Time + Description + Duration */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className="text-[10px] sm:text-[11px] text-autronis-text-secondary tabular-nums shrink-0 w-[72px] sm:w-[90px]">{startTime}–{endTime}</span>
                  <span className="text-[12px] sm:text-[13px] font-semibold text-autronis-text-primary truncate flex-1" title={beschrijving}>
                    {beschrijving}
                  </span>
                </div>
                {/* Row 2: Category label (medium/long blocks only) */}
                {showDetails && (
                  <div className="flex items-center gap-2 mt-1 ml-[72px] sm:ml-[90px]">
                    {showCategory && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${kleur}40`, color: kleur }}>
                        {catLabel}
                      </span>
                    )}
                    {sessie.projectNaam && (
                      <span className="text-[10px] text-autronis-accent">{sessie.projectNaam}</span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {/* Current time indicator */}
        {vandaag && (
          <div className="flex items-center gap-2 py-1 mt-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/30 shrink-0" />
            <div className="flex-1 h-[2px] bg-red-500 shadow-lg shadow-red-500/20" />
            <span className="text-[10px] text-red-400 tabular-nums shrink-0">
              {new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ WEEK TIMELINE ============

function WeekTimeline({
  weekData,
  onSelectSessie,
}: {
  weekData: WeekDagData[];
  onSelectSessie: (sessie: ScreenTimeSessie) => void;
}) {
  const DAG_NAMEN = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  // Auto-detect time range: find earliest and latest activity across week
  const allSessies = weekData.flatMap(d => d.sessies.filter(s => !s.isIdle));
  const startHour = allSessies.length > 0
    ? Math.max(0, Math.floor(Math.min(...allSessies.map(s => new Date(s.startTijd).getHours()))) - 1)
    : 8;
  const endHour = allSessies.length > 0
    ? Math.min(24, Math.ceil(Math.max(...allSessies.map(s => new Date(s.eindTijd).getHours()))) + 1)
    : 20;
  const visHours = endHour - startHour;
  const hourLabels = Array.from({ length: visHours + 1 }, (_, i) => i + startHour);

  return (
    <div>
      {/* Day columns as grid */}
      <div className="grid grid-cols-7 gap-1">
        {weekData.map((dag, dagIdx) => {
          const dagDate = new Date(dag.datum);
          const dagNr = dagDate.getDate();
          const vandaag = isToday(dag.datum);
          const activeSessies = dag.sessies.filter(s => !s.isIdle);
          const dagTotaal = activeSessies.reduce((s, sess) =>
            s + Math.max(0, (new Date(sess.eindTijd).getTime() - new Date(sess.startTijd).getTime()) / 1000), 0);

          return (
            <div key={dag.datum} className={cn(
              "rounded-lg border overflow-hidden",
              vandaag ? "border-autronis-accent/40 bg-autronis-accent/5" : "border-autronis-border/30 bg-autronis-card/50"
            )}>
              {/* Day header */}
              <div className={cn(
                "text-center py-2 border-b",
                vandaag ? "border-autronis-accent/20" : "border-autronis-border/20"
              )}>
                <span className={cn(
                  "text-xs font-semibold",
                  vandaag ? "text-autronis-accent" : "text-autronis-text-secondary"
                )}>
                  {DAG_NAMEN[dagIdx]} {dagNr}
                </span>
                {dagTotaal > 0 && (
                  <p className={cn("text-[10px] tabular-nums mt-0.5", vandaag ? "text-autronis-accent/70" : "text-autronis-text-secondary/50")}>
                    {formatTijd(dagTotaal)}
                  </p>
                )}
              </div>

              {/* Time grid */}
              <div className="relative" style={{ height: `${visHours * 28}px` }}>
                {/* Hour lines */}
                {hourLabels.map((hour) => {
                  const top = ((hour - startHour) / visHours) * 100;
                  return (
                    <div key={hour} className="absolute left-0 right-0 border-t border-autronis-border/10" style={{ top: `${top}%` }}>
                      {dagIdx === 0 && (
                        <span className="absolute -left-0.5 -translate-y-1/2 text-[8px] text-autronis-text-secondary/30 select-none">
                          {String(hour).padStart(2, "0")}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Session blocks — solid colored */}
                {activeSessies.map((sessie, sIdx) => {
                  const sHour = new Date(sessie.startTijd).getHours() + new Date(sessie.startTijd).getMinutes() / 60;
                  const eHour = new Date(sessie.eindTijd).getHours() + new Date(sessie.eindTijd).getMinutes() / 60;
                  const top = ((sHour - startHour) / visHours) * 100;
                  const height = Math.max(2, ((eHour - sHour) / visHours) * 100);
                  const kleur = CATEGORIE_KLEUREN[sessie.categorie] ?? "#6B7280";
                  const catLabel = CATEGORIE_LABELS[sessie.categorie] || sessie.categorie;
                  const duurMin = Math.round(sessie.duurSeconden / 60);

                  return (
                    <div
                      key={sIdx}
                      onClick={() => onSelectSessie(sessie)}
                      className="absolute left-1 right-1 rounded-lg cursor-pointer group hover:brightness-125 hover:z-10 overflow-hidden"
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        minHeight: "8px",
                        backgroundColor: `${kleur}55`,
                      }}
                    >
                      {/* Label on large enough blocks */}
                      {height > 8 && (
                        <div className="px-1 py-0.5 h-full flex flex-col justify-center">
                          <span className="text-[9px] font-semibold text-white truncate leading-tight">{catLabel}</span>
                          {height > 14 && <span className="text-[8px] text-white/60 tabular-nums">{formatTijd(duurMin * 60)}</span>}
                        </div>
                      )}

                      {/* Hover tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30 pointer-events-none">
                        <div className="bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: kleur }} />
                            <span className="text-xs font-semibold text-autronis-text-primary">{catLabel}</span>
                          </div>
                          {sessie.beschrijving && sessie.beschrijving !== sessie.app && (
                            <p className="text-[11px] text-autronis-text-secondary mb-1">{sessie.beschrijving}</p>
                          )}
                          <p className="text-[10px] text-autronis-text-secondary tabular-nums">
                            {formatTijdRange(sessie.startTijd)} – {formatTijdRange(sessie.eindTijd)} · {formatTijd(sessie.duurSeconden)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Empty day indicator */}
                {activeSessies.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] text-autronis-text-secondary/30">—</span>
                  </div>
                )}

                {/* Current time */}
                {vandaag && (() => {
                  const now = new Date();
                  const h = now.getHours() + now.getMinutes() / 60;
                  if (h < startHour || h > endHour) return null;
                  const pos = ((h - startHour) / visHours) * 100;
                  return <div className="absolute left-0 right-0 h-[2px] bg-red-500 z-10 pointer-events-none" style={{ top: `${pos}%` }} />;
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ TAB TIJDLIJN ============

export function TabTijdlijn({ datum, periode = "dag" }: { datum: string; periode?: string }) {
  const view: TijdlijnView = periode === "week" ? "week" : "dag";
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [weekSelectedSessie, setWeekSelectedSessie] = useState<ScreenTimeSessie | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [periodeRapport, setPeriodeRapport] = useState<PeriodeSamenvatting | null>(null);
  const [periodeDetailOpen, setPeriodeDetailOpen] = useState(false);
  const genereerPeriode = useGenereerPeriodeSamenvatting();

  const weekStart = useMemo(() => getWeekStart(datum), [datum]);
  const { data: sessiesData, isLoading: sessiesLoading } = useSessies(datum);
  const { data: weekData, isLoading: weekLoading } = useWeekSessies(weekStart);
  const { data: samenvatting, isLoading: samenvattingLoading } = useSamenvatting(datum);
  const genereer = useGenereerSamenvatting();

  // Fetch handmatige registraties for the same day and merge into sessies
  const { van: regVan, tot: regTot } = berekenVanTot(new Date(datum), "dag");
  const { data: registraties } = useRegistraties(regVan, regTot);

  const handmatigeSessies: ScreenTimeSessie[] = useMemo(() => {
    return (registraties ?? [])
      .filter(r => r.isHandmatig)
      .map(r => ({
        app: "Handmatig",
        categorie: (r.categorie === "meeting" ? "communicatie" : r.categorie) as ScreenTimeCategorie,
        startTijd: r.startTijd,
        eindTijd: r.eindTijd ?? r.startTijd,
        duurSeconden: (r.duurMinuten ?? 0) * 60,
        beschrijving: r.omschrijving ?? "",
        projectId: r.projectId ?? null,
        projectNaam: r.projectNaam ?? null,
        klantNaam: r.klantNaam ?? null,
        isIdle: false,
        venstertitels: r.omschrijving ? [r.omschrijving] : [],
      }));
  }, [registraties]);

  // Merge screen-time sessies with handmatige registraties, sorted by start time
  const alleSessies = useMemo(() => {
    return [...(sessiesData?.sessies ?? []).filter(s => !s.isIdle), ...handmatigeSessies]
      .sort((a, b) => new Date(a.startTijd).getTime() - new Date(b.startTijd).getTime());
  }, [sessiesData, handmatigeSessies]);

  const stats = sessiesData?.stats;
  const selectedSessie = selectedIdx !== null ? alleSessies[selectedIdx] ?? null : null;

  // Lazy auto-generation for yesterday's summary
  useEffect(() => {
    const lastCheck = sessionStorage.getItem("lastSummaryCheck");
    const now = new Date();
    const vandaag = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (lastCheck === vandaag) return;
    sessionStorage.setItem("lastSummaryCheck", vandaag ?? "");

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

  // Reset selection when datum or view changes
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
      {/* 1. AI Samenvatting row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Compact AI summary — auto-generated fallback if no AI summary yet */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          {samenvattingLoading ? (
            <Skeleton className="h-4 w-48 rounded" />
          ) : samenvatting?.samenvattingKort ? (
            <p className="text-xs text-autronis-text-secondary truncate">
              {samenvatting.samenvattingKort}
            </p>
          ) : alleSessies.length > 0 ? (() => {
            // Auto-generate local summary from session data
            const descriptions = alleSessies
              .filter(s => s.beschrijving && s.beschrijving !== s.app)
              .map(s => s.beschrijving)
              .slice(0, 3);
            const totalMin = Math.round(alleSessies.reduce((sum, s) => sum + (new Date(s.eindTijd).getTime() - new Date(s.startTijd).getTime()) / 1000, 0) / 60);
            const hours = Math.floor(totalMin / 60);
            const mins = totalMin % 60;
            const timeStr = hours > 0 ? `${hours}u${mins > 0 ? ` ${mins}m` : ""}` : `${mins}m`;
            const text = descriptions.length > 0
              ? `${timeStr} actief: ${descriptions.join(", ")}`
              : `${timeStr} actief over ${alleSessies.length} sessies`;
            return <p className="text-xs text-autronis-text-secondary truncate">{text}</p>;
          })() : (
            <p className="text-xs text-autronis-text-secondary opacity-50">Geen activiteit</p>
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

        {/* Week/maand rapportage knop */}
        {view === "week" && (
          <button
            onClick={() => {
              genereerPeriode.mutate(
                { datum, type: "week" },
                { onSuccess: (data) => { setPeriodeRapport(data); setPeriodeDetailOpen(true); } }
              );
            }}
            disabled={genereerPeriode.isPending}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-yellow-400 bg-yellow-400/10 rounded-lg hover:bg-yellow-400/20 transition-colors disabled:opacity-50 shrink-0"
          >
            {genereerPeriode.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <TrendingUp className="w-3 h-3" />
            )}
            Weekrapportage
          </button>
        )}
      </div>

      {/* Expandable detail */}
      {detailOpen && samenvatting?.samenvattingDetail && (
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-4">
          <p className="text-xs text-autronis-text-secondary leading-relaxed whitespace-pre-wrap">
            {samenvatting.samenvattingDetail}
          </p>
        </div>
      )}

      {/* Periode rapportage */}
      {periodeRapport && periodeDetailOpen && (
        <div className="bg-autronis-card border border-yellow-400/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-autronis-text-primary">{periodeRapport.periode}</span>
            </div>
            <button
              onClick={() => setPeriodeDetailOpen(false)}
              className="p-1 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-autronis-accent font-medium tabular-nums">{formatTijd(periodeRapport.totaalSeconden)}</span>
            <span className="text-green-400 font-medium tabular-nums">{periodeRapport.productiefPercentage}% productief</span>
            <span className="text-autronis-text-secondary tabular-nums">{periodeRapport.aantalDagen} dagen</span>
            {periodeRapport.topProject && (
              <span className="text-yellow-400">Top: {periodeRapport.topProject}</span>
            )}
          </div>
          <p className="text-sm text-autronis-text-primary leading-relaxed">{periodeRapport.samenvattingKort}</p>
          {periodeRapport.samenvattingDetail && (
            <div className="border-t border-autronis-border/30 pt-3">
              <p className="text-xs text-autronis-text-secondary leading-relaxed whitespace-pre-wrap">
                {periodeRapport.samenvattingDetail}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 2. Focus Optimization Panel */}
      {stats && (() => {
        // Category distribution
        const catTime: Record<string, number> = {};
        for (const s of alleSessies) {
          const timespan = Math.max(0, (new Date(s.eindTijd).getTime() - new Date(s.startTijd).getTime()) / 1000);
          catTime[s.categorie] = (catTime[s.categorie] || 0) + timespan;
        }
        const totalCatTime = Object.values(catTime).reduce((s, v) => s + v, 0);
        const catEntries = Object.entries(catTime).sort(([, a], [, b]) => b - a);

        const focusScoreColor = stats.focusScore >= 70 ? "text-emerald-400" : stats.focusScore >= 40 ? "text-amber-400" : "text-red-400";
        const focusScoreLabel = stats.focusScore >= 70 ? "Sterk" : stats.focusScore >= 40 ? "Kan beter" : "Zwak";
        const focusScoreBg = stats.focusScore >= 70 ? "bg-emerald-500/10 border-emerald-500/20" : stats.focusScore >= 40 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

        const dwPct = stats.deepWorkTarget > 0 ? Math.min(100, Math.round((stats.deepWorkMinuten / stats.deepWorkTarget) * 100)) : 0;
        const dwColor = dwPct >= 75 ? "bg-emerald-400" : dwPct >= 40 ? "bg-amber-400" : "bg-red-400";

        const prodLabel = stats.productiefPercentage >= 80 ? "Uitstekend — je tijd gaat naar waardevol werk" : stats.productiefPercentage >= 60 ? "Goed — ruimte voor verbetering" : "Laag — te veel afleiding of overig";

        const inzichten: FocusInzicht[] = stats.inzichten || [];

        return (
          <div className="space-y-3">
            {/* Row 1: Core metrics */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Flow Score — the hero metric */}
              <div className={cn("flex items-center gap-2 rounded-xl px-3.5 py-2 border", focusScoreBg)}>
                <Brain className={cn("w-3.5 h-3.5", focusScoreColor)} />
                <span className={cn("text-sm font-bold tabular-nums", focusScoreColor)}>{stats.focusScore}</span>
                <span className="text-[10px] text-autronis-text-secondary uppercase">Flow Score</span>
                <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-md", focusScoreBg, focusScoreColor)}>{focusScoreLabel}</span>
              </div>

              {/* Active time */}
              <div className="flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3.5 py-2">
                <Clock className="w-3.5 h-3.5 text-autronis-accent" />
                <span className="text-sm font-semibold text-autronis-accent tabular-nums">{formatTijd(stats.totaalActief)}</span>
                <span className="text-[10px] text-autronis-text-secondary uppercase">Actief</span>
              </div>

              {/* Productief % with explanation */}
              <div className="flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3.5 py-2 group relative">
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                <span className="text-sm font-semibold text-green-400 tabular-nums">{stats.productiefPercentage}%</span>
                <span className="text-[10px] text-autronis-text-secondary uppercase">Productief</span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-autronis-bg border border-autronis-border rounded-xl text-[10px] text-autronis-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                  {prodLabel}
                </div>
              </div>

              {/* Focus sessions */}
              <div className="flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3.5 py-2">
                <Target className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-sm font-semibold text-purple-400 tabular-nums">{stats.aantalFocusSessies}</span>
                <span className="text-[10px] text-autronis-text-secondary uppercase">Focus sessies</span>
              </div>

              {/* Context switches */}
              <div className="flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3.5 py-2">
                <Shuffle className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-sm font-semibold text-orange-400 tabular-nums">{stats.contextSwitches}</span>
                <span className="text-[10px] text-autronis-text-secondary uppercase">Switches</span>
              </div>
            </div>

            {/* Row 2: Deep Work progress bar + session length */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Deep Work with target bar */}
              <div className="flex items-center gap-3 bg-autronis-card border border-autronis-border rounded-xl px-3.5 py-2 flex-1 min-w-[260px]">
                <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-autronis-text-secondary uppercase">Deep Work (≥15 min ononderbroken)</span>
                    <span className="text-xs font-semibold text-yellow-400 tabular-nums">{formatTijd(stats.deepWorkMinuten * 60)} / {formatTijd(stats.deepWorkTarget * 60)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-autronis-border/30 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", dwColor)} style={{ width: `${dwPct}%` }} />
                  </div>
                </div>
              </div>

              {/* Avg session length */}
              <div className="flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3.5 py-2 group relative">
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-sm font-semibold text-blue-400 tabular-nums">{stats.gemSessieLengte}m</span>
                <span className="text-[10px] text-autronis-text-secondary uppercase">Gem. sessie</span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-autronis-bg border border-autronis-border rounded-xl text-[10px] text-autronis-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                  {stats.gemSessieLengte >= 45 ? "Uitstekend — diepe concentratie" : stats.gemSessieLengte >= 25 ? "Goed — probeer richting 45 min" : "Kort — je wordt vaak onderbroken"}
                </div>
              </div>

              {/* Longest focus */}
              {stats.langsteFocusMinuten > 0 && (
                <div className="flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3.5 py-2 group relative">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-sm font-semibold text-amber-400 tabular-nums">{stats.langsteFocusMinuten}m</span>
                  <span className="text-[10px] text-autronis-text-secondary uppercase">Langste focus</span>
                  {stats.besteFocusBlok && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-autronis-bg border border-autronis-border rounded-xl text-[10px] text-autronis-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl max-w-xs">
                      {formatTijdRange(stats.besteFocusBlok.startTijd)} – {formatTijdRange(stats.besteFocusBlok.eindTijd)}: {stats.besteFocusBlok.beschrijving}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Row 3: Category distribution */}
            {totalCatTime > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-autronis-border/30">
                  {catEntries.map(([cat, sec]) => {
                    const pct = (sec / totalCatTime) * 100;
                    if (pct < 2) return null;
                    return (
                      <div key={cat} className="h-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: CATEGORIE_KLEUREN[cat] || "#6B7280" }}
                        title={`${CATEGORIE_LABELS[cat] || cat}: ${Math.round(pct)}%`} />
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {catEntries.slice(0, 3).map(([cat, sec]) => (
                    <span key={cat} className="text-[10px] text-autronis-text-secondary flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORIE_KLEUREN[cat] || "#6B7280" }} />
                      {CATEGORIE_LABELS[cat] || cat} {Math.round((sec / totalCatTime) * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Row 4: Focus Insights — actionable cards */}
            {inzichten.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {inzichten.slice(0, 4).map((inzicht, i) => {
                  const config = {
                    positief: { icon: CheckCircle2, border: "border-emerald-500/20", bg: "bg-emerald-500/8", color: "text-emerald-400", hoverBg: "hover:bg-emerald-500/12" },
                    waarschuwing: { icon: AlertTriangle, border: "border-amber-500/20", bg: "bg-amber-500/8", color: "text-amber-400", hoverBg: "hover:bg-amber-500/12" },
                    tip: { icon: Lightbulb, border: "border-blue-500/20", bg: "bg-blue-500/8", color: "text-blue-400", hoverBg: "hover:bg-blue-500/12" },
                    actie: { icon: ArrowRight, border: "border-autronis-accent/20", bg: "bg-autronis-accent/8", color: "text-autronis-accent", hoverBg: "hover:bg-autronis-accent/12" },
                  }[inzicht.type];
                  const InzichtIcon = config.icon;
                  return (
                    <div key={i} className={cn(
                      "flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 border transition-colors cursor-default",
                      config.border, config.bg, config.hoverBg
                    )}>
                      <InzichtIcon className={cn("w-4 h-4 mt-0.5 shrink-0", config.color)} />
                      <p className="text-xs text-autronis-text-primary leading-relaxed">{inzicht.tekst}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {stats.mogelijkOnnauwkeurig && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <span className="text-xs text-orange-400">Mogelijk onnauwkeurige data door idle tracking</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* 3. Calendar Timeline + Detail panel */}
      <div className="flex gap-4">
        {/* Main timeline */}
        <div className="flex-1 bg-autronis-card border border-autronis-border rounded-2xl p-4 overflow-hidden">
          {view === "dag" ? (
            alleSessies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Monitor className="w-12 h-12 text-autronis-text-secondary opacity-30 mb-4" />
                <p className="text-autronis-text-secondary text-sm">Geen data voor deze dag</p>
              </div>
            ) : (
              <DagTimeline
                sessies={alleSessies}
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

        {/* Detail panel — desktop */}
        {activeSessieDetail && (
          <div className="w-72 shrink-0 hidden lg:block">
            <SessieDetailPanel
              sessie={{ ...activeSessieDetail, isHandmatig: activeSessieDetail.app === "Handmatig" }}
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
            sessie={{ ...activeSessieDetail, isHandmatig: activeSessieDetail.app === "Handmatig" }}
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
        {/* Handmatig legend item */}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-autronis-accent/60" />
          <span className="text-[11px] text-autronis-text-secondary">Handmatig</span>
        </div>
      </div>
    </div>
  );
}
