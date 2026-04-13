"use client";

import { motion } from "framer-motion";
import { Euro, Clock, Target } from "lucide-react";
import { useDecisionEngine } from "@/hooks/queries/use-analytics";
import { useBelasting } from "@/hooks/queries/use-belasting";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const formatBedrag = (n: number) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

function doelKleurClass(pct: number): { bar: string; pctText: string } {
  if (pct >= 75) return { bar: "bg-emerald-500", pctText: "text-emerald-400" };
  if (pct >= 50) return { bar: "bg-amber-500", pctText: "text-amber-400" };
  return { bar: "bg-red-500", pctText: "text-red-400" };
}

interface Doel {
  label: string;
  icon: typeof Clock;
  pct: number;
  huidig: string;
  actie: string;
}

/**
 * Doelen widget — "wat is er nodig" snel-overzicht voor de home page.
 *
 * Drie doelen:
 * 1. Omzet (deze maand) — uit decision-engine actionableGoals[0]
 * 2. Uren-criterium (dit jaar, 1225u) — uit /api/belasting/uren-criterium
 *    Vervangt het maandelijkse uren-doel uit decision-engine.
 * 3. Jaardoel (omzet) — uit decision-engine actionableGoals[2]
 */
export function DoelenWidget() {
  const { data: decision, isLoading: decLoading } = useDecisionEngine();
  const huidigJaar = new Date().getFullYear();
  const { data: belasting, isLoading: belLoading } = useBelasting(huidigJaar);

  const isLoading = decLoading || belLoading;

  if (isLoading) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Target className="w-4 h-4 text-autronis-accent" />
          <h2 className="text-sm font-semibold text-autronis-text-primary">Doelen</h2>
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const goals = decision?.actionableGoals ?? [];
  const omzetGoal = goals.find((g) => g.doel.toLowerCase() === "omzet") ?? goals[0];
  const jaarGoal = goals.find((g) => g.doel.toLowerCase().includes("jaar")) ?? goals[2];

  const uren = belasting?.urenCriterium;
  const urenPct = uren?.voortgangPercentage ?? 0;
  const urenBehaald = uren?.behaaldUren ?? 0;
  const urenDoel = uren?.doelUren ?? 1225;
  const urenResterend = Math.max(0, urenDoel - urenBehaald);

  // Calc uren per werkdag tot eind jaar (5 werkdagen/week)
  const eindJaar = new Date(huidigJaar, 11, 31);
  const nu = new Date();
  const dagenTotEindJaar = Math.max(1, Math.ceil((eindJaar.getTime() - nu.getTime()) / (1000 * 60 * 60 * 24)));
  const werkdagenResterend = Math.max(1, Math.round((dagenTotEindJaar / 7) * 5));
  const urenPerWerkdag = urenResterend / werkdagenResterend;

  const doelen: Doel[] = [
    omzetGoal
      ? {
          label: "Omzet",
          icon: Euro,
          pct: Math.min(omzetGoal.percentage, 100),
          huidig: `${formatBedrag(omzetGoal.huidig)} / ${formatBedrag(omzetGoal.target)}`,
          actie: omzetGoal.actie,
        }
      : null,
    {
      label: "Uren-criterium",
      icon: Clock,
      pct: Math.min(urenPct, 100),
      huidig: `${urenBehaald.toFixed(0)}u / ${urenDoel}u`,
      actie:
        uren?.voldoet
          ? "Doel behaald ✓"
          : `Nog ${urenResterend.toFixed(0)}u — ${urenPerWerkdag.toFixed(1)}u/werkdag`,
    },
    jaarGoal
      ? {
          label: "Jaardoel",
          icon: Target,
          pct: Math.min(jaarGoal.percentage, 100),
          huidig: `${formatBedrag(jaarGoal.huidig)} / ${formatBedrag(jaarGoal.target)}`,
          actie: jaarGoal.actie,
        }
      : null,
  ].filter((d): d is Doel => d !== null);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <Target className="w-4 h-4 text-autronis-accent" />
        <h2 className="text-sm font-semibold text-autronis-text-primary">Doelen</h2>
        <span className="text-[11px] text-autronis-text-secondary ml-auto">wat is er nodig</span>
      </div>

      <div className="space-y-3">
        {doelen.map((d) => {
          const Icon = d.icon;
          const kleuren = doelKleurClass(d.pct);
          return (
            <div key={d.label} className="space-y-1">
              <div className="flex items-center gap-2">
                <Icon className="w-3 h-3 text-autronis-text-secondary flex-shrink-0" />
                <span className="text-xs font-medium text-autronis-text-primary flex-1 truncate">{d.label}</span>
                <span className={cn("text-xs font-bold tabular-nums", kleuren.pctText)}>{Math.round(d.pct)}%</span>
              </div>
              <div className="h-1.5 w-full bg-autronis-bg rounded-full overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", kleuren.bar)}
                  initial={{ width: "0%" }}
                  animate={{ width: `${d.pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-autronis-text-secondary tabular-nums truncate">{d.huidig}</span>
                <span className="text-autronis-accent font-medium truncate text-right">{d.actie}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
