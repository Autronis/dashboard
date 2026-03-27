"use client";

import { useState, useRef, useEffect } from "react";
import { Settings2 } from "lucide-react";
import { cn, formatBedrag } from "@/lib/utils";
import { useAutoInstellingen, useUpdateAutoInstellingen } from "@/hooks/queries/use-kilometers";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface DonutChartProps {
  totaalKm: number;         // total km from km-stand or trips
  zakelijkeKm: number;      // registered business km
  tariefPerKm?: number;
}

export function DonutChart({ totaalKm, zakelijkeKm, tariefPerKm: propTarief }: DonutChartProps) {
  const { addToast } = useToast();
  const { data: instData } = useAutoInstellingen();
  const updateMutation = useUpdateAutoInstellingen();
  const [showSettings, setShowSettings] = useState(false);
  const [percentage, setPercentage] = useState(75);
  const settingsRef = useRef<HTMLDivElement>(null);

  const zakelijkPercentage = instData?.instellingen?.zakelijkPercentage ?? 75;
  const tarief = propTarief ?? instData?.instellingen?.tariefPerKm ?? 0.23;

  useEffect(() => {
    setPercentage(zakelijkPercentage);
  }, [zakelijkPercentage]);

  // Close settings on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    if (showSettings) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSettings]);

  const zakelijkKmBerekend = totaalKm > 0 ? totaalKm * (zakelijkPercentage / 100) : zakelijkeKm;
  const priveKm = totaalKm > 0 ? totaalKm - zakelijkKmBerekend : 0;
  const aftrekbaar = zakelijkKmBerekend * tarief;

  // SVG donut
  const size = 120;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const zakelijkArc = totaalKm > 0 ? (zakelijkPercentage / 100) * circumference : zakelijkeKm > 0 ? circumference : 0;

  async function handleSavePercentage() {
    try {
      await updateMutation.mutateAsync({ zakelijkPercentage: percentage });
      addToast("Zakelijk percentage bijgewerkt", "succes");
      setShowSettings(false);
    } catch {
      addToast("Kon percentage niet opslaan", "fout");
    }
  }

  return (
    <div className="border border-autronis-border rounded-2xl p-5 bg-autronis-card relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wider">Privé / Zakelijk</span>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 rounded-lg hover:bg-white/5 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Settings popover */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            ref={settingsRef}
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            className="absolute top-14 right-4 z-20 bg-autronis-card border border-autronis-border rounded-xl p-4 shadow-xl min-w-[220px]"
          >
            <label className="block text-xs text-autronis-text-secondary mb-2">Zakelijk percentage</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={percentage}
                onChange={(e) => setPercentage(Number(e.target.value))}
                className="flex-1 accent-autronis-accent"
              />
              <span className="text-sm font-semibold text-autronis-text-primary w-10 text-right">{percentage}%</span>
            </div>
            <button
              onClick={handleSavePercentage}
              disabled={updateMutation.isPending}
              className="mt-3 w-full px-3 py-1.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-lg text-xs font-medium transition-colors"
            >
              Opslaan
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-5">
        {/* SVG Donut */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-white/5"
            />
            {/* Zakelijk arc */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#17B8A5"
              strokeWidth={strokeWidth}
              strokeDasharray={`${zakelijkArc} ${circumference - zakelijkArc}`}
              strokeDashoffset={circumference / 4}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-autronis-text-primary">{zakelijkPercentage}%</span>
            <span className="text-[10px] text-autronis-text-secondary">zakelijk</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          <div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-autronis-accent" />
              <span className="text-xs text-autronis-text-secondary">Zakelijk</span>
            </div>
            <div className="text-sm font-semibold text-autronis-text-primary">
              {Math.round(zakelijkKmBerekend).toLocaleString("nl-NL")} km
            </div>
            <div className="text-xs text-autronis-accent">{formatBedrag(aftrekbaar)} aftrekbaar</div>
          </div>
          {totaalKm > 0 && (
            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-white/10" />
                <span className="text-xs text-autronis-text-secondary">Privé</span>
              </div>
              <div className="text-sm font-semibold text-autronis-text-primary">
                {Math.round(priveKm).toLocaleString("nl-NL")} km
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
