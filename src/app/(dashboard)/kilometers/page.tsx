"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Car,
  Plus,
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  Pencil,
  Trash2,
  BookmarkPlus,
  Bookmark,
  ArrowLeftRight,
  Info,
  BarChart3,
  TrendingUp,
  TrendingDown,
  X,
  ChevronDown,
} from "lucide-react";
import { cn, formatBedrag, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useRitten,
  useKlantenProjecten,
  useOpgeslagenRoutes,
  useSaveRoute,
  useDeleteRoute,
  useUseRoute,
  useJaaroverzicht,
  type Rit,
  type OpgeslagenRoute,
} from "@/hooks/queries/use-kilometers";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { FormField, SelectField } from "@/components/ui/form-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface RitForm {
  datum: string;
  vanLocatie: string;
  naarLocatie: string;
  kilometers: string;
  isRetour: boolean;
  zakelijkDoel: string;
  doelType: string;
  klantId: string;
  projectId: string;
  tariefPerKm: string;
}

const EMPTY_FORM: RitForm = {
  datum: new Date().toISOString().slice(0, 10),
  vanLocatie: "",
  naarLocatie: "",
  kilometers: "",
  isRetour: false,
  zakelijkDoel: "",
  doelType: "",
  klantId: "",
  projectId: "",
  tariefPerKm: "0.23",
};

const MAAND_NAMEN = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

const DOEL_TYPES = [
  { waarde: "", label: "Selecteer doel..." },
  { waarde: "klantbezoek", label: "Klantbezoek" },
  { waarde: "meeting", label: "Meeting" },
  { waarde: "inkoop", label: "Inkoop / Leverancier" },
  { waarde: "netwerk", label: "Netwerk event" },
  { waarde: "training", label: "Cursus / Training" },
  { waarde: "boekhouder", label: "Boekhouder / KVK / Bank" },
  { waarde: "overig", label: "Overig zakelijk" },
];

const DOEL_LABELS: Record<string, string> = {
  klantbezoek: "Klantbezoek",
  meeting: "Meeting",
  inkoop: "Inkoop",
  netwerk: "Netwerk",
  training: "Training",
  boekhouder: "Boekhouder",
  overig: "Overig",
};

export default function KilometersPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editRit, setEditRit] = useState<Rit | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<RitForm>(EMPTY_FORM);
  const [showRegels, setShowRegels] = useState(false);
  const [showJaar, setShowJaar] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  const [saveRouteNaam, setSaveRouteNaam] = useState("");
  const [showSaveRouteInput, setShowSaveRouteInput] = useState(false);

  const [maand, setMaand] = useState(new Date().getMonth() + 1);
  const [jaar, setJaar] = useState(new Date().getFullYear());

  const { data: rittenData, isLoading: loading } = useRitten(maand, jaar);
  const ritten = rittenData?.ritten ?? [];
  const totaalKm = rittenData?.totaalKm ?? 0;
  const totaalBedrag = rittenData?.totaalBedrag ?? 0;
  const aantalRitten = rittenData?.aantalRitten ?? 0;

  const { data: kpData } = useKlantenProjecten();
  const klanten = kpData?.klanten ?? [];
  const projecten = kpData?.projecten ?? [];

  const { data: opgeslagenRoutes = [] } = useOpgeslagenRoutes();
  const saveRouteMutation = useSaveRoute();
  const deleteRouteMutation = useDeleteRoute();
  const useRouteMutation = useUseRoute();
  const { data: jaarData } = useJaaroverzicht(jaar);

  // Vorige maand vergelijking
  const prevMaand = maand === 1 ? 12 : maand - 1;
  const prevJaar = maand === 1 ? jaar - 1 : jaar;
  const { data: prevData } = useRitten(prevMaand, prevJaar);
  const prevKm = prevData?.totaalKm ?? 0;
  const kmVerschil = prevKm > 0 ? ((totaalKm - prevKm) / prevKm * 100) : 0;

  const handlePrevMonth = () => {
    if (maand === 1) { setMaand(12); setJaar(jaar - 1); }
    else setMaand(maand - 1);
  };

  const handleNextMonth = () => {
    if (maand === 12) { setMaand(1); setJaar(jaar + 1); }
    else setMaand(maand + 1);
  };

  const openNieuwModal = () => {
    setEditRit(null);
    setForm(EMPTY_FORM);
    setShowSaveRouteInput(false);
    setModalOpen(true);
  };

  const openEditModal = (rit: Rit) => {
    setEditRit(rit);
    setForm({
      datum: rit.datum,
      vanLocatie: rit.vanLocatie,
      naarLocatie: rit.naarLocatie,
      kilometers: rit.isRetour ? (rit.kilometers / 2).toString() : rit.kilometers.toString(),
      isRetour: rit.isRetour === 1,
      zakelijkDoel: rit.zakelijkDoel || "",
      doelType: rit.doelType || "",
      klantId: rit.klantId?.toString() || "",
      projectId: rit.projectId?.toString() || "",
      tariefPerKm: (rit.tariefPerKm ?? 0.23).toString(),
    });
    setModalOpen(true);
  };

  const applyRoute = useCallback((route: OpgeslagenRoute) => {
    setForm((prev) => ({
      ...prev,
      vanLocatie: route.vanLocatie,
      naarLocatie: route.naarLocatie,
      kilometers: route.kilometers.toString(),
      klantId: route.klantId?.toString() || "",
      projectId: route.projectId?.toString() || "",
      doelType: route.doelType || "",
    }));
    useRouteMutation.mutate(route.id);
    setShowRoutes(false);
    addToast(`Route "${route.naam}" toegepast`, "succes");
  }, [useRouteMutation, addToast]);

  const saveMutation = useMutation({
    mutationFn: async ({ payload, isEdit, editId }: { payload: Record<string, unknown>; isEdit: boolean; editId?: number }) => {
      const url = isEdit ? `/api/kilometers/${editId}` : "/api/kilometers";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.fout || "Onbekende fout");
      }
      return isEdit;
    },
    onSuccess: (isEdit) => {
      addToast(isEdit ? "Rit bijgewerkt" : "Rit toegevoegd", "succes");
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["kilometers"] });
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : "Kon rit niet opslaan", "fout");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/kilometers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      addToast("Rit verwijderd", "succes");
      setDeleteDialogOpen(false);
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["kilometers"] });
    },
    onError: () => addToast("Kon rit niet verwijderen", "fout"),
  });

  const handleSubmit = () => {
    if (!form.datum || !form.vanLocatie.trim() || !form.naarLocatie.trim() || !form.kilometers) {
      addToast("Vul alle verplichte velden in", "fout");
      return;
    }
    const payload = {
      datum: form.datum,
      vanLocatie: form.vanLocatie,
      naarLocatie: form.naarLocatie,
      kilometers: parseFloat(form.kilometers),
      isRetour: form.isRetour,
      zakelijkDoel: form.zakelijkDoel || null,
      doelType: form.doelType || null,
      klantId: form.klantId ? parseInt(form.klantId) : null,
      projectId: form.projectId ? parseInt(form.projectId) : null,
      tariefPerKm: parseFloat(form.tariefPerKm) || 0.23,
    };
    saveMutation.mutate({ payload, isEdit: !!editRit, editId: editRit?.id });
  };

  const handleSaveRoute = () => {
    if (!saveRouteNaam.trim() || !form.vanLocatie.trim() || !form.naarLocatie.trim() || !form.kilometers) {
      addToast("Vul eerst de route in en geef een naam", "fout");
      return;
    }
    saveRouteMutation.mutate(
      {
        naam: saveRouteNaam,
        vanLocatie: form.vanLocatie,
        naarLocatie: form.naarLocatie,
        kilometers: parseFloat(form.kilometers),
        klantId: form.klantId ? parseInt(form.klantId) : null,
        projectId: form.projectId ? parseInt(form.projectId) : null,
        doelType: form.doelType || null,
      },
      {
        onSuccess: () => {
          addToast("Route opgeslagen", "succes");
          setSaveRouteNaam("");
          setShowSaveRouteInput(false);
        },
        onError: () => addToast("Kon route niet opslaan", "fout"),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId);
  };

  const saving = saveMutation.isPending;

  const handleExport = () => {
    window.open(`/api/kilometers/export?maand=${maand}&jaar=${jaar}`, "_blank");
  };

  const filteredProjecten = form.klantId
    ? projecten.filter((p) => p.klantId === parseInt(form.klantId))
    : projecten;

  // Subtotaal per klant voor deze maand
  const klantSubtotalen = useMemo(() => {
    const map: Record<string, { km: number; bedrag: number; ritten: number }> = {};
    for (const rit of ritten) {
      const key = rit.klantNaam || "Geen klant";
      if (!map[key]) map[key] = { km: 0, bedrag: 0, ritten: 0 };
      map[key].km += rit.kilometers;
      map[key].bedrag += rit.kilometers * (rit.tariefPerKm ?? 0.23);
      map[key].ritten++;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b.km - a.km)
      .map(([naam, data]) => ({ naam, ...data }));
  }, [ritten]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-autronis-border rounded-2xl p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">Kilometerregistratie</h1>
            <p className="text-base text-autronis-text-secondary mt-1">
              Zakelijke ritten bijhouden voor belastingaangifte
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRegels(!showRegels)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2.5 border rounded-xl text-sm font-medium transition-colors",
                showRegels ? "border-autronis-accent text-autronis-accent bg-autronis-accent/10" : "border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-card"
              )}
            >
              <Info className="w-4 h-4" />
              Regels
            </button>
            <button
              onClick={() => setShowJaar(!showJaar)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2.5 border rounded-xl text-sm font-medium transition-colors",
                showJaar ? "border-blue-500 text-blue-400 bg-blue-500/10" : "border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-card"
              )}
            >
              <BarChart3 className="w-4 h-4" />
              Jaaroverzicht
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-3 py-2.5 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary rounded-xl text-sm font-medium transition-colors hover:bg-autronis-card"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={openNieuwModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
            >
              <Plus className="w-4 h-4" />
              Nieuwe rit
            </button>
          </div>
        </div>

        {/* Regels panel */}
        {showRegels && (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2">
                <Info className="w-5 h-5 text-autronis-accent" />
                Belastingregels kilometerregistratie
              </h2>
              <button onClick={() => setShowRegels(false)} className="p-1 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-3">Zakelijk (aftrekbaar)</h3>
                <div className="space-y-2 text-sm text-autronis-text-secondary">
                  {["Ritten naar klanten", "Zakelijke meetings/events", "Leveranciers/inkoop", "Boekhouder/KVK/bank", "Zakelijke cursussen/trainingen", "Tussen twee werklocaties"].map((r) => (
                    <div key={r} className="flex items-center gap-2">
                      <span className="text-emerald-400">&#10003;</span> {r}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-3">Niet zakelijk</h3>
                <div className="space-y-2 text-sm text-autronis-text-secondary">
                  {["Woon-werkverkeer (huis \u2192 vaste werkplek)", "Priv\u00e9ritten", "Lunchritten"].map((r) => (
                    <div key={r} className="flex items-center gap-2">
                      <span className="text-red-400">&#10007;</span> {r}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3">Vergoeding 2026</h3>
                <div className="space-y-2 text-sm text-autronis-text-secondary">
                  <p><strong className="text-autronis-text-primary">&euro;0,23</strong> per km (belastingvrij)</p>
                  <p>Of werkelijke kosten auto</p>
                  <p className="text-xs text-autronis-text-secondary/70">Je mag maar 1 methode kiezen per jaar</p>
                </div>
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <p className="text-xs text-yellow-400 font-medium">
                    TIP: Registreer ELKE zakelijke rit. De Belastingdienst kan tot 5 jaar terug controleren.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Jaaroverzicht panel */}
        {showJaar && jaarData && (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Jaaroverzicht {jaar}
              </h2>
              <button onClick={() => setShowJaar(false)} className="p-1 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Year totals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-autronis-bg/50 rounded-xl p-4">
                <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">{jaarData.totaalKm.toFixed(1)}</p>
                <p className="text-xs text-autronis-text-secondary mt-1">Totaal km</p>
              </div>
              <div className="bg-autronis-bg/50 rounded-xl p-4">
                <p className="text-2xl font-bold text-emerald-400 tabular-nums">{formatBedrag(jaarData.totaalAftrekbaar)}</p>
                <p className="text-xs text-autronis-text-secondary mt-1">Aftrekbaar</p>
              </div>
              <div className="bg-autronis-bg/50 rounded-xl p-4">
                <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">{jaarData.aantalRitten}</p>
                <p className="text-xs text-autronis-text-secondary mt-1">Ritten</p>
              </div>
              <div className="bg-autronis-bg/50 rounded-xl p-4">
                <p className={cn("text-2xl font-bold tabular-nums", jaarData.verschilVorigJaar >= 0 ? "text-autronis-text-primary" : "text-red-400")}>
                  {jaarData.verschilVorigJaar >= 0 ? "+" : ""}{jaarData.verschilVorigJaar.toFixed(0)} km
                </p>
                <p className="text-xs text-autronis-text-secondary mt-1">vs. {jaar - 1}</p>
              </div>
            </div>

            {/* Monthly bar chart */}
            <div>
              <h3 className="text-sm font-medium text-autronis-text-secondary mb-3">Per maand</h3>
              <div className="flex items-end gap-1.5 h-32">
                {Array.from({ length: 12 }, (_, i) => {
                  const data = jaarData.perMaand.find((m) => m.maand === i + 1);
                  const km = data?.km ?? 0;
                  const maxKm = Math.max(...jaarData.perMaand.map((m) => m.km), 1);
                  const pct = (km / maxKm) * 100;
                  const isHuidig = i + 1 === maand;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full relative" style={{ height: "100px" }}>
                        <div
                          className={cn(
                            "absolute bottom-0 w-full rounded-t-md transition-all",
                            isHuidig ? "bg-autronis-accent" : "bg-autronis-accent/30"
                          )}
                          style={{ height: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className={cn("text-[10px] tabular-nums", isHuidig ? "text-autronis-accent font-semibold" : "text-autronis-text-secondary/50")}>
                        {MAAND_NAMEN[i].slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Per klant */}
            {jaarData.perKlant.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-autronis-text-secondary mb-3">Per klant</h3>
                <div className="space-y-2">
                  {jaarData.perKlant.slice(0, 5).map((k) => (
                    <div key={k.klantNaam} className="flex items-center gap-3 bg-autronis-bg/30 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-autronis-text-primary flex-1">{k.klantNaam}</span>
                      <span className="text-sm text-autronis-text-secondary tabular-nums">{k.ritten} ritten</span>
                      <span className="text-sm text-autronis-text-primary font-medium tabular-nums w-20 text-right">{k.km.toFixed(1)} km</span>
                      <span className="text-sm text-emerald-400 font-medium tabular-nums w-20 text-right">{formatBedrag(k.bedrag)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Month selector */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-semibold text-autronis-text-primary min-w-[200px] text-center">
            {MAAND_NAMEN[maand - 1]} {jaar}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow bg-autronis-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-autronis-accent/10 rounded-xl">
                <Car className="w-4 h-4 text-autronis-accent" />
              </div>
            </div>
            <AnimatedNumber value={totaalKm} className="text-2xl font-bold text-autronis-text-primary tabular-nums" />
            <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Totaal km</p>
          </div>

          <div className="border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow bg-autronis-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-500/10 rounded-xl">
                <MapPin className="w-4 h-4 text-green-400" />
              </div>
            </div>
            <AnimatedNumber value={totaalBedrag} format={formatBedrag} className="text-2xl font-bold text-green-400 tabular-nums" />
            <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Aftrekbaar</p>
          </div>

          <div className="border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow bg-autronis-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                <Car className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <AnimatedNumber value={aantalRitten} className="text-2xl font-bold text-autronis-text-primary tabular-nums" />
            <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Ritten</p>
          </div>

          <div className="border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow bg-autronis-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-500/10 rounded-xl">
                {kmVerschil >= 0 ? <TrendingUp className="w-4 h-4 text-purple-400" /> : <TrendingDown className="w-4 h-4 text-purple-400" />}
              </div>
            </div>
            <p className={cn("text-2xl font-bold tabular-nums", kmVerschil >= 0 ? "text-autronis-text-primary" : "text-red-400")}>
              {kmVerschil >= 0 ? "+" : ""}{kmVerschil.toFixed(0)}%
            </p>
            <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">vs. vorige maand</p>
          </div>
        </div>

        {/* Klant subtotalen */}
        {klantSubtotalen.length > 1 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {klantSubtotalen.slice(0, 4).map((k) => (
              <div key={k.naam} className="bg-autronis-card/50 border border-autronis-border/50 rounded-xl px-4 py-3">
                <p className="text-sm font-medium text-autronis-text-primary truncate">{k.naam}</p>
                <p className="text-xs text-autronis-text-secondary mt-1">
                  {k.km.toFixed(1)} km &middot; {formatBedrag(k.bedrag)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
          {ritten.length === 0 ? (
            <EmptyState
              titel="Nog geen ritten"
              beschrijving="Voeg je eerste zakelijke rit toe om te beginnen met registreren."
              actieLabel="Nieuwe rit"
              onActie={openNieuwModal}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-autronis-border">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Datum</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Route</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Km</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Doel</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Klant</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Bedrag</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {ritten.map((rit) => (
                    <tr
                      key={rit.id}
                      className="border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-sm text-autronis-text-secondary">
                        {formatDatumKort(rit.datum)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm text-autronis-text-primary">{rit.vanLocatie}</span>
                        <span className="text-autronis-text-secondary mx-1.5">&rarr;</span>
                        <span className="text-sm text-autronis-text-primary">{rit.naarLocatie}</span>
                        {rit.isRetour === 1 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            <ArrowLeftRight className="w-3 h-3" />
                            retour
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-semibold text-autronis-text-primary text-right tabular-nums">
                        {rit.kilometers.toFixed(1)}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-autronis-text-secondary">
                        {rit.doelType ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-autronis-accent/10 text-autronis-accent">
                            {DOEL_LABELS[rit.doelType] || rit.doelType}
                          </span>
                        ) : rit.zakelijkDoel ? (
                          <span className="truncate max-w-[150px] block">{rit.zakelijkDoel}</span>
                        ) : "\u2014"}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-autronis-text-secondary">
                        {rit.klantNaam || "\u2014"}
                        {rit.projectNaam && (
                          <span className="block text-xs text-autronis-text-secondary/70">{rit.projectNaam}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-semibold text-green-400 text-right tabular-nums">
                        {formatBedrag(rit.kilometers * (rit.tariefPerKm ?? 0.23))}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(rit)}
                            className="p-1.5 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setDeleteId(rit.id); setDeleteDialogOpen(true); }}
                            className="p-1.5 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Totaal rij */}
                  <tr className="border-t-2 border-autronis-border">
                    <td colSpan={2} className="py-3.5 px-4 text-sm font-semibold text-autronis-text-primary">Totaal</td>
                    <td className="py-3.5 px-4 text-sm font-bold text-autronis-text-primary text-right tabular-nums">{totaalKm.toFixed(1)}</td>
                    <td colSpan={2} />
                    <td className="py-3.5 px-4 text-sm font-bold text-green-400 text-right tabular-nums">{formatBedrag(totaalBedrag)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          titel={editRit ? "Rit bewerken" : "Nieuwe rit"}
          breedte="lg"
          footer={
            <>
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 text-sm font-medium text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? "Opslaan..." : editRit ? "Bijwerken" : "Toevoegen"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Opgeslagen routes */}
            {!editRit && opgeslagenRoutes.length > 0 && (
              <div>
                <button
                  onClick={() => setShowRoutes(!showRoutes)}
                  className="flex items-center gap-2 text-sm font-medium text-autronis-accent hover:text-autronis-accent-hover transition-colors mb-2"
                >
                  <Bookmark className="w-4 h-4" />
                  Opgeslagen routes ({opgeslagenRoutes.length})
                  <ChevronDown className={cn("w-4 h-4 transition-transform", showRoutes && "rotate-180")} />
                </button>
                {showRoutes && (
                  <div className="space-y-1.5 mb-3">
                    {opgeslagenRoutes.map((route) => (
                      <div
                        key={route.id}
                        className="flex items-center gap-3 bg-autronis-bg rounded-xl px-3 py-2.5 border border-autronis-border/50"
                      >
                        <button
                          onClick={() => applyRoute(route)}
                          className="flex-1 text-left text-sm hover:text-autronis-accent transition-colors"
                        >
                          <span className="font-medium text-autronis-text-primary">{route.naam}</span>
                          <span className="text-autronis-text-secondary ml-2">
                            {route.vanLocatie} &rarr; {route.naarLocatie} ({route.kilometers} km)
                          </span>
                        </button>
                        <button
                          onClick={() => deleteRouteMutation.mutate(route.id)}
                          className="p-1 text-autronis-text-secondary hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Datum"
                type="date"
                verplicht
                value={form.datum}
                onChange={(e) => setForm({ ...form, datum: e.target.value })}
              />
              <div>
                <FormField
                  label="Kilometers (enkele reis)"
                  type="number"
                  verplicht
                  placeholder="0.0"
                  value={form.kilometers}
                  onChange={(e) => setForm({ ...form, kilometers: e.target.value })}
                />
              </div>
            </div>

            {/* Retour toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={cn(
                  "w-10 h-6 rounded-full transition-colors relative",
                  form.isRetour ? "bg-autronis-accent" : "bg-autronis-border"
                )}
                onClick={() => setForm({ ...form, isRetour: !form.isRetour })}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded-full bg-white absolute top-1 transition-transform",
                    form.isRetour ? "translate-x-5" : "translate-x-1"
                  )}
                />
              </div>
              <span className="text-sm text-autronis-text-primary">
                Retour (heen + terug)
              </span>
              {form.isRetour && form.kilometers && (
                <span className="text-xs text-autronis-accent tabular-nums">
                  = {(parseFloat(form.kilometers) * 2).toFixed(1)} km totaal
                </span>
              )}
            </label>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Van"
                verplicht
                placeholder="Bijv. Kantoor"
                value={form.vanLocatie}
                onChange={(e) => setForm({ ...form, vanLocatie: e.target.value })}
              />
              <FormField
                label="Naar"
                verplicht
                placeholder="Bijv. Klantlocatie"
                value={form.naarLocatie}
                onChange={(e) => setForm({ ...form, naarLocatie: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Doel van de rit"
                value={form.doelType}
                onChange={(e) => setForm({ ...form, doelType: e.target.value })}
                opties={DOEL_TYPES}
              />
              <FormField
                label="Toelichting (optioneel)"
                placeholder="Extra info..."
                value={form.zakelijkDoel}
                onChange={(e) => setForm({ ...form, zakelijkDoel: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Klant"
                value={form.klantId}
                onChange={(e) => setForm({ ...form, klantId: e.target.value, projectId: "" })}
                opties={[
                  { waarde: "", label: "Geen klant" },
                  ...klanten.map((k) => ({ waarde: k.id.toString(), label: k.bedrijfsnaam })),
                ]}
              />
              <SelectField
                label="Project"
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                opties={[
                  { waarde: "", label: "Geen project" },
                  ...filteredProjecten.map((p) => ({ waarde: p.id.toString(), label: p.naam })),
                ]}
              />
            </div>

            <FormField
              label="Tarief per km"
              type="number"
              placeholder="0.23"
              value={form.tariefPerKm}
              onChange={(e) => setForm({ ...form, tariefPerKm: e.target.value })}
            />

            {/* Save as route */}
            {!editRit && form.vanLocatie && form.naarLocatie && form.kilometers && (
              <div className="border-t border-autronis-border pt-3">
                {showSaveRouteInput ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={saveRouteNaam}
                      onChange={(e) => setSaveRouteNaam(e.target.value)}
                      placeholder="Naam voor deze route..."
                      className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                    />
                    <button
                      onClick={handleSaveRoute}
                      disabled={saveRouteMutation.isPending}
                      className="px-3 py-2 bg-autronis-accent/20 text-autronis-accent rounded-lg text-sm font-medium hover:bg-autronis-accent/30 transition-colors disabled:opacity-50"
                    >
                      Opslaan
                    </button>
                    <button
                      onClick={() => setShowSaveRouteInput(false)}
                      className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSaveRouteInput(true)}
                    className="flex items-center gap-2 text-sm text-autronis-text-secondary hover:text-autronis-accent transition-colors"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                    Route opslaan voor later
                  </button>
                )}
              </div>
            )}
          </div>
        </Modal>

        {/* Delete confirmation */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => { setDeleteDialogOpen(false); setDeleteId(null); }}
          onBevestig={handleDelete}
          titel="Rit verwijderen?"
          bericht="Weet je zeker dat je deze rit wilt verwijderen?"
          bevestigTekst="Verwijderen"
          variant="danger"
        />
      </div>
    </PageTransition>
  );
}
