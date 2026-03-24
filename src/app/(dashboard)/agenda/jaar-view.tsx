"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import type { AgendaItem, ExternEvent, DeadlineEvent } from "@/hooks/queries/use-agenda";

type AnyEvent = AgendaItem | ExternEvent | DeadlineEvent;

const MAANDEN = [
  "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];
const DAGEN_KORT = ["M", "D", "W", "D", "V", "Z", "Z"];

interface JaarViewProps {
  jaar: number;
  onNavigeer: (richting: -1 | 1) => void;
  items: AnyEvent[];
  onMaandClick?: (maand: number) => void;
}

function heatmapColor(t: number): { bg: string; text: string; weight: number } {
  // t = 0..1, smooth interpolation from subtle teal to vivid teal
  if (t === 0) return { bg: "transparent", text: "rgba(255,255,255,0.3)", weight: 400 };
  // Opacity: 0.15 → 0.85
  const opacity = 0.15 + t * 0.7;
  const bg = `rgba(23,184,165,${opacity.toFixed(3)})`;
  const text = t > 0.55 ? "#0E1719" : t > 0.3 ? "#0E1719" : "#4DC9B4";
  const weight = t > 0.4 ? 600 : 400;
  return { bg, text, weight };
}

export function JaarView({ jaar, onNavigeer, items, onMaandClick }: JaarViewProps) {
  const vandaag = new Date();
  const vandaagStr = vandaag.toISOString().slice(0, 10);

  const itemsPerDag = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      const dag = ("startDatum" in item ? item.startDatum : "").slice(0, 10);
      if (dag) map[dag] = (map[dag] || 0) + 1;
    }
    return map;
  }, [items]);

  const maxEvents = useMemo(() => {
    let max = 3;
    for (let m = 0; m < 12; m++) {
      const days = new Date(jaar, m + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const ds = `${jaar}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        max = Math.max(max, itemsPerDag[ds] || 0);
      }
    }
    return max;
  }, [jaar, itemsPerDag]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <button onClick={() => onNavigeer(-1)} className="p-1.5 sm:p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-autronis-text-primary tabular-nums">{jaar}</h2>
        <button onClick={() => onNavigeer(1)} className="p-1.5 sm:p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* 12 maanden grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
        {Array.from({ length: 12 }, (_, maand) => {
          const eersteDag = new Date(jaar, maand, 1);
          let startDag = eersteDag.getDay() - 1;
          if (startDag < 0) startDag = 6;
          const aantalDagen = new Date(jaar, maand + 1, 0).getDate();
          const isHuidigeMaand = vandaag.getFullYear() === jaar && vandaag.getMonth() === maand;

          let maandEvents = 0;
          for (let d = 1; d <= aantalDagen; d++) {
            const ds = `${jaar}-${String(maand + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            maandEvents += itemsPerDag[ds] || 0;
          }

          return (
            <motion.button
              key={maand}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: maand * 0.045, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
              onClick={() => onMaandClick?.(maand)}
              className={cn(
                "bg-autronis-bg/30 border rounded-xl p-2 sm:p-3 text-left transition-colors",
                isHuidigeMaand
                  ? "border-autronis-accent/30 shadow-[0_0_16px_rgba(23,184,165,0.08)]"
                  : "border-autronis-border/30 hover:border-autronis-accent/40"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cn("text-sm font-semibold", isHuidigeMaand ? "text-autronis-accent" : "text-autronis-text-primary")}>
                  {MAANDEN[maand]}
                </span>
                {maandEvents > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-autronis-accent/15 text-autronis-accent tabular-nums">
                    {maandEvents}
                  </span>
                )}
              </div>

              {/* Mini kalender */}
              <div className="grid grid-cols-7 gap-px">
                {DAGEN_KORT.map((d, i) => (
                  <div key={i} className="text-[8px] text-autronis-text-secondary/40 text-center">{d}</div>
                ))}
                {Array.from({ length: startDag }, (_, i) => (
                  <div key={`e${i}`} className="h-3.5" />
                ))}
                {Array.from({ length: aantalDagen }, (_, i) => {
                  const d = i + 1;
                  const ds = `${jaar}-${String(maand + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const eventCount = itemsPerDag[ds] || 0;
                  const isVandaag = ds === vandaagStr;
                  const t = eventCount === 0 ? 0 : Math.min(1, eventCount / maxEvents);
                  const heat = heatmapColor(t);

                  return (
                    <motion.div
                      key={d}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        delay: maand * 0.045 + i * 0.003,
                        duration: 0.25,
                      }}
                      className={cn(
                        "h-3.5 flex items-center justify-center text-[8px] rounded-sm transition-colors",
                        isVandaag && "bg-autronis-accent text-autronis-bg font-bold ring-1 ring-autronis-accent/60",
                        !isVandaag && eventCount === 0 && "text-autronis-text-secondary/40"
                      )}
                      style={!isVandaag && eventCount > 0 ? {
                        backgroundColor: heat.bg,
                        color: heat.text,
                        fontWeight: heat.weight,
                      } : undefined}
                      title={eventCount > 0 ? `${eventCount} event${eventCount !== 1 ? "s" : ""}` : undefined}
                    >
                      {d}
                    </motion.div>
                  );
                })}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
