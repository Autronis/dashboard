"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Clock, Coffee, Check, CheckSquare, X, Video, GripVertical, Terminal, ClipboardCopy, Play } from "lucide-react";
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
function DraggableHeleDagItem({ item, dragId, dragData, colors, idx, onClick, onToggle }: {
  item: AnyEvent;
  dragId: string;
  dragData: Record<string, unknown>;
  colors: { bg: string; border: string; text: string };
  idx: number;
  onClick?: () => void;
  onToggle?: (id: number, status?: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: dragData,
  });

  const isTaak = "linkHref" in item && typeof (item as DeadlineEvent).linkHref === "string" && (item as DeadlineEvent).id?.toString().startsWith("taak-");
  const taakId = isTaak ? Number((item as DeadlineEvent).id.toString().replace("taak-", "")) : null;
  const taakStatus = isTaak ? (item as DeadlineEvent).status : undefined;
  const checked = taakStatus === "afgerond";

  const style: React.CSSProperties = {
    background: checked
      ? `linear-gradient(135deg, rgba(16,185,129,0.12) 0%, transparent 100%)`
      : `linear-gradient(135deg, ${colors.bg} 0%, transparent 100%)`,
    borderLeftColor: checked ? "#10b981" : colors.border,
    color: checked ? "#6b7280" : colors.text,
    borderColor: `${colors.border}30`,
    boxShadow: `0 2px 8px ${colors.border}20`,
    opacity: isDragging ? 0.4 : checked ? 0.5 : 1,
    ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : {}),
  };

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!taakId || !onToggle) return;
    onToggle(taakId, taakStatus);
  }

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.06, duration: 0.25 }}
      className="px-3 py-2 rounded-lg text-sm font-medium border cursor-grab border-l-[3px] flex items-center gap-2"
      style={style}
      onClick={onClick}
    >
      {isTaak && onToggle && (
        <TaakCheckCircle checked={checked} onClick={handleToggle} />
      )}
      {(!isTaak || !onToggle) && (
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0">
          <GripVertical className="w-3 h-3 opacity-50" />
        </div>
      )}
      <span className={cn("min-w-0 truncate flex-1", checked && "line-through opacity-50")}>{item.titel}</span>
      {isTaak && onToggle && (
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0">
          <GripVertical className="w-3 h-3 opacity-30" />
        </div>
      )}
    </motion.div>
  );
}

// ─── Draggable task block ───
function TaakCheckCircle({ checked, onClick, small }: { checked: boolean; onClick: (e: React.MouseEvent) => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
        small ? "w-3.5 h-3.5 border-[1.5px]" : "w-5 h-5",
        checked
          ? "bg-emerald-500 border-emerald-500"
          : "border-autronis-text-secondary/30 hover:border-emerald-400/60"
      )}
    >
      {checked && <Check className={small ? "w-2 h-2 text-white" : "w-3 h-3 text-white"} />}
    </button>
  );
}

function DraggableTaakBlock({ taak, top, height, startTijd, eindTijd, kalenderKleur, onUnplan, onToggle, onClick, halfRight, laneIndex, laneCount }: {
  taak: AgendaTaak;
  top: number;
  height: number;
  startTijd: string;
  eindTijd: string | null;
  kalenderKleur: string;
  onUnplan?: (id: number) => void;
  onToggle?: (id: number, status?: string) => void;
  onClick?: () => void;
  halfRight?: boolean;
  laneIndex?: number;
  laneCount?: number;
}) {
  const checked = taak.status === "afgerond";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `taak-${taak.id}`,
    data: { taak },
  });

  // Lane-based positioning voor overlappende handmatige taken: deel de
  // beschikbare breedte op in kolommen zodat botsende taken naast elkaar
  // staan ipv bovenop elkaar. Gebruik calc() met de bestaande left/right
  // constraints (left-12 sm:left-16, right-1.5 sm:right-3).
  const useLanes = !halfRight && laneCount && laneCount > 1 && typeof laneIndex === "number";
  const laneStyle: React.CSSProperties = useLanes
    ? {
        // 4rem (left-16) start + 0.75rem (right-3) end + 2px gaps between lanes
        left: `calc(4rem + (100% - 4rem - 0.75rem - ${(laneCount! - 1) * 4}px) * ${laneIndex! / laneCount!} + ${laneIndex! * 4}px)`,
        width: `calc((100% - 4rem - 0.75rem - ${(laneCount! - 1) * 4}px) / ${laneCount!})`,
      }
    : {};

  const style: React.CSSProperties = {
    top: `${top}px`,
    height: `${height}px`,
    background: checked
      ? `linear-gradient(135deg, rgba(16,185,129,0.12) 40%, rgba(14,23,25,0.05) 100%)`
      : `linear-gradient(135deg, ${kalenderKleur}24 40%, rgba(14,23,25,0.1) 100%)`,
    borderLeftColor: checked ? "#10b981" : kalenderKleur,
    boxShadow: `0 2px 10px ${kalenderKleur}25, inset 0 1px 0 ${kalenderKleur}25`,
    opacity: isDragging ? 0.4 : checked ? 0.5 : 1,
    ...laneStyle,
    ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : {}),
  };

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    onToggle?.(taak.id, taak.status);
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute rounded-lg sm:rounded-xl pl-2 sm:pl-3 pr-2 sm:pr-3 border-l-[3px] cursor-grab overflow-hidden transition-all hover:brightness-115 z-[4] group flex flex-col justify-center",
        // Lane-based: laat left/width over aan inline style. Anders default classes.
        useLanes
          ? ""
          : halfRight
            ? "left-[51%] right-1.5 sm:right-3"
            : "left-12 sm:left-16 right-1.5 sm:right-3"
      )}
      style={style}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5">
        <TaakCheckCircle checked={checked} onClick={handleToggle} small />
        {height < 36 && (
          <span className="text-[10px] tabular-nums flex-shrink-0 font-medium" style={{ color: kalenderKleur + "B3" }}>
            {startTijd}
          </span>
        )}
        {taak.uitvoerder === "claude" ? (
          <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 flex-shrink-0 inline-flex items-center gap-1">
            <Terminal className="w-2.5 h-2.5" />
            Claude
          </span>
        ) : (
          <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-autronis-accent/15 text-autronis-accent flex-shrink-0">
            Handmatig
          </span>
        )}
        <p className={cn(
          "text-xs font-semibold text-autronis-text-primary leading-snug min-w-0 flex-1 transition-all truncate",
          checked && "line-through text-autronis-text-secondary/50"
        )}>{taak.titel}</p>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0">
          <GripVertical className="w-3 h-3 text-autronis-text-tertiary" />
        </div>
      </div>
      {height >= 36 && (
        <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 ml-6">
          <span className="text-[10px] tabular-nums" style={{ color: kalenderKleur + "80" }}>
            {startTijd}{eindTijd ? `–${eindTijd}` : ""}
          </span>
          {taak.projectNaam && (
            <span className="text-[10px] text-autronis-text-secondary/50 ml-auto overflow-hidden truncate">{taak.projectNaam}</span>
          )}
        </div>
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
  onSlotClick?: (datum: string, tijd?: string) => void;
  ingeplandeTaken?: AgendaTaak[];
  onPlanTaak?: (taak: AgendaTaak, datum: string, tijd: string) => void;
  onTaakDetail?: (taakId: number) => void;
  onUnplanTaak?: (id: number) => void;
  onTaakToggle?: (id: number, status?: string) => void;
  onHeleDagNaarSlot?: (item: AgendaItem, datum: string, tijd: string) => void;
  onDeadlineNaarSlot?: (deadline: DeadlineEvent, datum: string, tijd: string) => void;
}

// Lokaal "bijgewoond" state voor externe events (Google Calendar kan niet afgevinkt worden, dus lokaal per browser).
const EVENT_DONE_KEY = "autronis-event-done";
function useEventDoneState() {
  const [done, setDone] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(EVENT_DONE_KEY);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });
  const toggle = useCallback((eventId: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      try { localStorage.setItem(EVENT_DONE_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, []);
  return { done, toggle };
}

export function DagView({ datum, onNavigeer, items, onItemClick, onSlotClick, ingeplandeTaken = [], onPlanTaak, onTaakDetail, onUnplanTaak, onTaakToggle, onHeleDagNaarSlot, onDeadlineNaarSlot }: DagViewProps) {
  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { done: eventDone, toggle: toggleEventDone } = useEventDoneState();

  // Claude sessies zijn standaard ingeklapt — alleen header zichtbaar zodat ze niet
  // overlappen met events in dezelfde tijdspanne. Klik op header = uitklappen, dan
  // verschijnt de fase/taken lijst bovenop andere events (z-index elevated).
  const [expandedSessies, setExpandedSessies] = useState<Set<number>>(new Set());
  const toggleSessie = useCallback((key: number) => {
    setExpandedSessies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const slotData = over.data.current as { uur?: number; datumStr?: string } | undefined;
    if (!slotData?.datumStr || slotData.uur === undefined) return;

    // Find the latest ending task/event that would conflict with this slot
    // Check ALL tasks that end after slotStart — so tasks from previous slots
    // that run into this slot are properly accounted for
    const slotStart = slotData.uur * 60;
    let laatsteEind = slotStart; // default: start of the hour
    const draggedId = (active.data.current?.taak as AgendaTaak | undefined)?.id;

    // Helper: get minutes-of-day from ISO string, handling both local and UTC formats
    function minOfDay(iso: string): number {
      // If no "Z" suffix, treat as local time — parse directly
      if (!iso.endsWith("Z") && !iso.includes("+")) {
        const [, timePart] = iso.split("T");
        if (timePart) {
          const [h, m] = timePart.split(":").map(Number);
          return h * 60 + (m || 0);
        }
      }
      // UTC or offset — use Date object (converts to local)
      const d = new Date(iso);
      return d.getHours() * 60 + d.getMinutes();
    }

    // Skip Claude session tasks — they run on the left side, don't conflict with handmatige taken
    const claudeSessionIds = new Set<number>();
    const allClaude = ingeplandeTaken.filter((t) => t.uitvoerder === "claude" && t.ingeplandStart);
    if (allClaude.length >= 2) {
      for (const t of allClaude) claudeSessionIds.add(t.id);
    }

    for (const t of ingeplandeTaken) {
      if (!t.ingeplandStart || t.id === draggedId) continue;
      if (claudeSessionIds.has(t.id)) continue; // Skip Claude session tasks
      const tStartMin = minOfDay(t.ingeplandStart);
      const tEindMin = t.ingeplandEind
        ? minOfDay(t.ingeplandEind)
        : tStartMin + (t.geschatteDuur || 30);
      if (tEindMin > slotStart && tStartMin < slotStart + 60) {
        laatsteEind = Math.max(laatsteEind, tEindMin);
      }
    }

    for (const item of items) {
      const startStr = "startDatum" in item ? item.startDatum : "";
      if (!startStr || startStr.length <= 10) continue;
      const iStartMin = minOfDay(startStr);
      const eindStr = "eindDatum" in item ? (item as AgendaItem & { eindDatum?: string | null }).eindDatum : null;
      const iEindMin = eindStr ? minOfDay(eindStr) : iStartMin + 60;
      if (iEindMin > slotStart && iStartMin < slotStart + 60) {
        laatsteEind = Math.max(laatsteEind, iEindMin);
      }
    }

    const nieuweTijd = `${String(Math.floor(laatsteEind / 60)).padStart(2, "0")}:${String(laatsteEind % 60).padStart(2, "0")}`;

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
  }, [onPlanTaak, onHeleDagNaarSlot, onDeadlineNaarSlot, ingeplandeTaken, items]);

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
                      onToggle={onTaakToggle}
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
                if (onSlotClick) onSlotClick(datumStr, `${String(uur).padStart(2, "0")}:00`);
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

          {/* Events met stagger + gradient + glow + lane-toewijzing voor overlap */}
          {(() => {
            // Bouw lane info zodat overlappende events naast elkaar landen.
            const eventStart = (item: typeof timed[number]) => {
              const s = "startDatum" in item ? item.startDatum : "";
              return s.length > 10 ? new Date(s).getTime() : 0;
            };
            const eventEind = (item: typeof timed[number]) => {
              const s = "startDatum" in item ? item.startDatum : "";
              if (s.length <= 10) return 0;
              const e = "eindDatum" in item ? (item as AgendaItem & { eindDatum?: string | null }).eindDatum : null;
              return e ? new Date(e).getTime() : new Date(s).getTime() + 60 * 60000;
            };
            const sortedEv = [...timed]
              .filter((it) => eventStart(it) > 0)
              .sort((a, b) => eventStart(a) - eventStart(b));
            type EvLane = { lane: number; cluster: number };
            const evLaneInfo = new Map<string | number, EvLane>();
            let cluster = 0;
            let clusterEnd = 0;
            const clusterIds: number[] = [];
            for (const it of sortedEv) {
              const s = eventStart(it);
              if (s >= clusterEnd) cluster++;
              clusterEnd = Math.max(clusterEnd, eventEind(it));
              clusterIds.push(cluster);
            }
            const lanesPerCluster = new Map<number, number[]>();
            for (let i = 0; i < sortedEv.length; i++) {
              const it = sortedEv[i];
              const c = clusterIds[i];
              if (!lanesPerCluster.has(c)) lanesPerCluster.set(c, []);
              const lanes = lanesPerCluster.get(c)!;
              const s = eventStart(it);
              let assigned = -1;
              for (let l = 0; l < lanes.length; l++) {
                if (lanes[l] <= s) { assigned = l; break; }
              }
              if (assigned === -1) {
                assigned = lanes.length;
                lanes.push(0);
              }
              lanes[assigned] = eventEind(it);
              evLaneInfo.set(it.id, { lane: assigned, cluster: c });
            }
            const evClusterTotal = new Map<number, number>();
            for (const [c, lanes] of lanesPerCluster.entries()) {
              evClusterTotal.set(c, lanes.length);
            }

            return timed.map((item, idx) => {
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

            const eventKey = `${item.id}`;
            const checked = eventDone.has(eventKey);
            const tagLabel = isExtern ? "Meeting" : "Event";

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
                className={cn(
                  "absolute rounded-lg sm:rounded-xl pl-2 sm:pl-3 pr-2 sm:pr-3 border-l-[3px] cursor-pointer overflow-hidden transition-all hover:brightness-115 z-[2] flex flex-col justify-center",
                  // Bij meerdere lanes: gebruik inline left/width, anders default
                  (() => {
                    const li = evLaneInfo.get(item.id);
                    const tot = li ? evClusterTotal.get(li.cluster) ?? 1 : 1;
                    return tot > 1 ? "" : "left-12 sm:left-16 right-1.5 sm:right-3";
                  })()
                )}
                style={(() => {
                  const li = evLaneInfo.get(item.id);
                  const tot = li ? evClusterTotal.get(li.cluster) ?? 1 : 1;
                  const base: React.CSSProperties = {
                    top: `${top}px`,
                    height: `${height}px`,
                    background: checked
                      ? `linear-gradient(135deg, rgba(16,185,129,0.12) 40%, rgba(14,23,25,0.05) 100%)`
                      : `linear-gradient(135deg, ${colors.bg} 40%, rgba(14,23,25,0.1) 100%)`,
                    borderLeftColor: checked ? "#10b981" : colors.border,
                    boxShadow: `0 2px 10px ${colors.border}20, inset 0 1px 0 ${colors.border}15`,
                    opacity: checked ? 0.55 : 1,
                  };
                  if (tot > 1 && li) {
                    base.left = `calc(4rem + (100% - 4rem - 0.75rem - ${(tot - 1) * 4}px) * ${li.lane / tot} + ${li.lane * 4}px)`;
                    base.width = `calc((100% - 4rem - 0.75rem - ${(tot - 1) * 4}px) / ${tot})`;
                  }
                  return base;
                })()}
              >
                <div className="flex items-center gap-1.5">
                  <TaakCheckCircle
                    checked={checked}
                    onClick={(e) => { e.stopPropagation(); toggleEventDone(eventKey); }}
                    small
                  />
                  <span className="text-[10px] tabular-nums flex-shrink-0 font-medium" style={{ color: colors.text }}>
                    {startTijd}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: `${colors.border}25`, color: colors.text }}>
                    {tagLabel}
                  </span>
                  <p className={cn(
                    "text-xs font-semibold text-autronis-text-primary leading-snug min-w-0 flex-1 transition-all truncate",
                    checked && "line-through text-autronis-text-secondary/50"
                  )}>
                    {item.titel}
                  </p>
                  {isImminent && meetUrl && (
                    <span className="text-[9px] text-autronis-accent bg-autronis-accent/15 px-1.5 py-0.5 rounded-full animate-pulse font-medium flex-shrink-0">Nu</span>
                  )}
                </div>
                {height >= 36 && (
                  <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 ml-6">
                    <span className="text-[10px] tabular-nums" style={{ color: colors.text + "80" }}>
                      {startTijd}{eindTijd ? `–${eindTijd}` : ""}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          });
          })()}

          {/* Claude sessie blok — één blok met checklist */}
          {(() => {
            const claudeTaken = dagTaken.filter((t) => t.uitvoerder === "claude" && t.ingeplandStart);
            if (claudeTaken.length === 0) return null;

            // Sort by start time
            const sorted = [...claudeTaken].sort((a, b) =>
              new Date(a.ingeplandStart!).getTime() - new Date(b.ingeplandStart!).getTime()
            );

            // Groepeer Claude taken die overlappen of aansluiten (max 15 min gap)
            const sessies: typeof sorted[] = [];
            let current = [sorted[0]];
            for (let i = 1; i < sorted.length; i++) {
              const prevEnd = Math.max(
                ...current.map((t) => new Date(t.ingeplandEind || t.ingeplandStart!).getTime())
              );
              const curStart = new Date(sorted[i].ingeplandStart!).getTime();
              if (curStart - prevEnd <= 15 * 60000) {
                current.push(sorted[i]);
              } else {
                sessies.push(current);
                current = [sorted[i]];
              }
            }
            sessies.push(current);

            return sessies.map((group) => {
              // Alleen 2+ taken krijgen een sessie-blok. Single Claude taken
              // worden als gewone DraggableTaakBlock gerenderd (behoudt
              // projectnaam en click-to-detail).
              if (group.length < 2) return null;
              const sessieKey = group[0].id; // stabiele key op basis van eerste taak
              const expanded = expandedSessies.has(sessieKey);

              const startDate = new Date(Math.min(...group.map((t) => new Date(t.ingeplandStart!).getTime())));
              const eindDate = new Date(Math.max(...group.map((t) => new Date(t.ingeplandEind || t.ingeplandStart!).getTime())));
              const startMinuten = startDate.getHours() * 60 + startDate.getMinutes();
              const eindMinuten = eindDate.getHours() * 60 + eindDate.getMinutes();
              const duurMin = Math.max(30, eindMinuten - startMinuten);
              const blockTop = ((startMinuten - startUur * 60) / 60) * UUR_HOOGTE;
              const fullHeight = Math.max(60, (duurMin / 60) * UUR_HOOGTE);
              const collapsedHeight = 30; // alleen header
              const startLabel = startDate.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
              const eindLabel = eindDate.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
              const afgerond = group.filter((t) => t.status === "afgerond").length;

              // Check of iets (handmatige taak of extern event) in deze tijdspanne overlapt.
              // Zo ja → rendert als half-width links zodat de tekst ernaast zichtbaar blijft.
              const sessieStartMs = startDate.getTime();
              const sessieEindMs = eindDate.getTime();
              const heeftTaakOverlap = dagTaken.some((t) => {
                if (t.uitvoerder === "claude" || !t.ingeplandStart) return false;
                const ts = new Date(t.ingeplandStart).getTime();
                const te = t.ingeplandEind
                  ? new Date(t.ingeplandEind).getTime()
                  : ts + (t.geschatteDuur || 30) * 60000;
                return ts < sessieEindMs && te > sessieStartMs;
              });
              const heeftEventOverlap = timed.some((ev) => {
                const evStartStr = "startDatum" in ev ? ev.startDatum : "";
                if (!evStartStr || evStartStr.length <= 10) return false;
                const evStart = new Date(evStartStr).getTime();
                const evEindStr = "eindDatum" in ev ? (ev as AgendaItem & { eindDatum?: string | null }).eindDatum : null;
                const evEind = evEindStr ? new Date(evEindStr).getTime() : evStart + 60 * 60000;
                return evStart < sessieEindMs && evEind > sessieStartMs;
              });
              const heeftOverlap = heeftTaakOverlap || heeftEventOverlap;

              // Groepeer primair per FASE (zoals Sem wil: "fase 1, 2, 3").
              // Binnen multi-project sessies: project > fase hierarchie.
              const projecten = new Set(group.map((t) => t.projectNaam || "Overig"));
              const meerdereProjecten = projecten.size > 1;

              // Bouw map: project → fase → taken
              const perProject = new Map<string, Map<string, typeof group>>();
              for (const t of group) {
                const proj = t.projectNaam || "Overig";
                const fase = t.fase || "Geen fase";
                if (!perProject.has(proj)) perProject.set(proj, new Map());
                const faseMap = perProject.get(proj)!;
                if (!faseMap.has(fase)) faseMap.set(fase, []);
                faseMap.get(fase)!.push(t);
              }

              // Alle unieke fases over de hele sessie (voor single-project shortcut)
              const alleFases = new Map<string, typeof group>();
              for (const t of group) {
                const fase = t.fase || "Geen fase";
                if (!alleFases.has(fase)) alleFases.set(fase, []);
                alleFases.get(fase)!.push(t);
              }

              // Detecteer dominante cluster in deze groep. Als alle taken
              // hetzelfde cluster hebben, toon die in de header. Anders
              // vallen we terug op fase-namen zoals voorheen.
              const clusterCounts = new Map<string, number>();
              for (const t of group) {
                const c = t.cluster || "";
                if (c) clusterCounts.set(c, (clusterCounts.get(c) ?? 0) + 1);
              }
              const dominanteCluster = clusterCounts.size === 1
                ? Array.from(clusterCounts.keys())[0]
                : null;

              // Korte header beschrijving: cluster naam of fase namen
              const beschrijving = dominanteCluster
                ? dominanteCluster
                : Array.from(alleFases.keys()).slice(0, 3).join(" · ")
                  + (alleFases.size > 3 ? ` +${alleFases.size - 3}` : "");

              // Start hele sessie: zet alle taken in de groep naar 'bezig'
              // via individuele PUT calls zodat de cluster cascade +
              // historische owner check per taak kan draaien.
              const handleStartSessie = async (e: React.MouseEvent) => {
                e.stopPropagation();
                const openTaken = group.filter((t) => t.status === "open");
                if (openTaken.length === 0) {
                  window.dispatchEvent(
                    new CustomEvent("autronis:toast", {
                      detail: { bericht: "Geen open taken in deze sessie", type: "fout" },
                    })
                  );
                  return;
                }
                try {
                  const resultaten = await Promise.all(
                    openTaken.map((t) =>
                      fetch(`/api/taken/${t.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "bezig" }),
                      })
                    )
                  );
                  const gefaald = resultaten.filter((r) => !r.ok).length;
                  const gelukt = openTaken.length - gefaald;
                  window.dispatchEvent(
                    new CustomEvent("autronis:toast", {
                      detail: {
                        bericht: gefaald > 0
                          ? `${gelukt}/${openTaken.length} taken gestart (${gefaald} gefaald)`
                          : `${gelukt} taken gestart in cluster sessie`,
                        type: gefaald > 0 ? "fout" : "succes",
                      },
                    })
                  );
                  window.dispatchEvent(new CustomEvent("autronis:agenda-refetch"));
                } catch {
                  window.dispatchEvent(
                    new CustomEvent("autronis:toast", {
                      detail: { bericht: "Kon sessie niet starten", type: "fout" },
                    })
                  );
                }
              };

              // Afrond hele sessie: bulk status update — geen cascade nodig
              const handleAfrondSessie = async (e: React.MouseEvent) => {
                e.stopPropagation();
                const nietAfgerond = group.filter((t) => t.status !== "afgerond");
                if (nietAfgerond.length === 0) {
                  window.dispatchEvent(
                    new CustomEvent("autronis:toast", {
                      detail: { bericht: "Sessie is al afgerond", type: "fout" },
                    })
                  );
                  return;
                }
                try {
                  const res = await fetch("/api/taken/bulk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      ids: nietAfgerond.map((t) => t.id),
                      updates: { status: "afgerond" },
                    }),
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.fout || "Bulk update mislukt");
                  }
                  window.dispatchEvent(
                    new CustomEvent("autronis:toast", {
                      detail: {
                        bericht: `${nietAfgerond.length} taken afgerond`,
                        type: "succes",
                      },
                    })
                  );
                  window.dispatchEvent(new CustomEvent("autronis:agenda-refetch"));
                } catch (err) {
                  window.dispatchEvent(
                    new CustomEvent("autronis:toast", {
                      detail: {
                        bericht: err instanceof Error ? err.message : "Afrond mislukt",
                        type: "fout",
                      },
                    })
                  );
                }
              };

              // Gestructureerde prompt voor Claude chat — inclusief projectmap cd
              const handleKopieerPrompt = (e: React.MouseEvent) => {
                e.stopPropagation();

                // Collect unique project paths from group
                const projectPaden = new Map<string, string>(); // projectNaam → pad
                for (const t of group) {
                  if (t.projectNaam && t.projectMap) {
                    projectPaden.set(t.projectNaam, t.projectMap);
                  } else if (t.projectNaam) {
                    // Fallback: kebab-case van project naam
                    const slug = t.projectNaam
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-+|-+$/g, "");
                    projectPaden.set(t.projectNaam, `~/Autronis/Projects/${slug}`);
                  }
                }

                // Genereer één prompt-blok per project. Bij meerdere projecten
                // worden ze onder elkaar geplakt met een duidelijke divider zodat
                // Sem ze los kan kopiëren naar aparte Claude Code chats (elke chat
                // heeft eigen werkdirectory).
                const buildPromptVoorProject = (proj: string, faseMap: Map<string, typeof group>) => {
                  const pad = projectPaden.get(proj) ?? "";
                  const taakTotaal = Array.from(faseMap.values()).reduce((a, b) => a + b.length, 0);

                  // Groepeer primair per cluster (#107775). Taken zonder cluster
                  // vallen terug op fase als groepsheader. Binnen een cluster
                  // worden taken op fase gesorteerd zodat de volgorde logisch
                  // blijft (bijv. "Fase 1" taken voor "Fase 2").
                  const clusterMap = new Map<string, typeof group>();
                  const projectTaken = Array.from(faseMap.values()).flat();
                  for (const t of projectTaken) {
                    const key = t.cluster || t.fase || "Overig";
                    if (!clusterMap.has(key)) clusterMap.set(key, []);
                    clusterMap.get(key)!.push(t);
                  }

                  const out: string[] = [];
                  out.push(`# ${proj} · Claude sessie ${startLabel}–${eindLabel}`);
                  out.push("");
                  out.push(`${taakTotaal} taken · ${clusterMap.size} cluster(s)`);
                  out.push("");
                  if (pad) {
                    out.push(`\`\`\`bash`);
                    out.push(`cd ${pad}`);
                    out.push(`\`\`\``);
                    out.push("");
                    out.push(`Start met \`/prime\` om project context te laden. Werk per cluster af, commit per cluster — dashboard sync gaat automatisch via de hook.`);
                    out.push("");
                  }
                  for (const [cluster, clusterTaken] of clusterMap.entries()) {
                    out.push(`## ${cluster}`);
                    for (const t of clusterTaken) {
                      const faseLabel = t.fase && t.fase !== cluster ? ` _(${t.fase})_` : "";
                      out.push(`- [ ] ${t.titel}${t.prioriteit === "hoog" ? " **(HOOG)**" : ""}${faseLabel}`);
                      if (t.omschrijving) {
                        const omschr = t.omschrijving.split("\n").map((l) => `      ${l}`).join("\n");
                        out.push(omschr);
                      }
                    }
                    out.push("");
                  }
                  return out.join("\n");
                };

                const blokken: string[] = [];
                for (const [proj, faseMap] of perProject.entries()) {
                  blokken.push(buildPromptVoorProject(proj, faseMap));
                }

                let finaal: string;
                if (blokken.length <= 1) {
                  finaal = blokken[0] ?? "";
                } else {
                  // Multi-project: header + blokken met divider zodat Sem ze los kan plakken
                  const header = `# Claude sessie · ${startLabel}–${eindLabel} · ${blokken.length} projecten\n\nElk blok hieronder is een aparte chat. Open per project een nieuwe Claude Code sessie, plak het bijbehorende blok, en werk het af.\n\n`;
                  const divider = "\n\n---\n\n";
                  finaal = header + blokken.join(divider);
                }

                navigator.clipboard.writeText(finaal);
              };

              // Verwijder hele sessie uit de agenda: zet ingeplandStart +
              // ingeplandEind op null voor alle taken in het blok. Taken zelf
              // blijven bestaan (status == open of afgerond), ze zijn alleen
              // niet meer ingepland voor deze dag.
              const handleUnplanSessie = async (e: React.MouseEvent) => {
                e.stopPropagation();
                const ok = window.confirm(
                  `Claude sessie van ${startLabel}–${eindLabel} met ${group.length} taken uit de agenda halen? De taken zelf blijven staan.`
                );
                if (!ok) return;
                try {
                  const resultaten = await Promise.all(
                    group.map((t) =>
                      fetch(`/api/taken/${t.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ingeplandStart: null, ingeplandEind: null }),
                      })
                    )
                  );
                  const gefaald = resultaten.filter((r) => !r.ok).length;
                  window.dispatchEvent(
                    new CustomEvent("autronis:toast", {
                      detail: {
                        bericht: gefaald > 0
                          ? `${group.length - gefaald}/${group.length} taken ontpland (${gefaald} gefaald)`
                          : `${group.length} taken uit agenda gehaald`,
                        type: gefaald > 0 ? "fout" : "succes",
                      },
                    })
                  );
                  window.dispatchEvent(new CustomEvent("autronis:agenda-refetch"));
                } catch {
                  window.dispatchEvent(
                    new CustomEvent("autronis:toast", {
                      detail: { bericht: "Kon sessie niet verwijderen", type: "fout" },
                    })
                  );
                }
              };

              return (
                <div
                  key={`claude-sessie-${sessieKey}`}
                  className={cn(
                    "absolute rounded-xl border-l-[3px] border-purple-500 overflow-hidden transition-all",
                    expanded ? "z-[20] shadow-2xl" : "z-[3]",
                    // Half-width links als er iets naast zit (zowel collapsed als expanded),
                    // anders volle breedte.
                    heeftOverlap ? "left-12 sm:left-16 right-[50.5%]" : "left-12 sm:left-16 right-1.5 sm:right-3"
                  )}
                  style={{
                    top: `${blockTop}px`,
                    height: `${expanded ? fullHeight : collapsedHeight}px`,
                    // Expanded = opaak donker paars zodat onderliggende events NIET doorschijnen.
                    // Collapsed = subtiele gradient (header is enige zichtbare deel).
                    background: expanded
                      ? "linear-gradient(135deg, #1a0a2e 0%, #241038 100%)"
                      : "linear-gradient(135deg, rgba(168,85,247,0.22) 0%, rgba(168,85,247,0.08) 100%)",
                    borderColor: "#a855f7",
                    boxShadow: expanded ? "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(168,85,247,0.3)" : "0 2px 12px rgba(168,85,247,0.15)",
                  }}
                >
                  {/* Header — altijd zichtbaar, klikbaar om te togglen */}
                  <div
                    onClick={() => toggleSessie(sessieKey)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 border-b border-purple-500/20 hover:bg-purple-500/5 transition-colors cursor-pointer select-none"
                  >
                    <Terminal className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-purple-300 flex-shrink-0">
                      Claude · {startLabel}–{eindLabel}
                    </span>
                    <span className="text-[10px] text-purple-400/60 truncate flex-1 min-w-0">
                      {beschrijving}
                    </span>
                    <button
                      type="button"
                      onClick={handleKopieerPrompt}
                      title="Kopieer prompt voor Claude chat"
                      className="text-[10px] font-medium text-purple-300 hover:text-purple-100 bg-purple-500/20 hover:bg-purple-500/35 px-1.5 py-0.5 rounded flex-shrink-0 inline-flex items-center gap-1 transition-colors"
                    >
                      <ClipboardCopy className="w-2.5 h-2.5" />
                      Kopieer
                    </button>
                    {group.some((t) => t.status === "open") && (
                      <button
                        type="button"
                        onClick={handleStartSessie}
                        title={`Start alle ${group.filter((t) => t.status === "open").length} open taken`}
                        className="text-[10px] font-medium text-blue-200 hover:text-blue-50 bg-blue-500/25 hover:bg-blue-500/40 px-1.5 py-0.5 rounded flex-shrink-0 inline-flex items-center gap-1 transition-colors"
                      >
                        <Play className="w-2.5 h-2.5" />
                        Start
                      </button>
                    )}
                    {group.some((t) => t.status !== "afgerond") && (
                      <button
                        type="button"
                        onClick={handleAfrondSessie}
                        title="Rond hele sessie af"
                        className="text-[10px] font-medium text-emerald-200 hover:text-emerald-50 bg-emerald-500/25 hover:bg-emerald-500/40 px-1.5 py-0.5 rounded flex-shrink-0 inline-flex items-center gap-1 transition-colors"
                      >
                        <Check className="w-2.5 h-2.5" />
                        Afrond
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleUnplanSessie}
                      title="Verwijder deze sessie uit de agenda (taken blijven bestaan)"
                      className="text-[10px] font-medium text-red-300 hover:text-red-100 bg-red-500/20 hover:bg-red-500/35 px-1.5 py-0.5 rounded flex-shrink-0 inline-flex items-center gap-1 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                    <span className="text-[10px] text-purple-400/70 tabular-nums flex-shrink-0">{afgerond}/{group.length}</span>
                    {expanded ? (
                      <ChevronUp className="w-3 h-3 text-purple-400/70 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-purple-400/70 flex-shrink-0" />
                    )}
                  </div>

                  {/* Fase/taken lijst — alleen als expanded */}
                  {expanded && (
                    <div className="px-2 py-1.5 overflow-y-auto" style={{ maxHeight: `${fullHeight - 36}px` }}>
                      {Array.from(perProject.entries()).map(([proj, faseMap]) => (
                        <div key={proj} className="mb-1.5">
                          {meerdereProjecten && (
                            <div className="flex items-center gap-1.5 mb-1 px-1 border-b border-purple-500/10 pb-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-400/60" />
                              <span className="text-[10px] font-bold uppercase tracking-wide text-purple-300/80">{proj}</span>
                            </div>
                          )}
                          {Array.from(faseMap.entries()).map(([fase, faseTaken]) => (
                            <div key={fase} className="mb-1">
                              <div className="text-[10px] font-semibold text-purple-200/90 px-1 py-0.5 bg-purple-500/10 rounded-sm mb-0.5">
                                {fase}
                              </div>
                              {faseTaken.map((taak) => {
                                const done = taak.status === "afgerond";
                                return (
                                  <div key={taak.id} className="flex items-center gap-2 py-0.5 px-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onTaakToggle?.(taak.id, taak.status); }}
                                      className={cn(
                                        "w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all",
                                        done ? "bg-purple-500 border-purple-500" : "border-purple-400/40 hover:border-purple-400"
                                      )}
                                    >
                                      {done && <Check className="w-2 h-2 text-white" />}
                                    </button>
                                    <span className={cn(
                                      "text-[11px] truncate flex-1",
                                      done ? "line-through text-purple-400/30" : "text-purple-100"
                                    )}>
                                      {taak.titel}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}

          {/* Ingeplande taken als draggable blokken — met lane-toewijzing voor
              overlappende handmatige taken zodat ze naast elkaar landen ipv
              bovenop elkaar. Claude sessie blokken doen niet mee (eigen halfRight). */}
          {(() => {
            const handmatigeTaken = dagTaken.filter((t) => t.ingeplandStart && t.uitvoerder !== "claude");
            const sorted = [...handmatigeTaken].sort(
              (a, b) => new Date(a.ingeplandStart!).getTime() - new Date(b.ingeplandStart!).getTime()
            );
            const eindVan = (t: typeof sorted[number]) => {
              if (t.ingeplandEind) return new Date(t.ingeplandEind).getTime();
              return new Date(t.ingeplandStart!).getTime() + (t.geschatteDuur || 60) * 60000;
            };
            type Lane = { id: number; lane: number; cluster: number };
            const laneInfo = new Map<number, Lane>();
            // Cluster overlappende taken (incl. transitief), dan binnen elk cluster
            // lanes toewijzen via sweep: elke taak in de eerste lane wiens vorige
            // taak al klaar is, anders een nieuwe lane.
            let cluster = 0;
            let clusterEinde = 0;
            const reConstructed: number[] = [];
            for (let i = 0; i < sorted.length; i++) {
              const t = sorted[i];
              const s = new Date(t.ingeplandStart!).getTime();
              if (s >= clusterEinde) cluster++;
              clusterEinde = Math.max(clusterEinde, eindVan(t));
              reConstructed.push(cluster);
            }
            const clusterTotalLanes = new Map<number, number>();
            // Per cluster lanes toewijzen
            const lanesPerCluster = new Map<number, number[]>(); // clusterId → end times per lane
            for (let i = 0; i < sorted.length; i++) {
              const t = sorted[i];
              const c = reConstructed[i];
              if (!lanesPerCluster.has(c)) lanesPerCluster.set(c, []);
              const lanes = lanesPerCluster.get(c)!;
              const s = new Date(t.ingeplandStart!).getTime();
              let assigned = -1;
              for (let l = 0; l < lanes.length; l++) {
                if (lanes[l] <= s) {
                  assigned = l;
                  break;
                }
              }
              if (assigned === -1) {
                assigned = lanes.length;
                lanes.push(0);
              }
              lanes[assigned] = eindVan(t);
              laneInfo.set(t.id, { id: t.id, lane: assigned, cluster: c });
            }
            for (const [c, lanes] of lanesPerCluster.entries()) {
              clusterTotalLanes.set(c, lanes.length);
            }

            return dagTaken.map((taak) => {
            if (!taak.ingeplandStart) return null;

            // Skip Claude taken die onderdeel zijn van een sessie-blok (2+ overlappend/aansluitend)
            if (taak.uitvoerder === "claude") {
              const allClaude = dagTaken.filter((t) => t.uitvoerder === "claude" && t.ingeplandStart);
              if (allClaude.length >= 2) {
                const sorted = [...allClaude].sort((a, b) => new Date(a.ingeplandStart!).getTime() - new Date(b.ingeplandStart!).getTime());
                let inSessie = false;
                let group = [sorted[0]];
                for (let i = 1; i < sorted.length; i++) {
                  const prevEnd = Math.max(...group.map((t) => new Date(t.ingeplandEind || t.ingeplandStart!).getTime()));
                  const curStart = new Date(sorted[i].ingeplandStart!).getTime();
                  if (curStart - prevEnd <= 15 * 60000) {
                    group.push(sorted[i]);
                  } else {
                    if (group.length >= 2 && group.some((g) => g.id === taak.id)) inSessie = true;
                    group = [sorted[i]];
                  }
                }
                if (group.length >= 2 && group.some((g) => g.id === taak.id)) inSessie = true;
                if (inSessie) return null;
              }
            }

            const startDate = new Date(taak.ingeplandStart);
            const startMinuten = startDate.getHours() * 60 + startDate.getMinutes();
            const duurMin = taak.geschatteDuur || 60;

            const top = ((startMinuten - startUur * 60) / 60) * UUR_HOOGTE;
            const height = Math.max(28, (duurMin / 60) * UUR_HOOGTE);
            const startTijd = startDate.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
            const eindTijd = taak.ingeplandEind ? new Date(taak.ingeplandEind).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : null;

            // Claude taken = paars, handmatig = projectkleur/groen
            const kleur = taak.uitvoerder === "claude" ? "#a855f7" : (taak.kalenderKleur || "#22c55e");

            // Check of deze taak overlapt met een Claude sessie-blok
            let overlapt = false;
            if (taak.uitvoerder !== "claude") {
              const allClaude = dagTaken.filter((t) => t.uitvoerder === "claude" && t.ingeplandStart);
              if (allClaude.length >= 2) {
                const taakStart = new Date(taak.ingeplandStart).getTime();
                const taakEind = taak.ingeplandEind ? new Date(taak.ingeplandEind).getTime() : taakStart + (duurMin * 60000);
                const sessieStart = Math.min(...allClaude.map((t) => new Date(t.ingeplandStart!).getTime()));
                const sessieEind = Math.max(...allClaude.map((t) => new Date(t.ingeplandEind || t.ingeplandStart!).getTime()));
                overlapt = taakStart < sessieEind && taakEind > sessieStart;
              }
            }

            const lane = laneInfo.get(taak.id);
            const totalLanes = lane ? clusterTotalLanes.get(lane.cluster) ?? 1 : 1;

            return (
              <DraggableTaakBlock
                key={`taak-dag-${taak.id}`}
                taak={taak}
                top={top}
                height={height}
                startTijd={startTijd}
                eindTijd={eindTijd}
                kalenderKleur={kleur}
                onUnplan={onUnplanTaak}
                onToggle={onTaakToggle}
                onClick={() => onTaakDetail?.(taak.id)}
                halfRight={overlapt}
                laneIndex={lane?.lane}
                laneCount={totalLanes}
              />
            );
          });
          })()}

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
