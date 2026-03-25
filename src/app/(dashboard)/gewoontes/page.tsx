"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedNumber } from "@/components/ui/animated-number";
import {
  Plus,
  Flame,
  Trophy,
  TrendingUp,
  Calendar,
  CheckCircle2,
  X,
  Pencil,
  Trash2,
  Lightbulb,
  Loader2,
  Target,
  Dumbbell,
  BookOpen,
  Megaphone,
  Users,
  GraduationCap,
  Sparkles,
  Award,
  Zap,
  Star,
  Crown,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  AlertTriangle,
  Clock,
  Brain,
  Shield,
  TrendingDown,
  Rocket,
  Droplets,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Icon mapping for Lucide icons
const ICON_MAP: Record<string, typeof Target> = {
  Target, Dumbbell, BookOpen, Megaphone, Users, GraduationCap,
  Sparkles, Flame, Trophy, TrendingUp, Calendar, CheckCircle2,
  Lightbulb, Plus, Award, Zap, Star, Crown, Droplets, Shield,
};

const ICON_OPTIONS = [
  { naam: "Target", icon: Target },
  { naam: "Dumbbell", icon: Dumbbell },
  { naam: "BookOpen", icon: BookOpen },
  { naam: "Megaphone", icon: Megaphone },
  { naam: "Users", icon: Users },
  { naam: "GraduationCap", icon: GraduationCap },
  { naam: "Sparkles", icon: Sparkles },
  { naam: "Flame", icon: Flame },
  { naam: "Trophy", icon: Trophy },
  { naam: "TrendingUp", icon: TrendingUp },
  { naam: "Calendar", icon: Calendar },
  { naam: "Lightbulb", icon: Lightbulb },
  { naam: "Droplets", icon: Droplets },
  { naam: "Shield", icon: Shield },
];

interface Gewoonte {
  id: number;
  naam: string;
  icoon: string;
  frequentie: string;
  streefwaarde: string | null;
  doel: string | null;
  waarom: string | null;
  verwachteTijd: string | null;
  volgorde: number;
  voltooidVandaag: boolean;
}

interface Suggestie {
  naam: string;
  icoon: string;
  streefwaarde: string | null;
  frequentie?: string;
  doel?: string;
  waarom?: string;
  bron?: string;
}

interface HabitStat {
  id: number;
  naam: string;
  icoon: string;
  doel: string | null;
  waarom: string | null;
  verwachteTijd: string | null;
  huidigeStreak: number;
  langsteStreak: number;
  weekVoltooid: number;
  maandVoltooid: number;
  totaalVoltooid: number;
  completionRate: number;
  besteDag: string;
  slechteDag: string;
  heatmap: Record<string, number>;
  trend: number;
  voltooidVandaag: boolean;
  dagTelling: Record<number, number>;
}

interface Inzicht {
  type: "positief" | "waarschuwing" | "tip" | "actie";
  tekst: string;
}

interface VandaagFocusItem {
  id: number;
  naam: string;
  icoon: string;
  streak: number;
  verwachteTijd: string | null;
  besteDag: string;
  reden: string;
}

interface BadgeVoortgang {
  naam: string;
  icoon: string;
  kleur: string;
  behaald: boolean;
  huidig: number;
  doel: number;
  tip: string;
}

// ─── Gamification ───
function calculateLevel(totaalPunten: number): { level: number; naam: string; volgende: number; voortgang: number } {
  const levels = [
    { punten: 0, naam: "Beginner" },
    { punten: 50, naam: "Starter" },
    { punten: 150, naam: "Consistent" },
    { punten: 350, naam: "Gedreven" },
    { punten: 700, naam: "Expert" },
    { punten: 1200, naam: "Master" },
    { punten: 2000, naam: "Legende" },
  ];

  let currentLevel = 0;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (totaalPunten >= levels[i].punten) {
      currentLevel = i;
      break;
    }
  }

  const volgende = currentLevel < levels.length - 1 ? levels[currentLevel + 1].punten : levels[currentLevel].punten;
  const huidige = levels[currentLevel].punten;
  const voortgang = currentLevel < levels.length - 1
    ? ((totaalPunten - huidige) / (volgende - huidige)) * 100
    : 100;

  return { level: currentLevel + 1, naam: levels[currentLevel].naam, volgende, voortgang };
}

// ─── Streak flame scaling ───
function StreakFlame({ streak }: { streak: number }) {
  if (streak === 0) return null;
  const size = streak >= 30 ? "w-6 h-6" : streak >= 14 ? "w-5 h-5" : streak >= 7 ? "w-4.5 h-4.5" : "w-4 h-4";
  const color =
    streak >= 30 ? "text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.7)]" :
    streak >= 14 ? "text-red-400" :
    streak >= 7 ? "text-orange-400" :
    streak >= 3 ? "text-yellow-400" :
    "text-slate-400";
  const animate = streak >= 30 ? "animate-pulse" : streak >= 14 ? "animate-pulse" : "";

  return (
    <span className={cn("inline-flex items-center gap-1 font-bold tabular-nums", color)}>
      <Flame className={cn(size, animate)} />
      <span className="text-sm">{streak}</span>
    </span>
  );
}

// ─── Feedback Toast after completing a habit ───
function CompletionFeedback({ stat, onClose, onUndo }: { stat: HabitStat; onClose: () => void; onUndo?: () => void }) {
  const messages = [
    stat.huidigeStreak >= 21 ? "Dit is nu een gevestigde gewoonte. Respect." : null,
    stat.huidigeStreak >= 7 ? `${stat.huidigeStreak} dagen op rij! Je bent on fire.` : null,
    stat.huidigeStreak === 1 ? "Eerste stap gezet. Morgen weer!" : null,
    stat.totaalVoltooid % 10 === 0 && stat.totaalVoltooid > 0 ? `Milestone: ${stat.totaalVoltooid} keer voltooid!` : null,
    stat.completionRate >= 90 ? "Top 10% consistentie. Blijf zo doorgaan." : null,
  ].filter(Boolean);

  const message = messages[0] || "Gedaan! Punt verdiend.";
  const punten = stat.huidigeStreak >= 7 ? 3 : stat.huidigeStreak >= 3 ? 2 : 1;

  useEffect(() => {
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 20, opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="fixed bottom-6 right-6 z-50"
    >
      <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-4 pr-10 backdrop-blur-xl shadow-2xl max-w-sm">
        <button onClick={onClose} className="absolute top-3 right-3 text-autronis-text-secondary hover:text-white">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-500/20 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-400">{stat.naam}</p>
            <p className="text-xs text-autronis-text-secondary">+{punten} punt{punten > 1 ? "en" : ""}</p>
          </div>
          {stat.huidigeStreak >= 3 && (
            <div className="ml-auto text-center">
              <p className="text-2xl font-black tabular-nums leading-none" style={{
                color: stat.huidigeStreak >= 30 ? "#c084fc" : stat.huidigeStreak >= 14 ? "#f87171" : "#fb923c"
              }}>
                {stat.huidigeStreak}
              </p>
              <p className="text-[9px] text-autronis-text-secondary">dagen streak</p>
            </div>
          )}
        </div>
        <p className="text-sm text-autronis-text-primary">{message}</p>
        {onUndo && (
          <button
            onClick={onUndo}
            className="mt-2.5 text-xs text-autronis-text-secondary hover:text-autronis-text-primary underline underline-offset-2 transition-colors"
          >
            Ongedaan maken
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Heatmap ───
function Heatmap({ data, naam, totaalGewoontes }: { data: Record<string, number>; naam?: string; totaalGewoontes?: number }) {
  const nu = new Date();
  const weken = 26;

  const start = new Date(nu);
  start.setDate(start.getDate() - (weken * 7) - (start.getDay() === 0 ? 6 : start.getDay() - 1));

  const celMap = new Map<string, { datum: string; waarde: number; dag: number; week: number }>();
  const cellen: typeof celMap extends Map<string, infer V> ? V[] : never = [];

  for (let w = 0; w <= weken; w++) {
    for (let d = 0; d < 7; d++) {
      const datum = new Date(start);
      datum.setDate(start.getDate() + w * 7 + d);
      if (datum > nu) continue;
      const datumStr = datum.toISOString().slice(0, 10);
      const cel = { datum: datumStr, waarde: data[datumStr] || 0, dag: d, week: w };
      cellen.push(cel);
      celMap.set(`${w}-${d}`, cel);
    }
  }

  const maanden: { label: string; week: number }[] = [];
  let laatsteMaand = -1;
  for (const cel of cellen) {
    const maand = new Date(cel.datum).getMonth();
    if (maand !== laatsteMaand && cel.dag === 0) {
      maanden.push({ label: new Date(cel.datum).toLocaleDateString("nl-NL", { month: "short" }), week: cel.week });
      laatsteMaand = maand;
    }
  }

  const dagLabels = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  function getCelColor(waarde: number): string {
    if (waarde === 0) return "bg-autronis-border/30";
    if (totaalGewoontes && totaalGewoontes > 1) {
      const ratio = waarde / totaalGewoontes;
      if (ratio >= 1) return "bg-emerald-500";
      if (ratio >= 0.5) return "bg-emerald-500/60";
      return "bg-emerald-500/30";
    }
    return "bg-emerald-500";
  }

  return (
    <div>
      {naam && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-autronis-text-primary">{naam}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="inline-block">
          <div className="flex mb-1 ml-8">
            {maanden.map((m, i) => (
              <span key={i} className="text-[10px] text-autronis-text-secondary" style={{ position: "relative", left: `${m.week * 15}px` }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            <div className="flex flex-col gap-[3px] mr-1">
              {dagLabels.map((d) => (
                <span key={d} className="text-[9px] text-autronis-text-secondary h-[13px] leading-[13px] w-5">{d}</span>
              ))}
            </div>
            {Array.from({ length: weken + 1 }, (_, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }, (_, d) => {
                  const cel = celMap.get(`${w}-${d}`);
                  if (!cel) return <div key={d} className="w-[13px] h-[13px]" />;
                  const isVandaag = cel.datum === nu.toISOString().slice(0, 10);
                  return (
                    <div key={d}
                      className={cn("w-[13px] h-[13px] rounded-sm transition-colors", getCelColor(cel.waarde), isVandaag && "ring-1 ring-autronis-accent")}
                      title={`${new Date(cel.datum).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}: ${cel.waarde > 0 ? `${cel.waarde} voltooid` : "Gemist"}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-2 ml-8">
            <span className="text-[10px] text-autronis-text-secondary">Minder</span>
            <div className="w-[13px] h-[13px] rounded-sm bg-autronis-border/30" />
            <div className="w-[13px] h-[13px] rounded-sm bg-emerald-500/30" />
            <div className="w-[13px] h-[13px] rounded-sm bg-emerald-500/60" />
            <div className="w-[13px] h-[13px] rounded-sm bg-emerald-500" />
            <span className="text-[10px] text-autronis-text-secondary">Meer</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal (with motivation fields) ───
function GewoonteModal({ open, onClose, onSave, gewoonte }: {
  open: boolean; onClose: () => void;
  onSave: (data: { naam: string; icoon: string; frequentie: string; streefwaarde: string; doel: string; waarom: string; verwachteTijd: string }) => void;
  gewoonte?: Gewoonte | null;
}) {
  const [naam, setNaam] = useState("");
  const [icoon, setIcoon] = useState("Target");
  const [frequentie, setFrequentie] = useState("dagelijks");
  const [streefwaarde, setStreefwaarde] = useState("");
  const [doel, setDoel] = useState("");
  const [waarom, setWaarom] = useState("");
  const [verwachteTijd, setVerwachteTijd] = useState("");

  useEffect(() => {
    if (gewoonte) {
      setNaam(gewoonte.naam);
      setIcoon(gewoonte.icoon);
      setFrequentie(gewoonte.frequentie);
      setStreefwaarde(gewoonte.streefwaarde || "");
      setDoel(gewoonte.doel || "");
      setWaarom(gewoonte.waarom || "");
      setVerwachteTijd(gewoonte.verwachteTijd || "");
    } else {
      setNaam(""); setIcoon("Target"); setFrequentie("dagelijks"); setStreefwaarde("");
      setDoel(""); setWaarom(""); setVerwachteTijd("");
    }
  }, [gewoonte, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-autronis-text-primary">{gewoonte ? "Gewoonte bewerken" : "Nieuwe gewoonte"}</h3>
          <button onClick={onClose} className="text-autronis-text-secondary hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-autronis-text-secondary mb-1 block">Naam</label>
            <input type="text" value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="Bijv. Sporten"
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50" />
          </div>
          <div>
            <label className="text-sm text-autronis-text-secondary mb-1 block">Icoon</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(({ naam: iconNaam, icon: Icon }) => (
                <button key={iconNaam} type="button" onClick={() => setIcoon(iconNaam)}
                  className={cn("p-2.5 rounded-xl border transition-all", icoon === iconNaam
                    ? "bg-autronis-accent/15 border-autronis-accent text-autronis-accent"
                    : "bg-autronis-bg border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/50")}>
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-autronis-text-secondary mb-1 block">Frequentie</label>
              <select value={frequentie} onChange={(e) => setFrequentie(e.target.value)}
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50">
                <option value="dagelijks">Dagelijks</option>
                <option value="weekelijks">Weekelijks</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-autronis-text-secondary mb-1 block">Verwachte tijd</label>
              <input type="text" value={verwachteTijd} onChange={(e) => setVerwachteTijd(e.target.value)} placeholder="Bijv. 15 min"
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50" />
            </div>
          </div>
          <div>
            <label className="text-sm text-autronis-text-secondary mb-1 block">Streefwaarde (optioneel)</label>
            <input type="text" value={streefwaarde} onChange={(e) => setStreefwaarde(e.target.value)} placeholder="Bijv. 30 min"
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50" />
          </div>

          {/* Motivation layer */}
          <div className="border-t border-autronis-border pt-4">
            <p className="text-xs font-medium text-autronis-accent mb-3 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" /> Motivatie — waarom doe je dit?
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-autronis-text-secondary mb-1 block">Doel</label>
                <input type="text" value={doel} onChange={(e) => setDoel(e.target.value)} placeholder="Bijv. 10 kg afvallen, boek per maand lezen"
                  className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50" />
              </div>
              <div>
                <label className="text-sm text-autronis-text-secondary mb-1 block">Waarom</label>
                <input type="text" value={waarom} onChange={(e) => setWaarom(e.target.value)} placeholder="Bijv. Meer energie, betere focus op werk"
                  className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-3 border border-autronis-border rounded-xl text-sm text-autronis-text-secondary hover:bg-autronis-border/30 transition-colors">Annuleren</button>
          <button onClick={() => { if (!naam.trim()) return; onSave({ naam: naam.trim(), icoon, frequentie, streefwaarde, doel, waarom, verwachteTijd }); }} disabled={!naam.trim()}
            className="flex-1 px-4 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 btn-press">
            {gewoonte ? "Opslaan" : "Toevoegen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function GewoontesPagina() {
  const { addToast } = useToast();
  const [gewoontesList, setGewoontesList] = useState<Gewoonte[]>([]);
  const [suggesties, setSuggesties] = useState<Suggestie[]>([]);
  const [statistieken, setStatistieken] = useState<HabitStat[]>([]);
  const [weekRate, setWeekRate] = useState(0);
  const [maandRate, setMaandRate] = useState(0);
  const [weekUitleg, setWeekUitleg] = useState("");
  const [maandUitleg, setMaandUitleg] = useState("");
  const [inzichten, setInzichten] = useState<Inzicht[]>([]);
  const [vandaagFocus, setVandaagFocus] = useState<VandaagFocusItem[]>([]);
  const [badgeVoortgang, setBadgeVoortgang] = useState<BadgeVoortgang[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editGewoonte, setEditGewoonte] = useState<Gewoonte | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showSuggesties, setShowSuggesties] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [completedStat, setCompletedStat] = useState<HabitStat | null>(null);
  const [undoId, setUndoId] = useState<number | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [gRes, sRes] = await Promise.all([
        fetch("/api/gewoontes"),
        fetch("/api/gewoontes/statistieken"),
      ]);
      const gData = await gRes.json();
      const sData = await sRes.json();
      setGewoontesList(gData.gewoontes || []);
      setSuggesties(gData.suggesties || []);
      setStatistieken(sData.statistieken || []);
      setWeekRate(sData.weekCompletionRate || 0);
      setMaandRate(sData.maandCompletionRate || 0);
      setWeekUitleg(sData.weekUitleg || "");
      setMaandUitleg(sData.maandUitleg || "");
      setInzichten(sData.inzichten || []);
      setVandaagFocus(sData.vandaagFocus || []);
      setBadgeVoortgang(sData.badgeVoortgang || []);
    } catch {
      addToast("Kon gewoontes niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleGewoonte = async (gewoonteId: number, skipFeedback = false) => {
    const vandaag = new Date().toISOString().slice(0, 10);
    const wasVoltooid = gewoontesList.find((g) => g.id === gewoonteId)?.voltooidVandaag;

    // Optimistic update
    setGewoontesList((prev) =>
      prev.map((g) => g.id === gewoonteId ? { ...g, voltooidVandaag: !g.voltooidVandaag } : g)
    );
    try {
      const res = await fetch("/api/gewoontes/logboek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gewoonteId, datum: vandaag }),
      });
      if (!res.ok) throw new Error();

      // Refresh stats
      const sRes = await fetch("/api/gewoontes/statistieken");
      const sData = await sRes.json();
      setStatistieken(sData.statistieken || []);
      setWeekRate(sData.weekCompletionRate || 0);
      setMaandRate(sData.maandCompletionRate || 0);
      setWeekUitleg(sData.weekUitleg || "");
      setMaandUitleg(sData.maandUitleg || "");
      setInzichten(sData.inzichten || []);
      setVandaagFocus(sData.vandaagFocus || []);
      setBadgeVoortgang(sData.badgeVoortgang || []);

      // Show feedback when completing (not uncompleting, not undo)
      if (!wasVoltooid && !skipFeedback) {
        const updatedStat = (sData.statistieken || []).find((s: HabitStat) => s.id === gewoonteId);
        if (updatedStat) {
          setCompletedStat(updatedStat);
          // Set up undo window
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
          setUndoId(gewoonteId);
          undoTimerRef.current = setTimeout(() => setUndoId(null), 5000);
        }
      }
    } catch {
      setGewoontesList((prev) =>
        prev.map((g) => g.id === gewoonteId ? { ...g, voltooidVandaag: !g.voltooidVandaag } : g)
      );
      addToast("Kon gewoonte niet bijwerken", "fout");
    }
  };

  const handleUndo = () => {
    if (undoId === null) return;
    const id = undoId;
    setUndoId(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setCompletedStat(null);
    toggleGewoonte(id, true);
  };

  const handleSave = async (data: { naam: string; icoon: string; frequentie: string; streefwaarde: string; doel: string; waarom: string; verwachteTijd: string }) => {
    try {
      if (editGewoonte) {
        const res = await fetch(`/api/gewoontes/${editGewoonte.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        if (!res.ok) throw new Error();
        addToast("Gewoonte bijgewerkt", "succes");
      } else {
        const res = await fetch("/api/gewoontes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        if (!res.ok) throw new Error();
        addToast("Gewoonte toegevoegd", "succes");
      }
      setModalOpen(false);
      setEditGewoonte(null);
      fetchData();
    } catch { addToast("Kon gewoonte niet opslaan", "fout"); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/gewoontes/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      addToast("Gewoonte verwijderd", "succes");
      setDeleteId(null);
      fetchData();
    } catch { addToast("Kon gewoonte niet verwijderen", "fout"); }
  };

  const addSuggestie = async (s: Suggestie) => {
    try {
      const res = await fetch("/api/gewoontes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      if (!res.ok) throw new Error();
      addToast(`${s.naam} toegevoegd`, "succes");
      fetchData();
    } catch { addToast("Kon suggestie niet toevoegen", "fout"); }
  };

  const voltooid = gewoontesList.filter((g) => g.voltooidVandaag).length;
  const totaal = gewoontesList.length;
  const allesGedaan = totaal > 0 && voltooid === totaal;

  // Gamification
  const totaalPunten = useMemo(() => statistieken.reduce((s, st) => s + st.totaalVoltooid, 0), [statistieken]);
  const levelInfo = useMemo(() => calculateLevel(totaalPunten), [totaalPunten]);

  // Combined heatmap
  const combinedHeatmap = useMemo(() => {
    const combined: Record<string, number> = {};
    for (const stat of statistieken) {
      for (const [datum, waarde] of Object.entries(stat.heatmap)) {
        combined[datum] = (combined[datum] || 0) + waarde;
      }
    }
    return combined;
  }, [statistieken]);

  // Total expected time for remaining habits
  const verwachteTijdTotaal = useMemo(() => {
    return vandaagFocus
      .filter((f) => f.verwachteTijd)
      .reduce((sum, f) => {
        const match = f.verwachteTijd?.match(/(\d+)/);
        return sum + (match ? parseInt(match[1]) : 0);
      }, 0);
  }, [vandaagFocus]);

  const vandaagDagNaam = new Date().toLocaleDateString("nl-NL", { weekday: "long" });
  const isAvond = new Date().getHours() >= 20;
  const streakGevaar = isAvond && vandaagFocus.length > 0;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-autronis-accent animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">Gewoontes</h1>
            <p className="text-base text-autronis-text-secondary mt-1">
              {totaal > 0 ? `${voltooid}/${totaal} vandaag` : "Bouw consistente gewoontes op"}
            </p>
          </div>
          <button onClick={() => { setEditGewoonte(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 px-5 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 btn-press">
            <Plus className="w-4 h-4" /> Nieuwe gewoonte
          </button>
        </div>

        {/* Streak gevaar banner */}
        {streakGevaar && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/8 border border-amber-500/30 rounded-2xl px-5 py-4 flex items-center gap-4"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse flex-shrink-0" />
            <p className="text-sm text-amber-300 flex-1">
              <span className="font-semibold">Het is avond</span> en je hebt nog{" "}
              <span className="font-semibold">{vandaagFocus.length} {vandaagFocus.length === 1 ? "gewoonte" : "gewoontes"}</span> open.
              {vandaagFocus[0]?.streak > 0 && (
                <span> Bescherm je {vandaagFocus[0].streak}-dagen streak.</span>
              )}
            </p>
          </motion.div>
        )}

        {totaal > 0 && (
          <>
            {/* ─── KPIs + Level ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Today's score */}
              <div className={cn("rounded-2xl border p-5 card-glow col-span-2 lg:col-span-1",
                allesGedaan ? "bg-emerald-500/10 border-emerald-500/30" : "bg-autronis-card border-autronis-border")}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider">Vandaag</p>
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-autronis-text-primary tabular-nums">{voltooid}/{totaal}</p>
                <p className="text-xs text-autronis-text-secondary/60 mt-1.5">
                  {allesGedaan ? "Alles gedaan!" : `${totaal - voltooid} resterend`}
                </p>
              </div>

              {/* Week rate */}
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow group relative">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider">Week</p>
                  <div className="p-1.5 rounded-lg bg-blue-500/10"><TrendingUp className="w-3.5 h-3.5 text-blue-400" /></div>
                </div>
                <AnimatedNumber value={weekRate} format={(v) => `${Math.round(v)}%`} className="text-2xl font-bold text-autronis-text-primary tabular-nums" />
                <p className="text-xs text-autronis-text-secondary/60 mt-1.5">Completie rate</p>
                {weekUitleg && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-autronis-bg border border-autronis-border rounded-xl text-xs text-autronis-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                    {weekUitleg}
                  </div>
                )}
              </div>

              {/* Month rate */}
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow group relative">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider">Maand</p>
                  <div className="p-1.5 rounded-lg bg-purple-500/10"><Calendar className="w-3.5 h-3.5 text-purple-400" /></div>
                </div>
                <AnimatedNumber value={maandRate} format={(v) => `${Math.round(v)}%`} className="text-2xl font-bold text-autronis-text-primary tabular-nums" />
                <p className="text-xs text-autronis-text-secondary/60 mt-1.5">Completie rate</p>
                {maandUitleg && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-autronis-bg border border-autronis-border rounded-xl text-xs text-autronis-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                    {maandUitleg}
                  </div>
                )}
              </div>

              {/* Total points */}
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider">Punten</p>
                  <div className="p-1.5 rounded-lg bg-yellow-500/10"><Zap className="w-3.5 h-3.5 text-yellow-400" /></div>
                </div>
                <AnimatedNumber value={totaalPunten} className="text-2xl font-bold text-yellow-400 tabular-nums" />
                <p className="text-xs text-autronis-text-secondary/60 mt-1.5">Totaal verdiend</p>
              </div>

              {/* Level */}
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider">Level</p>
                  <div className="p-1.5 rounded-lg bg-autronis-accent/10">
                    {levelInfo.level >= 6 ? <Crown className="w-3.5 h-3.5 text-yellow-400" /> : levelInfo.level >= 4 ? <Trophy className="w-3.5 h-3.5 text-autronis-accent" /> : <Award className="w-3.5 h-3.5 text-autronis-accent" />}
                  </div>
                </div>
                <p className="text-xl font-bold text-autronis-accent">{levelInfo.naam}</p>
                <div className="w-full h-1.5 bg-autronis-border rounded-full mt-2.5 overflow-hidden">
                  <motion.div
                    className="h-full bg-autronis-accent rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${levelInfo.voortgang}%` }}
                    transition={{ duration: 1, ease: "easeOut" as const, delay: 0.3 }}
                  />
                </div>
                <p className="text-[10px] text-autronis-text-secondary/60 mt-1 tabular-nums">{totaalPunten}/{levelInfo.volgende} naar volgend level</p>
              </div>
            </div>

            {/* ─── BADGES — top for motivation ─── */}
            {badgeVoortgang.length > 0 && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                <h2 className="text-lg font-semibold text-autronis-text-primary mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Badges
                  <span className="text-xs text-autronis-text-secondary ml-1">{badgeVoortgang.filter((b) => b.behaald).length}/{badgeVoortgang.length}</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {badgeVoortgang.map((badge) => {
                    const BadgeIcon = ICON_MAP[badge.icoon] || Trophy;
                    const progress = (badge.huidig / badge.doel) * 100;
                    const colorMap: Record<string, string> = {
                      orange: "text-orange-400 bg-orange-500/10",
                      red: "text-red-400 bg-red-500/10",
                      yellow: "text-yellow-400 bg-yellow-500/10",
                      emerald: "text-emerald-400 bg-emerald-500/10",
                      purple: "text-purple-400 bg-purple-500/10",
                      teal: "text-autronis-accent bg-autronis-accent/10",
                    };
                    const progressColorMap: Record<string, string> = {
                      orange: "bg-orange-400",
                      red: "bg-red-400",
                      yellow: "bg-yellow-400",
                      emerald: "bg-emerald-400",
                      purple: "bg-purple-400",
                      teal: "bg-autronis-accent",
                    };
                    return (
                      <div key={badge.naam}
                        className={cn("flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors group relative overflow-hidden",
                          badge.behaald
                            ? "bg-autronis-bg/50 border-yellow-500/20"
                            : "bg-autronis-bg/20 border-autronis-border/30")}>
                        {/* Shimmer sweep on behaalde badges */}
                        {badge.behaald && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent pointer-events-none"
                            animate={{ x: ["-100%", "200%"] }}
                            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" as const }}
                          />
                        )}
                        <div className={cn("p-2.5 rounded-xl", badge.behaald ? (colorMap[badge.kleur] || colorMap.teal) : "bg-autronis-border/30 text-autronis-text-secondary")}>
                          <BadgeIcon className="w-5 h-5" />
                        </div>
                        <span className={cn("text-[11px] text-center font-medium", badge.behaald ? "text-autronis-text-primary" : "text-autronis-text-secondary")}>{badge.naam}</span>
                        {!badge.behaald && (
                          <div className="w-full space-y-1">
                            <div className="w-full h-1 bg-autronis-border/50 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all", progressColorMap[badge.kleur] || "bg-autronis-accent")}
                                style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-[9px] text-autronis-text-secondary text-center tabular-nums">{badge.huidig}/{badge.doel}</p>
                          </div>
                        )}
                        {badge.behaald && (
                          <span className="text-[9px] text-yellow-400 font-bold">✓ Behaald</span>
                        )}
                        {!badge.behaald && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-autronis-bg border border-autronis-border rounded-xl text-[10px] text-autronis-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                            {badge.tip}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── 1. NEXT ACTION — What to do right now ─── */}
            {vandaagFocus.length > 0 && (
              <div className="bg-gradient-to-r from-autronis-accent/5 to-autronis-card border border-autronis-accent/20 rounded-2xl p-6 lg:p-7 card-glow">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-autronis-text-primary flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-autronis-accent" />
                    Doe dit nu
                  </h2>
                  <div className="flex items-center gap-2">
                    {verwachteTijdTotaal > 0 && (
                      <span className="text-xs text-autronis-text-secondary flex items-center gap-1">
                        <Clock className="w-3 h-3" /> ~{verwachteTijdTotaal} min
                      </span>
                    )}
                    <span className="text-xs text-autronis-text-secondary capitalize">{vandaagDagNaam}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                  {vandaagFocus.map((item, doetNuIdx) => {
                    const Icon = ICON_MAP[item.icoon] || Target;
                    const urgentie = item.streak >= 7 ? "border-l-red-500/70" : item.streak >= 3 ? "border-l-amber-500/50" : "border-l-transparent";
                    return (
                      <motion.div key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -14, transition: { duration: 0.18 } }}
                        transition={{ duration: 0.2, delay: doetNuIdx * 0.045 }}
                        onClick={() => toggleGewoonte(item.id)}
                        className={cn(
                          "flex items-center gap-4 rounded-xl p-4 bg-autronis-bg/50 hover:bg-autronis-bg/80 border border-transparent border-l-2 hover:border-autronis-accent/20 transition-colors cursor-pointer select-none group",
                          urgentie
                        )}
                      >
                        <div className="w-10 h-10 rounded-xl border-2 border-autronis-accent/30 group-hover:border-autronis-accent/60 flex items-center justify-center transition-all flex-shrink-0">
                          <Icon className="w-5 h-5 text-autronis-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-medium text-autronis-text-primary">{item.naam}</p>
                          {item.reden && <p className="text-xs text-autronis-accent/80 mt-0.5">{item.reden}</p>}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {item.verwachteTijd && (
                            <span className="text-xs text-autronis-text-secondary flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {item.verwachteTijd}
                            </span>
                          )}
                          {item.streak > 0 && <StreakFlame streak={item.streak} />}
                          <ArrowRight className="w-4 h-4 text-autronis-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                  {/* Top suggesties als gedimde kaartjes */}
                  {suggesties.slice(0, 2).map((s) => {
                    const Icon = ICON_MAP[s.icoon] || Target;
                    return (
                      <div key={s.naam}
                        className="flex items-center gap-4 rounded-xl p-4 bg-autronis-bg/20 border border-dashed border-autronis-border/50 opacity-60 hover:opacity-90 transition-opacity group"
                      >
                        <div className="w-10 h-10 rounded-xl border border-autronis-border/50 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-autronis-text-secondary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-autronis-text-secondary">{s.naam}</p>
                          {s.streefwaarde && <p className="text-xs text-autronis-text-secondary/60">{s.streefwaarde}</p>}
                        </div>
                        <button
                          onClick={() => addSuggestie(s)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-autronis-accent/10 hover:bg-autronis-accent/20 text-autronis-accent rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                        >
                          <Plus className="w-3 h-3" /> Voeg toe
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── 2. VANDAAG: habit list with checkboxes ─── */}
            <div className={cn("rounded-2xl border p-6 lg:p-7 card-glow",
              allesGedaan ? "bg-emerald-500/5 border-emerald-500/20" : "bg-autronis-card border-autronis-border")}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-autronis-text-primary flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-autronis-accent" />
                  Vandaag
                </h2>
                {allesGedaan && (
                  <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                    <Flame className="w-5 h-5 animate-pulse" /> Alles gedaan!
                  </span>
                )}
              </div>
              {/* Dagvoortgang */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-2.5 bg-autronis-border rounded-full overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", allesGedaan ? "bg-emerald-500" : "bg-autronis-accent")}
                    initial={{ width: 0 }}
                    animate={{ width: `${totaal > 0 ? (voltooid / totaal) * 100 : 0}%` }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                </div>
                <span className="text-xs font-medium text-autronis-text-secondary tabular-nums flex-shrink-0">
                  {Math.round(totaal > 0 ? (voltooid / totaal) * 100 : 0)}%
                </span>
              </div>
              <div className="space-y-2">
                {gewoontesList.map((g, vandaagIdx) => {
                  const Icon = ICON_MAP[g.icoon] || Target;
                  const stat = statistieken.find((s) => s.id === g.id);
                  return (
                    <motion.div key={g.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: vandaagIdx * 0.035 }}
                      onClick={() => toggleGewoonte(g.id)}
                      className={cn(
                        "rounded-xl p-4 flex items-center gap-4 group transition-colors cursor-pointer select-none",
                        g.voltooidVandaag
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-autronis-bg/50 hover:bg-autronis-bg/80 border border-transparent"
                      )}
                    >
                      {/* Large checkbox with burst ring */}
                      <div className="relative flex-shrink-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all",
                          g.voltooidVandaag
                            ? "bg-emerald-500 border-emerald-500 text-white scale-105"
                            : "border-autronis-border group-hover:border-emerald-500/50"
                        )}>
                          {g.voltooidVandaag && (
                            <motion.div
                              key="check"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            >
                              <CheckCircle2 className="w-6 h-6" />
                            </motion.div>
                          )}
                        </div>
                        <AnimatePresence>
                          {g.voltooidVandaag && (
                            <motion.div
                              key="burst"
                              initial={{ scale: 1, opacity: 0.6 }}
                              animate={{ scale: 2.2, opacity: 0 }}
                              exit={{}}
                              transition={{ duration: 0.5, ease: "easeOut" as const }}
                              className="absolute inset-0 rounded-xl bg-emerald-400/30 pointer-events-none"
                            />
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="p-2 bg-autronis-accent/10 rounded-xl flex-shrink-0">
                        <Icon className="w-5 h-5 text-autronis-accent" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={cn("text-base font-medium transition-colors",
                          g.voltooidVandaag ? "text-emerald-400" : "text-autronis-text-primary")}>
                          {g.naam}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {g.streefwaarde && <span className="text-xs text-autronis-text-secondary">{g.streefwaarde}</span>}
                          {g.verwachteTijd && <span className="text-xs text-autronis-text-secondary flex items-center gap-0.5"><Clock className="w-3 h-3" />{g.verwachteTijd}</span>}
                          <span className="text-xs text-autronis-text-secondary capitalize">{g.frequentie}</span>
                          {g.doel && (
                            <span className="text-xs text-autronis-accent/60 truncate max-w-[200px]">
                              {g.doel}
                            </span>
                          )}
                        </div>
                        {/* Inline hover stats */}
                        {stat && (
                          <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-blue-400/80 tabular-nums">{stat.completionRate}% rate</span>
                            {stat.besteDag !== "-" && <span className="text-[10px] text-autronis-text-secondary/60">Beste: {stat.besteDag}</span>}
                            {stat.langsteStreak > 0 && <span className="text-[10px] text-autronis-text-secondary/60">Record: {stat.langsteStreak}d</span>}
                          </div>
                        )}
                      </div>

                      {/* Trend indicator */}
                      {stat && stat.trend !== 0 && (
                        <span className={cn("flex items-center gap-0.5 text-[10px] font-bold flex-shrink-0",
                          stat.trend > 0 ? "text-emerald-400" : "text-red-400/70")}>
                          {stat.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {stat.trend > 0 ? "+" : ""}{stat.trend}
                        </span>
                      )}

                      {/* Streak */}
                      <StreakFlame streak={stat?.huidigeStreak || 0} />

                      {/* Edit/Delete */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setEditGewoonte(g); setModalOpen(true); }}
                          className="p-2 rounded-lg text-autronis-text-secondary hover:text-white hover:bg-autronis-border/50 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(g.id)}
                          className="p-2 rounded-lg text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Motivation reminder: show a random "waarom" when not all done */}
              {!allesGedaan && statistieken.some((s) => s.waarom && !s.voltooidVandaag) && (
                <div className="mt-4 px-4 py-3 bg-autronis-accent/5 rounded-xl border border-autronis-accent/10">
                  <p className="text-xs text-autronis-text-secondary flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-autronis-accent" />
                    <span className="font-medium text-autronis-accent">Onthoud waarom:</span>
                    {statistieken.find((s) => s.waarom && !s.voltooidVandaag)?.waarom}
                  </p>
                </div>
              )}
            </div>

            {/* ─── 3. HABIT INTELLIGENCE — Pattern insights ─── */}
            {inzichten.length > 0 && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <h2 className="text-lg font-semibold text-autronis-text-primary mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  Gewoonte-intelligentie
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {inzichten.map((inzicht, i) => {
                    const config = {
                      positief: { icon: CheckCircle2, border: "border-emerald-500/20", bg: "bg-emerald-500/5", color: "text-emerald-400" },
                      waarschuwing: { icon: AlertTriangle, border: "border-amber-500/20", bg: "bg-amber-500/5", color: "text-amber-400" },
                      tip: { icon: Lightbulb, border: "border-blue-500/20", bg: "bg-blue-500/5", color: "text-blue-400" },
                      actie: { icon: ArrowRight, border: "border-autronis-accent/20", bg: "bg-autronis-accent/5", color: "text-autronis-accent" },
                    }[inzicht.type];
                    const InzichtIcon = config.icon;
                    return (
                      <div key={i} className={cn("flex items-start gap-3 rounded-xl p-4 border", config.border, config.bg)}>
                        <InzichtIcon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", config.color)} />
                        <p className="text-sm text-autronis-text-primary leading-relaxed">{inzicht.tekst}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── 4. Combined Heatmap ─── */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
              <h2 className="text-lg font-semibold text-autronis-text-primary mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-autronis-accent" />
                Activiteit
              </h2>
              <Heatmap data={combinedHeatmap} totaalGewoontes={totaal} />
            </div>

            {/* ─── 6. Per-habit Statistieken (with smarter stats) ─── */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
              <button onClick={() => setShowStats(!showStats)}
                className="flex items-center justify-between w-full mb-4">
                <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-autronis-accent" />
                  Statistieken per gewoonte
                </h2>
                {showStats ? <ChevronUp className="w-5 h-5 text-autronis-text-secondary" /> : <ChevronDown className="w-5 h-5 text-autronis-text-secondary" />}
              </button>
              {showStats && (
                <div className="space-y-5">
                  {statistieken.map((stat) => {
                    const Icon = ICON_MAP[stat.icoon] || Target;
                    const isRecordStreak = stat.huidigeStreak > 0 && stat.huidigeStreak >= stat.langsteStreak;
                    return (
                      <div key={stat.id} className="bg-autronis-bg/50 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="p-2 bg-autronis-accent/10 rounded-xl"><Icon className="w-4 h-4 text-autronis-accent" /></div>
                          <span className="text-base font-semibold text-autronis-text-primary">{stat.naam}</span>
                          {isRecordStreak && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 font-bold">RECORD!</span>
                          )}
                          {stat.trend !== 0 && (
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5",
                              stat.trend > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
                              {stat.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {stat.trend > 0 ? "+" : ""}{stat.trend} deze week
                            </span>
                          )}
                        </div>

                        {/* Motivation: goal + why */}
                        {(stat.doel || stat.waarom) && (
                          <div className="ml-12 mb-4 flex items-center gap-3">
                            {stat.doel && (
                              <span className="text-xs text-autronis-accent/70 flex items-center gap-1">
                                <Target className="w-3 h-3" /> {stat.doel}
                              </span>
                            )}
                            {stat.waarom && (
                              <span className="text-xs text-autronis-text-secondary flex items-center gap-1">
                                <Brain className="w-3 h-3" /> {stat.waarom}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-5">
                          <div>
                            <p className="text-[10px] text-autronis-text-secondary uppercase">Streak</p>
                            <StreakFlame streak={stat.huidigeStreak} />
                            {stat.huidigeStreak === 0 && <p className="text-sm text-autronis-text-secondary">0</p>}
                          </div>
                          <div>
                            <p className="text-[10px] text-autronis-text-secondary uppercase">Record</p>
                            <p className="text-sm font-bold text-autronis-text-primary tabular-nums">{stat.langsteStreak} dagen</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-autronis-text-secondary uppercase">Beste dag</p>
                            <p className="text-sm font-bold text-emerald-400">{stat.besteDag}</p>
                            <p className="text-[10px] text-autronis-text-secondary">Plan dit hier in</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-autronis-text-secondary uppercase">Slechtste dag</p>
                            <p className="text-sm font-bold text-red-400/70">{stat.slechteDag}</p>
                            <p className="text-[10px] text-autronis-text-secondary">Extra aandacht nodig</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-autronis-text-secondary uppercase">Rate</p>
                            <p className="text-sm font-bold text-blue-400 tabular-nums">{stat.completionRate}%</p>
                            <p className="text-[10px] text-autronis-text-secondary">
                              {stat.completionRate >= 90 ? "Elite" : stat.completionRate >= 70 ? "Goed" : stat.completionRate >= 50 ? "OK" : "Verbeter"}
                            </p>
                          </div>
                        </div>
                        <Heatmap data={stat.heatmap} naam="" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── Suggesties ─── */}
        {suggesties.length > 0 && (
          <div className="bg-autronis-card border border-autronis-accent/20 rounded-2xl p-6 card-glow">
            <button onClick={() => setShowSuggesties(!showSuggesties)}
              className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-autronis-accent" />
                <h2 className="text-lg font-semibold text-autronis-text-primary">
                  {totaal === 0 ? "Aanbevolen gewoontes" : "Meer gewoontes toevoegen"}
                </h2>
                <span className="text-xs text-autronis-text-secondary">{suggesties.length} beschikbaar</span>
              </div>
              {totaal > 0 && (showSuggesties ? <ChevronUp className="w-5 h-5 text-autronis-text-secondary" /> : <ChevronDown className="w-5 h-5 text-autronis-text-secondary" />)}
            </button>
            {(totaal === 0 || showSuggesties) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                {suggesties.map((s) => {
                  const Icon = ICON_MAP[s.icoon] || Target;
                  const isAi = s.bron && s.bron !== "standaard";
                  return (
                    <button key={s.naam} onClick={() => addSuggestie(s)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl p-4 text-left transition-colors group border",
                        isAi
                          ? "bg-autronis-accent/5 border-autronis-accent/15 hover:border-autronis-accent/40"
                          : "bg-autronis-bg/50 border-transparent hover:bg-autronis-bg/80 hover:border-autronis-accent/30"
                      )}>
                      <div className="p-2 bg-autronis-accent/10 rounded-xl group-hover:bg-autronis-accent/20 transition-colors flex-shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-autronis-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-autronis-text-primary">{s.naam}</p>
                          {isAi && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-autronis-accent/15 text-autronis-accent flex-shrink-0">
                              AI
                            </span>
                          )}
                        </div>
                        {s.streefwaarde && <p className="text-[11px] text-autronis-text-secondary truncate">{s.streefwaarde}</p>}
                        {isAi && s.waarom && <p className="text-[10px] text-autronis-text-secondary/70 mt-1 line-clamp-2">{s.waarom}</p>}
                      </div>
                      <Plus className="w-4 h-4 text-autronis-text-secondary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {totaal === 0 && suggesties.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-flex p-4 bg-autronis-accent/10 rounded-2xl mb-4">
              <Target className="w-10 h-10 text-autronis-accent" />
            </div>
            <h2 className="text-xl font-bold text-autronis-text-primary mb-2">Geen gewoontes</h2>
            <p className="text-autronis-text-secondary mb-6">Voeg je eerste gewoonte toe om te beginnen.</p>
            <button onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors btn-press">
              <Plus className="w-4 h-4" /> Eerste gewoonte toevoegen
            </button>
          </div>
        )}

        <GewoonteModal open={modalOpen} onClose={() => { setModalOpen(false); setEditGewoonte(null); }} onSave={handleSave} gewoonte={editGewoonte} />
        <ConfirmDialog open={deleteId !== null} titel="Gewoonte verwijderen" bericht="Weet je zeker dat je deze gewoonte wilt verwijderen? De bijbehorende statistieken gaan verloren." onBevestig={handleDelete} onClose={() => setDeleteId(null)} />

        {/* Completion feedback toast */}
        <AnimatePresence>
          {completedStat && (
            <CompletionFeedback
              stat={completedStat}
              onClose={() => { setCompletedStat(null); setUndoId(null); if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }}
              onUndo={undoId !== null ? handleUndo : undefined}
            />
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
