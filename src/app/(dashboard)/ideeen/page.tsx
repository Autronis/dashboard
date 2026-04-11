"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { marked } from "marked";
import {
  Lightbulb,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
  X,
  Edit,
  Loader2,
  ExternalLink,
  FileText,
  Sparkles,
  ArrowUpCircle,
  Target,
  TrendingUp,
  Users,
  User,
  ArrowRight,
  Zap,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  MessageCircle,
  Send,
  Bot,
  PenLine,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Archive,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useIdeeen,
  useCreateIdee,
  useUpdateIdee,
  useDeleteIdee,
  useStartProject,
  useSyncBacklog,
  useGenereerIdeeen,
  usePromoveerIdee,
  useRegenereerPlan,
  useVerwerkNotitie,
  type Idee,
  type VerwerkSuggestie,
} from "@/hooks/queries/use-ideeen";
import { useProjecten } from "@/hooks/queries/use-projecten";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { motion, AnimatePresence } from "framer-motion";

// ============ CONSTANTS ============

const statusOpties = [
  { key: "idee", label: "Idee" },
  { key: "uitgewerkt", label: "Uitgewerkt" },
  { key: "actief", label: "Actief" },
  { key: "gebouwd", label: "Gebouwd" },
] as const;

const categorieOpties = [
  { key: "dashboard", label: "Dashboard" },
  { key: "klant_verkoop", label: "Klant/Verkoop" },
  { key: "intern", label: "Intern" },
  { key: "dev_tools", label: "Dev Tools" },
  { key: "content_media", label: "Content & Media" },
  { key: "geld_groei", label: "Geld & Groei" },
  { key: "experimenteel", label: "Experimenteel" },
  { key: "website", label: "Website" },
  { key: "inzicht", label: "Inzicht" },
] as const;

const prioriteitOpties = [
  { key: "laag", label: "Laag" },
  { key: "normaal", label: "Normaal" },
  { key: "hoog", label: "Hoog" },
] as const;

const categorieBadgeKleuren: Record<string, string> = {
  dashboard: "bg-blue-500/15 text-blue-400",
  klant_verkoop: "bg-emerald-500/15 text-emerald-400",
  intern: "bg-autronis-accent/15 text-autronis-accent",
  dev_tools: "bg-orange-500/15 text-orange-400",
  content_media: "bg-pink-500/15 text-pink-400",
  geld_groei: "bg-yellow-500/15 text-yellow-400",
  experimenteel: "bg-purple-500/15 text-purple-400",
  website: "bg-cyan-500/15 text-cyan-400",
  inzicht: "bg-amber-500/15 text-amber-400",
};

const statusBadgeKleuren: Record<string, string> = {
  idee: "bg-gray-500/15 text-gray-400",
  uitgewerkt: "bg-blue-500/15 text-blue-400",
  actief: "bg-autronis-accent/15 text-autronis-accent",
  gebouwd: "bg-emerald-500/15 text-emerald-400",
};

type SortOptie = "score" | "naam" | "status" | "categorie" | "datum" | "impact" | "effort" | "revenue";

function categorieLabel(key: string): string {
  return categorieOpties.find((c) => c.key === key)?.label || key;
}
function statusLabel(key: string): string {
  return statusOpties.find((s) => s.key === key)?.label || key;
}
function prioriteitLabel(key: string): string {
  return prioriteitOpties.find((p) => p.key === key)?.label || key;
}

function calcPriorityScore(idee: Idee): number {
  const impact = idee.impact ?? 0;
  const effort = idee.effort ?? 0;
  const revenue = idee.revenuePotential ?? 0;
  if (impact === 0 && effort === 0 && revenue === 0) return idee.aiScore ?? 0;
  const effortInverted = 11 - Math.max(1, Math.min(10, effort));
  return Math.round((impact + revenue + effortInverted) / 3 * 10) / 10;
}

function scoreKleur(score: number | null): string {
  if (score == null || score === 0) return "bg-gray-500/15 text-gray-400";
  if (score >= 8) return "bg-emerald-500/15 text-emerald-400";
  if (score >= 5) return "bg-amber-500/15 text-amber-400";
  return "bg-red-500/15 text-red-400";
}

// ============ MAIN PAGE ============

export default function IdeeenPage() {
  const { addToast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"alle" | "ai" | "inzichten">("alle");
  const [inzichtInput, setInzichtInput] = useState("");
  const inzichtInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prefill = localStorage.getItem("autronis-kans-prefill");
    if (prefill) {
      setInzichtInput(prefill);
      setActiveTab("inzichten");
      localStorage.removeItem("autronis-kans-prefill");
      setTimeout(() => inzichtInputRef.current?.focus(), 150);
    }
  }, []);
  const [filterStatus, setFilterStatus] = useState("idee");
  const [filterCategorie, setFilterCategorie] = useState("");
  const [filterDoelgroep, setFilterDoelgroep] = useState("");
  const [filterMinScore, setFilterMinScore] = useState(0);
  const [sortBy, setSortBy] = useState<SortOptie>("score");

  const { data: ideeen = [], isLoading } = useIdeeen();

  const createMutation = useCreateIdee();
  const updateMutation = useUpdateIdee();
  const deleteMutation = useDeleteIdee();
  const startProjectMutation = useStartProject();
  const syncBacklogMutation = useSyncBacklog();
  const genereerMutation = useGenereerIdeeen();
  const promoveerMutation = usePromoveerIdee();
  const regenereerPlanMutation = useRegenereerPlan();
  const verwerkMutation = useVerwerkNotitie();
  const { data: projectenLijst = [] } = useProjecten();

  const [verwerkResult, setVerwerkResult] = useState<{ notitieId: number; suggestie: VerwerkSuggestie } | null>(null);
  const [koppelNotitieId, setKoppelNotitieId] = useState<number | null>(null);

  // Analyse state
  const [analyseLoading, setAnalyseLoading] = useState(false);
  const [analyseResult, setAnalyseResult] = useState<{
    gebouwd: Array<{ id: number; reden: string }>;
    duplicaten: Array<{ behouden_id: number; verwijder_id: number; reden: string; nieuwe_naam?: string; nieuwe_omschrijving?: string }>;
    verouderd: Array<{ id: number; reden: string }>;
    notities_bij_project: Array<{ id: number; project: string; reden: string }>;
    samenvatting: string;
  } | null>(null);

  const runAnalyse = async () => {
    setAnalyseLoading(true);
    try {
      const res = await fetch("/api/ideeen/analyse", { method: "POST" });
      if (!res.ok) throw new Error("Analyse mislukt");
      const data = await res.json();
      setAnalyseResult(data.analyse);
    } catch {
      addToast("Analyse mislukt", "fout");
    } finally {
      setAnalyseLoading(false);
    }
  };

  const applyAnalyse = async () => {
    if (!analyseResult) return;
    // Mark as built
    for (const item of analyseResult.gebouwd) {
      updateMutation.mutate({ id: item.id, body: { status: "gebouwd" } });
    }
    // Delete duplicates
    for (const item of analyseResult.duplicaten) {
      deleteMutation.mutate(item.verwijder_id);
      if (item.nieuwe_naam || item.nieuwe_omschrijving) {
        updateMutation.mutate({ id: item.behouden_id, body: { naam: item.nieuwe_naam, omschrijving: item.nieuwe_omschrijving } });
      }
    }
    // Delete outdated
    for (const item of analyseResult.verouderd) {
      deleteMutation.mutate(item.id);
    }
    setAnalyseResult(null);
    addToast("Backlog opgeschoond");
  };

  const [detailIdee, setDetailIdee] = useState<Idee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editIdee, setEditIdee] = useState<Idee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notionUrl, setNotionUrl] = useState<string | null>(null);
  const [scoringIdee, setScoringIdee] = useState<number | null>(null);
  const [startModusOpen, setStartModusOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "lijst">("grid");
  const [discardExpanded, setDiscardExpanded] = useState(false);

  // Form state
  const [formNaam, setFormNaam] = useState("");
  const [formNummer, setFormNummer] = useState("");
  const [formCategorie, setFormCategorie] = useState("");
  const [formStatus, setFormStatus] = useState("idee");
  const [formPrioriteit, setFormPrioriteit] = useState("normaal");
  const [formOmschrijving, setFormOmschrijving] = useState("");
  const [formUitwerking, setFormUitwerking] = useState("");

  // DAAN spar state
  const [nieuwKeuzeOpen, setNieuwKeuzeOpen] = useState(false);
  const [daanOpen, setDaanOpen] = useState(false);
  const [daanInput, setDaanInput] = useState("");
  const [daanMessages, setDaanMessages] = useState<Array<{ role: "user" | "daan"; text: string }>>([]);
  const [daanVragen, setDaanVragen] = useState<string[]>([]);
  const [daanVraagIndex, setDaanVraagIndex] = useState(0);
  const [daanOrigineelIdee, setDaanOrigineelIdee] = useState("");
  const [daanLoading, setDaanLoading] = useState(false);
  const [daanStap, setDaanStap] = useState<"input" | "vragen" | "klaar">("input");
  const daanChatRef = useRef<HTMLDivElement>(null);
  const keuzeRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!nieuwKeuzeOpen) return;
    function handleClick(e: MouseEvent) {
      if (keuzeRef.current && !keuzeRef.current.contains(e.target as Node)) {
        setNieuwKeuzeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [nieuwKeuzeOpen]);

  // Auto-scroll DAAN chat
  useEffect(() => {
    if (daanChatRef.current) {
      daanChatRef.current.scrollTop = daanChatRef.current.scrollHeight;
    }
  }, [daanMessages, daanVraagIndex]);

  // Scoring form
  const [scoreImpact, setScoreImpact] = useState(5);
  const [scoreEffort, setScoreEffort] = useState(5);
  const [scoreRevenue, setScoreRevenue] = useState(5);

  const liveScore = useMemo(() => {
    const effortInverted = 11 - Math.max(1, Math.min(10, scoreEffort));
    return Math.round((scoreImpact + scoreRevenue + effortInverted) / 3 * 10) / 10;
  }, [scoreImpact, scoreEffort, scoreRevenue]);

  // Data splits
  const backlogIdeeen = ideeen.filter((i) => (i.isAiSuggestie !== 1 || i.gepromoveerd === 1) && i.categorie !== "inzicht");
  const inzichtIdeeen = ideeen.filter((i) => i.categorie === "inzicht").sort((a, b) => b.aangemaaktOp.localeCompare(a.aangemaaktOp));
  const aiSuggesties = ideeen.filter((i) => i.isAiSuggestie === 1 && i.gepromoveerd !== 1);

  // KPIs
  const totaal = backlogIdeeen.length;
  const uitgewerkt = backlogIdeeen.filter((i) => i.status === "uitgewerkt").length;
  const actief = backlogIdeeen.filter((i) => i.status === "actief").length;
  const gebouwd = backlogIdeeen.filter((i) => i.status === "gebouwd").length;

  // Categorie counts
  const categorieCount: Record<string, number> = {};
  for (const idee of backlogIdeeen) {
    const cat = idee.categorie || "overig";
    categorieCount[cat] = (categorieCount[cat] || 0) + 1;
  }

  // Filtered + sorted
  const gefilterd = backlogIdeeen
    .filter((i) => !filterStatus || i.status === filterStatus)
    .filter((i) => !filterCategorie || i.categorie === filterCategorie)
    .filter((i) => filterMinScore === 0 || calcPriorityScore(i) >= filterMinScore);

  const alleIdeeen = [...gefilterd].sort((a, b) => {
    switch (sortBy) {
      case "score": return calcPriorityScore(b) - calcPriorityScore(a);
      case "impact": return (b.impact ?? 0) - (a.impact ?? 0);
      case "effort": return (a.effort ?? 10) - (b.effort ?? 10);
      case "revenue": return (b.revenuePotential ?? 0) - (a.revenuePotential ?? 0);
      case "naam": return a.naam.localeCompare(b.naam);
      case "status": {
        const order: Record<string, number> = { gebouwd: 0, actief: 1, uitgewerkt: 2, idee: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      }
      case "categorie": return (a.categorie ?? "").localeCompare(b.categorie ?? "");
      case "datum": return (b.aangemaaktOp ?? "").localeCompare(a.aangemaaktOp ?? "");
      default: return 0;
    }
  });

  const aiFiltered = filterDoelgroep ? aiSuggesties.filter((i) => i.doelgroep === filterDoelgroep) : aiSuggesties;
  const aiSorted = [...aiFiltered].sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0));

  const aiTotaal = aiSuggesties.length;
  const aiGemScore = aiTotaal > 0 ? Math.round((aiSuggesties.reduce((sum, i) => sum + (i.aiScore ?? 0), 0) / aiTotaal) * 10) / 10 : 0;
  const aiKlant = aiSuggesties.filter((i) => i.doelgroep === "klant").length;
  const aiPersoonlijk = aiSuggesties.filter((i) => i.doelgroep === "persoonlijk").length;

  // === DECISION DATA ===
  // Top 3 to build next (highest score, status=idee or uitgewerkt)
  const topToBuild = useMemo(() =>
    backlogIdeeen
      .filter((i) => i.status === "idee" || i.status === "uitgewerkt")
      .sort((a, b) => calcPriorityScore(b) - calcPriorityScore(a))
      .slice(0, 3),
    [backlogIdeeen]
  );

  // Ideas to discard (low score + old)
  const toDiscard = useMemo(() =>
    backlogIdeeen
      .filter((i) => i.status === "idee" && calcPriorityScore(i) < 3 && calcPriorityScore(i) > 0)
      .slice(0, 3),
    [backlogIdeeen]
  );

  // Pipeline stats
  const pipelineStats = useMemo(() => {
    const statusCounts = { idee: 0, uitgewerkt: 0, actief: 0, gebouwd: 0 };
    for (const i of backlogIdeeen) {
      if (i.status in statusCounts) statusCounts[i.status as keyof typeof statusCounts]++;
    }
    return statusCounts;
  }, [backlogIdeeen]);

  // Insights: most valuable category
  const categoryInsight = useMemo(() => {
    const catScores: Record<string, { total: number; count: number }> = {};
    for (const i of backlogIdeeen) {
      const cat = i.categorie ?? "overig";
      if (!catScores[cat]) catScores[cat] = { total: 0, count: 0 };
      catScores[cat].total += calcPriorityScore(i);
      catScores[cat].count++;
    }
    const entries = Object.entries(catScores).filter(([, v]) => v.count >= 2);
    if (entries.length === 0) return null;
    entries.sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count));
    const [cat, data] = entries[0];
    return { categorie: cat, gemScore: Math.round(data.total / data.count * 10) / 10, count: data.count };
  }, [backlogIdeeen]);

  // Cluster insight
  const clusterInsight = useMemo(() => {
    const cats = Object.entries(categorieCount).sort((a, b) => b[1] - a[1]);
    if (cats.length === 0) return null;
    return { categorie: cats[0][0], count: cats[0][1], percentage: Math.round((cats[0][1] / totaal) * 100) };
  }, [categorieCount, totaal]);

  // Proactive: ideas sitting in "Idee" for 7+ days without uitwerking
  const proactiveCount = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return backlogIdeeen.filter((i) => i.status === "idee" && new Date(i.aangemaaktOp) < cutoff && !i.uitwerking).length;
  }, [backlogIdeeen]);

  // ============ HANDLERS ============

  function openNieuwForm() {
    setEditIdee(null);
    setFormNaam(""); setFormNummer(""); setFormCategorie(""); setFormStatus("idee");
    setFormPrioriteit("normaal"); setFormOmschrijving(""); setFormUitwerking("");
    setFormOpen(true);
  }

  function openEditForm(idee: Idee) {
    setEditIdee(idee);
    setFormNaam(idee.naam);
    setFormNummer(idee.nummer != null ? String(idee.nummer) : "");
    setFormCategorie(idee.categorie || "");
    setFormStatus(idee.status);
    setFormPrioriteit(idee.prioriteit);
    setFormOmschrijving(idee.omschrijving || "");
    setFormUitwerking(idee.uitwerking || "");
    setDetailIdee(null);
    setFormOpen(true);
  }

  function openScoring(idee: Idee) {
    setScoringIdee(idee.id);
    setScoreImpact(idee.impact ?? 5);
    setScoreEffort(idee.effort ?? 5);
    setScoreRevenue(idee.revenuePotential ?? 5);
  }

  function handleSaveScore() {
    if (!scoringIdee) return;
    updateMutation.mutate(
      { id: scoringIdee, body: { impact: scoreImpact, effort: scoreEffort, revenuePotential: scoreRevenue } },
      {
        onSuccess: () => { addToast("Score opgeslagen", "succes"); setScoringIdee(null); },
        onError: () => addToast("Score opslaan mislukt", "fout"),
      }
    );
  }

  function handleOpslaan() {
    if (!formNaam.trim()) { addToast("Naam is verplicht", "fout"); return; }
    const body = {
      naam: formNaam.trim(), nummer: formNummer ? Number(formNummer) : null,
      categorie: formCategorie || null, status: formStatus, prioriteit: formPrioriteit,
      omschrijving: formOmschrijving.trim() || null, uitwerking: formUitwerking.trim() || null,
    };
    if (editIdee) {
      updateMutation.mutate({ id: editIdee.id, body }, {
        onSuccess: () => { addToast("Idee bijgewerkt", "succes"); setFormOpen(false); },
        onError: () => addToast("Kon idee niet bijwerken", "fout"),
      });
    } else {
      createMutation.mutate(body, {
        onSuccess: () => { addToast("Idee aangemaakt", "succes"); setFormOpen(false); },
        onError: () => addToast("Kon idee niet aanmaken", "fout"),
      });
    }
  }

  function handleDelete() {
    if (!detailIdee) return;
    deleteMutation.mutate(detailIdee.id, {
      onSuccess: () => { addToast("Idee verwijderd", "succes"); setDetailIdee(null); setDeleteDialogOpen(false); },
      onError: () => addToast("Kon idee niet verwijderen", "fout"),
    });
  }

  function handleStartProject() {
    if (!detailIdee) return;
    setStartModusOpen(true);
  }

  function openStartProject(idee: Idee) {
    setDetailIdee(idee);
    setStartModusOpen(true);
  }

  function handleStartWithModus(modus: "team" | "zelf") {
    if (!detailIdee) return;
    setStartModusOpen(false);
    startProjectMutation.mutate({ id: detailIdee.id, modus }, {
      onSuccess: (data) => {
        addToast(`Project "${data.project.naam}" aangemaakt`, "succes");
        setDetailIdee(null);
        if (modus === "team") {
          router.push("/ops-room");
        } else {
          router.push(`/projecten/${data.project.id}`);
        }
      },
      onError: (err) => addToast(err.message || "Kon project niet starten", "fout"),
    });
  }

  function handleGenereer() {
    genereerMutation.mutate(undefined, {
      onSuccess: () => addToast("Nieuwe AI-ideeën gegenereerd", "succes"),
      onError: (err) => addToast(err.message || "Genereren mislukt", "fout"),
    });
  }

  function handlePromoveer(id: number) {
    promoveerMutation.mutate(id, {
      onSuccess: () => addToast("Idee gepromoveerd naar backlog", "succes"),
      onError: () => addToast("Promoveren mislukt", "fout"),
    });
  }

  function handleRegenereerPlan() {
    if (!detailIdee) return;
    setNotionUrl(null);
    regenereerPlanMutation.mutate(detailIdee.id, {
      onSuccess: (data: { notionUrl?: string }) => { addToast("Notion plan gegenereerd", "succes"); if (data.notionUrl) setNotionUrl(data.notionUrl); },
      onError: (err) => addToast(err.message || "Regenereren mislukt", "fout"),
    });
  }

  function handleSaveInzicht() {
    const tekst = inzichtInput.trim();
    if (!tekst) return;
    const naam = tekst.length > 60 ? tekst.slice(0, 60) : tekst;
    createMutation.mutate(
      { naam, omschrijving: tekst.length > 60 ? tekst : null, categorie: "inzicht", status: "idee", prioriteit: "normaal" },
      {
        onSuccess: () => { setInzichtInput(""); inzichtInputRef.current?.focus(); },
        onError: () => addToast("Opslaan mislukt", "fout"),
      }
    );
  }

  function handleSyncBacklog() {
    syncBacklogMutation.mutate(undefined, {
      onSuccess: (data) => addToast(`Sync klaar: ${data.nieuw} nieuw, ${data.bijgewerkt} bijgewerkt`, "succes"),
      onError: (err) => addToast(err.message || "Sync mislukt", "fout"),
    });
  }

  // === DAAN SPAR HANDLERS ===

  const handleDaanStart = useCallback(async () => {
    if (!daanInput.trim()) return;
    const idee = daanInput.trim();
    setDaanOrigineelIdee(idee);
    setDaanMessages([{ role: "user", text: idee }]);
    setDaanLoading(true);
    setDaanInput("");

    try {
      const res = await fetch("/api/ops-room/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opdracht: idee, mode: "intake" }),
      });
      const data = await res.json();

      if (data.mode === "idee" && data.vragen?.length > 0) {
        setDaanVragen(data.vragen);
        setDaanVraagIndex(0);
        setDaanStap("vragen");
        setDaanMessages((prev) => [
          ...prev,
          { role: "daan", text: `Leuk idee! Laat me een paar vragen stellen om het concreter te maken.` },
          { role: "daan", text: data.vragen[0] },
        ]);
      } else {
        // Not an idea or no questions — just create directly
        setDaanMessages((prev) => [
          ...prev,
          { role: "daan", text: "Dit klinkt als een concrete taak. Ik maak het direct aan als idee." },
        ]);
        await handleDaanSynth(idee, "");
      }
    } catch {
      addToast("Brent kon niet bereikt worden", "fout");
      setDaanStap("input");
    } finally {
      setDaanLoading(false);
    }
  }, [daanInput, addToast]);

  const handleDaanAntwoord = useCallback(async () => {
    if (!daanInput.trim()) return;
    const antwoord = daanInput.trim();
    setDaanInput("");
    setDaanMessages((prev) => [...prev, { role: "user", text: antwoord }]);

    const nextIndex = daanVraagIndex + 1;
    if (nextIndex < daanVragen.length) {
      // More questions
      setDaanVraagIndex(nextIndex);
      setDaanMessages((prev) => [...prev, { role: "daan", text: daanVragen[nextIndex] }]);
    } else {
      // All answered — synthesize
      setDaanLoading(true);
      setDaanMessages((prev) => [...prev, { role: "daan", text: "Top, ik werk je idee uit..." }]);

      const context = daanMessages
        .filter((m) => m.role === "daan" || m.role === "user")
        .concat([{ role: "user", text: antwoord }])
        .slice(1) // skip original idea message
        .map((m) => `${m.role === "daan" ? "DAAN" : "Sem"}: ${m.text}`)
        .join("\n");

      await handleDaanSynth(daanOrigineelIdee, context);
      setDaanLoading(false);
    }
  }, [daanInput, daanVraagIndex, daanVragen, daanMessages, daanOrigineelIdee]);

  const handleDaanSynth = useCallback(async (opdracht: string, context: string) => {
    try {
      const res = await fetch("/api/ops-room/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opdracht, context, mode: "idee_synth" }),
      });
      const data = await res.json();

      if (data.fout) {
        setDaanMessages((prev) => [...prev, { role: "daan", text: `Fout: ${data.fout}` }]);
        return;
      }

      // Create the idea
      createMutation.mutate(
        {
          naam: data.naam,
          categorie: data.categorie || null,
          omschrijving: data.omschrijving || null,
          uitwerking: data.uitwerking || null,
          prioriteit: data.prioriteit || "normaal",
        },
        {
          onSuccess: () => {
            setDaanMessages((prev) => [
              ...prev,
              { role: "daan", text: `Idee "${data.naam}" is aangemaakt! Je vindt het in je backlog.` },
            ]);
            setDaanStap("klaar");
            addToast(`Idee "${data.naam}" aangemaakt via Brent`, "succes");
          },
          onError: () => {
            setDaanMessages((prev) => [...prev, { role: "daan", text: "Kon het idee niet opslaan." }]);
          },
        }
      );
    } catch {
      setDaanMessages((prev) => [...prev, { role: "daan", text: "Er ging iets mis bij het uitwerken." }]);
    }
  }, [createMutation, addToast]);

  function resetDaan() {
    setDaanOpen(false);
    setDaanInput("");
    setDaanMessages([]);
    setDaanVragen([]);
    setDaanVraagIndex(0);
    setDaanOrigineelIdee("");
    setDaanStap("input");
    setDaanLoading(false);
  }

  const inputClasses = "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";
  const selectClasses = "bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-2 border-autronis-accent/30 border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="max-w-[1400px] mx-auto p-4 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-autronis-text-primary tracking-tight">Ideeën</h1>
        <p className="text-sm sm:text-base text-autronis-text-secondary mt-1">Van idee naar executie</p>
      </div>

      {/* Tabs + Analyse */}
      <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab("alle")} className={cn("px-5 py-2.5 rounded-lg text-sm font-medium transition-colors", activeTab === "alle" ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary")}>Alle Ideeën</button>
        <button onClick={() => setActiveTab("ai")} className={cn("inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors", activeTab === "ai" ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary")}>
          <Sparkles className="w-4 h-4" />AI Suggesties
          {aiTotaal > 0 && <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full", activeTab === "ai" ? "bg-autronis-bg/20 text-autronis-bg" : "bg-autronis-accent/15 text-autronis-accent")}>{aiTotaal}</span>}
        </button>
        <button onClick={() => setActiveTab("inzichten")} className={cn("inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors", activeTab === "inzichten" ? "bg-amber-500 text-white" : "text-autronis-text-secondary hover:text-autronis-text-primary")}>
          <PenLine className="w-4 h-4" />Notities
          {inzichtIdeeen.length > 0 && <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full", activeTab === "inzichten" ? "bg-white/20 text-white" : "bg-amber-500/15 text-amber-400")}>{inzichtIdeeen.length}</span>}
        </button>
      </div>
      <button
        onClick={runAnalyse}
        disabled={analyseLoading}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
      >
        {analyseLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {analyseLoading ? "Analyseren..." : "Backlog opschonen"}
      </button>
      </div>

      {/* Analyse resultaat */}
      <AnimatePresence>
        {analyseResult && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-autronis-card border border-purple-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-autronis-text-primary">AI Analyse</span>
              </div>
              <button onClick={() => setAnalyseResult(null)} className="text-autronis-text-secondary/40 hover:text-autronis-text-primary"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-autronis-text-secondary">{analyseResult.samenvatting}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {analyseResult.gebouwd.length > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                  <p className="text-xs font-medium text-emerald-400 mb-2">Al gebouwd ({analyseResult.gebouwd.length})</p>
                  {analyseResult.gebouwd.map((item) => {
                    const idee = ideeen.find((i) => i.id === item.id);
                    return <p key={item.id} className="text-[11px] text-autronis-text-secondary">{idee?.naam || `#${item.id}`} — {item.reden}</p>;
                  })}
                </div>
              )}
              {analyseResult.duplicaten.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs font-medium text-amber-400 mb-2">Duplicaten ({analyseResult.duplicaten.length})</p>
                  {analyseResult.duplicaten.map((item) => {
                    const verwijder = ideeen.find((i) => i.id === item.verwijder_id);
                    return <p key={item.verwijder_id} className="text-[11px] text-autronis-text-secondary">Verwijder: {verwijder?.naam || `#${item.verwijder_id}`} — {item.reden}</p>;
                  })}
                </div>
              )}
              {analyseResult.verouderd.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-xs font-medium text-red-400 mb-2">Verouderd ({analyseResult.verouderd.length})</p>
                  {analyseResult.verouderd.map((item) => {
                    const idee = ideeen.find((i) => i.id === item.id);
                    return <p key={item.id} className="text-[11px] text-autronis-text-secondary">{idee?.naam || `#${item.id}`} — {item.reden}</p>;
                  })}
                </div>
              )}
              {analyseResult.notities_bij_project.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <p className="text-xs font-medium text-blue-400 mb-2">Hoort bij project ({analyseResult.notities_bij_project.length})</p>
                  {analyseResult.notities_bij_project.map((item) => {
                    const idee = ideeen.find((i) => i.id === item.id);
                    return <p key={item.id} className="text-[11px] text-autronis-text-secondary">{idee?.naam || `#${item.id}`} → {item.project}</p>;
                  })}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={applyAnalyse} className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-xs font-medium transition-colors">Alles toepassen</button>
              <button onClick={() => setAnalyseResult(null)} className="px-4 py-2 bg-autronis-border hover:bg-autronis-border/80 text-autronis-text-secondary rounded-xl text-xs font-medium transition-colors">Annuleren</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
      {activeTab === "alle" && (<motion.div key="alle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-6">
        {/* === "WHAT SHOULD I BUILD NEXT?" BLOCK === */}
        {topToBuild.length > 0 && (
          <div className="bg-autronis-card border border-autronis-accent/30 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-autronis-accent/10 rounded-xl"><ArrowRight className="w-4 h-4 text-autronis-accent" /></div>
              <h2 className="text-base font-semibold text-autronis-text-primary">Wat moet ik als volgende bouwen?</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {topToBuild.map((idee, i) => {
                const score = calcPriorityScore(idee);
                return (
                  <motion.div
                    key={idee.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.07 }}
                    whileHover={{ y: -2 }}
                    className="flex flex-col p-4 rounded-xl bg-autronis-bg/50 border border-autronis-border hover:border-autronis-accent/50 transition-colors group"
                  >
                    <button onClick={() => setDetailIdee(idee)} className="text-left flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-autronis-accent">#{i + 1}</span>
                        <span className={cn("text-sm font-bold px-2 py-0.5 rounded-lg tabular-nums", scoreKleur(score))}>{score}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBadgeKleuren[idee.status])}>{statusLabel(idee.status)}</span>
                      </div>
                      <p className="text-sm font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors truncate">{idee.naam}</p>
                      {idee.omschrijving && <p className="text-xs text-autronis-text-secondary mt-1 line-clamp-1">{idee.omschrijving}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-autronis-text-secondary">
                        {idee.impact != null && <span>Impact: <span className="text-autronis-text-primary font-medium">{idee.impact}/10</span></span>}
                        {idee.effort != null && <span>Effort: <span className="text-autronis-text-primary font-medium">{idee.effort}/10</span></span>}
                        {idee.revenuePotential != null && <span>Omzet: <span className="text-autronis-text-primary font-medium">{idee.revenuePotential}/10</span></span>}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-autronis-border/50">
                      <button onClick={() => setDetailIdee(idee)} className="text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">Details</button>
                      <div className="flex-1" />
                      <button onClick={() => openStartProject(idee)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg text-xs font-medium transition-colors">
                        <Rocket className="w-3 h-3" />Start project
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* === PIPELINE VISUAL === */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-autronis-text-primary">Pipeline</h2>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center sm:gap-2">
            {statusOpties.map((s, i) => {
              const count = pipelineStats[s.key as keyof typeof pipelineStats] || 0;
              const colors = { idee: "bg-gray-500/30", uitgewerkt: "bg-blue-500/30", actief: "bg-autronis-accent/30", gebouwd: "bg-emerald-500/30" };
              const textColors = { idee: "text-gray-400", uitgewerkt: "text-blue-400", actief: "text-autronis-accent", gebouwd: "text-emerald-400" };
              const icons = { idee: Lightbulb, uitgewerkt: FileText, actief: Zap, gebouwd: CheckCircle2 };
              const Icon = icons[s.key as keyof typeof icons];
              return (
                <div key={s.key} className="flex items-center gap-2 sm:flex-1">
                  <motion.div
                    className={cn("rounded-xl p-2 sm:p-3 text-center flex-1 cursor-pointer hover:opacity-80 transition-opacity", colors[s.key as keyof typeof colors])}
                    initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.1, duration: 0.4 }}
                    onClick={() => setFilterStatus(filterStatus === s.key ? "" : s.key)}
                  >
                    <p className={cn("text-lg sm:text-2xl font-bold tabular-nums", textColors[s.key as keyof typeof textColors])}>
                      <AnimatedNumber value={count} />
                    </p>
                    <p className="flex items-center justify-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] text-autronis-text-secondary uppercase tracking-wide mt-0.5">
                      <Icon className={cn("w-3 h-3", textColors[s.key as keyof typeof textColors])} />{s.label}
                    </p>
                  </motion.div>
                  {i < statusOpties.length - 1 && <ArrowRight className="w-4 h-4 text-autronis-text-secondary/30 flex-shrink-0 hidden sm:block" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* === INSIGHTS ROW === */}
        {(categoryInsight || clusterInsight || toDiscard.length > 0 || proactiveCount > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categoryInsight && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-autronis-text-secondary uppercase">Meest waardevolle categorie</span>
                </div>
                <p className="text-sm font-bold text-autronis-text-primary">{categorieLabel(categoryInsight.categorie)}</p>
                <p className="text-xs text-autronis-text-secondary">{categoryInsight.count} ideeën, gem. score {categoryInsight.gemScore}</p>
              </div>
            )}
            {clusterInsight && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold text-autronis-text-secondary uppercase">Grootste cluster</span>
                </div>
                <p className="text-sm font-bold text-autronis-text-primary">{categorieLabel(clusterInsight.categorie)}</p>
                <p className="text-xs text-autronis-text-secondary">{clusterInsight.count} ideeën ({clusterInsight.percentage}%)</p>
                {proactiveCount > 0 && (
                  <p className="text-xs text-amber-400 mt-1.5">{proactiveCount} idee{proactiveCount > 1 ? "ën" : ""} al 7+ dagen onaangeroerd — werk ze uit of verwijder ze.</p>
                )}
              </div>
            )}
            {toDiscard.length > 0 && (
              <div className="bg-autronis-card border border-red-500/20 rounded-2xl p-4">
                <button onClick={() => setDiscardExpanded(!discardExpanded)} className="flex items-center gap-2 w-full text-left">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-autronis-text-secondary uppercase flex-1">Overweeg te verwijderen ({toDiscard.length})</span>
                  {discardExpanded ? <ChevronUp className="w-3.5 h-3.5 text-autronis-text-secondary" /> : <ChevronDown className="w-3.5 h-3.5 text-autronis-text-secondary" />}
                </button>
                <AnimatePresence>
                  {discardExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1.5 mt-3">
                        {toDiscard.map((i) => (
                          <div key={i.id} className="flex items-center gap-2">
                            <p className="text-xs text-red-400/80 truncate flex-1">{i.naam} <span className="opacity-60">(score: {calcPriorityScore(i)})</span></p>
                            <button onClick={() => deleteMutation.mutate(i.id)} className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 flex-shrink-0">
                              <Archive className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      {toDiscard.length > 1 && (
                        <button onClick={() => toDiscard.forEach((i) => deleteMutation.mutate(i.id))} className="mt-3 w-full py-1.5 rounded-xl border border-red-500/20 text-xs text-red-400 hover:bg-red-500/5 transition-colors">
                          Archiveer alles ({toDiscard.length})
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Categorie tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <button onClick={() => setFilterCategorie("")} className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap", !filterCategorie ? "bg-autronis-accent text-autronis-bg" : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary")}>
            Alle <span className="ml-1 text-xs opacity-70">{totaal}</span>
          </button>
          {categorieOpties.map((c) => {
            const count = categorieCount[c.key] || 0;
            if (count === 0) return null;
            const colorClass = categorieBadgeKleuren[c.key] || "bg-gray-500/15 text-gray-400";
            return (
              <button key={c.key} onClick={() => setFilterCategorie(filterCategorie === c.key ? "" : c.key)}
                className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border", filterCategorie === c.key ? "bg-autronis-accent text-autronis-bg border-autronis-accent" : cn(colorClass, "border-transparent hover:scale-[1.02]"))}>
                {c.label} <span className="ml-1 text-xs opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Filter + sort + actions row */}
        <div className="flex flex-wrap items-center gap-3">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClasses}>
            <option value="">Alle statussen</option>
            {statusOpties.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOptie)} className={selectClasses}>
            <option value="score">Score (hoogst)</option>
            <option value="impact">Impact (hoogst)</option>
            <option value="effort">Effort (laagst)</option>
            <option value="revenue">Omzetpotentie</option>
            <option value="naam">Naam (A-Z)</option>
            <option value="status">Status</option>
            <option value="categorie">Categorie</option>
            <option value="datum">Datum (nieuwst)</option>
          </select>
          <select value={filterMinScore} onChange={(e) => setFilterMinScore(Number(e.target.value))} className={selectClasses}>
            <option value={0}>Min. score</option>
            <option value={3}>Score ≥ 3</option>
            <option value={5}>Score ≥ 5</option>
            <option value={7}>Score ≥ 7</option>
            <option value={8}>Score ≥ 8</option>
          </select>
          <div className="flex-1" />
          <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-0.5">
            <button onClick={() => setViewMode("grid")} title="Rasterweergave" className={cn("p-2 rounded-lg transition-colors", viewMode === "grid" ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary")}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("lijst")} title="Lijstweergave" className={cn("p-2 rounded-lg transition-colors", viewMode === "lijst" ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary")}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <button onClick={handleSyncBacklog} disabled={syncBacklogMutation.isPending} className="inline-flex items-center gap-2 px-4 py-2.5 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
            {syncBacklogMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Sync backlog
          </button>
          <div className="relative" ref={keuzeRef}>
            <button onClick={() => setNieuwKeuzeOpen(!nieuwKeuzeOpen)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 btn-press">
              <Plus className="w-4 h-4" />Nieuw idee
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", nieuwKeuzeOpen && "rotate-180")} />
            </button>
            <AnimatePresence>
            {nieuwKeuzeOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 bg-autronis-card border border-autronis-border rounded-xl shadow-2xl overflow-hidden z-50"
                style={{ transformOrigin: "top right" }}
              >
                <button
                  onClick={() => { setNieuwKeuzeOpen(false); setDaanOpen(true); setDaanStap("input"); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-autronis-text-primary hover:bg-autronis-accent/10 transition-colors"
                >
                  <Bot className="w-4 h-4 text-autronis-accent" />
                  <div className="text-left">
                    <p className="font-semibold">Spar met Brent</p>
                    <p className="text-xs text-autronis-text-secondary">AI helpt je idee uitwerken</p>
                  </div>
                </button>
                <div className="border-t border-autronis-border" />
                <button
                  onClick={() => { setNieuwKeuzeOpen(false); openNieuwForm(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-autronis-text-primary hover:bg-autronis-accent/10 transition-colors"
                >
                  <PenLine className="w-4 h-4 text-autronis-text-secondary" />
                  <div className="text-left">
                    <p className="font-semibold">Handmatig invullen</p>
                    <p className="text-xs text-autronis-text-secondary">Zelf alle velden invullen</p>
                  </div>
                </button>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>

        {/* Cards */}
        {alleIdeeen.length === 0 ? (
          <div className="text-center py-16">
            <Lightbulb className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
            <p className="text-autronis-text-secondary">Geen ideeën gevonden</p>
          </div>
        ) : viewMode === "lijst" ? (
          <div className="space-y-2">
            {alleIdeeen.map((idee, i) => {
              const score = calcPriorityScore(idee);
              return (
                <motion.div
                  key={idee.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  onClick={() => setDetailIdee(idee)}
                  className="flex items-center gap-3 bg-autronis-card border border-autronis-border rounded-xl px-4 py-3 hover:border-autronis-accent/50 transition-all group cursor-pointer"
                >
                  {score > 0 && <span className={cn("text-sm font-bold px-2.5 py-1 rounded-xl tabular-nums flex-shrink-0", scoreKleur(score))}>{score}</span>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {idee.nummer != null && <span className="text-xs text-autronis-text-secondary/60 font-mono flex-shrink-0">#{idee.nummer}</span>}
                      <span className="text-sm font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors truncate">{idee.naam}</span>
                    </div>
                    {idee.omschrijving && <p className="text-xs text-autronis-text-secondary truncate mt-0.5">{idee.omschrijving}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {idee.categorie && <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full hidden sm:block", categorieBadgeKleuren[idee.categorie] || "bg-gray-500/15 text-gray-400")}>{categorieLabel(idee.categorie)}</span>}
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", statusBadgeKleuren[idee.status] || "bg-gray-500/15 text-gray-400")}>{statusLabel(idee.status)}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
          >
            {alleIdeeen.map((idee) => {
              const score = calcPriorityScore(idee);
              const isScoring = scoringIdee === idee.id;
              return (
                <motion.div
                  key={idee.id}
                  variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="bg-autronis-card border border-autronis-border rounded-2xl p-3 sm:p-6 hover:border-autronis-accent/50 transition-all card-glow group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <button onClick={() => setDetailIdee(idee)} className="flex items-center gap-2 min-w-0 text-left flex-1">
                      {idee.nummer != null && <span className="text-xs text-autronis-text-secondary/60 font-mono flex-shrink-0">#{idee.nummer}</span>}
                      <h3 className="text-base font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors truncate">{idee.naam}</h3>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {score > 0 && <span className={cn("text-lg font-bold px-3 py-1 rounded-xl tabular-nums", scoreKleur(score))}>{score}</span>}
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", statusBadgeKleuren[idee.status] || "bg-gray-500/15 text-gray-400")}>{statusLabel(idee.status)}</span>
                    </div>
                  </div>

                  {idee.omschrijving && <p className="text-sm text-autronis-text-secondary line-clamp-1 mb-3">{idee.omschrijving}</p>}

                  {/* Scoring row */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {idee.categorie && <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", categorieBadgeKleuren[idee.categorie] || "bg-gray-500/15 text-gray-400")}>{categorieLabel(idee.categorie)}</span>}
                    {idee.impact != null && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 tabular-nums">Impact {idee.impact}</span>}
                    {idee.effort != null && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 tabular-nums">Effort {idee.effort}</span>}
                    {idee.revenuePotential != null && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 tabular-nums">Omzet {idee.revenuePotential}</span>}
                  </div>

                  {/* Inline scoring */}
                  {isScoring ? (
                    <div className="bg-autronis-bg rounded-xl p-3 space-y-2 mb-2">
                      {[
                        { label: "Impact", value: scoreImpact, set: setScoreImpact, color: "text-emerald-400" },
                        { label: "Effort", value: scoreEffort, set: setScoreEffort, color: "text-orange-400" },
                        { label: "Omzetpotentie", value: scoreRevenue, set: setScoreRevenue, color: "text-yellow-400" },
                      ].map((s) => (
                        <div key={s.label} className="flex items-center gap-3">
                          <span className={cn("text-xs w-24", s.color)}>{s.label}</span>
                          <input type="range" min={1} max={10} value={s.value} onChange={(e) => s.set(Number(e.target.value))} className="flex-1 h-1.5 accent-autronis-accent" />
                          <span className="text-xs font-bold text-autronis-text-primary tabular-nums w-6 text-right">{s.value}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-1">
                        <span className={cn("text-sm font-bold px-2.5 py-1 rounded-xl tabular-nums", scoreKleur(liveScore))}>{liveScore}</span>
                        <div className="flex-1" />
                        <button onClick={handleSaveScore} className="text-xs text-autronis-accent hover:text-autronis-accent-hover font-medium">Opslaan</button>
                        <button onClick={() => setScoringIdee(null)} className="text-xs text-autronis-text-secondary">Annuleren</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => openScoring(idee)} className="text-[10px] text-autronis-text-secondary hover:text-autronis-accent transition-colors">
                      {idee.impact != null ? "Score aanpassen" : "Score toevoegen"}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>)}

      {/* Notities Tab */}
      {activeTab === "inzichten" && (
      <motion.div key="inzichten" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
        <div className="space-y-4">
          {/* Quick capture */}
          <div className="bg-autronis-card border border-amber-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <input
                ref={inzichtInputRef}
                type="text"
                value={inzichtInput}
                onChange={(e) => setInzichtInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveInzicht(); }}
                placeholder="Typ een inzicht of notitie..."
                className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-amber-500/50"
                autoFocus
              />
              <button
                onClick={handleSaveInzicht}
                disabled={!inzichtInput.trim() || createMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-autronis-text-secondary/50 mt-2 ml-1">Enter om op te slaan · Eerste 60 tekens worden de titel</p>
          </div>

          {/* Verwerk suggestie panel */}
          <AnimatePresence>
            {verwerkResult && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-autronis-card border border-autronis-accent/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-autronis-accent" />
                    <span className="text-sm font-medium text-autronis-text-primary">AI Suggestie</span>
                  </div>
                  <button onClick={() => setVerwerkResult(null)} className="text-autronis-text-secondary/40 hover:text-autronis-text-primary"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-autronis-text-secondary">{verwerkResult.suggestie.reden}</p>
                <div className="flex gap-2">
                  {verwerkResult.suggestie.project.id && (
                    <button
                      onClick={async () => {
                        const s = verwerkResult.suggestie;
                        const res = await fetch("/api/taken", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ projectId: s.project.id, titel: s.project.taakTitel }),
                          redirect: "error",
                        }).catch(() => null);
                        if (!res || !res.ok) {
                          addToast("Fout bij toevoegen taak", "fout");
                          return;
                        }
                        deleteMutation.mutate(verwerkResult.notitieId);
                        setVerwerkResult(null);
                        addToast(`Taak toegevoegd aan ${s.project.naam}`);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      <ArrowRight className="w-3 h-3" />
                      Koppel aan {verwerkResult.suggestie.project.naam}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const s = verwerkResult.suggestie;
                      updateMutation.mutate({ id: verwerkResult.notitieId, body: {
                        naam: s.idee.naam,
                        omschrijving: s.idee.omschrijving,
                        categorie: s.idee.categorie,
                        prioriteit: s.idee.prioriteit,
                      }});
                      setVerwerkResult(null);
                      addToast(`Omgezet naar idee: ${s.idee.naam}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Lightbulb className="w-3 h-3" />
                    Maak idee ({verwerkResult.suggestie.idee.categorie.replace("_", "/")})
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Notities lijst */}
          {inzichtIdeeen.length === 0 ? (
            <div className="text-center py-12">
              <PenLine className="w-10 h-10 text-autronis-text-secondary/20 mx-auto mb-3" />
              <p className="text-sm text-autronis-text-secondary">Nog geen inzichten — typ hierboven om te beginnen</p>
            </div>
          ) : (
            <div className="space-y-2">
              {inzichtIdeeen.map((inzicht, i) => {
                const datum = new Date(inzicht.aangemaaktOp);
                const datumStr = datum.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: datum.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
                const isVerwerken = verwerkMutation.isPending && verwerkMutation.variables === inzicht.id;
                return (
                  <motion.div key={inzicht.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: i * 0.04 }} className="group bg-autronis-card border border-autronis-border hover:border-amber-500/30 rounded-xl px-4 py-3 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-autronis-text-primary">{inzicht.omschrijving || inzicht.naam}</p>
                        {inzicht.omschrijving && inzicht.naam !== inzicht.omschrijving.slice(0, 60) && (
                          <p className="text-xs text-amber-400/70 mt-0.5">{inzicht.naam}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[11px] text-autronis-text-secondary/50 mr-1">{datumStr}</span>
                        {/* AI Verwerk knop */}
                        <button
                          onClick={async () => {
                            const result = await verwerkMutation.mutateAsync(inzicht.id);
                            setVerwerkResult({ notitieId: inzicht.id, suggestie: result.suggestie });
                          }}
                          disabled={isVerwerken}
                          title="AI verwerkt deze notitie"
                          className="p-1.5 rounded-lg bg-autronis-accent/10 text-autronis-accent/70 hover:bg-autronis-accent/25 hover:text-autronis-accent transition-colors"
                        >
                          {isVerwerken ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                        </button>
                        {/* Koppel aan project knop */}
                        <div className="relative">
                          <button
                            onClick={() => setKoppelNotitieId(koppelNotitieId === inzicht.id ? null : inzicht.id)}
                            title="Koppel aan project"
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400/70 hover:bg-blue-500/25 hover:text-blue-400 transition-colors"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          {koppelNotitieId === inzicht.id && (
                            <div className="absolute right-0 top-8 z-50 w-56 bg-autronis-card border border-autronis-border rounded-xl shadow-xl py-1 max-h-48 overflow-y-auto">
                              {projectenLijst.filter((p) => p.status === "actief").map((project) => (
                                <button
                                  key={project.id}
                                  onClick={async () => {
                                    const titel = (inzicht.naam.length > 60 ? inzicht.naam.slice(0, 57) + "..." : inzicht.naam);
                                    const res = await fetch("/api/taken", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ projectId: project.id, titel }),
                                      redirect: "error",
                                    }).catch(() => null);
                                    if (!res || !res.ok) {
                                      addToast("Fout bij toevoegen taak", "fout");
                                      setKoppelNotitieId(null);
                                      return;
                                    }
                                    deleteMutation.mutate(inzicht.id);
                                    setKoppelNotitieId(null);
                                    addToast(`Taak toegevoegd aan ${project.naam}`);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs text-autronis-text-primary hover:bg-autronis-accent/10 transition-colors"
                                >
                                  {project.naam}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Maak idee knop */}
                        <button
                          onClick={() => {
                            const naam = inzicht.naam;
                            const omschrijving = inzicht.omschrijving || inzicht.naam;
                            updateMutation.mutate({ id: inzicht.id, body: {
                              naam,
                              omschrijving,
                              categorie: "experimenteel",
                              prioriteit: "normaal",
                            }});
                            addToast("Omgezet naar idee");
                          }}
                          title="Maak idee"
                          className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400/70 hover:bg-amber-500/25 hover:text-amber-400 transition-colors"
                        >
                          <Lightbulb className="w-3.5 h-3.5" />
                        </button>
                        {/* Verwijder */}
                        <button
                          onClick={() => deleteMutation.mutate(inzicht.id)}
                          title="Verwijderen"
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400/70 hover:bg-red-500/25 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>)}

      {/* AI Suggesties Tab */}
      {activeTab === "ai" && (
      <motion.div key="ai" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
              <div className="p-2.5 bg-purple-500/10 rounded-xl w-fit mb-3"><Sparkles className="w-5 h-5 text-purple-400" /></div>
              <p className="text-3xl font-bold text-autronis-text-primary tabular-nums">{aiTotaal}</p>
              <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Totaal suggesties</p>
            </div>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl w-fit mb-3"><Target className="w-5 h-5 text-emerald-400" /></div>
              <p className="text-3xl font-bold text-emerald-400 tabular-nums">{aiGemScore}</p>
              <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Gem. score</p>
            </div>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
              <div className="p-2.5 bg-blue-500/10 rounded-xl w-fit mb-3"><Users className="w-5 h-5 text-blue-400" /></div>
              <p className="text-3xl font-bold text-blue-400 tabular-nums">{aiKlant}</p>
              <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Klant ideeën</p>
            </div>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl w-fit mb-3"><User className="w-5 h-5 text-autronis-accent" /></div>
              <p className="text-3xl font-bold text-autronis-accent tabular-nums">{aiPersoonlijk}</p>
              <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Persoonlijke ideeën</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1">
              {[{ key: "", label: "Alle" }, { key: "klant", label: "Klant" }, { key: "persoonlijk", label: "Persoonlijk" }].map((opt) => (
                <button key={opt.key} onClick={() => setFilterDoelgroep(opt.key)} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", filterDoelgroep === opt.key ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary")}>{opt.label}</button>
              ))}
            </div>
            <div className="flex-1" />
            <button onClick={handleGenereer} disabled={genereerMutation.isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50">
              {genereerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}Genereer nieuwe ideeën
            </button>
          </div>

          {aiSorted.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
              <p className="text-autronis-text-secondary mb-4">Nog geen AI-suggesties</p>
              <button onClick={handleGenereer} disabled={genereerMutation.isPending} className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors">
                {genereerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}Genereer ideeën
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {aiSorted.map((idee) => (
                <div key={idee.id} className="bg-autronis-card border border-autronis-border rounded-2xl p-3 sm:p-6 hover:border-autronis-accent/50 transition-all card-glow cursor-pointer" onClick={() => setDetailIdee(idee)}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-autronis-text-primary truncate">{idee.naam}</h3>
                      {idee.omschrijving && <p className="text-sm text-autronis-text-secondary mt-1 line-clamp-2">{idee.omschrijving}</p>}
                    </div>
                    {idee.aiScore != null && <span className={cn("text-lg font-bold px-3 py-1 rounded-xl flex-shrink-0 tabular-nums", scoreKleur(idee.aiScore))}>{idee.aiScore}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-autronis-text-secondary mb-3">
                    {idee.aiHaalbaarheid != null && <span>Haalbaarheid: <span className="text-autronis-text-primary font-medium">{idee.aiHaalbaarheid}/10</span></span>}
                    {idee.aiMarktpotentie != null && <span>Markt: <span className="text-autronis-text-primary font-medium">{idee.aiMarktpotentie}/10</span></span>}
                    {idee.aiFitAutronis != null && <span>Fit: <span className="text-autronis-text-primary font-medium">{idee.aiFitAutronis}/10</span></span>}
                  </div>
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {idee.doelgroep && <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", idee.doelgroep === "klant" ? "bg-blue-500/15 text-blue-400" : "bg-autronis-accent/15 text-autronis-accent")}>{idee.doelgroep === "klant" ? "Klant" : "Persoonlijk"}</span>}
                    {idee.verdienmodel && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-autronis-border/50 text-autronis-text-secondary">{idee.verdienmodel}</span>}
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-autronis-border" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handlePromoveer(idee.id)} disabled={promoveerMutation.isPending} className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-xs font-medium transition-colors disabled:opacity-50">
                      <ArrowUpCircle className="w-3.5 h-3.5" />Promoveer
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => deleteMutation.mutate(idee.id)} className="inline-flex items-center gap-1.5 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-medium transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      </motion.div>)}
      </AnimatePresence>

      {/* Detail Modal */}
      {detailIdee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {detailIdee.nummer != null && <span className="text-sm text-autronis-text-secondary font-mono">#{detailIdee.nummer}</span>}
                  <h3 className="text-xl font-bold text-autronis-text-primary">{detailIdee.naam}</h3>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", statusBadgeKleuren[detailIdee.status])}>{statusLabel(detailIdee.status)}</span>
                  {detailIdee.categorie && <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", categorieBadgeKleuren[detailIdee.categorie])}>{categorieLabel(detailIdee.categorie)}</span>}
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-autronis-border/50 text-autronis-text-secondary">{prioriteitLabel(detailIdee.prioriteit)}</span>
                  {calcPriorityScore(detailIdee) > 0 && <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full tabular-nums", scoreKleur(calcPriorityScore(detailIdee)))}>Score: {calcPriorityScore(detailIdee)}</span>}
                </div>
              </div>
              <button onClick={() => { setDetailIdee(null); setNotionUrl(null); }} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            {/* Scoring display */}
            {(detailIdee.impact != null || detailIdee.effort != null || detailIdee.revenuePotential != null) && (
              <div className="flex items-center gap-4 p-3 rounded-xl bg-autronis-bg/50 mb-5">
                {detailIdee.impact != null && <div className="text-center"><p className="text-lg font-bold text-emerald-400 tabular-nums">{detailIdee.impact}/10</p><p className="text-[10px] text-autronis-text-secondary">Impact</p></div>}
                {detailIdee.effort != null && <div className="text-center"><p className="text-lg font-bold text-orange-400 tabular-nums">{detailIdee.effort}/10</p><p className="text-[10px] text-autronis-text-secondary">Effort</p></div>}
                {detailIdee.revenuePotential != null && <div className="text-center"><p className="text-lg font-bold text-yellow-400 tabular-nums">{detailIdee.revenuePotential}/10</p><p className="text-[10px] text-autronis-text-secondary">Omzetpotentie</p></div>}
              </div>
            )}

            {detailIdee.omschrijving && (
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-2">Omschrijving</h4>
                <div className="text-sm text-autronis-text-primary leading-relaxed ytk-markdown" dangerouslySetInnerHTML={{ __html: marked.parse(detailIdee.omschrijving, { breaks: true }) as string }} />
              </div>
            )}
            {detailIdee.uitwerking && (
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-2">Uitwerking</h4>
                <div className="text-sm text-autronis-text-primary leading-relaxed ytk-markdown" dangerouslySetInnerHTML={{ __html: marked.parse(detailIdee.uitwerking, { breaks: true }) as string }} />
              </div>
            )}

            <div className="flex items-center gap-3 pt-4 border-t border-autronis-border flex-wrap">
              <button onClick={() => openEditForm(detailIdee)} className="inline-flex items-center gap-2 px-4 py-2.5 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 rounded-xl text-sm font-medium transition-colors"><Edit className="w-4 h-4" />Bewerken</button>
              {(detailIdee.status === "idee" || detailIdee.status === "uitgewerkt") && (
                <button onClick={handleStartProject} disabled={startProjectMutation.isPending} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500/15 text-green-400 hover:bg-green-500/25 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  {startProjectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}Start als project
                </button>
              )}
              {(detailIdee.status === "actief" || detailIdee.status === "gebouwd") && (
                <>
                  <button onClick={handleRegenereerPlan} disabled={regenereerPlanMutation.isPending} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                    {regenereerPlanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}Regenereer plan
                  </button>
                  {notionUrl && <a href={notionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25 rounded-xl text-sm font-medium transition-colors"><ExternalLink className="w-4 h-4" />Notion</a>}
                </>
              )}
              <div className="flex-1" />
              <button onClick={() => setDeleteDialogOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-colors"><Trash2 className="w-4 h-4" />Verwijderen</button>
            </div>
          </div>
        </div>
      )}

      {/* DAAN Spar Modal */}
      {daanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-autronis-card border border-autronis-accent/30 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-autronis-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-autronis-accent/10 rounded-xl">
                  <Bot className="w-5 h-5 text-autronis-accent" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-autronis-text-primary">Spar met Brent</h3>
                  <p className="text-xs text-autronis-text-secondary">Beschrijf je idee en Brent helpt het uitwerken</p>
                </div>
              </div>
              <button onClick={resetDaan} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat area */}
            <div ref={daanChatRef} className="flex-1 overflow-y-auto p-5 space-y-3 min-h-[200px]">
              {daanMessages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="w-10 h-10 text-autronis-accent/30 mx-auto mb-3" />
                  <p className="text-sm text-autronis-text-secondary">Beschrijf kort je idee en Brent stelt slimme vragen om het concreet te maken.</p>
                </div>
              )}
              {daanMessages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] px-4 py-2.5 rounded-2xl text-sm",
                    msg.role === "user"
                      ? "bg-autronis-accent text-autronis-bg rounded-br-md"
                      : "bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-bl-md"
                  )}>
                    {msg.role === "daan" && <Bot className="w-3.5 h-3.5 text-autronis-accent inline mr-1.5 -mt-0.5" />}
                    {msg.text}
                  </div>
                </div>
              ))}
              {daanLoading && (
                <div className="flex justify-start">
                  <div className="bg-autronis-bg border border-autronis-border rounded-2xl rounded-bl-md px-4 py-2.5">
                    <Loader2 className="w-4 h-4 text-autronis-accent animate-spin" />
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-autronis-border">
              {daanStap === "klaar" ? (
                <button onClick={resetDaan} className="w-full px-4 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors">
                  Sluiten
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={daanInput}
                    onChange={(e) => setDaanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (daanStap === "input") handleDaanStart();
                        else if (daanStap === "vragen") handleDaanAntwoord();
                      }
                    }}
                    placeholder={daanStap === "input" ? "Beschrijf je idee..." : "Typ je antwoord..."}
                    disabled={daanLoading}
                    className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors disabled:opacity-50"
                    autoFocus
                  />
                  <button
                    onClick={daanStap === "input" ? handleDaanStart : handleDaanAntwoord}
                    disabled={daanLoading || !daanInput.trim()}
                    className="p-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-autronis-text-primary">{editIdee ? "Idee bewerken" : "Nieuw idee"}</h3>
              <button onClick={() => setFormOpen(false)} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="block text-sm font-medium text-autronis-text-secondary">Naam *</label><input type="text" value={formNaam} onChange={(e) => setFormNaam(e.target.value)} className={inputClasses} placeholder="Naam van het idee" /></div>
                <div className="space-y-1.5"><label className="block text-sm font-medium text-autronis-text-secondary">Nummer</label><input type="number" value={formNummer} onChange={(e) => setFormNummer(e.target.value)} className={inputClasses} placeholder="Optioneel" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5"><label className="block text-sm font-medium text-autronis-text-secondary">Categorie</label><select value={formCategorie} onChange={(e) => setFormCategorie(e.target.value)} className={cn(inputClasses)}><option value="">Geen</option>{categorieOpties.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
                <div className="space-y-1.5"><label className="block text-sm font-medium text-autronis-text-secondary">Status</label><select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className={cn(inputClasses)}>{statusOpties.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
                <div className="space-y-1.5"><label className="block text-sm font-medium text-autronis-text-secondary">Prioriteit</label><select value={formPrioriteit} onChange={(e) => setFormPrioriteit(e.target.value)} className={cn(inputClasses)}>{prioriteitOpties.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></div>
              </div>
              <div className="space-y-1.5"><label className="block text-sm font-medium text-autronis-text-secondary">Omschrijving</label><textarea value={formOmschrijving} onChange={(e) => setFormOmschrijving(e.target.value)} rows={3} className={cn(inputClasses, "resize-none")} placeholder="Korte omschrijving..." /></div>
              <div className="space-y-1.5"><label className="block text-sm font-medium text-autronis-text-secondary">Uitwerking</label><textarea value={formUitwerking} onChange={(e) => setFormUitwerking(e.target.value)} rows={8} className={cn(inputClasses, "resize-none")} placeholder="Uitgebreide uitwerking..." /></div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">Annuleren</button>
              <button onClick={handleOpslaan} disabled={createMutation.isPending || updateMutation.isPending} className="px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50">
                {(createMutation.isPending || updateMutation.isPending) ? "Opslaan..." : editIdee ? "Bijwerken" : "Toevoegen"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} onBevestig={handleDelete}
        titel="Idee verwijderen?" bericht={`Weet je zeker dat je "${detailIdee?.naam}" wilt verwijderen?`} bevestigTekst="Verwijderen" variant="danger" />

      {/* Start project keuze modal */}
      {startModusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setStartModusOpen(false)}>
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-autronis-text-primary mb-1">Project starten</h3>
            <p className="text-sm text-autronis-text-secondary mb-5">Hoe wil je &quot;{detailIdee?.naam}&quot; bouwen?</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleStartWithModus("team")}
                disabled={startProjectMutation.isPending}
                className="flex items-center gap-4 p-4 rounded-xl border border-autronis-border hover:border-autronis-accent/50 hover:bg-autronis-accent/5 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-autronis-accent/15 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-autronis-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-autronis-text-primary">Team laten bouwen</p>
                  <p className="text-xs text-autronis-text-tertiary">Ops Room maakt een plan en wijst agents toe</p>
                </div>
                <ArrowRight className="w-4 h-4 text-autronis-text-tertiary ml-auto shrink-0" />
              </button>
              <button
                onClick={() => handleStartWithModus("zelf")}
                disabled={startProjectMutation.isPending}
                className="flex items-center gap-4 p-4 rounded-xl border border-autronis-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-autronis-text-primary">Zelf bouwen</p>
                  <p className="text-xs text-autronis-text-tertiary">Geen Ops Room, direct aan de slag</p>
                </div>
                <ArrowRight className="w-4 h-4 text-autronis-text-tertiary ml-auto shrink-0" />
              </button>
            </div>
            {startProjectMutation.isPending && (
              <div className="flex items-center gap-2 mt-4 text-sm text-autronis-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin" />Project wordt aangemaakt...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
