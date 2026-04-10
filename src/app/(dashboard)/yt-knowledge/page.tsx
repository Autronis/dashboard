"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Search,
  RefreshCw,
  Loader2,
  ExternalLink,
  Star,
  Zap,
  BookOpen,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Rss,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";

// ============ TYPES ============

interface VideoItem {
  id: string;
  youtube_id: string;
  title: string;
  url: string;
  channel_name: string;
  status: string;
  discovered_at: string;
  analysis?: AnalysisData;
}

interface AnalysisData {
  summary: string;
  features: { name: string; description: string; category: string }[];
  steps: { order: number; title: string; description: string; code_snippet: string }[];
  tips: { tip: string; context: string }[];
  links: { url: string; label: string; type: string }[];
  relevance_score: number;
  relevance_reason: string;
}

interface Stats {
  total_videos: number;
  processed: number;
  avg_relevance_score: number;
}

interface Channel {
  id: string;
  channel_id: string;
  name: string;
  active: boolean;
}

// ============ CONSTANTS ============

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  done: { label: "Verwerkt", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", icon: CheckCircle2 },
  pending: { label: "Wacht", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25", icon: Clock },
  processing: { label: "Bezig", color: "bg-blue-500/15 text-blue-400 border-blue-500/25", icon: Loader2 },
  failed: { label: "Mislukt", color: "bg-red-500/15 text-red-400 border-red-500/25", icon: XCircle },
};

const categoryBadge: Record<string, string> = {
  core: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  workflow: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  integration: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  tips: "bg-amber-500/15 text-amber-400 border-amber-500/25",
};

// ============ HELPERS ============

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 7 ? "text-emerald-400 bg-emerald-500/15" :
    score >= 4 ? "text-yellow-400 bg-yellow-500/15" :
    "text-red-400 bg-red-500/15";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold", color)}>
      <Star className="w-3 h-3" />
      {score}/10
    </span>
  );
}

function timeAgo(dateStr: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u geleden`;
  const days = Math.floor(hours / 24);
  return `${days}d geleden`;
}

// ============ COMPONENT ============

export default function YtKnowledgePage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [analyzeUrl, setAnalyzeUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showChannels, setShowChannels] = useState(false);
  const [newChannelUrl, setNewChannelUrl] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/yt-knowledge");
      if (!res.ok) throw new Error("Kon data niet laden");
      const data = await res.json();
      setVideos(data.videos);
      setStats(data.stats);
      setChannels(data.channels || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh when there are processing videos
  useEffect(() => {
    const hasProcessing = videos.some((v) => v.status === "processing" || v.status === "pending");
    if (!hasProcessing) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [videos, fetchData]);

  const handleAddVideo = async () => {
    if (!analyzeUrl.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      // 1. Add video to DB
      const addRes = await fetch("/api/yt-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: analyzeUrl }),
      });
      if (!addRes.ok) throw new Error("Kon video niet toevoegen");
      const added = await addRes.json();
      setAnalyzeUrl("");
      fetchData();

      // 2. Trigger analysis in background
      if (added.status === "pending") {
        fetch("/api/yt-knowledge/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: added.id }),
        }).then(async (r) => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            setError(`Analyse mislukt: ${err.error || "onbekend"} ${err.detail || ""}`);
          }
          fetchData();
        });
      }
    } catch {
      setError("Video toevoegen mislukt");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddChannel = async () => {
    if (!newChannelUrl.trim()) return;
    try {
      const res = await fetch("/api/yt-knowledge/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newChannelUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Kanaal toevoegen mislukt");
        return;
      }
      setNewChannelUrl("");
      fetchData();
    } catch {
      setError("Kanaal toevoegen mislukt");
    }
  };

  const handleDeleteChannel = async (id: string) => {
    try {
      await fetch("/api/yt-knowledge/channels", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchData();
    } catch {
      setError("Kanaal verwijderen mislukt");
    }
  };

  const filteredVideos = videos.filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.title?.toLowerCase().includes(q) ||
      v.channel_name?.toLowerCase().includes(q) ||
      v.analysis?.summary?.toLowerCase().includes(q)
    );
  });

  // ─── Render ──────────────────────────────────────────
  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary flex items-center gap-2">
              <Video className="w-6 h-6 text-autronis-accent" />
              YT Knowledge Pipeline
            </h1>
            <p className="text-sm text-autronis-text-secondary mt-1">
              YouTube video&apos;s analyseren voor Claude Code kennis
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-autronis-border/30 transition-colors text-autronis-text-secondary"
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Video's", value: stats.total_videos, icon: Video, color: "text-blue-400" },
              { label: "Verwerkt", value: stats.processed, icon: CheckCircle2, color: "text-emerald-400" },
              { label: "Gem. Score", value: `${stats.avg_relevance_score}/10`, icon: Star, color: "text-amber-400" },
            ].map((s) => (
              <div key={s.label} className="bg-autronis-card rounded-xl border border-autronis-border p-4">
                <div className="flex items-center gap-2 text-autronis-text-secondary text-xs mb-1">
                  <s.icon className={cn("w-4 h-4", s.color)} />
                  {s.label}
                </div>
                <div className="text-2xl font-bold text-autronis-text-primary">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Add video */}
        <div className="flex gap-2">
          <input
            type="text"
            value={analyzeUrl}
            onChange={(e) => setAnalyzeUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddVideo()}
            placeholder="YouTube URL toevoegen..."
            className="flex-1 rounded-lg border border-autronis-border bg-autronis-bg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary outline-none focus:border-autronis-accent focus:ring-2 focus:ring-autronis-accent/30 transition"
          />
          <button
            onClick={handleAddVideo}
            disabled={analyzing || !analyzeUrl.trim()}
            className="px-4 py-2 rounded-lg bg-autronis-accent text-white text-sm font-semibold hover:bg-autronis-accent-hover transition disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Toevoegen"}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek in video's en analyses..."
            className="w-full rounded-lg border border-autronis-border bg-autronis-card pl-10 pr-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary outline-none focus:border-autronis-accent focus:ring-2 focus:ring-autronis-accent/30 transition"
          />
        </div>

        {/* Channels */}
        <div className="bg-autronis-card rounded-xl border border-autronis-border overflow-hidden">
          <button
            onClick={() => setShowChannels(!showChannels)}
            className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-autronis-border/10 transition-colors"
          >
            <Rss className="w-4 h-4 text-autronis-accent" />
            <span className="text-sm font-medium text-autronis-text-primary">Kanalen</span>
            <span className="text-xs text-autronis-text-secondary">({channels.length})</span>
            <div className="flex-1" />
            {showChannels ? <ChevronUp className="w-4 h-4 text-autronis-text-secondary" /> : <ChevronDown className="w-4 h-4 text-autronis-text-secondary" />}
          </button>
          {showChannels && (
            <div className="px-4 pb-3 space-y-2 border-t border-autronis-border pt-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newChannelUrl}
                  onChange={(e) => setNewChannelUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddChannel()}
                  placeholder="YouTube kanaal URL (bijv. youtube.com/@kanaal)"
                  className="flex-1 rounded-lg border border-autronis-border bg-autronis-bg px-3 py-1.5 text-xs text-autronis-text-primary placeholder:text-autronis-text-secondary outline-none focus:border-autronis-accent transition"
                />
                <button
                  onClick={handleAddChannel}
                  disabled={!newChannelUrl.trim()}
                  className="px-3 py-1.5 rounded-lg bg-autronis-accent text-white text-xs font-medium hover:bg-autronis-accent-hover transition disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {channels.length === 0 && (
                <p className="text-xs text-autronis-text-secondary">Nog geen kanalen. Voeg een YouTube kanaal toe om automatisch nieuwe video&apos;s te ontdekken.</p>
              )}
              <div className="space-y-1">
                {channels.map((ch) => (
                  <div key={ch.id} className="flex items-center gap-2 text-sm">
                    <Rss className="w-3 h-3 text-autronis-text-secondary" />
                    <span className="text-autronis-text-primary flex-1">{ch.name}</span>
                    <a
                      href={`https://youtube.com/channel/${ch.channel_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-autronis-text-secondary hover:text-autronis-accent"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => handleDeleteChannel(ch.id)}
                      className="text-autronis-text-secondary hover:text-red-400 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-3 text-sm text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-autronis-accent" />
          </div>
        )}

        {/* Video list */}
        {!loading && filteredVideos.length === 0 && (
          <div className="text-center py-12 text-autronis-text-secondary text-sm">
            Geen video&apos;s gevonden. Voeg een YouTube URL toe of draai <code>python cli.py auto</code>.
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filteredVideos.map((video) => {
              const isExpanded = expandedId === video.id;
              const sc = statusConfig[video.status] || statusConfig.pending;
              const StatusIcon = sc.icon;

              return (
                <motion.div
                  key={video.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-autronis-card rounded-xl border border-autronis-border overflow-hidden"
                >
                  {/* Video header */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(isExpanded ? null : video.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-autronis-border/10 transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4 text-autronis-text-secondary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-autronis-text-primary truncate">
                          {video.title || video.youtube_id}
                        </span>
                        {video.analysis && <ScoreBadge score={video.analysis.relevance_score} />}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-autronis-text-secondary mt-0.5">
                        {video.channel_name && <span>{video.channel_name}</span>}
                        {video.channel_name && <span>·</span>}
                        <span>{timeAgo(video.discovered_at)}</span>
                      </div>
                    </div>
                    {(video.status === "pending" || video.status === "failed") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fetch("/api/yt-knowledge/analyze", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ videoId: video.id }),
                          }).then(async (r) => {
                            if (!r.ok) {
                              const err = await r.json().catch(() => ({}));
                              setError(`Analyse mislukt: ${err.error || "onbekend"} ${err.detail || ""}`);
                            }
                            fetchData();
                          });
                          fetchData();
                        }}
                        className="px-2 py-1 rounded-lg bg-autronis-accent/15 text-autronis-accent text-xs font-medium hover:bg-autronis-accent/25 transition"
                      >
                        Analyseer
                      </button>
                    )}
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border", sc.color)}>
                      <StatusIcon className={cn("w-3 h-3", video.status === "processing" && "animate-spin")} />
                      {sc.label}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-autronis-text-secondary" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-autronis-text-secondary" />
                    )}
                  </div>

                  {/* Expanded analysis */}
                  <AnimatePresence>
                    {isExpanded && video.analysis && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-4 border-t border-autronis-border pt-3">
                          {/* Summary */}
                          <div>
                            <p className="text-sm text-autronis-text-primary leading-relaxed">
                              {video.analysis.summary}
                            </p>
                            <p className="text-xs text-autronis-text-secondary mt-1">
                              {video.analysis.relevance_reason}
                            </p>
                          </div>

                          {/* Features */}
                          {video.analysis.features.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Features ({video.analysis.features.length})
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {video.analysis.features.map((f, i) => (
                                  <span
                                    key={i}
                                    title={f.description}
                                    className={cn(
                                      "px-2 py-0.5 rounded-full text-xs border cursor-default",
                                      categoryBadge[f.category] || "bg-gray-500/15 text-gray-400 border-gray-500/25"
                                    )}
                                  >
                                    {f.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Steps */}
                          {video.analysis.steps.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                                <BookOpen className="w-3 h-3" /> Stappen ({video.analysis.steps.length})
                              </h4>
                              <div className="space-y-2">
                                {video.analysis.steps.map((s, i) => (
                                  <div key={i} className="flex gap-2">
                                    <span className="text-xs font-mono text-autronis-accent mt-0.5 shrink-0">
                                      {s.order}.
                                    </span>
                                    <div>
                                      <p className="text-sm text-autronis-text-primary font-medium">{s.title}</p>
                                      <p className="text-xs text-autronis-text-secondary">{s.description}</p>
                                      {s.code_snippet && (
                                        <code className="mt-1 block text-xs bg-autronis-bg rounded px-2 py-1 text-autronis-accent font-mono">
                                          {s.code_snippet}
                                        </code>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tips */}
                          {video.analysis.tips.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Lightbulb className="w-3 h-3" /> Tips ({video.analysis.tips.length})
                              </h4>
                              <div className="space-y-1.5">
                                {video.analysis.tips.map((t, i) => (
                                  <div key={i} className="text-sm">
                                    <span className="text-autronis-text-primary">{t.tip}</span>
                                    <span className="text-autronis-text-secondary text-xs ml-1">— {t.context}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Links */}
                          {video.analysis.links?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> Links ({video.analysis.links.length})
                              </h4>
                              <div className="space-y-1">
                                {video.analysis.links.map((l, i) => (
                                  <a
                                    key={i}
                                    href={l.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm group"
                                  >
                                    <span className="text-autronis-accent group-hover:underline">{l.label}</span>
                                    <span className="text-xs text-autronis-text-secondary px-1.5 py-0.5 rounded bg-autronis-bg">{l.type}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          <a
                            href={video.url || `https://youtube.com/watch?v=${video.youtube_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-autronis-accent hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Bekijk op YouTube
                          </a>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
