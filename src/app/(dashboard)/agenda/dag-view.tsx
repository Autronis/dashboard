"use client";

import { useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Clock, Coffee } from "lucide-react";
import type { AgendaItem, ExternEvent, DeadlineEvent } from "@/hooks/queries/use-agenda";

type AnyEvent = AgendaItem | ExternEvent | DeadlineEvent;

const UUR_HOOGTE = 60; // px per uur

// Color config per event type for dag view
function getEventColors(item: AnyEvent): { bg: string; border: string; text: string } {
  const isExtern = "bron" in item;
  const isDeadline = "linkHref" in item;

  if (isDeadline) {
    return { bg: "rgba(239,68,68,0.12)", border: "#ef4444", text: "#f87171" };
  }
  if (isExtern) {
    const ext = item as ExternEvent;
    const titel = ext.titel.toLowerCase();
    if (ext.meetingUrl || ext.deelnemers.length > 0 || titel.includes("meeting") || titel.includes("call") || titel.includes("gesprek")) {
      return { bg: "rgba(139,92,246,0.15)", border: "#a78bfa", text: "#c4b5fd" };
    }
    if (titel.includes("deadline") || titel.includes("oplevering")) {
      return { bg: "rgba(239,68,68,0.12)", border: "#ef4444", text: "#f87171" };
    }
    return { bg: "rgba(23,184,165,0.12)", border: "#17B8A5", text: "#4DC9B4" };
  }
  // Internal items
  const ai = item as AgendaItem;
  switch (ai.type) {
    case "afspraak":
      return { bg: "rgba(23,184,165,0.12)", border: "#17B8A5", text: "#4DC9B4" };
    case "deadline":
      return { bg: "rgba(239,68,68,0.12)", border: "#ef4444", text: "#f87171" };
    case "belasting":
      return { bg: "rgba(234,179,8,0.12)", border: "#eab308", text: "#facc15" };
    case "herinnering":
      return { bg: "rgba(168,85,247,0.12)", border: "#a855f7", text: "#c4b5fd" };
    default:
      return { bg: "rgba(23,184,165,0.12)", border: "#17B8A5", text: "#4DC9B4" };
  }
}

interface PauzeBlock {
  startMin: number;
  eindMin: number;
}

interface DagViewProps {
  datum: Date;
  onNavigeer: (richting: -1 | 1) => void;
  items: AnyEvent[];
  onItemClick?: (item: AgendaItem) => void;
  onSlotClick?: (datum: string) => void;
}

export function DagView({ datum, onNavigeer, items, onItemClick, onSlotClick }: DagViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const datumStr = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, "0")}-${String(datum.getDate()).padStart(2, "0")}`;
  const isVandaag = datumStr === new Date().toISOString().slice(0, 10);

  const dagLabel = datum.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Split events
  const { heleDag, timed } = useMemo(() => {
    const heleDag: AnyEvent[] = [];
    const timed: AnyEvent[] = [];

    for (const item of items) {
      const isHeleDagItem = "heleDag" in item &&
        ((typeof item.heleDag === "number" && item.heleDag === 1) || item.heleDag === true);
      const startStr = "startDatum" in item ? item.startDatum : "";

      if (isHeleDagItem || startStr.length <= 10) {
        heleDag.push(item);
      } else {
        timed.push(item);
      }
    }
    return { heleDag, timed };
  }, [items]);

  // Bepaal zichtbaar bereik: 1 uur voor eerste event tot 1 uur na laatste, min 06-20
  const { startUur, eindUur } = useMemo(() => {
    let min = 7;
    let max = 20;

    for (const item of timed) {
      const startStr = "startDatum" in item ? item.startDatum : "";
      if (startStr.length <= 10) continue;
      const d = new Date(startStr);
      const uur = d.getHours();
      min = Math.min(min, uur);

      const eindStr = "eindDatum" in item ? (item as AgendaItem & { eindDatum?: string | null }).eindDatum : null;
      if (eindStr) {
        max = Math.max(max, new Date(eindStr).getHours() + 1);
      } else {
        max = Math.max(max, uur + 1);
      }
    }

    if (isVandaag) {
      const nuUur = new Date().getHours();
      min = Math.min(min, nuUur);
      max = Math.max(max, nuUur + 2);
    }

    // Houd het compact — niet meer dan nodig
    return { startUur: Math.max(0, min - 1), eindUur: Math.min(24, max) };
  }, [timed, isVandaag]);

  const uren = useMemo(() => Array.from({ length: eindUur - startUur }, (_, i) => startUur + i), [startUur, eindUur]);

  // Bereken pauzes (gaps) tussen timed events
  const pauzes = useMemo(() => {
    if (timed.length < 2) return [];

    // Sorteer events op starttijd
    const sorted = [...timed]
      .map((item) => {
        const startStr = "startDatum" in item ? item.startDatum : "";
        if (startStr.length <= 10) return null;
        const startDate = new Date(startStr);
        const startMin = startDate.getHours() * 60 + startDate.getMinutes();
        const eindStr = "eindDatum" in item ? (item as AgendaItem & { eindDatum?: string | null }).eindDatum : null;
        let eindMin = startMin + 60;
        if (eindStr) {
          const eindDate = new Date(eindStr);
          eindMin = eindDate.getHours() * 60 + eindDate.getMinutes();
        }
        return { startMin, eindMin };
      })
      .filter((e): e is { startMin: number; eindMin: number } => e !== null)
      .sort((a, b) => a.startMin - b.startMin);

    if (sorted.length < 2) return [];

    // Merge overlapping intervals
    const merged: { startMin: number; eindMin: number }[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      if (sorted[i].startMin <= last.eindMin) {
        last.eindMin = Math.max(last.eindMin, sorted[i].eindMin);
      } else {
        merged.push({ ...sorted[i] });
      }
    }

    // Gaps between merged intervals (min 10 min gap to show)
    const gaps: PauzeBlock[] = [];
    for (let i = 0; i < merged.length - 1; i++) {
      const gapStart = merged[i].eindMin;
      const gapEnd = merged[i + 1].startMin;
      if (gapEnd - gapStart >= 10) {
        gaps.push({ startMin: gapStart, eindMin: gapEnd });
      }
    }
    return gaps;
  }, [timed]);

  // Scroll naar nu of eerste event
  useEffect(() => {
    if (!scrollRef.current) return;
    if (isVandaag) {
      const nuUur = new Date().getHours();
      const offset = (nuUur - startUur) * UUR_HOOGTE - 60;
      scrollRef.current.scrollTop = Math.max(0, offset);
    }
  }, [isVandaag, startUur]);

  // Nu-indicator positie
  const nu = new Date();
  const nuMin = nu.getHours() * 60 + nu.getMinutes();
  const nuTop = ((nuMin - startUur * 60) / 60) * UUR_HOOGTE;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onNavigeer(-1)} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className={cn("text-base font-semibold capitalize", isVandaag ? "text-autronis-accent" : "text-autronis-text-primary")}>
          {dagLabel}
        </h2>
        <button onClick={() => onNavigeer(1)} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Hele-dag events */}
      {heleDag.length > 0 && (
        <div className="mb-3 space-y-1">
          {heleDag.map((item) => {
            const isExtern = "bron" in item;
            const colors = getEventColors(item);
            return (
              <div
                key={item.id}
                className="px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer border-l-[3px]"
                style={{ backgroundColor: colors.bg, borderLeftColor: colors.border, color: colors.text, borderColor: `${colors.border}40` }}
                onClick={() => !isExtern && onItemClick?.(item as AgendaItem)}
              >
                {item.titel}
              </div>
            );
          })}
        </div>
      )}

      {/* Tijdlijn */}
      <div ref={scrollRef} className="relative border border-autronis-border/30 rounded-xl">
        <div className="relative" style={{ height: `${uren.length * UUR_HOOGTE}px` }}>
          {/* Uur lijnen */}
          {uren.map((uur) => (
            <div
              key={uur}
              onClick={() => onSlotClick?.(datumStr)}
              className="absolute left-0 right-0 flex border-b border-autronis-border/15 cursor-pointer hover:bg-autronis-accent/[0.03] transition-colors"
              style={{ top: `${(uur - startUur) * UUR_HOOGTE}px`, height: `${UUR_HOOGTE}px` }}
            >
              <div className="w-16 flex-shrink-0 flex items-start justify-end pr-3 pt-1.5">
                <span className="text-xs text-autronis-text-secondary/60 tabular-nums font-medium">
                  {String(uur).padStart(2, "0")}:00
                </span>
              </div>
              <div className="flex-1 border-l border-autronis-border/15" />
            </div>
          ))}

          {/* Pauze blokken */}
          {pauzes.map((pauze, i) => {
            const top = ((pauze.startMin - startUur * 60) / 60) * UUR_HOOGTE;
            const height = Math.max(20, ((pauze.eindMin - pauze.startMin) / 60) * UUR_HOOGTE);
            const duurMin = pauze.eindMin - pauze.startMin;
            const duurLabel = duurMin >= 60 ? `${Math.floor(duurMin / 60)}u${duurMin % 60 > 0 ? ` ${duurMin % 60}min` : ""}` : `${duurMin} min`;
            return (
              <div
                key={`pauze-${i}`}
                className="absolute left-16 right-3 rounded-lg bg-autronis-border/8 border border-dashed border-autronis-border/20 flex items-center justify-center gap-1.5 pointer-events-none z-[1]"
                style={{ top: `${top}px`, height: `${height}px` }}
              >
                <Coffee className="w-3 h-3 text-autronis-text-secondary/40" />
                <span className="text-xs text-autronis-text-secondary/40 font-medium">
                  Pauze · {duurLabel}
                </span>
              </div>
            );
          })}

          {/* Events */}
          {timed.map((item) => {
            const startStr = "startDatum" in item ? item.startDatum : "";
            if (startStr.length <= 10) return null;

            const startDate = new Date(startStr);
            const startMinuten = startDate.getHours() * 60 + startDate.getMinutes();

            const eindStr = "eindDatum" in item ? (item as AgendaItem & { eindDatum?: string | null }).eindDatum : null;
            let duurMin = 60;
            if (eindStr) {
              const eindDate = new Date(eindStr);
              duurMin = Math.max(15, (eindDate.getTime() - startDate.getTime()) / 60000);
            }

            const top = ((startMinuten - startUur * 60) / 60) * UUR_HOOGTE;
            const height = Math.max(28, (duurMin / 60) * UUR_HOOGTE);

            const isExtern = "bron" in item;
            const colors = getEventColors(item);
            const startTijd = startDate.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
            const eindTijd = eindStr ? new Date(eindStr).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : null;

            return (
              <div
                key={item.id}
                onClick={() => !isExtern && onItemClick?.(item as AgendaItem)}
                className="absolute left-16 right-3 rounded-xl px-3 py-2 border-l-[3px] cursor-pointer overflow-hidden transition-colors hover:brightness-110 z-[2]"
                style={{ top: `${top}px`, height: `${height}px`, backgroundColor: colors.bg, borderLeftColor: colors.border }}
              >
                <p className="text-sm font-semibold text-autronis-text-primary truncate">{item.titel}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3 h-3" style={{ color: colors.text }} />
                  <span className="text-xs tabular-nums" style={{ color: colors.text }}>
                    {startTijd}{eindTijd ? ` – ${eindTijd}` : ""}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Nu-indicator */}
          {isVandaag && nuTop >= 0 && nuTop <= uren.length * UUR_HOOGTE && (
            <div className="absolute left-14 right-0 flex items-center z-10 pointer-events-none" style={{ top: `${nuTop}px` }}>
              <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5 shadow-lg shadow-red-500/30" />
              <div className="flex-1 h-[2px] bg-red-500/70" />
              <span className="text-[10px] font-bold text-red-400 bg-autronis-card/90 px-1.5 py-0.5 rounded ml-1">
                Nu
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
