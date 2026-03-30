"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ChefHat, Flame, Beef, Wheat, Droplets, Cookie, Salad, ChevronDown, ChevronUp, Settings2, Shuffle, ShoppingCart, Euro, CheckCircle2, MessageSquare, Send } from "lucide-react";
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
  nodig: string;
  over: string;
  overWaarde?: number;
  prijs: number;
  prijsPerEenheid: string;
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
  const savedSettings = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("autronis-mealplan-settings") || "null") : null;
  const [kcal, setKcal] = useState(savedSettings?.kcal ?? 2750);
  const [eiwit, setEiwit] = useState(savedSettings?.eiwit ?? 190);
  const [koolhydraten, setKoolhydraten] = useState(savedSettings?.koolhydraten ?? 300);
  const [vezels, setVezels] = useState(savedSettings?.vezels ?? 30);
  const [suiker, setSuiker] = useState(savedSettings?.suiker ?? 60);
  const [vet, setVet] = useState(savedSettings?.vet ?? 110);
  const [voorkeuren, setVoorkeuren] = useState(savedSettings?.voorkeuren ?? "");
  const [uitsluitingen, setUitsluitingen] = useState(savedSettings?.uitsluitingen ?? "");

  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [activeDay, setActiveDay] = useState("Maandag");
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [showBoodschappen, setShowBoodschappen] = useState(false);

  // AI chat for preferences
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("autronis-mealplan-chat") || "[]"); } catch { return []; }
  });
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatMessages.length > 0) localStorage.setItem("autronis-mealplan-chat", JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: msg }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/mealplan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bericht: msg,
          huidigeVoorkeuren: voorkeuren,
          huidigeUitsluitingen: uitsluitingen,
          chatHistorie: chatMessages.slice(-10),
        }),
      });
      const data = await res.json() as { antwoord: string; voorkeuren?: string; uitsluitingen?: string };
      setChatMessages(prev => [...prev, { role: "ai", text: data.antwoord }]);
      if (data.voorkeuren !== undefined) setVoorkeuren(data.voorkeuren);
      if (data.uitsluitingen !== undefined) setUitsluitingen(data.uitsluitingen);
    } catch {
      setChatMessages(prev => [...prev, { role: "ai", text: "Sorry, er ging iets mis. Probeer opnieuw." }]);
    }
    setChatLoading(false);
  };

  // Auto-save settings on change
  useEffect(() => {
    localStorage.setItem("autronis-mealplan-settings", JSON.stringify({ kcal, eiwit, koolhydraten, vezels, suiker, vet, voorkeuren, uitsluitingen }));
  }, [kcal, eiwit, koolhydraten, vezels, suiker, vet, voorkeuren, uitsluitingen]);

  const [progress, setProgress] = useState(0);

  // Poll server for plan status — server is single source of truth
  useEffect(() => {
    const poll = () => {
      fetch("/api/mealplan")
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (!data) return;
          if (data.status === "done" && data.plan) {
            setPlan(prev => {
              // Only close settings when plan FIRST arrives (prev was null)
              if (!prev) setShowSettings(false);
              return data.plan;
            });
            setLoading(false);
            setProgress(8);
          } else if (data.status === "generating" || data.status === "pending") {
            setLoading(true);
            setProgress(data.progress || 0);
          } else if (data.status === "error") {
            setLoading(false);
            setShowSettings(true);
            setProgress(0);
          } else if (data.status === "none") {
            // No plan exists — show settings
            if (!initialLoaded) setShowSettings(true);
          }
          setInitialLoaded(true);
        })
        .catch(() => {});
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [initialLoaded]);

  // Shared generation logic
  const doGenerate = async (extraParams?: Record<string, unknown>) => {
    setLoading(true);
    setShowSettings(false);
    setPlan(null);
    try {
      const res = await fetch("/api/mealplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kcal, eiwit, koolhydraten, vezels, suiker, vet, voorkeuren, uitsluitingen, ...extraParams }),
      });
      const data = await res.json() as { status: string; plan?: WeekPlan };
      if (data.status === "done" && data.plan) {
        setPlan(data.plan);
        setActiveDay("Maandag");
        setExpandedMeals(new Set());
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  // Nieuw weekplan — geen restjes, volledig vers
  const generatePlan = () => doGenerate();

  // Week voltooid → sla restjes op en genereer nieuw plan dat restjes meeneemt
  const weekVoltooid = () => {
    if (!plan?.boodschappenlijst) return;
    const restjes = plan.boodschappenlijst
      .filter((item: BoodschapItem) => item.over && item.over !== "0" && item.over !== "0g" && item.over !== "0ml" && item.over !== "0 stuks")
      .map((item: BoodschapItem) => ({ product: item.product, hoeveelheid: item.over, afdeling: item.afdeling }));
    localStorage.setItem("autronis-mealplan-restjes", JSON.stringify(restjes));
    doGenerate({ restjes });
  };

  // Load saved restjes
  const opgeslagenRestjes = typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("autronis-mealplan-restjes") || "[]") as { product: string; hoeveelheid: string }[]
    : [];

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
                {/* AI Chat voor voorkeuren */}
                <div className="bg-autronis-bg border border-autronis-border rounded-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-autronis-border flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-autronis-accent" />
                    <span className="text-xs font-semibold text-autronis-text-primary">Vertel wat je wilt</span>
                    <span className="text-[10px] text-autronis-text-tertiary">— AI past je voorkeuren aan</span>
                    {chatMessages.length > 0 && (
                      <button onClick={() => { setChatMessages([]); localStorage.removeItem("autronis-mealplan-chat"); }} className="ml-auto text-[10px] text-autronis-text-tertiary hover:text-red-400">Wis chat</button>
                    )}
                  </div>
                  {/* Messages */}
                  <div className="max-h-48 overflow-y-auto px-3 py-2 space-y-2">
                    {chatMessages.length === 0 && (
                      <p className="text-[11px] text-autronis-text-tertiary italic py-2">
                        Bijv: &quot;ik wil pasta pesto met kip maar geen spaghetti&quot;, &quot;gebruik Lidl protein shakes&quot;, &quot;meer boter en kaas gebruiken&quot;, &quot;geen cottage cheese&quot;
                      </p>
                    )}
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={cn("text-xs rounded-lg px-3 py-2 max-w-[85%]", msg.role === "user" ? "bg-autronis-accent/15 text-autronis-accent ml-auto" : "bg-autronis-border/30 text-autronis-text-primary")}>
                        {msg.text}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex items-center gap-1.5 text-xs text-autronis-text-tertiary">
                        <Loader2 className="w-3 h-3 animate-spin" /> Denken...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  {/* Input */}
                  <div className="flex gap-2 px-3 py-2 border-t border-autronis-border">
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendChat()}
                      placeholder="Bijv: ik wil meer pasta, geen cottage cheese, gebruik boter bij het bakken..."
                      className="flex-1 bg-transparent text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/30 focus:outline-none"
                    />
                    <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="p-1.5 text-autronis-accent hover:text-autronis-accent-hover disabled:opacity-30 transition-all">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Current preferences summary */}
                {(voorkeuren || uitsluitingen) && (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {voorkeuren && <span className="px-2 py-1 bg-autronis-accent/10 text-autronis-accent rounded-lg">Voorkeuren: {voorkeuren}</span>}
                    {uitsluitingen && <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded-lg">Niet: {uitsluitingen}</span>}
                  </div>
                )}
                <button onClick={generatePlan} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-autronis-accent hover:bg-autronis-accent/80 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition-colors">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChefHat className="w-4 h-4" />}
                  {loading ? "Weekplan genereren..." : "Genereer weekplan"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading with progress */}
        {loading && !plan && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-8 h-8 text-autronis-accent animate-spin" />
            <p className="text-sm text-autronis-text-secondary">
              {progress === 0 ? "Starten..." : progress <= 7 ? `Dag ${progress}/7 genereren...` : "Boodschappenlijst maken..."}
            </p>
            <div className="w-48 h-2 bg-autronis-border/30 rounded-full overflow-hidden">
              <motion.div animate={{ width: `${(progress / 8) * 100}%` }} className="h-full bg-autronis-accent rounded-full" />
            </div>
          </div>
        )}

        {plan && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Restjes banner */}
            {opgeslagenRestjes.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap">
                <Salad className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="text-[11px] text-amber-400 font-medium">Restjes van vorige week meegenomen:</span>
                {opgeslagenRestjes.slice(0, 8).map((r, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 rounded text-amber-400/80">{r.product} ({r.hoeveelheid})</span>
                ))}
                {opgeslagenRestjes.length > 8 && <span className="text-[10px] text-amber-400/50">+{opgeslagenRestjes.length - 8} meer</span>}
                <button onClick={() => { localStorage.removeItem("autronis-mealplan-restjes"); window.location.reload(); }} className="ml-auto text-[10px] text-amber-400/50 hover:text-amber-400">Wis</button>
              </div>
            )}

            {/* Day tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {plan.dagen.map((dag) => (
                <button
                  key={dag.dag}
                  onClick={() => { setActiveDay(dag.dag); setExpandedMeals(new Set()); }}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
                    activeDay === dag.dag ? "bg-autronis-accent text-white" : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
                  )}
                >
                  {dag.dag.slice(0, 2)}
                </button>
              ))}
              <div className="flex-1" />
              <button onClick={() => setShowSettings(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-autronis-bg border border-autronis-border hover:border-autronis-accent/30 text-autronis-text-secondary rounded-xl text-xs font-medium transition-colors flex-shrink-0">
                <Settings2 className="w-3 h-3" />
              </button>
              <button onClick={generatePlan} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-autronis-bg border border-autronis-border hover:border-autronis-accent/30 text-autronis-text-secondary rounded-xl text-xs font-medium transition-colors disabled:opacity-40 flex-shrink-0" title="Volledig nieuw plan zonder restjes">
                <Shuffle className="w-3 h-3" />
                Nieuw
              </button>
              <button onClick={weekVoltooid} disabled={loading || !plan?.boodschappenlijst?.length} className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-medium transition-colors disabled:opacity-40 flex-shrink-0" title="Sla restjes op en genereer nieuw plan dat restjes meeneemt">
                <CheckCircle2 className="w-3 h-3" />
                Week voltooid → nieuw
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
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      if (!activeDag) return;
                      const allKeys = activeDag.maaltijden.map((m, i) => `${activeDay}-${m.type}-${i}`);
                      const allOpen = allKeys.every(k => expandedMeals.has(k));
                      setExpandedMeals(allOpen ? new Set() : new Set(allKeys));
                    }}
                    className="text-[10px] text-autronis-text-tertiary hover:text-autronis-accent transition-all"
                  >
                    {activeDag.maaltijden.every((m, i) => expandedMeals.has(`${activeDay}-${m.type}-${i}`)) ? "Alles inklappen" : "Alles uitklappen"}
                  </button>
                </div>
                {activeDag.maaltijden.map((maaltijd, i) => {
                  const mealKey = `${activeDay}-${maaltijd.type}-${i}`;
                  const isExpanded = expandedMeals.has(mealKey);
                  return (
                    <motion.div
                      key={mealKey}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={cn("bg-autronis-card border border-autronis-border hover:border-autronis-accent/20 rounded-2xl overflow-hidden transition-colors border-l-[3px]", dagKleuren[activeDay] || "border-l-autronis-accent")}
                    >
                      <button onClick={() => setExpandedMeals(prev => { const n = new Set(prev); if (n.has(mealKey)) n.delete(mealKey); else n.add(mealKey); return n; })} className="w-full flex items-center gap-4 p-4">
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

            {/* Week totaal macros */}
            {plan.weekTotaal && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
                <p className="text-sm font-medium text-autronis-text-primary mb-3 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" /> Week Totaal
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {[
                    { label: "Kcal", value: plan.weekTotaal.kcal, target: kcal * 7, color: "text-orange-400" },
                    { label: "Eiwit", value: plan.weekTotaal.eiwit, target: eiwit * 7, unit: "g", color: "text-red-400" },
                    { label: "Koolh.", value: plan.weekTotaal.kh, target: koolhydraten * 7, unit: "g", color: "text-blue-400" },
                    { label: "Vet", value: plan.weekTotaal.vet, target: vet * 7, unit: "g", color: "text-yellow-400" },
                    { label: "Vezels", value: plan.weekTotaal.vezels, target: vezels * 7, unit: "g", color: "text-green-400" },
                    { label: "Suiker", value: plan.weekTotaal.suiker, target: suiker * 7, unit: "g", color: "text-pink-400" },
                  ].map(m => (
                    <div key={m.label} className="text-center bg-autronis-bg rounded-xl p-2.5">
                      <p className="text-[10px] text-autronis-text-secondary/50 uppercase">{m.label}</p>
                      <p className={cn("text-base font-bold tabular-nums", m.color)}>{Math.round(m.value)}{m.unit}</p>
                      <p className="text-[10px] text-autronis-text-secondary/30 tabular-nums">/ {Math.round(m.target)}{m.unit}</p>
                      <div className="h-1 bg-autronis-border/30 rounded-full mt-1.5 overflow-hidden">
                        <div className={cn("h-full rounded-full", m.color.replace("text-", "bg-"))} style={{ width: `${Math.min(100, Math.round((m.value / m.target) * 100))}%`, opacity: 0.6 }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-autronis-border/30">
                  <p className="text-[10px] uppercase tracking-wider text-autronis-text-secondary/50 font-medium mb-2 text-center">Gemiddeld per dag</p>
                  <div className="flex justify-center gap-4 flex-wrap">
                    {[
                      { label: "Kcal", value: Math.round(plan.weekTotaal.kcal / 7), target: kcal, color: "text-orange-400", bg: "bg-orange-500/10" },
                      { label: "Eiwit", value: Math.round(plan.weekTotaal.eiwit / 7), target: eiwit, unit: "g", color: "text-red-400", bg: "bg-red-500/10" },
                      { label: "Koolh.", value: Math.round(plan.weekTotaal.kh / 7), target: koolhydraten, unit: "g", color: "text-blue-400", bg: "bg-blue-500/10" },
                      { label: "Vet", value: Math.round(plan.weekTotaal.vet / 7), target: vet, unit: "g", color: "text-yellow-400", bg: "bg-yellow-500/10" },
                    ].map(m => (
                      <div key={m.label} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg", m.bg)}>
                        <span className={cn("text-sm font-bold tabular-nums", m.color)}>{m.value}{m.unit}</span>
                        <span className="text-[10px] text-autronis-text-secondary/40">/ {m.target}{m.unit} {m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Boodschappenlijst — compact layout */}
            {boodschappenPerAfdeling && (() => {
              const restjes = (plan.boodschappenlijst || []).filter((item: BoodschapItem) => item.over && item.over !== "0g" && item.over !== "0" && item.over !== "0ml" && item.over !== "0 stuks");
              const totaalPrijs = plan.totaalPrijs ?? 0;
              const totaalOverWaarde = restjes.reduce((sum: number, item: BoodschapItem) => sum + (item.overWaarde ?? 0), 0);
              const effectieveKosten = totaalPrijs - totaalOverWaarde;
              const perDag = effectieveKosten / 7;
              const perMaaltijd = effectieveKosten / (7 * 3);

              return (
                <div className="bg-autronis-card border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
                  {/* Header + prijsoverzicht */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-medium text-autronis-text-primary">Boodschappenlijst</span>
                      <span className="text-[10px] text-autronis-text-secondary/50">({plan.boodschappenlijst?.length || 0})</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <span className="text-[10px] text-autronis-text-secondary/50">€{perDag.toFixed(2)}/dag</span>
                      <span className="text-[10px] text-autronis-text-secondary/50">€{perMaaltijd.toFixed(2)}/maaltijd</span>
                      {totaalOverWaarde > 0 && (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">€{totaalOverWaarde.toFixed(2)} over</span>
                      )}
                      <div className="flex items-center gap-1 bg-emerald-500/15 px-2.5 py-1 rounded-lg">
                        <Euro className="w-3 h-3 text-emerald-400" />
                        <span className="text-sm font-bold text-emerald-400">€{totaalPrijs.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Producten grid — compact */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-0">
                    {Object.entries(boodschappenPerAfdeling).map(([afdeling, items]) => (
                      <div key={afdeling} className="mb-2">
                        <p className="text-[9px] uppercase tracking-wider text-autronis-text-secondary/40 font-medium mb-0.5 mt-1">{afdeling}</p>
                        {items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between gap-1 text-[11px] py-0.5">
                            <span className="text-autronis-text-primary truncate flex-1">{item.product}</span>
                            <span className="text-autronis-text-secondary/50 tabular-nums text-[10px] flex-shrink-0">{item.hoeveelheid}</span>
                            <span className="text-emerald-400 font-medium tabular-nums w-12 text-right flex-shrink-0">€{item.prijs.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Overblijft na deze week */}
                  {restjes.length > 0 && (
                    <div className="pt-3 border-t border-emerald-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                          <Salad className="w-3.5 h-3.5" /> Over na deze week ({restjes.length} producten)
                        </p>
                        {totaalOverWaarde > 0 && (
                          <span className="text-xs font-bold text-amber-400">~€{totaalOverWaarde.toFixed(2)} waarde</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                        {restjes.map((item: BoodschapItem, i: number) => (
                          <div key={i} className="flex items-center justify-between px-2 py-1 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                            <span className="text-[10px] text-autronis-text-primary truncate">{item.product}</span>
                            <span className="text-[10px] font-semibold text-amber-400 ml-1 flex-shrink-0">+{item.over}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-autronis-text-secondary/40 mt-1.5">
                        Effectieve weekkosten: <span className="text-emerald-400 font-medium">€{effectieveKosten.toFixed(2)}</span> (boodschappen minus restjeswaarde)
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
