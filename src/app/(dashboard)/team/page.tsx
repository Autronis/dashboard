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
  Clock,
  AlertTriangle,
  ExternalLink,
  Palmtree,
  HeartPulse,
  Star,
  Filter,
} from "lucide-react";
import { cn, formatBedrag, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useCurrentUser,
  useVerlof,
  useDeclaraties,
  useCapaciteit,
  type VerlofEntry,
  type Feestdag,
  type Declaratie,
  type CapaciteitData,
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

const DAG_HEADERS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function getDaysInMonth(jaar: number, maand: number): number {
  return new Date(jaar, maand + 1, 0).getDate();
}

function getFirstDayOfMonth(jaar: number, maand: number): number {
  const day = new Date(jaar, maand, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
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

// ============ STATUS CONFIGS ============

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

const categorieLabels: Record<string, string> = {
  kantoor: "Kantoor",
  hardware: "Hardware",
  reiskosten: "Reiskosten",
  marketing: "Marketing",
  onderwijs: "Onderwijs",
  telefoon: "Telefoon",
  verzekeringen: "Verzekeringen",
  overig: "Overig",
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

  const tabs = [
    { key: "verlof" as const, label: "Verlof", icon: Calendar },
    { key: "declaraties" as const, label: "Declaraties", icon: Receipt },
    { key: "capaciteit" as const, label: "Capaciteit", icon: Users2 },
  ];

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">Team</h1>
          <p className="text-base text-autronis-text-secondary mt-1">
            Verlof, declaraties en capaciteitsoverzicht
          </p>
        </div>

        {/* Tab navigation */}
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
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "verlof" && <VerlofTab currentUser={currentUser} />}
        {activeTab === "declaraties" && <DeclaratiesTab currentUser={currentUser} />}
        {activeTab === "capaciteit" && <CapaciteitTab />}
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

  // Form state
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

  const handleSubmit = () => {
    if (!form.startDatum || !form.eindDatum) {
      addToast("Vul start- en einddatum in", "fout");
      return;
    }
    submitMutation.mutate(form);
  };

  const handleStatusUpdate = (id: number, status: "goedgekeurd" | "afgewezen") => {
    statusMutation.mutate({ id, status });
  };

  const saving = submitMutation.isPending;

  // Build lookup maps
  const feestdagMap = new Map<string, string>();
  feestdagenList.forEach((f) => feestdagMap.set(f.datum, f.naam));

  // Build verlof maps per user
  const verlofPerDag = new Map<string, VerlofEntry[]>();
  verlofList
    .filter((v) => v.status === "goedgekeurd" || v.status === "aangevraagd")
    .forEach((v) => {
      const start = new Date(v.startDatum);
      const end = new Date(v.eindDatum);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        const existing = verlofPerDag.get(key) || [];
        existing.push(v);
        verlofPerDag.set(key, existing);
      }
    });

  // Count vacation days per user
  const goedgekeurdVerlof = verlofList.filter(
    (v) => v.status === "goedgekeurd" && v.type === "vakantie"
  );

  function countVakantiedagen(gebruikerId: number): number {
    let count = 0;
    goedgekeurdVerlof
      .filter((v) => v.gebruikerId === gebruikerId)
      .forEach((v) => {
        const start = new Date(v.startDatum);
        const end = new Date(v.eindDatum);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const day = d.getDay();
          if (day !== 0 && day !== 6) count++;
        }
      });
    return count;
  }

  function getDayColor(datum: string, jaar: number, maand: number, dag: number): string {
    if (isWeekend(jaar, maand, dag)) return "bg-autronis-bg/50 text-autronis-text-secondary/30";
    if (feestdagMap.has(datum)) return "bg-orange-500/20 text-orange-400";

    const entries = verlofPerDag.get(datum) || [];
    if (entries.length === 0) return "bg-green-500/10 text-green-400/70 hover:bg-green-500/20";

    // Check types
    const hasZiek = entries.some((e) => e.type === "ziek");
    const hasSem = entries.some((e) => e.gebruikerId === 1);
    const hasSyb = entries.some((e) => e.gebruikerId === 2);

    if (hasZiek) return "bg-red-500/20 text-red-400";
    if (hasSem && hasSyb) return "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-autronis-text-primary";
    if (hasSem) return "bg-blue-500/20 text-blue-400";
    if (hasSyb) return "bg-purple-500/20 text-purple-400";
    return "bg-blue-500/20 text-blue-400";
  }

  const handleDayClick = (datum: string) => {
    setSelectedDay(selectedDay === datum ? null : datum);
  };

  // Sem = user 1, Syb = user 2
  const semDagen = countVakantiedagen(1);
  const sybDagen = countVakantiedagen(2);

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
      {/* Vakantiedagen teller + action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 card-glow">
            <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-1">Sem</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-400 tabular-nums">{semDagen}</span>
              <span className="text-sm text-autronis-text-secondary">/ 20 dagen</span>
            </div>
            <div className="mt-2 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all"
                style={{ width: `${Math.min((semDagen / 20) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 card-glow">
            <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-1">Syb</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-400 tabular-nums">{sybDagen}</span>
              <span className="text-sm text-autronis-text-secondary">/ 20 dagen</span>
            </div>
            <div className="mt-2 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-400 rounded-full transition-all"
                style={{ width: `${Math.min((sybDagen / 20) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autronis-accent text-white font-medium hover:bg-autronis-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Verlof aanvragen
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-autronis-text-secondary">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500/20" />
          <span>Werkdag</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-orange-500/20" />
          <span>Feestdag</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500/20" />
          <span>Vakantie Sem</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-purple-500/20" />
          <span>Vakantie Syb</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500/20" />
          <span>Ziek</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-autronis-bg/50" />
          <span>Weekend</span>
        </div>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setJaar((j) => j - 1)}
          className="p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-lg font-semibold text-autronis-text-primary tabular-nums">{jaar}</span>
        <button
          onClick={() => setJaar((j) => j + 1)}
          className="p-2 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, maand) => {
          const daysInMonth = getDaysInMonth(jaar, maand);
          const firstDay = getFirstDayOfMonth(jaar, maand);

          return (
            <div
              key={maand}
              className="bg-autronis-card border border-autronis-border rounded-2xl p-4 card-glow"
            >
              <h3 className="text-sm font-semibold text-autronis-text-primary mb-3">
                {MAANDEN[maand]}
              </h3>
              <div className="grid grid-cols-7 gap-0.5">
                {DAG_HEADERS.map((d) => (
                  <div
                    key={d}
                    className="text-[10px] text-autronis-text-secondary/50 text-center font-medium pb-1"
                  >
                    {d}
                  </div>
                ))}
                {/* Empty cells for offset */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="w-full aspect-square" />
                ))}
                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dag = i + 1;
                  const datum = dateString(jaar, maand, dag);
                  const color = getDayColor(datum, jaar, maand, dag);
                  const entries = verlofPerDag.get(datum) || [];
                  const feestdagNaam = feestdagMap.get(datum);
                  const isSelected = selectedDay === datum;

                  return (
                    <button
                      key={dag}
                      onClick={() => handleDayClick(datum)}
                      className={cn(
                        "w-full aspect-square rounded-sm text-[10px] font-medium flex items-center justify-center transition-all relative",
                        color,
                        isSelected && "ring-2 ring-autronis-accent ring-offset-1 ring-offset-autronis-card"
                      )}
                      title={
                        feestdagNaam
                          ? feestdagNaam
                          : entries.length > 0
                          ? entries.map((e) => `${e.gebruikerNaam}: ${verlofTypeConfig[e.type || "vakantie"]?.label}`).join(", ")
                          : undefined
                      }
                    >
                      {dag}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected day details */}
      {selectedDay && (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-autronis-text-primary mb-3">
            {formatDatumKort(selectedDay)}
          </h3>
          {feestdagMap.has(selectedDay) && (
            <p className="text-sm text-orange-400 mb-2">
              Feestdag: {feestdagMap.get(selectedDay)}
            </p>
          )}
          {(verlofPerDag.get(selectedDay) || []).map((v, i) => {
            const typeConf = verlofTypeConfig[v.type || "vakantie"];
            const TypeIcon = typeConf?.icon || Palmtree;
            return (
              <div key={i} className="flex items-center gap-3 mb-2">
                <TypeIcon className={cn("w-4 h-4", typeConf?.color)} />
                <span className="text-sm text-autronis-text-primary">{v.gebruikerNaam}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full", verlofStatusConfig[v.status || "aangevraagd"]?.bg, verlofStatusConfig[v.status || "aangevraagd"]?.color)}>
                  {verlofStatusConfig[v.status || "aangevraagd"]?.label}
                </span>
              </div>
            );
          })}
          {!feestdagMap.has(selectedDay) && (verlofPerDag.get(selectedDay) || []).length === 0 && (
            <p className="text-sm text-autronis-text-secondary">Geen bijzonderheden op deze dag.</p>
          )}
        </div>
      )}

      {/* Verlof aanvragen lijst */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
        <h3 className="text-lg font-semibold text-autronis-text-primary mb-4">
          Verlofaanvragen
        </h3>

        {verlofList.length === 0 ? (
          <EmptyState
            titel="Geen verlofaanvragen"
            beschrijving="Er zijn nog geen verlofaanvragen ingediend."
            actieLabel="Verlof aanvragen"
            onActie={() => setModalOpen(true)}
          />
        ) : (
          <div className="space-y-3">
            {verlofList.map((v) => {
              const sc = verlofStatusConfig[v.status || "aangevraagd"];
              const typeConf = verlofTypeConfig[v.type || "vakantie"];
              const TypeIcon = typeConf?.icon || Palmtree;
              const canReview = currentUser && v.gebruikerId !== currentUser.id && v.status === "aangevraagd";

              return (
                <div
                  key={v.id}
                  className="flex items-center gap-4 bg-autronis-bg/30 rounded-xl border border-autronis-border/50 px-5 py-4"
                >
                  <TypeIcon className={cn("w-5 h-5 flex-shrink-0", typeConf?.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-autronis-text-primary">
                        {v.gebruikerNaam}
                      </p>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sc?.bg, sc?.color)}>
                        {sc?.label}
                      </span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", "bg-autronis-border text-autronis-text-secondary")}>
                        {typeConf?.label}
                      </span>
                    </div>
                    <p className="text-sm text-autronis-text-secondary mt-0.5">
                      {formatDatumKort(v.startDatum)} - {formatDatumKort(v.eindDatum)}
                      {v.notities && <span className="ml-2 text-autronis-text-secondary/70">— {v.notities}</span>}
                    </p>
                  </div>
                  {canReview && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleStatusUpdate(v.id, "goedgekeurd")}
                        className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                        title="Goedkeuren"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(v.id, "afgewezen")}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Afwijzen"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Verlof aanvragen modal */}
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
              onClick={handleSubmit}
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
  const declaraties = data?.declaraties ?? [];
  const totaalUitstaand = data?.totaalUitstaand ?? 0;

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
      setForm({ datum: new Date().toISOString().slice(0, 10), omschrijving: "", bedrag: "", categorie: "overig", bonnetjeUrl: "" });
      queryClient.invalidateQueries({ queryKey: ["team", "declaraties"] });
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : "Fout bij indienen", "fout");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "goedgekeurd" | "afgewezen" | "uitbetaald" }) => {
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

  const handleSubmit = () => {
    if (!form.omschrijving.trim() || !form.bedrag) {
      addToast("Vul alle verplichte velden in", "fout");
      return;
    }
    submitMutation.mutate(form);
  };

  const handleStatusUpdate = (id: number, status: "goedgekeurd" | "afgewezen" | "uitbetaald") => {
    statusMutation.mutate({ id, status });
  };

  const saving = submitMutation.isPending;

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
      {/* Totaal uitstaand widget + action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-1">
            Totaal uitstaand
          </p>
          <p className="text-2xl font-bold text-autronis-accent tabular-nums">
            {formatBedrag(totaalUitstaand)}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autronis-accent text-white font-medium hover:bg-autronis-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nieuwe declaratie
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
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
                  <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wide px-5 py-3">Datum</th>
                  <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wide px-5 py-3">Medewerker</th>
                  <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wide px-5 py-3">Omschrijving</th>
                  <th className="text-right text-xs font-medium text-autronis-text-secondary uppercase tracking-wide px-5 py-3">Bedrag</th>
                  <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wide px-5 py-3">Categorie</th>
                  <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wide px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wide px-5 py-3">Bonnetje</th>
                  <th className="text-right text-xs font-medium text-autronis-text-secondary uppercase tracking-wide px-5 py-3">Acties</th>
                </tr>
              </thead>
              <tbody>
                {declaraties.map((d) => {
                  const sc = declaratieStatusConfig[d.status || "ingediend"];
                  const canReview = currentUser && d.gebruikerId !== currentUser.id && d.status === "ingediend";
                  const canMarkPaid = d.status === "goedgekeurd";

                  return (
                    <tr key={d.id} className="border-b border-autronis-border/50 last:border-b-0 hover:bg-autronis-bg/20 transition-colors">
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
                      <td className="px-5 py-3.5 text-sm text-autronis-text-secondary">
                        {categorieLabels[d.categorie || "overig"] || d.categorie}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sc?.bg, sc?.color)}>
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
                                onClick={() => handleStatusUpdate(d.id, "goedgekeurd")}
                                className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                title="Goedkeuren"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(d.id, "afgewezen")}
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                title="Afwijzen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {canMarkPaid && (
                            <button
                              onClick={() => handleStatusUpdate(d.id, "uitbetaald")}
                              className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-xs font-medium"
                            >
                              Uitbetaald
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
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
              onClick={handleSubmit}
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

      {/* Feestdagen in deze week */}
      {data.feestdagen.length > 0 && (
        <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
          <Calendar className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <p className="text-sm text-orange-400">
            Feestdagen deze week:{" "}
            {data.feestdagen.map((f) => f.naam).join(", ")}
          </p>
        </div>
      )}

      {/* Capacity cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.capaciteit.map((user) => {
          const isOverloaded = user.percentage > 100;
          const progressColor = isOverloaded
            ? "bg-red-400"
            : user.percentage > 80
            ? "bg-orange-400"
            : "bg-autronis-accent";

          return (
            <div
              key={user.gebruikerId}
              className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-autronis-text-primary">
                  {user.naam}
                </h3>
                {isOverloaded && (
                  <div className="flex items-center gap-1.5 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium">Overbelast</span>
                  </div>
                )}
              </div>

              {/* Breakdown */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-autronis-text-secondary">Basis</span>
                  <span className="text-sm font-medium text-autronis-text-primary tabular-nums">
                    {user.basisUren}u
                  </span>
                </div>
                {user.feestdagUren > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-orange-400">Min feestdagen</span>
                    <span className="text-sm font-medium text-orange-400 tabular-nums">
                      -{user.feestdagUren}u
                    </span>
                  </div>
                )}
                {user.verlofUren > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-400">Min verlof</span>
                    <span className="text-sm font-medium text-blue-400 tabular-nums">
                      -{user.verlofUren}u
                    </span>
                  </div>
                )}
                <div className="border-t border-autronis-border pt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-autronis-text-primary">Beschikbaar</span>
                  <span className="text-sm font-bold text-autronis-text-primary tabular-nums">
                    {user.beschikbaarUren}u
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-autronis-text-secondary">Gepland</span>
                  <span className={cn(
                    "text-sm font-medium tabular-nums",
                    isOverloaded ? "text-red-400" : "text-autronis-accent"
                  )}>
                    {user.geplandUren}u
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-autronis-text-secondary">Bezetting</span>
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    isOverloaded ? "text-red-400" : user.percentage > 80 ? "text-orange-400" : "text-autronis-accent"
                  )}>
                    {user.percentage}%
                  </span>
                </div>
                <div className="h-3 bg-autronis-bg rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", progressColor)}
                    style={{ width: `${Math.min(user.percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
