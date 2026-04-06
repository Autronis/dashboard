"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Clock, Coffee, CheckSquare, X, Video, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import type { AgendaItem, ExternEvent, DeadlineEvent, AgendaTaak } from "@/hooks/queries/use-agenda";

type AnyEvent = AgendaItem | ExternEvent | DeadlineEvent;

const UUR_HOOGTE = 100; // px per uur

function extractMeetingUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const patterns = [
    /https?:\/\/meet\.google\.com\/[a-z\-]+/i,
    /https?:\/\/[\w.]*zoom\.us\/j\/\d+[^\s]*/i,
    /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s]+/i,
    /https?:\/\/[\w.]*webex\.com\/[^\s]+/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
}

function getMeetingLabel(url: string): string {
  if (url.includes("zoom.us")) return "Zoom";
  if (url.includes("meet.google")) return "Meet";
  if (url.includes("teams.microsoft")) return "Teams";
  if (url.includes("webex")) return "Webex";
  return "Meeting";
}

function getEventColors(item: AnyEvent): { bg: string; border: string; text: string } {
  const isExtern = "bron" in item;
  const isDeadline = "linkHref" in item;

  if (isDeadline) {
    return { bg: "rgba(239,68,68,0.12)", border: "#ef4444", text: "#f87171" };
  }
  if (isExtern) {
    const ext = item as ExternEvent;
    const titel = ext.titel.toLowerCase();
    if (titel.includes("deadline") || titel.includes("oplevering")) {
      return { bg: "rgba(239,68,68,0.12)", border: "#ef4444", text: "#f87171" };
    }
    return { bg: "rgba(23,184,165,0.12)", border: "#17B8A5", text: "#4DC9B4" };
  }
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

interface TooltipState {
  x: number;
  y: number;
  titel: string;
  startTijd: string | null;
  eindTijd: string | null;
  meetUrl: string | null;
  isImminent: boolean;
}

// ─── Draggable hele-dag item ───
function DraggableHeleDagItem({ item, dragId, dragData, colors, idx, onClick }: {
  item: AnyEvent;
  dragId: string;
  dragData: Record<string, unknown>;
  colors: { bg: string; border: string; text: string };
  idx: number;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: dragData,
  });

  const style: React.CSSProperties = {
    background: `linear-gradient(135deg, ${colors.bg} 0%, transparent 100%)`,
    borderLeftColor: colors.border,
    color: colors.text,
    borderColor: `${colors.border}30`,
    boxShadow: `0 2px 8px ${colors.border}20`,
    opacity: isDragging ? 0.4 : 1,
    ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : {}),
  };

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.06, duration: 0.25 }}
      className="px-3 py-2 rounded-lg text-sm font-medium border cursor-grab border-l-[3px] flex items-center gap-1.5"
      style={style}
      onClick={onClick}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0">
        <GripVertical className="w-3 h-3 opacity-50" />
      </div>
      <span className="min-w-0 truncate">{item.titel}</span>
    </motion.div>
  );
}

// ─── Draggable task block ───
function DraggableTaakBlock({ taak, top, height, startTijd, eindTijd, kalenderKleur, onUnplan, onClick }: {
  taak: AgendaTaak;
  top: number;
  height: number;
  startTijd: string;
  eindTijd: string | null;
  kalenderKleur: string;
  onUnplan?: (id: number) => void;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `taak-${taak.id}`,
    data: { taak },
  });

  const style: React.CSSProperties = {
    top: `${top}px`,
    height: `${height}px`,
    background: `linear-gradient(135deg, ${kalenderKleur}24 40%, rgba(14,23,25,0.1) 100%)`,
    borderLeftColor: kalenderKleur,
    boxShadow: `0 2px 10px ${kalenderKleur}25, inset 0 1px 0 ${kalenderKleur}25`,
    opacity: isDragging ? 0.4 : 1,
    ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      className="absolute left-12 sm:left-16 right-1.5 sm:right-3 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 border-l-[3px] cursor-grab overflow-hidden transition-[filter] hover:brightness-115 z-[3] group"
      style={style}
      onClick={onClick}
    >
      <div className="flex items-start gap-1.5">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-0.5 touch-none">
          <GripVertical className="w-3 h-3 text-autronis-text-tertiary" />
        </div>
        <p className="text-xs sm:text-sm font-semibold text-autronis-text-primary leading-snug min-w-0 flex-1">{taak.titel}</p>
      </div>
      {height >= 36 && (
        <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 ml-4">
          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" style={{ color: kalenderKleur + "B3" }} />
          <span className="text-[10px] sm:text-xs tabular-nums" style={{ color: kalenderKleur + "B3" }}>
            {startTijd}{eindTijd ? ` – ${eindTijd}` : ""}
          </span>
          {taak.projectNaam && (
            <span className="text-[10px] text-autronis-text-secondary/50 ml-auto overflow-hidden">{taak.projectNaam}</span>
          )}
        </div>
      )}
      {onUnplan && (
        <button
          className="absolute top-1.5 right-1.5 p-0.5 rounded bg-red-500/20 text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onUnplan(taak.id); }}
          title="Uit agenda halen"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Droppable time slot ───
function DroppableSlot({ uur, datumStr }: { uur: number; datumStr: string }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${datumStr}-${uur}`,
    data: { uur, datumStr },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute left-12 sm:left-16 right-0 transition-colors",
        isOver && "bg-autronis-accent/10"
      )}
      style={{ top: 0, height: "100%" }}
    />
  );
}

interface DagViewProps {
  datum: Date;
  onNavigeer: (richting: -1 | 1) => void;
  items: AnyEvent[];
  onItemClick?: (item: AgendaItem) => void;
  onSlotClick?: (datum: string) => void;
  ingeplandeTaken?: AgendaTaak[];
  onPlanTaak?: (taak: AgendaTaak, datum: string, tijd: string) => void;
  onUnplanTaak?: (id: number) => void;
  onHeleDagNaarSlot?: (item: AgendaItem, datum: string, tijd: string) => void;
  onDeadlineNaarSlot?: (deadline: DeadlineEvent, datum: string, tijd: string) => void;
}

export function DagView({ datum, onNavigeer, items, onItemClick, onSlotClick, ingeplandeTaken = [], onPlanTaak, onUnplanTaak, onHeleDagNaarSlot, onDeadlineNaarSlot }: DagViewProps) {
  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const slotData = over.data.current as { uur?: number; datumStr?: string } | undefined;
    if (!slotData?.datumStr || slotData.uur === undefined) return;

    const nieuweTijd = `${String(slotData.uur).padStart(2, "0")}:00`;

    if (active.data.current?.taak) {
      const taak = active.data.current.taak as AgendaTaak;
      onPlanTaak?.(taak, slotData.datumStr, nieuweTijd);
    } else if (active.data.current?.heleDagItem) {
      const item = active.data.current.heleDagItem as AgendaItem;
      onHeleDagNaarSlot?.(item, slotData.datumStr, nieuweTijd);
    } else if (active.data.current?.deadlineItem) {
      const dl = active.data.current.deadlineItem as DeadlineEvent;
      onDeadlineNaarSlot?.(dl, slotData.datumStr, nieuweTijd);
    }
    setActiveHeledag(null);
  }, [onPlanTaak, onHeleDagNaarSlot, onDeadlineNaarSlot]);

  // Track actively dragged item for DragOverlay
  const [activeHeledag, setActiveHeledag] = useState<{ item: AnyEvent; colors: { bg: string; border: string; text: string } } | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.heleDagItem || data?.deadlineItem) {
      const item = (data.heleDagItem || data.deadlineItem) as AnyEvent;
      setActiveHeledag({ item, colors: getEventColors(item) });
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveHeledag(null);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const datumStr = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, "0")}-${String(datum.getDate()).padStart(2, "0")}`;
  const isVandaag = datumStr === new Date().toISOString().slice(0, 10);

  // Real-time klok voor nu-lijn
  const [nu, setNu] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNu(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Hover tooltip
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showTooltip = useCallback((state: TooltipState) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setTooltip(state);
  }, []);

  const hideTooltip = useCallback(() => {
    tooltipTimerRef.current = setTimeout(() => setTooltip(null), 120);
  }, []);

  const keepTooltip = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  const dagLabel = datum.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const dagTaken = useMemo(() => {
    return ingeplandeTaken.filter((t) => t.ingeplandStart?.slice(0, 10) === datumStr);
  }, [ingeplandeTaken, datumStr]);

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

    for (const taak of dagTaken) {
      if (!taak.ingeplandStart) continue;
      const d = new Date(taak.ingeplandStart);
      min = Math.min(min, d.getHours());
      if (taak.ingeplandEind) {
        max = Math.max(max, new Date(taak.ingeplandEind).getHours() + 1);
      }
    }

    if (isVandaag) {
      const nuUur = nu.getHours();
      min = Math.min(min, nuUur);
      max = Math.max(max, nuUur + 2);
    }

    return { startUur: Math.max(0, min - 1), eindUur: Math.min(24, max) };
  }, [timed, dagTaken, isVandaag, nu]);

  const uren = useMemo(() => Array.from({ length: eindUur - startUur }, (_, i) => startUur + i), [startUur, eindUur]);

  const pauzes = useMemo(() => {
    if (timed.length < 2) return [];

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

    const merged: { startMin: number; eindMin: number }[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      if (sorted[i].startMin <= last.eindMin) {
        last.eindMin = Math.max(last.eindMin, sorted[i].eindMin);
      } else {
        merged.push({ ...sorted[i] });
      }
    }

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

  useEffect(() => {
    if (!scrollRef.current) return;
    if (isVandaag) {
      const nuUur = nu.getHours();
      const offset = (nuUur - startUur) * UUR_HOOGTE - 60;
      scrollRef.current.scrollTop = Math.max(0, offset);
    }
  }, [isVandaag, startUur, nu]);

  const nuMin = nu.getHours() * 60 + nu.getMinutes();
  const nuTop = ((nuMin - startUur * 60) / 60) * UUR_HOOGTE;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <button onClick={() => onNavigeer(-1)} className="p-1.5 sm:p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <h2 className={cn("text-sm sm:text-base font-semibold capitalize text-center", isVandaag ? "text-autronis-accent" : "text-autronis-text-primary")}>
          {dagLabel}
        </h2>
        <button onClick={() => onNavigeer(1)} className="p-1.5 sm:p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Tijdlijn met drag-and-drop (wraps hele-dag + tijdlijn zodat hele-dag items naar slots gesleept kunnen worden) */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>

      {/* Hele-dag events */}
      <AnimatePresence>
        {heleDag.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 space-y-1 overflow-hidden"
          >
            {heleDag.map((item, idx) => {
              const isExtern = "bron" in item;
              const isDeadline = "linkHref" in item;
              const colors = getEventColors(item);

              // Deadline-taken (type "taak") zijn draggable naar tijdslots
              if (isDeadline) {
                const dl = item as DeadlineEvent;
                if (dl.type === "taak") {
                  return (
                    <DraggableHeleDagItem
                      key={item.id}
                      item={item}
                      dragId={`deadline-${dl.id}`}
                      dragData={{ deadlineItem: dl }}
                      colors={colors}
                      idx={idx}
                    />
                  );
                }
              }

              // Interne AgendaItems zijn draggable naar tijdslots
              if (!isExtern && !isDeadline) {
                return (
                  <DraggableHeleDagItem
                    key={item.id}
                    item={item}
                    dragId={`heledag-${item.id}`}
                    dragData={{ heleDagItem: item }}
                    colors={colors}
                    idx={idx}
                    onClick={() => onItemClick?.(item as AgendaItem)}
                  />
                );
              }

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.25 }}
                  className="px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer border-l-[3px]"
                  style={{
                    background: `linear-gradient(135deg, ${colors.bg} 0%, transparent 100%)`,
                    borderLeftColor: colors.border,
                    color: colors.text,
                    borderColor: `${colors.border}30`,
                    boxShadow: `0 2px 8px ${colors.border}20`,
                  }}
                >
                  {item.titel}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={scrollRef} className="relative border border-autronis-border/30 rounded-xl overflow-x-auto">
        <div className="relative" style={{ height: `${uren.length * UUR_HOOGTE}px`, minWidth: "280px" }}>
          {/* Uur lijnen */}
          {uren.map((uur) => (
            <div
              key={uur}
              onClick={() => {
                if (onSlotClick) onSlotClick(datumStr);
              }}
              className="absolute left-0 right-0 flex border-b border-autronis-border/15 cursor-pointer hover:bg-autronis-accent/[0.03] transition-colors"
              style={{ top: `${(uur - startUur) * UUR_HOOGTE}px`, height: `${UUR_HOOGTE}px` }}
            >
              <div className="w-12 sm:w-16 flex-shrink-0 flex items-start justify-end pr-2 sm:pr-3 pt-1.5">
                <span className="text-[10px] sm:text-xs text-autronis-text-secondary/60 tabular-nums font-medium">
                  {String(uur).padStart(2, "0")}:00
                </span>
              </div>
              <div className="flex-1 border-l border-autronis-border/15 relative">
                <DroppableSlot uur={uur} datumStr={datumStr} />
              </div>
            </div>
          ))}

          {/* Pauze blokken met gestreepte textuur */}
          {pauzes.map((pauze, i) => {
            const top = ((pauze.startMin - startUur * 60) / 60) * UUR_HOOGTE;
            const height = Math.max(20, ((pauze.eindMin - pauze.startMin) / 60) * UUR_HOOGTE);
            const duurMin = pauze.eindMin - pauze.startMin;
            const duurLabel = duurMin >= 60 ? `${Math.floor(duurMin / 60)}u${duurMin % 60 > 0 ? ` ${duurMin % 60}min` : ""}` : `${duurMin} min`;
            return (
              <div
                key={`pauze-${i}`}
                className="absolute left-12 sm:left-16 right-1.5 sm:right-3 rounded-lg border border-dashed border-autronis-border/25 flex items-center justify-center gap-1.5 pointer-events-none z-[1]"
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  background: "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.012) 5px, rgba(255,255,255,0.012) 10px)",
                  backgroundColor: "rgba(42,53,56,0.3)",
                }}
              >
                <Coffee className="w-3 h-3 text-autronis-text-secondary/35" />
                <span className="text-xs text-autronis-text-secondary/35 font-medium">
                  Pauze · {duurLabel}
                </span>
              </div>
            );
          })}

          {/* Events met stagger + gradient + glow */}
          {timed.map((item, idx) => {
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

            // Meeting URL
            const meetUrl = isExtern
              ? ((item as ExternEvent).meetingUrl || extractMeetingUrl((item as ExternEvent).omschrijving) || extractMeetingUrl((item as ExternEvent).locatie))
              : extractMeetingUrl((item as AgendaItem).omschrijving);

            // Is imminent (< 5 min)?
            const startMs = startDate.getTime();
            const nuMs = nu.getTime();
            const diffMin = (startMs - nuMs) / 60000;
            const isImminent = diffMin >= 0 && diffMin < 5;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scaleX: 0.85, originX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: idx * 0.055, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                onClick={() => !isExtern && onItemClick?.(item as AgendaItem)}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  showTooltip({
                    x: rect.right + 8,
                    y: rect.top,
                    titel: item.titel,
                    startTijd,
                    eindTijd,
                    meetUrl: meetUrl || null,
                    isImminent,
                  });
                }}
                onMouseLeave={hideTooltip}
                className="absolute left-12 sm:left-16 right-1.5 sm:right-3 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 border-l-[3px] cursor-pointer overflow-hidden transition-[filter] hover:brightness-115 z-[2]"
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  background: `linear-gradient(135deg, ${colors.bg} 40%, rgba(14,23,25,0.1) 100%)`,
                  borderLeftColor: colors.border,
                  boxShadow: `0 2px 10px ${colors.border}20, inset 0 1px 0 ${colors.border}15`,
                }}
              >
                <p className="text-xs sm:text-sm font-semibold text-autronis-text-primary leading-snug">{item.titel}</p>
                {height >= 36 && (
                  <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" style={{ color: colors.text }} />
                    <span className="text-[10px] sm:text-xs tabular-nums" style={{ color: colors.text }}>
                      {startTijd}{eindTijd ? ` – ${eindTijd}` : ""}
                    </span>
                    {isImminent && meetUrl && (
                      <span className="ml-auto text-[9px] text-autronis-accent bg-autronis-accent/15 px-1.5 py-0.5 rounded-full animate-pulse font-medium">Nu</span>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Ingeplande taken als draggable groene blokken */}
          {dagTaken.map((taak) => {
            if (!taak.ingeplandStart) return null;
            const startDate = new Date(taak.ingeplandStart);
            const startMinuten = startDate.getHours() * 60 + startDate.getMinutes();
            const duurMin = taak.geschatteDuur || 60;

            const top = ((startMinuten - startUur * 60) / 60) * UUR_HOOGTE;
            const height = Math.max(28, (duurMin / 60) * UUR_HOOGTE);
            const startTijd = startDate.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
            const eindTijd = taak.ingeplandEind ? new Date(taak.ingeplandEind).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : null;

            return (
              <DraggableTaakBlock
                key={`taak-dag-${taak.id}`}
                taak={taak}
                top={top}
                height={height}
                startTijd={startTijd}
                eindTijd={eindTijd}
                kalenderKleur={taak.kalenderKleur || "#22c55e"}
                onUnplan={onUnplanTaak}
                onClick={() => onPlanTaak?.(taak, datumStr, `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`)}
              />
            );
          })}

          {/* Nu-indicator met smooth position transitie */}
          {isVandaag && nuTop >= 0 && nuTop <= uren.length * UUR_HOOGTE && (
            <div
              className="absolute left-10 sm:left-14 right-0 flex items-center z-10 pointer-events-none transition-[top] duration-[60000ms] ease-linear"
              style={{ top: `${nuTop}px` }}
            >
              <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5 shadow-lg shadow-red-500/40 animate-pulse" />
              <div className="flex-1 h-[2px] bg-gradient-to-r from-red-500 to-red-500/40" />
              <span className="text-[10px] font-bold text-red-400 bg-autronis-card/90 px-1.5 py-0.5 rounded ml-1">
                Nu
              </span>
            </div>
          )}
        </div>
      </div>
      {/* Drag overlay — rendert buiten overflow-hidden containers */}
      <DragOverlay dropAnimation={null}>
        {activeHeledag && (
          <div
            className="px-3 py-2 rounded-lg text-sm font-medium border border-l-[3px] shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${activeHeledag.colors.bg} 0%, transparent 100%)`,
              borderLeftColor: activeHeledag.colors.border,
              color: activeHeledag.colors.text,
              borderColor: `${activeHeledag.colors.border}30`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
              width: "max-content",
              maxWidth: "400px",
            }}
          >
            {activeHeledag.item.titel}
          </div>
        )}
      </DragOverlay>
      </DndContext>

      {/* Hover tooltip (fixed position, buiten scroll container) */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed z-[9999] bg-autronis-card border border-autronis-border/60 rounded-xl p-3 shadow-2xl min-w-[180px] max-w-[240px]"
            style={{
              left: Math.min(tooltip.x, window.innerWidth - 248),
              top: Math.min(tooltip.y, window.innerHeight - 120),
              boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
            onMouseEnter={keepTooltip}
            onMouseLeave={hideTooltip}
          >
            {/* Arrow pointer */}
            <div
              className="absolute -left-[6px] top-3 w-3 h-3 bg-autronis-card border-l border-b border-autronis-border/60 rotate-45"
            />
            <p className="text-sm font-semibold text-autronis-text-primary mb-1.5 pr-1">{tooltip.titel}</p>
            {tooltip.startTijd && (
              <div className="flex items-center gap-1.5 text-xs text-autronis-text-secondary mb-2">
                <Clock className="w-3 h-3 text-autronis-accent flex-shrink-0" />
                <span className="tabular-nums">
                  {tooltip.startTijd}{tooltip.eindTijd ? ` – ${tooltip.eindTijd}` : ""}
                </span>
              </div>
            )}
            {tooltip.meetUrl && (
              <a
                href={tooltip.meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors",
                  tooltip.isImminent
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse"
                    : "bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25"
                )}
              >
                <Video className="w-3.5 h-3.5" />
                {getMeetingLabel(tooltip.meetUrl)} joinen
                {tooltip.isImminent && <span className="ml-1 text-[9px] opacity-80">Nu!</span>}
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
