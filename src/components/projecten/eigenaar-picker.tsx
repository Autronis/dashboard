"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, Users, Globe, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectEigenaar } from "@/hooks/queries/use-projecten";

const EIGENAAR_LABELS: Record<ProjectEigenaar, { label: string; bg: string; text: string }> = {
  sem: { label: "Sem", bg: "bg-teal-500/15", text: "text-teal-300" },
  syb: { label: "Syb", bg: "bg-blue-500/15", text: "text-blue-300" },
  team: { label: "Team", bg: "bg-purple-500/15", text: "text-purple-300" },
  vrij: { label: "Vrij", bg: "bg-amber-500/15", text: "text-amber-300" },
};

/**
 * Compact mini-picker (badge + dropdown) voor in lijsten/cards waar de
 * volle 4-chip variant teveel ruimte zou nemen.
 */
export function MiniEigenaarPicker({
  projectId,
  current,
}: { projectId: number; current: ProjectEigenaar | null }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [optimistic, setOptimistic] = useState<ProjectEigenaar | null>(null);
  const value = optimistic ?? current ?? "sem";
  const cfg = EIGENAAR_LABELS[value];

  const setEigenaar = async (code: ProjectEigenaar) => {
    setOpen(false);
    if (code === value) return;
    setOptimistic(code);
    try {
      const res = await fetch(`/api/projecten/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eigenaar: code }),
      });
      if (!res.ok) throw new Error("Wijziging mislukt");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projecten"] }),
        queryClient.invalidateQueries({ queryKey: ["project", String(projectId)] }),
        queryClient.invalidateQueries({ queryKey: ["taken"] }),
      ]);
    } catch (e) {
      console.error(e);
      setOptimistic(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Wijzig eigenaar"
        className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors",
          cfg.bg, cfg.text
        )}
      >
        {cfg.label}
        <ChevronDown className="w-2.5 h-2.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-autronis-card border border-autronis-border rounded-lg shadow-xl p-1 flex flex-col gap-0.5 min-w-[80px]">
            {(Object.keys(EIGENAAR_LABELS) as ProjectEigenaar[]).map((code) => {
              const opt = EIGENAAR_LABELS[code];
              const active = value === code;
              return (
                <button
                  key={code}
                  onClick={() => setEigenaar(code)}
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

interface Option {
  code: ProjectEigenaar;
  label: string;
  icon: typeof User;
  bg: string;
  ring: string;
}

const OPTIONS: Option[] = [
  { code: "sem", label: "Sem", icon: User, bg: "bg-teal-500/15 text-teal-300", ring: "ring-teal-400" },
  { code: "syb", label: "Syb", icon: User, bg: "bg-blue-500/15 text-blue-300", ring: "ring-blue-400" },
  { code: "team", label: "Team", icon: Users, bg: "bg-purple-500/15 text-purple-300", ring: "ring-purple-400" },
  { code: "vrij", label: "Vrij", icon: Globe, bg: "bg-amber-500/15 text-amber-300", ring: "ring-amber-400" },
];

interface EigenaarPickerProps {
  projectId: number;
  current: ProjectEigenaar | null;
  onChange?: (next: ProjectEigenaar) => void;
}

/** Compacte 4-chip selector voor project eigenaarschap. */
export function EigenaarPicker({ projectId, current, onChange }: EigenaarPickerProps) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<ProjectEigenaar | null>(null);
  // Optimistisch: zodra je klikt, gaat de chip meteen visueel naar de nieuwe
  // waarde. Bij fout valt 'ie terug op `current`.
  const [optimistic, setOptimistic] = useState<ProjectEigenaar | null>(null);
  const value = optimistic ?? current ?? "sem";

  const setEigenaar = async (code: ProjectEigenaar) => {
    if (code === value || pending) return;
    setPending(code);
    setOptimistic(code);
    try {
      const res = await fetch(`/api/projecten/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eigenaar: code }),
      });
      if (!res.ok) throw new Error("Wijziging mislukt");
      // Invalideer alle relevante queries zodat de nieuwe waarde overal
      // terugkomt (project detail, projectenlijst, taken).
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", String(projectId)] }),
        queryClient.invalidateQueries({ queryKey: ["projecten"] }),
        queryClient.invalidateQueries({ queryKey: ["taken"] }),
      ]);
      onChange?.(code);
    } catch (e) {
      console.error(e);
      setOptimistic(null); // rollback
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="inline-flex items-center gap-1 bg-autronis-bg/50 border border-autronis-border rounded-xl p-1">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.code;
        return (
          <button
            key={opt.code}
            onClick={() => setEigenaar(opt.code)}
            disabled={pending !== null}
            title={`Eigenaar: ${opt.label}`}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
              active ? `${opt.bg} ring-1 ${opt.ring}` : "text-autronis-text-secondary hover:text-autronis-text-primary",
              pending !== null && "opacity-50 cursor-wait"
            )}
          >
            <Icon className="w-3 h-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
