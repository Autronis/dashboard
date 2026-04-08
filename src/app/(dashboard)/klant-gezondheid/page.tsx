"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  HeartPulse,
  MessageSquare,
  CreditCard,
  FolderKanban,
  Star,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  Search,
  ChevronRight,
  Download,
} from "lucide-react";
import { useKlantGezondheid } from "@/hooks/queries/use-klant-gezondheid";
import type { KlantHealthScore } from "@/hooks/queries/use-klant-gezondheid";
import { KPICard } from "@/components/ui/kpi-card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/utils";

function scoreKleur(score: number): string {
  if (score >= 80) return "#22C55E"; // success green
  if (score >= 60) return "#F97316"; // warning orange
  if (score >= 40) return "#EAB308"; // yellow
  return "#EF4444"; // danger red
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Gezond";
  if (score >= 60) return "Aandacht";
  if (score >= 40) return "Risico";
  return "Kritiek";
}

function scoreTekstKleur(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-orange-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

type FilterType = "alle" | "kritiek" | "risico" | "aandacht" | "gezond";

export default function KlantGezondheid() {
  const { data, isLoading } = useKlantGezondheid();
  const [zoek, setZoek] = useState("");
  const [filter, setFilter] = useState<FilterType>("alle");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-autronis-card rounded-xl animate-pulse border border-autronis-border" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-autronis-card rounded-xl animate-pulse border border-autronis-border" />
          ))}
        </div>
      </div>
    );
  }

  const klanten = data?.klanten ?? [];
  const kpis = data?.kpis;

  const gefilterd = klanten.filter((k) => {
    const zoekMatch =
      !zoek ||
      k.bedrijfsnaam.toLowerCase().includes(zoek.toLowerCase()) ||
      k.contactpersoon?.toLowerCase().includes(zoek.toLowerCase()) ||
      k.branche?.toLowerCase().includes(zoek.toLowerCase());

    const filterMatch =
      filter === "alle" ||
      (filter === "kritiek" && k.totaalScore < 40) ||
      (filter === "risico" && k.totaalScore >= 40 && k.totaalScore < 60) ||
      (filter === "aandacht" && k.totaalScore >= 60 && k.totaalScore < 80) ||
      (filter === "gezond" && k.totaalScore >= 80);

    return zoekMatch && filterMatch;
  });

  const filters: { key: FilterType; label: string; aantal: number; kleur: string }[] = [
    { key: "alle", label: "Alle", aantal: klanten.length, kleur: "text-autronis-accent" },
    { key: "kritiek", label: "Kritiek", aantal: kpis?.kritiek ?? 0, kleur: "text-red-400" },
    { key: "risico", label: "Risico", aantal: kpis?.risico ?? 0, kleur: "text-yellow-400" },
    { key: "aandacht", label: "Aandacht", aantal: kpis?.aandacht ?? 0, kleur: "text-orange-400" },
    { key: "gezond", label: "Gezond", aantal: kpis?.gezond ?? 0, kleur: "text-emerald-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-autronis-text-primary">
            Klant Gezondheid
          </h1>
          <p className="text-sm text-autronis-text-secondary mt-1">
            Automatisch berekende gezondheidsscores op basis van communicatie, betalingen, projecten, tevredenheid en activiteit
          </p>
        </div>
        <a
          href="/api/klant-gezondheid/export?format=csv"
          className="flex items-center gap-2 px-3 py-2 bg-autronis-card border border-autronis-border rounded-lg text-sm text-autronis-text-secondary hover:border-autronis-border-hover hover:text-autronis-accent transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </a>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard
          label="Gemiddelde score"
          value={kpis?.gemiddeldeScore ?? 0}
          icon={<HeartPulse className="w-5 h-5" />}
          color="accent"
          index={0}
        />
        <KPICard
          label="Gezond"
          value={kpis?.gezond ?? 0}
          icon={<ShieldCheck className="w-5 h-5" />}
          color="emerald"
          index={1}
        />
        <KPICard
          label="Aandacht nodig"
          value={kpis?.aandacht ?? 0}
          icon={<Activity className="w-5 h-5" />}
          color="orange"
          index={2}
        />
        <KPICard
          label="Risico"
          value={kpis?.risico ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          index={3}
        />
        <KPICard
          label="Kritiek"
          value={kpis?.kritiek ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          index={4}
        />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-autronis-text-tertiary w-4 h-4" />
          <input
            type="text"
            placeholder="Zoek op naam, contactpersoon of branche..."
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-autronis-card border border-autronis-border rounded-lg text-sm text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:ring-2 focus:ring-autronis-accent/30 focus:border-autronis-accent/50 transition-colors"
          />
        </div>
        <div className="flex gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                filter === f.key
                  ? `bg-autronis-accent/15 ${f.kleur} border border-autronis-accent/30`
                  : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-border-hover",
              )}
            >
              {f.label} ({f.aantal})
            </button>
          ))}
        </div>
      </div>

      {/* Client Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {gefilterd.map((klant, index) => (
          <KlantHealthCard key={klant.klantId} klant={klant} index={index} />
        ))}
        {gefilterd.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-autronis-text-tertiary">
            <HeartPulse className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Geen klanten gevonden</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KlantHealthCard({ klant, index }: { klant: KlantHealthScore; index: number }) {
  const kleur = scoreKleur(klant.totaalScore);

  const metricBars = [
    { label: "Communicatie", score: klant.communicatieScore, icon: <MessageSquare className="w-3 h-3" /> },
    { label: "Betalingen", score: klant.betalingScore, icon: <CreditCard className="w-3 h-3" /> },
    { label: "Projecten", score: klant.projectScore, icon: <FolderKanban className="w-3 h-3" /> },
    { label: "Tevredenheid", score: klant.tevredenheidScore, icon: <Star className="w-3 h-3" /> },
    { label: "Activiteit", score: klant.activiteitScore, icon: <Activity className="w-3 h-3" /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Link
        href={`/klanten/${klant.klantId}`}
        className="block bg-autronis-card border border-autronis-border rounded-xl p-5 card-glow hover:border-autronis-border-hover transition-colors"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-autronis-text-primary truncate">
              {klant.bedrijfsnaam}
            </h3>
            <p className="text-xs text-autronis-text-tertiary truncate">
              {klant.contactpersoon ?? klant.email ?? "Geen contact"}
            </p>
            {klant.branche && (
              <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full bg-autronis-accent/10 text-autronis-accent">
                {klant.branche}
              </span>
            )}
          </div>
          <div className="flex flex-col items-center ml-3">
            <ProgressRing percentage={klant.totaalScore} size={56} strokeWidth={5} color={kleur} />
            <div className="flex items-center gap-1 mt-1">
              <span className={cn("text-[10px] font-semibold", scoreTekstKleur(klant.totaalScore))}>
                {scoreLabel(klant.totaalScore)}
              </span>
              {klant.trend !== null && klant.trend !== 0 && (
                <span className={cn("flex items-center text-[10px]", klant.trend > 0 ? "text-emerald-400" : "text-red-400")}>
                  {klant.trend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metric Bars */}
        <div className="space-y-2">
          {metricBars.map((metric) => (
            <div key={metric.label} className="flex items-center gap-2">
              <span className="text-autronis-text-tertiary flex-shrink-0">{metric.icon}</span>
              <span className="text-[11px] text-autronis-text-secondary w-24 flex-shrink-0">{metric.label}</span>
              <div className="flex-1 h-1.5 bg-autronis-border rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${metric.score}%` }}
                  transition={{ delay: index * 0.04 + 0.3, duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: scoreKleur(metric.score) }}
                />
              </div>
              <span className={cn("text-[11px] font-medium tabular-nums w-7 text-right", scoreTekstKleur(metric.score))}>
                {metric.score}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-autronis-border">
          <span className="text-[10px] text-autronis-text-tertiary">
            {klant.klantSinds ? `Klant sinds ${klant.klantSinds.substring(0, 4)}` : ""}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-autronis-accent font-medium">
            Details <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
