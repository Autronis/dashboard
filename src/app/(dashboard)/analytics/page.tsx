"use client";

import { useState, useMemo } from "react";
import {
  Euro,
  Clock,
  TrendingUp,
  Users,
  BarChart3,
  PieChart,
  Target,
  Flame,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Briefcase,
  Gauge,
  Wallet,
  Shield,
  AlertTriangle,
  Zap,
  Activity,
  Layers,
  DollarSign,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatBedrag } from "@/lib/utils";
import {
  useAnalytics,
  useHeatmap,
  useVergelijk,
  useForecast,
  useRunway,
  useDecisionEngine,
  type VergelijkGebruiker,
  type DecisionEngineData,
  type DecisionInsight,
  type DecisionAction,
  type DecisionForecastMaand,
} from "@/hooks/queries/use-analytics";
import { PageTransition } from "@/components/ui/page-transition";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton, SkeletonKPI } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import { ProgressRing } from "@/components/ui/progress-ring";

// --- Skeleton for analytics loading state ---
function AnalyticsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
      </div>
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

// --- CSS Donut Chart (with hover highlight) ---
function DonutChart({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <p className="text-sm text-autronis-text-secondary">Geen data.</p>;

  let acc = 0;
  const gradientParts: string[] = [];
  for (const seg of segments) {
    const pct = (seg.value / total) * 100;
    gradientParts.push(`${seg.color} ${acc}% ${acc + pct}%`);
    acc += pct;
  }

  const hoveredSeg = hover ? segments.find((s) => s.label === hover) : null;

  return (
    <div className="flex items-center gap-6">
      <div
        className="w-28 h-28 rounded-full flex-shrink-0 relative cursor-pointer"
        style={{
          background: `conic-gradient(${gradientParts.join(", ")})`,
        }}
        onMouseLeave={() => setHover(null)}
      >
        <div className="absolute inset-3 rounded-full bg-autronis-card flex items-center justify-center">
          {hoveredSeg ? (
            <div className="text-center px-1">
              <p className="text-[9px] text-autronis-text-secondary leading-tight truncate max-w-[52px]">{hoveredSeg.label}</p>
              <p className="text-[10px] font-bold text-autronis-text-primary tabular-nums">{((hoveredSeg.value / total) * 100).toFixed(0)}%</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="space-y-1.5 min-w-0">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={cn(
              "flex items-center gap-2 text-xs cursor-pointer transition-opacity rounded-md px-1.5 py-0.5",
              hover && hover !== seg.label ? "opacity-30" : "opacity-100"
            )}
            onMouseEnter={() => setHover(seg.label)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-autronis-text-secondary truncate">{seg.label}</span>
            <span className="text-autronis-text-primary font-medium tabular-nums ml-auto">
              {formatBedrag(seg.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ AI Insights + Next Actions ============

function InsightsPanel({ insights, actions }: { insights: DecisionInsight[]; actions: DecisionAction[] }) {
  const insightConfig = {
    positief: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: CheckCircle2 },
    waarschuwing: { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-400", icon: AlertTriangle },
    kritiek: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", icon: AlertCircle },
    actie: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", icon: Lightbulb },
  };

  const prioriteitConfig = {
    hoog: { bg: "bg-red-500/15", text: "text-red-400" },
    gemiddeld: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
    laag: { bg: "bg-blue-500/15", text: "text-blue-400" },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* AI Insights */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-autronis-accent/10 rounded-xl">
            <Activity className="w-5 h-5 text-autronis-accent" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Status</h2>
            <p className="text-xs text-autronis-text-secondary">Wat gaat goed, wat niet</p>
          </div>
        </div>
        {insights.length === 0 ? (
          <p className="text-sm text-autronis-text-secondary">Geen inzichten beschikbaar.</p>
        ) : (
          <div className="space-y-2.5">
            {insights.map((ins, i) => {
              const cfg = insightConfig[ins.type];
              const Icon = cfg.icon;
              return (
                <div key={i} className={cn("flex items-start gap-3 px-3.5 py-3 rounded-xl border", cfg.bg, cfg.border)}>
                  <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", cfg.text)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-autronis-text-primary leading-snug">{ins.tekst}</p>
                    {ins.impact && (
                      <p className={cn("text-xs font-semibold mt-1 tabular-nums", cfg.text)}>{ins.impact}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Next Best Actions */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-orange-500/10 rounded-xl">
            <Zap className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Acties</h2>
            <p className="text-xs text-autronis-text-secondary">Hoogste impact eerst</p>
          </div>
        </div>
        {actions.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-sm text-emerald-400 font-medium">Alles op orde — geen urgente acties</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {actions.map((act, i) => {
              const pCfg = prioriteitConfig[act.prioriteit];
              return (
                <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-autronis-bg/50 border border-autronis-border hover:bg-autronis-bg/80 transition-colors">
                  <div className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mt-0.5 flex-shrink-0", pCfg.bg, pCfg.text)}>
                    {act.prioriteit}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-autronis-text-primary leading-snug">{act.actie}</p>
                    <p className="text-xs text-autronis-accent font-semibold mt-1 tabular-nums">{act.impact}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Client Dependency Indicator (with 40% threshold marker) ============

function ClientDependencySectie({ dep }: { dep: DecisionEngineData["clientDependency"] }) {
  const riskConfig = {
    laag: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Laag risico" },
    gemiddeld: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Gemiddeld risico" },
    hoog: { bg: "bg-red-500/15", text: "text-red-400", label: "Hoog risico" },
  };

  const cfg = riskConfig[dep.riskLevel];

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-5">
        <Shield className="w-5 h-5 text-purple-400" />
        <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Klantafhankelijkheid</h2>
        <div className={cn("ml-auto px-3 py-1 rounded-full text-xs font-medium", cfg.bg, cfg.text)}>
          {cfg.label}
        </div>
      </div>

      {/* Concentration bar with 40% threshold */}
      <div className="mb-5 relative pt-5">
        {/* 40% threshold marker */}
        <div
          className="absolute bottom-0 top-5 w-px bg-red-400/50 z-10"
          style={{ left: "40%" }}
        >
          <span className="absolute -top-4 -translate-x-1/2 text-[9px] text-red-400 whitespace-nowrap">40%</span>
        </div>
        <div className="flex h-5 rounded-full overflow-hidden bg-autronis-bg">
          {dep.clients.slice(0, 6).map((c, i) => {
            const kleur = ["bg-autronis-accent", "bg-blue-400", "bg-purple-400", "bg-yellow-400", "bg-pink-400", "bg-cyan-400"][i];
            return (
              <motion.div
                key={c.naam}
                className={cn("h-full", kleur)}
                initial={{ width: "0%" }}
                animate={{ width: `${c.percentage}%` }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
                title={`${c.naam}: ${c.percentage.toFixed(1)}%`}
              />
            );
          })}
        </div>
      </div>

      {/* Client list */}
      <div className="space-y-2">
        {dep.clients.slice(0, 6).map((c, i) => {
          const kleuren = ["text-autronis-accent", "text-blue-400", "text-purple-400", "text-yellow-400", "text-pink-400", "text-cyan-400"];
          const dots = ["bg-autronis-accent", "bg-blue-400", "bg-purple-400", "bg-yellow-400", "bg-pink-400", "bg-cyan-400"];
          return (
            <div key={c.naam} className="flex items-center gap-3 text-sm">
              <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", dots[i])} />
              <span className="text-autronis-text-primary truncate flex-1">{c.naam}</span>
              <span className="text-autronis-text-secondary tabular-nums">{formatBedrag(c.omzet)}</span>
              <span className={cn("tabular-nums font-semibold w-12 text-right", c.percentage > 40 ? "text-red-400" : kleuren[i])}>
                {c.percentage.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Rate Analysis (with biggest lek highlight) ============

function RateAnalysisSectie({ rates }: { rates: DecisionEngineData["rateAnalysis"] }) {
  if (rates.length === 0) return null;

  const maxMisgelopen = Math.max(...rates.map((r) => r.misgelopen), 0);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-5">
        <DollarSign className="w-5 h-5 text-yellow-400" />
        <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Tarief analyse</h2>
        <span className="text-xs text-autronis-text-secondary ml-auto">doel vs werkelijk</span>
      </div>

      <div className="overflow-x-auto -mx-6 px-6">
        <div className="min-w-[500px] space-y-1.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs text-autronis-text-secondary font-medium pb-2 border-b border-autronis-border">
            <span className="col-span-2">Klant</span>
            <span className="text-right">Doel</span>
            <span className="text-right">Werkelijk</span>
            <span className="text-right">Gap</span>
            <span className="text-right">Misgelopen</span>
          </div>
          {rates.map((r) => {
            const isBiggestLek = maxMisgelopen > 0 && r.misgelopen === maxMisgelopen;
            return (
              <div
                key={r.naam}
                className={cn(
                  "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm py-2.5 rounded-lg px-2 -mx-2",
                  isBiggestLek ? "bg-red-500/12 border border-red-500/20" : r.gap < -10 ? "bg-red-500/8" : ""
                )}
              >
                <div className="col-span-2 flex items-center gap-2 min-w-0">
                  <span className="text-autronis-text-primary truncate">{r.naam}</span>
                  {isBiggestLek && (
                    <span className="flex-shrink-0 text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase">Grootste lek</span>
                  )}
                </div>
                <span className="text-autronis-text-secondary text-right tabular-nums self-center">{formatBedrag(r.doelTarief)}/u</span>
                <span className={cn("text-right tabular-nums font-medium self-center", r.gap < -10 ? "text-red-400" : "text-autronis-accent")}>
                  {formatBedrag(r.effectiefTarief)}/u
                </span>
                <span className={cn("text-right tabular-nums font-medium self-center", r.gap >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {r.gap >= 0 ? "+" : ""}{formatBedrag(r.gap)}
                </span>
                <span className={cn("text-right tabular-nums self-center", r.misgelopen > 0 ? "text-red-400 font-semibold" : "text-autronis-text-secondary")}>
                  {r.misgelopen > 0 ? formatBedrag(r.misgelopen) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {rates.some((r) => r.misgelopen > 0) && (
        <div className="mt-4 pt-3 border-t border-autronis-border flex items-center justify-between">
          <span className="text-xs text-autronis-text-secondary">Totaal misgelopen omzet (YTD)</span>
          <span className="text-sm font-bold text-red-400 tabular-nums">
            {formatBedrag(rates.reduce((s, r) => s + r.misgelopen, 0))}
          </span>
        </div>
      )}
    </div>
  );
}

// ============ Efficiency Metrics ============

function EfficiencySectie({ eff }: { eff: DecisionEngineData["efficiency"] }) {
  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-6">
        <Gauge className="w-5 h-5 text-autronis-accent" />
        <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Efficiency</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div className="text-center">
          <p className="text-xs text-autronis-text-secondary mb-1">Omzet per uur</p>
          <p className="text-xl font-bold text-autronis-accent tabular-nums">{formatBedrag(eff.revenuePerHour)}/u</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-autronis-text-secondary mb-1">Billable</p>
          <p className={cn("text-xl font-bold tabular-nums", eff.billablePercent >= 75 ? "text-emerald-400" : eff.billablePercent >= 60 ? "text-yellow-400" : "text-red-400")}>
            {eff.billablePercent.toFixed(0)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-autronis-text-secondary mb-1">Non-billable uren</p>
          <p className="text-xl font-bold text-orange-400 tabular-nums">{Math.round(eff.nonBillableUren)}u</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-autronis-text-secondary mb-1">Verloren omzet</p>
          <p className="text-xl font-bold text-red-400 tabular-nums">{formatBedrag(eff.lostRevenue)}</p>
          <p className="text-[10px] text-autronis-text-secondary mt-0.5">als non-billable billable was</p>
        </div>
      </div>

      {/* Billable bar */}
      <div className="mt-5 pt-4 border-t border-autronis-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-autronis-text-secondary">Billable ratio</span>
          <span className="text-xs font-semibold text-autronis-text-primary tabular-nums">
            {Math.round(eff.totaleUren - eff.nonBillableUren)}u / {Math.round(eff.totaleUren)}u
          </span>
        </div>
        <div className="w-full h-3 bg-autronis-bg rounded-full overflow-hidden flex">
          <motion.div
            className="h-full bg-autronis-accent rounded-l-full"
            initial={{ width: "0%" }}
            animate={{ width: `${eff.billablePercent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          <motion.div
            className="h-full bg-orange-400/30"
            initial={{ width: "0%" }}
            animate={{ width: `${100 - eff.billablePercent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}

// ============ Project Insights (sortable) ============

function ProjectInsightsSectie({ projects }: { projects: DecisionEngineData["projectInsights"] }) {
  const [sort, setSort] = useState<"omzet" | "uren" | "euroPerUur">("euroPerUur");

  if (projects.length === 0) return null;

  const waardeConfig = {
    hoog: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
    gemiddeld: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
    laag: { bg: "bg-red-500/15", text: "text-red-400" },
  };

  const sorted = [...projects].sort((a, b) => {
    if (sort === "omzet") return b.omzet - a.omzet;
    if (sort === "uren") return b.uren - a.uren;
    return b.euroPerUur - a.euroPerUur;
  });

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-5">
        <Layers className="w-5 h-5 text-blue-400" />
        <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Project waarde</h2>
        <div className="flex items-center gap-1 ml-auto bg-autronis-bg rounded-lg p-1">
          {(["omzet", "uren", "euroPerUur"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={cn(
                "text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium",
                sort === key ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              {key === "omzet" ? "Omzet" : key === "uren" ? "Uren" : "€/uur"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto -mx-6 px-6">
        <div className="min-w-[600px] space-y-1.5">
          <div className="grid grid-cols-7 gap-3 text-xs text-autronis-text-secondary font-medium pb-2 border-b border-autronis-border">
            <span className="col-span-2">Project</span>
            <span className={cn("text-right", sort === "omzet" ? "text-autronis-accent" : "")}>Omzet</span>
            <span className={cn("text-right", sort === "uren" ? "text-autronis-accent" : "")}>Uren</span>
            <span className={cn("text-right", sort === "euroPerUur" ? "text-autronis-accent" : "")}>€/uur</span>
            <span className="text-right">Budget</span>
            <span className="text-center">Waarde</span>
          </div>
          <AnimatePresence initial={false}>
            {sorted.slice(0, 10).map((p, i) => {
              const wCfg = waardeConfig[p.waarde];
              return (
                <motion.div
                  key={p.naam}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                  className="grid grid-cols-7 gap-3 text-sm py-2.5 rounded-lg px-2 -mx-2 hover:bg-autronis-bg/30 transition-colors"
                >
                  <div className="col-span-2 min-w-0">
                    <p className="text-autronis-text-primary truncate text-sm">{p.naam}</p>
                    <p className="text-xs text-autronis-text-secondary truncate">{p.klant}</p>
                  </div>
                  <span className="text-autronis-text-secondary text-right tabular-nums self-center">{formatBedrag(p.omzet)}</span>
                  <span className="text-autronis-text-secondary text-right tabular-nums self-center">{Math.round(p.uren)}u</span>
                  <span className={cn("text-right tabular-nums font-medium self-center", p.euroPerUur >= 95 ? "text-emerald-400" : p.euroPerUur >= 70 ? "text-yellow-400" : "text-red-400")}>
                    {formatBedrag(p.euroPerUur)}
                  </span>
                  <span className={cn("text-right tabular-nums self-center", p.overBudgetPct !== null && p.overBudgetPct > 0 ? "text-red-400" : "text-autronis-text-secondary")}>
                    {p.overBudgetPct !== null ? `${p.overBudgetPct > 0 ? "+" : ""}${p.overBudgetPct.toFixed(0)}%` : "—"}
                  </span>
                  <div className="flex justify-center self-center">
                    <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase", wCfg.bg, wCfg.text)}>
                      {p.waarde}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ============ Actionable Goals ============

function ActionableGoalsSectie({ goals }: { goals: DecisionEngineData["actionableGoals"] }) {
  function doelKleur(pct: number): string {
    if (pct >= 75) return "#22c55e";
    if (pct >= 50) return "#f59e0b";
    return "#ef4444";
  }

  const icons = [Euro, Clock, Target];

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-6">
        <Target className="w-5 h-5 text-autronis-accent" />
        <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Doelen</h2>
        <span className="text-xs text-autronis-text-secondary ml-auto">wat is er nodig</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {goals.map((g, i) => {
          const Icon = icons[i] ?? Target;
          const kleur = doelKleur(g.percentage);
          return (
            <div key={g.doel} className="flex flex-col items-center text-center">
              <ProgressRing
                percentage={Math.min(g.percentage, 100)}
                size={90}
                strokeWidth={7}
                color={kleur}
              />
              <div className="flex items-center gap-1.5 mt-3">
                <Icon className="w-3.5 h-3.5 text-autronis-text-secondary" />
                <p className="text-sm font-medium text-autronis-text-primary">{g.doel}</p>
              </div>
              <p className="text-xs text-autronis-text-secondary mt-1 tabular-nums">
                {g.doel === "Uren"
                  ? `${g.huidig.toFixed(1)}u / ${g.target}u per maand`
                  : g.doel === "Jaardoel"
                  ? `${formatBedrag(g.huidig)} / ${formatBedrag(g.target)} per jaar`
                  : `${formatBedrag(g.huidig)} / ${formatBedrag(g.target)} per maand`}
              </p>
              <p className="text-xs text-autronis-accent mt-1.5 font-medium leading-tight">{g.actie}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Pipeline ============

function PipelineSectie({ pipeline }: { pipeline: DecisionEngineData["pipeline"] }) {
  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-5">
        <Layers className="w-5 h-5 text-cyan-400" />
        <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Pipeline</h2>
        <span className="text-xs text-autronis-text-secondary ml-auto">verwachte toekomstige omzet</span>
      </div>

      {/* Pipeline KPIs */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="p-4 rounded-xl bg-autronis-bg/50 border border-autronis-border text-center">
          <p className="text-xs text-autronis-text-secondary mb-1">Totaal open</p>
          <p className="text-xl font-bold text-cyan-400 tabular-nums">{formatBedrag(pipeline.totaal)}</p>
        </div>
        <div className="p-4 rounded-xl bg-autronis-bg/50 border border-autronis-border text-center">
          <p className="text-xs text-autronis-text-secondary mb-1">Gewogen waarde</p>
          <p className="text-xl font-bold text-autronis-accent tabular-nums">{formatBedrag(pipeline.gewogen)}</p>
          <p className="text-[10px] text-autronis-text-secondary mt-0.5">op basis van kans %</p>
        </div>
      </div>

      {/* Pipeline items */}
      {pipeline.items.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-autronis-text-secondary">Geen openstaande offertes of leads</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pipeline.items.map((item) => {
            const statusConfig: Record<string, { bg: string; text: string }> = {
              verzonden: { bg: "bg-blue-500/15", text: "text-blue-400" },
              concept: { bg: "bg-autronis-text-secondary/10", text: "text-autronis-text-secondary" },
              nieuw: { bg: "bg-purple-500/15", text: "text-purple-400" },
              contact: { bg: "bg-cyan-500/15", text: "text-cyan-400" },
              offerte: { bg: "bg-blue-500/15", text: "text-blue-400" },
            };
            const sCfg = statusConfig[item.status] ?? statusConfig.concept;

            return (
              <div key={`${item.status}-${item.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-autronis-bg/30 border border-autronis-border hover:bg-autronis-bg/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-autronis-text-primary truncate">{item.titel}</p>
                  <p className="text-xs text-autronis-text-secondary">{item.klant}</p>
                </div>
                <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium", sCfg.bg, sCfg.text)}>
                  {item.status}
                </span>
                <span className="text-xs text-autronis-text-secondary tabular-nums">{item.kans}%</span>
                <span className="text-sm font-semibold text-autronis-accent tabular-nums">{formatBedrag(item.bedrag)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ Upgraded Cashflow ============

function CashflowSectie({ cf }: { cf: DecisionEngineData["cashflow"] }) {
  const isGezond = cf.nettoPerMaand >= 0;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-6">
        <Wallet className="w-5 h-5 text-emerald-400" />
        <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Cash flow</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
        <div className="text-center">
          <p className="text-xs text-autronis-text-secondary mb-1">Gem. inkomsten/mnd</p>
          <p className="text-lg font-bold text-emerald-400 tabular-nums">{formatBedrag(cf.gemInkomsten)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-autronis-text-secondary mb-1">Gem. kosten/mnd</p>
          <p className="text-lg font-bold text-red-400 tabular-nums">{formatBedrag(cf.gemKosten)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-autronis-text-secondary mb-1">Netto/mnd</p>
          <p className={cn("text-lg font-bold tabular-nums", isGezond ? "text-emerald-400" : "text-red-400")}>
            {cf.nettoPerMaand >= 0 ? "+" : ""}{formatBedrag(cf.nettoPerMaand)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-autronis-text-secondary mb-1">Uitstaand</p>
          <p className="text-lg font-bold text-blue-400 tabular-nums">{formatBedrag(cf.uitstaand)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-autronis-text-secondary mb-1">Te laat</p>
          <p className={cn("text-lg font-bold tabular-nums", cf.overdue > 0 ? "text-red-400" : "text-emerald-400")}>
            {cf.overdue > 0 ? formatBedrag(cf.overdue) : "€0"}
          </p>
          {cf.overdueCount > 0 && (
            <p className="text-[10px] text-red-400 mt-0.5">{cf.overdueCount} facturen</p>
          )}
        </div>
        <div className="text-center">
          <p className="text-xs text-autronis-text-secondary mb-1">Runway</p>
          <div className="flex items-center justify-center gap-1.5">
            <Shield className={cn("w-4 h-4", isGezond ? "text-emerald-400" : "text-red-400")} />
            <p className={cn("text-lg font-bold", isGezond ? "text-emerald-400" : "text-red-400")}>
              {cf.runwayMaanden === null ? "Gezond" : `${cf.runwayMaanden} mnd`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Upgraded Forecast with confidence ============

function ForecastUpgradedSectie({ forecast }: { forecast: DecisionEngineData["forecast"] }) {
  const maxVal = Math.max(...forecast.maanden.map((m) => m.bestCase), 1);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-2">
        <TrendingUp className="w-5 h-5 text-autronis-accent" />
        <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Forecast</h2>
        <div className={cn(
          "ml-auto px-3 py-1 rounded-full text-xs font-medium",
          forecast.opKoers ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
        )}>
          {forecast.opKoers ? "Op koers" : "Niet op koers"}
        </div>
        <div className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 tabular-nums">
          {forecast.confidence}% zekerheid
        </div>
      </div>
      <p className="text-xs text-autronis-text-secondary mb-6">
        Jaardoel: {formatBedrag(forecast.jaardoel)} &middot; Tot nu: {formatBedrag(forecast.omzetTotNu)} &middot; Benodigd: {formatBedrag(forecast.benodigdPerMaand)}/mnd &middot; Zeker: {formatBedrag(forecast.restWaarde)}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {forecast.maanden.map((m, i) => (
          <div key={m.maand} className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-medium text-autronis-text-primary">{m.label}</p>
              <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded tabular-nums">{m.confidence}%</span>
            </div>
            <div className="flex items-end gap-1.5 h-32 justify-center">
              <div className="flex flex-col items-center gap-1 flex-1">
                <AnimatedBar hoogte={(m.worstCase / maxVal) * 100} index={i * 3} className="bg-red-400/40" maxWidth="28px" />
              </div>
              <div className="flex flex-col items-center gap-1 flex-1">
                <AnimatedBar hoogte={(m.verwacht / maxVal) * 100} index={i * 3 + 1} className="bg-autronis-accent/70" maxWidth="28px" />
              </div>
              <div className="flex flex-col items-center gap-1 flex-1">
                <AnimatedBar hoogte={(m.bestCase / maxVal) * 100} index={i * 3 + 2} className="bg-green-400/60" maxWidth="28px" />
              </div>
            </div>
            <div className="text-center space-y-0.5">
              <p className="text-xs text-autronis-text-secondary tabular-nums">
                Verwacht: <span className="text-autronis-text-primary font-medium">{formatBedrag(m.verwacht)}</span>
              </p>
              <p className="text-[10px] text-autronis-text-secondary tabular-nums">
                {formatBedrag(m.worstCase)} — {formatBedrag(m.bestCase)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-6 mt-5 pt-4 border-t border-autronis-border">
        <div className="flex items-center gap-1.5 text-[10px] text-autronis-text-secondary">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-400/40" /> Worst case
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-autronis-text-secondary">
          <div className="w-2.5 h-2.5 rounded-sm bg-autronis-accent/70" /> Verwacht
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-autronis-text-secondary">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-400/60" /> Best case
        </div>
      </div>
    </div>
  );
}

// --- Tijdsbesteding sectie ---
function TijdsbestedingSectie({
  topProjecten,
  heatmapData,
}: {
  topProjecten: { projectNaam: string; klantNaam: string; uren: number; omzet: number }[];
  heatmapData: { datum: string; uren: number }[];
}) {
  const billable = topProjecten
    .filter((p) => p.klantNaam && !p.klantNaam.toLowerCase().includes("autronis"))
    .reduce((s, p) => s + p.uren, 0);
  const nonBillable = topProjecten
    .filter((p) => !p.klantNaam || p.klantNaam.toLowerCase().includes("autronis"))
    .reduce((s, p) => s + p.uren, 0);
  const totalUren = billable + nonBillable;
  const billablePct = totalUren > 0 ? (billable / totalUren) * 100 : 0;

  const nu = new Date();
  const weeks: { label: string; uren: number }[] = [];
  for (let w = 3; w >= 0; w--) {
    let weekUren = 0;
    for (let d = 0; d < 7; d++) {
      const date = new Date(nu);
      date.setDate(date.getDate() - (w * 7 + d));
      const datumStr = date.toISOString().slice(0, 10);
      const found = heatmapData.find((h) => h.datum === datumStr);
      if (found) weekUren += found.uren;
    }
    const weekStart = new Date(nu);
    weekStart.setDate(weekStart.getDate() - w * 7 - 6);
    weeks.push({
      label: `Wk ${getWeekNumber(weekStart)}`,
      uren: Math.round(weekUren * 10) / 10,
    });
  }
  const maxWeekUren = Math.max(...weeks.map((w) => w.uren), 1);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-5 h-5 text-blue-400" />
        <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Tijdsbesteding</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <p className="text-sm text-autronis-text-secondary mb-3">Declarabel vs Intern</p>
          <div className="w-full h-6 bg-autronis-bg rounded-full overflow-hidden flex">
            <motion.div className="h-full bg-autronis-accent" initial={{ width: "0%" }} animate={{ width: `${billablePct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
            <motion.div className="h-full bg-autronis-accent/20" initial={{ width: "0%" }} animate={{ width: `${100 - billablePct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-autronis-accent tabular-nums">Declarabel: {Math.round(billable)}u ({Math.round(billablePct)}%)</span>
            <span className="text-autronis-text-secondary tabular-nums">Intern: {Math.round(nonBillable)}u ({Math.round(100 - billablePct)}%)</span>
          </div>
        </div>

        <div>
          <p className="text-sm text-autronis-text-secondary mb-3">Uren per week (laatste 4)</p>
          <div className="flex items-end gap-3 h-24">
            {weeks.map((w, i) => {
              const hoogte = maxWeekUren > 0 ? (w.uren / maxWeekUren) * 100 : 0;
              return (
                <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-autronis-text-secondary tabular-nums">{w.uren}u</span>
                  <div className="relative w-full flex justify-center h-full items-end">
                    <AnimatedBar hoogte={hoogte} index={i} className="bg-blue-400/60 group-hover:bg-blue-400 transition-colors" maxWidth="40px" />
                  </div>
                  <span className="text-[10px] text-autronis-text-secondary">{w.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + oneJan.getDay() + 1) / 7);
}

// --- Team vergelijking ---
function TeamVergelijking({ gebruikers }: { gebruikers: VergelijkGebruiker[] }) {
  if (gebruikers.length < 2) return null;

  const metrics: {
    label: string;
    key: keyof Pick<VergelijkGebruiker, "urenDezeMaand" | "omzetDezeMaand" | "takenAfgerond" | "actieveProjecten">;
    format: (v: number) => string;
    icon: typeof Clock;
  }[] = [
    { label: "Uren", key: "urenDezeMaand", format: (v) => `${Math.round(v)}u`, icon: Clock },
    { label: "Omzet", key: "omzetDezeMaand", format: (v) => formatBedrag(v), icon: Euro },
    { label: "Taken afgerond", key: "takenAfgerond", format: (v) => String(v), icon: CheckCircle2 },
    { label: "Actieve projecten", key: "actieveProjecten", format: (v) => String(v), icon: Briefcase },
  ];

  const [a, b] = gebruikers.slice(0, 2);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <Users className="w-5 h-5 text-purple-400" />
        <h2 className="text-base sm:text-base sm:text-lg font-semibold text-autronis-text-primary">Team vergelijking</h2>
        <span className="text-xs text-autronis-text-secondary ml-auto">deze maand</span>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-center pb-3 border-b border-autronis-border">
          <span className="text-xs sm:text-sm font-semibold text-autronis-text-primary truncate">{a.naam.split(" ")[0]}</span>
          <span className="text-xs text-autronis-text-secondary self-center">vs</span>
          <span className="text-xs sm:text-sm font-semibold text-autronis-text-primary truncate">{b.naam.split(" ")[0]}</span>
        </div>

        {metrics.map((m) => {
          const valA = a[m.key];
          const valB = b[m.key];
          const maxVal = Math.max(valA, valB, 1);
          const Icon = m.icon;
          return (
            <div key={m.key} className="space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-xs text-autronis-text-secondary">
                <Icon className="w-3.5 h-3.5" />
                <span>{m.label}</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-1 flex items-center gap-1.5 sm:gap-2 justify-end">
                  <span className={cn("text-xs font-medium tabular-nums text-right shrink-0", valA >= valB ? "text-autronis-accent" : "text-autronis-text-secondary")}>{m.format(valA)}</span>
                  <div className="flex-1 max-w-24 h-2 sm:h-2.5 bg-autronis-bg rounded-full overflow-hidden flex justify-end shrink-0">
                    <motion.div className={cn("h-full rounded-full", valA >= valB ? "bg-autronis-accent" : "bg-autronis-accent/30")} initial={{ width: "0%" }} animate={{ width: `${(valA / maxVal) * 100}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
                  </div>
                </div>
                <div className="w-px h-4 bg-autronis-border shrink-0" />
                <div className="flex-1 flex items-center gap-1.5 sm:gap-2">
                  <div className="flex-1 max-w-24 h-2 sm:h-2.5 bg-autronis-bg rounded-full overflow-hidden shrink-0">
                    <motion.div className={cn("h-full rounded-full", valB >= valA ? "bg-purple-400" : "bg-purple-400/30")} initial={{ width: "0%" }} animate={{ width: `${(valB / maxVal) * 100}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
                  </div>
                  <span className={cn("text-xs font-medium tabular-nums shrink-0", valB >= valA ? "text-purple-400" : "text-autronis-text-secondary")}>{m.format(valB)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Sticky summary bar ---
function StickySummaryBar({
  cf,
  eff,
  forecast,
}: {
  cf: DecisionEngineData["cashflow"];
  eff: DecisionEngineData["efficiency"];
  forecast: DecisionEngineData["forecast"];
}) {
  return (
    <div className="sticky top-0 z-20 bg-autronis-bg/95 backdrop-blur-sm border-b border-autronis-border -mx-4 px-4 lg:-mx-8 lg:px-8 py-2.5 flex items-center gap-3 sm:gap-5 flex-wrap text-xs">
      <span className="text-autronis-text-secondary font-medium">Runway</span>
      <span className={cn("font-bold tabular-nums", cf.nettoPerMaand >= 0 ? "text-emerald-400" : "text-red-400")}>
        {cf.runwayMaanden === null ? "Gezond" : `${cf.runwayMaanden} mnd`}
      </span>
      <div className="w-px h-3 bg-autronis-border hidden sm:block" />
      <span className="text-autronis-text-secondary font-medium">Billable</span>
      <span className={cn("font-bold tabular-nums", eff.billablePercent >= 75 ? "text-emerald-400" : eff.billablePercent >= 60 ? "text-yellow-400" : "text-red-400")}>
        {eff.billablePercent.toFixed(0)}%
      </span>
      <div className="w-px h-3 bg-autronis-border hidden sm:block" />
      <span className="text-autronis-text-secondary font-medium">Pipeline</span>
      <span className="text-cyan-400 font-bold tabular-nums">{formatBedrag(forecast.restWaarde)}</span>
      <div className="w-px h-3 bg-autronis-border hidden sm:block" />
      <span className="text-autronis-text-secondary font-medium">Forecast</span>
      <span className={cn("font-bold", forecast.opKoers ? "text-emerald-400" : "text-red-400")}>
        {forecast.opKoers ? "Op koers" : "Niet op koers"}
      </span>
      {cf.overdue > 0 && (
        <>
          <div className="w-px h-3 bg-autronis-border hidden sm:block" />
          <span className="text-red-400 font-bold tabular-nums">{formatBedrag(cf.overdue)} te laat</span>
        </>
      )}
    </div>
  );
}

// --- Main page ---
export default function AnalyticsPage() {
  const [jaar, setJaar] = useState(new Date().getFullYear());
  const [grafiekMetric, setGrafiekMetric] = useState<"omzet" | "uren">("omzet");

  const { data, isLoading } = useAnalytics(jaar);
  const { data: heatmapData } = useHeatmap();
  const { data: vergelijkData } = useVergelijk();
  const { data: forecastData } = useForecast();
  const { data: runwayData } = useRunway();
  const { data: decisionData } = useDecisionEngine();

  // Donut segments for "Omzet per klant"
  const omzetPerKlant = useMemo(() => {
    if (!data) return [];
    const KLEUREN = [
      "#17B8A5", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444",
      "#22c55e", "#ec4899", "#06b6d4", "#f97316", "#6366f1",
    ];
    const klantMap = new Map<string, number>();
    for (const p of data.topProjecten) {
      klantMap.set(p.klantNaam, (klantMap.get(p.klantNaam) || 0) + p.omzet);
    }
    return [...klantMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({ label, value, color: KLEUREN[i % KLEUREN.length] }));
  }, [data]);

  if (isLoading || !data) {
    return <AnalyticsSkeleton />;
  }

  const omzetGroei =
    data.kpis.omzetVorigJaar > 0
      ? ((data.kpis.omzetDitJaar - data.kpis.omzetVorigJaar) / data.kpis.omzetVorigJaar) * 100
      : 0;

  const isHuidigJaar = jaar === new Date().getFullYear();
  const jaarDoel = decisionData?.forecast.jaardoel ?? 120_000;
  const jaarDoelPct = Math.min((data.kpis.omzetDitJaar / jaarDoel) * 100, 100);

  const TARGET_OMZET = 10000;
  const huidigeMaandStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const forecastMaanden = forecastData?.maanden ?? [];

  // Chart max based on selected metric
  const allOmzetValues = [
    ...data.maanden.map((m) => m.omzet),
    ...forecastMaanden.map((m) => m.bestCase),
  ];
  const chartMaxOmzet = Math.max(...allOmzetValues, TARGET_OMZET * 1.1, 1);
  const chartMaxUren = Math.max(...data.maanden.map((m) => m.uren), 1);
  const chartMax = grafiekMetric === "omzet" ? chartMaxOmzet : chartMaxUren;

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        <PageHeader
          title="Analytics"
          description="Beslissingen op basis van data"
          actions={
            <>
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
            </>
          }
        />

        {/* Sticky summary bar */}
        {decisionData && (
          <StickySummaryBar
            cf={decisionData.cashflow}
            eff={decisionData.efficiency}
            forecast={decisionData.forecast}
          />
        )}

        {/* KPI balk — animates on year switch */}
        <AnimatePresence mode="wait">
          <motion.div
            key={jaar}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5"
          >
            <div className="bg-gradient-to-br from-autronis-accent/10 to-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 card-glow col-span-2 sm:col-span-1">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl w-fit mb-3">
                <Euro className="w-5 h-5 text-autronis-accent" />
              </div>
              <p className="text-2xl font-bold text-autronis-accent tabular-nums">
                <AnimatedNumber value={data.kpis.omzetDitJaar} format={(n) => formatBedrag(n)} />
              </p>
              <p className="text-sm text-autronis-text-secondary mt-1 uppercase tracking-wide">Omzet {jaar}</p>
              {isHuidigJaar && (
                <div className="mt-3 pt-2 border-t border-autronis-accent/20">
                  <div className="flex justify-between text-[10px] text-autronis-text-secondary mb-1.5">
                    <span>Jaardoel</span>
                    <span className="tabular-nums">{Math.round(jaarDoelPct)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-autronis-bg rounded-full overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full", jaarDoelPct >= 75 ? "bg-green-400" : jaarDoelPct >= 50 ? "bg-yellow-400" : "bg-autronis-accent")}
                      initial={{ width: "0%" }}
                      animate={{ width: `${jaarDoelPct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                    />
                  </div>
                  <p className="text-[10px] text-autronis-text-secondary mt-1 tabular-nums">{formatBedrag(jaarDoel)} doel</p>
                </div>
              )}
            </div>

            <div
              className={cn(
                "border border-autronis-border rounded-2xl p-4 sm:p-6 card-glow",
                omzetGroei >= 0 ? "bg-gradient-to-br from-green-500/10 to-autronis-card" : "bg-gradient-to-br from-red-500/10 to-autronis-card"
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("p-2.5 rounded-xl w-fit", omzetGroei >= 0 ? "bg-emerald-500/10" : "bg-red-500/10")}>
                  {omzetGroei >= 0 ? <ArrowUp className="w-5 h-5 text-emerald-400" /> : <ArrowDown className="w-5 h-5 text-red-400" />}
                </div>
              </div>
              <p className={cn("text-3xl font-black tabular-nums", omzetGroei >= 0 ? "text-emerald-400" : "text-red-400")}>
                <AnimatedNumber value={omzetGroei} format={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`} />
              </p>
              <p className="text-sm text-autronis-text-secondary mt-1 uppercase tracking-wide">vs {jaar - 1}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 card-glow">
              <div className="p-2.5 bg-blue-500/10 rounded-xl w-fit mb-3">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-blue-400 tabular-nums">
                <AnimatedNumber value={data.kpis.urenDitJaar} format={(n) => `${Math.round(n)}u`} />
              </p>
              <p className="text-sm text-autronis-text-secondary mt-1 uppercase tracking-wide">Uren {jaar}</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/10 to-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 card-glow">
              <div className="p-2.5 bg-yellow-500/10 rounded-xl w-fit mb-3">
                <Euro className="w-5 h-5 text-yellow-400" />
              </div>
              <p className="text-2xl font-bold text-yellow-400 tabular-nums">
                <AnimatedNumber value={data.kpis.gemiddeldUurtarief} format={(n) => `${formatBedrag(n)}/u`} />
              </p>
              <p className="text-sm text-autronis-text-secondary mt-1 uppercase tracking-wide">Gem. tarief</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 card-glow">
              <div className="p-2.5 bg-purple-500/10 rounded-xl w-fit mb-3">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-purple-400 tabular-nums">
                <AnimatedNumber value={data.kpis.actieveKlanten} />
              </p>
              <p className="text-sm text-autronis-text-secondary mt-1 uppercase tracking-wide">Actieve klanten</p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ═══════════ BLOK 1: OVERZICHT ═══════════ */}

        {/* === AI INSIGHTS + NEXT ACTIONS (eerst: wat moet je weten?) === */}
        {decisionData && (
          <InsightsPanel insights={decisionData.aiInsights} actions={decisionData.nextActions} />
        )}

        {/* === DOELEN + TEAM === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {decisionData?.actionableGoals && decisionData.actionableGoals.length > 0 ? (
            <ActionableGoalsSectie goals={decisionData.actionableGoals} />
          ) : null}
          <TeamVergelijking gebruikers={vergelijkData ?? []} />
        </div>

        {/* === EFFICIENCY === */}
        {decisionData && <EfficiencySectie eff={decisionData.efficiency} />}

        {/* ═══════════ BLOK 2: WERK ═══════════ */}

        {/* Omzet/Uren chart with metric toggle */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-autronis-accent flex-shrink-0" />
            <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">
              {grafiekMetric === "omzet" ? "Omzet" : "Uren"} per maand
            </h2>
            {/* Metric toggle */}
            <div className="flex items-center gap-1 bg-autronis-bg rounded-lg p-1">
              {(["omzet", "uren"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setGrafiekMetric(m)}
                  className={cn(
                    "text-xs px-3 py-1 rounded-md transition-colors font-medium capitalize",
                    grafiekMetric === m ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary"
                  )}
                >
                  {m === "omzet" ? "Omzet" : "Uren"}
                </button>
              ))}
            </div>
            {grafiekMetric === "omzet" && (
              <div className="flex items-center gap-2 sm:gap-4 ml-auto text-[10px] text-autronis-text-secondary flex-wrap justify-end">
                <span className="flex items-center gap-1.5"><div className="w-6 h-0.5 bg-autronis-accent/40" /> Werkelijk</span>
                <span className="flex items-center gap-1.5"><div className="w-6 h-0.5 border-t border-dashed border-autronis-accent/60" /> Forecast</span>
                <span className="flex items-center gap-1.5"><div className="w-6 h-0.5 border-t border-dashed border-red-400" /> Doel</span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <div className="relative min-w-[320px]">
              {/* Target line — only in omzet mode */}
              {grafiekMetric === "omzet" && (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-red-400/60 z-10 pointer-events-none"
                  style={{ bottom: `${(TARGET_OMZET / chartMax) * 100}%` }}
                >
                  <span className="absolute -top-4 right-0 text-[10px] text-red-400 tabular-nums">{formatBedrag(TARGET_OMZET)}</span>
                </div>
              )}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${jaar}-${grafiekMetric}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-end gap-2 h-56"
                >
                  {data.maanden.map((m, i) => {
                    const value = grafiekMetric === "omzet" ? m.omzet : m.uren;
                    const hoogte = chartMax > 0 ? (value / chartMax) * 100 : 0;
                    const isHuidig = m.maand === huidigeMaandStr;
                    const tooltip = grafiekMetric === "omzet" ? formatBedrag(m.omzet) : `${Math.round(m.uren)}u`;
                    return (
                      <div key={m.maand} className="flex-1 flex flex-col items-center gap-2 group">
                        <div className="relative w-full flex justify-center h-full items-end">
                          <div className="absolute -top-7 text-xs text-autronis-text-secondary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap tabular-nums">{tooltip}</div>
                          <AnimatedBar hoogte={hoogte} index={i} className={cn("transition-colors", isHuidig ? "bg-autronis-accent" : "bg-autronis-accent/40", "group-hover:bg-autronis-accent")} />
                        </div>
                        <span className={cn("text-xs flex-shrink-0", isHuidig ? "text-autronis-accent font-semibold" : "text-autronis-text-secondary")}>{m.label}</span>
                      </div>
                    );
                  })}
                  {/* Forecast bars — only in omzet mode */}
                  {grafiekMetric === "omzet" && forecastMaanden.map((m, i) => {
                    const hoogte = chartMax > 0 ? (m.verwacht / chartMax) * 100 : 0;
                    const maandLabel = new Date(m.maand + "-01").toLocaleDateString("nl-NL", { month: "short" });
                    return (
                      <div key={m.maand} className="flex-1 flex flex-col items-center gap-2 group">
                        <div className="relative w-full flex justify-center h-full items-end">
                          <div className="absolute -top-7 text-xs text-autronis-text-secondary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap tabular-nums">{formatBedrag(m.verwacht)}</div>
                          <motion.div
                            className="w-full rounded-t-lg border-2 border-dashed border-autronis-accent/50 bg-autronis-accent/10"
                            style={{ maxWidth: "40px" }}
                            initial={{ height: "0%" }}
                            animate={{ height: `${Math.max(hoogte, 2)}%` }}
                            transition={{ duration: 0.5, delay: (12 + i) * 0.05, ease: "easeOut" }}
                          />
                        </div>
                        <span className="text-xs flex-shrink-0 text-autronis-text-secondary italic">{maandLabel}</span>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Tijdsbesteding + Per medewerker */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TijdsbestedingSectie topProjecten={data.topProjecten} heatmapData={heatmapData ?? []} />

          {/* Per medewerker */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
            <div className="flex items-center gap-3 mb-6">
              <PieChart className="w-5 h-5 text-purple-400" />
              <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Per medewerker</h2>
              <span className="text-xs text-autronis-text-secondary ml-auto">{jaar}</span>
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

        {/* Activiteit heatmap */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7"
        >
          <div className="flex items-center gap-3 mb-6">
            <Flame className="w-5 h-5 text-orange-400" />
            <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Activiteit</h2>
            <span className="text-xs text-autronis-text-secondary ml-auto">laatste 365 dagen</span>
          </div>
          <div className="overflow-x-auto">
            <ActivityHeatmap data={heatmapData ?? []} />
          </div>
        </motion.div>

        {/* ═══════════ BLOK 3: GELD ═══════════ */}

        {/* Forecast + Pipeline */}
        {decisionData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ForecastUpgradedSectie forecast={decisionData.forecast} />
            <PipelineSectie pipeline={decisionData.pipeline} />
          </div>
        )}

        {/* Cashflow */}
        {decisionData && <CashflowSectie cf={decisionData.cashflow} />}

        {/* Omzet per klant + Client dependency */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:p-6 lg:p-7">
            <div className="flex items-center gap-3 mb-6">
              <PieChart className="w-5 h-5 text-autronis-accent" />
              <h2 className="text-base sm:text-lg font-semibold text-autronis-text-primary">Omzet per klant</h2>
              <span className="text-xs text-autronis-text-secondary ml-auto">{jaar}</span>
            </div>
            <DonutChart segments={omzetPerKlant} />
          </div>
          {decisionData && <ClientDependencySectie dep={decisionData.clientDependency} />}
        </div>

        {/* Rate analysis + Project insights */}
        {decisionData && <RateAnalysisSectie rates={decisionData.rateAnalysis} />}
        {decisionData && <ProjectInsightsSectie projects={decisionData.projectInsights} />}
      </div>
    </PageTransition>
  );
}
