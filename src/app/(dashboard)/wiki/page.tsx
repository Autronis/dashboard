"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedNumber } from "@/components/ui/animated-number";
import {
  BookOpen, Search, Plus, Tag, User, Clock, FolderOpen, FileText,
  Sparkles, Loader2, AlertTriangle, ArrowRight, Database, Brain,
  Lightbulb, GraduationCap, Wrench, BookMarked, Users, Landmark,
  Layout, Award,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useWiki } from "@/hooks/queries/use-wiki";
import { useToast } from "@/hooks/use-toast";

const categorieConfig: Record<string, { label: string; color: string; bg: string; icon: typeof BookOpen }> = {
  processen: { label: "Processen", color: "text-blue-400", bg: "bg-blue-500/15", icon: Layout },
  klanten: { label: "Klanten", color: "text-emerald-400", bg: "bg-emerald-500/15", icon: Users },
  technisch: { label: "Technisch", color: "text-purple-400", bg: "bg-purple-500/15", icon: Database },
  templates: { label: "Templates", color: "text-amber-400", bg: "bg-amber-500/15", icon: FileText },
  financien: { label: "Financieel", color: "text-red-400", bg: "bg-red-500/15", icon: Landmark },
  strategie: { label: "Strategie", color: "text-cyan-400", bg: "bg-cyan-500/15", icon: Award },
  "geleerde-lessen": { label: "Geleerde lessen", color: "text-orange-400", bg: "bg-orange-500/15", icon: Lightbulb },
  tools: { label: "Tools", color: "text-pink-400", bg: "bg-pink-500/15", icon: Wrench },
  ideeen: { label: "Ideeën", color: "text-yellow-400", bg: "bg-yellow-500/15", icon: Brain },
  educatie: { label: "Educatie", color: "text-indigo-400", bg: "bg-indigo-500/15", icon: GraduationCap },
};

function getSnippet(inhoud: string | null): string {
  if (!inhoud) return "";
  const plain = inhoud
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/- \[ \]/g, "☐")
    .replace(/- \[x\]/g, "☑")
    .replace(/\n/g, " ");
  return plain.length > 140 ? plain.slice(0, 140) + "..." : plain;
}

function parseTags(tagsJson: string | null): string[] {
  if (!tagsJson) return [];
  try {
    const parsed: unknown = JSON.parse(tagsJson);
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === "string");
    return [];
  } catch { return []; }
}

function isVerouderd(bijgewerktOp: string | null): boolean {
  if (!bijgewerktOp) return true;
  const dagen = (Date.now() - new Date(bijgewerktOp).getTime()) / (1000 * 60 * 60 * 24);
  return dagen > 90;
}

// ─── AI Zoeken Component ───
function AiZoeken() {
  const [vraag, setVraag] = useState("");
  const [antwoord, setAntwoord] = useState<string | null>(null);
  const [bronnen, setBronnen] = useState<Array<{ id: number; titel: string; relevantie: string }>>([]);
  const [loading, setLoading] = useState(false);

  const handleZoek = useCallback(async () => {
    if (!vraag.trim() || loading) return;
    setLoading(true);
    setAntwoord(null);
    setBronnen([]);

    try {
      const res = await fetch("/api/wiki/zoeken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vraag }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout);
      setAntwoord(data.antwoord);
      setBronnen(data.bronnen || []);
    } catch {
      setAntwoord("Kon niet zoeken. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }, [vraag, loading]);

  return (
    <div className="bg-gradient-to-r from-purple-500/5 via-autronis-card to-autronis-card border border-purple-500/20 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-semibold text-purple-400">AI Zoeken</span>
        <span className="text-xs text-autronis-text-secondary">Stel een vraag over je kennisbank</span>
      </div>

      <div className="flex gap-2">
        <input
          value={vraag}
          onChange={(e) => setVraag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleZoek()}
          placeholder="Hoe regel ik de BTW? / Wat is ons deploy process?"
          className="flex-1 bg-autronis-bg border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
        />
        <button
          onClick={handleZoek}
          disabled={!vraag.trim() || loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500/15 text-purple-400 font-semibold text-sm hover:bg-purple-500/25 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Zoek
        </button>
      </div>

      <AnimatePresence>
      {antwoord && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="mt-4 space-y-3"
        >
          <div className="bg-autronis-bg/50 border border-purple-500/10 rounded-xl p-4">
            <p className="text-sm text-autronis-text-primary leading-relaxed">{antwoord}</p>
          </div>
          {bronnen.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-autronis-text-secondary uppercase tracking-wider font-semibold">Bronnen</p>
              {bronnen.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                >
                <Link
                  href={`/wiki/${b.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-autronis-bg/30 hover:bg-autronis-bg/50 transition-colors group"
                >
                  <BookMarked className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-autronis-text-primary group-hover:text-purple-400 transition-colors">{b.titel}</span>
                  <span className="text-[10px] text-autronis-text-secondary ml-auto flex-shrink-0">{b.relevantie}</span>
                  <ArrowRight className="w-3 h-3 text-autronis-text-secondary/50 group-hover:text-purple-400 transition-colors flex-shrink-0" />
                </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

export default function WikiPage() {
  const { addToast } = useToast();
  const [zoek, setZoek] = useState("");
  const [activeCategorie, setActiveCategorie] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const { data, isLoading } = useWiki(activeCategorie, zoek);
  const alleArtikelen = data?.artikelen ?? [];
  const categorieCounts = data?.categorieCounts ?? [];

  // Tag telling over alle (categorie-gefilterde) artikelen
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of alleArtikelen) {
      for (const t of parseTags(a.tags)) {
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [alleArtikelen]);

  const artikelen = activeTag
    ? alleArtikelen.filter((a) => parseTags(a.tags).includes(activeTag))
    : alleArtikelen;

  const totaalArtikelen = categorieCounts.reduce((sum, c) => sum + c.aantal, 0);
  const verouderdeArtikelen = artikelen.filter((a) => isVerouderd(a.bijgewerktOp)).length;

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/wiki/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout);
      addToast(`${data.aantal} artikelen aangemaakt`, "succes");
      window.location.reload();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Seed mislukt", "fout");
    } finally {
      setSeeding(false);
    }
  }, [addToast]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8 pb-32 space-y-8">
        <div><Skeleton className="h-8 w-48 mb-2" /><Skeleton className="h-4 w-72" /></div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1"><SkeletonCard /></div>
          <div className="lg:col-span-3 space-y-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 pb-32 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary">Kennisbank</h1>
            <p className="text-sm text-autronis-text-secondary mt-1 flex items-center gap-1">
              <AnimatedNumber value={totaalArtikelen} format={(n) => `${Math.round(n)} artikelen`} className="inline" />
              {verouderdeArtikelen > 0 && (
                <span className="text-orange-400 ml-2">
                  &middot; {verouderdeArtikelen} verouderd
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {totaalArtikelen === 0 && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-4 py-2 border border-autronis-accent/30 text-autronis-accent rounded-xl text-sm font-medium hover:bg-autronis-accent/10 transition-colors disabled:opacity-50"
              >
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Seed artikelen
              </button>
            )}
            <Link
              href="/wiki/nieuw"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />Nieuw artikel
            </Link>
          </div>
        </div>

        {/* AI Zoeken */}
        <AiZoeken />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-5">
            {/* Categories */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-autronis-text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-autronis-accent" />Categorieën
              </h3>
              <motion.div
                className="space-y-0.5"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
              >
                <motion.button
                  variants={{ hidden: { opacity: 0, x: -6 }, visible: { opacity: 1, x: 0 } }}
                  onClick={() => setActiveCategorie(null)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors",
                    !activeCategorie ? "bg-autronis-accent/10 text-autronis-accent" : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                  )}
                >
                  <span>Alle</span>
                  <span className="tabular-nums">{totaalArtikelen}</span>
                </motion.button>
                {Object.entries(categorieConfig).map(([key, config]) => {
                  const count = categorieCounts.find((c) => c.categorie === key)?.aantal || 0;
                  const CatIcon = config.icon;
                  return (
                    <motion.button
                      key={key}
                      variants={{ hidden: { opacity: 0, x: -6 }, visible: { opacity: 1, x: 0 } }}
                      onClick={() => setActiveCategorie(activeCategorie === key ? null : key)}
                      className={cn(
                        "w-full flex items-center gap-2 justify-between px-3 py-2 rounded-lg text-xs transition-colors",
                        activeCategorie === key ? "bg-autronis-accent/10 text-autronis-accent" : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <CatIcon className={cn("w-3 h-3", config.color)} />
                        {config.label}
                      </span>
                      {count > 0 && <span className="tabular-nums">{count}</span>}
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>

            {/* Recent */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-autronis-text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-autronis-accent" />Recent
              </h3>
              <div className="space-y-1">
                {artikelen.slice(0, 5).map((artikel) => (
                  <Link key={artikel.id} href={`/wiki/${artikel.id}`}
                    className="block px-3 py-1.5 rounded-lg text-xs text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50 transition-colors truncate">
                    {artikel.titel}
                  </Link>
                ))}
                {artikelen.length === 0 && (
                  <p className="text-xs text-autronis-text-secondary/50 px-3">Nog geen artikelen</p>
                )}
              </div>
            </div>
          </div>

          {/* Main area */}
          <div className="lg:col-span-3 space-y-4">
            {/* Text search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary" />
              <input
                type="text"
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                placeholder="Zoeken in kennisbank..."
                className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-11 pr-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 transition-colors"
              />
            </div>

            {/* Tag filter bar */}
            {tagCounts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-autronis-text-secondary mr-1" />
                {activeTag && (
                  <button
                    onClick={() => setActiveTag(null)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-autronis-accent/15 text-autronis-accent border border-autronis-accent/30 hover:bg-autronis-accent/25 transition-colors"
                  >
                    × {activeTag}
                  </button>
                )}
                {!activeTag && tagCounts.slice(0, 20).map(([tag, count]) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/40 transition-colors"
                  >
                    {tag}
                    <span className="tabular-nums opacity-60">{count}</span>
                  </button>
                ))}
                {!activeTag && tagCounts.length > 20 && (
                  <span className="text-[11px] text-autronis-text-secondary/70">+{tagCounts.length - 20} meer</span>
                )}
              </div>
            )}

            {/* Article list */}
            <AnimatePresence mode="wait">
            {artikelen.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                titel="Geen artikelen gevonden"
                beschrijving={zoek || activeCategorie ? "Probeer een andere zoekterm of categorie." : "Begin met het toevoegen van je eerste artikel."}
                actieLabel={!zoek && !activeCategorie ? "Nieuw artikel" : undefined}
                actieHref={!zoek && !activeCategorie ? "/wiki/nieuw" : undefined}
                icoon={<BookOpen className="h-7 w-7 text-autronis-text-secondary" />}
              />
              </motion.div>
            ) : (
              <motion.div
                key={`${activeCategorie}-${zoek}`}
                className="space-y-2"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
              >
                {artikelen.map((artikel) => {
                  const cat = categorieConfig[artikel.categorie || "processen"] || categorieConfig.processen;
                  const tags = parseTags(artikel.tags);
                  const verouderd = isVerouderd(artikel.bijgewerktOp);
                  const CatIcon = cat.icon;

                  return (
                    <motion.div
                      key={artikel.id}
                      variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.15 }}
                    >
                    <Link
                      href={`/wiki/${artikel.id}`}
                      className="block bg-autronis-card border border-autronis-border rounded-xl p-4 lg:p-5 card-glow transition-colors hover:border-autronis-accent/30"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-lg flex-shrink-0 mt-0.5", cat.bg)}>
                          <CatIcon className={cn("w-4 h-4", cat.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-autronis-text-primary truncate">{artikel.titel}</h3>
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0", cat.bg, cat.color)}>
                              {cat.label}
                            </span>
                            {verouderd && (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 font-medium flex-shrink-0">
                                <AlertTriangle className="w-2.5 h-2.5" />Verouderd
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-autronis-text-secondary leading-relaxed mb-2">
                            {getSnippet(artikel.inhoud)}
                          </p>

                          <div className="flex items-center flex-wrap gap-2">
                            {tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5 text-autronis-text-secondary" />
                                {tags.slice(0, 3).map((tag) => (
                                  <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-autronis-bg rounded text-autronis-text-secondary">{tag}</span>
                                ))}
                                {tags.length > 3 && <span className="text-[10px] text-autronis-text-secondary">+{tags.length - 3}</span>}
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-[10px] text-autronis-text-secondary">
                              <User className="w-2.5 h-2.5" />{artikel.auteurNaam || "Onbekend"}
                            </div>
                            {artikel.bijgewerktOp && (
                              <div className="flex items-center gap-1 text-[10px] text-autronis-text-secondary">
                                <Clock className="w-2.5 h-2.5" />{formatDatum(artikel.bijgewerktOp)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
