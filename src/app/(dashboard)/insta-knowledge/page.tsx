"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Instagram, Loader2, RefreshCw, Trash2, ExternalLink, Plus,
  CheckCircle2, XCircle, Clock, Play, Image as ImageIcon, Star,
  ChevronDown, ChevronUp, Zap, BookOpen, Lightbulb, Sparkles,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { UitlegBlock } from "@/components/ui/uitleg-block";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ItemStatus = "pending" | "processing" | "done" | "failed";

interface Analysis {
  summary: string;
  features: { name: string; description: string; category: string }[];
  steps: { order: number; title: string; description: string; code_snippet: string }[];
  tips: { tip: string; context: string }[];
  links: { url: string; label: string; type: string }[];
  relevance_score: number;
  relevance_reason: string;
  raw_transcript: string | null;
}

interface Item {
  id: string;
  instagram_id: string;
  type: "reel" | "post";
  url: string;
  caption: string | null;
  author_handle: string | null;
  media_url: string | null;
  status: ItemStatus;
  failure_reason: string | null;
  discovered_at: string;
  processed_at: string | null;
  analysis: Analysis | null;
}

interface Stats { total: number; processed: number; failed: number; avg_score: number; }

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

function scoreBadgeColor(score: number): string {
  if (score >= 9) return "text-emerald-400 bg-emerald-500/15 border-emerald-500/25";
  if (score >= 7) return "text-emerald-400 bg-emerald-500/15 border-emerald-500/25";
  if (score >= 5) return "text-amber-400 bg-amber-500/15 border-amber-500/25";
  return "text-gray-400 bg-gray-500/15 border-gray-500/25";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s geleden`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m geleden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}u geleden`;
  const d = Math.floor(h / 24);
  return `${d}d geleden`;
}

export default function InstaKnowledgePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, processed: 0, failed: 0, avg_score: 0 });
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    const r = await fetch("/api/insta-knowledge");
    if (!r.ok) return;
    const d = await r.json();
    setItems(d.items);
    setStats(d.stats);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const hasActive = items.some((i) => i.status === "pending" || i.status === "processing");
    if (!hasActive) return;
    const t = setInterval(fetchData, 4000);
    return () => clearInterval(t);
  }, [items, fetchData]);

  const submit = async () => {
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/insta-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.fout || "submit mislukt");
      if (d.duplicate) addToast("Al eerder toegevoegd", "succes");
      else addToast("Toegevoegd — analyse start", "succes");
      setUrl("");
      await fetchData();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "fout", "fout");
    } finally {
      setSubmitting(false);
    }
  };

  const retry = async (id: string) => {
    const r = await fetch(`/api/insta-knowledge/items/${id}/retry`, { method: "POST" });
    if (r.ok) { addToast("Opnieuw gestart", "succes"); fetchData(); }
    else addToast("Retry mislukt", "fout");
  };

  const del = async (id: string) => {
    if (!confirm("Item verwijderen?")) return;
    const r = await fetch(`/api/insta-knowledge/items/${id}`, { method: "DELETE" });
    if (r.ok) { addToast("Verwijderd", "succes"); fetchData(); }
  };

  const promote = async (id: string) => {
    const r = await fetch(`/api/insta-knowledge/items/${id}/promote`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) { addToast(d.fout || "Promotie mislukt", "fout"); return; }
    if (d.created) addToast("Omgezet naar idee", "succes");
    else addToast("Bestond al als idee", "succes");
  };

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-6 pb-32">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary flex items-center gap-2">
              <Instagram className="w-6 h-6 text-autronis-accent" />
              Insta Knowledge Pipeline
            </h1>
            <p className="text-sm text-autronis-text-secondary mt-1">
              Instagram reels en posts analyseren voor Claude Code kennis
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

        <UitlegBlock id="insta-knowledge-intro" titel="Hoe werkt dit?">
          <p>Plak een Instagram reel- of post-URL hieronder. De pipeline scraped de caption, downloadt slides/thumbnails voor Claude vision (leest tekst op afbeeldingen), en — voor video&apos;s waarvoor IG de MP4-URL vrijgeeft — transcribeert de audio via Whisper. Claude combineert alles en scoort relevantie 1-10. Bij score ≥ 9 verschijnt automatisch een idee in /ideeen.</p>
          <p className="mt-2 text-sm opacity-70">Fase 1: alleen handmatige submit. Auto-scraping via Apify komt in fase 2.</p>
        </UitlegBlock>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Totaal", value: stats.total, icon: Instagram, color: "text-blue-400" },
            { label: "Verwerkt", value: stats.processed, icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Mislukt", value: stats.failed, icon: XCircle, color: "text-red-400" },
            { label: "Gem. score", value: stats.avg_score ? `${stats.avg_score}/10` : "—", icon: Star, color: "text-amber-400" },
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

        {/* Submit */}
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !submitting) submit(); }}
            placeholder="Instagram reel- of post-URL toevoegen..."
            className="flex-1 rounded-lg border border-autronis-border bg-autronis-bg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary outline-none focus:border-autronis-accent focus:ring-2 focus:ring-autronis-accent/30 transition"
          />
          <button
            onClick={submit}
            disabled={submitting || !url.trim()}
            className="px-4 py-2 rounded-lg bg-autronis-accent text-white text-sm font-semibold hover:bg-autronis-accent-hover transition disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Toevoegen
          </button>
        </div>

        {/* List */}
        <div className="space-y-2">
          {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-autronis-text-secondary" /></div>}
          {!loading && items.length === 0 && (
            <div className="text-center py-16 text-autronis-text-secondary">Nog geen items. Plak een URL om te starten.</div>
          )}
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const isExpanded = expandedId === item.id;
              const sc = statusConfig[item.status] || statusConfig.pending;
              const StatusIcon = sc.icon;
              const TypeIcon = item.type === "reel" ? Play : ImageIcon;
              const title = item.analysis?.summary?.split(".")[0] || item.caption?.slice(0, 80) || item.instagram_id;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-autronis-card rounded-xl border border-autronis-border overflow-hidden"
                >
                  {/* Header row */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-autronis-border/10 transition-colors cursor-pointer"
                  >
                    <TypeIcon className="w-4 h-4 text-autronis-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-autronis-text-primary truncate">{title}</span>
                        {item.analysis && (
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border shrink-0", scoreBadgeColor(item.analysis.relevance_score))}>
                            <Star className="w-3 h-3" /> {item.analysis.relevance_score}/10
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-autronis-text-secondary mt-0.5">
                        {item.author_handle && <span>@{item.author_handle}</span>}
                        {item.author_handle && <span>·</span>}
                        <span>{item.type}</span>
                        <span>·</span>
                        <span>{timeAgo(item.discovered_at)}</span>
                      </div>
                      {item.status === "failed" && item.failure_reason && (
                        <div className="text-xs text-rose-400/90 mt-1 truncate">
                          Fout: {item.failure_reason}
                        </div>
                      )}
                    </div>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border shrink-0", sc.color)}>
                      <StatusIcon className={cn("w-3 h-3", item.status === "processing" && "animate-spin")} />
                      {sc.label}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <a href={item.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/40 transition-colors"><ExternalLink className="w-4 h-4" /></a>
                      {(item.status === "failed" || item.status === "done") && (
                        <button onClick={() => retry(item.id)} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/40 transition-colors"><RefreshCw className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => del(item.id)} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/15 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-autronis-text-secondary shrink-0" /> : <ChevronDown className="w-4 h-4 text-autronis-text-secondary shrink-0" />}
                  </div>

                  {/* Expanded analysis */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-4 border-t border-autronis-border pt-3">
                          {item.failure_reason && (
                            <div className="text-sm text-red-400">Fout: {item.failure_reason}</div>
                          )}
                          {item.analysis ? (
                            <>
                              <div>
                                <p className="text-sm text-autronis-text-primary leading-relaxed">{item.analysis.summary}</p>
                                <p className="text-xs text-autronis-text-secondary mt-1">{item.analysis.relevance_reason}</p>
                              </div>

                              {item.analysis.features.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> Features ({item.analysis.features.length})
                                  </h4>
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.analysis.features.map((f, i) => (
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

                              {item.analysis.steps.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <BookOpen className="w-3 h-3" /> Stappen ({item.analysis.steps.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {item.analysis.steps.map((s, i) => (
                                      <div key={i} className="flex gap-2">
                                        <span className="text-xs font-mono text-autronis-accent mt-0.5 shrink-0">{s.order}.</span>
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

                              {item.analysis.tips.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Lightbulb className="w-3 h-3" /> Tips ({item.analysis.tips.length})
                                  </h4>
                                  <div className="space-y-1.5">
                                    {item.analysis.tips.map((t, i) => (
                                      <div key={i} className="text-sm">
                                        <span className="text-autronis-text-primary">{t.tip}</span>
                                        <span className="text-autronis-text-secondary text-xs ml-1">— {t.context}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {item.analysis.links.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <ExternalLink className="w-3 h-3" /> Links ({item.analysis.links.length})
                                  </h4>
                                  <div className="space-y-1">
                                    {item.analysis.links.map((l, i) => (
                                      <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm group">
                                        <span className="text-autronis-accent group-hover:underline">{l.label}</span>
                                        <span className="text-xs text-autronis-text-secondary px-1.5 py-0.5 rounded bg-autronis-bg">{l.type}</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {item.caption && (
                                <details className="text-xs text-autronis-text-secondary">
                                  <summary className="cursor-pointer hover:text-autronis-text-primary">Originele caption</summary>
                                  <p className="mt-1 whitespace-pre-wrap text-autronis-text-primary">{item.caption}</p>
                                </details>
                              )}

                              {item.analysis.raw_transcript && (
                                <details className="text-xs text-autronis-text-secondary">
                                  <summary className="cursor-pointer hover:text-autronis-text-primary">Audio-transcript ({item.analysis.raw_transcript.length} tekens)</summary>
                                  <p className="mt-1 whitespace-pre-wrap text-autronis-text-primary">{item.analysis.raw_transcript}</p>
                                </details>
                              )}

                              <div className="flex items-center gap-2 pt-2">
                                <button
                                  onClick={() => promote(item.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 rounded-lg text-xs font-medium transition-colors"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Naar idee
                                </button>
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-autronis-accent hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Bekijk op Instagram
                                </a>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-autronis-text-secondary">Nog geen analyse beschikbaar.</p>
                          )}
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
