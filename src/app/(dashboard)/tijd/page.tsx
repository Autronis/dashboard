"use client";

import { useState, useCallback } from "react";
import { Clock, Monitor, Users, Shield, Hash, Pause, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
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

  const stats = sessiesData?.stats ?? null;

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
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
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

            {/* Idle tijd */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-autronis-text-secondary/10 flex items-center justify-center shrink-0">
                  <Pause className="w-4 h-4 text-autronis-text-secondary" />
                </div>
                <span className="text-xs text-autronis-text-secondary uppercase tracking-wide font-medium">
                  Idle tijd
                </span>
              </div>
              {sessiesLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
                  {formatTijd(stats?.totaalIdle ?? 0)}
                </p>
              )}
            </div>

            {/* Productief % */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
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

            {/* Aantal sessies */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Hash className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs text-autronis-text-secondary uppercase tracking-wide font-medium">
                  Sessies
                </span>
              </div>
              {sessiesLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
                  {stats?.aantalSessies ?? 0}
                </p>
              )}
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
        {activeTab === "tijdlijn" && <TabTijdlijn datum={van} />}
        {activeTab === "registraties" && <TabRegistraties />}
        {activeTab === "team" && <TabTeam van={van} tot={tot} />}
        {activeTab === "regels" && <TabRegelsSuggesties />}
      </div>
    </PageTransition>
  );
}
