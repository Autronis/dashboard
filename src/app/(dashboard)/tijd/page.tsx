"use client";

import { useState, useCallback } from "react";
import { Clock, Monitor, Users, Shield, TrendingUp, ChevronLeft, ChevronRight, Brain, Zap, ArrowUp, ArrowDown, Minus, Lightbulb, Play, AlertCircle, CheckCircle2 } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessies } from "@/hooks/queries/use-screen-time";
import { TimerStrip } from "./timer-strip";
import { TabTijdlijn } from "./tab-tijdlijn";
import { TabRegistraties } from "./tab-registraties";
import { TabTeam } from "./tab-team";
import { TabRegelsSuggesties } from "./tab-regels-suggesties";
import {
  berekenVanTot,
  navigeerDatum,
  datumLabel,
  formatTijd,
} from "./constants";
import type { Periode, TabId } from "./constants";

const TABS: { id: TabId; label: string; icon: typeof Monitor }[] = [
  { id: "tijdlijn", label: "Tijdlijn", icon: Monitor },
  { id: "registraties", label: "Registraties", icon: Clock },
  { id: "team", label: "Team", icon: Users },
  { id: "regels", label: "Regels & Suggesties", icon: Shield },
];

const PERIODES: { id: Periode; label: string }[] = [
  { id: "dag", label: "Dag" },
  { id: "week", label: "Week" },
  { id: "maand", label: "Maand" },
];

export default function TijdPage() {
  const [activeTab, setActiveTab] = useState<TabId>("tijdlijn");
  const [periode, setPeriode] = useState<Periode>("dag");
  const [datum, setDatum] = useState<Date>(new Date());

  const { van, tot } = berekenVanTot(datum, periode);

  const { data: sessiesData, isLoading: sessiesLoading } = useSessies(van);

  // Fetch yesterday's stats for trend comparison
  const gisteren = (() => {
    const d = new Date(van);
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const { data: gisterenData } = useSessies(gisteren);

  const stats = sessiesData?.stats ?? null;
  const gisterenStats = gisterenData?.stats ?? null;

  const handleNavigeer = useCallback(
    (richting: -1 | 1) => {
      setDatum((prev) => navigeerDatum(prev, periode, richting));
    },
    [periode]
  );

  const handleVandaag = useCallback(() => {
    setDatum(new Date());
  }, []);

  const toonPeriodeSelector = activeTab === "tijdlijn" || activeTab === "team";

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">

        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">Tijd</h1>
            <p className="text-autronis-text-secondary mt-1">
              Schermtijd, sessies en tijdregistraties
            </p>
          </div>
          <div className="sm:shrink-0">
            <TimerStrip />
          </div>
        </div>

        {/* KPI cards + coaching — only on tijdlijn tab */}
        {activeTab === "tijdlijn" && (() => {
          const dwPct = stats ? Math.min(100, Math.round(((stats.deepWorkMinuten ?? 0) / (stats.deepWorkTarget ?? 240)) * 100)) : 0;
          const dwRemaining = Math.max(0, (stats?.deepWorkTarget ?? 240) - (stats?.deepWorkMinuten ?? 0));
          const score = stats?.focusScore ?? 0;
          const scoreColor = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";
          const scoreLabel = score >= 70 ? "Sterk" : score >= 40 ? "Kan beter" : "Zwak";
          const scoreBorderColor = score >= 70 ? "border-emerald-500/20" : score >= 40 ? "border-amber-500/20" : "border-red-500/20";

          // Trends vs yesterday
          const prodTrend = gisterenStats ? (stats?.productiefPercentage ?? 0) - gisterenStats.productiefPercentage : null;
          const scoreTrend = gisterenStats ? score - gisterenStats.focusScore : null;

          // Deep work status
          const dwStatusColor = dwPct >= 75 ? "text-emerald-400" : dwPct >= 40 ? "text-amber-400" : "text-red-400";
          const dwBarColor = dwPct >= 75 ? "bg-emerald-400" : dwPct >= 40 ? "bg-amber-400" : "bg-red-400";
          const dwBorderColor = dwPct >= 75 ? "border-emerald-500/20" : dwPct >= 40 ? "border-amber-500/20" : "border-red-500/20";

          // Productief status
          const prodPct = stats?.productiefPercentage ?? 0;
          const prodColor = prodPct >= 80 ? "text-emerald-400" : prodPct >= 60 ? "text-amber-400" : "text-red-400";
          const prodBorderColor = prodPct >= 80 ? "border-emerald-500/20" : prodPct >= 60 ? "border-amber-500/20" : "border-red-500/20";

          // Coaching advices
          const adviezen: Array<{ type: "goed" | "waarschuwing" | "kritiek"; tekst: string }> = [];
          if (stats) {
            if (dwPct < 40) adviezen.push({ type: "kritiek", tekst: `Je zit onder je deep work target (${formatTijd((stats.deepWorkMinuten ?? 0) * 60)} / ${formatTijd((stats.deepWorkTarget ?? 240) * 60)})` });
            else if (dwPct >= 75) adviezen.push({ type: "goed", tekst: `Deep work target bijna gehaald (${dwPct}%)` });
            if (prodPct >= 80) adviezen.push({ type: "goed", tekst: `Productiviteit is sterk (${prodPct}%)` });
            else if (prodPct < 60) adviezen.push({ type: "waarschuwing", tekst: `Productiviteit is laag (${prodPct}%) — te veel afleiding?` });
            if (stats.contextSwitches > 15) adviezen.push({ type: "waarschuwing", tekst: `${stats.contextSwitches} context switches — probeer langere blokken` });
            if (stats.gemSessieLengte < 25) adviezen.push({ type: "waarschuwing", tekst: `Gem. sessie ${stats.gemSessieLengte}m — je wordt vaak onderbroken` });
            if (dwRemaining > 0 && dwPct < 75) adviezen.push({ type: "kritiek", tekst: `Nog ${formatTijd(dwRemaining * 60)} deep work nodig` });
          }

          return (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Actieve tijd */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 card-glow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#17B8A5]/15 flex items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5 text-autronis-accent" />
                      </div>
                      <span className="text-[10px] text-autronis-text-secondary uppercase tracking-wide font-medium">
                        Actieve tijd
                      </span>
                    </div>
                  </div>
                  {sessiesLoading ? (
                    <Skeleton className="h-7 w-20" />
                  ) : (
                    <p className="text-xl font-bold text-autronis-text-primary tabular-nums">
                      {formatTijd(stats?.totaalActief ?? 0)}
                    </p>
                  )}
                </div>

                {/* Productief % */}
                <div className={`bg-autronis-card border ${prodBorderColor} rounded-2xl p-4 card-glow`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                      </div>
                      <span className="text-[10px] text-autronis-text-secondary uppercase tracking-wide font-medium">
                        Productief
                      </span>
                    </div>
                    {prodTrend !== null && prodTrend !== 0 && (
                      <span className={`flex items-center gap-0.5 text-[10px] font-medium ${prodTrend > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {prodTrend > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {Math.abs(prodTrend)}%
                      </span>
                    )}
                  </div>
                  {sessiesLoading ? (
                    <Skeleton className="h-7 w-14" />
                  ) : (
                    <p className={`text-xl font-bold tabular-nums ${prodColor}`}>
                      {prodPct}
                      <span className="text-sm font-medium text-autronis-text-secondary ml-0.5">%</span>
                    </p>
                  )}
                </div>

                {/* Deep Work */}
                <div className={`bg-autronis-card border ${dwBorderColor} rounded-2xl p-4 card-glow`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0">
                        <Zap className="w-3.5 h-3.5 text-yellow-400" />
                      </div>
                      <span className="text-[10px] text-autronis-text-secondary uppercase tracking-wide font-medium">
                        Deep work
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold tabular-nums ${dwStatusColor}`}>{dwPct}%</span>
                  </div>
                  {sessiesLoading ? (
                    <Skeleton className="h-7 w-20" />
                  ) : (
                    <div>
                      <p className="text-xl font-bold text-autronis-text-primary tabular-nums">
                        {formatTijd((stats?.deepWorkMinuten ?? 0) * 60)}
                      </p>
                      <div className="w-full h-1.5 bg-autronis-border/30 rounded-full mt-2 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${dwBarColor}`} style={{ width: `${dwPct}%` }} />
                      </div>
                      <p className="text-[10px] text-autronis-text-secondary mt-1 tabular-nums">
                        van {formatTijd((stats?.deepWorkTarget ?? 240) * 60)} doel
                      </p>
                    </div>
                  )}
                </div>

                {/* Flow Score */}
                <div className={`bg-autronis-card border ${scoreBorderColor} rounded-2xl p-4 card-glow`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0">
                        <Brain className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                      <span className="text-[10px] text-autronis-text-secondary uppercase tracking-wide font-medium">
                        Flow Score
                      </span>
                    </div>
                    {scoreTrend !== null && scoreTrend !== 0 && (
                      <span className={`flex items-center gap-0.5 text-[10px] font-medium ${scoreTrend > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {scoreTrend > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {Math.abs(scoreTrend)}
                      </span>
                    )}
                  </div>
                  {sessiesLoading ? (
                    <Skeleton className="h-7 w-14" />
                  ) : (
                    <div>
                      <p className={`text-xl font-bold tabular-nums ${scoreColor}`}>
                        {score}<span className="text-sm font-medium text-autronis-text-secondary ml-1">/100</span>
                      </p>
                      {/* Flow score breakdown */}
                      <div className="mt-2 space-y-1">
                        {stats && stats.contextSwitches > 10 && (
                          <p className="text-[10px] text-autronis-text-secondary flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                            {stats.contextSwitches} switches
                          </p>
                        )}
                        {stats && stats.gemSessieLengte < 25 && (
                          <p className="text-[10px] text-autronis-text-secondary flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                            Korte sessies ({stats.gemSessieLengte}m)
                          </p>
                        )}
                        {stats && (stats.deepWorkMinuten ?? 0) < 60 && (
                          <p className="text-[10px] text-autronis-text-secondary flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                            Weinig deep work
                          </p>
                        )}
                        {score >= 70 && (
                          <p className={`text-[10px] font-medium ${scoreColor}`}>{scoreLabel}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Coaching panel */}
              {!sessiesLoading && adviezen.length > 0 && (
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-semibold text-autronis-text-primary">Vandaag</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {adviezen.map((advies, i) => {
                      const config = {
                        goed: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                        waarschuwing: { icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
                        kritiek: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
                      }[advies.type];
                      const AdviesIcon = config.icon;
                      return (
                        <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border text-xs ${config.bg}`}>
                          <AdviesIcon className={`w-3.5 h-3.5 shrink-0 ${config.color}`} />
                          <span className="text-autronis-text-primary">{advies.tekst}</span>
                        </div>
                      );
                    })}
                    {dwRemaining > 0 && dwPct < 75 && (
                      <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 border border-autronis-accent/30 bg-autronis-accent/10 text-xs text-autronis-accent font-medium hover:bg-autronis-accent/20 transition-colors">
                        <Play className="w-3 h-3" />
                        Start deep work blok
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Tab bar */}
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-1.5 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-autronis-accent/20 text-autronis-accent shadow-sm shadow-autronis-accent/10 border border-autronis-accent/20"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/40 border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Period selector */}
        {toonPeriodeSelector && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Periode toggle */}
            <div className="bg-autronis-card border border-autronis-border rounded-xl p-1 flex gap-1 w-fit">
              {PERIODES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPeriode(p.id);
                    setDatum(new Date());
                  }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    periode === p.id
                      ? "bg-autronis-accent/15 text-autronis-accent"
                      : "text-autronis-text-secondary hover:text-autronis-text-primary"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNavigeer(-1)}
                className="p-2 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/40 transition-colors"
                aria-label="Vorige periode"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleVandaag}
                className="px-3 py-1.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/40 rounded-lg transition-colors min-w-36 text-center font-medium"
              >
                {datumLabel(datum, periode)}
              </button>
              <button
                onClick={() => handleNavigeer(1)}
                className="p-2 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/40 transition-colors"
                aria-label="Volgende periode"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active tab content */}
        {activeTab === "tijdlijn" && <TabTijdlijn datum={van} periode={periode} />}
        {activeTab === "registraties" && <TabRegistraties />}
        {activeTab === "team" && <TabTeam van={van} tot={tot} />}
        {activeTab === "regels" && <TabRegelsSuggesties />}
      </div>
    </PageTransition>
  );
}
