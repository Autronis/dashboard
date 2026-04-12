"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Car, Plus, ChevronLeft, ChevronRight, Download, MapPin, Pencil, Trash2,
  BookmarkPlus, Bookmark, BarChart3, TrendingUp, TrendingDown, X, ChevronDown,
  ChevronUp, Copy, Search, Star, ArrowUpDown, Info, Repeat,
} from "lucide-react";
import { cn, formatBedrag, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useRitten, useKlantenProjecten, useOpgeslagenRoutes,
  useSaveRoute, useDeleteRoute, useUseRoute, useJaaroverzicht,
  useGenereerTerugkerendeRitten,
  type Rit, type OpgeslagenRoute,
} from "@/hooks/queries/use-kilometers";
import { KmStandPanel } from "./components/KmStandPanel";
import { DonutChart } from "./components/DonutChart";
import { TerugkerendeRittenModal } from "./components/TerugkerendeRittenModal";
import { BelastingrapportKnop } from "./components/BelastingrapportKnop";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Modal } from "@/components/ui/modal";
import { FormField, SelectField } from "@/components/ui/form-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

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

// Subtle per-doeltype row background
const DOEL_RIJ: Record<string, string> = {
  klantbezoek: "bg-teal-500/[0.04] hover:bg-teal-500/[0.08]",
  meeting: "bg-blue-500/[0.04] hover:bg-blue-500/[0.08]",
  inkoop: "bg-amber-500/[0.04] hover:bg-amber-500/[0.08]",
  netwerk: "bg-purple-500/[0.04] hover:bg-purple-500/[0.08]",
  training: "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]",
  boekhouder: "bg-orange-500/[0.04] hover:bg-orange-500/[0.08]",
};

// Per-doeltype chip colors
const DOEL_CHIP: Record<string, { bg: string; text: string }> = {
  klantbezoek: { bg: "bg-teal-500/15", text: "text-teal-400" },
  meeting: { bg: "bg-blue-500/15", text: "text-blue-400" },
  inkoop: { bg: "bg-amber-500/15", text: "text-amber-400" },
  netwerk: { bg: "bg-purple-500/15", text: "text-purple-400" },
  training: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  boekhouder: { bg: "bg-orange-500/15", text: "text-orange-400" },
  overig: { bg: "bg-slate-500/15", text: "text-slate-400" },
};

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "30%" : "-30%", opacity: 0 }),
  center: {
    x: 0, opacity: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 30, restDelta: 0.001 },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? "-30%" : "30%", opacity: 0,
    transition: { duration: 0.18, ease: "easeIn" as const },
  }),
};

// ─── SortHeader ───────────────────────────────────────────────────────────────

function SortHeader({
  label, kolom, sortKolom, sortRichting, onSort,
  className,
}: {
  label: string;
  kolom: string;
  sortKolom: string | null;
  sortRichting: "asc" | "desc";
  onSort: (k: string) => void;
  className?: string;
}) {
  const actief = sortKolom === kolom;
  return (
    <th
      onClick={() => onSort(kolom)}
      className={cn(
        "py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide cursor-pointer select-none transition-colors hover:text-autronis-text-primary",
        className
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {actief
          ? sortRichting === "asc"
            ? <ChevronUp className="w-3 h-3 text-autronis-accent" />
            : <ChevronDown className="w-3 h-3 text-autronis-accent" />
          : <ArrowUpDown className="w-3 h-3 opacity-30" />
        }
      </span>
    </th>
  );
}

// ─── SnelRitForm ──────────────────────────────────────────────────────────────

function SnelRitForm({
  klanten,
  projecten,
  onSaved,
}: {
  klanten: Array<{ id: number; bedrijfsnaam: string }>;
  projecten: Array<{ id: number; naam: string; klantId: number | null }>;
  onSaved: () => void;
}) {
  const vandaag = new Date().toISOString().slice(0, 10);
  const [van, setVan] = useState("");
  const [naar, setNaar] = useState("");
  const [km, setKm] = useState("");
  const [klantId, setKlantId] = useState("");
  const [datum, setDatum] = useState(vandaag);
  const [bezig, setBezig] = useState(false);
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!van.trim() || !naar.trim() || !km) return;
    setBezig(true);
    try {
      const res = await fetch("/api/kilometers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datum,
          vanLocatie: van.trim(),
          naarLocatie: naar.trim(),
          kilometers: parseFloat(km),
          isRetour: false,
          tariefPerKm: 0.23,
          klantId: klantId ? parseInt(klantId) : null,
        }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["kilometers"] });
      addToast("Rit toegevoegd", "succes");
      setVan(""); setNaar(""); setKm(""); setKlantId("");
      setDatum(vandaag);
      onSaved();
    } catch {
      addToast("Kon rit niet opslaan", "fout");
    } finally {
      setBezig(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 p-4 bg-autronis-bg/40 border-b border-autronis-border/50"
    >
      <input
        type="date"
        value={datum}
        onChange={(e) => setDatum(e.target.value)}
        className="w-36 px-3 py-2 rounded-lg bg-autronis-bg border border-autronis-border text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
      />
      <input
        placeholder="Van"
        value={van}
        onChange={(e) => setVan(e.target.value)}
        className="flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-autronis-bg border border-autronis-border text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
      />
      <input
        placeholder="Naar"
        value={naar}
        onChange={(e) => setNaar(e.target.value)}
        className="flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-autronis-bg border border-autronis-border text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
      />
      <input
        type="number"
        placeholder="Km"
        value={km}
        onChange={(e) => setKm(e.target.value)}
        min="0.1"
        step="0.1"
        className="w-24 px-3 py-2 rounded-lg bg-autronis-bg border border-autronis-border text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
      />
      <select
        value={klantId}
        onChange={(e) => setKlantId(e.target.value)}
        className="px-3 py-2 rounded-lg bg-autronis-bg border border-autronis-border text-sm text-autronis-text-secondary focus:outline-none focus:border-autronis-accent transition-colors"
      >
        <option value="">Geen klant</option>
        {klanten.map((k) => (
          <option key={k.id} value={k.id}>{k.bedrijfsnaam}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={bezig || !van.trim() || !naar.trim() || !km}
        className="px-4 py-2 bg-autronis-accent text-autronis-bg rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-40"
      >
        {bezig ? "..." : "+ Rit"}
      </button>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KilometersPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editRit, setEditRit] = useState<Rit | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<RitForm>(EMPTY_FORM);
  const [saveRouteNaam, setSaveRouteNaam] = useState("");
  const [showSaveRouteInput, setShowSaveRouteInput] = useState(false);
  const [routeFilter, setRouteFilter] = useState("");
  const [showRoutes, setShowRoutes] = useState(false);

  // Panel state
  const [showJaar, setShowJaar] = useState(false);
  const [showSnelForm, setShowSnelForm] = useState(false);
  const [showTerugkerend, setShowTerugkerend] = useState(false);
  const [showKmStand, setShowKmStand] = useState(false);

  // Month navigation
  const [maand, setMaand] = useState(new Date().getMonth() + 1);
  const [jaar, setJaar] = useState(new Date().getFullYear());
  const [navRichting, setNavRichting] = useState<1 | -1>(1);
  const [navKey, setNavKey] = useState(0);

  // Table sort
  const [sortKolom, setSortKolom] = useState<string>("datum");
  const [sortRichting, setSortRichting] = useState<"asc" | "desc">("desc");

  // Bar chart hover
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Table filter
  const [zoek, setZoek] = useState("");
  const [doelFilter, setDoelFilter] = useState<string | null>(null);

  // Data
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

  // Generate recurring trips on mount
  const genereerMutation = useGenereerTerugkerendeRitten();
  const hasGenerated = useRef(false);
  useEffect(() => {
    if (!hasGenerated.current) {
      hasGenerated.current = true;
      genereerMutation.mutate(undefined, {
        onSuccess: (data) => {
          if (data.aangemaakt > 0) {
            addToast(`${data.aangemaakt} terugkerende rit(ten) toegevoegd`, "succes");
          }
        },
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Vorige maand vergelijking
  const prevMaand = maand === 1 ? 12 : maand - 1;
  const prevJaar = maand === 1 ? jaar - 1 : jaar;
  const { data: prevData } = useRitten(prevMaand, prevJaar);
  const prevKm = prevData?.totaalKm ?? 0;
  const kmVerschil = prevKm > 0 ? ((totaalKm - prevKm) / prevKm * 100) : 0;

  // Column sort + filter
  const sortedRitten = useMemo(() => {
    let copy = [...ritten];

    // Apply doeltype filter
    if (doelFilter) {
      copy = copy.filter((r) => r.doelType === doelFilter);
    }

    // Apply search filter
    if (zoek.trim()) {
      const q = zoek.trim().toLowerCase();
      copy = copy.filter(
        (r) =>
          r.vanLocatie.toLowerCase().includes(q) ||
          r.naarLocatie.toLowerCase().includes(q) ||
          (r.klantNaam?.toLowerCase().includes(q) ?? false) ||
          (r.zakelijkDoel?.toLowerCase().includes(q) ?? false)
      );
    }

    copy.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      if (sortKolom === "datum") { va = a.datum; vb = b.datum; }
      else if (sortKolom === "kilometers") { va = a.kilometers; vb = b.kilometers; }
      else if (sortKolom === "bedrag") { va = a.kilometers * (a.tariefPerKm ?? 0.23); vb = b.kilometers * (b.tariefPerKm ?? 0.23); }
      else if (sortKolom === "klant") { va = a.klantNaam ?? ""; vb = b.klantNaam ?? ""; }
      if (typeof va === "string") {
        return sortRichting === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      }
      return sortRichting === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return copy;
  }, [ritten, sortKolom, sortRichting, doelFilter, zoek]);

  // Unique doeltypes present in this month's ritten (for filter chips)
  const aanwezigeDoelTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const r of ritten) {
      if (r.doelType) seen.add(r.doelType);
    }
    return Array.from(seen);
  }, [ritten]);

  const handleSort = useCallback((kolom: string) => {
    if (sortKolom === kolom) {
      setSortRichting((r) => r === "asc" ? "desc" : "asc");
    } else {
      setSortKolom(kolom);
      setSortRichting("desc");
    }
  }, [sortKolom]);

  // Klant subtotalen
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
      .map(([naam, data]) => ({
        naam, ...data,
        pct: totaalKm > 0 ? Math.round((data.km / totaalKm) * 100) : 0,
      }));
  }, [ritten, totaalKm]);

  // Jaarprognose
  const jaarPrognose = useMemo(() => {
    if (!jaarData) return null;
    const nu = new Date();
    const huidigJaarNum = nu.getFullYear();
    const huidigeMaandNum = huidigJaarNum === jaar ? nu.getMonth() + 1 : 12;
    const maandenMetData = jaarData.perMaand.filter((m) => m.km > 0).length;
    if (maandenMetData === 0) return null;
    const prognose = Math.round((jaarData.totaalKm / maandenMetData) * 12);
    const verloop = huidigeMaandNum;
    return { prognose, huidigeMaand: verloop, maandenMetData };
  }, [jaarData, jaar]);

  // Missing months hint
  const missingMonths = useMemo(() => {
    if (!jaarData) return [];
    const nu = new Date();
    const maxMaand = nu.getFullYear() === jaar ? nu.getMonth() + 1 : 12;
    const result: string[] = [];
    for (let m = 2; m <= maxMaand - 1; m++) {
      const hasData = jaarData.perMaand.some((x) => x.maand === m);
      if (!hasData) {
        const prevHas = jaarData.perMaand.some((x) => x.maand === m - 1);
        const nextHas = jaarData.perMaand.some((x) => x.maand === m + 1);
        if (prevHas || nextHas) result.push(MAAND_NAMEN[m - 1]);
      }
    }
    return result;
  }, [jaarData, jaar]);

  // Month navigation
  const handlePrevMonth = () => {
    setNavRichting(-1);
    setNavKey((k) => k + 1);
    if (maand === 1) { setMaand(12); setJaar(jaar - 1); }
    else setMaand(maand - 1);
  };

  const handleNextMonth = () => {
    setNavRichting(1);
    setNavKey((k) => k + 1);
    if (maand === 12) { setMaand(1); setJaar(jaar + 1); }
    else setMaand(maand + 1);
  };

  // Modal helpers
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

  const dupliceerRit = (rit: Rit) => {
    setEditRit(null);
    setForm({
      datum: new Date().toISOString().slice(0, 10),
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

  const openNieuwMetRoute = (route: OpgeslagenRoute) => {
    setEditRit(null);
    setForm({
      ...EMPTY_FORM,
      vanLocatie: route.vanLocatie,
      naarLocatie: route.naarLocatie,
      kilometers: route.kilometers.toString(),
      klantId: route.klantId?.toString() || "",
      projectId: route.projectId?.toString() || "",
      doelType: route.doelType || "",
    });
    useRouteMutation.mutate(route.id);
    setModalOpen(true);
  };

  // Datum shortcuts
  const setDatumShortcut = (dagOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - dagOffset);
    setForm((prev) => ({ ...prev, datum: d.toISOString().slice(0, 10) }));
  };

  // Save/delete mutations
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
    onError: (err) => addToast(err instanceof Error ? err.message : "Kon rit niet opslaan", "fout"),
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
    saveMutation.mutate({
      payload: {
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
      },
      isEdit: !!editRit,
      editId: editRit?.id,
    });
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
        onSuccess: () => { addToast("Route opgeslagen", "succes"); setSaveRouteNaam(""); setShowSaveRouteInput(false); },
        onError: () => addToast("Kon route niet opslaan", "fout"),
      }
    );
  };

  const handleExport = () => {
    window.open(`/api/kilometers/export?maand=${maand}&jaar=${jaar}`, "_blank");
  };

  const handleKopieerTabel = async () => {
    const header = "Datum\tVan\tNaar\tKm\tDoel\tKlant\tBedrag";
    const rows = sortedRitten.map((r) =>
      [
        r.datum,
        r.vanLocatie,
        r.naarLocatie,
        r.kilometers.toFixed(1),
        r.doelType ? (DOEL_LABELS[r.doelType] || r.doelType) : (r.zakelijkDoel || ""),
        r.klantNaam || "",
        (r.kilometers * (r.tariefPerKm ?? 0.23)).toFixed(2),
      ].join("\t")
    );
    await navigator.clipboard.writeText([header, ...rows].join("\n"));
    addToast("Tabel gekopieerd — plak direct in Excel of Notion", "succes");
  };

  const filteredProjecten = form.klantId
    ? projecten.filter((p) => p.klantId === parseInt(form.klantId))
    : projecten;

  const filteredRoutes = routeFilter.trim()
    ? opgeslagenRoutes.filter(
        (r) =>
          r.naam.toLowerCase().includes(routeFilter.toLowerCase()) ||
          r.vanLocatie.toLowerCase().includes(routeFilter.toLowerCase()) ||
          r.naarLocatie.toLowerCase().includes(routeFilter.toLowerCase())
      )
    : opgeslagenRoutes;

  const saving = saveMutation.isPending;
  const monthKey = `${maand}-${jaar}-${navKey}`;

  // ─── Loading ───────────────────────────────────────────────────────────────

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

  // ─── Render ────────────────────────────────────────────────────────────────

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
          <div className="flex items-center gap-2 flex-wrap">
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
              onClick={() => setShowTerugkerend(true)}
              className="inline-flex items-center gap-2 px-3 py-2.5 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary rounded-xl text-sm font-medium transition-colors hover:bg-autronis-card"
            >
              <Repeat className="w-4 h-4" />
              Terugkerend
            </button>
            <BelastingrapportKnop jaar={jaar} />
            <button
              onClick={handleKopieerTabel}
              className="inline-flex items-center gap-2 px-3 py-2.5 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary rounded-xl text-sm font-medium transition-colors hover:bg-autronis-card"
              title="Kopieer als tabel (voor Excel / Notion)"
            >
              <Copy className="w-4 h-4" />
              Kopieer
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

        {/* Jaaroverzicht panel — animated height */}
        <AnimatePresence>
          {showJaar && jaarData && (
            <motion.div
              key="jaaroverzicht"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ overflow: "hidden" }}
            >
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

                {/* Year KPI tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-autronis-bg/50 rounded-xl p-4">
                    <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">{jaarData.totaalKm.toFixed(1)}</p>
                    <p className="text-xs text-autronis-text-secondary mt-1">Totaal km</p>
                  </div>
                  <div className="bg-autronis-bg/50 rounded-xl p-4">
                    <p className="text-2xl font-bold text-emerald-400 tabular-nums">{formatBedrag(jaarData.totaalAftrekbaar)}</p>
                    <p className="text-xs text-autronis-text-secondary mt-1">Aftrekbaar dit jaar</p>
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

                {/* Prognose */}
                {jaarPrognose && (
                  <div className="bg-autronis-accent/5 border border-autronis-accent/15 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-autronis-text-primary">
                        Jaarprognose: <span className="text-autronis-accent font-bold">{jaarPrognose.prognose.toLocaleString("nl-NL")} km</span>
                      </p>
                      <p className="text-xs text-autronis-text-secondary mt-0.5">
                        Op dit tempo ({jaarPrognose.maandenMetData} maanden data) ·&nbsp;
                        {jaarData.vorigJaarKm > 0 && (
                          <>vorig jaar: {jaarData.vorigJaarKm.toFixed(0)} km</>
                        )}
                      </p>
                    </div>
                    <TrendingUp className="w-5 h-5 text-autronis-accent opacity-60" />
                  </div>
                )}

                {/* Missing months hint */}
                {missingMonths.length > 0 && (
                  <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
                    <p className="text-xs text-yellow-400">
                      Geen ritten in: <strong>{missingMonths.join(", ")}</strong> — vergeten?
                    </p>
                  </div>
                )}

                {/* Bar chart */}
                <div>
                  <h3 className="text-sm font-medium text-autronis-text-secondary mb-3">Per maand</h3>
                  <div className="flex items-end gap-1.5 h-32">
                    {Array.from({ length: 12 }, (_, i) => {
                      const barData = jaarData.perMaand.find((m) => m.maand === i + 1);
                      const km = barData?.km ?? 0;
                      const maxKm = Math.max(...jaarData.perMaand.map((m) => m.km), 1);
                      const pct = (km / maxKm) * 100;
                      const isHuidig = i + 1 === maand;
                      const isHovered = hoveredBar === i;

                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center gap-1 relative cursor-pointer"
                          onMouseEnter={() => setHoveredBar(i)}
                          onMouseLeave={() => setHoveredBar(null)}
                          onClick={() => {
                            const targetMaand = i + 1;
                            const dir = targetMaand > maand || (targetMaand === maand) ? 1 : -1;
                            setNavRichting(dir as 1 | -1);
                            setNavKey((k) => k + 1);
                            setMaand(targetMaand);
                            setShowJaar(false);
                          }}
                          title={`Ga naar ${MAAND_NAMEN[i]}`}
                        >
                          {/* Hover tooltip */}
                          <AnimatePresence>
                            {isHovered && km > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ duration: 0.15 }}
                                className="absolute -top-16 left-1/2 -translate-x-1/2 bg-autronis-card border border-autronis-border rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap z-10 shadow-xl pointer-events-none"
                              >
                                <p className="font-bold text-autronis-text-primary">{km.toFixed(0)} km</p>
                                <p className="text-emerald-400">{formatBedrag(km * 0.23)}</p>
                                <p className="text-autronis-text-secondary/60">{barData?.ritten ?? 0} ritten</p>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="w-full relative" style={{ height: "100px" }}>
                            <motion.div
                              className={cn(
                                "absolute bottom-0 w-full rounded-t-md",
                                isHuidig
                                  ? "bg-autronis-accent shadow-[0_0_10px_rgba(23,184,165,0.35)]"
                                  : "bg-autronis-accent/30",
                                isHovered && !isHuidig && "bg-autronis-accent/50"
                              )}
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(pct, km > 0 ? 2 : 0)}%` }}
                              transition={{ duration: 0.55, delay: i * 0.035, ease: [0.25, 0.46, 0.45, 0.94] }}
                            />
                          </div>
                          <span className={cn(
                            "text-[10px] tabular-nums",
                            isHuidig ? "text-autronis-accent font-semibold" : "text-autronis-text-secondary/50"
                          )}>
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

                {/* Auto-overzicht: Brandstof */}
                {jaarData.brandstof && (
                  <div className="border-t border-autronis-border/50 pt-5 space-y-4">
                    <h3 className="text-sm font-medium text-autronis-text-secondary flex items-center gap-2">
                      <Car className="w-4 h-4 text-amber-400" />
                      Auto-overzicht
                    </h3>

                    {/* Brandstof KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-autronis-bg/50 rounded-xl p-3">
                        <p className="text-lg font-bold text-amber-400 tabular-nums">{formatBedrag(jaarData.brandstof.totaalBedrag)}</p>
                        <p className="text-xs text-autronis-text-secondary mt-0.5">Brandstof totaal</p>
                      </div>
                      <div className="bg-autronis-bg/50 rounded-xl p-3">
                        <p className="text-lg font-bold text-autronis-text-primary tabular-nums">{jaarData.brandstof.aantalTankbeurten}</p>
                        <p className="text-xs text-autronis-text-secondary mt-0.5">Tankbeurten</p>
                      </div>
                      <div className="bg-autronis-bg/50 rounded-xl p-3">
                        <p className="text-lg font-bold text-autronis-text-primary tabular-nums">
                          {jaarData.brandstof.totaalLiters > 0 ? `${jaarData.brandstof.totaalLiters.toFixed(1)}L` : "—"}
                        </p>
                        <p className="text-xs text-autronis-text-secondary mt-0.5">Liters getankt</p>
                      </div>
                      <div className="bg-autronis-bg/50 rounded-xl p-3">
                        <p className="text-lg font-bold text-autronis-text-primary tabular-nums">
                          {jaarData.brandstof.kostenPerKm > 0 ? `€${jaarData.brandstof.kostenPerKm.toFixed(2)}/km` : "—"}
                        </p>
                        <p className="text-xs text-autronis-text-secondary mt-0.5">Kosten per km</p>
                      </div>
                    </div>

                    {/* Recente tankbeurten */}
                    {jaarData.brandstof.recent.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-autronis-text-tertiary mb-2">Recente tankbeurten</h4>
                        <div className="space-y-1.5">
                          {jaarData.brandstof.recent.slice(0, 5).map((b: { id: number; datum: string; bedrag: number; liters: number | null; notitie: string | null; isAutomatisch: boolean }) => (
                            <div key={b.id} className="flex items-center gap-3 bg-autronis-bg/30 rounded-lg px-3 py-2">
                              <span className="text-xs text-autronis-text-secondary w-20">{formatDatumKort(b.datum)}</span>
                              <span className="text-sm text-autronis-text-primary font-medium tabular-nums">{formatBedrag(b.bedrag)}</span>
                              {b.liters && <span className="text-xs text-autronis-text-secondary tabular-nums">{b.liters.toFixed(1)}L</span>}
                              {b.isAutomatisch && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">REVOLUT</span>
                              )}
                              {b.notitie && <span className="text-xs text-autronis-text-tertiary truncate flex-1">{b.notitie}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Km-stand panel */}
        <KmStandPanel maand={maand} jaar={jaar} zakelijkeKm={totaalKm} />

        {/* Month selector */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-[200px] text-center overflow-hidden">
            <AnimatePresence mode="wait" custom={navRichting} initial={false}>
              <motion.span
                key={monthKey}
                custom={navRichting}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="inline-block text-lg font-semibold text-autronis-text-primary"
              >
                {MAAND_NAMEN[maand - 1]} {jaar}
              </motion.span>
            </AnimatePresence>
          </div>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Slide-animated month content */}
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={navRichting} initial={false}>
            <motion.div
              key={monthKey}
              custom={navRichting}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >

              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {/* Totaal km */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow bg-autronis-card"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-autronis-accent/10 rounded-xl">
                      <Car className="w-4 h-4 text-autronis-accent" />
                    </div>
                  </div>
                  <AnimatedNumber key={`km-${monthKey}`} value={totaalKm} className="text-2xl font-bold text-autronis-text-primary tabular-nums" />
                  <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Totaal km</p>
                </motion.div>

                {/* Aftrekbaar — met info tooltip */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow bg-autronis-card"
                >
                  <div className="flex items-center gap-2 mb-2 relative group">
                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                    </div>
                    <button className="p-0.5 text-autronis-text-secondary/40 hover:text-autronis-text-secondary transition-colors ml-auto">
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    {/* Tooltip */}
                    <div className="absolute top-9 left-0 z-20 w-64 p-3 bg-autronis-card border border-autronis-border rounded-xl shadow-xl text-xs text-autronis-text-secondary invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
                      <p className="font-semibold text-autronis-text-primary mb-1.5">Aftrekbaar (€0,23/km)</p>
                      <p className="text-emerald-400 mb-1">✓ Klantbezoek, meetings, leveranciers, boekhouder, training</p>
                      <p className="text-red-400">✗ Woon-werkverkeer, privéritten, lunch</p>
                      <p className="text-autronis-text-secondary/50 mt-1.5">Belastingdienst controleert tot 5 jaar terug.</p>
                    </div>
                  </div>
                  <AnimatedNumber key={`bedrag-${monthKey}`} value={totaalBedrag} format={formatBedrag} className="text-2xl font-bold text-emerald-400 tabular-nums" />
                  <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Aftrekbaar</p>
                </motion.div>

                {/* Ritten */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow bg-autronis-card"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-blue-500/10 rounded-xl">
                      <Car className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                  <AnimatedNumber key={`ritten-${monthKey}`} value={aantalRitten} className="text-2xl font-bold text-autronis-text-primary tabular-nums" />
                  <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">
                    Ritten
                    {aantalRitten > 0 && (
                      <span className="ml-1.5 text-autronis-text-secondary/50 normal-case tracking-normal">
                        · gem. {(totaalKm / aantalRitten).toFixed(0)} km
                      </span>
                    )}
                  </p>
                </motion.div>

                {/* vs vorige maand */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow bg-autronis-card"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-purple-500/10 rounded-xl">
                      {kmVerschil >= 0
                        ? <TrendingUp className="w-4 h-4 text-purple-400" />
                        : <TrendingDown className="w-4 h-4 text-purple-400" />
                      }
                    </div>
                  </div>
                  {prevKm === 0 ? (
                    <p className="text-2xl font-bold text-autronis-text-secondary/40 tabular-nums">—</p>
                  ) : (
                    <div className={cn("text-2xl font-bold tabular-nums flex items-center gap-1.5", kmVerschil >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {kmVerschil >= 0
                        ? <TrendingUp className="w-5 h-5" />
                        : <TrendingDown className="w-5 h-5" />
                      }
                      {kmVerschil >= 0 ? "+" : ""}{kmVerschil.toFixed(0)}%
                    </div>
                  )}
                  <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">
                    vs. vorige maand
                    {prevKm > 0 && (
                      <span className="ml-1.5 text-autronis-text-secondary/50 normal-case tracking-normal">
                        · was {prevKm.toFixed(0)} km
                      </span>
                    )}
                  </p>
                </motion.div>

                {/* Donut chart — privé/zakelijk */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.24, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <DonutChart totaalKm={totaalKm} zakelijkeKm={totaalKm} />
                </motion.div>
              </div>

              {/* Klant subtotalen met % */}
              {klantSubtotalen.length > 1 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {klantSubtotalen.slice(0, 4).map((k) => (
                    <div key={k.naam} className="bg-autronis-card/50 border border-autronis-border/50 rounded-xl px-4 py-3">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium text-autronis-text-primary truncate">{k.naam}</p>
                        <span className="text-xs font-semibold text-autronis-accent tabular-nums shrink-0">{k.pct}%</span>
                      </div>
                      <p className="text-xs text-autronis-text-secondary mt-1">
                        {k.km.toFixed(1)} km · {formatBedrag(k.bedrag)}
                      </p>
                      {/* Progress bar */}
                      <div className="mt-1.5 h-1 rounded-full bg-autronis-border/40 overflow-hidden">
                        <motion.div
                          className="h-full bg-autronis-accent/60 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${k.pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Rit tabel */}
              <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
                {/* Snelle rit invoer toggle */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                  <h2 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide">
                    Ritten {MAAND_NAMEN[maand - 1]}
                    {ritten.length > 0 && (
                      <span className="ml-2 text-autronis-text-secondary/40 normal-case tracking-normal font-normal">
                        {sortedRitten.length !== ritten.length
                          ? `${sortedRitten.length} / ${ritten.length}`
                          : ritten.length}
                      </span>
                    )}
                  </h2>
                  <button
                    onClick={() => setShowSnelForm(!showSnelForm)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
                      showSnelForm
                        ? "border-autronis-accent text-autronis-accent bg-autronis-accent/10"
                        : "border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                    )}
                  >
                    <Plus className={cn("w-3.5 h-3.5 transition-transform", showSnelForm && "rotate-45")} />
                    Snel toevoegen
                  </button>
                </div>

                {/* Search + doeltype filter chips */}
                {ritten.length > 0 && (
                  <div className="px-6 pb-3 flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[160px] max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-autronis-text-secondary/40 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Zoek op route of klant..."
                        value={zoek}
                        onChange={(e) => setZoek(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-autronis-bg border border-autronis-border rounded-lg text-autronis-text-primary placeholder:text-autronis-text-secondary/40 focus:outline-none focus:border-autronis-accent transition-colors"
                      />
                      {zoek && (
                        <button
                          onClick={() => setZoek("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-autronis-text-secondary/50 hover:text-autronis-text-primary transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {aanwezigeDoelTypes.map((type) => {
                      const chip = DOEL_CHIP[type] ?? { bg: "bg-slate-500/15", text: "text-slate-400" };
                      const actief = doelFilter === type;
                      return (
                        <button
                          key={type}
                          onClick={() => setDoelFilter(actief ? null : type)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                            actief
                              ? `${chip.bg} ${chip.text} border-current/30`
                              : "bg-transparent border-autronis-border/50 text-autronis-text-secondary hover:border-autronis-border"
                          )}
                        >
                          {DOEL_LABELS[type] ?? type}
                        </button>
                      );
                    })}
                    {(doelFilter || zoek) && (
                      <button
                        onClick={() => { setDoelFilter(null); setZoek(""); }}
                        className="text-xs text-autronis-text-secondary/50 hover:text-autronis-text-primary transition-colors"
                      >
                        Wissen
                      </button>
                    )}
                  </div>
                )}

                {/* Snelle rit invoer */}
                <AnimatePresence>
                  {showSnelForm && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                      style={{ overflow: "hidden" }}
                    >
                      <SnelRitForm
                        klanten={klanten}
                        projecten={projecten}
                        onSaved={() => setShowSnelForm(false)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Filtered empty state */}
                {ritten.length > 0 && sortedRitten.length === 0 && (
                  <div className="px-6 pb-6 text-center py-8">
                    <p className="text-sm text-autronis-text-secondary">Geen ritten gevonden voor deze filter.</p>
                    <button
                      onClick={() => { setDoelFilter(null); setZoek(""); }}
                      className="mt-2 text-xs text-autronis-accent hover:text-autronis-accent-hover transition-colors"
                    >
                      Filter wissen
                    </button>
                  </div>
                )}

                {/* Empty state */}
                {ritten.length === 0 ? (
                  <div className="px-6 pb-6">
                    {opgeslagenRoutes.length > 0 ? (
                      <div className="text-center py-10">
                        <Car className="w-10 h-10 text-autronis-text-secondary/30 mx-auto mb-3" />
                        <p className="text-base font-medium text-autronis-text-primary mb-1">Geen ritten in {MAAND_NAMEN[maand - 1]}</p>
                        <p className="text-sm text-autronis-text-secondary mb-4">Voeg snel een rit toe via een opgeslagen route:</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {opgeslagenRoutes.slice(0, 4).map((route) => (
                            <button
                              key={route.id}
                              onClick={() => openNieuwMetRoute(route)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-autronis-border bg-autronis-bg text-sm text-autronis-text-primary hover:border-autronis-accent/40 hover:text-autronis-accent transition-colors"
                            >
                              <Bookmark className="w-3.5 h-3.5 text-autronis-accent/60" />
                              {route.naam}
                              <span className="text-autronis-text-secondary/60">({route.kilometers} km)</span>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={openNieuwModal}
                          className="mt-4 text-sm text-autronis-text-secondary hover:text-autronis-accent transition-colors"
                        >
                          Of voeg handmatig toe →
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-10">
                        <Car className="w-10 h-10 text-autronis-text-secondary/30 mx-auto mb-3" />
                        <p className="text-base font-medium text-autronis-text-primary mb-1">Nog geen ritten</p>
                        <p className="text-sm text-autronis-text-secondary mb-4">Voeg je eerste zakelijke rit toe om te beginnen met registreren.</p>
                        <button
                          onClick={openNieuwModal}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent text-autronis-bg rounded-lg text-sm font-semibold hover:bg-autronis-accent-hover transition-colors"
                        >
                          <Plus className="w-4 h-4" /> Nieuwe rit
                        </button>
                      </div>
                    )}
                  </div>
                ) : sortedRitten.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-autronis-border">
                          <SortHeader label="Datum" kolom="datum" sortKolom={sortKolom} sortRichting={sortRichting} onSort={handleSort} className="text-left" />
                          <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Route</th>
                          <SortHeader label="Km" kolom="kilometers" sortKolom={sortKolom} sortRichting={sortRichting} onSort={handleSort} className="text-right" />
                          <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Doel</th>
                          <SortHeader label="Klant" kolom="klant" sortKolom={sortKolom} sortRichting={sortRichting} onSort={handleSort} className="text-left" />
                          <SortHeader label="Bedrag" kolom="bedrag" sortKolom={sortKolom} sortRichting={sortRichting} onSort={handleSort} className="text-right" />
                          <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Acties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRitten.map((rit, i) => (
                          <motion.tr
                            key={rit.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.025, duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                            className={cn(
                              "border-b border-autronis-border/50 transition-colors group/row",
                              rit.doelType && DOEL_RIJ[rit.doelType]
                                ? DOEL_RIJ[rit.doelType]
                                : "hover:bg-autronis-bg/30"
                            )}
                          >
                            <td className="py-3.5 px-4 text-sm text-autronis-text-secondary">
                              {formatDatumKort(rit.datum)}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-sm text-autronis-text-primary">{rit.vanLocatie}</span>
                              <span className="text-autronis-text-secondary mx-1.5">→</span>
                              <span className="text-sm text-autronis-text-primary">{rit.naarLocatie}</span>
                              {rit.isRetour === 1 && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                  ↩ retour
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-sm font-semibold text-autronis-text-primary text-right tabular-nums">
                              {rit.kilometers.toFixed(1)}
                            </td>
                            <td className="py-3.5 px-4 text-sm text-autronis-text-secondary">
                              {rit.doelType ? (() => {
                                const chip = DOEL_CHIP[rit.doelType] ?? { bg: "bg-slate-500/15", text: "text-slate-400" };
                                return (
                                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", chip.bg, chip.text)}>
                                    {DOEL_LABELS[rit.doelType] || rit.doelType}
                                  </span>
                                );
                              })() : rit.zakelijkDoel ? (
                                <span className="truncate max-w-[150px] block">{rit.zakelijkDoel}</span>
                              ) : "—"}
                            </td>
                            <td className="py-3.5 px-4 text-sm text-autronis-text-secondary">
                              {rit.klantNaam || "—"}
                              {rit.projectNaam && (
                                <span className="block text-xs text-autronis-text-secondary/70">{rit.projectNaam}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-sm font-semibold text-emerald-400 text-right tabular-nums">
                              {formatBedrag(rit.kilometers * (rit.tariefPerKm ?? 0.23))}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-end gap-1">
                                {/* Dupliceer — verschijnt bij hover */}
                                <button
                                  onClick={() => dupliceerRit(rit)}
                                  title="Dupliceer rit"
                                  className="p-1.5 text-autronis-text-secondary/0 group-hover/row:text-autronis-text-secondary hover:!text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-all"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
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
                          </motion.tr>
                        ))}

                        {/* Totaalrij */}
                        <tr className="border-t-2 border-autronis-border bg-autronis-bg/20">
                          <td colSpan={2} className="py-3.5 px-4 text-sm font-semibold text-autronis-text-primary">Totaal</td>
                          <td className="py-3.5 px-4 text-sm font-bold text-autronis-text-primary text-right tabular-nums">{totaalKm.toFixed(1)}</td>
                          <td colSpan={1} />
                          <td className="py-3.5 px-4 text-xs text-autronis-text-secondary/60 text-right">
                            {aantalRitten} ritten · €0,23/km
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="text-sm font-bold text-emerald-400 tabular-nums">{formatBedrag(totaalBedrag)}</span>
                            <span className="block text-xs text-autronis-text-secondary/50 tabular-nums">aftrekbaar</span>
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Invoer Modal */}
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
                <AnimatePresence>
                  {showRoutes && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden" }}
                      className="mb-3"
                    >
                      {/* Zoekbalk voor routes */}
                      {opgeslagenRoutes.length > 4 && (
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-autronis-text-secondary/50" />
                          <input
                            type="text"
                            placeholder="Zoek route..."
                            value={routeFilter}
                            onChange={(e) => setRouteFilter(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm bg-autronis-bg border border-autronis-border rounded-lg text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {filteredRoutes.map((route, idx) => {
                          const isMeestGebruikt = idx < 3 && route.aantalKeerGebruikt > 0;
                          return (
                            <div
                              key={route.id}
                              className="flex items-center gap-3 bg-autronis-bg rounded-xl px-3 py-2.5 border border-autronis-border/50"
                            >
                              <button
                                onClick={() => applyRoute(route)}
                                className="flex-1 text-left text-sm hover:text-autronis-accent transition-colors"
                              >
                                <span className="font-medium text-autronis-text-primary">{route.naam}</span>
                                {isMeestGebruikt && (
                                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
                                    <Star className="w-2.5 h-2.5" />
                                    Meest gebruikt
                                  </span>
                                )}
                                <span className="text-autronis-text-secondary ml-2">
                                  {route.vanLocatie} → {route.naarLocatie} ({route.kilometers} km)
                                </span>
                              </button>
                              <button
                                onClick={() => deleteRouteMutation.mutate(route.id)}
                                className="p-1 text-autronis-text-secondary hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                        {filteredRoutes.length === 0 && (
                          <p className="text-xs text-autronis-text-secondary/50 px-2 py-1">Geen routes gevonden</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Datum + datum shortcuts */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormField
                  label="Datum"
                  type="date"
                  verplicht
                  value={form.datum}
                  onChange={(e) => setForm({ ...form, datum: e.target.value })}
                />
                <div className="flex gap-1.5 mt-1.5">
                  {[
                    { label: "Vandaag", offset: 0 },
                    { label: "Gisteren", offset: 1 },
                    { label: "Eergisteren", offset: 2 },
                  ].map(({ label, offset }) => {
                    const d = new Date();
                    d.setDate(d.getDate() - offset);
                    const val = d.toISOString().slice(0, 10);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setDatumShortcut(offset)}
                        className={cn(
                          "text-[11px] px-2 py-0.5 rounded-md transition-colors",
                          form.datum === val
                            ? "bg-autronis-accent/20 text-autronis-accent"
                            : "bg-autronis-border/40 text-autronis-text-secondary hover:text-autronis-text-primary"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <FormField
                label="Kilometers (enkele reis)"
                type="number"
                verplicht
                placeholder="0.0"
                value={form.kilometers}
                onChange={(e) => setForm({ ...form, kilometers: e.target.value })}
              />
            </div>

            {/* Retour toggle — spring animation */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={cn(
                  "w-10 h-6 rounded-full transition-colors relative flex-shrink-0",
                  form.isRetour ? "bg-autronis-accent" : "bg-autronis-border"
                )}
                onClick={() => setForm({ ...form, isRetour: !form.isRetour })}
              >
                <motion.div
                  className="w-4 h-4 rounded-full bg-white absolute top-1 shadow-sm"
                  animate={{ x: form.isRetour ? 20 : 4 }}
                  transition={{ type: "spring", stiffness: 700, damping: 35 }}
                />
              </div>
              <span className="text-sm text-autronis-text-primary">Retour (heen + terug)</span>
              <AnimatePresence mode="wait">
                {form.isRetour && form.kilometers && (
                  <motion.span
                    key="retour-km"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs text-autronis-accent tabular-nums font-medium"
                  >
                    = {(parseFloat(form.kilometers) * 2).toFixed(1)} km totaal
                  </motion.span>
                )}
              </AnimatePresence>
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

            {/* Route opslaan */}
            {!editRit && form.vanLocatie && form.naarLocatie && form.kilometers && (
              <div className="border-t border-autronis-border pt-3">
                <AnimatePresence mode="wait">
                  {showSaveRouteInput ? (
                    <motion.div
                      key="save-input"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex items-center gap-2"
                    >
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
                      <button onClick={() => setShowSaveRouteInput(false)} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="save-btn"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setShowSaveRouteInput(true)}
                      className="flex items-center gap-2 text-sm text-autronis-text-secondary hover:text-autronis-accent transition-colors"
                    >
                      <BookmarkPlus className="w-4 h-4" />
                      Route opslaan voor later
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </Modal>

        {/* Delete bevestiging */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => { setDeleteDialogOpen(false); setDeleteId(null); }}
          onBevestig={() => deleteId && deleteMutation.mutate(deleteId)}
          titel="Rit verwijderen?"
          bericht="Weet je zeker dat je deze rit wilt verwijderen?"
          bevestigTekst="Verwijderen"
          variant="danger"
        />

        {/* Terugkerende ritten modal */}
        <TerugkerendeRittenModal open={showTerugkerend} onClose={() => setShowTerugkerend(false)} />
      </div>
    </PageTransition>
  );
}
