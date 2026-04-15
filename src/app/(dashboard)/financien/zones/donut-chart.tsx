"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface DonutChartProps {
  data: { categorie: string; totaal: number; percentage: number }[];
  totaal: number;
  onCategorieClick?: (categorie: string) => void;
  onCategorieHover?: (categorie: string | null) => void;
  activeCategorie?: string | null;
}

// Color palette — Autronis accent variations
const COLORS = [
  "#17B8A5", "#4DC9B4", "#10B981", "#34D399",
  "#FBBF24", "#F59E0B", "#FB923C", "#F97316",
  "#EF4444", "#EC4899", "#8B5CF6", "#6366F1",
];

export function DonutChart({
  data,
  totaal,
  onCategorieClick,
  onCategorieHover,
  activeCategorie,
}: DonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 85;
  const innerRadius = 55;

  if (!data || data.length === 0 || totaal === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-autronis-text-secondary text-sm">
        Geen data
      </div>
    );
  }

  // Calculate arc paths
  let accumulated = 0;
  const arcs = data.map((item, idx) => {
    const startAngle = (accumulated / totaal) * 2 * Math.PI - Math.PI / 2;
    accumulated += item.totaal;
    const endAngle = (accumulated / totaal) * 2 * Math.PI - Math.PI / 2;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const x1i = cx + innerRadius * Math.cos(endAngle);
    const y1i = cy + innerRadius * Math.sin(endAngle);
    const x2i = cx + innerRadius * Math.cos(startAngle);
    const y2i = cy + innerRadius * Math.sin(startAngle);

    const d = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x1i} ${y1i}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x2i} ${y2i}`,
      "Z",
    ].join(" ");

    return { path: d, color: COLORS[idx % COLORS.length], item };
  });

  const active = hoveredIdx !== null
    ? arcs[hoveredIdx]?.item
    : activeCategorie
      ? arcs.find((a) => a.item.categorie === activeCategorie)?.item
      : null;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="overflow-visible">
        {arcs.map((arc, idx) => {
          const isActive = hoveredIdx === idx || activeCategorie === arc.item.categorie;
          return (
            <path
              key={idx}
              d={arc.path}
              fill={arc.color}
              opacity={hoveredIdx !== null && hoveredIdx !== idx ? 0.35 : 1}
              stroke="#0E1719"
              strokeWidth="1.5"
              className={cn("cursor-pointer transition-all duration-150", isActive && "brightness-110")}
              style={{ transformOrigin: `${cx}px ${cy}px`, transform: isActive ? "scale(1.03)" : "scale(1)" }}
              onMouseEnter={() => { setHoveredIdx(idx); onCategorieHover?.(arc.item.categorie); }}
              onMouseLeave={() => { setHoveredIdx(null); onCategorieHover?.(null); }}
              onClick={() => onCategorieClick?.(arc.item.categorie)}
            />
          );
        })}
        {/* Center text */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-autronis-text-secondary text-[10px] uppercase tracking-wide">
          {active ? "Categorie" : "Totaal"}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-autronis-text-primary text-xl font-bold tabular-nums">
          {active
            ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(active.totaal)
            : new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totaal)}
        </text>
        {active && (
          <text x={cx} y={cy + 30} textAnchor="middle" className="fill-autronis-text-secondary text-[10px] capitalize">
            {active.categorie}
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="mt-4 w-full space-y-1.5 max-h-48 overflow-y-auto">
        {arcs.map((arc, idx) => (
          <button
            key={idx}
            onMouseEnter={() => { setHoveredIdx(idx); onCategorieHover?.(arc.item.categorie); }}
            onMouseLeave={() => { setHoveredIdx(null); onCategorieHover?.(null); }}
            onClick={() => onCategorieClick?.(arc.item.categorie)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left",
              (hoveredIdx === idx || activeCategorie === arc.item.categorie)
                ? "bg-autronis-bg/60"
                : "hover:bg-autronis-bg/40"
            )}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: arc.color }} />
            <span className="flex-1 truncate text-autronis-text-primary capitalize">{arc.item.categorie}</span>
            <span className="text-autronis-text-secondary tabular-nums text-[10px]">{arc.item.percentage}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
