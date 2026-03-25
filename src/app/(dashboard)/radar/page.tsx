"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  TrendingDown,
  ChevronDown,
  Zap,
  Globe,
  Mail,
  Github,
  Rocket,
  MessageSquare,
  BookOpen,
  CheckCheck,
  Eye,
  Send,
  X,
  CalendarPlus,
  Share2,
  AlertCircle,
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

// ============ TYPES ============

type TabKey = "feed" | "bewaard" | "bronnen";

interface TrendingEntry {
  cat: string;
  label: string;
  count: number;
  delta: number;
}

// ============ CONSTANTS ============

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
  ai_tools: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  api_updates: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  automation: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  business: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  competitors: "bg-red-500/15 text-red-400 border-red-500/25",
  tutorials: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  trends: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  kansen: "bg-green-500/15 text-green-400 border-green-500/25",
  must_reads: "bg-rose-500/15 text-rose-400 border-rose-500/25",
  tools: "bg-purple-500/15 text-purple-400 border-purple-500/25",
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

function scoreGlow(score: number): string {
  if (score === 10) return "0 0 16px rgba(234,179,8,0.6), 0 0 32px rgba(234,179,8,0.2)";
  if (score >= 8) return "0 0 10px rgba(245,158,11,0.4)";
  if (score >= 5) return "0 0 8px rgba(23,184,165,0.25)";
  return "none";
}

// ============ DISMISS TRACKING ============

const DISMISS_STORAGE_KEY = "radar_dismiss_counts";
const DISMISS_HINT_THRESHOLD = 5;

function getDismissCounts(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_STORAGE_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function trackDismiss(categorie: string | null) {
  if (!categorie) return;
  const counts = getDismissCounts();
  counts[categorie] = (counts[categorie] ?? 0) + 1;
  localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(counts));
}

function getTopDismissedCategory(): { cat: string; label: string; count: number } | null {
  const counts = getDismissCounts();
  let topCat: string | null = null;
  let topCount = 0;
  for (const [cat, count] of Object.entries(counts)) {
    if (count >= DISMISS_HINT_THRESHOLD && count > topCount) {
      topCat = cat;
      topCount = count;
    }
  }
  if (!topCat) return null;
  const label = categorieOpties.find((c) => c.value === topCat)?.label ?? topCat;
  return { cat: topCat, label, count: topCount };
}

function clearDismissCount(cat: string) {
  const counts = getDismissCounts();
  delete counts[cat];
  localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(counts));
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

  if (score === 10) {
    return (
      <motion.span
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-500/25 to-amber-500/25 text-yellow-300 border border-yellow-500/40"
        style={{ boxShadow: scoreGlow(10) }}
        animate={{ opacity: [1, 0.8, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Star className="w-3 h-3" />
        10/10
      </motion.span>
    );
  }

  if (score >= 8) {
    return (
      <span
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border border-amber-500/30"
        style={{ boxShadow: scoreGlow(score) }}
      >
        <Star className="w-3 h-3" />
        Must Read
      </span>
    );
  }

  if (score >= 5) {
    return (
      <span
        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-autronis-accent/15 text-autronis-accent border border-autronis-accent/20"
        style={{ boxShadow: scoreGlow(score) }}
      >
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

  return null;
}

// ============ BRON TYPE ICON ============

function BronTypeIcon({ type }: { type: string | null }) {
  const icons: Record<string, React.ReactNode> = {
    rss: <Rss className="w-3 h-3" />,
    reddit: <MessageSquare className="w-3 h-3" />,
    github: <Github className="w-3 h-3" />,
    producthunt: <Rocket className="w-3 h-3" />,
    newsletter: <Mail className="w-3 h-3" />,
    website: <Globe className="w-3 h-3" />,
    api: <Zap className="w-3 h-3" />,
  };
  return (
    <span className="inline-flex items-center text-autronis-text-secondary/50">
      {type ? (icons[type] ?? <Globe className="w-3 h-3" />) : <Rss className="w-3 h-3" />}
    </span>
  );
}

// ============ ITEM CARD ============

function ItemCard({
  item,
  onToggleBewaard,
  onNietRelevant,
  onVraagClaude,
  onLeesLater,
  onDeelInzicht,
  isToggling,
  isOpened,
  onOpen,
  notitie,
  onNotitieChange,
  showNotitie,
}: {
  item: RadarItem;
  onToggleBewaard: (id: number, bewaard: boolean) => void;
  onNietRelevant: (id: number) => void;
  onVraagClaude: (item: RadarItem) => void;
  onLeesLater: (item: RadarItem) => void;
  onDeelInzicht: (item: RadarItem) => void;
  isToggling: boolean;
  isOpened: boolean;
  onOpen: (id: number) => void;
  notitie?: string;
  onNotitieChange?: (id: number, notitie: string) => void;
  showNotitie?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notitieOpen, setNotitieOpen] = useState(false);
  const categorieLabel =
    categorieOpties.find((c) => c.value === item.categorie)?.label ?? item.categorie;

  return (
    <div
      className={cn(
        "bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow transition-all",
        isOpened && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <ScoreBadge score={item.score} />
            {item.categorie && (
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                  categorieBadge[item.categorie] ??
                    "bg-autronis-border text-autronis-text-secondary border-transparent"
                )}
              >
                {categorieLabel}
              </span>
            )}
            {item.bronNaam && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-autronis-bg text-autronis-text-secondary border border-autronis-border/50">
                <BronTypeIcon type={item.bronType} />
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
            {isOpened && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-autronis-accent/8 text-autronis-accent/50">
                <Eye className="w-3 h-3" />
                Geopend
              </span>
            )}
          </div>

          {/* Titel */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpen(item.id)}
            className="inline-flex items-center gap-1.5 text-base font-semibold text-autronis-text-primary hover:text-autronis-accent transition-colors group"
          >
            <span className="line-clamp-2 group-hover:underline underline-offset-2 decoration-autronis-accent/40">
              {item.titel}
            </span>
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>

          {/* AI samenvatting */}
          {item.aiSamenvatting && (
            <p className="text-sm text-autronis-text-secondary mt-2 leading-relaxed line-clamp-2">
              {item.aiSamenvatting}
            </p>
          )}

          {/* Relevantie */}
          {item.relevantie && (
            <div className="mt-2 flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-autronis-accent mt-0.5 flex-shrink-0" />
              <p className="text-xs text-autronis-accent/80 leading-relaxed">{item.relevantie}</p>
            </div>
          )}

          {/* Score redenering uitklapbaar */}
          {expanded && item.scoreRedenering && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 p-3 bg-autronis-bg/50 rounded-xl text-xs text-autronis-text-secondary leading-relaxed overflow-hidden"
            >
              <span className="font-medium text-autronis-text-primary">Score uitleg: </span>
              {item.scoreRedenering}
            </motion.div>
          )}

          {/* Bewaard notitie */}
          {showNotitie && notitieOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 overflow-hidden"
            >
              <textarea
                value={notitie ?? ""}
                onChange={(e) => onNotitieChange?.(item.id, e.target.value)}
                placeholder="Waarom bewaard je dit?"
                rows={2}
                className="w-full bg-autronis-bg/50 border border-autronis-border/50 rounded-xl px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-secondary/40 focus:outline-none focus:ring-1 focus:ring-autronis-accent/50 resize-none"
              />
            </motion.div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {item.auteur && (
              <p className="text-xs text-autronis-text-secondary/50">door {item.auteur}</p>
            )}
            {item.scoreRedenering && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors flex items-center gap-1"
              >
                <ChevronDown
                  className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")}
                />
                {expanded ? "Minder" : "Score uitleg"}
              </button>
            )}
            <button
              onClick={() => onVraagClaude(item)}
              className="text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Vraag Claude
            </button>
            <button
              onClick={() => onLeesLater(item)}
              className="text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors flex items-center gap-1"
            >
              <CalendarPlus className="w-3 h-3" />
              Lees later
            </button>
            <button
              onClick={() => onDeelInzicht(item)}
              className="text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors flex items-center gap-1"
            >
              <Share2 className="w-3 h-3" />
              Deel als inzicht
            </button>
            {showNotitie && (
              <button
                onClick={() => setNotitieOpen(!notitieOpen)}
                className="text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors flex items-center gap-1"
              >
                <BookOpen className="w-3 h-3" />
                {notitie ? "Notitie" : "Notitie toevoegen"}
              </button>
            )}
          </div>
        </div>

        {/* Acties */}
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

// ============ MUST-READS SECTIE ============

function MustReadsSection({
  items,
  hasNieuw,
  onToggleBewaard,
  onNietRelevant,
  onVraagClaude,
  onLeesLater,
  onDeelInzicht,
  isToggling,
  openedIds,
  onOpen,
}: {
  items: RadarItem[];
  hasNieuw: boolean;
  onToggleBewaard: (id: number, bewaard: boolean) => void;
  onNietRelevant: (id: number) => void;
  onVraagClaude: (item: RadarItem) => void;
  onLeesLater: (item: RadarItem) => void;
  onDeelInzicht: (item: RadarItem) => void;
  isToggling: boolean;
  openedIds: Set<number>;
  onOpen: (id: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="border-l-4 border-amber-500/60 bg-gradient-to-r from-amber-500/5 to-transparent rounded-r-2xl pl-5 pr-5 py-5 space-y-4">
      <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
        <motion.div
          animate={hasNieuw ? { opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 1.5, repeat: hasNieuw ? Infinity : 0 }}
        >
          <Star className="w-5 h-5" />
        </motion.div>
        Must-reads
        <span className="text-xs font-normal text-amber-400/60">Score 8+</span>
        {hasNieuw && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
            Nieuw
          </span>
        )}
      </h2>
      <AnimatePresence mode="popLayout">
        <div className="space-y-3">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -80, transition: { duration: 0.25 } }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
            >
              <ItemCard
                item={item}
                onToggleBewaard={onToggleBewaard}
                onNietRelevant={onNietRelevant}
                onVraagClaude={onVraagClaude}
                onLeesLater={onLeesLater}
                onDeelInzicht={onDeelInzicht}
                isToggling={isToggling}
                isOpened={openedIds.has(item.id)}
                onOpen={onOpen}
              />
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}

// ============ DIGEST BANNER ============

function DigestBanner({
  items,
  onMarkeerAlsGelezen,
  onWeekSamenvatting,
}: {
  items: RadarItem[];
  onMarkeerAlsGelezen: () => void;
  onWeekSamenvatting: () => void;
}) {
  const vandaag = new Date().toISOString().slice(0, 10);
  const gisteren = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const nieuweItems = items.filter((i) => {
    const d = (i.gepubliceerdOp ?? i.aangemaaktOp).slice(0, 10);
    return d === vandaag || d === gisteren;
  });

  const mustReads = nieuweItems.filter((i) => i.score != null && i.score >= 8);

  const catCount: Record<string, number> = {};
  for (const item of nieuweItems) {
    if (item.categorie) catCount[item.categorie] = (catCount[item.categorie] ?? 0) + 1;
  }
  const topCat = Object.entries(catCount).sort(([, a], [, b]) => b - a)[0];
  const topCatLabel = topCat
    ? (categorieOpties.find((c) => c.value === topCat[0])?.label ?? topCat[0])
    : null;

  if (nieuweItems.length === 0) return null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-autronis-accent/8 to-autronis-accent/3 border border-autronis-accent/20 rounded-2xl px-6 py-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 bg-autronis-accent rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-autronis-text-primary">
              Vandaag:{" "}
              <span className="text-autronis-accent tabular-nums">{nieuweItems.length}</span> nieuwe
              items
            </span>
          </div>
          {mustReads.length > 0 && (
            <span className="text-sm font-medium text-amber-400 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5" />
              {mustReads.length} must-read{mustReads.length > 1 ? "s" : ""}
            </span>
          )}
          {topCatLabel && (
            <span className="text-xs text-autronis-text-secondary">
              Top categorie:{" "}
              <span className="font-medium text-autronis-text-primary">{topCatLabel}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onWeekSamenvatting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-autronis-bg rounded-lg border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/40 transition-colors"
          >
            <BookOpen className="w-3 h-3" />
            Week samenvatting
          </button>
          <button
            onClick={onMarkeerAlsGelezen}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-autronis-bg rounded-lg border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/40 transition-colors"
          >
            <CheckCheck className="w-3 h-3" />
            Markeer als gelezen
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ TRENDING RIJ ============

function TrendingRij({
  trending,
  activeCat,
  onSelect,
}: {
  trending: TrendingEntry[];
  activeCat: string;
  onSelect: (cat: string) => void;
}) {
  if (trending.length === 0) return null;

  return (
    <div className="overflow-x-auto -mx-4 px-4 pb-1">
      <div className="flex gap-3 w-max">
        {trending.map(({ cat, label, count, delta }) => (
          <button
            key={cat}
            onClick={() => onSelect(cat === activeCat ? "" : cat)}
            className={cn(
              "flex-shrink-0 flex flex-col items-start p-3 rounded-xl border transition-all min-w-[90px]",
              activeCat === cat
                ? "bg-autronis-accent/15 border-autronis-accent/40"
                : "bg-autronis-card border-autronis-border hover:border-autronis-accent/30"
            )}
          >
            <div className="flex items-center justify-between w-full gap-2 mb-1.5">
              <span
                className={cn(
                  "inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                  categorieBadge[cat] ??
                    "bg-autronis-border text-autronis-text-secondary border-transparent"
                )}
              >
                {label}
              </span>
              {delta !== 0 && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-[10px] font-bold",
                    delta > 0 ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {delta > 0 ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  )}
                  {Math.abs(delta)}
                </span>
              )}
            </div>
            <span className="text-2xl font-bold text-autronis-text-primary tabular-nums">
              {count}
            </span>
          </button>
        ))}
        {activeCat && (
          <button
            onClick={() => onSelect("")}
            className="flex-shrink-0 flex items-center gap-1 px-3 self-center text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            <X className="w-3 h-3" />
            Wis
          </button>
        )}
      </div>
    </div>
  );
}

// ============ VRAAG CLAUDE MODAL ============

function VraagClaudeModal({
  item,
  onClose,
}: {
  item: RadarItem;
  onClose: () => void;
}) {
  const [vraag, setVraag] = useState("");
  const [antwoord, setAntwoord] = useState("");
  const [laden, setLaden] = useState(false);

  async function handleVraag() {
    if (!vraag.trim()) return;
    setLaden(true);
    setAntwoord("");
    try {
      const res = await fetch("/api/radar/vraag-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, vraag }),
      });
      const data = await res.json() as { antwoord?: string; fout?: string };
      if (!res.ok) throw new Error(data.fout ?? "Fout");
      setAntwoord(data.antwoord ?? "");
    } catch {
      setAntwoord("Kon Claude niet bereiken. Probeer opnieuw.");
    } finally {
      setLaden(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-autronis-accent flex-shrink-0" />
              <h3 className="text-sm font-semibold text-autronis-text-primary">Vraag Claude</h3>
            </div>
            <p className="text-xs text-autronis-text-secondary line-clamp-1">{item.titel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/50 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={vraag}
            onChange={(e) => setVraag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVraag()}
            placeholder="Wat wil je weten over dit artikel?"
            autoFocus
            className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
          />
          <button
            onClick={handleVraag}
            disabled={laden || !vraag.trim()}
            className="px-4 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {laden ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        {antwoord && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-autronis-bg/60 border border-autronis-border/50 rounded-xl p-4 text-sm text-autronis-text-primary leading-relaxed"
          >
            {antwoord}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ============ WEEK SAMENVATTING MODAL ============

function WeekSamenvattingModal({ onClose }: { onClose: () => void }) {
  const [tekst, setTekst] = useState<string | null>(null);
  const [aantalItems, setAantalItems] = useState(0);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/radar/week-samenvatting", { method: "POST" });
        const data = await res.json() as { samenvatting?: string | null; aantalItems?: number; fout?: string };
        if (!res.ok) throw new Error(data.fout ?? "Fout");
        setTekst(data.samenvatting ?? null);
        setAantalItems(data.aantalItems ?? 0);
      } catch {
        setTekst("Kon samenvatting niet genereren.");
      } finally {
        setLaden(false);
      }
    }
    load();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-autronis-accent" />
            <h3 className="text-sm font-semibold text-autronis-text-primary">Week samenvatting</h3>
            {aantalItems > 0 && (
              <span className="text-xs text-autronis-text-secondary">
                op basis van {aantalItems} bewaarde items
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {laden ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-autronis-accent" />
          </div>
        ) : tekst ? (
          <div className="text-sm text-autronis-text-primary leading-relaxed whitespace-pre-line">
            {tekst}
          </div>
        ) : (
          <p className="text-sm text-autronis-text-secondary py-4 text-center">
            Nog geen bewaarde items om samen te vatten.
          </p>
        )}
      </motion.div>
    </div>
  );
}

// ============ BRON ROW ============

function BronRow({ bron, onDelete }: { bron: RadarBron; onDelete: (id: number) => void }) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between bg-autronis-card border border-autronis-border rounded-2xl p-4 lg:p-5 card-glow transition-colors">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="p-2 bg-autronis-accent/10 rounded-xl flex-shrink-0">
            <BronTypeIcon type={bron.type} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
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

  // Tab + filter state
  const [activeTab, setActiveTab] = useState<TabKey>("feed");
  const [categorie, setCategorie] = useState("");
  const [minScore, setMinScore] = useState(5);

  // Bron form
  const [bronFormOpen, setBronFormOpen] = useState(false);
  const [bronNaam, setBronNaam] = useState("");
  const [bronUrl, setBronUrl] = useState("");
  const [bronType, setBronType] = useState("rss");

  // Animaties / interactie
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(new Set());
  const [syncDelta, setSyncDelta] = useState<number | null>(null);
  const [vraagItem, setVraagItem] = useState<RadarItem | null>(null);
  const [weekSamenvattingOpen, setWeekSamenvattingOpen] = useState(false);

  // localStorage state
  const [openedIds, setOpenedIds] = useState<Set<number>>(new Set());
  const [bewaardNotities, setBewaardNotities] = useState<Record<number, string>>({});
  const [gelezenVoor, setGelezenVoor] = useState<string | null>(null);
  const [verbergGelezen, setVerbergGelezen] = useState(false);

  useEffect(() => {
    const opened = JSON.parse(localStorage.getItem("radar_opened") ?? "[]") as number[];
    setOpenedIds(new Set(opened));
    const notities = JSON.parse(
      localStorage.getItem("radar_notities") ?? "{}"
    ) as Record<number, string>;
    setBewaardNotities(notities);
    const gelezen = localStorage.getItem("radar_gelezen_voor");
    if (gelezen) setGelezenVoor(gelezen);
  }, []);

  // Queries
  const feedFilters = useMemo(
    () =>
      activeTab === "bewaard"
        ? ({ bewaard: true as const })
        : ({
            categorie: categorie || undefined,
            minScore: minScore > 1 ? minScore : undefined,
          }),
    [activeTab, categorie, minScore]
  );

  const { data: items = [], isLoading: itemsLaden } = useRadarItems(
    activeTab === "bronnen" ? undefined : feedFilters
  );
  const { data: bronnen = [], isLoading: bronnenLaden } = useRadarBronnen();
  const { data: alleItems = [] } = useRadarItems({ minScore: 1 });

  // Mutations
  const fetchMutation = useRadarFetch();
  const toggleBewaard = useToggleBewaard();
  const markNietRelevant = useMarkNietRelevant();
  const addBron = useAddBron();
  const deleteBron = useDeleteBron();

  // KPIs
  const vandaag = new Date().toISOString().slice(0, 10);
  const nieuwVandaag = useMemo(
    () =>
      alleItems.filter(
        (i) => (i.gepubliceerdOp ?? i.aangemaaktOp).slice(0, 10) === vandaag
      ).length,
    [alleItems, vandaag]
  );
  const mustReadsCount = useMemo(
    () => alleItems.filter((i) => i.score != null && i.score >= 8).length,
    [alleItems]
  );
  const bewaardCount = useMemo(
    () => alleItems.filter((i) => i.bewaard).length,
    [alleItems]
  );
  const bronnenActief = useMemo(
    () => bronnen.filter((b) => b.actief).length,
    [bronnen]
  );

  // Must-reads / rest splits
  const mustReadItems = useMemo(
    () => items.filter((i) => !dismissingIds.has(i.id) && i.score != null && i.score >= 8),
    [items, dismissingIds]
  );
  const restItems = useMemo(
    () => items.filter((i) => !dismissingIds.has(i.id) && (!i.score || i.score < 8)),
    [items, dismissingIds]
  );

  // "Gelezen" filtering
  const visibleRestItems = useMemo(() => {
    if (!verbergGelezen || !gelezenVoor) return restItems;
    return restItems.filter((i) => (i.gepubliceerdOp ?? i.aangemaaktOp) > gelezenVoor);
  }, [restItems, verbergGelezen, gelezenVoor]);

  const gelezenAantal = useMemo(() => {
    if (!gelezenVoor) return 0;
    return restItems.filter((i) => (i.gepubliceerdOp ?? i.aangemaaktOp) <= gelezenVoor).length;
  }, [restItems, gelezenVoor]);

  // Trending met delta vs vorige week
  const trendingData = useMemo((): TrendingEntry[] => {
    const nu = Date.now();
    const week1 = new Date(nu - 7 * 86400000).toISOString();
    const week2 = new Date(nu - 14 * 86400000).toISOString();

    const dezeWeek: Record<string, number> = {};
    const vorigeWeek: Record<string, number> = {};

    for (const item of alleItems) {
      const d = item.gepubliceerdOp ?? item.aangemaaktOp;
      if (item.categorie) {
        if (d >= week1) {
          dezeWeek[item.categorie] = (dezeWeek[item.categorie] ?? 0) + 1;
        } else if (d >= week2) {
          vorigeWeek[item.categorie] = (vorigeWeek[item.categorie] ?? 0) + 1;
        }
      }
    }

    return Object.entries(dezeWeek)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([cat, count]) => ({
        cat,
        label: categorieOpties.find((c) => c.value === cat)?.label ?? cat,
        count,
        delta: count - (vorigeWeek[cat] ?? 0),
      }));
  }, [alleItems]);

  // Heeft vandaag nieuwe must-reads?
  const hasNieuweMustReads = useMemo(
    () =>
      mustReadItems.some(
        (i) => (i.gepubliceerdOp ?? i.aangemaaktOp).slice(0, 10) === vandaag
      ),
    [mustReadItems, vandaag]
  );

  // Slider preview
  const previewAantal = useMemo(
    () => alleItems.filter((i) => i.score != null && i.score >= minScore).length,
    [alleItems, minScore]
  );

  // Relevantie-hint: detecteer vaak weggegooide categorieën
  const [relevantieHint, setRelevantieHint] = useState<{
    cat: string;
    label: string;
    count: number;
  } | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);

  useEffect(() => {
    const hint = getTopDismissedCategory();
    setRelevantieHint(hint);
  }, [dismissingIds]);

  // ---- Handlers ----

  function handleFetch() {
    fetchMutation.mutate(undefined, {
      onSuccess: (data) => {
        setSyncDelta(data.nieuw);
        addToast(`${data.nieuw} nieuwe items opgehaald (${data.totaal} totaal)`, "succes");
        setTimeout(() => setSyncDelta(null), 4000);
      },
      onError: () => addToast("Kon items niet ophalen", "fout"),
    });
  }

  function handleToggleBewaard(id: number, bewaard: boolean) {
    toggleBewaard.mutate(
      { id, bewaard },
      {
        onSuccess: () =>
          addToast(bewaard ? "Item bewaard" : "Item verwijderd uit bewaard", "succes"),
        onError: () => addToast("Kon bewaard status niet wijzigen", "fout"),
      }
    );
  }

  function handleNietRelevant(id: number) {
    // Track dismiss per categorie voor relevantie-hints
    const item = items.find((i) => i.id === id);
    if (item?.categorie) trackDismiss(item.categorie);

    setDismissingIds((prev) => new Set([...prev, id]));
    markNietRelevant.mutate(id, {
      onError: () => {
        setDismissingIds((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
        addToast("Kon item niet markeren", "fout");
      },
    });
  }

  async function handleLeesLater(item: RadarItem) {
    try {
      const res = await fetch("/api/radar/lees-later", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = (await res.json()) as { succes?: boolean; fout?: string };
      if (!res.ok) throw new Error(data.fout ?? "Fout");
      addToast("Herinnering aangemaakt voor morgen 09:00", "succes");
    } catch {
      addToast("Kon herinnering niet aanmaken", "fout");
    }
  }

  async function handleDeelInzicht(item: RadarItem) {
    try {
      const res = await fetch("/api/radar/deel-inzicht", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = (await res.json()) as { succes?: boolean; fout?: string };
      if (!res.ok) throw new Error(data.fout ?? "Fout");
      addToast("Toegevoegd aan Content Engine kennisbank", "succes");
    } catch {
      addToast("Kon inzicht niet delen", "fout");
    }
  }

  function handleDismissHint() {
    if (relevantieHint) {
      clearDismissCount(relevantieHint.cat);
      setHintDismissed(true);
    }
  }

  function handleOpen(id: number) {
    setOpenedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("radar_opened", JSON.stringify([...next]));
      return next;
    });
  }

  function handleNotitieChange(id: number, notitie: string) {
    setBewaardNotities((prev) => {
      const next = { ...prev, [id]: notitie };
      localStorage.setItem("radar_notities", JSON.stringify(next));
      return next;
    });
  }

  function handleMarkeerAlsGelezen() {
    const nu = new Date().toISOString();
    setGelezenVoor(nu);
    localStorage.setItem("radar_gelezen_voor", nu);
    addToast("Feed gemarkeerd als gelezen", "succes");
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
            <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">
              Learning Radar
            </h1>
            <p className="text-base text-autronis-text-secondary mt-1">
              AI & tech trends automatisch gescand en gescoord
            </p>
          </div>
          <button
            onClick={handleFetch}
            disabled={fetchMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50 btn-press"
          >
            <motion.div
              animate={fetchMutation.isPending ? { rotate: 360 } : { rotate: 0 }}
              transition={{
                duration: 1,
                repeat: fetchMutation.isPending ? Infinity : 0,
                ease: "linear",
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.div>
            Nieuwe items ophalen
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Nieuw vandaag */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-autronis-text-secondary">
                Nieuw vandaag
              </span>
              <div className="p-2 bg-autronis-accent/10 rounded-lg">
                <Radar className="w-4 h-4 text-autronis-accent" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
                {nieuwVandaag}
              </p>
              <AnimatePresence>
                {syncDelta !== null && syncDelta > 0 && (
                  <motion.span
                    key="delta"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs font-semibold text-autronis-accent mb-1 tabular-nums"
                  >
                    +{syncDelta}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <p className="text-xs text-autronis-text-secondary mt-1">
              {syncDelta && syncDelta > 0 ? `+${syncDelta} gesynchroniseerd` : "Vandaag toegevoegd"}
            </p>
          </div>

          {/* Must-reads */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-autronis-text-secondary">
                Must-reads
              </span>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Star className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-400 tabular-nums">{mustReadsCount}</p>
            <p className="text-xs text-autronis-text-secondary mt-1">Score 8 of hoger</p>
          </div>

          {/* Bewaard */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-autronis-text-secondary">
                Bewaard
              </span>
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <BookmarkCheck className="w-4 h-4 text-yellow-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-yellow-400 tabular-nums">{bewaardCount}</p>
            <p className="text-xs text-autronis-text-secondary mt-1">Opgeslagen artikelen</p>
          </div>

          {/* Bronnen */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-autronis-text-secondary">
                Bronnen
              </span>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Database className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-blue-400 tabular-nums">{bronnenActief}</p>
            <p className="text-xs text-autronis-text-secondary mt-1">Actieve feeds</p>
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
              {tab.key === "bewaard" && bewaardCount > 0 && (
                <span className="ml-1.5 text-xs opacity-60">{bewaardCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ===== TAB CONTENT ===== */}
        <AnimatePresence mode="wait">
        {/* ===== TAB: FEED ===== */}
        {activeTab === "feed" && (
          <motion.div
            key="feed"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-5"
          >
            {/* Digest banner */}
            <DigestBanner
              items={alleItems}
              onMarkeerAlsGelezen={handleMarkeerAlsGelezen}
              onWeekSamenvatting={() => setWeekSamenvattingOpen(true)}
            />

            {/* Trending */}
            {trendingData.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-autronis-text-secondary" />
                  <span className="text-sm font-medium text-autronis-text-secondary">
                    Trending deze week
                  </span>
                </div>
                <TrendingRij
                  trending={trendingData}
                  activeCat={categorie}
                  onSelect={setCategorie}
                />
              </div>
            )}

            {/* Categorie chips */}
            <div className="space-y-3">
              <div className="overflow-x-auto -mx-4 px-4 pb-1">
                <div className="flex gap-2 w-max">
                  {categorieOpties.map((opt) => {
                    const count =
                      opt.value === ""
                        ? alleItems.length
                        : alleItems.filter((i) => i.categorie === opt.value).length;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setCategorie(opt.value)}
                        className={cn(
                          "flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                          categorie === opt.value
                            ? "bg-autronis-accent/15 text-autronis-accent border-autronis-accent/30"
                            : "bg-autronis-bg text-autronis-text-secondary border-autronis-border/50 hover:text-autronis-text-primary hover:border-autronis-border"
                        )}
                      >
                        {opt.label}
                        {count > 0 && (
                          <span className="tabular-nums opacity-60 text-[10px]">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Score slider */}
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm text-autronis-text-secondary whitespace-nowrap">
                  Min. score:{" "}
                  <span className="font-semibold text-autronis-text-primary tabular-nums">
                    {minScore}
                  </span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="w-28 accent-autronis-accent"
                />
                <span className="text-xs text-autronis-text-secondary/60 tabular-nums">
                  {previewAantal} items zichtbaar
                </span>

                {/* Gelezen toggle */}
                {gelezenVoor && gelezenAantal > 0 && (
                  <button
                    onClick={() => setVerbergGelezen((v) => !v)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors",
                      verbergGelezen
                        ? "bg-autronis-accent/15 text-autronis-accent border-autronis-accent/30"
                        : "bg-autronis-bg text-autronis-text-secondary border-autronis-border/50 hover:text-autronis-text-primary"
                    )}
                  >
                    <Eye className="w-3 h-3" />
                    {verbergGelezen
                      ? `Toon ${gelezenAantal} gelezen`
                      : `Verberg ${gelezenAantal} gelezen`}
                  </button>
                )}
              </div>
            </div>

            {/* Relevantie-hint */}
            {relevantieHint && !hintDismissed && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl px-5 py-3"
              >
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-sm text-autronis-text-primary flex-1">
                  Je markeert veel <span className="font-semibold text-amber-400">{relevantieHint.label}</span> als
                  niet-relevant ({relevantieHint.count}x). Wil je deze categorie uitzetten?
                </p>
                <button
                  onClick={() => {
                    setCategorie("");
                    setMinScore(5);
                    handleDismissHint();
                    addToast(
                      `Tip: filter op categorie en zet de min. score hoger om ${relevantieHint.label} te verbergen`,
                      "succes"
                    );
                  }}
                  className="px-3 py-1.5 bg-amber-500/15 text-amber-400 rounded-lg text-xs font-semibold hover:bg-amber-500/25 transition-colors flex-shrink-0"
                >
                  Begrepen
                </button>
                <button
                  onClick={handleDismissHint}
                  className="p-1 text-autronis-text-secondary/50 hover:text-autronis-text-secondary transition-colors flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

            {/* Must-reads sectie */}
            <MustReadsSection
              items={mustReadItems}
              hasNieuw={hasNieuweMustReads}
              onToggleBewaard={handleToggleBewaard}
              onNietRelevant={handleNietRelevant}
              onVraagClaude={setVraagItem}
              onLeesLater={handleLeesLater}
              onDeelInzicht={handleDeelInzicht}
              isToggling={toggleBewaard.isPending}
              openedIds={openedIds}
              onOpen={handleOpen}
            />

            {/* Rest items */}
            {visibleRestItems.length === 0 && mustReadItems.length === 0 ? (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
                <Radar className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
                <p className="text-autronis-text-secondary">
                  Geen items gevonden. Klik op &apos;Nieuwe items ophalen&apos; om feeds te
                  scannen.
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {visibleRestItems.map((item, i) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -80, transition: { duration: 0.25 } }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                  >
                    <ItemCard
                      item={item}
                      onToggleBewaard={handleToggleBewaard}
                      onNietRelevant={handleNietRelevant}
                      onVraagClaude={setVraagItem}
                      onLeesLater={handleLeesLater}
                      onDeelInzicht={handleDeelInzicht}
                      isToggling={toggleBewaard.isPending}
                      isOpened={openedIds.has(item.id)}
                      onOpen={handleOpen}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </motion.div>
        )}

        {/* ===== TAB: BEWAARD ===== */}
        {activeTab === "bewaard" && (
          <motion.div
            key="bewaard"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            {items.length === 0 ? (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
                <Bookmark className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
                <p className="text-autronis-text-secondary">
                  Nog geen bewaarde items. Gebruik het bladwijzer-icoon om items te bewaren.
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <ItemCard
                      item={item}
                      onToggleBewaard={handleToggleBewaard}
                      onNietRelevant={handleNietRelevant}
                      onVraagClaude={setVraagItem}
                      onLeesLater={handleLeesLater}
                      onDeelInzicht={handleDeelInzicht}
                      isToggling={toggleBewaard.isPending}
                      isOpened={openedIds.has(item.id)}
                      onOpen={handleOpen}
                      notitie={bewaardNotities[item.id]}
                      onNotitieChange={handleNotitieChange}
                      showNotitie
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </motion.div>
        )}

        {/* ===== TAB: BRONNEN ===== */}
        {activeTab === "bronnen" && (
          <motion.div
            key="bronnen"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-5"
          >
            <div className="flex justify-end">
              <button
                onClick={() => setBronFormOpen(!bronFormOpen)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
              >
                <Plus className="w-4 h-4" />
                Nieuwe bron
              </button>
            </div>

            {bronFormOpen && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-autronis-text-primary">
                  Nieuwe bron toevoegen
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-autronis-text-secondary">
                      Naam
                    </label>
                    <input
                      type="text"
                      value={bronNaam}
                      onChange={(e) => setBronNaam(e.target.value)}
                      className={inputClasses}
                      placeholder="Anthropic Blog"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-autronis-text-secondary">
                      URL
                    </label>
                    <input
                      type="url"
                      value={bronUrl}
                      onChange={(e) => setBronUrl(e.target.value)}
                      className={inputClasses}
                      placeholder="https://anthropic.com/blog/rss"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-autronis-text-secondary">
                      Type
                    </label>
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
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setBronFormOpen(false)}
                    className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={handleAddBron}
                    disabled={addBron.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {addBron.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Toevoegen
                  </button>
                </div>
              </div>
            )}

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
                  <BronRow key={bron.id} bron={bron} onDelete={handleDeleteBron} />
                ))}
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Vraag Claude modal */}
      <AnimatePresence>
        {vraagItem && (
          <VraagClaudeModal
            item={vraagItem}
            onClose={() => setVraagItem(null)}
          />
        )}
      </AnimatePresence>

      {/* Week samenvatting modal */}
      <AnimatePresence>
        {weekSamenvattingOpen && (
          <WeekSamenvattingModal onClose={() => setWeekSamenvattingOpen(false)} />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
