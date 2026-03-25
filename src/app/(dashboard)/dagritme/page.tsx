"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun, Moon, Sunrise, CheckCircle2, Circle, ArrowRight, Sparkles,
  Loader2, Calendar, Clock, ChevronRight, RotateCcw, TrendingUp,
  Smile, Meh, Frown, Zap, Battery, Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";

interface OpenTaak { id: number; titel: string; prioriteit: string; deadline?: string | null }
interface Afspraak { id: number; titel: string; startDatum: string; eindDatum?: string | null }
interface Prioriteit { id?: number; titel: string; gedaan?: boolean }
interface HistoryRecord { datum: string; type: string; stemming?: number | null; energie?: number | null }

interface DagData {
  ochtend: { stemming?: number; intentie?: string; prioriteiten?: string } | null;
  avond: { reflectie?: string; energie?: number } | null;
  openTaken: OpenTaak[];
  vandaagMeetings: Afspraak[];
  history: HistoryRecord[];
}

const STEMMING_CONFIG = [
  { value: 1, icon: Frown, label: "Zwaar", color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30" },
  { value: 2, icon: Meh, label: "Matig", color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/30" },
  { value: 3, icon: Smile, label: "OK", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" },
  { value: 4, icon: Zap, label: "Goed", color: "text-autronis-accent", bg: "bg-autronis-accent/15", border: "border-autronis-accent/30" },
  { value: 5, icon: Heart, label: "Top!", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
] as const;

const ENERGIE_CONFIG = [
  { value: 1, label: "Leeg", icon: Battery, color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30" },
  { value: 2, label: "Laag", icon: Battery, color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/30" },
  { value: 3, label: "Neutraal", icon: Battery, color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" },
  { value: 4, label: "Hoog", icon: Zap, color: "text-autronis-accent", bg: "bg-autronis-accent/15", border: "border-autronis-accent/30" },
  { value: 5, label: "Vol gas", icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
] as const;

function getGreeting(): { tekst: string; icon: typeof Sun; modus: "ochtend" | "middag" | "avond" } {
  const uur = new Date().getHours();
  if (uur < 12) return { tekst: "Goedemorgen", icon: Sunrise, modus: "ochtend" };
  if (uur < 17) return { tekst: "Goedemiddag", icon: Sun, modus: "middag" };
  return { tekst: "Goedenavond", icon: Moon, modus: "avond" };
}

function formatTijd(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function MoodBar({ history }: { history: HistoryRecord[] }) {
  const last7 = history.filter((h) => h.type === "ochtend").slice(0, 7).reverse();
  if (last7.length === 0) return null;
  return (
    <div className="flex items-end gap-1 h-8">
      {last7.map((h, i) => {
        const pct = ((h.stemming ?? 3) / 5) * 100;
        const color = (h.stemming ?? 3) >= 4 ? "bg-autronis-accent" : (h.stemming ?? 3) >= 3 ? "bg-amber-400" : "bg-red-400";
        return (
          <div key={i} className="flex-1 flex items-end" title={`${h.datum}: ${h.stemming}/5`}>
            <div className={cn("w-full rounded-t-sm transition-all", color)} style={{ height: `${pct}%` }} />
          </div>
        );
      })}
    </div>
  );
}

export default function DagRitmePage() {
  const { addToast } = useToast();
  const [data, setData] = useState<DagData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const greeting = getGreeting();

  // Ochtend state
  const [stemming, setStemming] = useState<number | null>(null);
  const [intentie, setIntentie] = useState("");
  const [prioriteiten, setPrioriteiten] = useState<Prioriteit[]>([]);
  const [customPrio, setCustomPrio] = useState("");

  // Avond state
  const [energie, setEnergie] = useState<number | null>(null);
  const [reflectie, setReflectie] = useState("");
  const [prioGedaan, setPrioGedaan] = useState<Set<number>>(new Set());
  const [verschuivingen, setVerschuivingen] = useState<string[]>([]);
  const [customVerschuiving, setCustomVerschuiving] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dagritme?datum=${today}`);
      const json = await res.json() as DagData;
      setData(json);
      if (json.ochtend?.prioriteiten) {
        setPrioriteiten(JSON.parse(json.ochtend.prioriteiten) as Prioriteit[]);
      }
      if (json.ochtend?.stemming) setStemming(json.ochtend.stemming);
      if (json.ochtend?.intentie) setIntentie(json.ochtend.intentie);
      if (json.avond?.energie) setEnergie(json.avond.energie);
    } catch {
      addToast("Kon dagdata niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [today, addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOchtendSave = useCallback(async () => {
    if (!stemming) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dagritme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ochtend", datum: today, stemming, intentie, prioriteiten }),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
      addToast("Goedemorgen! Check-in opgeslagen.", "succes");
      fetchData();
    } catch {
      addToast("Check-in opslaan mislukt", "fout");
    } finally {
      setSaving(false);
    }
  }, [stemming, intentie, prioriteiten, today, addToast, fetchData]);

  const handleAvondSave = useCallback(async () => {
    if (!energie) return;
    setSaving(true);
    try {
      const voltooide = prioriteiten.filter((_, i) => prioGedaan.has(i)).map((p) => p.titel);
      const res = await fetch("/api/dagritme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "avond", datum: today, energie, reflectie, voltooide_taken: voltooide, verschuivingen }),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
      addToast("Goede dag gehad! Check-out opgeslagen.", "succes");
      fetchData();
    } catch {
      addToast("Check-out opslaan mislukt", "fout");
    } finally {
      setSaving(false);
    }
  }, [energie, reflectie, prioGedaan, prioriteiten, verschuivingen, today, addToast, fetchData]);

  const addPrioriteit = useCallback((titel: string, id?: number) => {
    if (prioriteiten.length >= 3) return;
    if (prioriteiten.some((p) => p.titel === titel)) return;
    setPrioriteiten((prev) => [...prev, { id, titel }]);
  }, [prioriteiten]);

  const removePrioriteit = useCallback((index: number) => {
    setPrioriteiten((prev) => prev.filter((_, i) => i !== index));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-autronis-accent animate-spin" />
      </div>
    );
  }

  const ochtendKlaar = !!data?.ochtend;
  const avondKlaar = !!data?.avond;
  const isAvond = greeting.modus === "avond" || (greeting.modus === "middag" && ochtendKlaar);

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto p-4 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <greeting.icon className="w-5 h-5 text-autronis-accent" />
              <h1 className="text-2xl font-bold text-autronis-text-primary">{greeting.tekst}</h1>
            </div>
            <p className="text-sm text-autronis-text-secondary">
              {new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          {data?.history && data.history.length > 1 && (
            <div className="text-right">
              <p className="text-[11px] text-autronis-text-secondary mb-1">Stemming (7d)</p>
              <div className="w-24">
                <MoodBar history={data.history} />
              </div>
            </div>
          )}
        </div>

        {/* Vandaag's meetings strip */}
        {data?.vandaagMeetings && data.vandaagMeetings.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.vandaagMeetings.map((m) => (
              <div key={m.id} className="flex-shrink-0 flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3 py-2">
                <Calendar className="w-3.5 h-3.5 text-autronis-accent shrink-0" />
                <div>
                  <p className="text-xs font-medium text-autronis-text-primary truncate max-w-[140px]">{m.titel}</p>
                  <p className="text-[10px] text-autronis-text-secondary">{formatTijd(m.startDatum)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== DONE STATE ===== */}
        {ochtendKlaar && avondKlaar && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-emerald-500/10 to-autronis-card border border-emerald-500/20 rounded-2xl p-6 text-center space-y-3"
          >
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h2 className="text-lg font-semibold text-autronis-text-primary">Dagritme compleet</h2>
            <p className="text-sm text-autronis-text-secondary">Ochtend check-in en avond check-out zijn gedaan voor vandaag.</p>
            <div className="flex items-center justify-center gap-6 pt-2">
              {data?.ochtend?.stemming && (
                <div className="text-center">
                  <p className="text-[11px] text-autronis-text-secondary mb-1">Ochtend stemming</p>
                  <p className="text-2xl font-bold text-autronis-accent">{data.ochtend.stemming}/5</p>
                </div>
              )}
              {data?.avond?.energie && (
                <div className="text-center">
                  <p className="text-[11px] text-autronis-text-secondary mb-1">Avond energie</p>
                  <p className="text-2xl font-bold text-purple-400">{data.avond.energie}/5</p>
                </div>
              )}
            </div>
            {data?.ochtend?.intentie && (
              <p className="text-sm text-autronis-text-secondary italic">"{data.ochtend.intentie}"</p>
            )}
            <button
              onClick={() => { setData((d) => d ? { ...d, ochtend: null, avond: null } : d); }}
              className="text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors flex items-center gap-1 mx-auto"
            >
              <RotateCcw className="w-3 h-3" />
              Opnieuw invullen
            </button>
          </motion.div>
        )}

        {/* ===== OCHTEND CHECK-IN ===== */}
        {!ochtendKlaar && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 space-y-6"
          >
            <div className="flex items-center gap-2">
              <Sunrise className="w-5 h-5 text-autronis-accent" />
              <h2 className="text-lg font-semibold text-autronis-text-primary">Ochtend check-in</h2>
            </div>

            {/* Stemming */}
            <div>
              <p className="text-sm font-medium text-autronis-text-primary mb-3">Hoe voel je je vandaag?</p>
              <div className="flex gap-2">
                {STEMMING_CONFIG.map((s) => {
                  const Icon = s.icon;
                  const isActive = stemming === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => setStemming(s.value)}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",
                        isActive ? cn(s.bg, s.border, s.color) : "border-autronis-border text-autronis-text-secondary hover:border-autronis-border/80"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intentie */}
            <div>
              <p className="text-sm font-medium text-autronis-text-primary mb-2">Wat is jouw intentie voor vandaag?</p>
              <input
                type="text"
                value={intentie}
                onChange={(e) => setIntentie(e.target.value)}
                placeholder="Bijv: Diep werk op projectvoorstel voor klant X"
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
              />
            </div>

            {/* Top 3 prioriteiten */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-autronis-text-primary">Top 3 prioriteiten vandaag</p>
                <span className={cn("text-xs font-medium tabular-nums", prioriteiten.length === 3 ? "text-emerald-400" : "text-autronis-text-secondary")}>
                  {prioriteiten.length}/3
                </span>
              </div>

              {/* Selected */}
              <div className="space-y-2 mb-3">
                <AnimatePresence>
                  {prioriteiten.map((p, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="flex items-center gap-3 bg-autronis-accent/10 border border-autronis-accent/20 rounded-xl px-4 py-2.5"
                    >
                      <span className="w-5 h-5 rounded-full bg-autronis-accent/20 text-autronis-accent text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="text-sm text-autronis-text-primary flex-1">{p.titel}</span>
                      <button onClick={() => removePrioriteit(i)} className="text-autronis-text-secondary hover:text-red-400 transition-colors text-lg leading-none">×</button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Suggestions from open taken */}
              {prioriteiten.length < 3 && data?.openTaken && data.openTaken.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-autronis-text-secondary uppercase tracking-wide">Open taken</p>
                  {data.openTaken.filter((t) => !prioriteiten.some((p) => p.id === t.id)).slice(0, 5).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => addPrioriteit(t.titel, t.id)}
                      disabled={prioriteiten.length >= 3}
                      className="w-full flex items-center gap-3 bg-autronis-bg/50 hover:bg-autronis-border/50 border border-autronis-border rounded-xl px-4 py-2.5 text-left transition-colors disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-autronis-text-secondary shrink-0" />
                      <span className="text-sm text-autronis-text-primary flex-1 truncate">{t.titel}</span>
                      {t.prioriteit === "hoog" && <span className="text-xs text-red-400 shrink-0">Hoog</span>}
                      {t.deadline && <span className="text-xs text-autronis-text-secondary shrink-0">{t.deadline.slice(5, 10)}</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom input */}
              {prioriteiten.length < 3 && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={customPrio}
                    onChange={(e) => setCustomPrio(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customPrio.trim()) {
                        addPrioriteit(customPrio.trim());
                        setCustomPrio("");
                      }
                    }}
                    placeholder="Of typ zelf een prioriteit..."
                    className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
                  />
                  <button
                    onClick={() => { if (customPrio.trim()) { addPrioriteit(customPrio.trim()); setCustomPrio(""); } }}
                    disabled={!customPrio.trim()}
                    className="px-4 py-2 bg-autronis-accent text-autronis-bg rounded-xl text-sm font-medium hover:bg-autronis-accent-hover transition-colors disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleOchtendSave}
              disabled={!stemming || saving}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-autronis-accent text-autronis-bg rounded-xl font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sunrise className="w-4 h-4" />}
              Start de dag
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* ===== AVOND CHECK-OUT ===== */}
        {ochtendKlaar && !avondKlaar && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 space-y-6"
          >
            <div className="flex items-center gap-2">
              <Moon className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-autronis-text-primary">Avond check-out</h2>
            </div>

            {/* Prioriteiten afvinken */}
            {prioriteiten.length > 0 && (
              <div>
                <p className="text-sm font-medium text-autronis-text-primary mb-3">Wat heb je gedaan?</p>
                <div className="space-y-2">
                  {prioriteiten.map((p, i) => {
                    const isDone = prioGedaan.has(i);
                    return (
                      <button
                        key={i}
                        onClick={() => setPrioGedaan((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        })}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-xl px-4 py-3 border text-left transition-all",
                          isDone
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                            : "bg-autronis-bg/50 border-autronis-border text-autronis-text-primary hover:border-autronis-accent/30"
                        )}
                      >
                        {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Circle className="w-4 h-4 text-autronis-text-secondary shrink-0" />}
                        <span className={cn("text-sm flex-1", isDone && "line-through opacity-70")}>{p.titel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Verschuivingen */}
            <div>
              <p className="text-sm font-medium text-autronis-text-primary mb-2">Wat verschuift naar morgen?</p>
              <div className="space-y-1.5 mb-2">
                <AnimatePresence>
                  {verschuivingen.map((v, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-sm text-autronis-text-secondary bg-autronis-bg/50 border border-autronis-border rounded-xl px-3 py-2"
                    >
                      <span className="flex-1">{v}</span>
                      <button onClick={() => setVerschuivingen((p) => p.filter((_, j) => j !== i))} className="text-autronis-text-secondary hover:text-red-400 transition-colors text-lg leading-none">×</button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customVerschuiving}
                  onChange={(e) => setCustomVerschuiving(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customVerschuiving.trim()) {
                      setVerschuivingen((p) => [...p, customVerschuiving.trim()]);
                      setCustomVerschuiving("");
                    }
                  }}
                  placeholder="Taak of punt dat verschuift..."
                  className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
                />
                <button
                  onClick={() => { if (customVerschuiving.trim()) { setVerschuivingen((p) => [...p, customVerschuiving.trim()]); setCustomVerschuiving(""); } }}
                  disabled={!customVerschuiving.trim()}
                  className="px-4 py-2 bg-autronis-card border border-autronis-border text-autronis-text-secondary rounded-xl text-sm hover:text-autronis-text-primary transition-colors disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            {/* Energie */}
            <div>
              <p className="text-sm font-medium text-autronis-text-primary mb-3">Hoe is je energie na vandaag?</p>
              <div className="flex gap-2">
                {ENERGIE_CONFIG.map((e) => {
                  const Icon = e.icon;
                  const isActive = energie === e.value;
                  return (
                    <button
                      key={e.value}
                      onClick={() => setEnergie(e.value)}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",
                        isActive ? cn(e.bg, e.border, e.color) : "border-autronis-border text-autronis-text-secondary hover:border-autronis-border/80"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium">{e.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reflectie */}
            <div>
              <p className="text-sm font-medium text-autronis-text-primary mb-2">Reflectie <span className="text-autronis-text-secondary font-normal">(optioneel)</span></p>
              <textarea
                value={reflectie}
                onChange={(e) => setReflectie(e.target.value)}
                placeholder="Wat ging goed? Wat kan beter? Inzichten van vandaag?"
                rows={3}
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors resize-none"
              />
            </div>

            <button
              onClick={handleAvondSave}
              disabled={!energie || saving}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Moon className="w-4 h-4" />}
              Sluit de dag af
            </button>
          </motion.div>
        )}

        {/* Stats strip (always visible at bottom) */}
        {data?.history && data.history.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Gem. stemming",
                value: (() => {
                  const vals = data.history.filter((h) => h.type === "ochtend" && h.stemming).map((h) => h.stemming!);
                  return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
                })(),
                icon: Sparkles,
                color: "text-autronis-accent",
              },
              {
                label: "Ritme streak",
                value: (() => {
                  const datums = new Set(data.history.filter((h) => h.type === "ochtend").map((h) => h.datum));
                  let streak = 0;
                  const d = new Date();
                  while (datums.has(d.toISOString().slice(0, 10))) {
                    streak++;
                    d.setDate(d.getDate() - 1);
                  }
                  return `${streak}d`;
                })(),
                icon: TrendingUp,
                color: "text-emerald-400",
              },
              {
                label: "Check-ins (7d)",
                value: data.history.filter((h) => h.type === "ochtend").slice(0, 7).length,
                icon: Clock,
                color: "text-purple-400",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-autronis-card border border-autronis-border rounded-xl p-3.5">
                <p className="text-[11px] text-autronis-text-secondary flex items-center gap-1 mb-1">
                  <Icon className="w-3 h-3" />
                  {label}
                </p>
                <p className={cn("text-xl font-bold tabular-nums", color)}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
