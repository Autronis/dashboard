"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
  type Idee,
} from "@/hooks/queries/use-ideeen";
import { PageTransition } from "@/components/ui/page-transition";
import { motion } from "framer-motion";

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

  const [activeTab, setActiveTab] = useState<"alle" | "ai">("alle");
  const [filterStatus, setFilterStatus] = useState("");
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

  const [detailIdee, setDetailIdee] = useState<Idee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editIdee, setEditIdee] = useState<Idee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notionUrl, setNotionUrl] = useState<string | null>(null);
  const [scoringIdee, setScoringIdee] = useState<number | null>(null);

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

  // Data splits
  const backlogIdeeen = ideeen.filter((i) => i.isAiSuggestie !== 1 || i.gepromoveerd === 1);
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
    startProjectMutation.mutate(detailIdee.id, {
      onSuccess: (data) => { addToast(`Project "${data.project.naam}" aangemaakt`, "succes"); setDetailIdee(null); },
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

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab("alle")} className={cn("px-5 py-2.5 rounded-lg text-sm font-medium transition-colors", activeTab === "alle" ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary")}>Alle Ideeën</button>
        <button onClick={() => setActiveTab("ai")} className={cn("inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors", activeTab === "ai" ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary")}>
          <Sparkles className="w-4 h-4" />AI Suggesties
          {aiTotaal > 0 && <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full", activeTab === "ai" ? "bg-autronis-bg/20 text-autronis-bg" : "bg-autronis-accent/15 text-autronis-accent")}>{aiTotaal}</span>}
        </button>
      </div>

      {activeTab === "alle" && (<>
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
                  <button key={idee.id} onClick={() => setDetailIdee(idee)} className="text-left p-4 rounded-xl bg-autronis-bg/50 border border-autronis-border hover:border-autronis-accent/50 transition-colors group">
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
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {statusOpties.map((s, i) => {
              const count = pipelineStats[s.key as keyof typeof pipelineStats] || 0;
              const colors = { idee: "bg-gray-500/30", uitgewerkt: "bg-blue-500/30", actief: "bg-autronis-accent/30", gebouwd: "bg-emerald-500/30" };
              const textColors = { idee: "text-gray-400", uitgewerkt: "text-blue-400", actief: "text-autronis-accent", gebouwd: "text-emerald-400" };
              const icons = { idee: Lightbulb, uitgewerkt: FileText, actief: Zap, gebouwd: CheckCircle2 };
              const Icon = icons[s.key as keyof typeof icons];
              return (
                <div key={s.key} className="flex items-center gap-2 flex-shrink-0 flex-1 min-w-[80px]">
                  <motion.div
                    className={cn("rounded-xl p-3 text-center flex-1 cursor-pointer hover:opacity-80 transition-opacity", colors[s.key as keyof typeof colors])}
                    initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.1, duration: 0.4 }}
                    onClick={() => setFilterStatus(filterStatus === s.key ? "" : s.key)}
                  >
                    <p className={cn("text-2xl font-bold tabular-nums", textColors[s.key as keyof typeof textColors])}>{count}</p>
                    <p className="flex items-center justify-center gap-1 text-[10px] text-autronis-text-secondary uppercase tracking-wide mt-0.5">
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
        {(categoryInsight || clusterInsight || toDiscard.length > 0) && (
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
              </div>
            )}
            {toDiscard.length > 0 && (
              <div className="bg-autronis-card border border-red-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-autronis-text-secondary uppercase">Overweeg te verwijderen</span>
                </div>
                <div className="space-y-1">
                  {toDiscard.map((i) => (
                    <p key={i.id} className="text-xs text-red-400/80 truncate">{i.naam} (score: {calcPriorityScore(i)})</p>
                  ))}
                </div>
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
            return (
              <button key={c.key} onClick={() => setFilterCategorie(filterCategorie === c.key ? "" : c.key)}
                className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap", filterCategorie === c.key ? "bg-autronis-accent text-autronis-bg" : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary")}>
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
          <button onClick={handleSyncBacklog} disabled={syncBacklogMutation.isPending} className="inline-flex items-center gap-2 px-4 py-2.5 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
            {syncBacklogMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Sync backlog
          </button>
          <div className="relative" ref={keuzeRef}>
            <button onClick={() => setNieuwKeuzeOpen(!nieuwKeuzeOpen)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 btn-press">
              <Plus className="w-4 h-4" />Nieuw idee
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", nieuwKeuzeOpen && "rotate-180")} />
            </button>
            {nieuwKeuzeOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-autronis-card border border-autronis-border rounded-xl shadow-2xl overflow-hidden z-50">
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
              </div>
            )}
          </div>
        </div>

        {/* Cards grid */}
        {alleIdeeen.length === 0 ? (
          <div className="text-center py-16">
            <Lightbulb className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
            <p className="text-autronis-text-secondary">Geen ideeën gevonden</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {alleIdeeen.map((idee) => {
              const score = calcPriorityScore(idee);
              const isScoring = scoringIdee === idee.id;
              return (
                <div key={idee.id} className="bg-autronis-card border border-autronis-border rounded-2xl p-3 sm:p-6 hover:border-autronis-accent/50 transition-all card-glow group">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <button onClick={() => setDetailIdee(idee)} className="flex items-center gap-2 min-w-0 text-left">
                      {idee.nummer != null && <span className="text-xs text-autronis-text-secondary/60 font-mono flex-shrink-0">#{idee.nummer}</span>}
                      <h3 className="text-base font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors truncate">{idee.naam}</h3>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {score > 0 && <span className={cn("text-sm font-bold px-2 py-0.5 rounded-lg tabular-nums", scoreKleur(score))}>{score}</span>}
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
                        <button onClick={handleSaveScore} className="text-xs text-autronis-accent hover:text-autronis-accent-hover font-medium">Opslaan</button>
                        <button onClick={() => setScoringIdee(null)} className="text-xs text-autronis-text-secondary">Annuleren</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => openScoring(idee)} className="text-[10px] text-autronis-text-secondary hover:text-autronis-accent transition-colors">
                      {idee.impact != null ? "Score aanpassen" : "Score toevoegen"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </>)}

      {/* AI Suggesties Tab */}
      {activeTab === "ai" && (
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
                <div key={idee.id} className="bg-autronis-card border border-autronis-border rounded-2xl p-3 sm:p-6 hover:border-autronis-accent/50 transition-all card-glow">
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
                  <div className="flex items-center gap-2 pt-3 border-t border-autronis-border">
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
      )}

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
                <p className="text-sm text-autronis-text-primary whitespace-pre-wrap leading-relaxed">{detailIdee.omschrijving}</p>
              </div>
            )}
            {detailIdee.uitwerking && (
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-2">Uitwerking</h4>
                <p className="text-sm text-autronis-text-primary whitespace-pre-wrap leading-relaxed">{detailIdee.uitwerking}</p>
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
    </div>
    </PageTransition>
  );
}
