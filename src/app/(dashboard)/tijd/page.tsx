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

        {/* KPI cards — only on tijdlijn tab */}
        {activeTab === "tijdlijn" && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Actieve tijd */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-[#17B8A5]/15 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-autronis-accent" />
                </div>
                <span className="text-xs text-autronis-text-secondary uppercase tracking-wide font-medium">
                  Actieve tijd
                </span>
              </div>
              {sessiesLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
                  {formatTijd(stats?.totaalActief ?? 0)}
                </p>
              )}
            </div>

            {/* Productief % */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-xs text-autronis-text-secondary uppercase tracking-wide font-medium">
                  Productief
                </span>
              </div>
              {sessiesLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
                  {stats?.productiefPercentage ?? 0}
                  <span className="text-base font-medium text-autronis-text-secondary ml-0.5">%</span>
                </p>
              )}
            </div>

            {/* Deep Work — totale deep work tijd (sessies ≥25 min) */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-yellow-400" />
                </div>
                <span className="text-xs text-autronis-text-secondary uppercase tracking-wide font-medium">
                  Deep work
                </span>
              </div>
              {sessiesLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div>
                  <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
                    {formatTijd((stats?.deepWorkMinuten ?? 0) * 60)}
                  </p>
                  <div className="w-full h-1 bg-autronis-border/30 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${Math.min(100, ((stats?.deepWorkMinuten ?? 0) / (stats?.deepWorkTarget ?? 240)) * 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-autronis-text-secondary mt-1 tabular-nums">
                    van {formatTijd((stats?.deepWorkTarget ?? 240) * 60)} doel
                  </p>
                </div>
              )}
            </div>

            {/* Flow Score */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0">
                  <Brain className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-xs text-autronis-text-secondary uppercase tracking-wide font-medium">
                  Flow Score
                </span>
              </div>
              {sessiesLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (() => {
                const score = stats?.focusScore ?? 0;
                const color = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";
                const label = score >= 70 ? "Sterk" : score >= 40 ? "Kan beter" : "Zwak";
                return (
                  <div>
                    <p className={`text-2xl font-bold tabular-nums ${color}`}>
                      {score}<span className="text-sm font-medium text-autronis-text-secondary ml-1">/100</span>
                    </p>
                    <p className={`text-[10px] mt-1 font-medium ${color}`}>{label}</p>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-1.5 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-autronis-accent/15 text-autronis-accent"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/40"
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
