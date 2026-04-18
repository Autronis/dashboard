"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Instagram, Loader2, RefreshCw, Trash2, ExternalLink, Plus, CheckCircle2, XCircle, Clock, Play, Image as ImageIcon, Star } from "lucide-react";
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
}

interface Item {
  id: string;
  instagram_id: string;
  type: "reel" | "post";
  url: string;
  caption: string | null;
  author_handle: string | null;
  status: ItemStatus;
  failure_reason: string | null;
  discovered_at: string;
  processed_at: string | null;
  analysis: Analysis | null;
}

interface Stats { total: number; processed: number; failed: number; avg_score: number; }

export default function InstaKnowledgePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, processed: 0, failed: 0, avg_score: 0 });
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Item | null>(null);
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

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-6">
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
          <p>Plak een Instagram reel- of post-URL hieronder. De pipeline scraped de caption (en voor reels: transcribeert de audio via Whisper), analyseert met Claude, en scored relevance 1-10. Bij score ≥ 9 verschijnt automatisch een idee in /ideeen.</p>
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

        {/* Submit URL */}
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

        <section className="space-y-3">
          {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin opacity-50" /></div>}
          {!loading && items.length === 0 && (
            <div className="text-center py-16 opacity-60">Nog geen items. Plak een URL om te starten.</div>
          )}
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[var(--autronis-card)] border border-[var(--autronis-border)] rounded-2xl p-4 card-glow cursor-pointer"
              onClick={() => setDetail(item)}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {item.type === "reel" ? <Play className="w-5 h-5 opacity-70" /> : <ImageIcon className="w-5 h-5 opacity-70" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={item.status} />
                    {item.analysis && <ScoreBadge score={item.analysis.relevance_score} />}
                    {item.author_handle && <span className="text-sm opacity-60">@{item.author_handle}</span>}
                  </div>
                  <div className="font-medium truncate">
                    {item.analysis?.summary ? item.analysis.summary.slice(0, 120) + "…" : item.caption?.slice(0, 120) || item.instagram_id}
                  </div>
                  {item.failure_reason && (
                    <div className="text-sm text-red-400 mt-1">Fout: {item.failure_reason}</div>
                  )}
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <a href={item.url} target="_blank" rel="noreferrer" className="p-2 hover:bg-[var(--autronis-border)] rounded-lg"><ExternalLink className="w-4 h-4" /></a>
                  {(item.status === "failed" || item.status === "done") && (
                    <button onClick={() => retry(item.id)} className="p-2 hover:bg-[var(--autronis-border)] rounded-lg"><RefreshCw className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => del(item.id)} className="p-2 hover:bg-red-900/40 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </section>

        {detail && <DetailDrawer item={detail} onClose={() => setDetail(null)} />}
      </div>
    </PageTransition>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-[var(--autronis-card)] border border-[var(--autronis-border)] rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wider opacity-60">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const map = {
    pending: { icon: Clock, label: "Wachtend", cls: "bg-amber-900/40 text-amber-300" },
    processing: { icon: Loader2, label: "Bezig", cls: "bg-blue-900/40 text-blue-300 animate-pulse" },
    done: { icon: CheckCircle2, label: "Klaar", cls: "bg-emerald-900/40 text-emerald-300" },
    failed: { icon: XCircle, label: "Mislukt", cls: "bg-red-900/40 text-red-300" },
  } as const;
  const { icon: Icon, label, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", cls)}>
      <Icon className={cn("w-3 h-3", status === "processing" && "animate-spin")} /> {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 9 ? "text-emerald-300" : score >= 7 ? "text-amber-300" : "text-gray-400";
  return <span className={cn("inline-flex items-center gap-1 text-xs", color)}><Star className="w-3 h-3" /> {score}/10</span>;
}

function DetailDrawer({ item, onClose }: { item: Item; onClose: () => void }) {
  const a = item.analysis;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[var(--autronis-bg)] border border-[var(--autronis-border)] rounded-t-2xl md:rounded-2xl w-full md:max-w-3xl max-h-[90vh] overflow-auto p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-sm opacity-60">@{item.author_handle || "onbekend"} · {item.type}</div>
            <h2 className="text-xl font-semibold mt-1">{a?.summary ? a.summary.slice(0, 80) : item.instagram_id}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--autronis-border)] rounded-lg"><XCircle className="w-5 h-5" /></button>
        </div>
        {a ? (
          <div className="space-y-5 text-sm">
            <div><h3 className="font-semibold mb-1">Samenvatting</h3><p className="opacity-90">{a.summary}</p></div>
            <div><h3 className="font-semibold mb-1">Relevantie: {a.relevance_score}/10</h3><p className="opacity-80">{a.relevance_reason}</p></div>
            {a.features.length > 0 && (<div><h3 className="font-semibold mb-2">Features</h3><ul className="space-y-1">{a.features.map((f, i) => <li key={i}><strong>{f.name}:</strong> {f.description}</li>)}</ul></div>)}
            {a.steps.length > 0 && (<div><h3 className="font-semibold mb-2">Stappenplan</h3><ol className="space-y-2">{a.steps.map((s) => <li key={s.order}><strong>{s.order}. {s.title}</strong><div className="opacity-80">{s.description}</div>{s.code_snippet && <pre className="bg-[var(--autronis-bg)] rounded-lg p-2 mt-1 overflow-x-auto text-xs">{s.code_snippet}</pre>}</li>)}</ol></div>)}
            {a.tips.length > 0 && (<div><h3 className="font-semibold mb-2">Tips</h3><ul className="space-y-1">{a.tips.map((t, i) => <li key={i}>{t.tip} — <em className="opacity-60">{t.context}</em></li>)}</ul></div>)}
            {a.links.length > 0 && (<div><h3 className="font-semibold mb-2">Links</h3><ul className="space-y-1">{a.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="text-[var(--autronis-accent)] hover:underline">{l.label}</a> <span className="opacity-50 text-xs">({l.type})</span></li>)}</ul></div>)}
          </div>
        ) : (
          <p className="opacity-60">Nog geen analyse beschikbaar.</p>
        )}
        {item.caption && <div className="mt-6 border-t border-[var(--autronis-border)] pt-4"><h4 className="font-semibold mb-1 text-sm">Originele caption</h4><p className="text-sm opacity-80 whitespace-pre-wrap">{item.caption}</p></div>}
      </div>
    </div>
  );
}
