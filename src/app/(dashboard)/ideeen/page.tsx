"use client";

import { useState } from "react";
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
} from "lucide-react";
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
  uitgewerkt: "bg-yellow-500/15 text-yellow-400",
  actief: "bg-green-500/15 text-green-400",
  gebouwd: "bg-emerald-500/15 text-emerald-400",
};

function categorieLabel(key: string): string {
  return categorieOpties.find((c) => c.key === key)?.label || key;
}

function statusLabel(key: string): string {
  return statusOpties.find((s) => s.key === key)?.label || key;
}

function prioriteitLabel(key: string): string {
  return prioriteitOpties.find((p) => p.key === key)?.label || key;
}

// ============ MAIN PAGE ============

export default function IdeeenPage() {
  const { addToast } = useToast();

  // Tabs
  const [activeTab, setActiveTab] = useState<"alle" | "ai">("alle");

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("");
  const [filterDoelgroep, setFilterDoelgroep] = useState("");

  // Data
  const { data: ideeen = [], isLoading } = useIdeeen({
    status: filterStatus || undefined,
    categorie: filterCategorie || undefined,
  });

  // Mutations
  const createMutation = useCreateIdee();
  const updateMutation = useUpdateIdee();
  const deleteMutation = useDeleteIdee();
  const startProjectMutation = useStartProject();
  const syncBacklogMutation = useSyncBacklog();
  const genereerMutation = useGenereerIdeeen();
  const promoveerMutation = usePromoveerIdee();
  const regenereerPlanMutation = useRegenereerPlan();

  // Modal state
  const [detailIdee, setDetailIdee] = useState<Idee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editIdee, setEditIdee] = useState<Idee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notionUrl, setNotionUrl] = useState<string | null>(null);

  // Form state
  const [formNaam, setFormNaam] = useState("");
  const [formNummer, setFormNummer] = useState("");
  const [formCategorie, setFormCategorie] = useState("");
  const [formStatus, setFormStatus] = useState("idee");
  const [formPrioriteit, setFormPrioriteit] = useState("normaal");
  const [formOmschrijving, setFormOmschrijving] = useState("");
  const [formUitwerking, setFormUitwerking] = useState("");

  // Filtered lists
  const alleIdeeen = ideeen.filter((i) => i.isAiSuggestie !== 1 || i.gepromoveerd === 1);
  const aiSuggesties = ideeen.filter((i) => i.isAiSuggestie === 1 && i.gepromoveerd !== 1);
  const aiFiltered = filterDoelgroep
    ? aiSuggesties.filter((i) => i.doelgroep === filterDoelgroep)
    : aiSuggesties;
  const aiSorted = [...aiFiltered].sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0));

  // KPIs
  const totaal = alleIdeeen.length;
  const uitgewerkt = alleIdeeen.filter((i) => i.status === "uitgewerkt").length;
  const actief = alleIdeeen.filter((i) => i.status === "actief").length;
  const gebouwd = alleIdeeen.filter((i) => i.status === "gebouwd").length;

  // AI KPIs
  const aiTotaal = aiSuggesties.length;
  const aiGemScore = aiTotaal > 0
    ? Math.round((aiSuggesties.reduce((sum, i) => sum + (i.aiScore ?? 0), 0) / aiTotaal) * 10) / 10
    : 0;
  const aiKlant = aiSuggesties.filter((i) => i.doelgroep === "klant").length;
  const aiPersoonlijk = aiSuggesties.filter((i) => i.doelgroep === "persoonlijk").length;

  // ============ HANDLERS ============

  function openNieuwForm() {
    setEditIdee(null);
    setFormNaam("");
    setFormNummer("");
    setFormCategorie("");
    setFormStatus("idee");
    setFormPrioriteit("normaal");
    setFormOmschrijving("");
    setFormUitwerking("");
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

  function handleOpslaan() {
    if (!formNaam.trim()) {
      addToast("Naam is verplicht", "fout");
      return;
    }

    const body = {
      naam: formNaam.trim(),
      nummer: formNummer ? Number(formNummer) : null,
      categorie: formCategorie || null,
      status: formStatus,
      prioriteit: formPrioriteit,
      omschrijving: formOmschrijving.trim() || null,
      uitwerking: formUitwerking.trim() || null,
    };

    if (editIdee) {
      updateMutation.mutate(
        { id: editIdee.id, body },
        {
          onSuccess: () => {
            addToast("Idee bijgewerkt", "succes");
            setFormOpen(false);
          },
          onError: () => addToast("Kon idee niet bijwerken", "fout"),
        }
      );
    } else {
      createMutation.mutate(body, {
        onSuccess: () => {
          addToast("Idee aangemaakt", "succes");
          setFormOpen(false);
        },
        onError: () => addToast("Kon idee niet aanmaken", "fout"),
      });
    }
  }

  function handleDelete() {
    if (!detailIdee) return;
    deleteMutation.mutate(detailIdee.id, {
      onSuccess: () => {
        addToast("Idee verwijderd", "succes");
        setDetailIdee(null);
        setDeleteDialogOpen(false);
      },
      onError: () => addToast("Kon idee niet verwijderen", "fout"),
    });
  }

  function handleStartProject() {
    if (!detailIdee) return;
    startProjectMutation.mutate(detailIdee.id, {
      onSuccess: (data) => {
        addToast(`Project "${data.project.naam}" aangemaakt`, "succes");
        setDetailIdee(null);
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

  function handleDeleteAi(idee: Idee) {
    deleteMutation.mutate(idee.id, {
      onSuccess: () => addToast("AI-suggestie verwijderd", "succes"),
      onError: () => addToast("Kon niet verwijderen", "fout"),
    });
  }

  function handleRegenereerPlan() {
    if (!detailIdee) return;
    setNotionUrl(null);
    regenereerPlanMutation.mutate(detailIdee.id, {
      onSuccess: (data: { notionUrl?: string }) => {
        addToast("Notion plan gegenereerd", "succes");
        if (data.notionUrl) {
          setNotionUrl(data.notionUrl);
        }
      },
      onError: (err) => addToast(err.message || "Regenereren mislukt", "fout"),
    });
  }

  function scoreKleur(score: number | null): string {
    if (score == null) return "bg-gray-500/15 text-gray-400";
    if (score >= 8) return "bg-emerald-500/15 text-emerald-400";
    if (score >= 5) return "bg-amber-500/15 text-amber-400";
    return "bg-red-500/15 text-red-400";
  }

  function handleSyncBacklog() {
    syncBacklogMutation.mutate(undefined, {
      onSuccess: (data) => {
        addToast(`Sync klaar: ${data.nieuw} nieuw, ${data.bijgewerkt} bijgewerkt`, "succes");
      },
      onError: (err) => addToast(err.message || "Sync mislukt", "fout"),
    });
  }

  const inputClasses =
    "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";
  const selectClasses =
    "bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";

  // ============ LOADING ============

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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Ideeën</h1>
        <p className="text-base text-autronis-text-secondary mt-1">
          Product- en projectideeën beheren
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("alle")}
          className={cn(
            "px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
            activeTab === "alle"
              ? "bg-autronis-accent text-autronis-bg"
              : "text-autronis-text-secondary hover:text-autronis-text-primary"
          )}
        >
          Alle Ideeën
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={cn(
            "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
            activeTab === "ai"
              ? "bg-autronis-accent text-autronis-bg"
              : "text-autronis-text-secondary hover:text-autronis-text-primary"
          )}
        >
          <Sparkles className="w-4 h-4" />
          AI Suggesties
          {aiTotaal > 0 && (
            <span className={cn(
              "text-xs font-bold px-1.5 py-0.5 rounded-full",
              activeTab === "ai" ? "bg-autronis-bg/20 text-autronis-bg" : "bg-autronis-accent/15 text-autronis-accent"
            )}>
              {aiTotaal}
            </span>
          )}
        </button>
      </div>

      {activeTab === "alle" && (<>
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
              <Lightbulb className="w-5 h-5 text-autronis-accent" />
            </div>
          </div>
          <p className="text-3xl font-bold text-autronis-text-primary tabular-nums">{totaal}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Totaal ideeën</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-yellow-500/10 rounded-xl">
              <Edit className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-yellow-400 tabular-nums">{uitgewerkt}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Uitgewerkt</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-green-500/10 rounded-xl">
              <Rocket className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-400 tabular-nums">{actief}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Actieve projecten</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <ExternalLink className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-400 tabular-nums">{gebouwd}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Gebouwd</p>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={selectClasses}
        >
          <option value="">Alle statussen</option>
          {statusOpties.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        <select
          value={filterCategorie}
          onChange={(e) => setFilterCategorie(e.target.value)}
          className={selectClasses}
        >
          <option value="">Alle categorieën</option>
          {categorieOpties.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>

        <div className="flex-1" />

        <button
          onClick={handleSyncBacklog}
          disabled={syncBacklogMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          {syncBacklogMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Sync backlog
        </button>

        <button
          onClick={openNieuwForm}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 btn-press"
        >
          <Plus className="w-4 h-4" />
          Nieuw idee
        </button>
      </div>

      {/* Cards grid */}
      {alleIdeeen.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
          <p className="text-autronis-text-secondary">Geen ideeën gevonden</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {alleIdeeen.map((idee) => (
            <button
              key={idee.id}
              onClick={() => setDetailIdee(idee)}
              className="w-full text-left bg-autronis-card border border-autronis-border rounded-2xl p-6 hover:border-autronis-accent/50 transition-all card-glow group"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {idee.nummer != null && (
                    <span className="text-xs text-autronis-text-secondary/60 font-mono flex-shrink-0">
                      #{idee.nummer}
                    </span>
                  )}
                  <h3 className="text-base font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors truncate">
                    {idee.naam}
                  </h3>
                </div>
                <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0", statusBadgeKleuren[idee.status] || "bg-gray-500/15 text-gray-400")}>
                  {statusLabel(idee.status)}
                </span>
              </div>

              {idee.categorie && (
                <span className={cn("inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-3", categorieBadgeKleuren[idee.categorie] || "bg-gray-500/15 text-gray-400")}>
                  {categorieLabel(idee.categorie)}
                </span>
              )}

              {idee.omschrijving && (
                <p className="text-sm text-autronis-text-secondary line-clamp-2">
                  {idee.omschrijving}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      </>)}

      {/* AI Suggesties Tab */}
      {activeTab === "ai" && (
        <>
          {/* AI KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-purple-500/10 rounded-xl">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-autronis-text-primary tabular-nums">{aiTotaal}</p>
              <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Totaal suggesties</p>
            </div>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                  <Target className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-emerald-400 tabular-nums">{aiGemScore}</p>
              <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Gem. score</p>
            </div>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-blue-500/10 rounded-xl">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-blue-400 tabular-nums">{aiKlant}</p>
              <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Klant ideeën</p>
            </div>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                  <User className="w-5 h-5 text-autronis-accent" />
                </div>
              </div>
              <p className="text-3xl font-bold text-autronis-accent tabular-nums">{aiPersoonlijk}</p>
              <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Persoonlijke ideeën</p>
            </div>
          </div>

          {/* AI Filter row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1">
              {[
                { key: "", label: "Alle" },
                { key: "klant", label: "Klant" },
                { key: "persoonlijk", label: "Persoonlijk" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFilterDoelgroep(opt.key)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    filterDoelgroep === opt.key
                      ? "bg-autronis-accent text-autronis-bg"
                      : "text-autronis-text-secondary hover:text-autronis-text-primary"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <button
              onClick={handleGenereer}
              disabled={genereerMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
            >
              {genereerMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Genereer nieuwe ideeën
            </button>
          </div>

          {/* AI Cards */}
          {aiSorted.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
              <p className="text-autronis-text-secondary mb-4">Nog geen AI-suggesties</p>
              <button
                onClick={handleGenereer}
                disabled={genereerMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
              >
                {genereerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Genereer ideeën
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {aiSorted.map((idee) => (
                <div
                  key={idee.id}
                  className="bg-autronis-card border border-autronis-border rounded-2xl p-6 hover:border-autronis-accent/50 transition-all card-glow"
                >
                  {/* Score + naam */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-autronis-text-primary truncate">
                        {idee.naam}
                      </h3>
                      {idee.omschrijving && (
                        <p className="text-sm text-autronis-text-secondary mt-1 line-clamp-2">
                          {idee.omschrijving}
                        </p>
                      )}
                    </div>
                    {idee.aiScore != null && (
                      <span className={cn(
                        "text-lg font-bold px-3 py-1 rounded-xl flex-shrink-0 tabular-nums",
                        scoreKleur(idee.aiScore)
                      )}>
                        {idee.aiScore}
                      </span>
                    )}
                  </div>

                  {/* Sub-scores */}
                  <div className="flex items-center gap-4 text-xs text-autronis-text-secondary mb-3">
                    {idee.aiHaalbaarheid != null && (
                      <span>Haalbaarheid: <span className="text-autronis-text-primary font-medium">{idee.aiHaalbaarheid}/10</span></span>
                    )}
                    {idee.aiMarktpotentie != null && (
                      <span>Markt: <span className="text-autronis-text-primary font-medium">{idee.aiMarktpotentie}/10</span></span>
                    )}
                    {idee.aiFitAutronis != null && (
                      <span>Fit: <span className="text-autronis-text-primary font-medium">{idee.aiFitAutronis}/10</span></span>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {idee.doelgroep && (
                      <span className={cn(
                        "text-xs font-medium px-2.5 py-1 rounded-full",
                        idee.doelgroep === "klant" ? "bg-blue-500/15 text-blue-400" : "bg-autronis-accent/15 text-autronis-accent"
                      )}>
                        {idee.doelgroep === "klant" ? "Klant" : "Persoonlijk"}
                      </span>
                    )}
                    {idee.verdienmodel && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-autronis-border/50 text-autronis-text-secondary">
                        {idee.verdienmodel}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-autronis-border">
                    <button
                      onClick={() => handlePromoveer(idee.id)}
                      disabled={promoveerMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      Promoveer naar backlog
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => handleDeleteAi(idee)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Verwijderen
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
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {detailIdee.nummer != null && (
                    <span className="text-sm text-autronis-text-secondary font-mono">
                      #{detailIdee.nummer}
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-autronis-text-primary">
                    {detailIdee.naam}
                  </h3>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", statusBadgeKleuren[detailIdee.status] || "bg-gray-500/15 text-gray-400")}>
                    {statusLabel(detailIdee.status)}
                  </span>
                  {detailIdee.categorie && (
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", categorieBadgeKleuren[detailIdee.categorie] || "bg-gray-500/15 text-gray-400")}>
                      {categorieLabel(detailIdee.categorie)}
                    </span>
                  )}
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-autronis-border/50 text-autronis-text-secondary">
                    {prioriteitLabel(detailIdee.prioriteit)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setDetailIdee(null); setNotionUrl(null); }}
                className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Omschrijving */}
            {detailIdee.omschrijving && (
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-2">
                  Omschrijving
                </h4>
                <p className="text-sm text-autronis-text-primary whitespace-pre-wrap leading-relaxed">
                  {detailIdee.omschrijving}
                </p>
              </div>
            )}

            {/* Uitwerking */}
            {detailIdee.uitwerking && (
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-2">
                  Uitwerking
                </h4>
                <p className="text-sm text-autronis-text-primary whitespace-pre-wrap leading-relaxed">
                  {detailIdee.uitwerking}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-autronis-border">
              <button
                onClick={() => openEditForm(detailIdee)}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 rounded-xl text-sm font-medium transition-colors"
              >
                <Edit className="w-4 h-4" />
                Bewerken
              </button>

              {(detailIdee.status === "idee" || detailIdee.status === "uitgewerkt") && (
                <button
                  onClick={handleStartProject}
                  disabled={startProjectMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500/15 text-green-400 hover:bg-green-500/25 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {startProjectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4" />
                  )}
                  Start als project
                </button>
              )}

              {(detailIdee.status === "actief" || detailIdee.status === "gebouwd") && (
                <>
                  <button
                    onClick={handleRegenereerPlan}
                    disabled={regenereerPlanMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {regenereerPlanMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    Regenereer Notion plan
                  </button>
                  {notionUrl && (
                    <a
                      href={notionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25 rounded-xl text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in Notion
                    </a>
                  )}
                </>
              )}

              <div className="flex-1" />

              <button
                onClick={() => setDeleteDialogOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-autronis-text-primary">
                {editIdee ? "Idee bewerken" : "Nieuw idee"}
              </h3>
              <button
                onClick={() => setFormOpen(false)}
                className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Naam *</label>
                  <input
                    type="text"
                    value={formNaam}
                    onChange={(e) => setFormNaam(e.target.value)}
                    className={inputClasses}
                    placeholder="Naam van het idee"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Nummer</label>
                  <input
                    type="number"
                    value={formNummer}
                    onChange={(e) => setFormNummer(e.target.value)}
                    className={inputClasses}
                    placeholder="Optioneel"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Categorie</label>
                  <select
                    value={formCategorie}
                    onChange={(e) => setFormCategorie(e.target.value)}
                    className={cn(inputClasses)}
                  >
                    <option value="">Geen</option>
                    {categorieOpties.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className={cn(inputClasses)}
                  >
                    {statusOpties.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Prioriteit</label>
                  <select
                    value={formPrioriteit}
                    onChange={(e) => setFormPrioriteit(e.target.value)}
                    className={cn(inputClasses)}
                  >
                    {prioriteitOpties.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-autronis-text-secondary">Omschrijving</label>
                <textarea
                  value={formOmschrijving}
                  onChange={(e) => setFormOmschrijving(e.target.value)}
                  rows={3}
                  className={cn(inputClasses, "resize-none")}
                  placeholder="Korte omschrijving van het idee..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-autronis-text-secondary">Uitwerking</label>
                <textarea
                  value={formUitwerking}
                  onChange={(e) => setFormUitwerking(e.target.value)}
                  rows={8}
                  className={cn(inputClasses, "resize-none")}
                  placeholder="Uitgebreide uitwerking van het idee..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setFormOpen(false)}
                className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleOpslaan}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Opslaan..." : editIdee ? "Bijwerken" : "Toevoegen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onBevestig={handleDelete}
        titel="Idee verwijderen?"
        bericht={`Weet je zeker dat je "${detailIdee?.naam}" wilt verwijderen?`}
        bevestigTekst="Verwijderen"
        variant="danger"
      />
    </div>
    </PageTransition>
  );
}
