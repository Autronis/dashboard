"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, Users, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectEigenaar } from "@/hooks/queries/use-projecten";

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
