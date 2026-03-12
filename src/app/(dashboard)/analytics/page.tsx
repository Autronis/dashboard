"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Euro,
  Clock,
  TrendingUp,
  Users,
  BarChart3,
  PieChart,
  Target,
  Flame,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatBedrag } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton, SkeletonKPI } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import { ProgressRing } from "@/components/ui/progress-ring";

interface MaandData {
  maand: string;
  label: string;
  omzet: number;
  uren: number;
}

interface ProjectData {
  projectNaam: string;
  klantNaam: string;
  uren: number;
  omzet: number;
}

interface GebruikerData {
  naam: string;
  uren: number;
  omzet: number;
}

interface AnalyticsData {
  kpis: {
    omzetDitJaar: number;
    omzetVorigJaar: number;
    urenDitJaar: number;
    gemiddeldUurtarief: number;
    actieveKlanten: number;
  };
  maanden: MaandData[];
  topProjecten: ProjectData[];
  perGebruiker: GebruikerData[];
}

interface HeatmapItem {
  datum: string;
  uren: number;
}

interface VergelijkGebruiker {
  id: number;
  naam: string;
  urenDezeMaand: number;
  omzetDezeMaand: number;
  takenAfgerond: number;
  actieveProjecten: number;
}

// --- Skeleton for analytics loading state ---
function AnalyticsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
      </div>
      {/* Charts */}
      <Skeleton className="h-72 w-full rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

// --- Animated bar component ---
function AnimatedBar({
  hoogte,
  index,
  className,
  maxWidth = "40px",
}: {
  hoogte: number;
  index: number;
  className: string;
  maxWidth?: string;
}) {
  return (
    <motion.div
      className={cn("w-full rounded-t-lg", className)}
      style={{ maxWidth }}
      initial={{ height: "0%" }}
      animate={{ height: `${Math.max(hoogte, 2)}%` }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: "easeOut" }}
    />
  );
}

// --- Doelen (goals) section ---
function DoelenSectie({
  urenDezeMaand,
  omzetDezeMaand,
}: {
  urenDezeMaand: number;
  omzetDezeMaand: number;
}) {
  const OMZET_DOEL = 10000;
  const UREN_DOEL = 160;

  const omzetPercentage = OMZET_DOEL > 0 ? (omzetDezeMaand / OMZET_DOEL) * 100 : 0;
  const urenPercentage = UREN_DOEL > 0 ? (urenDezeMaand / UREN_DOEL) * 100 : 0;

  function doelKleur(pct: number): string {
    if (pct >= 75) return "#22c55e";
    if (pct >= 50) return "#f59e0b";
    return "#ef4444";
  }

  const omzetResterend = Math.max(OMZET_DOEL - omzetDezeMaand, 0);
  const urenResterend = Math.max(UREN_DOEL - urenDezeMaand, 0);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-6">
        <Target className="w-5 h-5 text-autronis-accent" />
        <h2 className="text-lg font-semibold text-autronis-text-primary">Mijn doelen</h2>
        <span className="text-xs text-autronis-text-secondary ml-auto">deze maand</span>
      </div>
      <div className="grid grid-cols-2 gap-8">
        {/* Omzet doel */}
        <div className="flex flex-col items-center text-center">
          <ProgressRing
            percentage={Math.min(omzetPercentage, 100)}
            size={110}
            strokeWidth={8}
            color={doelKleur(omzetPercentage)}
          />
          <p className="text-sm font-medium text-autronis-text-primary mt-3">Omzet</p>
          <p className="text-xs text-autronis-text-secondary mt-1 tabular-nums">
            {formatBedrag(omzetDezeMaand)} / {formatBedrag(OMZET_DOEL)}
          </p>
          <p className="text-xs text-autronis-text-secondary mt-0.5 tabular-nums">
            {omzetResterend > 0
              ? `Nog ${formatBedrag(omzetResterend)} te gaan`
              : "Doel behaald!"}
          </p>
        </div>
        {/* Uren doel */}
        <div className="flex flex-col items-center text-center">
          <ProgressRing
            percentage={Math.min(urenPercentage, 100)}
            size={110}
            strokeWidth={8}
            color={doelKleur(urenPercentage)}
          />
          <p className="text-sm font-medium text-autronis-text-primary mt-3">Uren</p>
          <p className="text-xs text-autronis-text-secondary mt-1 tabular-nums">
            {Math.round(urenDezeMaand)}u / {UREN_DOEL}u
          </p>
          <p className="text-xs text-autronis-text-secondary mt-0.5 tabular-nums">
            {urenResterend > 0
              ? `Nog ${Math.round(urenResterend)} uur te gaan`
              : "Doel behaald!"}
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Team vergelijking section ---
function TeamVergelijking({ gebruikers }: { gebruikers: VergelijkGebruiker[] }) {
  if (gebruikers.length < 2) return null;

  const metrics: {
    label: string;
    key: keyof Pick<VergelijkGebruiker, "urenDezeMaand" | "omzetDezeMaand" | "takenAfgerond" | "actieveProjecten">;
    format: (v: number) => string;
  }[] = [
    { label: "Uren", key: "urenDezeMaand", format: (v) => `${Math.round(v)}u` },
    { label: "Omzet", key: "omzetDezeMaand", format: (v) => formatBedrag(v) },
    { label: "Taken afgerond", key: "takenAfgerond", format: (v) => String(v) },
    { label: "Actieve projecten", key: "actieveProjecten", format: (v) => String(v) },
  ];

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-autronis-text-primary">Team vergelijking</h2>
        <span className="text-xs text-autronis-text-secondary ml-auto">deze maand</span>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {gebruikers.slice(0, 2).map((g) => (
          <div key={g.id} className="space-y-4">
            <p className="text-sm font-semibold text-autronis-text-primary text-center">{g.naam}</p>
            {metrics.map((m) => {
              const val = g[m.key];
              const maxVal = Math.max(...gebruikers.slice(0, 2).map((u) => u[m.key]), 1);
              const pct = (val / maxVal) * 100;
              const isHighest = val >= Math.max(...gebruikers.slice(0, 2).map((u) => u[m.key]));
              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-autronis-text-secondary">{m.label}</span>
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        isHighest ? "text-autronis-accent" : "text-autronis-text-secondary"
                      )}
                    >
                      {m.format(val)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-autronis-bg rounded-full overflow-hidden">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        isHighest ? "bg-autronis-accent" : "bg-autronis-accent/30"
                      )}
                      initial={{ width: "0%" }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main page ---
export default function AnalyticsPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapItem[]>([]);
  const [vergelijkData, setVergelijkData] = useState<VergelijkGebruiker[]>([]);
  const [loading, setLoading] = useState(true);
  const [jaar, setJaar] = useState(new Date().getFullYear());

  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, heatmapRes, vergelijkRes] = await Promise.all([
        fetch(`/api/analytics?jaar=${jaar}`),
        fetch("/api/analytics/heatmap"),
        fetch("/api/analytics/vergelijk"),
      ]);

      if (!analyticsRes.ok) throw new Error("Analytics laden mislukt");
      const analyticsJson = await analyticsRes.json() as AnalyticsData;
      setData(analyticsJson);

      if (heatmapRes.ok) {
        const heatmapJson = await heatmapRes.json() as { data: HeatmapItem[] };
        setHeatmapData(heatmapJson.data || []);
      }

      if (vergelijkRes.ok) {
        const vergelijkJson = await vergelijkRes.json() as { gebruikers: VergelijkGebruiker[] };
        setVergelijkData(vergelijkJson.gebruikers || []);
      }
    } catch {
      addToast("Kon analytics niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [jaar, addToast]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return <AnalyticsSkeleton />;
  }

  const maxOmzet = Math.max(...data.maanden.map((m) => m.omzet), 1);
  const maxUren = Math.max(...data.maanden.map((m) => m.uren), 1);
  const topProjectMax = Math.max(...data.topProjecten.map((p) => p.uren), 1);

  const omzetGroei =
    data.kpis.omzetVorigJaar > 0
      ? ((data.kpis.omzetDitJaar - data.kpis.omzetVorigJaar) / data.kpis.omzetVorigJaar) * 100
      : 0;

  // Current month data for goals
  const huidigeMaandStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const huidigeMaandData = data.maanden.find((m) => m.maand === huidigeMaandStr);
  const urenDezeMaand = huidigeMaandData?.uren || 0;
  const omzetDezeMaand = huidigeMaandData?.omzet || 0;

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">Analytics</h1>
            <p className="text-base text-autronis-text-secondary mt-1">
              Inzichten in omzet, uren en prestaties
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setJaar(jaar - 1)}
              className="px-3 py-1.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary bg-autronis-card border border-autronis-border rounded-lg transition-colors"
            >
              {jaar - 1}
            </button>
            <span className="px-4 py-1.5 text-sm font-bold text-autronis-bg bg-autronis-accent rounded-lg">
              {jaar}
            </span>
            <button
              onClick={() => setJaar(jaar + 1)}
              disabled={jaar >= new Date().getFullYear()}
              className="px-3 py-1.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary bg-autronis-card border border-autronis-border rounded-lg transition-colors disabled:opacity-30"
            >
              {jaar + 1}
            </button>
          </div>
        </div>

        {/* KPI balk with gradients */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
          <div className="bg-gradient-to-br from-autronis-accent/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
            <div className="p-2.5 bg-autronis-accent/10 rounded-xl w-fit mb-3">
              <Euro className="w-5 h-5 text-autronis-accent" />
            </div>
            <p className="text-2xl font-bold text-autronis-accent tabular-nums">
              <AnimatedNumber value={data.kpis.omzetDitJaar} format={(n) => formatBedrag(n)} />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1 uppercase tracking-wide">Omzet {jaar}</p>
          </div>

          <div
            className={cn(
              "border border-autronis-border rounded-2xl p-6 card-glow",
              omzetGroei >= 0
                ? "bg-gradient-to-br from-green-500/10 to-autronis-card"
                : "bg-gradient-to-br from-red-500/10 to-autronis-card"
            )}
          >
            <div className={cn("p-2.5 rounded-xl w-fit mb-3", omzetGroei >= 0 ? "bg-green-500/10" : "bg-red-500/10")}>
              <TrendingUp className={cn("w-5 h-5", omzetGroei >= 0 ? "text-green-400" : "text-red-400")} />
            </div>
            <p className={cn("text-2xl font-bold tabular-nums", omzetGroei >= 0 ? "text-green-400" : "text-red-400")}>
              <AnimatedNumber
                value={omzetGroei}
                format={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`}
              />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1 uppercase tracking-wide">vs {jaar - 1}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
            <div className="p-2.5 bg-blue-500/10 rounded-xl w-fit mb-3">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-400 tabular-nums">
              <AnimatedNumber value={data.kpis.urenDitJaar} format={(n) => `${Math.round(n)}u`} />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1 uppercase tracking-wide">Uren {jaar}</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
            <div className="p-2.5 bg-yellow-500/10 rounded-xl w-fit mb-3">
              <Euro className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-yellow-400 tabular-nums">
              <AnimatedNumber
                value={data.kpis.gemiddeldUurtarief}
                format={(n) => `${formatBedrag(n)}/u`}
              />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1 uppercase tracking-wide">Gem. tarief</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
            <div className="p-2.5 bg-purple-500/10 rounded-xl w-fit mb-3">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-purple-400 tabular-nums">
              <AnimatedNumber value={data.kpis.actieveKlanten} />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1 uppercase tracking-wide">Actieve klanten</p>
          </div>
        </div>

        {/* Omzet chart */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-autronis-accent" />
            <h2 className="text-lg font-semibold text-autronis-text-primary">Omzet per maand</h2>
          </div>
          <div className="flex items-end gap-2 h-56">
            {data.maanden.map((m, i) => {
              const hoogte = maxOmzet > 0 ? (m.omzet / maxOmzet) * 100 : 0;
              const isHuidig =
                m.maand ===
                `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
              return (
                <div key={m.maand} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="relative w-full flex justify-center h-full items-end">
                    <div className="absolute -top-7 text-xs text-autronis-text-secondary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap tabular-nums">
                      {formatBedrag(m.omzet)}
                    </div>
                    <AnimatedBar
                      hoogte={hoogte}
                      index={i}
                      className={cn(
                        "transition-colors",
                        isHuidig ? "bg-autronis-accent" : "bg-autronis-accent/40",
                        "group-hover:bg-autronis-accent"
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-xs flex-shrink-0",
                      isHuidig ? "text-autronis-accent font-semibold" : "text-autronis-text-secondary"
                    )}
                  >
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Uren chart */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-autronis-text-primary">Uren per maand</h2>
            </div>
            <div className="flex items-end gap-2 h-40">
              {data.maanden.map((m, i) => {
                const hoogte = maxUren > 0 ? (m.uren / maxUren) * 100 : 0;
                return (
                  <div key={m.maand} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="relative w-full flex justify-center h-full items-end">
                      <div className="absolute -top-7 text-xs text-autronis-text-secondary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap tabular-nums">
                        {Math.round(m.uren)}u
                      </div>
                      <AnimatedBar
                        hoogte={hoogte}
                        index={i}
                        className="bg-blue-500/40 group-hover:bg-blue-400 transition-colors"
                        maxWidth="32px"
                      />
                    </div>
                    <span className="text-[10px] text-autronis-text-secondary flex-shrink-0">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per medewerker */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
            <div className="flex items-center gap-3 mb-6">
              <PieChart className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-autronis-text-primary">Per medewerker</h2>
            </div>
            {data.perGebruiker.length === 0 ? (
              <p className="text-sm text-autronis-text-secondary">Geen data beschikbaar.</p>
            ) : (
              <div className="space-y-5">
                {data.perGebruiker.map((g, i) => {
                  const totaalUren = data.perGebruiker.reduce((s, x) => s + x.uren, 0);
                  const percentage = totaalUren > 0 ? (g.uren / totaalUren) * 100 : 0;
                  const kleuren = ["bg-autronis-accent", "bg-blue-400", "bg-purple-400", "bg-yellow-400"];
                  return (
                    <div key={g.naam}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-autronis-text-primary">{g.naam}</span>
                        <div className="flex items-center gap-4 text-sm text-autronis-text-secondary tabular-nums">
                          <span>{Math.round(g.uren)}u</span>
                          <span>{formatBedrag(g.omzet)}</span>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-autronis-bg rounded-full overflow-hidden">
                        <motion.div
                          className={cn("h-full rounded-full", kleuren[i % kleuren.length])}
                          initial={{ width: "0%" }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top projecten */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
          <h2 className="text-lg font-semibold text-autronis-text-primary mb-6">Top projecten</h2>
          {data.topProjecten.length === 0 ? (
            <p className="text-sm text-autronis-text-secondary">Geen projectdata beschikbaar.</p>
          ) : (
            <div className="space-y-4">
              {data.topProjecten.map((p, i) => (
                <div key={p.projectNaam} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-autronis-text-primary truncate block">
                          {p.projectNaam}
                        </span>
                        <span className="text-xs text-autronis-text-secondary">{p.klantNaam}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm tabular-nums flex-shrink-0 ml-4">
                        <span className="text-autronis-text-secondary">{Math.round(p.uren)}u</span>
                        <span className="text-autronis-accent font-semibold">{formatBedrag(p.omzet)}</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-autronis-bg rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-autronis-accent/60"
                        initial={{ width: "0%" }}
                        animate={{ width: `${(p.uren / topProjectMax) * 100}%` }}
                        transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activiteit heatmap */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
          <div className="flex items-center gap-3 mb-6">
            <Flame className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-semibold text-autronis-text-primary">Activiteit</h2>
            <span className="text-xs text-autronis-text-secondary ml-auto">laatste 365 dagen</span>
          </div>
          <div className="overflow-x-auto">
            <ActivityHeatmap data={heatmapData} />
          </div>
        </div>

        {/* Doelen + Team vergelijking */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DoelenSectie urenDezeMaand={urenDezeMaand} omzetDezeMaand={omzetDezeMaand} />
          <TeamVergelijking gebruikers={vergelijkData} />
        </div>
      </div>
    </PageTransition>
  );
}
