"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, CheckCircle2, Circle, TrendingUp, TrendingDown,
  Minus, Loader2, Save, ChevronRight, Sparkles, Star, AlertTriangle,
  ArrowRight, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";

interface WeekItem { tekst: string; done?: boolean }
interface ReviewData {
  weekNummer: string;
  weekRecord: { reflectie?: string; prioriteiten?: string; voltooide_taken?: string } | null;
}

const PROMPTS = [
  { key: "goed", vraag: "Wat ging er goed deze week?", icon: TrendingUp, color: "text-emerald-400", placeholder: "Successen, doorbraken, goede gesprekken..." },
  { key: "beter", vraag: "Wat kon beter?", icon: TrendingDown, color: "text-amber-400", placeholder: "Obstakels, gemiste kansen, inefficiënties..." },
  { key: "lessen", vraag: "Wat leerde je?", icon: Sparkles, color: "text-purple-400", placeholder: "Inzichten, nieuwe aanpak, leermomenten..." },
  { key: "volgend", vraag: "Wat zijn de 3 focuspunten voor volgende week?", icon: ArrowRight, color: "text-autronis-accent", placeholder: "Prioriteiten voor week +1..." },
] as const;

type PromptKey = typeof PROMPTS[number]["key"];

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default function WeekReviewPage() {
  const { addToast } = useToast();
  const now = new Date();
  const weekNummer = getWeekNumber(now);
  const jaar = now.getFullYear();
  const weekKey = `${jaar}-W${weekNummer.toString().padStart(2, "0")}`;

  const [answers, setAnswers] = useState<Partial<Record<PromptKey, string>>>({});
  const [focusItems, setFocusItems] = useState<WeekItem[]>([]);
  const [customFocus, setCustomFocus] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prevReview, setPrevReview] = useState<{ prioriteiten?: string } | null>(null);

  // Load any existing review for this week
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/dagritme?datum=${weekKey}`);
        const json = await res.json() as { ochtend: { type: string; reflectie?: string; prioriteiten?: string } | null };
        if (json.ochtend && json.ochtend.type === "week" && json.ochtend.reflectie) {
          try {
            const parsed = JSON.parse(json.ochtend.reflectie) as Partial<Record<PromptKey, string>>;
            setAnswers(parsed);
            setSaved(true);
          } catch {
            // skip
          }
        }
        // Load last week's focus items to check off
        const prevWeekNum = weekNummer - 1;
        const prevKey = prevWeekNum > 0 ? `${jaar}-W${prevWeekNum.toString().padStart(2, "0")}` : null;
        if (prevKey) {
          const prevRes = await fetch(`/api/dagritme?datum=${prevKey}`);
          const prevJson = await prevRes.json() as { ochtend: { prioriteiten?: string } | null };
          if (prevJson.ochtend?.prioriteiten) {
            setPrevReview(prevJson.ochtend);
          }
        }
      } catch {
        // ignore
      }
    }
    load();
  }, [weekKey, weekNummer, jaar]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const reflectie = JSON.stringify(answers);
      const prioriteiten = focusItems.length > 0 ? JSON.stringify(focusItems) : undefined;
      await fetch("/api/dagritme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "week", datum: weekKey, reflectie, prioriteiten }),
      });
      addToast("Weekreview opgeslagen", "succes");
      setSaved(true);
    } catch {
      addToast("Opslaan mislukt", "fout");
    } finally {
      setSaving(false);
    }
  }, [answers, focusItems, weekKey, addToast]);

  const isFriday = now.getDay() === 5;

  // Parse previous week's focus items for review
  let prevFocus: WeekItem[] = [];
  if (prevReview?.prioriteiten) {
    try { prevFocus = JSON.parse(prevReview.prioriteiten) as WeekItem[]; } catch { /* skip */ }
  }

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto p-4 lg:p-8 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-5 h-5 text-autronis-accent" />
            <h1 className="text-2xl font-bold text-autronis-text-primary">Weekreview</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-autronis-text-secondary">
              Week {weekNummer} · {jaar}
            </p>
            {!isFriday && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Doe dit op vrijdag
              </span>
            )}
            {saved && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Opgeslagen
              </span>
            )}
          </div>
        </div>

        {/* Previous week focus checklist */}
        {prevFocus.length > 0 && (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              Focuspunten vorige week — hoe ging het?
            </h3>
            <div className="space-y-2">
              {prevFocus.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPrevReview((prev) => {
                      if (!prev) return prev;
                      const updated = [...prevFocus];
                      updated[i] = { ...updated[i], done: !updated[i].done };
                      return { ...prev, prioriteiten: JSON.stringify(updated) };
                    });
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl px-4 py-2.5 border text-left transition-all",
                    item.done
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : "bg-autronis-bg/50 border-autronis-border hover:border-autronis-accent/30"
                  )}
                >
                  {item.done
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    : <Circle className="w-4 h-4 text-autronis-text-secondary/40 shrink-0" />
                  }
                  <span className={cn("text-sm", item.done ? "text-emerald-300 line-through opacity-70" : "text-autronis-text-primary")}>
                    {item.tekst}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Review prompts */}
        <div className="space-y-4">
          {PROMPTS.map((prompt) => {
            const Icon = prompt.icon;
            return (
              <motion.div
                key={prompt.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-autronis-card border border-autronis-border rounded-2xl p-5 space-y-3"
              >
                <p className={cn("text-sm font-semibold flex items-center gap-2", prompt.color)}>
                  <Icon className="w-4 h-4" />
                  {prompt.vraag}
                </p>
                <textarea
                  value={answers[prompt.key] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [prompt.key]: e.target.value }))}
                  placeholder={prompt.placeholder}
                  rows={3}
                  className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors resize-none leading-relaxed"
                />
              </motion.div>
            );
          })}
        </div>

        {/* Volgende week focus */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-autronis-accent flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            Top 3 voor volgende week
          </p>
          <div className="space-y-2">
            <AnimatePresence>
              {focusItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 bg-autronis-accent/10 border border-autronis-accent/20 rounded-xl px-4 py-2.5"
                >
                  <span className="w-5 h-5 rounded-full bg-autronis-accent/20 text-autronis-accent text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="text-sm text-autronis-text-primary flex-1">{item.tekst}</span>
                  <button onClick={() => setFocusItems((p) => p.filter((_, j) => j !== i))} className="text-autronis-text-secondary hover:text-red-400 transition-colors text-lg leading-none">×</button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {focusItems.length < 3 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={customFocus}
                onChange={(e) => setCustomFocus(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customFocus.trim()) {
                    setFocusItems((p) => [...p, { tekst: customFocus.trim() }]);
                    setCustomFocus("");
                  }
                }}
                placeholder="Focuspunt voor volgende week..."
                className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
              />
              <button
                onClick={() => { if (customFocus.trim()) { setFocusItems((p) => [...p, { tekst: customFocus.trim() }]); setCustomFocus(""); } }}
                disabled={!customFocus.trim()}
                className="px-4 py-2 bg-autronis-accent text-autronis-bg rounded-xl text-sm font-medium hover:bg-autronis-accent-hover transition-colors disabled:opacity-40"
              >+</button>
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || Object.keys(answers).length === 0}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-autronis-accent text-autronis-bg rounded-xl font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Weekreview opslaan
        </button>

        {saved && (
          <button
            onClick={() => { setAnswers({}); setFocusItems([]); setSaved(false); }}
            className="w-full text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors flex items-center gap-1 justify-center"
          >
            <RotateCcw className="w-3 h-3" />
            Opnieuw invullen
          </button>
        )}
      </div>
    </PageTransition>
  );
}
