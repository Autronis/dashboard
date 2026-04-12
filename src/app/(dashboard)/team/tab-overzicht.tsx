"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, CheckSquare, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ============ TYPES ============

interface TopProject {
  naam: string;
  uren: number;
}

interface UserOverzicht {
  id: number;
  naam: string;
  urenDezeWeek: number;
  urenVorigeWeek: number;
  autronisUren: number;
  klantUren: number;
  topProjecten: TopProject[];
  takenAfgerondDezeWeek: number;
}

interface OverzichtData {
  users: UserOverzicht[];
  maandag: string;
  zondag: string;
}

// ============ HELPERS ============

function getInitials(naam: string): string {
  return naam
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS: Record<number, string> = {
  1: "from-teal-500 to-teal-700",
  2: "from-blue-500 to-blue-700",
};

// ============ SKELETON ============

function CardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-[#192225] to-[#1A2528] rounded-2xl p-6 border border-[#2A3538] space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-12 w-24" />
      <Skeleton className="h-6 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}

// ============ STACKED BAR ============

function UrenBar({ autronisUren, klantUren }: { autronisUren: number; klantUren: number }) {
  const totaal = autronisUren + klantUren;
  if (totaal === 0) {
    return (
      <div className="space-y-1.5">
        <div className="h-3 rounded-full bg-[#2A3538] overflow-hidden" />
        <div className="flex justify-between text-xs text-autronis-text-secondary">
          <span>Autronis 0u</span>
          <span>Klant 0u</span>
        </div>
      </div>
    );
  }
  const autPct = Math.round((autronisUren / totaal) * 100);
  const klantPct = 100 - autPct;

  return (
    <div className="space-y-1.5">
      <div className="h-3 rounded-full bg-[#2A3538] overflow-hidden flex">
        {autPct > 0 && (
          <div
            className="h-full bg-[#17B8A5] transition-all duration-700"
            style={{ width: `${autPct}%` }}
          />
        )}
        {klantPct > 0 && (
          <div
            className="h-full bg-orange-400 transition-all duration-700"
            style={{ width: `${klantPct}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-autronis-text-secondary">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-[#17B8A5]" />
          Autronis {autronisUren}u
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-orange-400" />
          Klant {klantUren}u
        </span>
      </div>
    </div>
  );
}

// ============ USER CARD ============

function UserCard({ user, index }: { user: UserOverzicht; index: number }) {
  const urenDelta = Math.round((user.urenDezeWeek - user.urenVorigeWeek) * 10) / 10;
  const heeftUren = user.urenDezeWeek > 0;
  const avatarGradient = AVATAR_COLORS[user.id] ?? "from-slate-500 to-slate-700";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1, ease: "easeOut" }}
      className="bg-gradient-to-br from-[#192225] to-[#1A2528] rounded-2xl border border-[#2A3538] overflow-hidden"
    >
      {/* ---- HEADER ---- */}
      <div className="p-6 pb-5 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              "w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm",
              avatarGradient
            )}
          >
            {getInitials(user.naam)}
          </div>
          <span
            className={cn(
              "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#192225]",
              heeftUren ? "bg-green-400" : "bg-slate-500"
            )}
          />
        </div>
        <div>
          <p className="font-semibold text-autronis-text-primary leading-tight">{user.naam}</p>
          <p className={cn("text-xs mt-0.5", heeftUren ? "text-green-400" : "text-autronis-text-secondary")}>
            {heeftUren ? `${user.urenDezeWeek}u deze week` : "Nog geen uren"}
          </p>
        </div>
      </div>

      <div className="border-t border-[#2A3538]" />

      {/* ---- UREN DEZE WEEK ---- */}
      <div className="p-6 pb-5 space-y-1">
        <p className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wider">Deep work deze week</p>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-autronis-text-primary tabular-nums">
            {user.urenDezeWeek}u
          </span>
          {urenDelta !== 0 && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-sm font-medium mb-1",
                urenDelta > 0 ? "text-green-400" : "text-red-400"
              )}
            >
              {urenDelta > 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {urenDelta > 0 ? "+" : ""}{urenDelta}u vs vorige week
            </span>
          )}
          {urenDelta === 0 && user.urenVorigeWeek > 0 && (
            <span className="flex items-center gap-0.5 text-sm font-medium text-autronis-text-secondary mb-1">
              <Minus className="w-3.5 h-3.5" />
              Gelijk aan vorige week
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-[#2A3538]" />

      {/* ---- AUTRONIS VS KLANT ---- */}
      <div className="p-6 pb-5 space-y-2">
        <p className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wider">Uren splitsing</p>
        <UrenBar autronisUren={user.autronisUren} klantUren={user.klantUren} />
      </div>

      <div className="border-t border-[#2A3538]" />

      {/* ---- TOP 3 PROJECTEN ---- */}
      <div className="p-6 pb-5 space-y-3">
        <p className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wider">Top projecten</p>
        {user.topProjecten.length === 0 ? (
          <p className="text-sm text-autronis-text-secondary italic">Geen uren geregistreerd</p>
        ) : (
          <ul className="space-y-2">
            {user.topProjecten.map((p, i) => {
              const totaal = user.urenDezeWeek;
              const pct = totaal > 0 ? Math.round((p.uren / totaal) * 100) : 0;
              return (
                <li key={i} className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-autronis-text-primary truncate max-w-[180px]">{p.naam}</span>
                    <span className="text-autronis-text-secondary tabular-nums ml-2 flex-shrink-0">{p.uren}u</span>
                  </div>
                  <div className="h-1 rounded-full bg-[#2A3538] overflow-hidden">
                    <div
                      className="h-full bg-[#17B8A5]/60 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-[#2A3538]" />

      {/* ---- TAKEN ---- */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#17B8A5]/10 flex items-center justify-center flex-shrink-0">
          <CheckSquare className="w-4 h-4 text-[#17B8A5]" />
        </div>
        <div>
          <p className="text-xs text-autronis-text-secondary">Taken afgerond deze week</p>
          <p className="text-lg font-bold text-autronis-text-primary tabular-nums">
            {user.takenAfgerondDezeWeek}
            <span className="text-sm font-normal text-autronis-text-secondary ml-1">taken</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ============ MAIN TAB COMPONENT ============

export function OverzichtTab() {
  const [data, setData] = useState<OverzichtData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/team/overzicht");
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as { fout?: string };
          throw new Error(d.fout ?? "Kon overzicht niet laden");
        }
        const json = await res.json() as OverzichtData;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Onbekende fout");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <Activity className="w-10 h-10 text-autronis-text-secondary mx-auto" />
          <p className="text-autronis-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.users.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-autronis-text-secondary">Geen teamleden gevonden</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-autronis-text-secondary">
          Week van {data.maandag} t/m {data.zondag}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.users.map((user, i) => (
          <UserCard key={user.id} user={user} index={i} />
        ))}
      </div>
    </div>
  );
}
