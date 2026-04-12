"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Clock, Monitor, Users, Shield, TrendingUp, ChevronLeft, ChevronRight, Brain, Zap, ArrowUp, ArrowDown } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { PageHeader } from "@/components/ui/page-header";
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

// ====== Animated progress bar ======
function AnimatedBar({
  pct,
  color,
}: {
  pct: number;
  color: string;
}) {
  const [width, setWidth] = useState(0);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      const id = setTimeout(() => setWidth(pct), 80);
      return () => clearTimeout(id);
    }
    setWidth(pct);
  }, [pct]);
  return (
    <div className="w-full h-1.5 bg-autronis-border/30 rounded-full mt-2 overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${width}%`, transition: "width 700ms cubic-bezier(0.4,0,0.2,1)" }}
      />
    </div>
  );
}

// ====== Circular progress ring ======
function CircularScore({
  score,
  color,
}: {
  score: number;
  color: string;
}) {
  const [animScore, setAnimScore] = useState(0);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      const id = setTimeout(() => setAnimScore(score), 80);
      return () => clearTimeout(id);
    }
    setAnimScore(score);
  }, [score]);

  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (animScore / 100) * circ;

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-autronis-border/30" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}

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
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-5">

        <PageHeader
          title="Tijd"
          description="Schermtijd, sessies en tijdregistraties"
          actions={<TimerStrip />}
        />

        {/* KPI cards + coaching — only on tijdlijn tab */}
        {activeTab === "tijdlijn" && (() => {
          const dwPct = stats ? Math.min(100, Math.round(((stats.deepWorkMinuten ?? 0) / (stats.deepWorkTarget ?? 240)) * 100)) : 0;
          const dwRemaining = Math.max(0, (stats?.deepWorkTarget ?? 240) - (stats?.deepWorkMinuten ?? 0));
          const score = stats?.focusScore ?? 0;
          const scoreColor = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";
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

          // Time-aware reflective insight — no fake CTAs, just honest observation
          const uur = new Date().getHours();
          const dagFase: "ochtend" | "middag" | "laat" = uur < 12 ? "ochtend" : uur < 17 ? "middag" : "laat";

          const inzicht: { tekst: string; type: "neutraal" | "waarschuwing" | "goed" } | null = stats ? (() => {
            // Goed bezig
            if (dwPct >= 75 && prodPct >= 70) return { tekst: `Sterke dag — ${formatTijd((stats.deepWorkMinuten ?? 0) * 60)} deep work, ${prodPct}% productief`, type: "goed" as const };
            if (dwPct >= 75) return { tekst: `Deep work target gehaald (${dwPct}%) — goed geconcentreerd vandaag`, type: "goed" as const };

            // Ochtend — nog vroeg, geen druk
            if (dagFase === "ochtend") {
              if (stats.totaalActief < 1800) return { tekst: "Je dag is net begonnen — focusmomenten komen later", type: "neutraal" as const };
              if (dwPct > 0) return { tekst: `${formatTijd((stats.deepWorkMinuten ?? 0) * 60)} deep work tot nu toe — goede start`, type: "neutraal" as const };
              return { tekst: "Nog geen diepe focus gehad — ochtend is je beste moment", type: "neutraal" as const };
            }

            // Middag — zachtere feedback
            if (dagFase === "middag") {
              if ((stats.deepWorkMinuten ?? 0) < 30) return { tekst: "Je hebt nog weinig diepe focus gehad vandaag", type: "waarschuwing" as const };
              if (stats.gemSessieLengte < 20) return { tekst: `Je sessies zijn kort (gem. ${stats.gemSessieLengte}m) — je wordt vaak onderbroken`, type: "waarschuwing" as const };
              if (stats.contextSwitches > 20) return { tekst: `Veel gewisseld vandaag (${stats.contextSwitches}x) — je werk is versnipperd`, type: "waarschuwing" as const };
              return { tekst: `${formatTijd((stats.deepWorkMinuten ?? 0) * 60)} deep work — nog ruimte voor een focusblok`, type: "neutraal" as const };
            }

            // Laat — eerlijke reflectie
            if ((stats.deepWorkMinuten ?? 0) < 60) return { tekst: "Weinig deep work vandaag — je werk was versnipperd", type: "waarschuwing" as const };
            if (stats.gemSessieLengte < 20) return { tekst: `Korte sessies vandaag (gem. ${stats.gemSessieLengte}m) — veel onderbrekingen`, type: "waarschuwing" as const };
            if (prodPct < 60) return { tekst: `${prodPct}% productief — meer tijd naar afleiding gegaan dan normaal`, type: "waarschuwing" as const };
            return { tekst: `${formatTijd((stats.deepWorkMinuten ?? 0) * 60)} deep work, ${prodPct}% productief`, type: "neutraal" as const };
          })() : null;

          // Secondary context signals
          const secondair: Array<{ type: "goed" | "waarschuwing"; tekst: string }> = [];
          if (stats) {
            if (prodPct >= 80) secondair.push({ type: "goed", tekst: `${prodPct}% productief` });
            else if (prodPct < 60 && dagFase !== "ochtend") secondair.push({ type: "waarschuwing", tekst: `${prodPct}% productief` });
            if (stats.contextSwitches > 15) secondair.push({ type: "waarschuwing", tekst: `${stats.contextSwitches} switches` });
            if (score >= 70) secondair.push({ type: "goed", tekst: `Flow ${score}` });
            if (stats.langsteFocusMinuten >= 45) secondair.push({ type: "goed", tekst: `${stats.langsteFocusMinuten}m langste focus` });
          }

          // Flow score breakdown reasons
          const flowRedenen: string[] = [];
          if (stats) {
            if (stats.contextSwitches > 10) flowRedenen.push(`${stats.contextSwitches} switches`);
            if (stats.gemSessieLengte < 25) flowRedenen.push(`korte sessies (${stats.gemSessieLengte}m)`);
            if ((stats.deepWorkMinuten ?? 0) < 60) flowRedenen.push("weinig deep work");
            if (stats.afleidingMinuten > 15) flowRedenen.push(`${stats.afleidingMinuten}m afleiding`);
          }

          return (
            <>
              {/* Focus advies — reflective, time-aware */}
              {!sessiesLoading && inzicht && (
                <div className={`rounded-2xl px-4 py-3.5 border ${
                  inzicht.type === "waarschuwing" ? "bg-amber-500/6 border-amber-500/15" :
                  inzicht.type === "goed" ? "bg-emerald-500/6 border-emerald-500/15" :
                  "bg-autronis-card border-autronis-border"
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        inzicht.type === "goed" ? "bg-emerald-400" :
                        inzicht.type === "waarschuwing" ? "bg-amber-400" :
                        "bg-autronis-text-secondary/40"
                      }`} />
                      <p className="text-sm text-autronis-text-primary">
                        {inzicht.tekst}
                      </p>
                    </div>
                    {secondair.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:ml-auto shrink-0 pl-5 sm:pl-0">
                        {secondair.map((s, i) => (
                          <span key={i} className="flex items-center gap-1 text-[11px] text-autronis-text-secondary">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.type === "goed" ? "bg-emerald-400" : "bg-amber-400"}`} />
                            {s.tekst}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* KPI cards */}
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
                        <span className="text-xs font-medium text-autronis-text-secondary ml-1">/ {formatTijd((stats?.deepWorkTarget ?? 240) * 60)}</span>
                      </p>
                      <AnimatedBar pct={dwPct} color={dwBarColor} />
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
                    <Skeleton className="h-14 w-14 rounded-full" />
                  ) : (
                    <div className="flex items-center gap-3">
                      <CircularScore
                        score={score}
                        color={score >= 70 ? "#34d399" : score >= 40 ? "#fbbf24" : "#f87171"}
                      />
                      <div className="min-w-0">
                        {flowRedenen.length > 0 && score < 70 ? (
                          <p className="text-[10px] text-autronis-text-secondary leading-relaxed">
                            {flowRedenen.join(" · ")}
                          </p>
                        ) : score >= 70 ? (
                          <p className="text-[10px] text-emerald-400 font-medium">Sterke focus</p>
                        ) : (
                          <p className="text-[10px] text-autronis-text-secondary">Geen data</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          );
        })()}

        {/* Tab bar */}
        <div className="bg-autronis-card border border-autronis-border rounded-full p-1 flex gap-0.5 overflow-x-auto w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-autronis-accent text-white shadow-md shadow-autronis-accent/25"
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
