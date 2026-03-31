"use client";

import { useState } from "react";
import {
  Receipt, TrendingUp, PiggyBank, ShieldCheck, Sparkles,
  Loader2, CheckCircle2, AlertCircle, Gift, Calculator,
  AlertTriangle, ChevronDown,
} from "lucide-react";
import { cn, formatBedrag } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface FiscaleInvestering {
  id: number;
  naam: string;
  bedrag: number;
  datum: string;
  aiBeschrijving: string | null;
  kiaAftrek: number;
  btwBedrag: number;
  subsidieMogelijkheden: string[];
}

interface FiscaalOverzicht {
  investeringen: FiscaleInvestering[];
  totaalInvesteringen: number;
  totaalKIA: number;
  totaalBTWTerug: number;
  kiaRuimte: number;
  kiaMinimum: number;
  kiaMaximum: number;
  subsidieTransacties: number;
}

interface AnalyseData {
  fiscaal: FiscaalOverzicht;
  ongeanalyseerd: number;
}

const SUBSIDIE_INFO: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  WBSO: { label: "WBSO", color: "text-blue-400", bg: "bg-blue-500/15", desc: "R&D aftrek — innovatieve software/AI development" },
  MIA: { label: "MIA", color: "text-green-400", bg: "bg-green-500/15", desc: "Milieu-investeringsaftrek — duurzame bedrijfsmiddelen" },
  VAMIL: { label: "VAMIL", color: "text-emerald-400", bg: "bg-emerald-500/15", desc: "Willekeurige afschrijving milieu-investeringen" },
  EIA: { label: "EIA", color: "text-yellow-400", bg: "bg-yellow-500/15", desc: "Energie-investeringsaftrek — energiebesparend" },
};

async function fetchFiscaleData(): Promise<AnalyseData> {
  const res = await fetch("/api/bank/transacties/analyse");
  if (!res.ok) throw new Error("Kon fiscale data niet laden");
  return res.json() as Promise<AnalyseData>;
}

export function FiscaleVoordelenTab() {
  const queryClient = useQueryClient();
  const [analysing, setAnalysing] = useState(false);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["fiscale-voordelen"],
    queryFn: fetchFiscaleData,
    staleTime: 5 * 60_000, // Cache for 5 minutes
  });

  const runAnalyse = async () => {
    setAnalysing(true);
    try {
      await fetch("/api/bank/transacties/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      queryClient.invalidateQueries({ queryKey: ["fiscale-voordelen"] });
    } catch { /* ignore */ }
    setAnalysing(false);
  };

  if (loading || !data?.fiscaal) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-autronis-accent" />
      </div>
    );
  }

  const f = data.fiscaal;
  const kiaPercentage = f.kiaMaximum > 0
    ? Math.min(100, Math.round((f.totaalInvesteringen / f.kiaMaximum) * 100))
    : 0;
  const kiaInRange = f.totaalInvesteringen >= f.kiaMinimum && f.totaalInvesteringen <= f.kiaMaximum;

  // Group investments by quarter
  const perKwartaal = f.investeringen.reduce<Record<string, FiscaleInvestering[]>>((acc, inv) => {
    const month = new Date(inv.datum).getMonth();
    const q = `Q${Math.floor(month / 3) + 1}`;
    (acc[q] ??= []).push(inv);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Analyse knop als er ongeanalyseerde transacties zijn */}
      {data.ongeanalyseerd > 0 && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-sm font-semibold text-autronis-text-primary">{data.ongeanalyseerd} transacties wachten op AI analyse</p>
              <p className="text-xs text-autronis-text-secondary">Analyseer om fiscale voordelen te detecteren</p>
            </div>
          </div>
          <button onClick={runAnalyse} disabled={analysing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-sm font-semibold text-purple-400 hover:bg-purple-500/20 transition-all disabled:opacity-50">
            {analysing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyseren...</> : <><Sparkles className="w-4 h-4" /> Analyseer</>}
          </button>
        </div>
      )}

      {/* KPI's */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-autronis-accent" />
            <p className="text-xs text-autronis-text-secondary">Totaal investeringen</p>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary">
            <AnimatedNumber value={f.totaalInvesteringen} format={n => formatBedrag(n)} />
          </p>
          <p className="text-[10px] text-autronis-text-tertiary mt-1">{f.investeringen.length} transacties dit jaar</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="w-4 h-4 text-green-400" />
            <p className="text-xs text-autronis-text-secondary">KIA aftrek</p>
          </div>
          <p className={cn("text-2xl font-bold", kiaInRange ? "text-green-400" : "text-autronis-text-primary")}>
            <AnimatedNumber value={f.totaalKIA} format={n => formatBedrag(n)} />
          </p>
          {!kiaInRange && f.totaalInvesteringen < f.kiaMinimum && (
            <p className="text-[10px] text-orange-400 mt-1">Nog {formatBedrag(f.kiaMinimum - f.totaalInvesteringen)} investeren voor KIA</p>
          )}
          {kiaInRange && <p className="text-[10px] text-green-400 mt-1">KIA van toepassing</p>}
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-blue-400" />
            <p className="text-xs text-autronis-text-secondary">BTW terug te vragen</p>
          </div>
          <p className="text-2xl font-bold text-blue-400">
            <AnimatedNumber value={f.totaalBTWTerug} format={n => formatBedrag(n)} />
          </p>
          <p className="text-[10px] text-autronis-text-tertiary mt-1">21% BTW op zakelijke aankopen</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4 text-purple-400" />
            <p className="text-xs text-autronis-text-secondary">Subsidie mogelijkheden</p>
          </div>
          <p className="text-2xl font-bold text-purple-400">
            <AnimatedNumber value={f.subsidieTransacties} />
          </p>
          <p className="text-[10px] text-autronis-text-tertiary mt-1">transacties met subsidie-potentieel</p>
        </div>
      </div>

      {/* KIA Calculator */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-autronis-accent" />
          <h3 className="text-base font-bold text-autronis-text-primary">KIA Calculator {new Date().getFullYear()}</h3>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-autronis-text-secondary mb-1.5">
            <span>Geïnvesteerd: {formatBedrag(f.totaalInvesteringen)}</span>
            <span>Max: {formatBedrag(f.kiaMaximum)}</span>
          </div>
          <div className="h-3 bg-autronis-bg rounded-full overflow-hidden relative">
            {/* Min marker */}
            <div className="absolute h-full w-px bg-orange-400/60" style={{ left: `${(f.kiaMinimum / f.kiaMaximum) * 100}%` }} />
            {/* Fill */}
            <div className={cn("h-full rounded-full transition-all", kiaInRange ? "bg-green-500" : f.totaalInvesteringen < f.kiaMinimum ? "bg-orange-400" : "bg-red-400")}
              style={{ width: `${kiaPercentage}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-autronis-text-tertiary mt-1">
            <span>€0</span>
            <span className="text-orange-400">Min: {formatBedrag(f.kiaMinimum)}</span>
            <span>{formatBedrag(f.kiaMaximum)}</span>
          </div>
        </div>

        {/* KIA Info cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className={cn("rounded-xl p-3 border", kiaInRange ? "bg-green-500/5 border-green-500/20" : "bg-autronis-bg border-autronis-border")}>
            <p className="text-xs text-autronis-text-secondary">Status</p>
            <p className={cn("text-sm font-bold mt-0.5", kiaInRange ? "text-green-400" : "text-orange-400")}>
              {kiaInRange ? "Van toepassing" : f.totaalInvesteringen > f.kiaMaximum ? "Boven maximum" : "Onder minimum"}
            </p>
          </div>
          <div className="bg-autronis-bg rounded-xl p-3 border border-autronis-border">
            <p className="text-xs text-autronis-text-secondary">KIA voordeel</p>
            <p className="text-sm font-bold text-autronis-text-primary mt-0.5">{formatBedrag(f.totaalKIA)}</p>
          </div>
          <div className="bg-autronis-bg rounded-xl p-3 border border-autronis-border">
            <p className="text-xs text-autronis-text-secondary">Ruimte tot max</p>
            <p className="text-sm font-bold text-autronis-text-primary mt-0.5">{formatBedrag(f.kiaRuimte)}</p>
          </div>
        </div>
      </div>

      {/* Investeringen per kwartaal */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-autronis-border">
          <h3 className="text-base font-bold text-autronis-text-primary">Investeringen {new Date().getFullYear()}</h3>
        </div>
        {Object.keys(perKwartaal).length === 0 ? (
          <div className="p-6 text-center text-sm text-autronis-text-tertiary">
            Geen investeringen gedetecteerd. Analyseer transacties om te beginnen.
          </div>
        ) : (
          Object.entries(perKwartaal).sort().map(([kwartaal, items]) => {
            const totaal = items.reduce((s, i) => s + i.bedrag, 0);
            return (
              <details key={kwartaal} open className="group">
                <summary className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-autronis-bg/30 transition-all border-b border-autronis-border">
                  <div className="flex items-center gap-2">
                    <ChevronDown className="w-4 h-4 text-autronis-text-tertiary group-open:rotate-180 transition-transform" />
                    <span className="text-sm font-semibold text-autronis-text-primary">{kwartaal} {new Date().getFullYear()}</span>
                    <span className="text-xs text-autronis-text-tertiary">({items.length} items)</span>
                  </div>
                  <span className="text-sm font-bold text-autronis-text-primary tabular-nums">{formatBedrag(totaal)}</span>
                </summary>
                <div className="divide-y divide-autronis-border/50">
                  {items.map(inv => (
                    <div key={inv.id} className="px-6 py-3 flex items-center gap-4 hover:bg-autronis-bg/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-autronis-text-primary">{inv.naam}</p>
                        {inv.aiBeschrijving && <p className="text-xs text-autronis-text-secondary mt-0.5">{inv.aiBeschrijving}</p>}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] text-autronis-text-tertiary">{new Date(inv.datum).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</span>
                          {inv.kiaAftrek > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">
                              KIA: {formatBedrag(inv.kiaAftrek)}
                            </span>
                          )}
                          {inv.btwBedrag > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">
                              BTW terug: {formatBedrag(inv.btwBedrag)}
                            </span>
                          )}
                          {inv.subsidieMogelijkheden.map(sub => {
                            const info = SUBSIDIE_INFO[sub];
                            return info ? (
                              <span key={sub} className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", info.bg, info.color)} title={info.desc}>
                                {info.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-autronis-text-primary tabular-nums">{formatBedrag(inv.bedrag)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })
        )}
      </div>

      {/* Subsidie Tracker */}
      {f.subsidieTransacties > 0 && (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold text-autronis-text-primary">Subsidie Mogelijkheden</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(SUBSIDIE_INFO).map(([key, info]) => {
              const count = f.investeringen.filter(i => i.subsidieMogelijkheden.includes(key)).length;
              const totaal = f.investeringen.filter(i => i.subsidieMogelijkheden.includes(key)).reduce((s, i) => s + i.bedrag, 0);
              if (count === 0) return null;
              return (
                <div key={key} className={cn("rounded-xl p-4 border", info.bg, "border-transparent")}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("text-sm font-bold", info.color)}>{info.label}</span>
                    <span className="text-[10px] text-autronis-text-tertiary">({count}x)</span>
                  </div>
                  <p className="text-xs text-autronis-text-secondary mb-1">{info.desc}</p>
                  <p className={cn("text-lg font-bold tabular-nums", info.color)}>{formatBedrag(totaal)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Jaaroverzicht samenvatting */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-autronis-accent" />
            <h3 className="text-base font-bold text-autronis-text-primary">Fiscaal Jaaroverzicht {new Date().getFullYear()}</h3>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/api/belasting/export?type=csv&jaar=${new Date().getFullYear()}`} download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-autronis-bg border border-autronis-border rounded-lg text-xs font-medium text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/30 transition-all">
              CSV Export
            </a>
            <a href={`/api/belasting/export?type=btw&jaar=${new Date().getFullYear()}`} download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-autronis-bg border border-autronis-border rounded-lg text-xs font-medium text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/30 transition-all">
              BTW Export
            </a>
            <a href={`/api/belasting/export?type=winstverdeling&jaar=${new Date().getFullYear()}`} download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-autronis-bg border border-autronis-border rounded-lg text-xs font-medium text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/30 transition-all">
              Winstverdeling
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-autronis-bg rounded-xl p-4 border border-autronis-border">
            <p className="text-xs text-autronis-text-secondary">Totaal investeringen</p>
            <p className="text-lg font-bold text-autronis-text-primary mt-1 tabular-nums">{formatBedrag(f.totaalInvesteringen)}</p>
          </div>
          <div className="bg-autronis-bg rounded-xl p-4 border border-autronis-border">
            <p className="text-xs text-autronis-text-secondary">KIA aftrek</p>
            <p className="text-lg font-bold text-green-400 mt-1 tabular-nums">{formatBedrag(f.totaalKIA)}</p>
          </div>
          <div className="bg-autronis-bg rounded-xl p-4 border border-autronis-border">
            <p className="text-xs text-autronis-text-secondary">BTW terug te vragen</p>
            <p className="text-lg font-bold text-blue-400 mt-1 tabular-nums">{formatBedrag(f.totaalBTWTerug)}</p>
          </div>
        </div>

        {/* Alerts */}
        <div className="mt-4 space-y-2">
          {f.totaalInvesteringen >= f.kiaMinimum && f.totaalInvesteringen <= f.kiaMaximum && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/5 border border-green-500/20 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-xs text-green-400">KIA van toepassing — bewaar alle facturen voor je jaarrekening</p>
            </div>
          )}
          {f.totaalInvesteringen < f.kiaMinimum && f.totaalInvesteringen > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/5 border border-orange-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <p className="text-xs text-orange-400">Nog {formatBedrag(f.kiaMinimum - f.totaalInvesteringen)} investeren om voor KIA in aanmerking te komen</p>
            </div>
          )}
          {f.totaalBTWTerug > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-400">{formatBedrag(f.totaalBTWTerug)} BTW terug te vragen — neem op in je BTW-aangifte</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
