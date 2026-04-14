"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Eigenaar = "sem" | "syb" | "team" | "vrij";

const LABELS: Record<Eigenaar, { label: string; bg: string; text: string }> = {
  sem: { label: "Sem", bg: "bg-teal-500/15", text: "text-teal-300" },
  syb: { label: "Syb", bg: "bg-blue-500/15", text: "text-blue-300" },
  team: { label: "Team", bg: "bg-purple-500/15", text: "text-purple-300" },
  vrij: { label: "Vrij", bg: "bg-amber-500/15", text: "text-amber-300" },
};

/**
 * Compacte inline picker voor taak-eigenaar in de takenlijst.
 * Werkt voor zowel losse taken als taken met project (override).
 */
export function MiniTaakEigenaarPicker({
  taakId,
  current,
}: { taakId: number; current: Eigenaar | null }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [optimistic, setOptimistic] = useState<Eigenaar | null>(null);
  const value = optimistic ?? current ?? "sem";
  const cfg = LABELS[value];

  const setEigenaar = async (code: Eigenaar) => {
    setOpen(false);
    if (code === value) return;
    setOptimistic(code);
    try {
      const res = await fetch(`/api/taken/${taakId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eigenaar: code }),
      });
      if (!res.ok) throw new Error("Wijziging mislukt");
      queryClient.invalidateQueries({ queryKey: ["taken"] });
    } catch (e) {
      console.error(e);
      setOptimistic(null);
    }
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title="Wijzig eigenaar"
        className={cn(
          "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors",
          cfg.bg, cfg.text
        )}
      >
        {cfg.label}
        <ChevronDown className="w-2.5 h-2.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-autronis-card border border-autronis-border rounded-lg shadow-xl p-1 flex flex-col gap-0.5 min-w-[80px]">
            {(Object.keys(LABELS) as Eigenaar[]).map((code) => {
              const opt = LABELS[code];
              const active = value === code;
              return (
                <button
                  key={code}
                  onClick={(e) => { e.stopPropagation(); setEigenaar(code); }}
                  className={cn(
                    "px-2 py-1 rounded text-[11px] font-medium text-left transition-colors",
                    active ? `${opt.bg} ${opt.text}` : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
