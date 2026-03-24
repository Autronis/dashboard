"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "@/components/ui/confetti";
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
  Wallet,
  Lightbulb,
  ShieldCheck,
  Gift,
  BookOpen,
  Car,
  Coffee,
  Monitor,
  Megaphone,
  GraduationCap,
  Wrench,
  Globe,
  ExternalLink,
  Info,
  CheckSquare,
  Square,
  Zap,
  Target,
  ArrowRight,
  CircleDot,
  BarChart3,
  Sparkles,
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

type TabId = "overzicht" | "acties" | "analyse" | "optimalisatie";

const tabs: { id: TabId; label: string; icon: typeof Receipt; description: string }[] = [
  { id: "overzicht", label: "Overzicht", icon: Target, description: "Jouw situatie nu" },
  { id: "acties", label: "Acties", icon: Zap, description: "Wat moet je doen" },
  { id: "analyse", label: "Analyse", icon: BarChart3, description: "Inzicht in je cijfers" },
  { id: "optimalisatie", label: "Optimalisatie", icon: Sparkles, description: "Bespaar meer" },
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

// ============ STATUS HELPERS ============

function getStatusIndicator(status: "ok" | "warning" | "danger") {
  const config = {
    ok: { bg: "bg-green-500/15", text: "text-green-400", dot: "bg-green-400" },
    warning: { bg: "bg-yellow-500/15", text: "text-yellow-400", dot: "bg-yellow-400" },
    danger: { bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400" },
  };
  return config[status];
}

function StatusBadge({ status, label }: { status: "ok" | "warning" | "danger"; label: string }) {
  const cfg = getStatusIndicator(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold", cfg.bg, cfg.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {label}
    </span>
  );
}

// ============ HELPERS ============

function glowStyle(status: "ok" | "warning" | "danger"): React.CSSProperties {
  if (status === "ok") return { boxShadow: "0 0 0 1px rgba(34,197,94,0.25), 0 0 16px 2px rgba(34,197,94,0.08)" };
  if (status === "warning") return { boxShadow: "0 0 0 1px rgba(234,179,8,0.25), 0 0 16px 2px rgba(234,179,8,0.08)" };
  return { boxShadow: "0 0 0 1px rgba(239,68,68,0.25), 0 0 16px 2px rgba(239,68,68,0.08)" };
}

interface WaterfallStep {
  label: string;
  value: number;
  color: string;
  subtract?: boolean;
}

function WaterfallChart({ steps }: { steps: WaterfallStep[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  const max = Math.max(...steps.map((s) => Math.abs(s.value)), 1);
  return (
    <div className="flex items-end gap-3 h-20 mt-1">
      {steps.map((step, i) => {
        const pct = (Math.abs(step.value) / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className={cn("text-[10px] font-bold tabular-nums", step.color)}>
              {formatBedrag(step.value)}
            </span>
            <div className="w-full bg-autronis-bg/50 rounded-t-md overflow-hidden" style={{ height: 44 }}>
              <div
                className={cn("w-full rounded-t-md transition-all ease-out", step.color.replace("text-", "bg-").replace("-400", "-500") + "/30 border-t-2 " + step.color.replace("text-", "border-"))}
                style={{ height: mounted ? `${pct}%` : "0%", transitionDuration: `${600 + i * 100}ms`, marginTop: "auto" }}
              />
            </div>
            <span className="text-[9px] text-autronis-text-secondary text-center leading-tight">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function MiniBarChart({ data, color = "#23C6B7" }: { data: number[]; color?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all ease-out"
          style={{
            height: mounted ? `${Math.max((v / max) * 100, 4)}%` : "4%",
            background: color,
            opacity: 0.6 + (v / max) * 0.4,
            transitionDuration: `${400 + i * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ============ COMPONENT ============

export default function BelastingPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [jaar, setJaar] = useState(new Date().getFullYear());
  const [jaarDirection, setJaarDirection] = useState<1 | -1>(1);
  const [activeTab, setActiveTab] = useState<TabId>("overzicht");
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiFired = useRef(false);

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
      return { nieuweStatus, wasAfgerond: !!deadline.afgerond };
    },
    onSuccess: ({ nieuweStatus, wasAfgerond }: { nieuweStatus: number; wasAfgerond: boolean }) => {
      addToast(nieuweStatus ? "Deadline afgerond" : "Deadline heropend", "succes");
      queryClient.invalidateQueries({ queryKey: ["belasting"] }).then(() => {
        // Check if all deadlines are now done (after cache update)
        if (nieuweStatus === 1 && !wasAfgerond) {
          confettiFired.current = false; // allow re-fire after invalidate
        }
      });
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

  // Investering computed
  const investeringenLijst = investeringenData ?? [];
  const totaalInvestering = investeringenLijst.reduce((sum, inv) => sum + inv.bedrag, 0);
  const totaleAfschrijving = investeringenLijst.reduce((sum, inv) => sum + inv.jaarlijkseAfschrijving, 0);

  // Reservering computed
  const geschatteBelasting = wvData?.geschatteBelasting ?? 0;
  const totaalGereserveerd = reserveringenData?.totaalGereserveerd ?? 0;
  const reserveringTekort = geschatteBelasting - totaalGereserveerd;
  const reserveringStatus: "ok" | "warning" | "danger" =
    reserveringTekort <= 0 ? "ok" : reserveringTekort < geschatteBelasting * 0.3 ? "warning" : "danger";

  // Uren computed
  const urenAchterstand = urenCriterium ? Math.max(0, urenCriterium.doelUren - urenCriterium.behaaldUren) : 0;
  const dagenResterend = Math.ceil((new Date(jaar, 11, 31).getTime() - nu.getTime()) / (1000 * 60 * 60 * 24));
  const urenPerDagNodig = dagenResterend > 0 && urenAchterstand > 0
    ? (urenAchterstand / dagenResterend).toFixed(1)
    : "0";
  const urenStatus: "ok" | "warning" | "danger" =
    !urenCriterium ? "warning" :
    urenCriterium.voldoet ? "ok" :
    (urenCriterium.voortgangPercentage ?? 0) < 50 ? "danger" : "warning";

  // BTW status
  const btwStatus: "ok" | "warning" | "danger" =
    !currentQAangifte ? "warning" :
    currentQAangifte.status === "betaald" ? "ok" :
    currentQAangifte.status === "ingediend" ? "warning" : "danger";

  // Open BTW aangiftes
  const openBtwAangiftes = aangiftes.filter((a) => a.status !== "betaald");

  // Confetti when all deadlines done
  useEffect(() => {
    if (deadlines.length > 0 && deadlines.every((d) => !!d.afgerond) && !confettiFired.current) {
      confettiFired.current = true;
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [deadlines]);

  // ---- SMART INSIGHTS ----

  // Belastingdruk warning: tekort per maand om bij te komen
  const maandenResterend = Math.max(1, 12 - nu.getMonth());
  const reserveringTekortPerMaand = reserveringTekort > 0
    ? Math.ceil(reserveringTekort / maandenResterend)
    : 0;

  // Uren prognose: op basis van huidig tempo
  const urenPrognose: { datum: string; haalbaar: boolean } | null = (() => {
    if (!urenCriterium || urenCriterium.voldoet) return null;
    const dagVanJaar = Math.floor((nu.getTime() - new Date(jaar, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (dagVanJaar <= 0) return null;
    const urenPerDag = urenCriterium.behaaldUren / dagVanJaar;
    if (urenPerDag <= 0) return { datum: "", haalbaar: false };
    const dagenNodig = (urenCriterium.doelUren - urenCriterium.behaaldUren) / urenPerDag;
    const prognoseDatum = new Date(nu.getTime() + dagenNodig * 24 * 60 * 60 * 1000);
    const haalbaar = prognoseDatum.getFullYear() === jaar;
    return {
      datum: prognoseDatum.toLocaleDateString("nl-NL", { day: "numeric", month: "long" }),
      haalbaar,
    };
  })();

  // KIA kans: als investeringen net onder de drempel zitten
  const kiaGrens = 2801;
  const kiaKans = totaalInvestering > 0 && totaalInvestering < kiaGrens
    ? kiaGrens - totaalInvestering
    : null;

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
              Belasting & Financieel
            </h1>
            <p className="text-base text-autronis-text-secondary mt-1">
              Wat je moet doen, betalen en optimaliseren
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl overflow-hidden">
              <button
                onClick={() => { setJaarDirection(-1); setJaar((j) => j - 1); confettiFired.current = false; }}
                className="px-3 py-2 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
              <div className="w-12 overflow-hidden relative flex items-center justify-center">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={jaar}
                    initial={{ x: jaarDirection * 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: jaarDirection * -20, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="text-sm font-semibold text-autronis-text-primary tabular-nums"
                  >
                    {jaar}
                  </motion.span>
                </AnimatePresence>
              </div>
              <button
                onClick={() => { setJaarDirection(1); setJaar((j) => j + 1); confettiFired.current = false; }}
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
              onClick={() => setActiveTab("acties")}
              className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
            >
              Bekijk acties
            </button>
          </div>
        )}

        {/* Belastingdruk warning banner */}
        {reserveringTekortPerMaand > 0 && geschatteBelasting > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-center gap-3">
            <PiggyBank className="w-5 h-5 text-orange-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-400">
                Je hebt nog {formatBedrag(reserveringTekort)} te reserveren voor belasting
              </p>
              <p className="text-xs text-orange-400/70 mt-0.5">
                Zet de komende {maandenResterend} maanden{" "}
                <span className="font-semibold text-orange-300">{formatBedrag(reserveringTekortPerMaand)}/maand</span>{" "}
                apart om op schema te komen
              </p>
            </div>
            <button
              onClick={() => setActiveTab("analyse")}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors whitespace-nowrap"
            >
              Bekijk analyse
            </button>
          </div>
        )}

        {/* Tab bar — 4 tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col items-start gap-1 p-4 rounded-2xl text-left transition-all",
                  isActive
                    ? "bg-autronis-accent/15 border-2 border-autronis-accent shadow-lg shadow-autronis-accent/10"
                    : "bg-autronis-card border-2 border-transparent hover:border-autronis-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4", isActive ? "text-autronis-accent" : "text-autronis-text-secondary")} />
                  <span className={cn("text-sm font-bold", isActive ? "text-autronis-accent" : "text-autronis-text-primary")}>
                    {tab.label}
                  </span>
                </div>
                <span className="text-xs text-autronis-text-secondary">{tab.description}</span>
              </button>
            );
          })}
        </div>

        {/* ===== TAB: OVERZICHT ===== */}
        {activeTab === "overzicht" && (
          <div className="space-y-6">
            {/* Jouw situatie nu */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <h2 className="text-xl font-bold text-autronis-text-primary mb-5">Jouw situatie nu</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* BTW Status */}
                <div
                  className={cn(
                    "p-5 rounded-xl border transition-all duration-300",
                    btwStatus === "danger" ? "border-red-500/30 bg-red-500/5" :
                    btwStatus === "warning" ? "border-yellow-500/30 bg-yellow-500/5" :
                    "border-green-500/30 bg-green-500/5"
                  )}
                  style={glowStyle(btwStatus)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Receipt className={cn("w-5 h-5", btwStatus === "ok" ? "text-green-400" : btwStatus === "warning" ? "text-yellow-400" : "text-red-400")} />
                    <StatusBadge
                      status={btwStatus}
                      label={btwStatus === "ok" ? "Betaald" : btwStatus === "warning" ? "Ingediend" : "Actie nodig"}
                    />
                  </div>
                  <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">{formatBedrag(nettoAfdragen)}</p>
                  <p className="text-sm text-autronis-text-secondary mt-1">BTW afdracht Q{currentQuarter}</p>
                  {btwStatus === "danger" && (
                    <button
                      onClick={() => setActiveTab("acties")}
                      className="mt-3 text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                    >
                      Aangifte doen <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Belasting reservering */}
                <div
                  className={cn(
                    "p-5 rounded-xl border transition-all duration-300",
                    reserveringStatus === "danger" ? "border-red-500/30 bg-red-500/5" :
                    reserveringStatus === "warning" ? "border-yellow-500/30 bg-yellow-500/5" :
                    "border-green-500/30 bg-green-500/5"
                  )}
                  style={glowStyle(reserveringStatus)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <PiggyBank className={cn("w-5 h-5", reserveringStatus === "ok" ? "text-green-400" : reserveringStatus === "warning" ? "text-yellow-400" : "text-red-400")} />
                    <StatusBadge
                      status={reserveringStatus}
                      label={reserveringStatus === "ok" ? "Op schema" : reserveringStatus === "warning" ? "Let op" : "Reserveren"}
                    />
                  </div>
                  <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">{formatBedrag(geschatteBelasting)}</p>
                  <p className="text-sm text-autronis-text-secondary mt-1">Geschatte belasting {jaar}</p>
                  {reserveringTekort > 0 && (
                    <p className="mt-2 text-xs text-red-400 font-medium">
                      Nog {formatBedrag(reserveringTekort)} reserveren
                    </p>
                  )}
                </div>

                {/* Urencriterium */}
                <div
                  className={cn(
                    "p-5 rounded-xl border transition-all duration-300",
                    urenStatus === "danger" ? "border-red-500/30 bg-red-500/5" :
                    urenStatus === "warning" ? "border-yellow-500/30 bg-yellow-500/5" :
                    "border-green-500/30 bg-green-500/5"
                  )}
                  style={glowStyle(urenStatus)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Timer className={cn("w-5 h-5", urenStatus === "ok" ? "text-green-400" : urenStatus === "warning" ? "text-yellow-400" : "text-red-400")} />
                    <StatusBadge
                      status={urenStatus}
                      label={urenStatus === "ok" ? "Behaald" : urenStatus === "warning" ? "Risico" : "Achterstand"}
                    />
                  </div>
                  <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
                    {urenCriterium ? `${urenCriterium.voortgangPercentage}%` : "—"}
                  </p>
                  <p className="text-sm text-autronis-text-secondary mt-1">Urencriterium</p>
                  {urenAchterstand > 0 && (
                    <p className="mt-2 text-xs text-yellow-400 font-medium">
                      {urenPerDagNodig} uur/dag nodig
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Volgende deadlines */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-autronis-text-primary">Volgende deadlines</h2>
                {openDeadlines.length > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-autronis-accent/15 text-autronis-accent rounded-full font-semibold">
                    {openDeadlines.length} open
                  </span>
                )}
              </div>
              {openDeadlines.length === 0 ? (
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                  </motion.div>
                  <p className="text-autronis-text-primary font-semibold">Alle deadlines afgerond!</p>
                  <p className="text-sm text-autronis-text-secondary mt-1">Geen openstaande verplichtingen</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {openDeadlines.slice(0, 5).map((deadline) => {
                    const config = typeConfig[deadline.type] ?? typeConfig.btw;
                    const Icon = config.icon;
                    const deadlineDatum = new Date(deadline.datum);
                    const dagen = Math.ceil((deadlineDatum.getTime() - nu.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = dagen < 0;
                    const isUrgent = dagen >= 0 && dagen < 14;

                    return (
                      <div
                        key={deadline.id}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer group",
                          isOverdue
                            ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10 deadline-shake"
                            : isUrgent
                            ? "border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10"
                            : "border-autronis-border hover:bg-autronis-bg/30"
                        )}
                        onClick={() => handleToggleDeadline(deadline)}
                      >
                        <div className="p-2 rounded-lg bg-autronis-bg/50 relative">
                          <Icon className={cn("w-5 h-5 group-hover:opacity-0 transition-opacity", config.color)} />
                          <Square className="w-5 h-5 absolute inset-2 text-autronis-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-medium text-autronis-text-primary">
                              {deadline.omschrijving}
                            </span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", `bg-${config.color.replace("text-", "")}/15 ${config.color}`)}>
                              {config.label}
                            </span>
                          </div>
                          <p className="text-sm text-autronis-text-secondary mt-0.5">{formatDatum(deadline.datum)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {isOverdue ? (
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

            {/* Snelle cijfers */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-emerald-500/10 to-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
                <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Omzet {jaar}</p>
                <AnimatedNumber
                  value={wvData?.brutoOmzet ?? 0}
                  format={formatBedrag}
                  className="text-2xl font-bold text-emerald-400 tabular-nums"
                />
              </div>
              <div className="bg-gradient-to-br from-orange-500/10 to-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
                <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Kosten {jaar}</p>
                <AnimatedNumber
                  value={wvData?.totaleKosten ?? 0}
                  format={formatBedrag}
                  className="text-2xl font-bold text-orange-400 tabular-nums"
                />
              </div>
              <div className="bg-gradient-to-br from-autronis-accent/10 to-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
                <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Winst {jaar}</p>
                <AnimatedNumber
                  value={wvData?.brutowinst ?? 0}
                  format={formatBedrag}
                  className="text-2xl font-bold text-autronis-accent tabular-nums"
                />
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
                <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Gereserveerd</p>
                <AnimatedNumber
                  value={totaalGereserveerd}
                  format={formatBedrag}
                  className="text-2xl font-bold text-purple-400 tabular-nums"
                />
              </div>
            </div>
          </div>
        )}

        {/* ===== TAB: ACTIES ===== */}
        {activeTab === "acties" && (
          <div className="space-y-6">
            {/* BTW Aangiftes — per kwartaal kaarten */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-autronis-text-primary">BTW Aangiftes {jaar}</h2>
              </div>
              {aangiftes.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="w-10 h-10 text-autronis-text-secondary/30 mx-auto mb-3" />
                  <p className="text-autronis-text-secondary font-medium">Nog geen BTW data</p>
                  <p className="text-sm text-autronis-text-secondary/70 mt-1">Maak eerst gegevens aan via de knop rechtsboven</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aangiftes
                    .sort((a, b) => a.kwartaal - b.kwartaal)
                    .map((aangifte, idx) => {
                      const statusCfg = btwStatusConfig[aangifte.status] ?? btwStatusConfig.open;
                      const netto = aangifte.btwOntvangen - aangifte.btwBetaald;
                      const isCurrent = aangifte.kwartaal === currentQuarter;
                      const maxBtw = Math.max(aangifte.btwOntvangen, aangifte.btwBetaald, 1);

                      return (
                        <motion.div
                          key={aangifte.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.07, duration: 0.3, ease: "easeOut" }}
                          className={cn(
                            "p-5 rounded-xl border",
                            isCurrent ? "border-autronis-accent/30 bg-autronis-accent/5" : "border-autronis-border bg-autronis-bg/20"
                          )}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-autronis-text-primary">Q{aangifte.kwartaal}</span>
                              {isCurrent && (
                                <span className="text-xs px-2 py-0.5 bg-autronis-accent/15 text-autronis-accent rounded-full font-semibold">
                                  Huidig
                                </span>
                              )}
                            </div>
                            <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", statusCfg.bg, statusCfg.text)}>
                              {statusCfg.label}
                            </span>
                          </div>
                          {/* Mini comparison bar */}
                          {(aangifte.btwOntvangen > 0 || aangifte.btwBetaald > 0) && (
                            <div className="mb-4 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-autronis-text-secondary w-16">Ontvangen</span>
                                <div className="flex-1 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${(aangifte.btwOntvangen / maxBtw) * 100}%` }} />
                                </div>
                                <span className="text-[10px] text-emerald-400 tabular-nums w-14 text-right">{formatBedrag(aangifte.btwOntvangen)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-autronis-text-secondary w-16">Betaald</span>
                                <div className="flex-1 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${(aangifte.btwBetaald / maxBtw) * 100}%` }} />
                                </div>
                                <span className="text-[10px] text-blue-400 tabular-nums w-14 text-right">{formatBedrag(aangifte.btwBetaald)}</span>
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div>
                              <p className="text-xs text-autronis-text-secondary">Ontvangen</p>
                              <p className="text-sm font-bold text-autronis-text-primary tabular-nums">{formatBedrag(aangifte.btwOntvangen)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-autronis-text-secondary">Betaald</p>
                              <p className="text-sm font-bold text-autronis-text-primary tabular-nums">{formatBedrag(aangifte.btwBetaald)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-autronis-text-secondary">Af te dragen</p>
                              <p className={cn("text-sm font-bold tabular-nums", netto > 0 ? "text-red-400" : "text-green-400")}>
                                {formatBedrag(netto)}
                              </p>
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className="flex gap-2">
                            {aangifte.status === "open" && (
                              <button
                                onClick={() => handleBtwStatus(aangifte, "ingediend")}
                                className="flex-1 px-3 py-2 bg-blue-500/15 text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-500/25 transition-colors"
                              >
                                Aangifte indienen
                              </button>
                            )}
                            {(aangifte.status === "open" || aangifte.status === "ingediend") && (
                              <button
                                onClick={() => handleBtwStatus(aangifte, "betaald")}
                                className="flex-1 px-3 py-2 bg-green-500/15 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-500/25 transition-colors"
                              >
                                Betaald markeren
                              </button>
                            )}
                            {aangifte.status === "betaald" && (
                              <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-green-400 text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Afgerond
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              )}
              {/* ICP info */}
              <div className="mt-5 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Send className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-semibold text-cyan-400">ICP-opgave</span>
                </div>
                <p className="text-xs text-autronis-text-secondary">
                  Intracommunautaire prestaties? Dien je ICP-opgave in via de Belastingdienst bij omzet aan EU-bedrijven.
                </p>
              </div>
            </div>

            {/* Urencriterium tracker */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <Timer className="w-5 h-5 text-autronis-accent" />
                  <h2 className="text-xl font-bold text-autronis-text-primary">Urencriterium {jaar}</h2>
                </div>
                {urenCriterium && (
                  <StatusBadge
                    status={urenStatus}
                    label={urenCriterium.voldoet ? "Behaald" : `${urenAchterstand.toFixed(0)} uur te gaan`}
                  />
                )}
              </div>

              {urenCriterium ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col items-center justify-center p-5 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                      <ProgressRing
                        percentage={urenCriterium.voortgangPercentage}
                        size={100}
                        strokeWidth={8}
                        color={urenCriterium.voldoet ? "#22c55e" : "#17B8A5"}
                      />
                      <p className="text-xl font-bold text-autronis-text-primary mt-3 tabular-nums">
                        {urenCriterium.behaaldUren} / {urenCriterium.doelUren}
                      </p>
                      <p className="text-xs text-autronis-text-secondary mt-1">uren gewerkt</p>
                    </div>
                    <div className="md:col-span-2 space-y-3">
                      {/* Smart insight */}
                      {!urenCriterium.voldoet && urenAchterstand > 0 && (
                        <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                          <p className="text-sm font-semibold text-yellow-400 mb-1">
                            Je loopt {urenAchterstand.toFixed(0)} uur achter
                          </p>
                          <p className="text-xs text-autronis-text-secondary">
                            Om het urencriterium te halen moet je gemiddeld <span className="font-semibold text-autronis-text-primary">{urenPerDagNodig} uur per dag</span> werken
                            (nog {dagenResterend} dagen in {jaar}).
                          </p>
                        </div>
                      )}
                      {urenCriterium.voldoet && (
                        <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                          <p className="text-sm font-semibold text-green-400">Urencriterium behaald!</p>
                          <p className="text-xs text-autronis-text-secondary mt-1">
                            Je hebt recht op de zelfstandigenaftrek en MKB-winstvrijstelling.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                          <p className="text-xs text-autronis-text-secondary mb-1">Zelfstandigenaftrek</p>
                          <p className={cn("text-lg font-bold tabular-nums", urenCriterium.zelfstandigenaftrek > 0 ? "text-green-400" : "text-autronis-text-secondary")}>
                            {urenCriterium.zelfstandigenaftrek > 0 ? formatBedrag(urenCriterium.zelfstandigenaftrek) : "Niet bereikt"}
                          </p>
                        </div>
                        <div className="p-3 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                          <p className="text-xs text-autronis-text-secondary mb-1">MKB-winstvrijstelling</p>
                          <p className={cn("text-lg font-bold", urenCriterium.mkbVrijstelling ? "text-green-400" : "text-autronis-text-secondary")}>
                            {urenCriterium.mkbVrijstelling ? "13,31%" : "Niet bereikt"}
                          </p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="p-3 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-autronis-text-secondary">Voortgang</p>
                          <p className="text-xs font-semibold text-autronis-text-primary tabular-nums">{urenCriterium.voortgangPercentage}%</p>
                        </div>
                        <div className="h-2.5 bg-autronis-bg rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", urenCriterium.voldoet ? "bg-green-500" : "bg-autronis-accent")}
                            style={{ width: `${Math.min(100, urenCriterium.voortgangPercentage)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Timer className="w-10 h-10 text-autronis-text-secondary/30 mx-auto mb-3" />
                  <p className="text-autronis-text-secondary font-medium">Geen uren data voor {jaar}</p>
                  <p className="text-sm text-autronis-text-secondary/70 mt-1">Registreer je uren om het criterium te tracken</p>
                </div>
              )}
            </div>

            {/* Alle deadlines (volledige lijst) */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <h2 className="text-xl font-bold text-autronis-text-primary mb-5">Alle deadlines {jaar}</h2>
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
                        <motion.div
                          key={deadline.id}
                          layout
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer group",
                            isAfgerond
                              ? "border-autronis-border/50 bg-autronis-bg/20 opacity-60"
                              : isOverdue
                              ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10 deadline-shake"
                              : isUrgent
                              ? "border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10"
                              : "border-autronis-border hover:bg-autronis-bg/30"
                          )}
                          onClick={() => handleToggleDeadline(deadline)}
                        >
                          <div className={cn("p-2 rounded-lg relative", isAfgerond ? "bg-green-500/10" : "bg-autronis-bg/50")}>
                            {isAfgerond ? (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                              </motion.div>
                            ) : (
                              <>
                                <Icon className={cn("w-5 h-5 group-hover:opacity-0 transition-opacity", config.color)} />
                                <Square className="w-5 h-5 absolute inset-2 text-autronis-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                              </>
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
                        </motion.div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Voorlopige aanslagen */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-autronis-text-primary">Voorlopige aanslagen</h2>
                <button
                  onClick={() => setAanslagModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/15 text-purple-400 rounded-lg text-xs font-semibold hover:bg-purple-500/25 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Nieuwe aanslag
                </button>
              </div>
              {!aanslagenData?.length ? (
                <div className="text-center py-6">
                  <Landmark className="w-8 h-8 text-autronis-text-secondary/30 mx-auto mb-2" />
                  <p className="text-sm text-autronis-text-secondary">Nog geen voorlopige aanslagen</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {aanslagenData.map((aanslag) => {
                    const statusCfg = aanslagStatusConfig[aanslag.status] ?? aanslagStatusConfig.open;
                    return (
                      <div key={aanslag.id} className="flex items-center gap-4 p-4 rounded-xl border border-autronis-border bg-autronis-bg/20">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Landmark className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-autronis-text-primary">{aanslag.type}</p>
                          <p className="text-xs text-autronis-text-secondary mt-0.5">
                            {formatBedrag(aanslag.bedrag)} {aanslag.vervaldatum && `— vervalt ${formatDatum(aanslag.vervaldatum)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", statusCfg.bg, statusCfg.text)}>
                            {aanslag.status === "deels_betaald" ? "Deels betaald" : aanslag.status.charAt(0).toUpperCase() + aanslag.status.slice(1)}
                          </span>
                          {aanslag.status !== "betaald" && (
                            <button
                              onClick={() => handleMarkAanslagBetaald(aanslag.id, aanslag.bedrag)}
                              className="px-2.5 py-1 bg-green-500/15 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-500/25 transition-colors"
                            >
                              Betaald
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== TAB: ANALYSE ===== */}
        {activeTab === "analyse" && (
          <div className="space-y-6">
            {/* Winst & Verlies insights */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <h2 className="text-xl font-bold text-autronis-text-primary mb-5">Winst & Verlies {jaar}</h2>

              {loadingWV ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonKPI key={i} />)}
                </div>
              ) : wvData ? (
                <div className="space-y-5">
                  {/* Insight banner */}
                  <div className="p-4 bg-autronis-accent/5 border border-autronis-accent/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-autronis-accent flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-autronis-text-primary">
                          Je winst is {formatBedrag(wvData.brutowinst)}
                          {wvData.effectiefTarief > 0 && (
                            <span className="text-autronis-text-secondary font-normal"> — effectieve belastingdruk {wvData.effectiefTarief.toFixed(1)}%</span>
                          )}
                        </p>
                        <p className="text-xs text-autronis-text-secondary mt-1">
                          Van je {formatBedrag(wvData.brutoOmzet)} omzet gaat {formatBedrag(wvData.totaleKosten)} naar kosten en naar schatting {formatBedrag(wvData.geschatteBelasting)} naar belasting.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* KPI cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                      <p className="text-xs text-autronis-text-secondary mb-1">Omzet</p>
                      <p className="text-xl font-bold text-emerald-400 tabular-nums">{formatBedrag(wvData.brutoOmzet)}</p>
                    </div>
                    <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                      <p className="text-xs text-autronis-text-secondary mb-1">Kosten</p>
                      <p className="text-xl font-bold text-orange-400 tabular-nums">{formatBedrag(wvData.totaleKosten)}</p>
                    </div>
                    <div className="p-4 bg-autronis-accent/5 border border-autronis-accent/20 rounded-xl">
                      <p className="text-xs text-autronis-text-secondary mb-1">Winst</p>
                      <p className="text-xl font-bold text-autronis-accent tabular-nums">{formatBedrag(wvData.brutowinst)}</p>
                    </div>
                    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                      <p className="text-xs text-autronis-text-secondary mb-1">Belastbaar</p>
                      <p className="text-xl font-bold text-blue-400 tabular-nums">{formatBedrag(wvData.belastbaarInkomen)}</p>
                    </div>
                    <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                      <p className="text-xs text-autronis-text-secondary mb-1">Belasting</p>
                      <p className="text-xl font-bold text-purple-400 tabular-nums">{formatBedrag(wvData.geschatteBelasting)}</p>
                    </div>
                  </div>

                  {/* Aftrekposten */}
                  {(wvData.zelfstandigenaftrek > 0 || wvData.mkbVrijstelling > 0 || wvData.kmAftrek > 0 || wvData.afschrijvingen > 0) && (
                    <div>
                      <h3 className="text-sm font-semibold text-autronis-text-secondary mb-3">Aftrekposten</h3>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {wvData.zelfstandigenaftrek > 0 && (
                          <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl flex items-center justify-between">
                            <span className="text-sm text-autronis-text-primary">Zelfstandigenaftrek</span>
                            <span className="text-sm font-semibold text-green-400 tabular-nums">{formatBedrag(wvData.zelfstandigenaftrek)}</span>
                          </div>
                        )}
                        {wvData.mkbVrijstelling > 0 && (
                          <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl flex items-center justify-between">
                            <span className="text-sm text-autronis-text-primary">MKB-vrijstelling</span>
                            <span className="text-sm font-semibold text-green-400 tabular-nums">{formatBedrag(wvData.mkbVrijstelling)}</span>
                          </div>
                        )}
                        {wvData.afschrijvingen > 0 && (
                          <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl flex items-center justify-between">
                            <span className="text-sm text-autronis-text-primary">Afschrijvingen</span>
                            <span className="text-sm font-semibold text-green-400 tabular-nums">{formatBedrag(wvData.afschrijvingen)}</span>
                          </div>
                        )}
                        {wvData.kmAftrek > 0 && (
                          <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl flex items-center justify-between">
                            <span className="text-sm text-autronis-text-primary">Km-aftrek</span>
                            <span className="text-sm font-semibold text-green-400 tabular-nums">{formatBedrag(wvData.kmAftrek)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Kosten per categorie */}
                  {Object.keys(wvData.kostenPerCategorie).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-autronis-text-secondary mb-3">Kosten per categorie</h3>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(wvData.kostenPerCategorie).map(([cat, bedrag]) => (
                          <div key={cat} className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl flex items-center justify-between">
                            <span className="text-sm text-autronis-text-primary capitalize">{cat}</span>
                            <span className="text-sm font-semibold text-orange-400 tabular-nums">{formatBedrag(bedrag)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Kwartaaloverzicht */}
                  {wvData.perKwartaal && wvData.perKwartaal.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-autronis-text-secondary mb-3">Per kwartaal</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-autronis-border">
                              <th className="text-left py-3 px-3 text-autronis-text-secondary font-medium">Kwartaal</th>
                              <th className="text-right py-3 px-3 text-autronis-text-secondary font-medium">Omzet</th>
                              <th className="text-right py-3 px-3 text-autronis-text-secondary font-medium">Kosten</th>
                              <th className="text-right py-3 px-3 text-autronis-text-secondary font-medium">Winst</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wvData.perKwartaal.map((q) => (
                              <tr key={q.kwartaal} className="border-b border-autronis-border/50">
                                <td className="py-3 px-3 font-medium text-autronis-text-primary">Q{q.kwartaal}</td>
                                <td className="py-3 px-3 text-right tabular-nums text-autronis-text-primary">{formatBedrag(q.omzet)}</td>
                                <td className="py-3 px-3 text-right tabular-nums text-orange-400">{formatBedrag(q.kosten)}</td>
                                <td className={cn("py-3 px-3 text-right tabular-nums font-semibold", q.winst >= 0 ? "text-green-400" : "text-red-400")}>
                                  {formatBedrag(q.winst)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-10 h-10 text-autronis-text-secondary/30 mx-auto mb-3" />
                  <p className="text-autronis-text-secondary font-medium">Nog geen financiele data</p>
                  <p className="text-sm text-autronis-text-secondary/70 mt-1">Maak facturen en registreer kosten om inzicht te krijgen</p>
                </div>
              )}
            </div>

            {/* Investeringen */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-autronis-text-primary">Investeringen</h2>
                <button
                  onClick={() => { resetInvForm(); setInvesteringModal(true); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-autronis-accent/15 text-autronis-accent rounded-lg text-xs font-semibold hover:bg-autronis-accent/25 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Investering
                </button>
              </div>

              {loadingInv ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-autronis-bg/50 rounded-xl animate-pulse" />)}</div>
              ) : investeringenLijst.length ? (
                <div className="space-y-4">
                  {/* KPI row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-autronis-bg/30 rounded-xl border border-autronis-border text-center">
                      <p className="text-xs text-autronis-text-secondary mb-1">Totaal</p>
                      <p className="text-lg font-bold text-autronis-text-primary tabular-nums">{formatBedrag(totaalInvestering)}</p>
                    </div>
                    <div className="p-3 bg-autronis-bg/30 rounded-xl border border-autronis-border text-center">
                      <p className="text-xs text-autronis-text-secondary mb-1">Afschrijving/jaar</p>
                      <p className="text-lg font-bold text-orange-400 tabular-nums">{formatBedrag(totaleAfschrijving)}</p>
                    </div>
                    <div className="p-3 bg-autronis-bg/30 rounded-xl border border-autronis-border text-center">
                      <p className="text-xs text-autronis-text-secondary mb-1">KIA aftrek</p>
                      <p className="text-lg font-bold text-green-400 tabular-nums">{formatBedrag(berekenKIA(totaalInvestering))}</p>
                    </div>
                  </div>
                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-autronis-border">
                          <th className="text-left py-3 px-3 text-autronis-text-secondary font-medium">Naam</th>
                          <th className="text-right py-3 px-3 text-autronis-text-secondary font-medium">Bedrag</th>
                          <th className="text-left py-3 px-3 text-autronis-text-secondary font-medium">Categorie</th>
                          <th className="text-right py-3 px-3 text-autronis-text-secondary font-medium">Termijn</th>
                          <th className="text-right py-3 px-3 text-autronis-text-secondary font-medium">Per jaar</th>
                          <th className="py-3 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {investeringenLijst.map((inv) => (
                          <tr key={inv.id} className="border-b border-autronis-border/50 hover:bg-autronis-bg/20 transition-colors">
                            <td className="py-3 px-3 font-medium text-autronis-text-primary">{inv.naam}</td>
                            <td className="py-3 px-3 text-right tabular-nums text-autronis-text-primary">{formatBedrag(inv.bedrag)}</td>
                            <td className="py-3 px-3 text-autronis-text-secondary">{inv.categorie}</td>
                            <td className="py-3 px-3 text-right tabular-nums text-autronis-text-secondary">{inv.afschrijvingstermijn}j</td>
                            <td className="py-3 px-3 text-right tabular-nums text-orange-400">
                              {formatBedrag((inv.bedrag - inv.restwaarde) / inv.afschrijvingstermijn)}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => handleOpenEditInvestering(inv)} className="p-1.5 text-autronis-text-secondary hover:text-autronis-accent transition-colors">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setDeleteInvesteringId(inv.id)} className="p-1.5 text-autronis-text-secondary hover:text-red-400 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-10 h-10 text-autronis-text-secondary/30 mx-auto mb-3" />
                  <p className="text-autronis-text-secondary font-medium">Nog geen investeringen</p>
                  <p className="text-sm text-autronis-text-secondary/70 mt-1">Voeg een investering toe om KIA-aftrek te berekenen</p>
                </div>
              )}
            </div>

            {/* Reserveringen */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-autronis-text-primary">Reserveringen {jaar}</h2>
                <button
                  onClick={() => setReserveringModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-500/25 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Reservering
                </button>
              </div>

              {loadingRes ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-autronis-bg/50 rounded-xl animate-pulse" />)}</div>
              ) : reserveringenData ? (
                <div className="space-y-5">
                  {/* Smart insight */}
                  <div className={cn(
                    "p-4 rounded-xl border",
                    reserveringTekort > 0 ? "bg-red-500/5 border-red-500/20" : "bg-green-500/5 border-green-500/20"
                  )}>
                    <div className="flex items-start gap-3">
                      <PiggyBank className={cn("w-5 h-5 flex-shrink-0 mt-0.5", reserveringTekort > 0 ? "text-red-400" : "text-green-400")} />
                      <div>
                        <p className={cn("text-sm font-semibold", reserveringTekort > 0 ? "text-red-400" : "text-green-400")}>
                          {reserveringTekort > 0
                            ? `Nog ${formatBedrag(reserveringTekort)} te reserveren`
                            : `${formatBedrag(Math.abs(reserveringTekort))} boven je geschatte belasting`}
                        </p>
                        <p className="text-xs text-autronis-text-secondary mt-1">
                          {formatBedrag(totaalGereserveerd)} gereserveerd van {formatBedrag(geschatteBelasting)} geschat
                          {reserveringenData.suggestieMaandelijks > 0 && (
                            <span> — zet maandelijks {formatBedrag(reserveringenData.suggestieMaandelijks)} apart</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-autronis-text-secondary">Voortgang reservering</p>
                      <p className="text-xs font-semibold text-autronis-text-primary tabular-nums">
                        {geschatteBelasting > 0 ? Math.round((totaalGereserveerd / geschatteBelasting) * 100) : 0}%
                      </p>
                    </div>
                    <div className="h-3 bg-autronis-bg rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          reserveringTekort <= 0 ? "bg-green-500" : reserveringTekort < geschatteBelasting * 0.3 ? "bg-yellow-500" : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(100, geschatteBelasting > 0 ? (totaalGereserveerd / geschatteBelasting) * 100 : 0)}%` }}
                      />
                    </div>
                  </div>

                  {/* Reserveringen lijst */}
                  {reserveringenData.reserveringen?.length > 0 && (
                    <div className="space-y-2">
                      {reserveringenData.reserveringen.map((res: { id: number; maand: string; bedrag: number; type: string }) => (
                        <div key={res.id} className="flex items-center justify-between p-3 bg-autronis-bg/30 rounded-xl border border-autronis-border">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-blue-500/10">
                              <PiggyBank className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-autronis-text-primary">{res.type}</p>
                              <p className="text-xs text-autronis-text-secondary">{res.maand}</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-autronis-text-primary tabular-nums">{formatBedrag(res.bedrag)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <PiggyBank className="w-10 h-10 text-autronis-text-secondary/30 mx-auto mb-3" />
                  <p className="text-autronis-text-secondary font-medium">Nog geen reserveringen</p>
                  <p className="text-sm text-autronis-text-secondary/70 mt-1">Start met reserveren zodat je belastingbetaling geen verrassing is</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== TAB: OPTIMALISATIE ===== */}
        {activeTab === "optimalisatie" && (
          <div className="space-y-6">
            {/* Kosten & Aftrek tips */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center gap-3 mb-5">
                <Wallet className="w-5 h-5 text-autronis-accent" />
                <h2 className="text-xl font-bold text-autronis-text-primary">Aftrekbare kosten</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { icon: Monitor, label: "Hardware", desc: "Laptop, telefoon, etc.", color: "text-blue-400", bg: "bg-blue-500/10" },
                  { icon: Globe, label: "Software", desc: "SaaS, licenties, hosting", color: "text-purple-400", bg: "bg-purple-500/10" },
                  { icon: Coffee, label: "Kantoor", desc: "Huur, inrichting, spullen", color: "text-amber-400", bg: "bg-amber-500/10" },
                  { icon: Car, label: "Vervoer", desc: "Km-vergoeding, OV", color: "text-cyan-400", bg: "bg-cyan-500/10" },
                  { icon: Megaphone, label: "Marketing", desc: "Ads, website, branding", color: "text-pink-400", bg: "bg-pink-500/10" },
                  { icon: GraduationCap, label: "Opleiding", desc: "Cursussen, boeken", color: "text-indigo-400", bg: "bg-indigo-500/10" },
                  { icon: Wrench, label: "Diensten", desc: "Boekhouder, adviseur", color: "text-orange-400", bg: "bg-orange-500/10" },
                  { icon: CreditCard, label: "Bankkosten", desc: "Rekening, transacties", color: "text-emerald-400", bg: "bg-emerald-500/10" },
                  { icon: Receipt, label: "Verzekeringen", desc: "AOV, bedrijfspolis", color: "text-red-400", bg: "bg-red-500/10" },
                  { icon: BookOpen, label: "Administratie", desc: "7 jaar bewaren!", color: "text-teal-400", bg: "bg-teal-500/10" },
                ].map((item) => (
                  <div key={item.label} className="p-3 bg-autronis-bg/30 border border-autronis-border rounded-xl">
                    <div className={cn("p-2 rounded-lg w-fit mb-2", item.bg)}>
                      <item.icon className={cn("w-4 h-4", item.color)} />
                    </div>
                    <p className="text-sm font-medium text-autronis-text-primary">{item.label}</p>
                    <p className="text-xs text-autronis-text-secondary">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Fiscale aftrekposten */}
              <h3 className="text-sm font-semibold text-autronis-text-secondary mt-6 mb-3">Fiscale regelingen</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { naam: "Zelfstandigenaftrek", waarde: "3.750", status: urenCriterium?.zelfstandigenaftrek ? "ok" as const : "warning" as const },
                  { naam: "Startersaftrek", waarde: "2.123", status: "warning" as const },
                  { naam: "MKB-winstvrijstelling", waarde: "14%", status: urenCriterium?.mkbVrijstelling ? "ok" as const : "warning" as const },
                  { naam: "KIA", waarde: "tot 28%", status: totaalInvestering > 0 ? "ok" as const : "warning" as const },
                  { naam: "FOR opbouw", waarde: "max 9,44%", status: "warning" as const },
                  { naam: "Km-vergoeding", waarde: "0,23/km", status: "warning" as const },
                ].map((item) => {
                  const cfg = getStatusIndicator(item.status);
                  return (
                    <div key={item.naam} className="flex items-center justify-between p-3 bg-autronis-bg/30 border border-autronis-border rounded-xl">
                      <div>
                        <p className="text-sm text-autronis-text-primary">{item.naam}</p>
                        <p className="text-xs text-autronis-text-secondary">{item.waarde}</p>
                      </div>
                      <span className={cn("w-2.5 h-2.5 rounded-full", cfg.dot)} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Subsidies */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center gap-3 mb-5">
                <Gift className="w-5 h-5 text-autronis-accent" />
                <h2 className="text-xl font-bold text-autronis-text-primary">Subsidies & Regelingen</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { naam: "WBSO", desc: "R&D loonkostenaftrek voor technisch onderzoek en softwareontwikkeling.", voordeel: "Tot 32% loonkostenaftrek", relevant: "ok" as const, url: "https://www.rvo.nl/subsidies-financiering/wbso" },
                  { naam: "Innovatiebox", desc: "Verlaagd tarief (9%) op winst uit innovatieve activiteiten.", voordeel: "9% in plaats van 26,9%", relevant: "ok" as const, url: "https://www.belastingdienst.nl/wps/wcm/connect/nl/innovatiebox" },
                  { naam: "SLIM-regeling", desc: "Subsidie voor scholing en ontwikkeling van werknemers in het MKB.", voordeel: "Max 24.999", relevant: "warning" as const, url: "https://www.rvo.nl/subsidies-financiering/slim" },
                  { naam: "MIT", desc: "MKB Innovatiestimulering Topsectoren voor innovatieprojecten.", voordeel: "Max 20.000 haalbaarheid", relevant: "warning" as const, url: "https://www.rvo.nl/subsidies-financiering/mit" },
                  { naam: "EIA", desc: "Energie-investeringsaftrek voor energiebesparende investeringen.", voordeel: "45,5% extra aftrek", relevant: "warning" as const, url: "https://www.rvo.nl/subsidies-financiering/eia" },
                  { naam: "Groeifaciliteit", desc: "Overheidsgarantie waardoor financiers meer risico durven nemen.", voordeel: "50% garantie", relevant: "warning" as const, url: "https://www.rvo.nl/subsidies-financiering/groeifaciliteit" },
                ].map((sub) => (
                  <div key={sub.naam} className="p-4 bg-autronis-bg/30 border border-autronis-border rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-bold text-autronis-text-primary">{sub.naam}</span>
                      <StatusBadge status={sub.relevant} label={sub.relevant === "ok" ? "Relevant" : "Bekijk"} />
                    </div>
                    <p className="text-xs text-autronis-text-secondary mb-2">{sub.desc}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-autronis-accent">{sub.voordeel}</span>
                      <a href={sub.url} target="_blank" rel="noopener noreferrer" className="text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors flex items-center gap-1">
                        Meer info <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Belasting tips */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center gap-3 mb-5">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                <h2 className="text-xl font-bold text-autronis-text-primary">Belastingtips</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "Investeer slim: doe aankopen boven 2.800 voor KIA-aftrek",
                  "Vraag een voorlopige aanslag aan zodat je niet alles in een keer betaalt",
                  "Reserveer maandelijks 30% van je winst voor belasting",
                  "Houd je uren nauwkeurig bij voor het urencriterium (1.225 uur)",
                  "Overweeg FOR-opbouw als extra pensioenvoorziening",
                  "Check of je in aanmerking komt voor WBSO (R&D aftrek)",
                  "Plan facturen strategisch rond het jaareinde",
                  "Vergeet de thuiswerkplek-aftrek niet als je vanuit huis werkt",
                ].map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-xl">
                    <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-autronis-text-primary">{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Jaaroverzicht export */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <FileBarChart className="w-5 h-5 text-autronis-accent" />
                  <h2 className="text-xl font-bold text-autronis-text-primary">Jaaroverzicht {jaar}</h2>
                </div>
                <button
                  onClick={() => addToast("PDF export komt binnenkort", "succes")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-autronis-accent/15 text-autronis-accent rounded-lg text-xs font-semibold hover:bg-autronis-accent/25 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> PDF Export
                </button>
              </div>

              {loadingJaar ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonKPI key={i} />)}</div>
              ) : jaaroverzichtData ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-center">
                      <p className="text-xs text-autronis-text-secondary mb-1">Omzet</p>
                      <p className="text-xl font-bold text-emerald-400 tabular-nums">{formatBedrag(jaaroverzichtData.omzet.totaal)}</p>
                    </div>
                    <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl text-center">
                      <p className="text-xs text-autronis-text-secondary mb-1">Kosten</p>
                      <p className="text-xl font-bold text-orange-400 tabular-nums">{formatBedrag(jaaroverzichtData.kosten.totaal)}</p>
                    </div>
                    <div className="p-4 bg-autronis-accent/5 border border-autronis-accent/20 rounded-xl text-center">
                      <p className="text-xs text-autronis-text-secondary mb-1">Winst</p>
                      <p className="text-xl font-bold text-autronis-accent tabular-nums">{formatBedrag(jaaroverzichtData.winstVerlies.brutowinst)}</p>
                    </div>
                    <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl text-center">
                      <p className="text-xs text-autronis-text-secondary mb-1">Belasting</p>
                      <p className="text-xl font-bold text-purple-400 tabular-nums">{formatBedrag(jaaroverzichtData.winstVerlies.geschatteBelasting)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-3 bg-autronis-bg/30 border border-autronis-border rounded-xl">
                      <p className="text-xs text-autronis-text-secondary mb-1">BTW afgedragen</p>
                      <p className="text-base font-bold text-autronis-text-primary tabular-nums">{formatBedrag(jaaroverzichtData.btw.afgedragen)}</p>
                    </div>
                    <div className="p-3 bg-autronis-bg/30 border border-autronis-border rounded-xl">
                      <p className="text-xs text-autronis-text-secondary mb-1">Uren gewerkt</p>
                      <p className="text-base font-bold text-autronis-text-primary tabular-nums">
                        {jaaroverzichtData.uren.totaal} / {jaaroverzichtData.uren.doel}
                      </p>
                    </div>
                    <div className="p-3 bg-autronis-bg/30 border border-autronis-border rounded-xl">
                      <p className="text-xs text-autronis-text-secondary mb-1">Investeringen</p>
                      <p className="text-base font-bold text-autronis-text-primary tabular-nums">{formatBedrag(jaaroverzichtData.investeringen.totaal)}</p>
                    </div>
                    <div className="p-3 bg-autronis-bg/30 border border-autronis-border rounded-xl">
                      <p className="text-xs text-autronis-text-secondary mb-1">Gereserveerd</p>
                      <p className="text-base font-bold text-autronis-text-primary tabular-nums">{formatBedrag(jaaroverzichtData.reserveringen.gereserveerd)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileBarChart className="w-10 h-10 text-autronis-text-secondary/30 mx-auto mb-3" />
                  <p className="text-autronis-text-secondary font-medium">Nog geen jaaroverzicht beschikbaar</p>
                </div>
              )}
            </div>

            {/* Audit log */}
            {auditLogData && auditLogData.length > 0 && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                <div className="flex items-center gap-3 mb-5">
                  <History className="w-5 h-5 text-autronis-text-secondary" />
                  <h2 className="text-xl font-bold text-autronis-text-primary">Recente wijzigingen</h2>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditLogData.slice(0, 15).map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 p-3 bg-autronis-bg/20 rounded-xl text-sm">
                      <CircleDot className="w-3.5 h-3.5 text-autronis-text-secondary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-autronis-text-primary">{entry.actie}</span>
                        <span className="text-autronis-text-secondary ml-1.5">{entry.entiteitType}</span>
                        {entry.details && <span className="text-autronis-text-secondary/70 ml-1.5">— {entry.details}</span>}
                      </div>
                      <span className="text-xs text-autronis-text-secondary/50 flex-shrink-0 tabular-nums">{formatDatum(entry.tijdstip)}</span>
                    </div>
                  ))}
                </div>
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
