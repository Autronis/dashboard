"use client";

import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useRadarBronnen,
  useRadarItems,
  useRadarFetch,
  useToggleBewaard,
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
  { value: "tools", label: "Tools" },
  { value: "api_updates", label: "API Updates" },
  { value: "trends", label: "Trends" },
  { value: "kansen", label: "Kansen" },
  { value: "must_reads", label: "Must-reads" },
];

const categorieBadge: Record<string, string> = {
  tools: "bg-blue-500/15 text-blue-400",
  api_updates: "bg-purple-500/15 text-purple-400",
  trends: "bg-orange-500/15 text-orange-400",
  kansen: "bg-green-500/15 text-green-400",
  must_reads: "bg-red-500/15 text-red-400",
};

const bronTypeOpties = ["rss", "api", "website", "newsletter"];

// ============ HELPERS ============

function scoreBadgeKleur(score: number): string {
  if (score >= 8) return "bg-emerald-500/15 text-emerald-400";
  if (score >= 5) return "bg-yellow-500/15 text-yellow-400";
  return "bg-red-500/15 text-red-400";
}

function formatDatumKort(datum: string): string {
  const d = new Date(datum);
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

// ============ SCORE BADGE ============

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-autronis-border/50 text-autronis-text-secondary">
        Nog niet gescoord
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tabular-nums",
        scoreBadgeKleur(score)
      )}
    >
      {score}/10
    </span>
  );
}

// ============ ITEM CARD ============

function ItemCard({
  item,
  onToggleBewaard,
  isToggling,
}: {
  item: RadarItem;
  onToggleBewaard: (id: number, bewaard: boolean) => void;
  isToggling: boolean;
}) {
  const categorieLabel = categorieOpties.find((c) => c.value === item.categorie)?.label ?? item.categorie;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Score + badges row */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <ScoreBadge score={item.score} />
            {item.bronNaam && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-autronis-accent/10 text-autronis-accent">
                {item.bronNaam}
              </span>
            )}
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
            {item.gepubliceerdOp && (
              <span className="text-xs text-autronis-text-secondary">
                {formatDatumKort(item.gepubliceerdOp)}
              </span>
            )}
          </div>

          {/* Title */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-lg font-semibold text-autronis-text-primary hover:text-autronis-accent transition-colors group"
          >
            <span className="line-clamp-2">{item.titel}</span>
            <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>

          {/* AI samenvatting */}
          {item.aiSamenvatting && (
            <p className="text-sm text-autronis-text-secondary mt-2 line-clamp-3 leading-relaxed">
              {item.aiSamenvatting}
            </p>
          )}

          {/* Auteur */}
          {item.auteur && (
            <p className="text-xs text-autronis-text-secondary/60 mt-2">
              door {item.auteur}
            </p>
          )}
        </div>

        {/* Bookmark button */}
        <button
          onClick={() => onToggleBewaard(item.id, !item.bewaard)}
          disabled={isToggling}
          className={cn(
            "p-2 rounded-lg transition-colors flex-shrink-0",
            item.bewaard
              ? "text-autronis-accent hover:bg-autronis-accent/10"
              : "text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10"
          )}
          title={item.bewaard ? "Verwijder uit bewaard" : "Bewaar item"}
        >
          {item.bewaard ? (
            <BookmarkCheck className="w-5 h-5" />
          ) : (
            <Bookmark className="w-5 h-5" />
          )}
        </button>
      </div>
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
      <div className="flex items-center justify-between bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow transition-colors">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="p-2.5 bg-autronis-accent/10 rounded-xl flex-shrink-0">
            <Rss className="w-5 h-5 text-autronis-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-autronis-text-primary truncate">{bron.naam}</p>
            <a
              href={bron.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors truncate block"
            >
              {bron.url}
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-autronis-accent/10 text-autronis-accent">
            {bron.type}
          </span>
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
              bron.actief
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            )}
          >
            {bron.actief ? "Actief" : "Inactief"}
          </span>
          <button
            onClick={() => setDeleteOpen(true)}
            className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
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
  const [minScore, setMinScore] = useState(1);

  // Bron form
  const [bronFormOpen, setBronFormOpen] = useState(false);
  const [bronNaam, setBronNaam] = useState("");
  const [bronUrl, setBronUrl] = useState("");
  const [bronType, setBronType] = useState("rss");

  // Queries
  const feedFilters = activeTab === "bewaard"
    ? { bewaard: true }
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
  const addBron = useAddBron();
  const deleteBron = useDeleteBron();

  // KPIs
  const { data: alleItems = [] } = useRadarItems();
  const totaalItems = alleItems.length;
  const mustReads = alleItems.filter((i) => i.score != null && i.score >= 8).length;
  const bewaardCount = alleItems.filter((i) => i.bewaard).length;
  const bronnenActief = bronnen.filter((b) => b.actief).length;

  function handleFetch() {
    fetchMutation.mutate(undefined, {
      onSuccess: (data) => {
        addToast(`${data.nieuw} nieuwe items opgehaald (${data.totaal} totaal)`, "succes");
      },
      onError: () => {
        addToast("Kon items niet ophalen", "fout");
      },
    });
  }

  function handleToggleBewaard(id: number, bewaard: boolean) {
    toggleBewaard.mutate(
      { id, bewaard },
      {
        onSuccess: () => {
          addToast(bewaard ? "Item bewaard" : "Item verwijderd uit bewaard", "succes");
        },
        onError: () => {
          addToast("Kon bewaard status niet wijzigen", "fout");
        },
      }
    );
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
        onError: () => {
          addToast("Kon bron niet toevoegen", "fout");
        },
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
    <div className="max-w-[1400px] mx-auto p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Learning Radar</h1>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
              <Radar className="w-5 h-5 text-autronis-accent" />
            </div>
          </div>
          <p className="text-3xl font-bold text-autronis-text-primary tabular-nums">{totaalItems}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Totaal items</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <Star className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-400 tabular-nums">{mustReads}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Must-reads</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-yellow-500/10 rounded-xl">
              <BookmarkCheck className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-yellow-400 tabular-nums">{bewaardCount}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Bewaard</p>
        </div>

        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-400 tabular-nums">{bronnenActief}</p>
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Bronnen actief</p>
        </div>
      </div>

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
          </button>
        ))}
      </div>

      {/* Tab content: Feed */}
      {activeTab === "feed" && (
        <div className="space-y-5">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-autronis-text-secondary whitespace-nowrap">Categorie:</label>
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="bg-autronis-bg border border-autronis-border rounded-xl px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
              >
                {categorieOpties.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
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
                className="w-32 accent-autronis-accent"
              />
            </div>
          </div>

          {/* Items list */}
          {items.length === 0 ? (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
              <Radar className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
              <p className="text-autronis-text-secondary">
                Geen items gevonden. Klik op &apos;Nieuwe items ophalen&apos; om RSS feeds te scannen.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onToggleBewaard={handleToggleBewaard}
                  isToggling={toggleBewaard.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab content: Bewaard */}
      {activeTab === "bewaard" && (
        <div className="space-y-4">
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
                    placeholder="OpenAI Blog"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-autronis-text-secondary">URL</label>
                  <input
                    type="url"
                    value={bronUrl}
                    onChange={(e) => setBronUrl(e.target.value)}
                    className={inputClasses}
                    placeholder="https://openai.com/blog/rss"
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
                      <option key={t} value={t}>
                        {t}
                      </option>
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
