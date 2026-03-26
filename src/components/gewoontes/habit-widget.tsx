"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Flame,
  CheckCircle2,
  ArrowRight,
  Target,
  Dumbbell,
  BookOpen,
  Megaphone,
  Users,
  GraduationCap,
  Sparkles,
  Trophy,
  TrendingUp,
  Calendar,
  Lightbulb,
  Plus,
  Loader2,
  Droplets,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, typeof Target> = {
  Target,
  Dumbbell,
  BookOpen,
  Megaphone,
  Users,
  GraduationCap,
  Sparkles,
  Flame,
  Trophy,
  TrendingUp,
  Calendar,
  Lightbulb,
  Plus,
  CheckCircle2,
  Droplets,
  Shield,
};

interface Gewoonte {
  id: number;
  naam: string;
  icoon: string;
  streefwaarde: string | null;
  voltooidVandaag: boolean;
}

interface HabitStat {
  id: number;
  huidigeStreak: number;
}

export function HabitWidget({ compact = false }: { compact?: boolean }) {
  const [gewoontes, setGewoontes] = useState<Gewoonte[]>([]);
  const [statistieken, setStatistieken] = useState<HabitStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [gRes, sRes] = await Promise.all([
        fetch("/api/gewoontes"),
        fetch("/api/gewoontes/statistieken"),
      ]);
      const gData = await gRes.json();
      const sData = await sRes.json();
      setGewoontes(gData.gewoontes || []);
      setStatistieken(sData.statistieken || []);
    } catch {
      // Silent fail on dashboard widget
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleGewoonte = async (gewoonteId: number) => {
    const vandaag = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch("/api/gewoontes/logboek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gewoonteId, datum: vandaag }),
      });
      if (!res.ok) throw new Error();
      setGewoontes((prev) =>
        prev.map((g) =>
          g.id === gewoonteId ? { ...g, voltooidVandaag: !g.voltooidVandaag } : g
        )
      );
      // Refresh stats in background
      fetch("/api/gewoontes/statistieken")
        .then((r) => r.json())
        .then((d) => setStatistieken(d.statistieken || []));
    } catch {
      // Silent fail
    }
  };

  if (loading) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-5 h-5 text-autronis-accent animate-spin" />
      </div>
    );
  }

  const voltooid = gewoontes.filter((g) => g.voltooidVandaag).length;
  const totaal = gewoontes.length;

  if (totaal === 0) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-orange-500/10 rounded-xl">
            <Flame className="w-5 h-5 text-orange-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Gewoontes</h2>
        </div>
        <p className="text-sm text-autronis-text-secondary mb-4">
          Begin met het tracken van je dagelijkse gewoontes.
        </p>
        <Link
          href="/gewoontes"
          className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors btn-press"
        >
          <Plus className="w-4 h-4" />
          Gewoontes instellen
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow card-gradient">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-orange-500/10 rounded-lg flex-shrink-0">
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <h2 className="text-base font-semibold text-white truncate">Gewoontes</h2>
        </div>
        <Link
          href="/gewoontes"
          className="text-xs text-autronis-accent hover:text-autronis-accent-hover transition-colors flex items-center gap-1 flex-shrink-0"
        >
          Alles <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Score */}
      <div className="flex items-center gap-3 mb-4 bg-autronis-bg/50 rounded-xl p-3">
        <div className={cn(
          "text-2xl font-bold tabular-nums",
          voltooid === totaal ? "text-emerald-400" : "text-white"
        )}>
          {voltooid}/{totaal}
        </div>
        <span className="text-sm text-autronis-text-secondary">gedaan vandaag</span>
        {voltooid === totaal && totaal > 0 && (
          <span className="ml-auto text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
            Perfect!
          </span>
        )}
      </div>

      {/* Habit list */}
      <div className="space-y-2">
        {gewoontes.map((g) => {
          const Icon = ICON_MAP[g.icoon] || Target;
          const stat = statistieken.find((s) => s.id === g.id);
          return (
            <button
              key={g.id}
              onClick={() => toggleGewoonte(g.id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl p-3 transition-all text-left",
                g.voltooidVandaag
                  ? "bg-emerald-500/5 border border-emerald-500/20"
                  : "bg-autronis-bg/30 hover:bg-autronis-bg/50 border border-transparent"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0",
                g.voltooidVandaag
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-autronis-border"
              )}>
                {g.voltooidVandaag && <CheckCircle2 className="w-3 h-3" />}
              </div>
              <Icon className={cn(
                "w-3.5 h-3.5 flex-shrink-0",
                g.voltooidVandaag ? "text-emerald-400" : "text-autronis-text-secondary"
              )} />
              <span className={cn(
                "text-sm font-medium truncate flex-1",
                g.voltooidVandaag ? "text-emerald-400 line-through" : "text-autronis-text-primary"
              )}>
                {g.naam}
              </span>
              {stat && stat.huidigeStreak > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-orange-400 tabular-nums flex-shrink-0">
                  <Flame className="w-3 h-3" />
                  {stat.huidigeStreak}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
