"use client";

import { Euro, Clock, Target } from "lucide-react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useDecisionEngine } from "@/hooks/queries/use-analytics";
import { useBelasting } from "@/hooks/queries/use-belasting";
import { Skeleton } from "@/components/ui/skeleton";

const formatBedrag = (n: number) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

function doelKleur(pct: number): string {
  if (pct >= 75) return "#22c55e";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

interface Doel {
  label: string;
  icon: typeof Clock;
  pct: number;
  huidig: string;
  target: string;
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
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="w-[68px] h-[68px] rounded-full" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-2 w-24" />
            </div>
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
          huidig: `${formatBedrag(omzetGoal.huidig)} / ${formatBedrag(omzetGoal.target)} per maand`,
          target: "",
          actie: omzetGoal.actie,
        }
      : null,
    {
      label: "Uren-criterium",
      icon: Clock,
      pct: Math.min(urenPct, 100),
      huidig: `${urenBehaald.toFixed(0)}u / ${urenDoel}u per jaar`,
      target: "",
      actie:
        uren?.voldoet
          ? "Doel behaald ✓"
          : `Nog ${urenResterend.toFixed(0)}u nodig — ${urenPerWerkdag.toFixed(1)}u/werkdag`,
    },
    jaarGoal
      ? {
          label: "Jaardoel",
          icon: Target,
          pct: Math.min(jaarGoal.percentage, 100),
          huidig: `${formatBedrag(jaarGoal.huidig)} / ${formatBedrag(jaarGoal.target)} per jaar`,
          target: "",
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

      <div className="grid grid-cols-3 gap-4">
        {doelen.map((d) => {
          const Icon = d.icon;
          const kleur = doelKleur(d.pct);
          return (
            <div key={d.label} className="flex flex-col items-center text-center">
              <ProgressRing percentage={d.pct} size={68} strokeWidth={6} color={kleur} />
              <div className="flex items-center gap-1.5 mt-2.5">
                <Icon className="w-3 h-3 text-autronis-text-secondary" />
                <p className="text-xs font-medium text-autronis-text-primary">{d.label}</p>
              </div>
              <p className="text-[11px] text-autronis-text-secondary mt-0.5 tabular-nums leading-snug">{d.huidig}</p>
              <p className="text-[11px] text-autronis-accent mt-1 font-medium leading-snug">{d.actie}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
