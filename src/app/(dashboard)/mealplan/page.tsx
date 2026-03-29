"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ChefHat, Flame, Beef, Wheat, Droplets, Cookie, Salad, ChevronDown, ChevronUp, Settings2, Shuffle, ShoppingCart, Euro } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";

interface Ingredient {
  naam: string;
  hoeveelheid: string;
  kcal: number;
  eiwit: number;
  kh: number;
  vet: number;
  vezels: number;
  suiker: number;
}

interface Maaltijd {
  type: string;
  naam: string;
  beschrijving: string;
  ingredienten: Ingredient[];
  totaal: { kcal: number; eiwit: number; kh: number; vet: number; vezels: number; suiker: number };
}

interface Dag {
  dag: string;
  maaltijden: Maaltijd[];
  dagTotaal: { kcal: number; eiwit: number; kh: number; vet: number; vezels: number; suiker: number };
}

interface BoodschapItem {
  product: string;
  hoeveelheid: string;
  prijs: number;
  afdeling: string;
}

interface WeekPlan {
  dagen: Dag[];
  boodschappenlijst: BoodschapItem[];
  totaalPrijs: number;
  weekTotaal: { kcal: number; eiwit: number; kh: number; vet: number; vezels: number; suiker: number };
}

const typeIcons: Record<string, string> = {
  ontbijt: "🌅",
  lunch: "☀️",
  tussendoor: "🥜",
  avondeten: "🌙",
  avondsnack: "🍫",
};

const dagKleuren: Record<string, string> = {
  Maandag: "border-l-blue-500",
  Dinsdag: "border-l-emerald-500",
  Woensdag: "border-l-amber-500",
  Donderdag: "border-l-purple-500",
  Vrijdag: "border-l-pink-500",
  Zaterdag: "border-l-cyan-500",
  Zondag: "border-l-orange-500",
};

const macroKleuren = {
  kcal: { text: "text-orange-400", bar: "bg-orange-500" },
  eiwit: { text: "text-red-400", bar: "bg-red-500" },
  kh: { text: "text-blue-400", bar: "bg-blue-500" },
  vet: { text: "text-yellow-400", bar: "bg-yellow-500" },
  vezels: { text: "text-green-400", bar: "bg-green-500" },
  suiker: { text: "text-pink-400", bar: "bg-pink-500" },
};

export default function MealPlanPage() {
  const [kcal, setKcal] = useState(2750);
  const [eiwit, setEiwit] = useState(190);
  const [koolhydraten, setKoolhydraten] = useState(300);
  const [vezels, setVezels] = useState(30);
  const [suiker, setSuiker] = useState(60);
  const [vet, setVet] = useState(110);
  const [voorkeuren, setVoorkeuren] = useState("");
  const [uitsluitingen, setUitsluitingen] = useState("");

  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeDay, setActiveDay] = useState("Maandag");
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [showBoodschappen, setShowBoodschappen] = useState(false);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mealplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kcal, eiwit, koolhydraten, vezels, suiker, vet, voorkeuren, uitsluitingen }),
      });
      if (!res.ok) throw new Error("Genereren mislukt");
      const data = await res.json();
      setPlan(data);
      setShowSettings(false);
      setActiveDay("Maandag");
    } catch {
      // error silently
    } finally {
      setLoading(false);
    }
  };

  const macroBar = (label: string, waarde: number, target: number, kleur: keyof typeof macroKleuren) => {
    const pct = Math.min((waarde / target) * 100, 100);
    const diff = waarde - target;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className={cn("font-medium", macroKleuren[kleur].text)}>{label}</span>
          <span className="text-autronis-text-secondary">
            {waarde}<span className="text-autronis-text-secondary/50">/{target}</span>
            {diff !== 0 && <span className={cn("ml-1 text-[10px]", diff > 0 ? "text-orange-400" : "text-blue-400")}>({diff > 0 ? "+" : ""}{diff})</span>}
          </span>
        </div>
        <div className="h-1.5 bg-autronis-border/30 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} className={cn("h-full rounded-full", macroKleuren[kleur].bar)} />
        </div>
      </div>
    );
  };

  const activeDag = plan?.dagen.find((d) => d.dag === activeDay);

  // Group boodschappen by afdeling
  const boodschappenPerAfdeling = plan?.boodschappenlijst.reduce((acc, item) => {
    const afd = item.afdeling || "overig";
    if (!acc[afd]) acc[afd] = [];
    acc[afd].push(item);
    return acc;
  }, {} as Record<string, BoodschapItem[]>);

  return (
    <PageTransition>
      <div className="max-w-[1100px] mx-auto p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-autronis-text-primary tracking-tight flex items-center gap-3">
              <ChefHat className="w-7 h-7 text-autronis-accent" />
              Weekplanner
            </h1>
            <p className="text-sm text-autronis-text-secondary mt-1">AI-gegenereerd weekmenu op basis van je macro&apos;s</p>
          </div>
          <div className="flex items-center gap-2">
            {plan && (
              <>
                <button onClick={() => setShowBoodschappen(!showBoodschappen)} className={cn("p-2 rounded-xl border transition-colors", showBoodschappen ? "bg-autronis-accent/15 border-autronis-accent/30 text-autronis-accent" : "bg-autronis-card border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30")}>
                  <ShoppingCart className="w-4 h-4" />
                </button>
                <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-xl bg-autronis-card border border-autronis-border hover:border-autronis-accent/30 transition-colors">
                  <Settings2 className="w-4 h-4 text-autronis-text-secondary" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Settings */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 space-y-4">
                <p className="text-sm font-medium text-autronis-text-primary">Macro targets per dag</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: "Calorieën", value: kcal, set: setKcal, icon: Flame, unit: "kcal", color: "text-orange-400" },
                    { label: "Eiwit", value: eiwit, set: setEiwit, icon: Beef, unit: "g", color: "text-red-400" },
                    { label: "Koolhydraten", value: koolhydraten, set: setKoolhydraten, icon: Wheat, unit: "g", color: "text-blue-400" },
                    { label: "Vet", value: vet, set: setVet, icon: Droplets, unit: "g", color: "text-yellow-400" },
                    { label: "Vezels", value: vezels, set: setVezels, icon: Salad, unit: "g", color: "text-green-400" },
                    { label: "Suiker", value: suiker, set: setSuiker, icon: Cookie, unit: "g", color: "text-pink-400" },
                  ].map((m) => (
                    <div key={m.label} className="space-y-1">
                      <label className={cn("text-[11px] font-medium flex items-center gap-1", m.color)}>
                        <m.icon className="w-3 h-3" />{m.label}
                      </label>
                      <div className="flex items-center gap-1">
                        <input type="number" value={m.value} onChange={(e) => m.set(Number(e.target.value))} className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent/50" />
                        <span className="text-[10px] text-autronis-text-secondary/50 w-6">{m.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-autronis-text-secondary">Voorkeuren</label>
                    <input type="text" value={voorkeuren} onChange={(e) => setVoorkeuren(e.target.value)} placeholder="bijv. Veel kip, Simpel, Aziatisch" className="w-full mt-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/30 focus:outline-none focus:border-autronis-accent/50" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-autronis-text-secondary">Uitsluitingen</label>
                    <input type="text" value={uitsluitingen} onChange={(e) => setUitsluitingen(e.target.value)} placeholder="bijv. Geen vis, Lactosevrij" className="w-full mt-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/30 focus:outline-none focus:border-autronis-accent/50" />
                  </div>
                </div>
                <button onClick={generatePlan} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-autronis-accent hover:bg-autronis-accent/80 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition-colors">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChefHat className="w-4 h-4" />}
                  {loading ? "Weekplan genereren..." : "Genereer weekplan"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && !plan && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-autronis-accent animate-spin" />
            <p className="text-sm text-autronis-text-secondary">AI stelt je weekplan samen...</p>
          </div>
        )}

        {plan && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Day tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {plan.dagen.map((dag) => (
                <button
                  key={dag.dag}
                  onClick={() => { setActiveDay(dag.dag); setExpandedMeal(null); }}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
                    activeDay === dag.dag ? "bg-autronis-accent text-white" : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
                  )}
                >
                  {dag.dag.slice(0, 2)}
                </button>
              ))}
              <div className="flex-1" />
              <button onClick={generatePlan} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-autronis-accent/15 hover:bg-autronis-accent/25 text-autronis-accent rounded-xl text-xs font-medium transition-colors disabled:opacity-40 flex-shrink-0">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shuffle className="w-3 h-3" />}
                Varieer
              </button>
            </div>

            {/* Macro overview for active day */}
            {activeDag && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4">
                <p className="text-xs font-medium text-autronis-text-secondary/50 mb-3">{activeDay} — dag totaal</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {macroBar("Kcal", activeDag.dagTotaal.kcal, kcal, "kcal")}
                  {macroBar("Eiwit", activeDag.dagTotaal.eiwit, eiwit, "eiwit")}
                  {macroBar("KH", activeDag.dagTotaal.kh, koolhydraten, "kh")}
                  {macroBar("Vet", activeDag.dagTotaal.vet, vet, "vet")}
                  {macroBar("Vezels", activeDag.dagTotaal.vezels, vezels, "vezels")}
                  {macroBar("Suiker", activeDag.dagTotaal.suiker, suiker, "suiker")}
                </div>
              </div>
            )}

            {/* Meals for active day */}
            {activeDag && (
              <div className="space-y-3">
                {activeDag.maaltijden.map((maaltijd, i) => {
                  const mealKey = `${activeDay}-${maaltijd.type}`;
                  const isExpanded = expandedMeal === mealKey;
                  return (
                    <motion.div
                      key={mealKey}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={cn("bg-autronis-card border border-autronis-border hover:border-autronis-accent/20 rounded-2xl overflow-hidden transition-colors border-l-[3px]", dagKleuren[activeDay] || "border-l-autronis-accent")}
                    >
                      <button onClick={() => setExpandedMeal(isExpanded ? null : mealKey)} className="w-full flex items-center gap-4 p-4">
                        <span className="text-2xl">{typeIcons[maaltijd.type] || "🍽️"}</span>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-xs text-autronis-text-secondary/50 uppercase tracking-wider">{maaltijd.type}</p>
                          <p className="text-sm font-medium text-autronis-text-primary mt-0.5">{maaltijd.naam}</p>
                          <p className="text-xs text-autronis-text-secondary/60 mt-1 line-clamp-1">{maaltijd.beschrijving}</p>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-autronis-text-secondary/60 flex-shrink-0">
                          <span>{maaltijd.totaal.kcal} kcal</span>
                          <span className="text-red-400/60">{maaltijd.totaal.eiwit}g E</span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-autronis-text-secondary/40 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-autronis-text-secondary/40 flex-shrink-0" />}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <div className="px-4 pb-4 border-t border-autronis-border/30">
                              {/* Bereiding */}
                              <div className="mt-3 p-3 bg-autronis-accent/5 rounded-xl">
                                <p className="text-xs text-autronis-text-primary">{maaltijd.beschrijving}</p>
                              </div>

                              {/* Ingredients */}
                              <table className="w-full mt-3">
                                <thead>
                                  <tr className="text-[10px] text-autronis-text-secondary/50 uppercase">
                                    <th className="text-left py-1 font-medium">Ingrediënt</th>
                                    <th className="text-right py-1 font-medium">Hoev.</th>
                                    <th className="text-right py-1 font-medium">Kcal</th>
                                    <th className="text-right py-1 font-medium">Eiwit</th>
                                    <th className="text-right py-1 font-medium">KH</th>
                                    <th className="text-right py-1 font-medium">Vet</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {maaltijd.ingredienten.map((ing, j) => (
                                    <tr key={j} className="text-xs text-autronis-text-secondary border-t border-autronis-border/10">
                                      <td className="py-1.5 text-autronis-text-primary">{ing.naam}</td>
                                      <td className="py-1.5 text-right">{ing.hoeveelheid}</td>
                                      <td className="py-1.5 text-right">{ing.kcal}</td>
                                      <td className="py-1.5 text-right text-red-400/60">{ing.eiwit}g</td>
                                      <td className="py-1.5 text-right text-blue-400/60">{ing.kh}g</td>
                                      <td className="py-1.5 text-right text-yellow-400/60">{ing.vet}g</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Boodschappenlijst */}
            <AnimatePresence>
              {showBoodschappen && boodschappenPerAfdeling && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="bg-autronis-card border border-emerald-500/30 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-medium text-autronis-text-primary">Boodschappenlijst — Lidl</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-emerald-500/15 px-3 py-1.5 rounded-lg">
                        <Euro className="w-3 h-3 text-emerald-400" />
                        <span className="text-sm font-bold text-emerald-400">€{plan.totaalPrijs?.toFixed(2) || "0.00"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {Object.entries(boodschappenPerAfdeling).map(([afdeling, items]) => (
                        <div key={afdeling}>
                          <p className="text-[10px] uppercase tracking-wider text-autronis-text-secondary/50 font-medium mb-2">{afdeling}</p>
                          <div className="space-y-1">
                            {items.map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-autronis-border/10 last:border-0">
                                <div className="flex-1 min-w-0">
                                  <span className="text-autronis-text-primary">{item.product}</span>
                                  <span className="text-autronis-text-secondary/40 ml-2">{item.hoeveelheid}</span>
                                </div>
                                <span className="text-autronis-text-secondary flex-shrink-0 ml-2">€{item.prijs.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
