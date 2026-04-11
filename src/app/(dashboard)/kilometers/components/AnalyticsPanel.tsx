"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { JaaroverzichtData } from "@/hooks/queries/use-kilometers";

interface AnalyticsPanelProps {
  data: JaaroverzichtData;
}

const DOEL_LABELS: Record<string, string> = {
  klantbezoek: "Klantbezoek",
  meeting: "Meeting",
  inkoop: "Inkoop",
  netwerk: "Netwerk",
  training: "Training",
  boekhouder: "Boekhouder",
  overig: "Overig",
};

const DOEL_COLORS: Record<string, string> = {
  klantbezoek: "#17B8A5",
  meeting: "#4DC9B4",
  training: "#0d8a7a",
  overig: "#2A3538",
  inkoop: "#fbbf24",
  netwerk: "#8b5cf6",
  boekhouder: "#f87171",
};

const FALLBACK_COLOR = "#2A3538";

export function AnalyticsPanel({ data }: AnalyticsPanelProps) {
  const [open, setOpen] = useState(false);

  const perDoelType = data.perDoelType ?? [];
  const totaalKm = perDoelType.reduce((sum, d) => sum + d.km, 0);

  // Build donut segments
  const size = 140;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = circumference / 4; // start at top
  const segments = perDoelType
    .filter((d) => d.km > 0)
    .map((d) => {
      const fraction = totaalKm > 0 ? d.km / totaalKm : 0;
      const arc = fraction * circumference;
      const color = DOEL_COLORS[d.type ?? "overig"] ?? FALLBACK_COLOR;
      const seg = { ...d, fraction, arc, color, dashOffset: offset };
      offset -= arc;
      return seg;
    });

  // Top 5 klanten for bar chart
  const topKlanten = [...(data.perKlant ?? [])]
    .sort((a, b) => b.km - a.km)
    .slice(0, 5);
  const maxKm = topKlanten[0]?.km ?? 1;

  return (
    <div className="border border-autronis-border rounded-2xl bg-autronis-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <span className="text-sm font-semibold text-autronis-text-primary">Analytics</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-autronis-text-secondary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-autronis-text-secondary" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="analytics-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-5 space-y-6 border-t border-autronis-border pt-4">
              {/* Donut chart — km per doeltype */}
              {perDoelType.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wider mb-4">
                    Km per doeltype
                  </h3>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* SVG donut */}
                    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
                      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                        {/* Background */}
                        <circle
                          cx={size / 2}
                          cy={size / 2}
                          r={radius}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={strokeWidth}
                          className="text-white/5"
                        />
                        {segments.map((seg, i) => (
                          <circle
                            key={i}
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${seg.arc - 2} ${circumference - seg.arc + 2}`}
                            strokeDashoffset={seg.dashOffset}
                          />
                        ))}
                      </svg>
                      {/* Center */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-bold text-autronis-text-primary">
                          {Math.round(totaalKm).toLocaleString("nl-NL")}
                        </span>
                        <span className="text-[10px] text-autronis-text-secondary">km totaal</span>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex-1 space-y-2 w-full">
                      {segments.map((seg, i) => {
                        const label = DOEL_LABELS[seg.type ?? "overig"] ?? seg.type ?? "Overig";
                        const pct = Math.round(seg.fraction * 100);
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: seg.color }}
                            />
                            <span className="text-xs text-autronis-text-secondary flex-1 truncate">{label}</span>
                            <span className="text-xs font-semibold text-autronis-text-primary">
                              {Math.round(seg.km).toLocaleString("nl-NL")} km
                            </span>
                            <span className="text-xs text-autronis-text-secondary w-8 text-right">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Horizontal bar chart — top klanten */}
              {topKlanten.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wider mb-4">
                    Top klanten
                  </h3>
                  <div className="space-y-3">
                    {topKlanten.map((k, i) => {
                      const barWidth = maxKm > 0 ? (k.km / maxKm) * 100 : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-autronis-text-secondary truncate max-w-[60%]">
                              {k.klantNaam}
                            </span>
                            <span className="text-xs font-semibold text-autronis-text-primary">
                              {Math.round(k.km).toLocaleString("nl-NL")} km
                            </span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: "#17B8A5",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {perDoelType.length === 0 && topKlanten.length === 0 && (
                <p className="text-sm text-autronis-text-secondary text-center py-4">
                  Geen data beschikbaar voor dit jaar.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
