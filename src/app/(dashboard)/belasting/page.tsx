"use client";

import { useState, useCallback } from "react";
import {
  Receipt,
  CreditCard,
  TrendingDown,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Landmark,
  Building2,
  Send,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Timer,
  TrendingUp,
  PiggyBank,
  FileBarChart,
  Package,
  Plus,
  Pencil,
  Trash2,
  Download,
  History,
} from "lucide-react";
import { cn, formatBedrag, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useBelasting,
  useWinstVerlies,
  useInvesteringen,
  useCreateInvestering,
  useDeleteInvestering,
  useUpdateInvestering,
  useReserveringen,
  useCreateReservering,
  useVoorlopigeAanslagen,
  useCreateVoorlopigeAanslag,
  useUpdateVoorlopigeAanslag,
  useJaaroverzicht,
  useAuditLog,
  type Deadline,
  type BtwAangifte,
  type Investering,
} from "@/hooks/queries/use-belasting";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonKPI } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ============ CONSTANTS ============

type TabId = "overzicht" | "btw" | "winst-verlies" | "investeringen" | "reserveringen" | "jaaroverzicht";

const tabs: { id: TabId; label: string; icon: typeof Receipt }[] = [
  { id: "overzicht", label: "Overzicht", icon: FileBarChart },
  { id: "btw", label: "BTW", icon: Receipt },
  { id: "winst-verlies", label: "Winst & Verlies", icon: TrendingUp },
  { id: "investeringen", label: "Investeringen", icon: Package },
  { id: "reserveringen", label: "Reserveringen", icon: PiggyBank },
  { id: "jaaroverzicht", label: "Jaaroverzicht", icon: FileBarChart },
];

const typeConfig: Record<string, { icon: typeof Receipt; color: string; label: string }> = {
  btw: { icon: Receipt, color: "text-blue-400", label: "BTW" },
  inkomstenbelasting: { icon: Landmark, color: "text-purple-400", label: "Inkomstenbelasting" },
  icp: { icon: Send, color: "text-cyan-400", label: "ICP" },
  kvk_publicatie: { icon: Building2, color: "text-amber-400", label: "KvK" },
};

const btwStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Open" },
  ingediend: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Ingediend" },
  betaald: { bg: "bg-green-500/15", text: "text-green-400", label: "Betaald" },
};

const investeringCategorieen = [
  "Hardware",
  "Software",
  "Meubilair",
  "Voertuig",
  "Gereedschap",
  "Overig",
];

const reserveringTypes = [
  "Belastingreservering",
  "BTW-reservering",
  "Pensioen",
  "Overig",
];

const aanslagTypes = [
  "Inkomstenbelasting",
  "Zorgverzekeringswet",
  "Inkomensafhankelijke bijdrage",
];

const aanslagStatusConfig: Record<string, { bg: string; text: string }> = {
  open: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  betaald: { bg: "bg-green-500/15", text: "text-green-400" },
  deels_betaald: { bg: "bg-blue-500/15", text: "text-blue-400" },
};

// ============ COMPONENT ============

export default function BelastingPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [jaar, setJaar] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<TabId>("overzicht");

  // Collapsible sections (overzicht tab)
  const [deadlinesOpen, setDeadlinesOpen] = useState(true);
  const [urenOpen, setUrenOpen] = useState(true);

  // Modals
  const [investeringModal, setInvesteringModal] = useState(false);
  const [editInvestering, setEditInvestering] = useState<Investering | null>(null);
  const [deleteInvesteringId, setDeleteInvesteringId] = useState<number | null>(null);
  const [reserveringModal, setReserveringModal] = useState(false);
  const [aanslagModal, setAanslagModal] = useState(false);

  // Form state — investering
  const [invForm, setInvForm] = useState({
    naam: "",
    bedrag: "",
    datum: new Date().toISOString().slice(0, 10),
    categorie: "Hardware",
    afschrijvingstermijn: 5,
    restwaarde: "0",
    notities: "",
  });

  // Form state — reservering
  const [resForm, setResForm] = useState({
    maand: new Date().toISOString().slice(0, 7),
    bedrag: "",
    type: "Belastingreservering",
    notities: "",
  });

  // Form state — voorlopige aanslag
  const [aanslagForm, setAanslagForm] = useState({
    jaar: new Date().getFullYear(),
    type: "Inkomstenbelasting",
    bedrag: "",
    betaaldBedrag: "0",
    status: "open",
    vervaldatum: "",
    notities: "",
  });

  // ---- DATA HOOKS ----

  const { data: belastingData, isLoading: loadingBelasting } = useBelasting(jaar);
  const deadlines = belastingData?.deadlines ?? [];
  const aangiftes = belastingData?.aangiftes ?? [];
  const urenCriterium = belastingData?.urenCriterium ?? null;

  const { data: wvData, isLoading: loadingWV } = useWinstVerlies(jaar);
  const { data: investeringenData, isLoading: loadingInv } = useInvesteringen();
  const { data: reserveringenData, isLoading: loadingRes } = useReserveringen(jaar);
  const { data: aanslagenData, isLoading: loadingAanslagen } = useVoorlopigeAanslagen(jaar);
  const { data: jaaroverzichtData, isLoading: loadingJaar } = useJaaroverzicht(jaar);
  const { data: auditLogData } = useAuditLog();

  // ---- MUTATIONS ----

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/belasting/seed", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.fout ?? "Fout bij seeden");
      return d.bericht ?? "Gegevens aangemaakt";
    },
    onSuccess: (bericht: string) => {
      addToast(bericht, "succes");
      queryClient.invalidateQueries({ queryKey: ["belasting"] });
    },
    onError: (err: Error) => {
      addToast(err.message ?? "Kon gegevens niet aanmaken", "fout");
    },
  });

  const toggleDeadlineMutation = useMutation({
    mutationFn: async (deadline: Deadline) => {
      const nieuweStatus = deadline.afgerond ? 0 : 1;
      const res = await fetch(`/api/belasting/deadlines/${deadline.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ afgerond: nieuweStatus }),
      });
      if (!res.ok) throw new Error();
      return nieuweStatus;
    },
    onSuccess: (nieuweStatus: number) => {
      addToast(nieuweStatus ? "Deadline afgerond" : "Deadline heropend", "succes");
      queryClient.invalidateQueries({ queryKey: ["belasting"] });
    },
    onError: () => {
      addToast("Kon deadline niet bijwerken", "fout");
    },
  });

  const btwStatusMutation = useMutation({
    mutationFn: async ({ aangifte, nieuweStatus }: { aangifte: BtwAangifte; nieuweStatus: "ingediend" | "betaald" }) => {
      const res = await fetch(`/api/belasting/btw/${aangifte.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nieuweStatus }),
      });
      if (!res.ok) throw new Error();
      return { kwartaal: aangifte.kwartaal, nieuweStatus };
    },
    onSuccess: ({ kwartaal, nieuweStatus }: { kwartaal: number; nieuweStatus: string }) => {
      addToast(`Q${kwartaal} gemarkeerd als ${nieuweStatus}`, "succes");
      queryClient.invalidateQueries({ queryKey: ["belasting"] });
    },
    onError: () => {
      addToast("Kon status niet bijwerken", "fout");
    },
  });

  const createInvMutation = useCreateInvestering();
  const updateInvMutation = useUpdateInvestering();
  const deleteInvMutation = useDeleteInvestering();
  const createResMutation = useCreateReservering();
  const createAanslagMutation = useCreateVoorlopigeAanslag();
  const updateAanslagMutation = useUpdateVoorlopigeAanslag();

  const seeding = seedMutation.isPending;

  // ---- HANDLERS ----

  const handleSeed = () => seedMutation.mutate();
  const handleToggleDeadline = (deadline: Deadline) => toggleDeadlineMutation.mutate(deadline);
  const handleBtwStatus = (aangifte: BtwAangifte, nieuweStatus: "ingediend" | "betaald") =>
    btwStatusMutation.mutate({ aangifte, nieuweStatus });

  const resetInvForm = useCallback(() => {
    setInvForm({
      naam: "",
      bedrag: "",
      datum: new Date().toISOString().slice(0, 10),
      categorie: "Hardware",
      afschrijvingstermijn: 5,
      restwaarde: "0",
      notities: "",
    });
    setEditInvestering(null);
  }, []);

  const handleOpenEditInvestering = useCallback((inv: Investering) => {
    setEditInvestering(inv);
    setInvForm({
      naam: inv.naam,
      bedrag: String(inv.bedrag),
      datum: inv.datum.slice(0, 10),
      categorie: inv.categorie,
      afschrijvingstermijn: inv.afschrijvingstermijn,
      restwaarde: String(inv.restwaarde),
      notities: inv.notities ?? "",
    });
    setInvesteringModal(true);
  }, []);

  const handleSaveInvestering = useCallback(() => {
    const bedrag = parseFloat(invForm.bedrag);
    const restwaarde = parseFloat(invForm.restwaarde) || 0;
    if (!invForm.naam || isNaN(bedrag) || bedrag <= 0) {
      addToast("Vul een naam en geldig bedrag in", "fout");
      return;
    }
    const payload = {
      naam: invForm.naam,
      bedrag,
      datum: invForm.datum,
      categorie: invForm.categorie,
      afschrijvingstermijn: invForm.afschrijvingstermijn,
      restwaarde,
      notities: invForm.notities || null,
    };

    if (editInvestering) {
      updateInvMutation.mutate(
        { id: editInvestering.id, ...payload },
        {
          onSuccess: () => {
            addToast("Investering bijgewerkt", "succes");
            setInvesteringModal(false);
            resetInvForm();
          },
          onError: (err) => addToast(err.message, "fout"),
        }
      );
    } else {
      createInvMutation.mutate(payload, {
        onSuccess: () => {
          addToast("Investering aangemaakt", "succes");
          setInvesteringModal(false);
          resetInvForm();
        },
        onError: (err) => addToast(err.message, "fout"),
      });
    }
  }, [invForm, editInvestering, createInvMutation, updateInvMutation, addToast, resetInvForm]);

  const handleDeleteInvestering = useCallback(() => {
    if (deleteInvesteringId === null) return;
    deleteInvMutation.mutate(deleteInvesteringId, {
      onSuccess: () => addToast("Investering verwijderd", "succes"),
      onError: (err) => addToast(err.message, "fout"),
    });
    setDeleteInvesteringId(null);
  }, [deleteInvesteringId, deleteInvMutation, addToast]);

  const handleSaveReservering = useCallback(() => {
    const bedrag = parseFloat(resForm.bedrag);
    if (isNaN(bedrag) || bedrag <= 0) {
      addToast("Vul een geldig bedrag in", "fout");
      return;
    }
    createResMutation.mutate(
      {
        maand: resForm.maand,
        bedrag,
        type: resForm.type,
        notities: resForm.notities || null,
      },
      {
        onSuccess: () => {
          addToast("Reservering toegevoegd", "succes");
          setReserveringModal(false);
          setResForm({ maand: new Date().toISOString().slice(0, 7), bedrag: "", type: "Belastingreservering", notities: "" });
        },
        onError: (err) => addToast(err.message, "fout"),
      }
    );
  }, [resForm, createResMutation, addToast]);

  const handleSaveAanslag = useCallback(() => {
    const bedrag = parseFloat(aanslagForm.bedrag);
    const betaaldBedrag = parseFloat(aanslagForm.betaaldBedrag) || 0;
    if (isNaN(bedrag) || bedrag <= 0) {
      addToast("Vul een geldig bedrag in", "fout");
      return;
    }
    createAanslagMutation.mutate(
      {
        jaar: aanslagForm.jaar,
        type: aanslagForm.type,
        bedrag,
        betaaldBedrag,
        status: aanslagForm.status,
        vervaldatum: aanslagForm.vervaldatum || null,
        notities: aanslagForm.notities || null,
      },
      {
        onSuccess: () => {
          addToast("Voorlopige aanslag toegevoegd", "succes");
          setAanslagModal(false);
          setAanslagForm({ jaar: new Date().getFullYear(), type: "Inkomstenbelasting", bedrag: "", betaaldBedrag: "0", status: "open", vervaldatum: "", notities: "" });
        },
        onError: (err) => addToast(err.message, "fout"),
      }
    );
  }, [aanslagForm, createAanslagMutation, addToast]);

  const handleMarkAanslagBetaald = useCallback((id: number, bedrag: number) => {
    updateAanslagMutation.mutate(
      { id, betaaldBedrag: bedrag, status: "betaald" },
      {
        onSuccess: () => addToast("Aanslag gemarkeerd als betaald", "succes"),
        onError: (err) => addToast(err.message, "fout"),
      }
    );
  }, [updateAanslagMutation, addToast]);

  // ---- COMPUTED VALUES ----

  const nu = new Date();
  const currentQuarter = Math.ceil((nu.getMonth() + 1) / 3);
  const currentQAangifte = aangiftes.find((a) => a.kwartaal === currentQuarter);
  const btwOntvangen = currentQAangifte?.btwOntvangen ?? 0;
  const btwBetaald = currentQAangifte?.btwBetaald ?? 0;
  const nettoAfdragen = btwOntvangen - btwBetaald;

  const openDeadlines = deadlines
    .filter((d) => !d.afgerond)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const volgendeDeadline = openDeadlines[0];
  const dagenTotDeadline = volgendeDeadline
    ? Math.ceil((new Date(volgendeDeadline.datum).getTime() - nu.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const urgentDeadlines = openDeadlines.filter((d) => {
    const dagen = Math.ceil((new Date(d.datum).getTime() - nu.getTime()) / (1000 * 60 * 60 * 24));
    return dagen < 7;
  });

  const noData = deadlines.length === 0 && aangiftes.length === 0;

  // KIA calculation helper
  const berekenKIA = (totaalInvestering: number): number => {
    if (totaalInvestering < 2801) return 0;
    if (totaalInvestering <= 58238) return Math.round(totaalInvestering * 0.28);
    if (totaalInvestering <= 110998) return 16307;
    if (totaalInvestering <= 373030) return Math.max(0, 16307 - Math.round((totaalInvestering - 110998) * 0.0758));
    return 0;
  };

  // ---- LOADING STATE ----

  if (loadingBelasting) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        <div className="h-10 w-48 bg-autronis-card rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonKPI key={i} />
          ))}
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-autronis-bg/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ---- RENDER ----

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">
              Belasting & Compliance
            </h1>
            <p className="text-base text-autronis-text-secondary mt-1">
              BTW, belasting, investeringen en reserveringen
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Year selector */}
            <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl">
              <button
                onClick={() => setJaar((j) => j - 1)}
                className="px-3 py-2 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
              <span className="text-sm font-semibold text-autronis-text-primary tabular-nums px-1">
                {jaar}
              </span>
              <button
                onClick={() => setJaar((j) => j + 1)}
                className="px-3 py-2 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                <ChevronUp className="w-4 h-4 rotate-90" />
              </button>
            </div>

            {noData && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", seeding && "animate-spin")} />
                Gegevens aanmaken
              </button>
            )}
          </div>
        </div>

        {/* Urgent deadline banner */}
        {urgentDeadlines.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-400">
                {urgentDeadlines.length} deadline{urgentDeadlines.length > 1 ? "s" : ""} binnen 7 dagen!
              </p>
              <p className="text-xs text-red-400/70 mt-0.5">
                {urgentDeadlines.map((d) => d.omschrijving).join(", ")}
              </p>
            </div>
            <button
              onClick={() => setActiveTab("overzicht")}
              className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
            >
              Bekijk
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-autronis-accent text-autronis-bg shadow-lg shadow-autronis-accent/20"
                    : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ===== TAB: OVERZICHT ===== */}
        {activeTab === "overzicht" && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {/* BTW afdracht dit kwartaal */}
              <div className="bg-gradient-to-br from-emerald-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                    <Receipt className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <AnimatedNumber
                  value={nettoAfdragen}
                  format={formatBedrag}
                  className={cn("text-3xl font-bold tabular-nums", nettoAfdragen > 0 ? "text-red-400" : "text-emerald-400")}
                />
                <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
                  BTW afdracht Q{currentQuarter}
                </p>
              </div>

              {/* Geschatte belasting */}
              <div className="bg-gradient-to-br from-purple-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-purple-500/10 rounded-xl">
                    <Landmark className="w-5 h-5 text-purple-400" />
                  </div>
                </div>
                <AnimatedNumber
                  value={wvData?.geschatteBelasting ?? 0}
                  format={formatBedrag}
                  className="text-3xl font-bold text-purple-400 tabular-nums"
                />
                <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
                  Geschatte belasting {jaar}
                </p>
              </div>

              {/* Gereserveerd */}
              <div className="bg-gradient-to-br from-blue-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-blue-500/10 rounded-xl">
                    <PiggyBank className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
                <AnimatedNumber
                  value={reserveringenData?.totaalGereserveerd ?? 0}
                  format={formatBedrag}
                  className="text-3xl font-bold text-blue-400 tabular-nums"
                />
                <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
                  Gereserveerd
                </p>
              </div>

              {/* Volgende deadline / Urencriterium */}
              <div
                className={cn(
                  "bg-gradient-to-br to-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow",
                  dagenTotDeadline !== null && dagenTotDeadline < 14
                    ? "from-red-500/10"
                    : "from-autronis-accent/10"
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("p-2.5 rounded-xl", dagenTotDeadline !== null && dagenTotDeadline < 14 ? "bg-red-500/10" : "bg-autronis-accent/10")}>
                    <CalendarClock className={cn("w-5 h-5", dagenTotDeadline !== null && dagenTotDeadline < 14 ? "text-red-400" : "text-autronis-accent")} />
                  </div>
                </div>
                {dagenTotDeadline !== null ? (
                  <>
                    <AnimatedNumber
                      value={dagenTotDeadline}
                      format={(n) => `${Math.round(n)} dagen`}
                      className={cn("text-3xl font-bold tabular-nums", dagenTotDeadline < 14 ? "text-red-400" : "text-autronis-text-primary")}
                    />
                    <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide truncate" title={volgendeDeadline?.omschrijving}>
                      {volgendeDeadline?.omschrijving}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-autronis-accent">Alles af</p>
                    <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
                      Geen openstaande deadlines
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Deadlines section */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl">
              <button
                onClick={() => setDeadlinesOpen(!deadlinesOpen)}
                className="w-full flex items-center justify-between p-6 lg:p-7"
              >
                <div className="flex items-center gap-3">
                  <CalendarClock className="w-5 h-5 text-autronis-accent" />
                  <h2 className="text-xl font-bold text-autronis-text-primary">Deadlines {jaar}</h2>
                  {openDeadlines.length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-autronis-accent/15 text-autronis-accent rounded-full font-semibold">
                      {openDeadlines.length} open
                    </span>
                  )}
                </div>
                {deadlinesOpen ? <ChevronUp className="w-5 h-5 text-autronis-text-secondary" /> : <ChevronDown className="w-5 h-5 text-autronis-text-secondary" />}
              </button>

              {deadlinesOpen && (
                <div className="px-6 lg:px-7 pb-6 lg:pb-7">
                  {deadlines.length === 0 ? (
                    <p className="text-autronis-text-secondary text-sm py-4">
                      Nog geen deadlines voor {jaar}. Klik op &quot;Gegevens aanmaken&quot; om te starten.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {deadlines
                        .sort((a, b) => a.datum.localeCompare(b.datum))
                        .map((deadline) => {
                          const config = typeConfig[deadline.type] ?? typeConfig.btw;
                          const Icon = config.icon;
                          const isAfgerond = !!deadline.afgerond;
                          const deadlineDatum = new Date(deadline.datum);
                          const dagen = Math.ceil((deadlineDatum.getTime() - nu.getTime()) / (1000 * 60 * 60 * 24));
                          const isOverdue = !isAfgerond && dagen < 0;
                          const isUrgent = !isAfgerond && dagen >= 0 && dagen < 14;

                          return (
                            <div
                              key={deadline.id}
                              className={cn(
                                "flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer group",
                                isAfgerond
                                  ? "border-autronis-border/50 bg-autronis-bg/20 opacity-60"
                                  : isOverdue
                                  ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                                  : isUrgent
                                  ? "border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10"
                                  : "border-autronis-border hover:bg-autronis-bg/30"
                              )}
                              onClick={() => handleToggleDeadline(deadline)}
                            >
                              <div className={cn("p-2 rounded-lg", isAfgerond ? "bg-green-500/10" : "bg-autronis-bg/50")}>
                                {isAfgerond ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                                ) : (
                                  <Icon className={cn("w-5 h-5", config.color)} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={cn("text-base font-medium", isAfgerond ? "text-autronis-text-secondary line-through" : "text-autronis-text-primary")}>
                                    {deadline.omschrijving}
                                  </span>
                                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", isAfgerond ? "bg-green-500/15 text-green-400" : `bg-${config.color.replace("text-", "")}/15 ${config.color}`)}>
                                    {config.label}
                                  </span>
                                </div>
                                <p className="text-sm text-autronis-text-secondary mt-0.5">{formatDatum(deadline.datum)}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {isAfgerond ? (
                                  <span className="text-sm font-medium text-green-400">Afgerond</span>
                                ) : isOverdue ? (
                                  <div className="flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                    <span className="text-sm font-semibold text-red-400">{Math.abs(dagen)} dagen te laat</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-autronis-text-secondary" />
                                    <span className={cn("text-sm font-semibold tabular-nums", isUrgent ? "text-yellow-400" : "text-autronis-text-secondary")}>
                                      {dagen} dagen
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Urencriterium */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl">
              <button
                onClick={() => setUrenOpen(!urenOpen)}
                className="w-full flex items-center justify-between p-6 lg:p-7"
              >
                <div className="flex items-center gap-3">
                  <Timer className="w-5 h-5 text-autronis-accent" />
                  <h2 className="text-xl font-bold text-autronis-text-primary">Urencriterium {jaar}</h2>
                  {urenCriterium && (
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", urenCriterium.voldoet ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400")}>
                      {urenCriterium.voldoet ? "Voldoet" : "Nog niet"}
                    </span>
                  )}
                </div>
                {urenOpen ? <ChevronUp className="w-5 h-5 text-autronis-text-secondary" /> : <ChevronDown className="w-5 h-5 text-autronis-text-secondary" />}
              </button>

              {urenOpen && urenCriterium && (
                <div className="px-6 lg:px-7 pb-6 lg:pb-7">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col items-center justify-center p-6 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                      <ProgressRing
                        percentage={urenCriterium.voortgangPercentage}
                        size={120}
                        strokeWidth={10}
                        color={urenCriterium.voldoet ? "#22c55e" : "#17B8A5"}
                      />
                      <p className="text-2xl font-bold text-autronis-text-primary mt-4 tabular-nums">
                        {urenCriterium.behaaldUren} / {urenCriterium.doelUren}
                      </p>
                      <p className="text-sm text-autronis-text-secondary mt-1">uren gewerkt</p>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                          <p className="text-sm text-autronis-text-secondary mb-1">Doel uren</p>
                          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">{urenCriterium.doelUren}</p>
                        </div>
                        <div className="p-4 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                          <p className="text-sm text-autronis-text-secondary mb-1">Behaald</p>
                          <p className="text-2xl font-bold text-autronis-accent tabular-nums">{urenCriterium.behaaldUren}</p>
                        </div>
                        <div className="p-4 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                          <p className="text-sm text-autronis-text-secondary mb-1">Zelfstandigenaftrek</p>
                          <p className={cn("text-2xl font-bold tabular-nums", urenCriterium.zelfstandigenaftrek > 0 ? "text-green-400" : "text-autronis-text-secondary")}>
                            {urenCriterium.zelfstandigenaftrek > 0 ? formatBedrag(urenCriterium.zelfstandigenaftrek) : "Niet bereikt"}
                          </p>
                        </div>
                        <div className="p-4 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                          <p className="text-sm text-autronis-text-secondary mb-1">MKB-winstvrijstelling</p>
                          <p className={cn("text-2xl font-bold", urenCriterium.mkbVrijstelling ? "text-green-400" : "text-autronis-text-secondary")}>
                            {urenCriterium.mkbVrijstelling ? "13,31%" : "Niet bereikt"}
                          </p>
                        </div>
                      </div>
                      <div className="p-4 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-autronis-text-secondary">Voortgang</p>
                          <p className="text-sm font-semibold text-autronis-text-primary tabular-nums">{urenCriterium.voortgangPercentage}%</p>
                        </div>
                        <div className="h-3 bg-autronis-bg rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", urenCriterium.voldoet ? "bg-green-500" : "bg-autronis-accent")}
                            style={{ width: `${urenCriterium.voortgangPercentage}%` }}
                          />
                        </div>
                        {!urenCriterium.voldoet && (
                          <p className="text-xs text-autronis-text-secondary mt-2">
                            Nog <span className="font-semibold text-autronis-text-primary">{Math.max(0, urenCriterium.doelUren - urenCriterium.behaaldUren).toFixed(1)}</span> uren nodig voor het urencriterium
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {urenOpen && !urenCriterium && (
                <div className="px-6 lg:px-7 pb-6 lg:pb-7">
                  <p className="text-autronis-text-secondary text-sm py-4">Geen urencriterium data beschikbaar voor {jaar}.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== TAB: BTW ===== */}
        {activeTab === "btw" && (
          <div className="space-y-8">
            {/* BTW Kwartaaloverzicht */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl">
              <div className="p-6 lg:p-7">
                <div className="flex items-center gap-3 mb-6">
                  <Receipt className="w-5 h-5 text-autronis-accent" />
                  <h2 className="text-xl font-bold text-autronis-text-primary">BTW Kwartaaloverzicht {jaar}</h2>
                </div>

                {aangiftes.length === 0 ? (
                  <p className="text-autronis-text-secondary text-sm py-4">
                    Nog geen BTW aangiftes voor {jaar}. Klik op &quot;Gegevens aanmaken&quot; om te starten.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-autronis-border">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Kwartaal</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">BTW Ontvangen</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">BTW Betaald</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Netto</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Status</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Actie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aangiftes.map((aangifte) => {
                          const sc = btwStatusConfig[aangifte.status] ?? btwStatusConfig.open;
                          const netto = aangifte.btwOntvangen - aangifte.btwBetaald;
                          return (
                            <tr key={aangifte.id} className="border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors">
                              <td className="py-4 px-4">
                                <span className="text-base font-semibold text-autronis-text-primary">Q{aangifte.kwartaal}</span>
                                <span className="text-sm text-autronis-text-secondary ml-2">{jaar}</span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <span className="text-base font-medium text-emerald-400 tabular-nums">{formatBedrag(aangifte.btwOntvangen)}</span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <span className="text-base font-medium text-orange-400 tabular-nums">{formatBedrag(aangifte.btwBetaald)}</span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <span className={cn("text-base font-semibold tabular-nums", netto > 0 ? "text-red-400" : "text-autronis-accent")}>
                                  {formatBedrag(netto)}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", sc.bg, sc.text)}>{sc.label}</span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                {aangifte.status === "open" && (
                                  <button
                                    onClick={() => handleBtwStatus(aangifte, "ingediend")}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                                  >
                                    <Send className="w-3 h-3" />
                                    Ingediend
                                  </button>
                                )}
                                {aangifte.status === "ingediend" && (
                                  <button
                                    onClick={() => handleBtwStatus(aangifte, "betaald")}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Betaald
                                  </button>
                                )}
                                {aangifte.status === "betaald" && (
                                  <span className="text-xs text-autronis-text-secondary">Afgerond</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-autronis-bg/30">
                          <td className="py-4 px-4 text-base font-bold text-autronis-text-primary">Totaal</td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-base font-bold text-emerald-400 tabular-nums">
                              {formatBedrag(aangiftes.reduce((sum, a) => sum + a.btwOntvangen, 0))}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-base font-bold text-orange-400 tabular-nums">
                              {formatBedrag(aangiftes.reduce((sum, a) => sum + a.btwBetaald, 0))}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={cn("text-base font-bold tabular-nums", aangiftes.reduce((sum, a) => sum + a.btwOntvangen - a.btwBetaald, 0) > 0 ? "text-red-400" : "text-autronis-accent")}>
                              {formatBedrag(aangiftes.reduce((sum, a) => sum + a.btwOntvangen - a.btwBetaald, 0))}
                            </span>
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ICP Section */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center gap-3 mb-4">
                <Send className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-bold text-autronis-text-primary">ICP Aangifte</h2>
              </div>
              <p className="text-sm text-autronis-text-secondary leading-relaxed">
                ICP aangifte wordt afgeleid uit facturen met buitenlands BTW-nummer. Alle intracommunautaire leveringen worden automatisch meegenomen in de BTW aangifte.
              </p>
            </div>
          </div>
        )}

        {/* ===== TAB: WINST & VERLIES ===== */}
        {activeTab === "winst-verlies" && (
          <div className="space-y-8">
            {loadingWV ? (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonKPI key={i} />)}
              </div>
            ) : wvData ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
                  <div className="bg-gradient-to-br from-emerald-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Bruto omzet</p>
                    <p className="text-2xl font-bold text-emerald-400 tabular-nums">{formatBedrag(wvData.brutoOmzet)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Totale kosten</p>
                    <p className="text-2xl font-bold text-orange-400 tabular-nums">{formatBedrag(wvData.totaleKosten)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-autronis-accent/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Brutowinst</p>
                    <p className="text-2xl font-bold text-autronis-accent tabular-nums">{formatBedrag(wvData.brutowinst)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Belastbaar inkomen</p>
                    <p className="text-2xl font-bold text-blue-400 tabular-nums">{formatBedrag(wvData.belastbaarInkomen)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Geschatte belasting</p>
                    <p className="text-2xl font-bold text-purple-400 tabular-nums">{formatBedrag(wvData.geschatteBelasting)}</p>
                  </div>
                </div>

                {/* Tax brackets visualization */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                  <h3 className="text-lg font-bold text-autronis-text-primary mb-6">Belastingschijven</h3>
                  <div className="space-y-4">
                    {/* Schijf 1 */}
                    {(() => {
                      const schijf1Max = 75518;
                      const inSchijf1 = Math.min(wvData.belastbaarInkomen, schijf1Max);
                      const pctSchijf1 = schijf1Max > 0 ? (inSchijf1 / schijf1Max) * 100 : 0;
                      return (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-autronis-text-secondary">
                              Schijf 1: <span className="text-autronis-text-primary font-semibold">36,97%</span> tot {formatBedrag(schijf1Max)}
                            </p>
                            <p className="text-sm font-semibold text-autronis-text-primary tabular-nums">{formatBedrag(inSchijf1)}</p>
                          </div>
                          <div className="h-4 bg-autronis-bg rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pctSchijf1}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                    {/* Schijf 2 */}
                    {(() => {
                      const schijf1Max = 75518;
                      const inSchijf2 = Math.max(0, wvData.belastbaarInkomen - schijf1Max);
                      const pctSchijf2 = inSchijf2 > 0 ? Math.min((inSchijf2 / schijf1Max) * 100, 100) : 0;
                      return (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-autronis-text-secondary">
                              Schijf 2: <span className="text-autronis-text-primary font-semibold">49,50%</span> boven {formatBedrag(schijf1Max)}
                            </p>
                            <p className="text-sm font-semibold text-autronis-text-primary tabular-nums">{formatBedrag(inSchijf2)}</p>
                          </div>
                          <div className="h-4 bg-autronis-bg rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${pctSchijf2}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                    {/* Effectief tarief */}
                    <div className="pt-2 border-t border-autronis-border">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-autronis-text-secondary">Effectief tarief</p>
                        <p className="text-lg font-bold text-autronis-accent tabular-nums">{wvData.effectiefTarief.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Aftrekposten */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                  <h3 className="text-lg font-bold text-autronis-text-primary mb-6">Aftrekposten</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {[
                      { label: "Zelfstandigenaftrek", value: wvData.zelfstandigenaftrek },
                      { label: "MKB-vrijstelling", value: wvData.mkbVrijstelling },
                      { label: "KM aftrek", value: wvData.kmAftrek },
                      { label: "Afschrijvingen", value: wvData.afschrijvingen },
                      { label: "KIA", value: berekenKIA(investeringenData?.reduce((s, i) => s + i.bedrag, 0) ?? 0) },
                    ].map((item) => (
                      <div key={item.label} className="p-4 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                        <p className="text-xs text-autronis-text-secondary mb-1">{item.label}</p>
                        <p className={cn("text-xl font-bold tabular-nums", item.value > 0 ? "text-green-400" : "text-autronis-text-secondary")}>
                          {item.value > 0 ? formatBedrag(item.value) : "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Kosten per categorie */}
                {Object.keys(wvData.kostenPerCategorie).length > 0 && (
                  <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                    <h3 className="text-lg font-bold text-autronis-text-primary mb-6">Kosten per categorie</h3>
                    <div className="space-y-3">
                      {Object.entries(wvData.kostenPerCategorie)
                        .sort(([, a], [, b]) => b - a)
                        .map(([categorie, bedrag]) => {
                          const maxBedrag = Math.max(...Object.values(wvData.kostenPerCategorie));
                          const pct = maxBedrag > 0 ? (bedrag / maxBedrag) * 100 : 0;
                          return (
                            <div key={categorie}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm text-autronis-text-primary">{categorie}</p>
                                <p className="text-sm font-semibold text-orange-400 tabular-nums">{formatBedrag(bedrag)}</p>
                              </div>
                              <div className="h-2.5 bg-autronis-bg rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500/60 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Per kwartaal */}
                {wvData.perKwartaal.length > 0 && (
                  <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                    <h3 className="text-lg font-bold text-autronis-text-primary mb-6">Per kwartaal</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-autronis-border">
                            <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Kwartaal</th>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Omzet</th>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Kosten</th>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Winst</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wvData.perKwartaal.map((q) => (
                            <tr key={q.kwartaal} className="border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors">
                              <td className="py-4 px-4 text-base font-semibold text-autronis-text-primary">Q{q.kwartaal}</td>
                              <td className="py-4 px-4 text-right text-base font-medium text-emerald-400 tabular-nums">{formatBedrag(q.omzet)}</td>
                              <td className="py-4 px-4 text-right text-base font-medium text-orange-400 tabular-nums">{formatBedrag(q.kosten)}</td>
                              <td className="py-4 px-4 text-right text-base font-semibold tabular-nums">
                                <span className={q.winst >= 0 ? "text-autronis-accent" : "text-red-400"}>{formatBedrag(q.winst)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Suggestie card */}
                {reserveringenData && (
                  <div className="bg-gradient-to-br from-autronis-accent/10 to-autronis-card border border-autronis-accent/30 rounded-2xl p-6 lg:p-7">
                    <div className="flex items-center gap-3 mb-3">
                      <PiggyBank className="w-5 h-5 text-autronis-accent" />
                      <h3 className="text-lg font-bold text-autronis-text-primary">Suggestie</h3>
                    </div>
                    <p className="text-sm text-autronis-text-secondary">
                      Op basis van je geschatte belasting van <span className="font-semibold text-purple-400">{formatBedrag(wvData.geschatteBelasting)}</span>,
                      raden we aan om maandelijks <span className="font-semibold text-autronis-accent">{formatBedrag(reserveringenData.suggestieMaandelijks)}</span> te reserveren.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-8 text-center">
                <p className="text-autronis-text-secondary">Geen W&V data beschikbaar voor {jaar}.</p>
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: INVESTERINGEN ===== */}
        {activeTab === "investeringen" && (
          <div className="space-y-8">
            {loadingInv ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonKPI key={i} />)}
              </div>
            ) : (
              <>
                {/* KPIs */}
                {(() => {
                  const items = investeringenData ?? [];
                  const totaal = items.reduce((s, i) => s + i.bedrag, 0);
                  const totaalAfschrijving = items.reduce((s, i) => s + i.jaarlijkseAfschrijving, 0);
                  const kia = berekenKIA(totaal);
                  return (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
                        <div className="bg-gradient-to-br from-blue-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                          <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Totaal geinvesteerd</p>
                          <p className="text-2xl font-bold text-blue-400 tabular-nums">{formatBedrag(totaal)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-orange-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                          <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Jaarlijkse afschrijving</p>
                          <p className="text-2xl font-bold text-orange-400 tabular-nums">{formatBedrag(totaalAfschrijving)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-green-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                          <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">KIA aftrek</p>
                          <p className={cn("text-2xl font-bold tabular-nums", kia > 0 ? "text-green-400" : "text-autronis-text-secondary")}>
                            {kia > 0 ? formatBedrag(kia) : "Niet van toepassing"}
                          </p>
                        </div>
                      </div>

                      {/* Table + add button */}
                      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-bold text-autronis-text-primary">Investeringen</h3>
                          <button
                            onClick={() => { resetInvForm(); setInvesteringModal(true); }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            Nieuwe investering
                          </button>
                        </div>

                        {items.length === 0 ? (
                          <p className="text-autronis-text-secondary text-sm py-4">Nog geen investeringen geregistreerd.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-autronis-border">
                                  <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Naam</th>
                                  <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Bedrag</th>
                                  <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Datum</th>
                                  <th className="text-center py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Categorie</th>
                                  <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Termijn</th>
                                  <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Afschrijving/jr</th>
                                  <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Acties</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((inv) => (
                                  <tr key={inv.id} className="border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors">
                                    <td className="py-4 px-4 text-base font-medium text-autronis-text-primary">{inv.naam}</td>
                                    <td className="py-4 px-4 text-right text-base font-medium text-blue-400 tabular-nums">{formatBedrag(inv.bedrag)}</td>
                                    <td className="py-4 px-4 text-sm text-autronis-text-secondary">{formatDatum(inv.datum)}</td>
                                    <td className="py-4 px-4 text-center">
                                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-blue-500/15 text-blue-400">{inv.categorie}</span>
                                    </td>
                                    <td className="py-4 px-4 text-right text-sm text-autronis-text-secondary tabular-nums">{inv.afschrijvingstermijn} jaar</td>
                                    <td className="py-4 px-4 text-right text-base font-medium text-orange-400 tabular-nums">{formatBedrag(inv.jaarlijkseAfschrijving)}</td>
                                    <td className="py-4 px-4 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          onClick={() => handleOpenEditInvestering(inv)}
                                          className="p-1.5 rounded-lg hover:bg-autronis-bg/50 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                                        >
                                          <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => setDeleteInvesteringId(inv.id)}
                                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-autronis-text-secondary hover:text-red-400 transition-colors"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* KIA card */}
                      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                        <h3 className="text-lg font-bold text-autronis-text-primary mb-4">Kleinschaligheidsinvesteringsaftrek (KIA)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                            <p className="text-sm text-autronis-text-secondary mb-1">Totaal investeringen</p>
                            <p className="text-2xl font-bold text-blue-400 tabular-nums">{formatBedrag(totaal)}</p>
                          </div>
                          <div className="p-4 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                            <p className="text-sm text-autronis-text-secondary mb-1">KIA aftrek</p>
                            <p className={cn("text-2xl font-bold tabular-nums", kia > 0 ? "text-green-400" : "text-autronis-text-secondary")}>
                              {kia > 0 ? formatBedrag(kia) : "Niet van toepassing"}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-autronis-text-secondary mt-4">
                          KIA is van toepassing bij investeringen tussen {formatBedrag(2801)} en {formatBedrag(373030)} per jaar.
                        </p>
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* ===== TAB: RESERVERINGEN ===== */}
        {activeTab === "reserveringen" && (
          <div className="space-y-8">
            {loadingRes ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonKPI key={i} />)}
              </div>
            ) : reserveringenData ? (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="bg-gradient-to-br from-purple-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Geschatte belasting</p>
                    <p className="text-2xl font-bold text-purple-400 tabular-nums">{formatBedrag(reserveringenData.geschatteBelasting)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Gereserveerd</p>
                    <p className="text-2xl font-bold text-blue-400 tabular-nums">{formatBedrag(reserveringenData.totaalGereserveerd)}</p>
                  </div>
                  <div className="bg-gradient-to-br to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow"
                    style={{ backgroundImage: reserveringenData.tekort > 0 ? "linear-gradient(to bottom right, rgba(239,68,68,0.1), transparent)" : "linear-gradient(to bottom right, rgba(34,197,94,0.1), transparent)" }}
                  >
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">
                      {reserveringenData.tekort > 0 ? "Tekort" : "Overschot"}
                    </p>
                    <p className={cn("text-2xl font-bold tabular-nums", reserveringenData.tekort > 0 ? "text-red-400" : "text-green-400")}>
                      {formatBedrag(Math.abs(reserveringenData.tekort))}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-autronis-accent/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Suggestie / maand</p>
                    <p className="text-2xl font-bold text-autronis-accent tabular-nums">{formatBedrag(reserveringenData.suggestieMaandelijks)}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-autronis-text-primary">Voortgang reserveringen</h3>
                    <p className="text-sm text-autronis-text-secondary tabular-nums">
                      {formatBedrag(reserveringenData.totaalGereserveerd)} / {formatBedrag(reserveringenData.geschatteBelasting)}
                    </p>
                  </div>
                  {(() => {
                    const pct = reserveringenData.geschatteBelasting > 0
                      ? Math.min(100, (reserveringenData.totaalGereserveerd / reserveringenData.geschatteBelasting) * 100)
                      : 0;
                    const genoeg = reserveringenData.tekort <= 0;
                    return (
                      <>
                        <div className="h-4 bg-autronis-bg rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", genoeg ? "bg-green-500" : "bg-red-500")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-autronis-text-secondary mt-2 tabular-nums">{pct.toFixed(0)}% van geschatte belasting gereserveerd</p>
                      </>
                    );
                  })()}
                </div>

                {/* Maandelijks overzicht */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-autronis-text-primary">Maandelijkse reserveringen</h3>
                    <button
                      onClick={() => setReserveringModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Toevoegen
                    </button>
                  </div>

                  {reserveringenData.reserveringen.length === 0 ? (
                    <p className="text-autronis-text-secondary text-sm py-4">Nog geen reserveringen geregistreerd.</p>
                  ) : (
                    <div className="space-y-2">
                      {reserveringenData.reserveringen.map((res) => (
                        <div key={res.id} className="flex items-center justify-between p-4 rounded-xl border border-autronis-border hover:bg-autronis-bg/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                              <PiggyBank className="w-4 h-4 text-purple-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-autronis-text-primary">{res.maand}</p>
                              <p className="text-xs text-autronis-text-secondary">{res.type}</p>
                            </div>
                          </div>
                          <p className="text-base font-semibold text-purple-400 tabular-nums">{formatBedrag(res.bedrag)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Voorlopige aanslagen */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Landmark className="w-5 h-5 text-purple-400" />
                      <h3 className="text-lg font-bold text-autronis-text-primary">Voorlopige aanslagen {jaar}</h3>
                    </div>
                    <button
                      onClick={() => setAanslagModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Nieuwe aanslag
                    </button>
                  </div>

                  {loadingAanslagen ? (
                    <div className="space-y-3">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-16 bg-autronis-bg/50 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : !aanslagenData || aanslagenData.length === 0 ? (
                    <p className="text-autronis-text-secondary text-sm py-4">Geen voorlopige aanslagen voor {jaar}.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-autronis-border">
                            <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Jaar</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Type</th>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Bedrag</th>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Betaald</th>
                            <th className="text-center py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Status</th>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Actie</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aanslagenData.map((aanslag) => {
                            const sc = aanslagStatusConfig[aanslag.status] ?? aanslagStatusConfig.open;
                            return (
                              <tr key={aanslag.id} className="border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors">
                                <td className="py-4 px-4 text-base font-semibold text-autronis-text-primary tabular-nums">{aanslag.jaar}</td>
                                <td className="py-4 px-4 text-sm text-autronis-text-primary">{aanslag.type}</td>
                                <td className="py-4 px-4 text-right text-base font-medium text-purple-400 tabular-nums">{formatBedrag(aanslag.bedrag)}</td>
                                <td className="py-4 px-4 text-right text-base font-medium text-autronis-text-secondary tabular-nums">{formatBedrag(aanslag.betaaldBedrag)}</td>
                                <td className="py-4 px-4 text-center">
                                  <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", sc.bg, sc.text)}>
                                    {aanslag.status === "deels_betaald" ? "Deels betaald" : aanslag.status.charAt(0).toUpperCase() + aanslag.status.slice(1)}
                                  </span>
                                </td>
                                <td className="py-4 px-4 text-right">
                                  {aanslag.status !== "betaald" && (
                                    <button
                                      onClick={() => handleMarkAanslagBetaald(aanslag.id, aanslag.bedrag)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      Betaald
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-8 text-center">
                <p className="text-autronis-text-secondary">Geen reserveringsdata beschikbaar voor {jaar}.</p>
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: JAAROVERZICHT ===== */}
        {activeTab === "jaaroverzicht" && (
          <div className="space-y-8">
            {loadingJaar ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonKPI key={i} />)}
              </div>
            ) : jaaroverzichtData ? (
              <>
                {/* Export button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => addToast("PDF export komt binnenkort", "succes")}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export als PDF
                  </button>
                </div>

                {/* Overview cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="bg-gradient-to-br from-emerald-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Omzet</p>
                    <p className="text-2xl font-bold text-emerald-400 tabular-nums">{/* @ts-ignore pre-existing type mismatch */}
{formatBedrag(jaaroverzichtData.omzet?.totaal ?? 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Kosten</p>
                    <p className="text-2xl font-bold text-orange-400 tabular-nums">{/* @ts-ignore pre-existing type mismatch */}
{formatBedrag(jaaroverzichtData.kosten?.totaal ?? 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-autronis-accent/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Winst</p>
                    <p className="text-2xl font-bold text-autronis-accent tabular-nums">{/* @ts-ignore pre-existing type mismatch */}
{formatBedrag(jaaroverzichtData.winstVerlies?.brutowinst ?? 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/10 to-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Belasting</p>
                    <p className="text-2xl font-bold text-purple-400 tabular-nums">{/* @ts-ignore pre-existing type mismatch */}
{formatBedrag(jaaroverzichtData.winstVerlies?.geschatteBelasting ?? 0)}</p>
                  </div>
                </div>

                {/* Detail sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-autronis-text-primary mb-4">BTW</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-autronis-text-secondary">BTW afgedragen</p>
                        {/* @ts-ignore pre-existing type mismatch */}
                        <p className="text-base font-semibold text-autronis-text-primary tabular-nums">{formatBedrag(jaaroverzichtData.btw?.afgedragen ?? 0)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-autronis-text-primary mb-4">Uren</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-autronis-text-secondary">Totaal uren gewerkt</p>
                        <p className="text-base font-semibold text-autronis-text-primary tabular-nums">{/* @ts-ignore pre-existing type mismatch */}
{typeof jaaroverzichtData.uren === "object" ? `${jaaroverzichtData.uren.totaal} / ${jaaroverzichtData.uren.doel}` : jaaroverzichtData.uren}</p>
                      </div>
                      {urenCriterium && (
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-autronis-text-secondary">Urencriterium</p>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", urenCriterium.voldoet ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400")}>
                            {urenCriterium.voldoet ? "Voldoet" : "Nog niet"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-autronis-text-primary mb-4">Investeringen</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-autronis-text-secondary">Totaal investeringen</p>
                        <p className="text-base font-semibold text-blue-400 tabular-nums">{/* @ts-ignore pre-existing type mismatch */}
{formatBedrag(jaaroverzichtData.investeringen?.totaal ?? 0)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-autronis-text-primary mb-4">Reserveringen</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-autronis-text-secondary">Gereserveerd</p>
                        <p className="text-base font-semibold text-purple-400 tabular-nums">{formatBedrag(reserveringenData?.totaalGereserveerd ?? 0)}</p>
                      </div>
                      {reserveringenData && (
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-autronis-text-secondary">Tekort/Overschot</p>
                          <p className={cn("text-base font-semibold tabular-nums", reserveringenData.tekort > 0 ? "text-red-400" : "text-green-400")}>
                            {reserveringenData.tekort > 0 ? "-" : "+"}{formatBedrag(Math.abs(reserveringenData.tekort))}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Audit log */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                  <div className="flex items-center gap-3 mb-6">
                    <History className="w-5 h-5 text-autronis-text-secondary" />
                    <h3 className="text-lg font-bold text-autronis-text-primary">Audit log</h3>
                  </div>
                  {!auditLogData || auditLogData.length === 0 ? (
                    <p className="text-autronis-text-secondary text-sm py-4">Geen audit log entries.</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {auditLogData.slice(0, 20).map((entry) => (
                        <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors">
                          <div className="p-1.5 bg-autronis-bg/50 rounded-lg flex-shrink-0 mt-0.5">
                            <History className="w-3.5 h-3.5 text-autronis-text-secondary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-autronis-text-primary">
                              <span className="font-semibold">{entry.actie}</span>
                              <span className="text-autronis-text-secondary"> op {entry.entiteitType} #{entry.entiteitId}</span>
                            </p>
                            {entry.details && <p className="text-xs text-autronis-text-secondary mt-0.5">{entry.details}</p>}
                            <p className="text-xs text-autronis-text-secondary/60 mt-1 tabular-nums">{formatDatum(entry.tijdstip)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-8 text-center">
                <p className="text-autronis-text-secondary">Geen jaaroverzicht beschikbaar voor {jaar}.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== MODALS ===== */}

      {/* Investering modal */}
      <Modal
        open={investeringModal}
        onClose={() => { setInvesteringModal(false); resetInvForm(); }}
        titel={editInvestering ? "Investering bewerken" : "Nieuwe investering"}
        footer={
          <>
            <button
              onClick={() => { setInvesteringModal(false); resetInvForm(); }}
              className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleSaveInvestering}
              disabled={createInvMutation.isPending || updateInvMutation.isPending}
              className="px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {editInvestering ? "Opslaan" : "Toevoegen"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Naam</label>
            <input
              type="text"
              value={invForm.naam}
              onChange={(e) => setInvForm((f) => ({ ...f, naam: e.target.value }))}
              className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
              placeholder="Bijv. MacBook Pro"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Bedrag</label>
              <input
                type="number"
                value={invForm.bedrag}
                onChange={(e) => setInvForm((f) => ({ ...f, bedrag: e.target.value }))}
                className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors tabular-nums"
                placeholder="0,00"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Datum</label>
              <input
                type="date"
                value={invForm.datum}
                onChange={(e) => setInvForm((f) => ({ ...f, datum: e.target.value }))}
                className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Categorie</label>
            <select
              value={invForm.categorie}
              onChange={(e) => setInvForm((f) => ({ ...f, categorie: e.target.value }))}
              className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
            >
              {investeringCategorieen.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-autronis-text-secondary mb-1">
              Afschrijvingstermijn: {invForm.afschrijvingstermijn} jaar
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={invForm.afschrijvingstermijn}
              onChange={(e) => setInvForm((f) => ({ ...f, afschrijvingstermijn: parseInt(e.target.value) }))}
              className="w-full accent-autronis-accent"
            />
            <div className="flex justify-between text-xs text-autronis-text-secondary mt-1">
              <span>1 jaar</span>
              <span>10 jaar</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Restwaarde</label>
            <input
              type="number"
              value={invForm.restwaarde}
              onChange={(e) => setInvForm((f) => ({ ...f, restwaarde: e.target.value }))}
              className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors tabular-nums"
              placeholder="0,00"
              step="0.01"
            />
          </div>
        </div>
      </Modal>

      {/* Delete investering confirm */}
      <ConfirmDialog
        open={deleteInvesteringId !== null}
        onClose={() => setDeleteInvesteringId(null)}
        onBevestig={handleDeleteInvestering}
        titel="Investering verwijderen"
        bericht="Weet je zeker dat je deze investering wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
      />

      {/* Reservering modal */}
      <Modal
        open={reserveringModal}
        onClose={() => setReserveringModal(false)}
        titel="Reservering toevoegen"
        footer={
          <>
            <button
              onClick={() => setReserveringModal(false)}
              className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleSaveReservering}
              disabled={createResMutation.isPending}
              className="px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Toevoegen
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Maand</label>
            <input
              type="month"
              value={resForm.maand}
              onChange={(e) => setResForm((f) => ({ ...f, maand: e.target.value }))}
              className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Bedrag</label>
            <input
              type="number"
              value={resForm.bedrag}
              onChange={(e) => setResForm((f) => ({ ...f, bedrag: e.target.value }))}
              className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors tabular-nums"
              placeholder="0,00"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Type</label>
            <select
              value={resForm.type}
              onChange={(e) => setResForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
            >
              {reserveringTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Voorlopige aanslag modal */}
      <Modal
        open={aanslagModal}
        onClose={() => setAanslagModal(false)}
        titel="Voorlopige aanslag toevoegen"
        footer={
          <>
            <button
              onClick={() => setAanslagModal(false)}
              className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleSaveAanslag}
              disabled={createAanslagMutation.isPending}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Toevoegen
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Jaar</label>
              <input
                type="number"
                value={aanslagForm.jaar}
                onChange={(e) => setAanslagForm((f) => ({ ...f, jaar: parseInt(e.target.value) || jaar }))}
                className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors tabular-nums"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Type</label>
              <select
                value={aanslagForm.type}
                onChange={(e) => setAanslagForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
              >
                {aanslagTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Bedrag</label>
              <input
                type="number"
                value={aanslagForm.bedrag}
                onChange={(e) => setAanslagForm((f) => ({ ...f, bedrag: e.target.value }))}
                className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors tabular-nums"
                placeholder="0,00"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Betaald bedrag</label>
              <input
                type="number"
                value={aanslagForm.betaaldBedrag}
                onChange={(e) => setAanslagForm((f) => ({ ...f, betaaldBedrag: e.target.value }))}
                className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors tabular-nums"
                placeholder="0,00"
                step="0.01"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-autronis-text-secondary mb-1">Vervaldatum</label>
            <input
              type="date"
              value={aanslagForm.vervaldatum}
              onChange={(e) => setAanslagForm((f) => ({ ...f, vervaldatum: e.target.value }))}
              className="w-full px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-autronis-text-primary focus:outline-none focus:border-autronis-accent transition-colors"
            />
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
