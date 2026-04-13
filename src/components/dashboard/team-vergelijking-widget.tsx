"use client";

import { motion } from "framer-motion";
import { Briefcase, CheckCircle2, Clock, Euro, Users } from "lucide-react";
import { useVergelijk } from "@/hooks/queries/use-analytics";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const formatBedrag = (n: number) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Team vergelijking widget — Sem vs Syb side-by-side voor deze maand.
 * Self-contained variant van de Analytics versie zodat 'ie op home werkt.
 */
export function TeamVergelijkingWidget() {
  const { data: gebruikers, isLoading } = useVergelijk();

  if (isLoading) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Users className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-autronis-text-primary">Team vergelijking</h2>
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!gebruikers || gebruikers.length < 2) return null;

  const metrics = [
    { label: "Uren", key: "urenDezeMaand" as const, format: (v: number) => `${Math.round(v)}u`, icon: Clock },
    { label: "Omzet", key: "omzetDezeMaand" as const, format: (v: number) => formatBedrag(v), icon: Euro },
    { label: "Taken afgerond", key: "takenAfgerond" as const, format: (v: number) => String(v), icon: CheckCircle2 },
    { label: "Actieve projecten", key: "actieveProjecten" as const, format: (v: number) => String(v), icon: Briefcase },
  ];

  const [a, b] = gebruikers.slice(0, 2);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <Users className="w-4 h-4 text-purple-400" />
        <h2 className="text-sm font-semibold text-autronis-text-primary">Team vergelijking</h2>
        <span className="text-[11px] text-autronis-text-secondary ml-auto">deze maand</span>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center pb-2 border-b border-autronis-border">
          <span className="text-xs font-semibold text-autronis-text-primary truncate">{a.naam.split(" ")[0]}</span>
          <span className="text-[10px] text-autronis-text-secondary self-center">vs</span>
          <span className="text-xs font-semibold text-autronis-text-primary truncate">{b.naam.split(" ")[0]}</span>
        </div>

        {metrics.map((m) => {
          const valA = a[m.key];
          const valB = b[m.key];
          const maxVal = Math.max(valA, valB, 1);
          const Icon = m.icon;
          return (
            <div key={m.key} className="space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-autronis-text-secondary">
                <Icon className="w-3 h-3" />
                <span>{m.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1.5 justify-end min-w-0">
                  <span
                    className={cn(
                      "text-[11px] font-medium tabular-nums text-right shrink-0",
                      valA >= valB ? "text-autronis-accent" : "text-autronis-text-secondary"
                    )}
                  >
                    {m.format(valA)}
                  </span>
                  <div className="flex-1 h-1.5 bg-autronis-bg rounded-full overflow-hidden flex justify-end">
                    <motion.div
                      className={cn("h-full rounded-full", valA >= valB ? "bg-autronis-accent" : "bg-autronis-accent/30")}
                      initial={{ width: "0%" }}
                      animate={{ width: `${(valA / maxVal) * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <div className="w-px h-3 bg-autronis-border shrink-0" />
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <div className="flex-1 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full", valB >= valA ? "bg-purple-400" : "bg-purple-400/30")}
                      initial={{ width: "0%" }}
                      animate={{ width: `${(valB / maxVal) * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium tabular-nums shrink-0",
                      valB >= valA ? "text-purple-400" : "text-autronis-text-secondary"
                    )}
                  >
                    {m.format(valB)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
