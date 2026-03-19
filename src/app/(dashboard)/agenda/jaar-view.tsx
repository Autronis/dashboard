"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

export function JaarView({ jaar, onNavigeer, items, onMaandClick }: JaarViewProps) {
  const vandaag = new Date();
  const vandaagStr = vandaag.toISOString().slice(0, 10);

  // Items per dag voor het hele jaar
  const itemsPerDag = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      const dag = ("startDatum" in item ? item.startDatum : "").slice(0, 10);
      if (dag) map[dag] = (map[dag] || 0) + 1;
    }
    return map;
  }, [items]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={() => onNavigeer(-1)} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-autronis-text-primary tabular-nums">{jaar}</h2>
        <button onClick={() => onNavigeer(1)} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 12 maanden grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, maand) => {
          const eersteDag = new Date(jaar, maand, 1);
          let startDag = eersteDag.getDay() - 1;
          if (startDag < 0) startDag = 6;
          const aantalDagen = new Date(jaar, maand + 1, 0).getDate();
          const isHuidigeMaand = vandaag.getFullYear() === jaar && vandaag.getMonth() === maand;

          // Count events in this month
          let maandEvents = 0;
          for (let d = 1; d <= aantalDagen; d++) {
            const ds = `${jaar}-${String(maand + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            maandEvents += itemsPerDag[ds] || 0;
          }

          return (
            <button
              key={maand}
              onClick={() => onMaandClick?.(maand)}
              className={cn(
                "bg-autronis-bg/30 border rounded-xl p-3 text-left hover:border-autronis-accent/40 transition-colors",
                isHuidigeMaand ? "border-autronis-accent/30" : "border-autronis-border/30"
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
                {/* Dag headers */}
                {DAGEN_KORT.map((d, i) => (
                  <div key={i} className="text-[8px] text-autronis-text-secondary/40 text-center">{d}</div>
                ))}
                {/* Lege cellen */}
                {Array.from({ length: startDag }, (_, i) => (
                  <div key={`e${i}`} className="h-3.5" />
                ))}
                {/* Dagen */}
                {Array.from({ length: aantalDagen }, (_, i) => {
                  const d = i + 1;
                  const ds = `${jaar}-${String(maand + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const eventCount = itemsPerDag[ds] || 0;
                  const isVandaag = ds === vandaagStr;

                  // Heatmap intensiteit: 1=licht, 2=medium, 3+=donker
                  const heatOpacity = eventCount === 0 ? 0 : eventCount === 1 ? 0.2 : eventCount === 2 ? 0.35 : eventCount <= 4 ? 0.5 : 0.7;

                  return (
                    <div
                      key={d}
                      className={cn(
                        "h-3.5 flex items-center justify-center text-[8px] rounded-sm",
                        isVandaag && "bg-autronis-accent text-autronis-bg font-bold",
                        !isVandaag && eventCount === 0 && "text-autronis-text-secondary/50"
                      )}
                      style={!isVandaag && eventCount > 0 ? {
                        backgroundColor: `rgba(23,184,165,${heatOpacity})`,
                        color: heatOpacity >= 0.5 ? "#0E1719" : "#4DC9B4",
                        fontWeight: heatOpacity >= 0.35 ? 600 : 400,
                      } : undefined}
                      title={eventCount > 0 ? `${eventCount} event${eventCount !== 1 ? "s" : ""}` : undefined}
                    >
                      {d}
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
