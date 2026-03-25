"use client";

import { useState } from "react";
import {
  Calendar,
  Plus,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Users2,
  AlertTriangle,
  ExternalLink,
  Palmtree,
  HeartPulse,
  Star,
  Filter,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatBedrag, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useCurrentUser,
  useVerlof,
  useDeclaraties,
  useCapaciteit,
  type VerlofEntry,
  type CurrentUser,
} from "@/hooks/queries/use-team";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { FormField, SelectField, TextareaField } from "@/components/ui/form-field";

// ============ HELPERS ============

const MAANDEN = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];
const MAANDEN_KORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const DAG_HEADERS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function getDaysInMonth(jaar: number, maand: number): number {
  return new Date(jaar, maand + 1, 0).getDate();
}

function getFirstDayOfMonth(jaar: number, maand: number): number {
  const day = new Date(jaar, maand, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function isWeekend(jaar: number, maand: number, dag: number): boolean {
  const d = new Date(jaar, maand, dag).getDay();
  return d === 0 || d === 6;
}

function dateString(jaar: number, maand: number, dag: number): string {
  return `${jaar}-${String(maand + 1).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
}

function getISOWeek(date: Date): { week: number; jaar: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week: weekNo, jaar: d.getUTCFullYear() };
}

function countWeekdays(start: string, end: string): number {
  if (!start || !end || start > end) return 0;
  const endDate = new Date(end);
  let count = 0;
  for (let d = new Date(start); d <= endDate; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

function getConflictWeeks(verlofList: VerlofEntry[], vandaag: Date): string[] {
  const vandaagStr = vandaag.toISOString().slice(0, 10);
  const semVerlof = verlofList.filter(
    (v) => v.gebruikerId === 1 && (v.status === "goedgekeurd" || v.status === "aangevraagd")
  );
  const sybVerlof = verlofList.filter(
    (v) => v.gebruikerId === 2 && (v.status === "goedgekeurd" || v.status === "aangevraagd")
  );
  const conflictWeeks = new Set<string>();

  for (const sv of semVerlof) {
    for (const syv of sybVerlof) {
      if (sv.startDatum <= syv.eindDatum && sv.eindDatum >= syv.startDatum) {
        const overlapStart = sv.startDatum > syv.startDatum ? sv.startDatum : syv.startDatum;
        const overlapEnd = sv.eindDatum < syv.eindDatum ? sv.eindDatum : syv.eindDatum;
        const overlapEndDate = new Date(overlapEnd);
        for (let d = new Date(overlapStart); d <= overlapEndDate; d.setDate(d.getDate() + 1)) {
          const day = d.getDay();
          const dStr = d.toISOString().slice(0, 10);
          if (day !== 0 && day !== 6 && dStr >= vandaagStr) {
            const { week, jaar } = getISOWeek(d);
            conflictWeeks.add(`Week ${week} (${jaar})`);
          }
        }
      }
    }
  }

  return Array.from(conflictWeeks).sort().slice(0, 3);
}

function getNextVacation(verlofList: VerlofEntry[], userId: number, vandaag: Date): { label: string; dagen: number } | null {
  const vandaagStr = vandaag.toISOString().slice(0, 10);
  const upcoming = verlofList
    .filter((v) => v.gebruikerId === userId && v.status === "goedgekeurd" && v.type === "vakantie" && v.startDatum >= vandaagStr)
    .sort((a, b) => a.startDatum.localeCompare(b.startDatum));
  if (!upcoming.length) return null;
  const next = upcoming[0];
  const daysUntil = Math.ceil((new Date(next.startDatum).getTime() - vandaag.getTime()) / (1000 * 60 * 60 * 24));
  const duur = countWeekdays(next.startDatum, next.eindDatum);
  if (daysUntil === 0) return { label: `Vandaag — ${duur}d`, dagen: duur };
  if (daysUntil <= 7) return { label: `Over ${daysUntil}d — ${duur}d`, dagen: duur };
  return { label: `${MAANDEN_KORT[new Date(next.startDatum).getMonth()]} — ${duur}d`, dagen: duur };
}

function getVacationForecast(verlofList: VerlofEntry[], userId: number, vandaag: Date): string | null {
  const year = vandaag.getFullYear();
  const yearStartMs = new Date(year, 0, 1).getTime();
  const weeksElapsed = Math.max(1, Math.ceil((vandaag.getTime() - yearStartMs) / (7 * 86400000)));

  let daysTaken = 0;
  verlofList
    .filter(
      (v) =>
        v.gebruikerId === userId &&
        v.status === "goedgekeurd" &&
        v.type === "vakantie" &&
        v.startDatum.startsWith(String(year))
    )
    .forEach((v) => {
      daysTaken += countWeekdays(v.startDatum, v.eindDatum);
    });

  if (daysTaken >= 20) return "Vakantiebudget bereikt";
  if (daysTaken === 0) return null;

  const rate = daysTaken / weeksElapsed;
  const weeksLeft = Math.round((20 - daysTaken) / rate);
  const forecast = new Date(vandaag);
  forecast.setDate(forecast.getDate() + weeksLeft * 7);
  return `Op dit tempo rond ${MAANDEN_KORT[forecast.getMonth()]} ${forecast.getFullYear()}`;
}

// ============ STATUS & STYLE CONFIGS ============

const verlofStatusConfig: Record<string, { color: string; bg: string; label: string }> = {
  aangevraagd: { color: "text-yellow-400", bg: "bg-yellow-500/15", label: "Aangevraagd" },
  goedgekeurd: { color: "text-green-400", bg: "bg-green-500/15", label: "Goedgekeurd" },
  afgewezen: { color: "text-red-400", bg: "bg-red-500/15", label: "Afgewezen" },
};

const declaratieStatusConfig: Record<string, { color: string; bg: string; label: string }> = {
  ingediend: { color: "text-yellow-400", bg: "bg-yellow-500/15", label: "Ingediend" },
  goedgekeurd: { color: "text-green-400", bg: "bg-green-500/15", label: "Goedgekeurd" },
  uitbetaald: { color: "text-blue-400", bg: "bg-blue-500/15", label: "Uitbetaald" },
  afgewezen: { color: "text-red-400", bg: "bg-red-500/15", label: "Afgewezen" },
};

const categorieConfig: Record<string, { bg: string; text: string; label: string }> = {
  kantoor: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Kantoor" },
  hardware: { bg: "bg-teal-500/15", text: "text-teal-400", label: "Hardware" },
  reiskosten: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Reiskosten" },
  marketing: { bg: "bg-purple-500/15", text: "text-purple-400", label: "Marketing" },
  onderwijs: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Onderwijs" },
  telefoon: { bg: "bg-green-500/15", text: "text-green-400", label: "Telefoon" },
  verzekeringen: { bg: "bg-orange-500/15", text: "text-orange-400", label: "Verzekeringen" },
  overig: { bg: "bg-gray-500/15", text: "text-gray-400", label: "Overig" },
};

const verlofTypeConfig: Record<string, { icon: typeof Palmtree; color: string; label: string }> = {
  vakantie: { icon: Palmtree, color: "text-blue-400", label: "Vakantie" },
  ziek: { icon: HeartPulse, color: "text-red-400", label: "Ziek" },
  bijzonder: { icon: Star, color: "text-purple-400", label: "Bijzonder verlof" },
};

// ============ MAIN COMPONENT ============

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<"verlof" | "declaraties" | "capaciteit">("verlof");
  const { data: currentUser } = useCurrentUser();
  const { data: verlofData } = useVerlof(new Date().getFullYear());
  const pendingCount = (verlofData?.verlof ?? []).filter((v) => v.status === "aangevraagd").length;

  const tabs = [
    { key: "verlof" as const, label: "Verlof", icon: Calendar },
    { key: "declaraties" as const, label: "Declaraties", icon: Receipt },
    { key: "capaciteit" as const, label: "Capaciteit", icon: Users2 },
  ];

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">Team</h1>
          <p className="text-base text-autronis-text-secondary mt-1">
            Verlof, declaraties en capaciteitsoverzicht
          </p>
        </div>

        <div className="flex items-center gap-2 border-b border-autronis-border pb-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                  activeTab === tab.key
                    ? "border-autronis-accent text-autronis-accent"
                    : "border-transparent text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.key === "verlof" && pendingCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-yellow-500/20 text-yellow-400 rounded-full leading-none">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {activeTab === "verlof" && <VerlofTab currentUser={currentUser} />}
            {activeTab === "declaraties" && <DeclaratiesTab currentUser={currentUser} />}
            {activeTab === "capaciteit" && <CapaciteitTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}

// ============ VERLOF TAB ============

function VerlofTab({ currentUser }: { currentUser: CurrentUser | null | undefined }) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [jaar, setJaar] = useState(new Date().getFullYear());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const vandaag = new Date();

  const [form, setForm] = useState({
    startDatum: "",
    eindDatum: "",
    type: "vakantie",
    notities: "",
  });

  const { data, isLoading: loading } = useVerlof(jaar);
  const verlofList = data?.verlof ?? [];
  const feestdagenList = data?.feestdagen ?? [];

  const submitMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      const res = await fetch("/api/team/verlof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Kon verlof niet aanvragen");
      }
    },
    onSuccess: () => {
      addToast("Verlof aangevraagd", "succes");
      setModalOpen(false);
      setForm({ startDatum: "", eindDatum: "", type: "vakantie", notities: "" });
      queryClient.invalidateQueries({ queryKey: ["team", "verlof"] });
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : "Fout bij aanvragen", "fout");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "goedgekeurd" | "afgewezen" }) => {
      const res = await fetch(`/api/team/verlof/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Kon status niet bijwerken");
      }
      return status;
    },
    onSuccess: (status) => {
      addToast(status === "goedgekeurd" ? "Verlof goedgekeurd" : "Verlof afgewezen", "succes");
      queryClient.invalidateQueries({ queryKey: ["team", "verlof"] });
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : "Fout bij bijwerken", "fout");
    },
  });

  const saving = submitMutation.isPending;

  const feestdagMap = new Map<string, string>();
  feestdagenList.forEach((f) => feestdagMap.set(f.datum, f.naam));

  const verlofPerDag = new Map<string, VerlofEntry[]>();
  verlofList
    .filter((v) => v.status === "goedgekeurd" || v.status === "aangevraagd")
    .forEach((v) => {
      const endDate = new Date(v.eindDatum);
      for (let d = new Date(v.startDatum); d <= endDate; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        const existing = verlofPerDag.get(key) ?? [];
        existing.push(v);
        verlofPerDag.set(key, existing);
      }
    });

  function countVakantiedagen(gebruikerId: number): number {
    return verlofList
      .filter(
        (v) =>
          v.gebruikerId === gebruikerId &&
          v.status === "goedgekeurd" &&
          v.type === "vakantie" &&
          v.startDatum.startsWith(String(jaar))
      )
      .reduce((sum, v) => sum + countWeekdays(v.startDatum, v.eindDatum), 0);
  }

  function getDayColor(datum: string, jaarN: number, maand: number, dag: number): string {
    if (isWeekend(jaarN, maand, dag)) return "bg-autronis-bg/50 text-autronis-text-secondary/30";
    if (feestdagMap.has(datum)) return "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30";
    const entries = verlofPerDag.get(datum) ?? [];
    if (entries.length === 0)
      return "bg-green-500/10 text-green-400/70 hover:bg-green-500/25 cursor-pointer";
    const hasZiek = entries.some((e) => e.type === "ziek");
    const hasSem = entries.some((e) => e.gebruikerId === 1);
    const hasSyb = entries.some((e) => e.gebruikerId === 2);
    if (hasZiek) return "bg-red-500/20 text-red-400 hover:bg-red-500/30";
    if (hasSem && hasSyb)
      return "bg-gradient-to-r from-blue-500/30 to-purple-500/30 text-autronis-text-primary hover:from-blue-500/40 hover:to-purple-500/40";
    if (hasSem) return "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30";
    if (hasSyb) return "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30";
    return "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30";
  }

  const vandaagStr = vandaag.toISOString().slice(0, 10);
  const semDagen = countVakantiedagen(1);
  const sybDagen = countVakantiedagen(2);
  const semForecast = jaar === vandaag.getFullYear() ? getVacationForecast(verlofList, 1, vandaag) : null;
  const sybForecast = jaar === vandaag.getFullYear() ? getVacationForecast(verlofList, 2, vandaag) : null;
  const semNextVacation = jaar === vandaag.getFullYear() ? getNextVacation(verlofList, 1, vandaag) : null;
  const sybNextVacation = jaar === vandaag.getFullYear() ? getNextVacation(verlofList, 2, vandaag) : null;
  const conflictWeeks = getConflictWeeks(verlofList, vandaag);
  const openstaandeAanvragen = verlofList.filter((v) => v.status === "aangevraagd");

  // Modal: days preview
  const aangevraagdDagen = form.type === "vakantie" ? countWeekdays(form.startDatum, form.eindDatum) : 0;
  const mijnDagen = countVakantiedagen(currentUser?.id ?? 0);
  const naAanvraag = mijnDagen + aangevraagdDagen;

  const andereNaam = currentUser?.naam === "Sem" ? "Syb" : "Sem";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conflict warning */}
      {conflictWeeks.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">
              Beiden vrij: {conflictWeeks.join(", ")}
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5">Check openstaande deadlines voor deze weken</p>
          </div>
        </div>
      )}

      {/* Vakantiedagen tellers */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Sem */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            whileHover={{ scale: 1.02 }}
            className="bg-autronis-card border border-autronis-border rounded-2xl p-4 card-glow min-w-[160px]"
          >
            <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-1">Sem</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-400 tabular-nums">{semDagen}</span>
              <span className="text-sm text-autronis-text-secondary">/ 20 dagen</span>
            </div>
            <div className="mt-2 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-400 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${Math.min((semDagen / 20) * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              />
            </div>
            {semNextVacation && (
              <p className="text-[10px] text-blue-400/70 mt-1.5 flex items-center gap-1">
                <Palmtree className="w-2.5 h-2.5 flex-shrink-0" />
                {semNextVacation.label}
              </p>
            )}
            {!semNextVacation && semForecast && (
              <p className="text-[10px] text-autronis-text-secondary/60 mt-1.5 flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5 flex-shrink-0" />
                {semForecast}
              </p>
            )}
          </motion.div>

          {/* Syb */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.3 }}
            whileHover={{ scale: 1.02 }}
            className="bg-autronis-card border border-autronis-border rounded-2xl p-4 card-glow min-w-[160px]"
          >
            <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-1">Syb</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-400 tabular-nums">{sybDagen}</span>
              <span className="text-sm text-autronis-text-secondary">/ 20 dagen</span>
            </div>
            <div className="mt-2 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-purple-400 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${Math.min((sybDagen / 20) * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              />
            </div>
            {sybNextVacation && (
              <p className="text-[10px] text-purple-400/70 mt-1.5 flex items-center gap-1">
                <Palmtree className="w-2.5 h-2.5 flex-shrink-0" />
                {sybNextVacation.label}
              </p>
            )}
            {!sybNextVacation && sybForecast && (
              <p className="text-[10px] text-autronis-text-secondary/60 mt-1.5 flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5 flex-shrink-0" />
                {sybForecast}
              </p>
            )}
          </motion.div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autronis-accent text-white font-medium hover:bg-autronis-accent-hover transition-colors self-start"
        >
          <Plus className="w-4 h-4" />
          Verlof aanvragen
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-autronis-text-secondary">
        {[
          { color: "bg-green-500/20", label: "Werkdag" },
          { color: "bg-orange-500/20", label: "Feestdag" },
          { color: "bg-blue-500/20", label: "Vakantie Sem" },
          { color: "bg-purple-500/20", label: "Vakantie Syb" },
          { color: "bg-red-500/20", label: "Ziek" },
          { color: "bg-autronis-bg/50", label: "Weekend" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-sm", color)} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setJaar((j) => j - 1)}
          className="p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={jaar}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="text-lg font-semibold text-autronis-text-primary tabular-nums w-12 text-center inline-block"
          >
            {jaar}
          </motion.span>
        </AnimatePresence>
        <button
          onClick={() => setJaar((j) => j + 1)}
          className="p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        {jaar !== vandaag.getFullYear() && (
          <button
            onClick={() => setJaar(vandaag.getFullYear())}
            className="px-2.5 py-1 text-xs text-autronis-text-secondary border border-autronis-border rounded-lg hover:bg-autronis-border transition-colors"
          >
            Huidig jaar
          </button>
        )}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, maand) => {
          const daysInMonth = getDaysInMonth(jaar, maand);
          const firstDay = getFirstDayOfMonth(jaar, maand);
          const isCurrMonth = jaar === vandaag.getFullYear() && maand === vandaag.getMonth();

          return (
            <motion.div
              key={`${jaar}-${maand}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: maand * 0.03, duration: 0.25 }}
              className={cn(
                "bg-autronis-card border rounded-2xl p-4 card-glow",
                isCurrMonth
                  ? "border-autronis-accent/40 shadow-sm shadow-autronis-accent/10"
                  : "border-autronis-border"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className={cn("text-sm font-semibold", isCurrMonth ? "text-autronis-accent" : "text-autronis-text-primary")}>
                  {MAANDEN[maand]}
                </h3>
                {isCurrMonth && (
                  <span className="text-[10px] font-semibold text-autronis-accent/70 bg-autronis-accent/10 px-1.5 py-0.5 rounded-full">Nu</span>
                )}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {DAG_HEADERS.map((d) => (
                  <div
                    key={d}
                    className="text-[10px] text-autronis-text-secondary/50 text-center font-medium pb-1"
                  >
                    {d}
                  </div>
                ))}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="w-full aspect-square" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dag = i + 1;
                  const datum = dateString(jaar, maand, dag);
                  const color = getDayColor(datum, jaar, maand, dag);
                  const entries = verlofPerDag.get(datum) ?? [];
                  const feestdagNaam = feestdagMap.get(datum);
                  const isSelected = selectedDay === datum;
                  const isToday = datum === vandaagStr;

                  return (
                    <button
                      key={dag}
                      onClick={() => setSelectedDay(selectedDay === datum ? null : datum)}
                      className={cn(
                        "w-full aspect-square rounded-sm text-[10px] font-medium flex items-center justify-center transition-all relative",
                        color,
                        isSelected && "ring-2 ring-autronis-accent ring-offset-1 ring-offset-autronis-card",
                        isToday && !isSelected && "ring-2 ring-white/40 ring-offset-1 ring-offset-autronis-card font-bold"
                      )}
                      title={
                        feestdagNaam
                          ? feestdagNaam
                          : entries.length > 0
                          ? entries
                              .map(
                                (e) =>
                                  `${e.gebruikerNaam}: ${verlofTypeConfig[e.type ?? "vakantie"]?.label}`
                              )
                              .join(", ")
                          : isToday ? "Vandaag" : undefined
                      }
                    >
                      {dag}
                      {isToday && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/60" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Selected day detail — animated slide-down */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-autronis-text-primary">
                  {formatDatumKort(selectedDay)}
                </h3>
                <button
                  onClick={() => {
                    setForm((f) => ({ ...f, startDatum: selectedDay, eindDatum: selectedDay }));
                    setModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-autronis-accent border border-autronis-accent/30 rounded-lg hover:bg-autronis-accent/10 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Verlof aanvragen op deze dag
                </button>
              </div>
              {feestdagMap.has(selectedDay) && (
                <p className="text-sm text-orange-400 mb-2">
                  Feestdag: {feestdagMap.get(selectedDay)}
                </p>
              )}
              {(verlofPerDag.get(selectedDay) ?? []).map((v, i) => {
                const typeConf = verlofTypeConfig[v.type ?? "vakantie"];
                const TypeIcon = typeConf?.icon ?? Palmtree;
                return (
                  <div key={i} className="flex items-center gap-3 mb-2">
                    <TypeIcon className={cn("w-4 h-4", typeConf?.color)} />
                    <span className="text-sm text-autronis-text-primary">{v.gebruikerNaam}</span>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        verlofStatusConfig[v.status ?? "aangevraagd"]?.bg,
                        verlofStatusConfig[v.status ?? "aangevraagd"]?.color
                      )}
                    >
                      {verlofStatusConfig[v.status ?? "aangevraagd"]?.label}
                    </span>
                  </div>
                );
              })}
              {!feestdagMap.has(selectedDay) && (verlofPerDag.get(selectedDay) ?? []).length === 0 && (
                <p className="text-sm text-autronis-text-secondary">Geen bijzonderheden op deze dag.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verlofaanvragen list — only when there are pending */}
      {openstaandeAanvragen.length > 0 && (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
          <h3 className="text-lg font-semibold text-autronis-text-primary mb-4">
            Verlofaanvragen
            <span className="ml-2 text-sm font-normal text-yellow-400">
              ({openstaandeAanvragen.length} openstaand)
            </span>
          </h3>
          <div className="space-y-3">
            {verlofList.map((v, idx) => {
              const sc = verlofStatusConfig[v.status ?? "aangevraagd"];
              const typeConf = verlofTypeConfig[v.type ?? "vakantie"];
              const TypeIcon = typeConf?.icon ?? Palmtree;
              const isOwn = currentUser && v.gebruikerId === currentUser.id;
              const canReview = !isOwn && v.status === "aangevraagd";

              return (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.25 }}
                  className="flex items-center gap-4 bg-autronis-bg/30 rounded-xl border border-autronis-border/50 px-5 py-4"
                >
                  <TypeIcon className={cn("w-5 h-5 flex-shrink-0", typeConf?.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-sm font-medium text-autronis-text-primary">{v.gebruikerNaam}</p>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sc?.bg, sc?.color)}>
                        {sc?.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-autronis-border text-autronis-text-secondary">
                        {typeConf?.label}
                      </span>
                    </div>
                    <p className="text-sm text-autronis-text-secondary mt-0.5">
                      {formatDatumKort(v.startDatum)} - {formatDatumKort(v.eindDatum)}
                      {v.notities && (
                        <span className="ml-2 text-autronis-text-secondary/70">— {v.notities}</span>
                      )}
                    </p>
                  </div>
                  {canReview && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => statusMutation.mutate({ id: v.id, status: "goedgekeurd" })}
                        className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                        title="Goedkeuren"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => statusMutation.mutate({ id: v.id, status: "afgewezen" })}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Afwijzen"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {isOwn && v.status === "aangevraagd" && (
                    <span
                      className="text-xs text-autronis-text-secondary/50 flex-shrink-0 cursor-help"
                      title={`Je kunt je eigen verlof niet goedkeuren — vraag ${andereNaam}`}
                    >
                      Wacht op {andereNaam}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal verlof aanvragen */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        titel="Verlof aanvragen"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={() => {
                if (!form.startDatum || !form.eindDatum) {
                  addToast("Vul start- en einddatum in", "fout");
                  return;
                }
                submitMutation.mutate(form);
              }}
              disabled={saving}
              className="px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? "Opslaan..." : "Aanvragen"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField
            label="Startdatum"
            type="date"
            verplicht
            value={form.startDatum}
            onChange={(e) => setForm({ ...form, startDatum: e.target.value })}
          />
          <FormField
            label="Einddatum"
            type="date"
            verplicht
            value={form.eindDatum}
            onChange={(e) => setForm({ ...form, eindDatum: e.target.value })}
          />
          <SelectField
            label="Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            opties={[
              { waarde: "vakantie", label: "Vakantie" },
              { waarde: "ziek", label: "Ziek" },
              { waarde: "bijzonder", label: "Bijzonder verlof" },
            ]}
          />
          <TextareaField
            isTextarea
            label="Notities"
            value={form.notities}
            onChange={(e) => setForm({ ...form, notities: e.target.value })}
            placeholder="Optionele toelichting..."
          />
          {/* Days remaining preview */}
          {form.type === "vakantie" && aangevraagdDagen > 0 && (
            <div
              className={cn(
                "rounded-xl px-4 py-3 text-sm border",
                naAanvraag > 20
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-autronis-bg/50 border-autronis-border text-autronis-text-secondary"
              )}
            >
              <span className="font-medium text-autronis-text-primary">
                {aangevraagdDagen} dag{aangevraagdDagen !== 1 ? "en" : ""}
              </span>{" "}
              aangevraagd · Na aanvraag:{" "}
              <span
                className={cn(
                  "font-semibold",
                  naAanvraag > 20 ? "text-red-400" : "text-autronis-text-primary"
                )}
              >
                {20 - naAanvraag >= 0 ? 20 - naAanvraag : 0} / 20 resterend
              </span>
              {naAanvraag > 20 && " · Budget overschreden!"}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ============ DECLARATIES TAB ============

function DeclaratiesTab({ currentUser }: { currentUser: CurrentUser | null | undefined }) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("alle");
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    datum: new Date().toISOString().slice(0, 10),
    omschrijving: "",
    bedrag: "",
    categorie: "overig",
    bonnetjeUrl: "",
  });

  const { data, isLoading: loading } = useDeclaraties(statusFilter);
  const { data: alleData } = useDeclaraties("alle");
  const declaraties = data?.declaraties ?? [];

  const ingediendTotaal = (alleData?.declaraties ?? [])
    .filter((d) => d.status === "ingediend")
    .reduce((s, d) => s + (d.bedrag ?? 0), 0);
  const goedgekeurdTotaal = (alleData?.declaraties ?? [])
    .filter((d) => d.status === "goedgekeurd")
    .reduce((s, d) => s + (d.bedrag ?? 0), 0);
  const totaalUitstaand = ingediendTotaal + goedgekeurdTotaal;

  const submitMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      const res = await fetch("/api/team/declaraties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, bedrag: Number(formData.bedrag) }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Kon declaratie niet indienen");
      }
    },
    onSuccess: () => {
      addToast("Declaratie ingediend", "succes");
      setModalOpen(false);
      setForm({
        datum: new Date().toISOString().slice(0, 10),
        omschrijving: "",
        bedrag: "",
        categorie: "overig",
        bonnetjeUrl: "",
      });
      queryClient.invalidateQueries({ queryKey: ["team", "declaraties"] });
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : "Fout bij indienen", "fout");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number;
      status: "goedgekeurd" | "afgewezen" | "uitbetaald";
    }) => {
      const res = await fetch(`/api/team/declaraties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Kon status niet bijwerken");
      }
      return status;
    },
    onSuccess: (status) => {
      addToast(`Declaratie ${status}`, "succes");
      queryClient.invalidateQueries({ queryKey: ["team", "declaraties"] });
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : "Fout bij bijwerken", "fout");
    },
  });

  const saving = submitMutation.isPending;
  const andereNaam = currentUser?.naam === "Sem" ? "Syb" : "Sem";

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Uitstaand widget — 3-way breakdown */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Uitstaand</p>
          <p className="text-2xl font-bold text-autronis-accent tabular-nums mb-3">
            {formatBedrag(totaalUitstaand)}
          </p>
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-yellow-400 font-medium">{formatBedrag(ingediendTotaal)}</span>
              <span className="text-autronis-text-secondary/60 ml-1">ingediend</span>
            </div>
            <div className="w-px h-3 bg-autronis-border" />
            <div>
              <span className="text-green-400 font-medium">{formatBedrag(goedgekeurdTotaal)}</span>
              <span className="text-autronis-text-secondary/60 ml-1">goedgekeurd</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autronis-accent text-white font-medium hover:bg-autronis-accent-hover transition-colors self-start"
        >
          <Plus className="w-4 h-4" />
          Nieuwe declaratie
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-autronis-text-secondary" />
        {[
          { key: "alle", label: "Alle" },
          { key: "ingediend", label: "Ingediend" },
          { key: "goedgekeurd", label: "Goedgekeurd" },
          { key: "uitbetaald", label: "Uitbetaald" },
          { key: "afgewezen", label: "Afgewezen" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              statusFilter === f.key
                ? "bg-autronis-accent text-autronis-bg"
                : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Declaraties table */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
        {declaraties.length === 0 ? (
          <EmptyState
            titel="Geen declaraties"
            beschrijving="Er zijn nog geen onkostendeclaraties ingediend."
            actieLabel="Nieuwe declaratie"
            onActie={() => setModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-autronis-border">
                  {[
                    { label: "Datum", right: false },
                    { label: "Medewerker", right: false },
                    { label: "Omschrijving", right: false },
                    { label: "Bedrag", right: true },
                    { label: "Categorie", right: false },
                    { label: "Status", right: false },
                    { label: "Bonnetje", right: false },
                    { label: "Acties", right: true },
                  ].map((h) => (
                    <th
                      key={h.label}
                      className={cn(
                        "text-xs font-medium text-autronis-text-secondary uppercase tracking-wide px-5 py-3",
                        h.right ? "text-right" : "text-left"
                      )}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {declaraties.map((d, idx) => {
                  const sc = declaratieStatusConfig[d.status ?? "ingediend"];
                  const cc = categorieConfig[d.categorie ?? "overig"] ?? categorieConfig.overig;
                  const isOwn = currentUser && d.gebruikerId === currentUser.id;
                  const canReview = !isOwn && d.status === "ingediend";
                  const canMarkPaid = d.status === "goedgekeurd";

                  return (
                    <motion.tr
                      key={d.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.2 }}
                      className="border-b border-autronis-border/50 last:border-b-0 hover:bg-autronis-bg/20 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-sm text-autronis-text-primary tabular-nums">
                        {formatDatumKort(d.datum)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-autronis-text-primary">
                        {d.gebruikerNaam}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-autronis-text-primary max-w-[200px] truncate">
                        {d.omschrijving}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-autronis-text-primary text-right tabular-nums font-medium">
                        {formatBedrag(d.bedrag)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cc.bg, cc.text)}>
                          {cc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            sc?.bg,
                            sc?.color
                          )}
                        >
                          {sc?.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {d.bonnetjeUrl && (
                          <a
                            href={d.bonnetjeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-autronis-accent hover:text-autronis-accent-hover transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canReview && (
                            <>
                              <button
                                onClick={() =>
                                  statusMutation.mutate({ id: d.id, status: "goedgekeurd" })
                                }
                                className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                title="Goedkeuren"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  statusMutation.mutate({ id: d.id, status: "afgewezen" })
                                }
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                title="Afwijzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {isOwn && d.status === "ingediend" && (
                            <span
                              className="text-[10px] text-autronis-text-secondary/40 cursor-help"
                              title={`Je kunt je eigen declaratie niet goedkeuren — vraag ${andereNaam}`}
                            >
                              Wacht op {andereNaam}
                            </span>
                          )}
                          {canMarkPaid && (
                            <button
                              onClick={() =>
                                statusMutation.mutate({ id: d.id, status: "uitbetaald" })
                              }
                              className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-xs font-medium"
                            >
                              Uitbetaald
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Declaratie modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        titel="Nieuwe declaratie"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={() => {
                if (!form.omschrijving.trim() || !form.bedrag) {
                  addToast("Vul alle verplichte velden in", "fout");
                  return;
                }
                submitMutation.mutate(form);
              }}
              disabled={saving}
              className="px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? "Opslaan..." : "Indienen"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField
            label="Datum"
            type="date"
            verplicht
            value={form.datum}
            onChange={(e) => setForm({ ...form, datum: e.target.value })}
          />
          <FormField
            label="Omschrijving"
            verplicht
            value={form.omschrijving}
            onChange={(e) => setForm({ ...form, omschrijving: e.target.value })}
            placeholder="Bijv. laptop standaard"
          />
          <FormField
            label="Bedrag"
            type="number"
            verplicht
            value={form.bedrag}
            onChange={(e) => setForm({ ...form, bedrag: e.target.value })}
            placeholder="0.00"
            min="0"
            step="0.01"
          />
          <SelectField
            label="Categorie"
            value={form.categorie}
            onChange={(e) => setForm({ ...form, categorie: e.target.value })}
            opties={[
              { waarde: "kantoor", label: "Kantoor" },
              { waarde: "hardware", label: "Hardware" },
              { waarde: "reiskosten", label: "Reiskosten" },
              { waarde: "marketing", label: "Marketing" },
              { waarde: "onderwijs", label: "Onderwijs" },
              { waarde: "telefoon", label: "Telefoon" },
              { waarde: "verzekeringen", label: "Verzekeringen" },
              { waarde: "overig", label: "Overig" },
            ]}
          />
          <FormField
            label="Bonnetje URL"
            value={form.bonnetjeUrl}
            onChange={(e) => setForm({ ...form, bonnetjeUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </Modal>
    </div>
  );
}

// ============ CAPACITEIT TAB ============

function CapaciteitTab() {
  const now = new Date();
  const currentWeekInfo = getISOWeek(now);
  const [week, setWeek] = useState(currentWeekInfo.week);
  const [jaar, setJaar] = useState(currentWeekInfo.jaar);

  const { data, isLoading: loading } = useCapaciteit(week, jaar);

  const navigateWeek = (direction: number) => {
    let newWeek = week + direction;
    let newJaar = jaar;
    if (newWeek < 1) {
      newJaar -= 1;
      newWeek = 52;
    } else if (newWeek > 52) {
      newJaar += 1;
      newWeek = 1;
    }
    setWeek(newWeek);
    setJaar(newJaar);
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Week navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigateWeek(-1)}
          className="p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <span className="text-lg font-semibold text-autronis-text-primary tabular-nums">
            Week {data.week}, {data.jaar}
          </span>
          <p className="text-sm text-autronis-text-secondary">
            {formatDatumKort(data.maandag)} - {formatDatumKort(data.zondag)}
          </p>
        </div>
        <button
          onClick={() => navigateWeek(1)}
          className="p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            setWeek(currentWeekInfo.week);
            setJaar(currentWeekInfo.jaar);
          }}
          className="ml-2 px-3 py-1.5 text-xs text-autronis-text-secondary border border-autronis-border rounded-lg hover:bg-autronis-border transition-colors"
        >
          Vandaag
        </button>
      </div>

      {/* Feestdagen banner — met naam + uren */}
      {data.feestdagen.length > 0 && (
        <div className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
          <Calendar className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-400">
              {data.feestdagen.map((f) => f.naam).join(", ")}
            </p>
            <p className="text-xs text-orange-400/70 mt-0.5">
              {data.feestdagen.length * 8}u minder beschikbaar per medewerker deze week
            </p>
          </div>
        </div>
      )}

      {/* Stacked bar legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-autronis-text-secondary">
        {[
          { color: "bg-orange-500/50", label: "Feestdag" },
          { color: "bg-blue-500/50", label: "Verlof" },
          { color: "bg-autronis-accent/70", label: "Gepland" },
          { color: "bg-autronis-bg border border-autronis-border/30", label: "Vrij" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-sm", color)} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Capacity cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.capaciteit.map((user) => {
          const isOverloaded = user.percentage > 100;
          const progressColor = isOverloaded
            ? "bg-red-400"
            : user.percentage > 80
            ? "bg-orange-400"
            : "bg-autronis-accent";

          // Stacked bar segments as % of 40u basis
          const feestPct = (user.feestdagUren / 40) * 100;
          const verlofPct = (user.verlofUren / 40) * 100;
          const beschikbaarPct = 100 - feestPct - verlofPct;
          const geplandPct = Math.min((user.geplandUren / 40) * 100, beschikbaarPct);

          return (
            <div
              key={user.gebruikerId}
              className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow"
            >
              {/* Header: naam + gepland/beschikbaar + overbelast badge */}
              <div className="flex items-start justify-between mb-5 gap-3">
                <h3 className="text-lg font-semibold text-autronis-text-primary">{user.naam}</h3>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm text-autronis-text-secondary tabular-nums">
                    <span
                      className={cn(
                        "font-bold",
                        isOverloaded ? "text-red-400" : "text-autronis-accent"
                      )}
                    >
                      {user.geplandUren}u
                    </span>
                    {" / "}
                    {user.beschikbaarUren}u
                  </span>
                  {isOverloaded && (
                    <div className="flex items-center gap-1 text-red-400 animate-pulse">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-medium">Overbelast</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stacked bar — 40u totaal */}
              <div className="mb-5">
                <div className="flex h-5 bg-autronis-bg rounded-full overflow-hidden">
                  {feestPct > 0 && (
                    <div
                      className="h-full bg-orange-500/50 transition-all duration-500"
                      style={{ width: `${feestPct}%` }}
                    />
                  )}
                  {verlofPct > 0 && (
                    <div
                      className="h-full bg-blue-500/50 transition-all duration-500"
                      style={{ width: `${verlofPct}%` }}
                    />
                  )}
                  <motion.div
                    key={`gepland-${user.gebruikerId}-${week}-${jaar}`}
                    className="h-full bg-autronis-accent/70"
                    initial={{ width: "0%" }}
                    animate={{ width: `${geplandPct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-autronis-text-secondary/50">
                  <span>0u</span>
                  <span>40u</span>
                </div>
              </div>

              {/* Breakdown tekst */}
              <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-autronis-text-secondary">Basis</span>
                  <span className="font-medium text-autronis-text-primary tabular-nums">
                    {user.basisUren}u
                  </span>
                </div>
                {user.feestdagUren > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-orange-400">Min feestdagen</span>
                    <span className="font-medium text-orange-400 tabular-nums">
                      −{user.feestdagUren}u
                    </span>
                  </div>
                )}
                {user.verlofUren > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-400">Min verlof</span>
                    <span className="font-medium text-blue-400 tabular-nums">
                      −{user.verlofUren}u
                    </span>
                  </div>
                )}
                <div className="border-t border-autronis-border pt-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-autronis-text-primary">Beschikbaar</span>
                  <span className="font-bold text-autronis-text-primary tabular-nums">
                    {user.beschikbaarUren}u
                  </span>
                </div>
              </div>

              {/* Bezettings progress bar met overflow indicator */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-autronis-text-secondary">Bezetting</span>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      isOverloaded
                        ? "text-red-400"
                        : user.percentage > 80
                        ? "text-orange-400"
                        : "text-autronis-accent"
                    )}
                  >
                    {user.percentage}%
                  </span>
                </div>
                <div className="relative h-3 bg-autronis-bg rounded-full overflow-visible">
                  <motion.div
                    key={`bar-${user.gebruikerId}-${week}-${jaar}`}
                    className={cn("absolute left-0 top-0 h-full rounded-full", progressColor)}
                    initial={{ width: "0%" }}
                    animate={{ width: `${Math.min(user.percentage, 100)}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                  />
                  {isOverloaded && (
                    <div className="absolute left-[100%] top-1/2 -translate-y-1/2 ml-2 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] text-red-400 font-medium whitespace-nowrap">
                        +{user.percentage - 100}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
