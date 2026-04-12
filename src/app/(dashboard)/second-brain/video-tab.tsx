"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Youtube, Search, Loader2, Trash2, ExternalLink, ChevronDown,
  ChevronUp, Star, Tag, CheckCircle2, MinusCircle, AlertCircle,
  ListChecks, Copy, Check, Zap, Share2, Plus,
} from "lucide-react";
import { cn, formatBedrag } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface VideoItem {
  id: number;
  youtubeUrl: string;
  youtubeId: string;
  titel: string | null;
  kanaal: string | null;
  thumbnailUrl: string | null;
  samenvatting: string | null;
  keyTakeaways: string[];
  stappenplan: string[] | null;
  tags: string[];
  relevantieScore: string | null;
  aangemaaktOp: string | null;
}

const RELEVANTIE_CONFIG = {
  hoog: { label: "Hoog", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  midden: { label: "Midden", icon: MinusCircle, color: "text-yellow-400", bg: "bg-yellow-500/15" },
  laag: { label: "Laag", icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/15" },
} as const;

export function VideoTab() {
  const { addToast } = useToast();
  const [items, setItems] = useState<VideoItem[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [url, setUrl] = useState("");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [relevantieFilter, setRelevantieFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (tagFilter) params.set("tag", tagFilter);
      if (relevantieFilter) params.set("relevantie", relevantieFilter);
      const res = await fetch(`/api/kennis/video-samenvatting?${params}`);
      if (res.ok) {
        const data = await res.json() as { items: VideoItem[]; allTags: string[] };
        setItems(data.items);
        setAllTags(data.allTags);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, tagFilter, relevantieFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const generate = async () => {
    if (!url.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/kennis/video-samenvatting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: url.trim() }),
      });
      const data = await res.json() as { item?: VideoItem; fout?: string; bestaandId?: number };
      if (!res.ok || data.fout) {
        addToast(data.fout ?? "Er ging iets mis", "fout");
        if (data.bestaandId) setExpandedId(data.bestaandId);
      } else if (data.item) {
        addToast("Video geanalyseerd en opgeslagen", "succes");
        setUrl("");
        loadItems();
        setExpandedId(data.item.id);
      }
    } catch {
      addToast("Er ging iets mis", "fout");
    }
    setGenerating(false);
  };

  const deleteItem = async (id: number) => {
    await fetch(`/api/kennis/video-samenvatting?id=${id}`, { method: "DELETE" });
    setItems(prev => prev.filter(i => i.id !== id));
    addToast("Video verwijderd", "succes");
  };

  const copyStappenplan = (item: VideoItem) => {
    if (!item.stappenplan) return;
    navigator.clipboard.writeText(item.stappenplan.join("\n"));
    setCopied(item.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const maakTaken = async (item: VideoItem) => {
    if (!item.stappenplan) return;
    addToast("Taken aanmaken via /api/taken is beschikbaar — koppel aan een project", "succes");
  };

  return (
    <div className="space-y-5">
      {/* Input */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Youtube className="w-5 h-5 text-red-500" />
          <h3 className="text-base font-bold text-autronis-text-primary">Video Samenvatting</h3>
        </div>
        <p className="text-xs text-autronis-text-secondary mb-3">
          Plak een YouTube URL — AI haalt het transcript op en genereert een samenvatting, key takeaways en stappenplan.
        </p>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !generating && generate()}
            placeholder="https://youtube.com/watch?v=... of youtu.be/..."
            className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50 transition-colors"
          />
          <button onClick={generate} disabled={generating || !url.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-white rounded-xl text-sm font-semibold hover:bg-autronis-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyseren...</> : <><Zap className="w-4 h-4" /> Analyseer</>}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-autronis-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek op titel..."
            className="pl-9 pr-3 py-2 bg-autronis-bg border border-autronis-border rounded-xl text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50 w-48" />
        </div>
        {/* Relevantie filter */}
        {(["", "hoog", "midden", "laag"] as const).map(r => (
          <button key={r} onClick={() => setRelevantieFilter(r)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${relevantieFilter === r ? "bg-autronis-accent text-white" : "bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"}`}>
            {r === "" ? "Alles" : r === "hoog" ? "Hoog relevant" : r === "midden" ? "Midden" : "Laag"}
          </button>
        ))}
        {/* Tag filter */}
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
            className="px-3 py-2 bg-autronis-bg border border-autronis-border rounded-xl text-xs text-autronis-text-primary focus:outline-none focus:border-autronis-accent/50">
            <option value="">Alle tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-autronis-accent" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-autronis-card border border-autronis-border rounded-2xl">
          <Youtube className="w-10 h-10 text-autronis-text-tertiary mx-auto mb-3" />
          <p className="text-sm text-autronis-text-tertiary">Nog geen video&apos;s geanalyseerd</p>
          <p className="text-xs text-autronis-text-tertiary mt-1">Plak een YouTube URL hierboven om te beginnen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const isExpanded = expandedId === item.id;
            const rel = RELEVANTIE_CONFIG[(item.relevantieScore ?? "midden") as keyof typeof RELEVANTIE_CONFIG] ?? RELEVANTIE_CONFIG.midden;
            const RelIcon = rel.icon;

            return (
              <div key={item.id} className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden hover:border-autronis-accent/20 transition-all">
                {/* Header */}
                <div className="flex gap-4 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                  {/* Thumbnail */}
                  {item.thumbnailUrl && (
                    <div className="flex-shrink-0 w-36 h-20 rounded-lg overflow-hidden bg-black">
                      <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-autronis-text-primary line-clamp-1">{item.titel}</p>
                        <p className="text-xs text-autronis-text-secondary mt-0.5">{item.kanaal}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn("flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full", rel.bg, rel.color)}>
                          <RelIcon className="w-3 h-3" /> {rel.label}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-autronis-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-autronis-text-tertiary" />}
                      </div>
                    </div>
                    {/* Tags */}
                    {item.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {item.tags.map(t => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-autronis-accent/10 text-autronis-accent font-medium">{t}</span>
                        ))}
                      </div>
                    )}
                    {/* Summary preview */}
                    {!isExpanded && item.samenvatting && (
                      <p className="text-xs text-autronis-text-tertiary mt-1.5 line-clamp-2">{item.samenvatting}</p>
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-autronis-border px-4 pb-4 pt-3 space-y-4">
                    {/* Samenvatting */}
                    {item.samenvatting && (
                      <div>
                        <p className="text-xs font-semibold text-autronis-text-secondary mb-1.5">Samenvatting</p>
                        <p className="text-sm text-autronis-text-primary leading-relaxed">{item.samenvatting}</p>
                      </div>
                    )}

                    {/* Key Takeaways */}
                    {item.keyTakeaways.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-autronis-text-secondary mb-1.5">Key Takeaways</p>
                        <ul className="space-y-1">
                          {item.keyTakeaways.map((t, i) => (
                            <li key={i} className="flex gap-2 text-sm text-autronis-text-primary">
                              <span className="text-autronis-accent mt-0.5">•</span>
                              <span>{t}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Stappenplan */}
                    {item.stappenplan && item.stappenplan.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-semibold text-autronis-text-secondary flex items-center gap-1">
                            <ListChecks className="w-3.5 h-3.5" /> Stappenplan
                          </p>
                          <button onClick={() => copyStappenplan(item)}
                            className="flex items-center gap-1 text-[10px] text-autronis-text-tertiary hover:text-autronis-accent transition-all">
                            {copied === item.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied === item.id ? "Gekopieerd" : "Kopieer"}
                          </button>
                        </div>
                        <ol className="space-y-1.5">
                          {item.stappenplan.map((s, i) => (
                            <li key={i} className="flex gap-2 text-sm text-autronis-text-primary">
                              <span className="text-autronis-accent font-bold text-xs mt-0.5 w-5 flex-shrink-0">{i + 1}.</span>
                              <span>{s.replace(/^Stap \d+:\s*/i, "")}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-autronis-border">
                      <a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-all">
                        <Youtube className="w-3.5 h-3.5" /> Bekijk op YouTube
                      </a>
                      {item.stappenplan && (
                        <button onClick={() => maakTaken(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-autronis-accent/10 text-autronis-accent border border-autronis-accent/20 rounded-lg text-xs font-semibold hover:bg-autronis-accent/20 transition-all">
                          <Plus className="w-3.5 h-3.5" /> Maak taken aan
                        </button>
                      )}
                      <div className="ml-auto">
                        <button onClick={() => deleteItem(item.id)}
                          className="p-1.5 text-autronis-text-tertiary hover:text-red-400 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Date */}
                    <p className="text-[10px] text-autronis-text-tertiary">
                      Toegevoegd: {item.aangemaaktOp ? new Date(item.aangemaaktOp).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : ""}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
