"use client";

import { useState, useMemo } from "react";
import {
  Radar,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  Rss,
  Star,
  Database,
  Clock,
  ThumbsDown,
  Sparkles,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useRadarBronnen,
  useRadarItems,
  useRadarFetch,
  useToggleBewaard,
  useMarkNietRelevant,
  useAddBron,
  useDeleteBron,
  type RadarItem,
  type RadarBron,
} from "@/hooks/queries/use-radar";
import { PageTransition } from "@/components/ui/page-transition";

// ============ CONSTANTS ============

type TabKey = "feed" | "bewaard" | "bronnen";

const tabs: { key: TabKey; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "bewaard", label: "Bewaard" },
  { key: "bronnen", label: "Bronnen" },
];

const categorieOpties = [
  { value: "", label: "Alle" },
  { value: "ai_tools", label: "AI Tools" },
  { value: "api_updates", label: "API Updates" },
  { value: "automation", label: "Automation" },
  { value: "business", label: "Business" },
  { value: "competitors", label: "Competitors" },
  { value: "tutorials", label: "Tutorials" },
  { value: "trends", label: "Trends" },
  { value: "kansen", label: "Kansen" },
  { value: "must_reads", label: "Must-reads" },
];

const categorieBadge: Record<string, string> = {
  ai_tools: "bg-blue-500/15 text-blue-400",
  api_updates: "bg-purple-500/15 text-purple-400",
  automation: "bg-cyan-500/15 text-cyan-400",
  business: "bg-amber-500/15 text-amber-400",
  competitors: "bg-red-500/15 text-red-400",
  tutorials: "bg-indigo-500/15 text-indigo-400",
  trends: "bg-orange-500/15 text-orange-400",
  kansen: "bg-green-500/15 text-green-400",
  must_reads: "bg-rose-500/15 text-rose-400",
  // Legacy
  tools: "bg-blue-500/15 text-blue-400",
};

const bronTypeOpties = ["rss", "api", "website", "newsletter", "reddit", "producthunt", "github"];

// ============ HELPERS ============

function formatDatumKort(datum: string): string {
  const d = new Date(datum);
  const nu = new Date();
  const diff = nu.getTime() - d.getTime();
  const dagen = Math.floor(diff / 86400000);
  if (dagen === 0) return "Vandaag";
  if (dagen === 1) return "Gisteren";
  if (dagen < 7) return `${dagen} dagen geleden`;
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

// ============ SCORE BADGE ============

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-autronis-border/50 text-autronis-text-secondary">
        ?
      </span>
    );
  }

  if (score >= 8) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border border-amber-500/30">
        <Star className="w-3 h-3" />
        Must Read
      </span>
    );
  }

  if (score >= 6) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-autronis-accent/15 text-autronis-accent">
        {score}/10
      </span>
    );
  }

  if (score >= 3) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-autronis-border/50 text-autronis-text-secondary">
        {score}/10
      </span>
    );
  }

  return null; // Score 1-2: verberg
}

// ============ ITEM CARD ============

function ItemCard({
  item,
  onToggleBewaard,
  onNietRelevant,
  isToggling,
}: {
  item: RadarItem;
  onToggleBewaard: (id: number, bewaard: boolean) => void;
  onNietRelevant: (id: number) => void;
  isToggling: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const categorieLabel = categorieOpties.find((c) => c.value === item.categorie)?.label ?? item.categorie;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Score + badges row */}
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <ScoreBadge score={item.score} />
            {item.categorie && (
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                  categorieBadge[item.categorie] || "bg-autronis-border text-autronis-text-secondary"
                )}
              >
                {categorieLabel}
              </span>
            )}
            {item.bronNaam && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-autronis-bg text-autronis-text-secondary border border-autronis-border/50">
                {item.bronNaam}
              </span>
            )}
            {item.leesMinuten && (
              <span className="inline-flex items-center gap-1 text-xs text-autronis-text-secondary">
                <Clock className="w-3 h-3" />
                {item.leesMinuten} min
              </span>
            )}
            {item.gepubliceerdOp && (
              <span className="text-xs text-autronis-text-secondary/60">
                {formatDatumKort(item.gepubliceerdOp)}
              </span>
            )}
          </div>

          {/* Title */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-base font-semibold text-autronis-text-primary hover:text-autronis-accent transition-colors group"
          >
            <span className="line-clamp-2">{item.titel}</span>
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>

          {/* AI samenvatting */}
          {item.aiSamenvatting && (
            <p className="text-sm text-autronis-text-secondary mt-2 leading-relaxed line-clamp-2">
              {item.aiSamenvatting}
            </p>
          )}

          {/* Relevantie tag */}
          {item.relevantie && (
            <div className="mt-2 flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-autronis-accent mt-0.5 flex-shrink-0" />
              <p className="text-xs text-autronis-accent/80 leading-relaxed">{item.relevantie}</p>
            </div>
          )}

          {/* Expanded: score reasoning */}
          {expanded && item.scoreRedenering && (
            <div className="mt-3 p-3 bg-autronis-bg/50 rounded-xl text-xs text-autronis-text-secondary leading-relaxed">
              <span className="font-medium text-autronis-text-primary">Score uitleg:</span> {item.scoreRedenering}
            </div>
          )}

          {/* Auteur + expand */}
          <div className="flex items-center gap-3 mt-2">
            {item.auteur && (
              <p className="text-xs text-autronis-text-secondary/50">
                door {item.auteur}
              </p>
            )}
            {item.scoreRedenering && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors flex items-center gap-1"
              >
                <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
                {expanded ? "Minder" : "Meer info"}
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={() => onToggleBewaard(item.id, !item.bewaard)}
            disabled={isToggling}
            className={cn(
              "p-2 rounded-lg transition-colors",
              item.bewaard
                ? "text-autronis-accent hover:bg-autronis-accent/10"
                : "text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10"
            )}
            title={item.bewaard ? "Verwijder uit bewaard" : "Bewaar"}
          >
            {item.bewaard ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onNietRelevant(item.id)}
            className="p-2 rounded-lg text-autronis-text-secondary/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Niet relevant"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ MUST-READS HIGHLIGHT ============

function MustReadsSection({ items, onToggleBewaard, onNietRelevant, isToggling }: {
  items: RadarItem[];
  onToggleBewaard: (id: number, bewaard: boolean) => void;
  onNietRelevant: (id: number) => void;
  isToggling: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500/5 to-yellow-500/5 border border-amber-500/20 rounded-2xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
        <Star className="w-5 h-5" />
        Must-reads
        <span className="text-xs font-normal text-amber-400/60">Score 8+</span>
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onToggleBewaard={onToggleBewaard}
            onNietRelevant={onNietRelevant}
            isToggling={isToggling}
          />
        ))}
      </div>
    </div>
  );
}

// ============ DIGEST SECTION ============

function DigestSection({ items }: { items: RadarItem[] }) {
  const vandaag = new Date().toISOString().slice(0, 10);
  const gisteren = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const nieuweItems = items.filter((i) => {
    const d = i.gepubliceerdOp?.slice(0, 10) || i.aangemaaktOp.slice(0, 10);
    return d === vandaag || d === gisteren;
  });

  const mustReads = nieuweItems.filter((i) => i.score != null && i.score >= 8);

  if (nieuweItems.length === 0) return null;

  return (
    <div className="bg-autronis-card/50 border border-autronis-border/50 rounded-xl px-5 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-autronis-text-primary font-medium">
          Vandaag: <span className="text-autronis-accent tabular-nums">{nieuweItems.length}</span> nieuwe items
        </span>
        {mustReads.length > 0 && (
          <span className="text-amber-400 font-medium flex items-center gap-1">
            <Star className="w-3.5 h-3.5" />
            {mustReads.length} must-read{mustReads.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <span className="text-xs text-autronis-text-secondary">
        {items.length} items totaal
      </span>
    </div>
  );
}

// ============ BRON ROW ============

function BronRow({
  bron,
  onDelete,
}: {
  bron: RadarBron;
  onDelete: (id: number) => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between bg-autronis-card border border-autronis-border rounded-2xl p-4 lg:p-5 card-glow transition-colors">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="p-2 bg-autronis-accent/10 rounded-xl flex-shrink-0">
            <Rss className="w-4 h-4 text-autronis-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-autronis-text-primary truncate">{bron.naam}</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-autronis-accent/10 text-autronis-accent">
                {bron.type}
              </span>
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                  bron.actief
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                )}
              >
                {bron.actief ? "Actief" : "Inactief"}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <a
                href={bron.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors truncate"
              >
                {bron.url}
              </a>
              {bron.aantalItems > 0 && (
                <span className="text-xs text-autronis-text-secondary/60 tabular-nums flex-shrink-0">
                  {bron.aantalItems} items
                </span>
              )}
              {bron.laatstGescand && (
                <span className="text-xs text-autronis-text-secondary/60 flex-shrink-0">
                  Laatst: {formatDatumKort(bron.laatstGescand)}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setDeleteOpen(true)}
          className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onBevestig={() => {
          onDelete(bron.id);
          setDeleteOpen(false);
        }}
        titel="Bron verwijderen?"
        bericht={`Weet je zeker dat je "${bron.naam}" wilt verwijderen? Alle gekoppelde items blijven bewaard.`}
        bevestigTekst="Verwijderen"
        variant="danger"
      />
    </>
  );
}

// ============ MAIN PAGE ============

export default function RadarPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("feed");
  const [categorie, setCategorie] = useState("");
  const [minScore, setMinScore] = useState(5);

  // Bron form
  const [bronFormOpen, setBronFormOpen] = useState(false);
  const [bronNaam, setBronNaam] = useState("");
  const [bronUrl, setBronUrl] = useState("");
  const [bronType, setBronType] = useState("rss");

  // Queries
  const feedFilters = activeTab === "bewaard"
    ? { bewaard: true as const }
    : {
        categorie: categorie || undefined,
        minScore: minScore > 1 ? minScore : undefined,
      };

  const { data: items = [], isLoading: itemsLaden } = useRadarItems(
    activeTab === "bronnen" ? undefined : feedFilters
  );
  const { data: bronnen = [], isLoading: bronnenLaden } = useRadarBronnen();

  // Mutations
  const fetchMutation = useRadarFetch();
  const toggleBewaard = useToggleBewaard();
  const markNietRelevant = useMarkNietRelevant();
  const addBron = useAddBron();
  const deleteBron = useDeleteBron();

  // KPIs
  const { data: alleItems = [] } = useRadarItems({ minScore: 1 });
  const totaalItems = alleItems.length;
  const mustReads = alleItems.filter((i) => i.score != null && i.score >= 8).length;
  const bewaardCount = alleItems.filter((i) => i.bewaard).length;
  const bronnenActief = bronnen.filter((b) => b.actief).length;

  // Must-reads apart
  const mustReadItems = useMemo(() =>
    items.filter((i) => i.score != null && i.score >= 8),
    [items]
  );
  const restItems = useMemo(() =>
    items.filter((i) => !i.score || i.score < 8),
    [items]
  );

  // Trending: categorieën met meeste items deze week
  const trending = useMemo(() => {
    const weekGeleden = new Date(Date.now() - 7 * 86400000).toISOString();
    const recent = alleItems.filter((i) => (i.gepubliceerdOp || i.aangemaaktOp) >= weekGeleden);
    const catCount: Record<string, number> = {};
    for (const item of recent) {
      if (item.categorie) {
        catCount[item.categorie] = (catCount[item.categorie] || 0) + 1;
      }
    }
    return Object.entries(catCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [alleItems]);

  function handleFetch() {
    fetchMutation.mutate(undefined, {
      onSuccess: (data) => {
        addToast(`${data.nieuw} nieuwe items opgehaald (${data.totaal} totaal)`, "succes");
      },
      onError: () => addToast("Kon items niet ophalen", "fout"),
    });
  }

  function handleToggleBewaard(id: number, bewaard: boolean) {
    toggleBewaard.mutate(
      { id, bewaard },
      {
        onSuccess: () => addToast(bewaard ? "Item bewaard" : "Item verwijderd uit bewaard", "succes"),
        onError: () => addToast("Kon bewaard status niet wijzigen", "fout"),
      }
    );
  }

  function handleNietRelevant(id: number) {
    markNietRelevant.mutate(id, {
      onSuccess: () => addToast("Item gemarkeerd als niet relevant", "succes"),
      onError: () => addToast("Kon item niet markeren", "fout"),
    });
  }

  function handleAddBron() {
    if (!bronNaam.trim() || !bronUrl.trim()) {
      addToast("Naam en URL zijn verplicht", "fout");
      return;
    }
    addBron.mutate(
      { naam: bronNaam, url: bronUrl, type: bronType },
      {
        onSuccess: () => {
          addToast("Bron toegevoegd", "succes");
          setBronNaam("");
          setBronUrl("");
          setBronType("rss");
          setBronFormOpen(false);
        },
        onError: () => addToast("Kon bron niet toevoegen", "fout"),
      }
    );
  }

  function handleDeleteBron(id: number) {
    deleteBron.mutate(id, {
      onSuccess: () => addToast("Bron verwijderd", "succes"),
      onError: () => addToast("Kon bron niet verwijderen", "fout"),
    });
  }

  const inputClasses =
    "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";

  const loading = activeTab === "bronnen" ? bronnenLaden : itemsLaden;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-2 border-autronis-accent/30 border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="max-w-[1400px] mx-auto p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">Learning Radar</h1>
          <p className="text-base text-autronis-text-secondary mt-1">
            AI & tech trends automatisch gescand en gescoord
          </p>
        </div>
        <button
          onClick={handleFetch}
          disabled={fetchMutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50 btn-press"
        >
          {fetchMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Nieuwe items ophalen
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-autronis-accent/10 rounded-xl">
              <Radar className="w-4 h-4 text-autronis-accent" />
            </div>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">{totaalItems}</p>
          <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Items</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-amber-500/10 rounded-xl">
              <Star className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400 tabular-nums">{mustReads}</p>
          <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Must-reads</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-yellow-500/10 rounded-xl">
              <BookmarkCheck className="w-4 h-4 text-yellow-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-yellow-400 tabular-nums">{bewaardCount}</p>
          <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Bewaard</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Database className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-400 tabular-nums">{bronnenActief}</p>
          <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Bronnen</p>
        </div>
      </div>

      {/* Trending deze week */}
      {trending.length > 0 && activeTab === "feed" && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-sm font-medium text-autronis-text-secondary">
            <TrendingUp className="w-4 h-4" />
            Trending:
          </span>
          {trending.map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => setCategorie(cat)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                categorie === cat
                  ? "bg-autronis-accent text-autronis-bg"
                  : categorieBadge[cat] || "bg-autronis-border text-autronis-text-secondary"
              )}
            >
              {categorieOpties.find((c) => c.value === cat)?.label || cat}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          ))}
          {categorie && (
            <button
              onClick={() => setCategorie("")}
              className="text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            >
              Wis filter
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-autronis-accent/15 text-autronis-accent"
                : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/50"
            )}
          >
            {tab.label}
            {tab.key === "bewaard" && bewaardCount > 0 && (
              <span className="ml-1.5 text-xs opacity-60">{bewaardCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content: Feed */}
      {activeTab === "feed" && (
        <div className="space-y-5">
          {/* Digest */}
          <DigestSection items={alleItems} />

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm text-autronis-text-secondary whitespace-nowrap">Categorie:</label>
              {categorieOpties.slice(0, 6).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCategorie(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    categorie === opt.value
                      ? "bg-autronis-accent/15 text-autronis-accent"
                      : "bg-autronis-bg text-autronis-text-secondary hover:text-autronis-text-primary border border-autronis-border/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="bg-autronis-bg border border-autronis-border/50 rounded-lg px-2 py-1.5 text-xs text-autronis-text-secondary"
              >
                {categorieOpties.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-autronis-text-secondary whitespace-nowrap">
                Min. score: <span className="font-semibold text-autronis-text-primary tabular-nums">{minScore}</span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-28 accent-autronis-accent"
              />
            </div>
          </div>

          {/* Must-reads highlight */}
          <MustReadsSection
            items={mustReadItems}
            onToggleBewaard={handleToggleBewaard}
            onNietRelevant={handleNietRelevant}
            isToggling={toggleBewaard.isPending}
          />

          {/* Rest items */}
          {restItems.length === 0 && mustReadItems.length === 0 ? (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
              <Radar className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
              <p className="text-autronis-text-secondary">
                Geen items gevonden. Klik op &apos;Nieuwe items ophalen&apos; om feeds te scannen.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {restItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onToggleBewaard={handleToggleBewaard}
                  onNietRelevant={handleNietRelevant}
                  isToggling={toggleBewaard.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab content: Bewaard */}
      {activeTab === "bewaard" && (
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
              <Bookmark className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
              <p className="text-autronis-text-secondary">
                Nog geen bewaarde items. Gebruik het bladwijzer-icoon om items te bewaren.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onToggleBewaard={handleToggleBewaard}
                onNietRelevant={handleNietRelevant}
                isToggling={toggleBewaard.isPending}
              />
            ))
          )}
        </div>
      )}

      {/* Tab content: Bronnen */}
      {activeTab === "bronnen" && (
        <div className="space-y-5">
          {/* Add bron button */}
          <div className="flex justify-end">
            <button
              onClick={() => setBronFormOpen(!bronFormOpen)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
            >
              <Plus className="w-4 h-4" />
              Nieuwe bron
            </button>
          </div>

          {/* Inline form */}
          {bronFormOpen && (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-autronis-text-primary">Nieuwe bron toevoegen</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Naam</label>
                  <input
                    type="text"
                    value={bronNaam}
                    onChange={(e) => setBronNaam(e.target.value)}
                    className={inputClasses}
                    placeholder="Anthropic Blog"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">URL</label>
                  <input
                    type="url"
                    value={bronUrl}
                    onChange={(e) => setBronUrl(e.target.value)}
                    className={inputClasses}
                    placeholder="https://anthropic.com/blog/rss"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">Type</label>
                  <select
                    value={bronType}
                    onChange={(e) => setBronType(e.target.value)}
                    className={inputClasses}
                  >
                    {bronTypeOpties.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setBronFormOpen(false)}
                  className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleAddBron}
                  disabled={addBron.isPending}
                  className="px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
                >
                  {addBron.isPending ? "Toevoegen..." : "Toevoegen"}
                </button>
              </div>
            </div>
          )}

          {/* Bronnen list */}
          {bronnen.length === 0 ? (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
              <Rss className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
              <p className="text-autronis-text-secondary">
                Nog geen bronnen. Voeg een RSS feed of API bron toe.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bronnen.map((bron) => (
                <BronRow
                  key={bron.id}
                  bron={bron}
                  onDelete={handleDeleteBron}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </PageTransition>
  );
}
