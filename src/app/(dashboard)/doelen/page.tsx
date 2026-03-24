"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  Zap,
  User,
  Minus,
  X,
  Sparkles,
  Clock,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  ArrowRight,
  Shield,
  ChevronDown,
  ChevronUp,
  Share2,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatBedrag } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useDoelen,
  useGebruikers,
  useCheckIns,
  useCreateCheckIn,
  useSuggestKrs,
  useCheckInSamenvatting,
  useKwartaalReflectie,
  type Doel,
  type KeyResult,
  type GebruikerOptie,
  type KrSuggestie,
} from "@/hooks/queries/use-doelen";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { ProgressRing } from "@/components/ui/progress-ring";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ---- Helpers ----

function voortgangKleur(pct: number): string {
  if (pct >= 75) return "#22c55e";
  if (pct >= 40) return "#f59e0b";
  return "#ef4444";
}

function voortgangTekstKleur(pct: number): string {
  if (pct >= 75) return "text-green-400";
  if (pct >= 40) return "text-yellow-400";
  return "text-red-400";
}

function statusBadgeKleur(status: string | null): string {
  switch (status) {
    case "actief": return "bg-autronis-accent/20 text-autronis-accent";
    case "afgerond": return "bg-green-500/20 text-green-400";
    case "geannuleerd": return "bg-red-500/20 text-red-400";
    default: return "bg-autronis-border text-autronis-text-secondary";
  }
}

function autoKoppelingLabel(koppeling: string | null): string {
  switch (koppeling) {
    case "omzet": return "Omzet";
    case "uren": return "Uren";
    case "taken": return "Taken";
    case "klanten": return "Klanten";
    default: return "";
  }
}

function trackStatus(voortgang: number, tijdPct: number): { label: string; kleur: string; bg: string; icon: typeof CheckCircle2 } {
  const ratio = tijdPct > 0 ? voortgang / tijdPct : voortgang > 0 ? 1.5 : 0;
  if (ratio >= 0.85) return { label: "Op schema", kleur: "text-green-400", bg: "bg-green-500/15", icon: CheckCircle2 };
  if (ratio >= 0.55) return { label: "Risico", kleur: "text-yellow-400", bg: "bg-yellow-500/15", icon: AlertTriangle };
  return { label: "Achter", kleur: "text-red-400", bg: "bg-red-500/15", icon: AlertTriangle };
}

function confidenceLabel(c: number): { label: string; kleur: string } {
  if (c >= 70) return { label: "Hoog", kleur: "text-green-400" };
  if (c >= 40) return { label: "Gemiddeld", kleur: "text-yellow-400" };
  return { label: "Laag", kleur: "text-red-400" };
}

// ---- OKR Templates ----

interface OkrTemplate {
  titel: string;
  omschrijving: string;
  keyResults: KeyResult[];
}

interface OkrTemplateWithColor extends OkrTemplate {
  kleur: string;
  bg: string;
}

const OKR_TEMPLATES: OkrTemplateWithColor[] = [
  {
    titel: "Autronis omzet laten groeien",
    omschrijving: "Focus op omzetgroei door meer klanten en proposals",
    kleur: "#22c55e",
    bg: "bg-green-500/10",
    keyResults: [
      { titel: "€10.000 omzet deze maand", doelwaarde: 10000, huidigeWaarde: 0, eenheid: "euro", autoKoppeling: "omzet" },
      { titel: "3 nieuwe klanten binnenhalen", doelwaarde: 3, huidigeWaarde: 0, eenheid: "stuks", autoKoppeling: "klanten" },
      { titel: "5 proposals versturen", doelwaarde: 5, huidigeWaarde: 0, eenheid: "stuks", autoKoppeling: "geen" },
    ],
  },
  {
    titel: "Producten lanceren",
    omschrijving: "Eigen producten live zetten en eerste gebruikers werven",
    kleur: "#3B82F6",
    bg: "bg-blue-500/10",
    keyResults: [
      { titel: "Investment Engine live", doelwaarde: 100, huidigeWaarde: 0, eenheid: "%", autoKoppeling: "geen" },
      { titel: "Case Study Generator live", doelwaarde: 100, huidigeWaarde: 0, eenheid: "%", autoKoppeling: "geen" },
      { titel: "Sales Engine eerste scan gedaan", doelwaarde: 1, huidigeWaarde: 0, eenheid: "stuks", autoKoppeling: "geen" },
    ],
  },
  {
    titel: "Online zichtbaarheid vergroten",
    omschrijving: "Content publiceren en verkeer naar de website trekken",
    kleur: "#A855F7",
    bg: "bg-purple-500/10",
    keyResults: [
      { titel: "12 LinkedIn posts deze maand", doelwaarde: 12, huidigeWaarde: 0, eenheid: "stuks", autoKoppeling: "geen" },
      { titel: "4 case study video's publiceren", doelwaarde: 4, huidigeWaarde: 0, eenheid: "stuks", autoKoppeling: "geen" },
      { titel: "100 website bezoekers per week", doelwaarde: 100, huidigeWaarde: 0, eenheid: "stuks", autoKoppeling: "geen" },
    ],
  },
  {
    titel: "Efficiënter werken",
    omschrijving: "Meer billable uren, minder admin overhead",
    kleur: "#f59e0b",
    bg: "bg-yellow-500/10",
    keyResults: [
      { titel: "80% billable uren ratio", doelwaarde: 80, huidigeWaarde: 0, eenheid: "%", autoKoppeling: "geen" },
      { titel: "Urencriterium op schema - 1225 uur", doelwaarde: 1225, huidigeWaarde: 0, eenheid: "uren", autoKoppeling: "uren" },
      { titel: "Admin < 2 uur per week", doelwaarde: 2, huidigeWaarde: 0, eenheid: "uren", autoKoppeling: "geen" },
    ],
  },
];

// ---- Quarter time helpers ----

function kwartaalWekenOver(kwartaal: number, jaar: number): number {
  const eindMaand = kwartaal * 3;
  const kwartaalEind = new Date(jaar, eindMaand, 0);
  const nu = new Date();
  const diff = kwartaalEind.getTime() - nu.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
}

function kwartaalVoortgangTijd(kwartaal: number, jaar: number): number {
  const startMaand = (kwartaal - 1) * 3;
  const kwartaalStart = new Date(jaar, startMaand, 1);
  const kwartaalEind = new Date(jaar, startMaand + 3, 0);
  const nu = new Date();
  if (nu <= kwartaalStart) return 0;
  if (nu >= kwartaalEind) return 100;
  const totaal = kwartaalEind.getTime() - kwartaalStart.getTime();
  const verstreken = nu.getTime() - kwartaalStart.getTime();
  return Math.round((verstreken / totaal) * 100);
}

function formatKrWaarde(waarde: number, eenheid: string | null, koppeling: string | null): string {
  if (koppeling === "omzet" || eenheid === "euro") return formatBedrag(waarde);
  if (koppeling === "uren" || eenheid === "uren") return `${Math.round(waarde)}u`;
  return String(Math.round(waarde * 10) / 10);
}

// ---- Skeleton ----

function DoelenSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-8">
      <div><Skeleton className="h-8 w-48 mb-2" /><Skeleton className="h-4 w-72" /></div>
      <div className="flex gap-2">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-10 w-16 rounded-lg" />)}</div>
      <div className="space-y-6"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
    </div>
  );
}

function emptyKr(): KeyResult {
  return { titel: "", doelwaarde: 0, huidigeWaarde: 0, eenheid: null, autoKoppeling: "geen" };
}

// ---- Main Page ----

export default function DoelenPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();

  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const [kwartaal, setKwartaal] = useState(currentQuarter);
  const [jaar, setJaar] = useState(new Date().getFullYear());

  const { data: doelenData, isLoading: loading } = useDoelen(kwartaal, jaar);
  const doelen = doelenData?.doelen ?? [];
  const { data: gebruikers = [] } = useGebruikers();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editDoel, setEditDoel] = useState<Doel | null>(null);
  const [formTitel, setFormTitel] = useState("");
  const [formOmschrijving, setFormOmschrijving] = useState("");
  const [formEigenaarId, setFormEigenaarId] = useState<number | "">("");
  const [formKeyResults, setFormKeyResults] = useState<KeyResult[]>([emptyKr()]);
  const [opslaan, setOpslaan] = useState(false);

  // Delete confirm
  const [verwijderDoel, setVerwijderDoel] = useState<Doel | null>(null);

  // Inline KR update
  const [editKrId, setEditKrId] = useState<number | null>(null);
  const [editKrWaarde, setEditKrWaarde] = useState("");

  // Check-in state
  const [checkInDoelId, setCheckInDoelId] = useState<number | null>(null);
  const [checkInVoortgang, setCheckInVoortgang] = useState(0);
  const [checkInBlocker, setCheckInBlocker] = useState("");
  const [checkInVolgendeStap, setCheckInVolgendeStap] = useState("");
  const { data: checkIns } = useCheckIns(checkInDoelId);
  const createCheckIn = useCreateCheckIn();

  // Expanded goals
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null);

  // Jaaroverzicht
  const [jaaroverzichtOpen, setJaaroverzichtOpen] = useState(false);
  const [jaaroverzichtData, setJaaroverzichtData] = useState<Record<number, Doel[]>>({});
  const [jaaroverzichtLoading, setJaaroverzichtLoading] = useState(false);

  // AI
  const suggestMutation = useSuggestKrs(kwartaal, jaar);
  const checkInSamenvatting = useCheckInSamenvatting();
  const kwartaalReflectieMutation = useKwartaalReflectie();
  const [checkInSamenvattingTekst, setCheckInSamenvattingTekst] = useState<string | null>(null);
  const [reflectieTekst, setReflectieTekst] = useState<string | null>(null);

  const invalidateDoelen = () => queryClient.invalidateQueries({ queryKey: ["doelen"] });

  // Time context
  const tijdPct = kwartaalVoortgangTijd(kwartaal, jaar);
  const wekenOver = kwartaalWekenOver(kwartaal, jaar);

  function openNieuw() {
    setEditDoel(null);
    setFormTitel("");
    setFormOmschrijving("");
    setFormEigenaarId("");
    setFormKeyResults([emptyKr()]);
    setModalOpen(true);
  }

  function openBewerken(doel: Doel) {
    setEditDoel(doel);
    setFormTitel(doel.titel);
    setFormOmschrijving(doel.omschrijving || "");
    setFormEigenaarId(doel.eigenaarId || "");
    setFormKeyResults(doel.keyResults.length > 0 ? doel.keyResults.map((kr) => ({ ...kr })) : [emptyKr()]);
    setModalOpen(true);
  }

  // Save
  const opslaanMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const url = editDoel ? `/api/doelen/${editDoel.id}` : "/api/doelen";
      const method = editDoel ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json() as { fout: string }; throw new Error(d.fout || "Opslaan mislukt"); }
      return !!editDoel;
    },
    onSuccess: (wasEdit) => { addToast(wasEdit ? "Doel bijgewerkt" : "Doel aangemaakt", "succes"); setModalOpen(false); invalidateDoelen(); },
    onError: (error) => { addToast(error instanceof Error ? error.message : "Opslaan mislukt", "fout"); },
  });

  function handleOpslaan() {
    if (!formTitel.trim()) { addToast("Titel is verplicht", "fout"); return; }
    const validKrs = formKeyResults.filter((kr) => kr.titel.trim() && kr.doelwaarde > 0);
    if (validKrs.length === 0) { addToast("Voeg minimaal 1 key result toe", "fout"); return; }
    setOpslaan(true);
    opslaanMutation.mutate({
      titel: formTitel.trim(),
      omschrijving: formOmschrijving.trim() || undefined,
      eigenaarId: formEigenaarId || undefined,
      kwartaal, jaar,
      keyResults: validKrs.map((kr) => ({
        id: kr.id, titel: kr.titel, doelwaarde: kr.doelwaarde,
        huidigeWaarde: kr.huidigeWaarde || 0, eenheid: kr.eenheid,
        autoKoppeling: kr.autoKoppeling || "geen",
      })),
    }, { onSettled: () => setOpslaan(false) });
  }

  // Delete
  const verwijderMutation = useMutation({
    mutationFn: async (id: number) => { const res = await fetch(`/api/doelen/${id}`, { method: "DELETE" }); if (!res.ok) throw new Error("Verwijderen mislukt"); },
    onSuccess: () => { addToast("Doel verwijderd", "succes"); setVerwijderDoel(null); invalidateDoelen(); },
    onError: () => { addToast("Kon doel niet verwijderen", "fout"); },
  });

  // Inline KR update
  const krUpdateMutation = useMutation({
    mutationFn: async ({ doelId, krId, waarde }: { doelId: number; krId: number; waarde: number }) => {
      const res = await fetch(`/api/doelen/${doelId}/key-results/${krId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ huidigeWaarde: waarde }) });
      if (!res.ok) throw new Error("Update mislukt");
    },
    onSuccess: () => { addToast("Voortgang bijgewerkt", "succes"); setEditKrId(null); invalidateDoelen(); },
    onError: () => { addToast("Kon waarde niet bijwerken", "fout"); },
  });

  function handleKrUpdate(doelId: number, krId: number) {
    const waarde = Number(editKrWaarde);
    if (isNaN(waarde)) return;
    krUpdateMutation.mutate({ doelId, krId, waarde });
  }

  // Confidence update
  const confidenceUpdateMutation = useMutation({
    mutationFn: async ({ doelId, krId, confidence }: { doelId: number; krId: number; confidence: number }) => {
      const res = await fetch(`/api/doelen/${doelId}/key-results/${krId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confidence }) });
      if (!res.ok) throw new Error("Update mislukt");
    },
    onSuccess: () => { invalidateDoelen(); },
  });

  // Check-in
  function handleCheckIn() {
    if (!checkInDoelId) return;
    const doel = doelen.find((d) => d.id === checkInDoelId);
    createCheckIn.mutate({
      objectiveId: checkInDoelId,
      voortgang: checkInVoortgang,
      blocker: checkInBlocker || undefined,
      volgendeStap: checkInVolgendeStap || undefined,
    }, {
      onSuccess: () => {
        addToast("Check-in opgeslagen", "succes");
        setCheckInDoelId(null);
        setCheckInBlocker("");
        setCheckInVolgendeStap("");
        // Fetch AI samenvatting
        if (doel) {
          setCheckInSamenvattingTekst(null);
          checkInSamenvatting.mutate({
            doelTitel: doel.titel,
            voortgang: checkInVoortgang,
            vorigeVoortgang: doel.voortgang,
            wekenOver,
            blocker: checkInBlocker || undefined,
            volgendeStap: checkInVolgendeStap || undefined,
          }, { onSuccess: (tekst) => setCheckInSamenvattingTekst(tekst) });
        }
      },
      onError: () => { addToast("Check-in mislukt", "fout"); },
    });
  }

  // AI suggestions on title change
  const handleTitelBlur = useCallback(() => {
    if (formTitel.trim().length > 5 && !editDoel && formKeyResults.every((kr) => !kr.titel.trim())) {
      suggestMutation.mutate(formTitel.trim());
    }
  }, [formTitel, editDoel, formKeyResults, suggestMutation]);

  // Jaaroverzicht
  async function loadJaaroverzicht() {
    setJaaroverzichtOpen(true);
    setJaaroverzichtLoading(true);
    const data: Record<number, Doel[]> = {};
    for (let q = 1; q <= 4; q++) {
      try {
        const res = await fetch(`/api/doelen?kwartaal=${q}&jaar=${jaar}`);
        if (res.ok) { const json = await res.json() as { doelen: Doel[] }; data[q] = json.doelen; }
      } catch { data[q] = []; }
    }
    setJaaroverzichtData(data);
    setJaaroverzichtLoading(false);
  }

  function updateKr(index: number, field: keyof KeyResult, value: string | number | null) {
    setFormKeyResults((prev) => { const updated = [...prev]; updated[index] = { ...updated[index], [field]: value }; return updated; });
  }

  function removeKr(index: number) {
    setFormKeyResults((prev) => prev.filter((_, i) => i !== index));
  }

  if (loading) return <DoelenSkeleton />;

  const inputClasses = "w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";

  // Compute "what should I do this week"
  const weekActions: { doel: string; actie: string; prioriteit: "hoog" | "gemiddeld" | "laag" }[] = [];
  for (const doel of doelen) {
    if (doel.status !== "actief") continue;
    for (const kr of doel.keyResults) {
      const pct = kr.doelwaarde > 0 ? ((kr.huidigeWaarde ?? 0) / kr.doelwaarde) * 100 : 0;
      const status = trackStatus(pct, tijdPct);
      if (status.label === "Achter") {
        const gap = kr.doelwaarde - (kr.huidigeWaarde ?? 0);
        const perWeek = wekenOver > 0 ? gap / wekenOver : gap;
        weekActions.push({
          doel: doel.titel,
          actie: `${kr.titel}: nog ${formatKrWaarde(gap, kr.eenheid, kr.autoKoppeling)} nodig (${formatKrWaarde(perWeek, kr.eenheid, kr.autoKoppeling)}/week)`,
          prioriteit: "hoog",
        });
      } else if (status.label === "Risico" && pct < 80) {
        weekActions.push({
          doel: doel.titel,
          actie: `${kr.titel}: ${Math.round(pct)}% — focus om bij te trekken`,
          prioriteit: "gemiddeld",
        });
      }
    }
  }

  // Compute gemiddelde confidence
  const allKrs = doelen.flatMap((d) => d.keyResults);
  const gemConfidence = allKrs.length > 0 ? Math.round(allKrs.reduce((s, kr) => s + (kr.confidence ?? 70), 0) / allKrs.length) : 0;

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">Doelen (OKR)</h1>
            <p className="text-base text-autronis-text-secondary mt-1">Objectives & Key Results per kwartaal</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const tekst = `Autronis Q${kwartaal} ${jaar} voortgang: ${doelen.length} doelen, gem. ${doelen.length > 0 ? Math.round(doelen.reduce((s, d) => s + d.voortgang, 0) / doelen.length) : 0}%`;
                navigator.clipboard.writeText(tekst).then(() => addToast("Voortgang gekopieerd", "succes"));
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-autronis-text-secondary hover:text-autronis-text-primary bg-autronis-card border border-autronis-border rounded-xl transition-colors"
              title="Deel voortgang"
            >
              <Share2 className="w-4 h-4" />Deel
            </button>
            <button onClick={loadJaaroverzicht} className="px-4 py-2.5 text-sm font-medium text-autronis-text-secondary hover:text-autronis-text-primary bg-autronis-card border border-autronis-border rounded-xl transition-colors">Jaaroverzicht</button>
            <button onClick={openNieuw} className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20">
              <Plus className="w-4 h-4" />Nieuw doel
            </button>
          </div>
        </div>

        {/* Kwartaal + Jaar selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1">
            {[1, 2, 3, 4].map((q) => (
              <motion.button
                key={q}
                onClick={() => { setKwartaal(q); setReflectieTekst(null); }}
                className={cn("px-4 py-2 text-sm font-medium rounded-lg transition-colors relative", kwartaal === q ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary")}
                whileTap={{ scale: 0.95 }}
              >Q{q}</motion.button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setJaar(jaar - 1)} className="px-3 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary bg-autronis-card border border-autronis-border rounded-lg transition-colors">{jaar - 1}</button>
            <span className="px-4 py-2 text-sm font-bold text-autronis-bg bg-autronis-accent rounded-lg">{jaar}</span>
            <button onClick={() => setJaar(jaar + 1)} className="px-3 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary bg-autronis-card border border-autronis-border rounded-lg transition-colors">{jaar + 1}</button>
          </div>
          {doelen.length > 0 && (
            <button
              onClick={() => {
                setReflectieTekst(null);
                kwartaalReflectieMutation.mutate({ kwartaal, jaar }, { onSuccess: (t) => setReflectieTekst(t) });
              }}
              disabled={kwartaalReflectieMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-autronis-text-secondary hover:text-autronis-accent bg-autronis-card border border-autronis-border rounded-xl transition-colors disabled:opacity-50"
            >
              {kwartaalReflectieMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Reflectie
            </button>
          )}
        </div>

        {/* AI Kwartaalreflectie */}
        <AnimatePresence>
          {reflectieTekst && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="bg-autronis-card border border-autronis-accent/30 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-autronis-accent" />
                  <span className="text-sm font-semibold text-autronis-text-primary">Kwartaalreflectie Q{kwartaal} {jaar}</span>
                </div>
                <button onClick={() => setReflectieTekst(null)} className="p-1 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-sm text-autronis-text-secondary whitespace-pre-line">{reflectieTekst}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Check-in samenvatting */}
        <AnimatePresence>
          {checkInSamenvattingTekst && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="bg-autronis-card border border-green-500/30 rounded-2xl p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <p className="text-sm text-autronis-text-primary">{checkInSamenvattingTekst}</p>
              </div>
              <button onClick={() => setCheckInSamenvattingTekst(null)} className="p-1 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* === KWARTAAL SUMMARY with confidence === */}
        {doelen.length > 0 && (() => {
          const gemVoortgang = doelen.reduce((s, d) => s + d.voortgang, 0) / doelen.length;
          const opSchema = doelen.filter((d) => d.voortgang >= 70).length;
          const barKleur = gemVoortgang >= 70 ? "bg-green-500" : gemVoortgang >= 40 ? "bg-yellow-500" : "bg-red-500";
          const overallStatus = trackStatus(gemVoortgang, tijdPct);
          const StatusIcon = overallStatus.icon;
          return (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-autronis-text-primary">
                    Q{kwartaal} {jaar}: {opSchema}/{doelen.length} doelen op schema — Nog {wekenOver} weken
                  </span>
                  <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", overallStatus.bg, overallStatus.kleur)}>
                    <StatusIcon className="w-3 h-3" />
                    {overallStatus.label}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Shield className={cn("w-3.5 h-3.5", confidenceLabel(gemConfidence).kleur)} />
                    <span className={cn("font-semibold tabular-nums", confidenceLabel(gemConfidence).kleur)}>{gemConfidence}%</span>
                    <span className="text-autronis-text-secondary">confidence</span>
                  </div>
                  <span className={cn("text-sm font-bold tabular-nums", voortgangTekstKleur(gemVoortgang))}>{Math.round(gemVoortgang)}%</span>
                </div>
              </div>
              <div className="w-full h-2.5 bg-autronis-border rounded-full overflow-hidden">
                <motion.div className={cn("h-full rounded-full", barKleur)} initial={{ width: "0%" }} animate={{ width: `${gemVoortgang}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
              </div>
            </div>
          );
        })()}

        {/* === NEXT ACTION BLOCK: "Wat moet ik deze week doen?" === */}
        {weekActions.length > 0 && (
          <div className="bg-autronis-card border border-autronis-accent/30 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-autronis-accent/10 rounded-xl"><ArrowRight className="w-4 h-4 text-autronis-accent" /></div>
              <h2 className="text-base font-semibold text-autronis-text-primary">Wat moet ik deze week doen?</h2>
            </div>
            <div className="space-y-2">
              {weekActions.slice(0, 5).map((wa, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-autronis-bg/50">
                  <div className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase mt-0.5 flex-shrink-0", wa.prioriteit === "hoog" ? "bg-red-500/15 text-red-400" : "bg-yellow-500/15 text-yellow-400")}>{wa.prioriteit}</div>
                  <div className="min-w-0">
                    <p className="text-sm text-autronis-text-primary">{wa.actie}</p>
                    <p className="text-xs text-autronis-text-secondary">{wa.doel}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === EMPTY STATE with example OKR + templates === */}
        {doelen.length === 0 ? (
          <div className="space-y-6">
            {/* Example OKR */}
            <div className="bg-autronis-card border border-dashed border-autronis-accent/40 rounded-2xl p-6 lg:p-7">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-autronis-accent" />
                <h3 className="text-base font-semibold text-autronis-text-primary">Voorbeeld OKR</h3>
                <span className="text-xs text-autronis-text-secondary ml-auto">klik op een template hieronder om te starten</span>
              </div>
              <div className="bg-autronis-bg/50 rounded-xl p-5 mb-4">
                <h4 className="text-lg font-bold text-autronis-text-primary mb-1">Autronis omzet verdubbelen</h4>
                <p className="text-sm text-autronis-text-secondary mb-4">Waarom: Financiële stabiliteit en groei richting €120K jaaromzet</p>
                <div className="space-y-3">
                  {[
                    { kr: "KR1: €10.000 omzet per maand", pct: 65, waarde: "€6.500 / €10.000" },
                    { kr: "KR2: 3 nieuwe klanten per kwartaal", pct: 33, waarde: "1 / 3" },
                    { kr: "KR3: Pipeline waarde > €25.000", pct: 80, waarde: "€20.000 / €25.000" },
                  ].map((item) => (
                    <div key={item.kr} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-autronis-text-primary">{item.kr}</span>
                        <span className="text-xs text-autronis-text-secondary tabular-nums">{item.waarde}</span>
                      </div>
                      <div className="w-full h-2 bg-autronis-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, backgroundColor: voortgangKleur(item.pct) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick templates */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {OKR_TEMPLATES.map((tpl) => (
                  <motion.button
                    key={tpl.titel}
                    onClick={() => {
                      setEditDoel(null);
                      setFormTitel(tpl.titel);
                      setFormOmschrijving(tpl.omschrijving);
                      setFormKeyResults(tpl.keyResults.map((kr) => ({ ...kr })));
                      setModalOpen(true);
                    }}
                    whileHover={{ y: -3 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className={cn("text-left p-4 rounded-xl border-l-4 border border-autronis-border bg-autronis-bg/30 transition-colors group", tpl.bg)}
                    style={{ borderLeftColor: tpl.kleur }}
                  >
                    <span className="text-sm font-semibold text-autronis-text-primary transition-colors block">{tpl.titel}</span>
                    <span className="text-[11px] text-autronis-text-secondary mt-1 block">{tpl.keyResults.length} key results</span>
                  </motion.button>
                ))}
              </div>
            </div>

            <EmptyState
              titel="Geen doelen voor dit kwartaal"
              beschrijving={`Gebruik een template hierboven of maak een eigen OKR voor Q${kwartaal} ${jaar}`}
              actieLabel="Nieuw doel"
              onActie={openNieuw}
              icoon={<Target className="h-7 w-7 text-autronis-text-secondary" />}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {doelen.map((doel, doelIndex) => {
              const eigenaar = gebruikers.find((g) => g.id === doel.eigenaarId);
              const isExpanded = expandedGoal === doel.id;
              const doelConfidence = doel.keyResults.length > 0
                ? Math.round(doel.keyResults.reduce((s, kr) => s + (kr.confidence ?? 70), 0) / doel.keyResults.length)
                : 0;
              const doelStatus = trackStatus(doel.voortgang, tijdPct);
              const DoelStatusIcon = doelStatus.icon;

              const glowKleur = doelStatus.label === "Op schema" ? "rgba(34,197,94,0.15)" : doelStatus.label === "Risico" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";

              return (
                <motion.div
                  key={doel.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: doelIndex * 0.05 }}
                  className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow"
                  style={{ boxShadow: `0 0 0 1px transparent, inset 0 0 40px ${glowKleur}` }}
                >
                  {/* Objective header */}
                  <div className="flex items-start gap-5 mb-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="text-xl font-bold text-autronis-text-primary">{doel.titel}</h3>
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", statusBadgeKleur(doel.status))}>
                          {doel.status === "actief" ? "Actief" : doel.status === "afgerond" ? "Afgerond" : "Geannuleerd"}
                        </span>
                        <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium", doelStatus.bg, doelStatus.kleur)}>
                          <DoelStatusIcon className="w-3 h-3" />{doelStatus.label}
                        </span>
                        {eigenaar && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-autronis-border text-autronis-text-secondary">
                            <User className="w-3 h-3" />{eigenaar.naam}
                          </span>
                        )}
                      </div>
                      {doel.omschrijving && <p className="text-sm text-autronis-text-secondary mb-2">{doel.omschrijving}</p>}
                      <div className="flex items-center gap-3 text-xs text-autronis-text-secondary">
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />Nog {wekenOver} weken</span>
                        <span className="inline-flex items-center gap-1">
                          <Shield className={cn("w-3 h-3", confidenceLabel(doelConfidence).kleur)} />
                          <span className={confidenceLabel(doelConfidence).kleur}>{doelConfidence}%</span> confidence
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openBewerken(doel)} className="p-1.5 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors" title="Bewerken"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setVerwijderDoel(doel)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-autronis-text-secondary hover:text-red-400 transition-colors" title="Verwijderen"><Trash2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setCheckInDoelId(doel.id); setCheckInVoortgang(doel.voortgang); }} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-autronis-text-secondary hover:text-blue-400 transition-colors" title="Check-in"><MessageSquare className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setExpandedGoal(isExpanded ? null : doel.id)} className="p-1.5 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors" title="Details">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 relative">
                      <ProgressRing key={`${doel.id}-${kwartaal}-${jaar}`} percentage={doel.voortgang} size={88} strokeWidth={7} color={voortgangKleur(doel.voortgang)} />
                      {doelStatus.label === "Op schema" && (
                        <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ boxShadow: "0 0 0 4px #22c55e" }} />
                      )}
                    </div>
                  </div>

                  {/* Key Results */}
                  <div className="space-y-4">
                    {doel.keyResults.map((kr, krIndex) => {
                      const pct = kr.doelwaarde > 0 ? Math.min(((kr.huidigeWaarde ?? 0) / kr.doelwaarde) * 100, 100) : 0;
                      const isAuto = kr.autoKoppeling && kr.autoKoppeling !== "geen";
                      const isEditing = editKrId === kr.id;
                      const krStatus = trackStatus(pct, tijdPct);
                      const conf = kr.confidence ?? 70;
                      const confKleur = conf >= 67 ? "#22c55e" : conf >= 34 ? "#f59e0b" : "#ef4444";

                      const krNavRoute = kr.autoKoppeling === "omzet" ? "/financien" : kr.autoKoppeling === "uren" ? "/tijd" : kr.autoKoppeling === "klanten" ? "/klanten" : null;

                      return (
                        <motion.div
                          key={kr.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: krIndex * 0.06, duration: 0.3 }}
                          className="bg-autronis-bg/50 rounded-xl p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {krNavRoute ? (
                                <button
                                  onClick={() => router.push(krNavRoute)}
                                  className="text-sm font-medium text-autronis-text-primary hover:text-autronis-accent transition-colors truncate text-left"
                                  title={`Ga naar ${autoKoppelingLabel(kr.autoKoppeling)}`}
                                >
                                  {kr.titel}
                                </button>
                              ) : (
                                <span className="text-sm font-medium text-autronis-text-primary truncate">{kr.titel}</span>
                              )}
                              {isAuto && (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-autronis-accent/20 text-autronis-accent border border-autronis-accent/30 flex-shrink-0 cursor-help"
                                  title="Automatisch bijgewerkt uit live data"
                                >
                                  <Zap className="w-3 h-3" />Auto: {autoKoppelingLabel(kr.autoKoppeling)}
                                </span>
                              )}
                              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", krStatus.bg, krStatus.kleur)}>{krStatus.label}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Confidence color dot + selector */}
                              <span title={`Confidence: ${conf >= 67 ? "Hoog" : conf >= 34 ? "Gemiddeld" : "Laag"}`}>
                                <select
                                  value={conf}
                                  onChange={(e) => kr.id && confidenceUpdateMutation.mutate({ doelId: doel.id, krId: kr.id, confidence: Number(e.target.value) })}
                                  className="bg-transparent border-none text-[10px] cursor-pointer p-0 focus:ring-0 w-auto font-semibold"
                                  style={{ color: confKleur }}
                                >
                                  {[90, 70, 50, 30, 10].map((v) => (
                                    <option key={v} value={v}>{v}%</option>
                                  ))}
                                </select>
                              </span>
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <input type="number" value={editKrWaarde} onChange={(e) => setEditKrWaarde(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && kr.id) handleKrUpdate(doel.id, kr.id); if (e.key === "Escape") setEditKrId(null); }}
                                    className="w-20 bg-autronis-bg border border-autronis-accent rounded-lg px-2 py-1 text-xs text-autronis-text-primary focus:outline-none" autoFocus />
                                  <button onClick={() => kr.id && handleKrUpdate(doel.id, kr.id)} className="text-xs text-autronis-accent hover:text-autronis-accent-hover">OK</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { if (!isAuto && kr.id) { setEditKrId(kr.id); setEditKrWaarde(String(kr.huidigeWaarde ?? 0)); } }}
                                  disabled={!!isAuto}
                                  className={cn("text-sm tabular-nums", isAuto ? "text-autronis-text-secondary cursor-default" : "text-autronis-text-primary hover:text-autronis-accent cursor-pointer")}
                                >
                                  {formatKrWaarde(kr.huidigeWaarde ?? 0, kr.eenheid, kr.autoKoppeling)}
                                  <span className="text-autronis-text-secondary mx-1">/</span>
                                  {formatKrWaarde(kr.doelwaarde, kr.eenheid, kr.autoKoppeling)}
                                </button>
                              )}
                              <span className={cn("text-xs font-semibold tabular-nums min-w-[40px] text-right", voortgangTekstKleur(pct))}>{Math.round(pct)}%</span>
                            </div>
                          </div>
                          {/* Progress bar with time indicator */}
                          <div className="relative w-full h-2 bg-autronis-border rounded-full overflow-visible">
                            <motion.div
                              key={`${kr.id}-${kwartaal}-${jaar}`}
                              className="h-full rounded-full"
                              style={{ backgroundColor: voortgangKleur(pct) }}
                              initial={{ width: "0%" }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: "easeOut", delay: krIndex * 0.06 }}
                            />
                            {/* Time indicator line */}
                            {tijdPct > 0 && tijdPct < 100 && (
                              <div
                                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/40 rounded-full"
                                style={{ left: `${tijdPct}%` }}
                                title={`Tijd: ${tijdPct}%`}
                              />
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* === EXPANDED: Check-in history === */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-5 pt-5 border-t border-autronis-border">
                          <h4 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-400" />Recente check-ins
                          </h4>
                          {checkIns && checkIns.length > 0 ? (
                            <div className="space-y-2">
                              {checkIns.slice(0, 3).map((ci) => (
                                <div key={ci.id} className="p-3 rounded-xl bg-autronis-bg/50 text-sm">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-autronis-text-secondary">Week {ci.week}</span>
                                    <span className={cn("text-xs font-semibold tabular-nums", voortgangTekstKleur(ci.voortgang))}>{ci.voortgang}%</span>
                                  </div>
                                  {ci.blocker && <p className="text-xs text-red-400">Blocker: {ci.blocker}</p>}
                                  {ci.volgendeStap && <p className="text-xs text-autronis-accent">Volgende: {ci.volgendeStap}</p>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-autronis-text-secondary">Nog geen check-ins. Klik op het chat-icoon om een check-in te doen.</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ---- Check-in Modal ---- */}
        <Modal open={!!checkInDoelId} onClose={() => setCheckInDoelId(null)} titel="Wekelijkse check-in" breedte="sm"
          footer={<>
            <button onClick={() => setCheckInDoelId(null)} className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">Annuleren</button>
            <button onClick={handleCheckIn} disabled={createCheckIn.isPending} className="px-5 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
              {createCheckIn.isPending ? "Opslaan..." : "Check-in opslaan"}
            </button>
          </>}
        >
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-autronis-text-secondary">Voortgang</label>
                <span className={cn("text-lg font-bold tabular-nums", voortgangTekstKleur(checkInVoortgang))}>{checkInVoortgang}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={checkInVoortgang}
                onChange={(e) => setCheckInVoortgang(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: voortgangKleur(checkInVoortgang) }}
              />
              <div className="flex justify-between text-[10px] text-autronis-text-secondary">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">Blocker (optioneel)</label>
              <input type="text" value={checkInBlocker} onChange={(e) => setCheckInBlocker(e.target.value)} placeholder="Wat houdt je tegen?" className={inputClasses} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">Volgende stap</label>
              <input type="text" value={checkInVolgendeStap} onChange={(e) => setCheckInVolgendeStap(e.target.value)} placeholder="Wat ga ik deze week doen?" className={inputClasses} />
            </div>
          </div>
        </Modal>

        {/* ---- New/Edit Modal ---- */}
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} titel={editDoel ? "Doel bewerken" : "Nieuw doel"} breedte="lg"
          footer={<>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">Annuleren</button>
            <button onClick={handleOpslaan} disabled={opslaan} className="px-5 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-autronis-accent/20">
              {opslaan ? "Opslaan..." : editDoel ? "Bijwerken" : "Aanmaken"}
            </button>
          </>}
        >
          <div className="space-y-5">
            {/* Templates */}
            {!editDoel && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-autronis-text-secondary"><Lightbulb className="w-4 h-4 text-autronis-accent" />Templates</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OKR_TEMPLATES.map((tpl) => (
                    <button key={tpl.titel} type="button"
                      onClick={() => { setFormTitel(tpl.titel); setFormOmschrijving(tpl.omschrijving); setFormKeyResults(tpl.keyResults.map((kr) => ({ ...kr }))); }}
                      className={cn("text-left p-3 rounded-xl border-l-4 border border-autronis-border bg-autronis-bg/50 transition-colors", tpl.bg)}
                      style={{ borderLeftColor: tpl.kleur }}
                    >
                      <span className="text-sm font-medium text-autronis-text-primary">{tpl.titel}</span>
                      <span className="block text-[11px] text-autronis-text-secondary mt-0.5">{tpl.keyResults.length} key results</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">Titel *</label>
              <input type="text" value={formTitel} onChange={(e) => setFormTitel(e.target.value)} onBlur={handleTitelBlur} placeholder="Bijv. Meer klanten binnenhalen" className={inputClasses} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">Waarom dit doel? (omschrijving)</label>
              <textarea value={formOmschrijving} onChange={(e) => setFormOmschrijving(e.target.value)} placeholder="Wat is het doel hiervan? Waarom is dit belangrijk?" rows={2} className={cn(inputClasses, "resize-none")} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">Eigenaar</label>
              <select value={formEigenaarId} onChange={(e) => setFormEigenaarId(e.target.value ? Number(e.target.value) : "")} className={cn(inputClasses, "cursor-pointer")}>
                <option value="">Geen eigenaar</option>
                {gebruikers.map((g) => <option key={g.id} value={g.id}>{g.naam}</option>)}
              </select>
            </div>

            {/* AI Suggestions */}
            {suggestMutation.data && suggestMutation.data.length > 0 && !editDoel && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-autronis-text-secondary">
                  <Sparkles className="w-4 h-4 text-autronis-accent" />Voorgestelde Key Results
                </label>
                <div className="flex flex-wrap gap-2">
                  {suggestMutation.data.map((sug, i) => (
                    <button key={i} type="button"
                      onClick={() => setFormKeyResults((prev) => {
                        const empty = prev.findIndex((kr) => !kr.titel.trim());
                        if (empty >= 0) {
                          const updated = [...prev];
                          updated[empty] = { titel: sug.titel, doelwaarde: sug.doelwaarde, huidigeWaarde: 0, eenheid: sug.eenheid, autoKoppeling: sug.autoKoppeling };
                          return updated;
                        }
                        return [...prev, { titel: sug.titel, doelwaarde: sug.doelwaarde, huidigeWaarde: 0, eenheid: sug.eenheid, autoKoppeling: sug.autoKoppeling }];
                      })}
                      className="text-xs px-3 py-1.5 rounded-lg border border-autronis-accent/30 text-autronis-accent hover:bg-autronis-accent/10 transition-colors"
                    >+ {sug.titel}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Key Results */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-autronis-text-secondary">Key Results (meetbare uitkomsten)</label>
                <button onClick={() => setFormKeyResults((prev) => [...prev, emptyKr()])} className="text-xs text-autronis-accent hover:text-autronis-accent-hover transition-colors">+ Key result toevoegen</button>
              </div>
              <div className="space-y-3">
                {formKeyResults.map((kr, i) => (
                  <div key={i} className="bg-autronis-bg rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-autronis-accent w-5">KR{i + 1}</span>
                      <input type="text" value={kr.titel} onChange={(e) => updateKr(i, "titel", e.target.value)} placeholder="Meetbaar resultaat" className={cn(inputClasses, "flex-1")} />
                      {formKeyResults.length > 1 && (
                        <button onClick={() => removeKr(i)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-autronis-text-secondary hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[11px] text-autronis-text-secondary">Doelwaarde</label>
                        <input type="number" value={kr.doelwaarde || ""} onChange={(e) => updateKr(i, "doelwaarde", Number(e.target.value))} placeholder="0" className={inputClasses} />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] text-autronis-text-secondary">Eenheid</label>
                        <input type="text" value={kr.eenheid || ""} onChange={(e) => updateKr(i, "eenheid", e.target.value || null)} placeholder="euro, uren, stuks..." className={inputClasses} />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] text-autronis-text-secondary">Auto-koppeling</label>
                        <select value={kr.autoKoppeling || "geen"} onChange={(e) => updateKr(i, "autoKoppeling", e.target.value)} className={cn(inputClasses, "cursor-pointer")}>
                          <option value="geen">Geen (handmatig)</option>
                          <option value="omzet">Omzet (facturen)</option>
                          <option value="uren">Uren (tijdreg.)</option>
                          <option value="taken">Taken (afgerond)</option>
                          <option value="klanten">Klanten (nieuw)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>

        {/* Delete confirm */}
        <ConfirmDialog open={!!verwijderDoel} onClose={() => setVerwijderDoel(null)} onBevestig={() => verwijderDoel && verwijderMutation.mutate(verwijderDoel.id)} titel="Doel verwijderen"
          bericht={`Weet je zeker dat je "${verwijderDoel?.titel}" wilt verwijderen? Alle key results worden ook verwijderd.`} bevestigTekst="Verwijderen" variant="danger" />

        {/* Jaaroverzicht Modal */}
        <Modal open={jaaroverzichtOpen} onClose={() => setJaaroverzichtOpen(false)} titel={`Jaaroverzicht ${jaar}`} breedte="lg">
          {jaaroverzichtLoading ? (
            <div className="space-y-4"><Skeleton className="h-32 w-full rounded-xl" /><Skeleton className="h-32 w-full rounded-xl" /></div>
          ) : (() => {
            const kwartaalGemiddelden = [1, 2, 3, 4].map((q) => {
              const qd = jaaroverzichtData[q] || [];
              return qd.length > 0 ? qd.reduce((s, d) => s + d.voortgang, 0) / qd.length : 0;
            });
            const alleDoelen = Object.values(jaaroverzichtData).flat();
            const jaarGem = alleDoelen.length > 0 ? alleDoelen.reduce((s, d) => s + d.voortgang, 0) / alleDoelen.length : 0;
            return (
              <div className="space-y-5">
                <div className="bg-autronis-bg/50 rounded-xl p-4 border border-autronis-border text-center">
                  <p className="text-xs text-autronis-text-secondary mb-1">Jaargemiddelde {jaar}</p>
                  <span className={cn("text-2xl font-bold tabular-nums", voortgangTekstKleur(jaarGem))}>{Math.round(jaarGem)}%</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((q, qi) => {
                    const qDoelen = jaaroverzichtData[q] || [];
                    const avg = kwartaalGemiddelden[qi];
                    const prevAvg = qi > 0 ? kwartaalGemiddelden[qi - 1] : null;
                    const isCurrent = q === currentQuarter && jaar === new Date().getFullYear();
                    return (
                      <button key={q} onClick={() => { setKwartaal(q); setJaaroverzichtOpen(false); }}
                        className={cn("rounded-xl p-4 border text-center transition-colors hover:border-autronis-accent/40", isCurrent ? "border-autronis-accent/50 bg-autronis-accent/5" : "border-autronis-border bg-autronis-bg/50")}
                      >
                        <span className={cn("text-sm font-bold block mb-3", isCurrent ? "text-autronis-accent" : "text-autronis-text-primary")}>Q{q}</span>
                        <div className="flex justify-center mb-3"><ProgressRing percentage={avg} size={56} strokeWidth={5} color={voortgangKleur(avg)} /></div>
                        <p className="text-xs text-autronis-text-secondary mb-1">{qDoelen.length} {qDoelen.length === 1 ? "doel" : "doelen"}</p>
                        {prevAvg !== null && qDoelen.length > 0 && (
                          <div className="flex items-center justify-center gap-1">
                            {avg > prevAvg ? <TrendingUp className="w-3 h-3 text-green-400" /> : avg < prevAvg ? <TrendingDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-autronis-text-secondary" />}
                            <span className={cn("text-[10px] font-medium tabular-nums", avg > prevAvg ? "text-green-400" : avg < prevAvg ? "text-red-400" : "text-autronis-text-secondary")}>
                              {avg > prevAvg ? "+" : ""}{Math.round(avg - prevAvg)}%
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </Modal>
      </div>
    </PageTransition>
  );
}
