"use client";

import React, { useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Newspaper,
  Video,
  CalendarDays,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  ArrowRight,
  Lightbulb,
  GripVertical,
  AlertTriangle,
  X,
  CheckCircle2,
  Linkedin,
  Instagram,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { PageTransition } from "@/components/ui/page-transition";
import {
  useContentPosts,
  useContentVideos,
  useContentBanners,
  useContentInzichten,
  useGenerateBatch,
  useUpdatePost,
} from "@/hooks/queries/use-content";
import { useToast } from "@/hooks/use-toast";
import type { ContentPost, ContentVideo, ContentBanner, ContentStatus } from "@/types/content";

function formatWeek(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const weekNr = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNr).padStart(2, "0")}`;
}

function formatDatum(datum: string | null | undefined): string {
  if (!datum) return "";
  const d = new Date(datum);
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function formatTijd(datum: string | null | undefined): string {
  if (!datum) return "";
  const d = new Date(datum);
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// --- Pipeline types ---

type PipelineKolom = "concept" | "goedgekeurd" | "gepland" | "gepubliceerd";
type PipelineFilter = "alle" | "posts" | "videos" | "banners";

interface PipelineItem {
  id: string;
  type: "post" | "video" | "banner";
  titel: string;
  platform?: string;
  datum: string | null;
  kolom: PipelineKolom;
  oorspronkelijkId: number;
}

function mapPostToKolom(post: ContentPost): PipelineKolom {
  if (post.status === "gepubliceerd") return "gepubliceerd";
  if (post.geplandOp && post.status !== "concept") return "gepland";
  if (post.status === "goedgekeurd" || post.status === "bewerkt") return "goedgekeurd";
  return "concept";
}

function mapVideoToKolom(video: ContentVideo): PipelineKolom {
  if (video.status === "klaar") return "goedgekeurd";
  return "concept";
}

function mapBannerToKolom(banner: ContentBanner): PipelineKolom {
  if (banner.status === "klaar") return "gepubliceerd";
  return "concept";
}

const KOLOM_CONFIG: { key: PipelineKolom; label: string; kleur: string; bgKleur: string; tint: string }[] = [
  { key: "concept", label: "Concept", kleur: "text-gray-400", bgKleur: "bg-gray-500/20", tint: "bg-gray-500/[0.04] border-gray-500/15" },
  { key: "goedgekeurd", label: "Goedgekeurd", kleur: "text-blue-400", bgKleur: "bg-blue-500/20", tint: "bg-blue-500/[0.04] border-blue-500/15" },
  { key: "gepland", label: "Gepland", kleur: "text-autronis-accent", bgKleur: "bg-autronis-accent/20", tint: "bg-autronis-accent/[0.04] border-autronis-accent/15" },
  { key: "gepubliceerd", label: "Gepubliceerd", kleur: "text-emerald-400", bgKleur: "bg-emerald-500/20", tint: "bg-emerald-500/[0.04] border-emerald-500/15" },
];

const PLATFORM_COLORS: Record<string, { bg: string; text: string; icon: React.FC<{ className?: string }> }> = {
  linkedin: { bg: "bg-blue-500/10", text: "text-blue-400", icon: Linkedin },
  instagram: { bg: "bg-pink-500/10", text: "text-pink-400", icon: Instagram },
};

export default function ContentPage() {
  const { addToast } = useToast();
  const { data: allePosts = [] } = useContentPosts();
  const { data: videos = [] } = useContentVideos();
  const { data: banners = [] } = useContentBanners();
  const { data: inzichten = [] } = useContentInzichten();
  const genereerBatch = useGenerateBatch();
  const genereerLinkedin = useGenerateBatch();
  const genereerWeek = useGenerateBatch();
  const updatePost = useUpdatePost();

  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("alle");
  const [weekBriefOpen, setWeekBriefOpen] = useState(false);

  const huidigeWeek = formatWeek();

  // KPIs
  const stats = useMemo(() => {
    const nu = new Date();
    const dezeWeekPosts = allePosts.filter((p) => p.batchWeek === huidigeWeek);
    const dezeMaandVideos = videos.filter((v) => {
      if (!v.aangemaaktOp) return false;
      const d = new Date(v.aangemaaktOp);
      return d.getMonth() === nu.getMonth() && d.getFullYear() === nu.getFullYear();
    });
    const conceptPosts = allePosts.filter((p) => p.status === "concept");
    const geplandPosts = allePosts.filter((p) => p.geplandOp && p.status !== "gepubliceerd");
    const gepubliceerdPosts = allePosts.filter((p) => p.status === "gepubliceerd");
    const videoKlaar = videos.filter((v) => v.status === "klaar");
    const videoInProductie = videos.filter((v) => v.status === "rendering" || v.status === "script");
    const bannersKlaar = banners.filter((b) => b.status === "klaar");

    return {
      postsDezeWeek: dezeWeekPosts.length,
      videossDezeMaand: dezeMaandVideos.length,
      conceptPosts: conceptPosts.length,
      geplandPosts: geplandPosts.length,
      gepubliceerdPosts: gepubliceerdPosts.length,
      totalePosts: allePosts.length,
      videoKlaar: videoKlaar.length,
      videoInProductie: videoInProductie.length,
      totaleVideos: videos.length,
      bannersKlaar: bannersKlaar.length,
      totaleBanners: banners.length,
      inzichten: inzichten.length,
    };
  }, [allePosts, videos, banners, inzichten, huidigeWeek]);

  // Content kalender preview — next 7 days
  const kalenderDagen = useMemo(() => {
    const vandaag = new Date();
    vandaag.setHours(0, 0, 0, 0);
    const dagen: { datum: Date; label: string; posts: ContentPost[] }[] = [];

    for (let i = 0; i < 7; i++) {
      const dag = new Date(vandaag);
      dag.setDate(vandaag.getDate() + i);
      const dagStr = dag.toISOString().split("T")[0];
      const dagPosts = allePosts.filter((p) => {
        if (!p.geplandOp) return false;
        return p.geplandOp.startsWith(dagStr);
      });
      const label = i === 0 ? "Vandaag" : i === 1 ? "Morgen" : dag.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
      dagen.push({ datum: dag, label, posts: dagPosts });
    }
    return dagen;
  }, [allePosts]);

  // Pipeline items
  const pipelineItems = useMemo(() => {
    const items: PipelineItem[] = [];

    if (pipelineFilter === "alle" || pipelineFilter === "posts") {
      for (const post of allePosts) {
        items.push({
          id: `post-${post.id}`,
          type: "post",
          titel: post.titel,
          platform: post.platform,
          datum: post.geplandOp ?? post.aangemaaktOp,
          kolom: mapPostToKolom(post),
          oorspronkelijkId: post.id,
        });
      }
    }

    if (pipelineFilter === "alle" || pipelineFilter === "videos") {
      for (const video of videos) {
        items.push({
          id: `video-${video.id}`,
          type: "video",
          titel: video.postTitel ?? `Video #${video.id}`,
          platform: video.postPlatform ?? undefined,
          datum: video.aangemaaktOp,
          kolom: mapVideoToKolom(video),
          oorspronkelijkId: video.id,
        });
      }
    }

    if (pipelineFilter === "alle" || pipelineFilter === "banners") {
      for (const banner of banners) {
        items.push({
          id: `banner-${banner.id}`,
          type: "banner",
          titel: banner.onderwerp,
          platform: banner.formaat.startsWith("instagram") ? "instagram" : "linkedin",
          datum: banner.aangemaaktOp,
          kolom: mapBannerToKolom(banner),
          oorspronkelijkId: banner.id,
        });
      }
    }

    return items;
  }, [allePosts, videos, banners, pipelineFilter]);

  // Suggesties with priority
  const suggesties = useMemo(() => {
    const tips: { tekst: string; actie?: string; href?: string; prio: "hoog" | "normaal" | "info" }[] = [];
    const ongebruikteInzichten = inzichten.filter((i) => !i.isGebruikt);

    if (stats.postsDezeWeek === 0) {
      tips.push({ tekst: "Je hebt deze week nog niet gepost — genereer een LinkedIn post", actie: "genereer", prio: "hoog" });
    }
    if (ongebruikteInzichten.length < 3) {
      tips.push({ tekst: `Slechts ${ongebruikteInzichten.length} ongebruikte inzichten — voeg er meer toe voor betere content`, href: "/content/kennisbank", prio: "hoog" });
    }
    if (stats.conceptPosts > 5) {
      tips.push({ tekst: `Je hebt ${stats.conceptPosts} concepten staan — plan ze in of publiceer`, href: "/content/posts", prio: "normaal" });
    }
    if (stats.bannersKlaar < 3) {
      tips.push({ tekst: "Maak meer banners voor een consistent Instagram grid", href: "/content/banners", prio: "normaal" });
    }
    if (stats.geplandPosts === 0 && stats.totalePosts > 0) {
      tips.push({ tekst: "Geen posts gepland — gebruik de kalender om posts in te plannen", href: "/content/kalender", prio: "normaal" });
    }
    if (tips.length === 0) {
      tips.push({ tekst: "Tip: maak content van je laatste project resultaten", href: "/content/kennisbank", prio: "info" });
    }
    return tips.slice(0, 3);
  }, [stats, inzichten]);

  // Handlers
  function handleGenereer() {
    genereerBatch.mutate(undefined, {
      onSuccess: () => addToast("Content batch gegenereerd", "succes"),
      onError: (err) => addToast(err.message || "Genereren mislukt", "fout"),
    });
  }

  function handleGenereerLinkedin() {
    genereerLinkedin.mutate({ count: 1, platforms: ["linkedin"] }, {
      onSuccess: () => addToast("LinkedIn post gegenereerd", "succes"),
      onError: (err) => addToast(err.message || "Genereren mislukt", "fout"),
    });
  }

  function handleGenereerWeek() {
    setWeekBriefOpen(true);
  }

  function handleBevestigWeek() {
    setWeekBriefOpen(false);
    genereerWeek.mutate({ count: 7 }, {
      onSuccess: () => addToast("Week content gegenereerd (7 posts)", "succes"),
      onError: (err) => addToast(err.message || "Genereren mislukt", "fout"),
    });
  }

  // Drag & drop
  const dragItem = useRef<string | null>(null);

  const handleDragStart = useCallback((itemId: string) => {
    dragItem.current = itemId;
  }, []);

  const handleDrop = useCallback((kolom: PipelineKolom) => {
    const itemId = dragItem.current;
    dragItem.current = null;
    if (!itemId) return;

    const item = pipelineItems.find((i) => i.id === itemId);
    if (!item || item.kolom === kolom) return;

    // Only posts can be moved via status update
    if (item.type === "post") {
      const statusMap: Record<PipelineKolom, ContentStatus> = {
        concept: "concept",
        goedgekeurd: "goedgekeurd",
        gepland: "goedgekeurd", // needs scheduling separately
        gepubliceerd: "gepubliceerd",
      };
      updatePost.mutate(
        { id: item.oorspronkelijkId, status: statusMap[kolom] },
        {
          onSuccess: () => addToast(`Post verplaatst naar ${kolom}`, "succes"),
          onError: (err) => addToast(err.message || "Verplaatsen mislukt", "fout"),
        }
      );
    } else {
      addToast("Alleen posts kunnen verplaatst worden via drag & drop", "fout");
    }
  }, [pipelineItems, updatePost, addToast]);

  // Last activity per section
  const laatsteActiviteit = useMemo(() => {
    const laatstePost = allePosts.length > 0 ? allePosts.reduce((a, b) => (a.aangemaaktOp > b.aangemaaktOp ? a : b)) : null;
    const laatsteVideo = videos.length > 0 ? videos.reduce((a, b) => ((a.aangemaaktOp ?? "") > (b.aangemaaktOp ?? "") ? a : b)) : null;
    const laatsteBanner = banners.length > 0 ? banners.reduce((a, b) => (a.aangemaaktOp > b.aangemaaktOp ? a : b)) : null;
    const laatsteInzicht = inzichten.length > 0 ? inzichten.reduce((a, b) => (a.aangemaaktOp > b.aangemaaktOp ? a : b)) : null;

    return {
      posts: laatstePost ? formatTijd(laatstePost.aangemaaktOp) : null,
      videos: laatsteVideo ? formatTijd(laatsteVideo.aangemaaktOp) : null,
      banners: laatsteBanner ? formatTijd(laatsteBanner.aangemaaktOp) : null,
      inzichten: laatsteInzicht ? formatTijd(laatsteInzicht.aangemaaktOp) : null,
    };
  }, [allePosts, videos, banners, inzichten]);

  return (
    <PageTransition>
    <div className="max-w-[1400px] mx-auto p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">Content Engine</h1>
          <p className="text-autronis-text-secondary mt-1">
            Beheer je kennisbank en genereer social media content voor Autronis.
          </p>
        </div>
        <button
          onClick={handleGenereer}
          disabled={genereerBatch.isPending}
          className="btn-shimmer inline-flex items-center gap-2 px-6 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
        >
          {genereerBatch.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {genereerBatch.isPending ? "Claude schrijft..." : "Genereer content"}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Posts deze week", value: stats.postsDezeWeek, sub: `${stats.totalePosts} totaal`, icon: Newspaper, kleur: "text-blue-400", bg: "kpi-gradient-facturen" },
          { label: "Video's deze maand", value: stats.videossDezeMaand, sub: `${stats.totaleVideos} totaal`, icon: Video, kleur: "text-purple-400", bg: "kpi-gradient-projecten" },
          { label: "Banners gemaakt", value: stats.bannersKlaar, sub: `${stats.totaleBanners} totaal`, icon: ImageIcon, kleur: "text-pink-400", bg: "kpi-gradient-deadlines" },
          { label: "Inzichten opgeslagen", value: stats.inzichten, sub: null, icon: BookOpen, kleur: "text-emerald-400", bg: "kpi-gradient-betaald" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
            className={cn("border border-autronis-border rounded-2xl p-5 card-glow", kpi.bg)}
          >
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={cn("w-4 h-4", kpi.kleur)} />
              <span className="text-xs text-autronis-text-secondary uppercase tracking-wide">{kpi.label}</span>
            </div>
            <p className={cn("text-2xl font-bold tabular-nums", kpi.kleur)}>
              <AnimatedNumber value={kpi.value} />
            </p>
            {kpi.sub && <p className="text-[11px] text-autronis-text-secondary mt-1">{kpi.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Content kalender preview */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide">Content kalender — komende 7 dagen</h2>
          <Link href="/content/kalender" className="text-xs text-autronis-accent hover:text-autronis-accent-hover transition-colors font-medium flex items-center gap-1">
            Volledige kalender <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {kalenderDagen.map((dag, i) => (
            <motion.div
              key={dag.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="text-center"
            >
              <p className="text-[11px] text-autronis-text-secondary mb-2 font-medium">{dag.label}</p>
              <Link href="/content/kalender">
                <div className={cn(
                  "min-h-[60px] rounded-xl border p-2 transition-all hover:scale-[1.02]",
                  dag.posts.length > 0
                    ? "border-autronis-accent/30 bg-autronis-accent/5"
                    : "border-autronis-border bg-autronis-bg/50 hover:border-autronis-border-hover"
                )}>
                  {dag.posts.length > 0 ? (
                    <div className="space-y-1">
                      {dag.posts.slice(0, 2).map((post) => {
                        const pl = PLATFORM_COLORS[post.platform ?? "linkedin"] ?? PLATFORM_COLORS.linkedin;
                        return (
                          <div key={post.id} title={`${post.platform}: ${post.titel}`} className="flex items-center gap-1">
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", post.platform === "linkedin" ? "bg-blue-400" : "bg-pink-400")} />
                            <p className={cn("text-[10px] truncate font-medium", pl.text)}>{post.titel}</p>
                          </div>
                        );
                      })}
                      {dag.posts.length > 2 && (
                        <p className="text-[10px] text-autronis-text-secondary">+{dag.posts.length - 2}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-autronis-text-secondary/50 mt-3">—</p>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-3">Snelle acties</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenereerLinkedin}
            disabled={genereerLinkedin.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {genereerLinkedin.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Newspaper className="w-4 h-4" />}
            Genereer LinkedIn post
          </button>
          <Link
            href="/content/banners?nieuw=1"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 rounded-xl text-sm font-medium transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
            Maak banner
          </Link>
          <button
            onClick={handleGenereerWeek}
            disabled={genereerWeek.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {genereerWeek.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
            {genereerWeek.isPending ? "Bezig..." : "Plan content week"}
          </button>
        </div>
      </div>

      {/* Section cards */}
      <div>
        <h2 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-4">Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <Link
            href="/content/kennisbank"
            className="group bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow transition-all hover:border-autronis-accent/50 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-autronis-accent/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-autronis-accent" />
              </div>
              <h2 className="text-base font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors">
                Kennisbank
              </h2>
            </div>
            <p className="text-sm text-autronis-text-secondary mb-2">
              <span className="text-autronis-text-primary font-medium tabular-nums">{stats.inzichten}</span> inzichten opgeslagen
            </p>
            {laatsteActiviteit.inzichten && (
              <p className="text-[10px] text-autronis-text-secondary/70 mb-2">Laatst: {laatsteActiviteit.inzichten}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-autronis-accent font-medium">
              Bekijken <ArrowRight className="w-3 h-3" />
            </div>
          </Link>

          <Link
            href="/content/posts"
            className="group bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow transition-all hover:border-autronis-accent/50 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Newspaper className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-base font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors">
                Posts
              </h2>
            </div>
            <div className="space-y-1 text-sm text-autronis-text-secondary mb-2">
              <p>
                <span className="text-autronis-text-primary font-medium tabular-nums">{stats.conceptPosts}</span> concept
                {stats.geplandPosts > 0 && (
                  <>, <span className="text-autronis-text-primary font-medium tabular-nums">{stats.geplandPosts}</span> gepland</>
                )}
                {stats.gepubliceerdPosts > 0 && (
                  <>, <span className="text-emerald-400 font-medium tabular-nums">{stats.gepubliceerdPosts}</span> gepubliceerd</>
                )}
              </p>
            </div>
            {laatsteActiviteit.posts && (
              <p className="text-[10px] text-autronis-text-secondary/70 mb-2">Laatst: {laatsteActiviteit.posts}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-autronis-accent font-medium">
              Bekijken <ArrowRight className="w-3 h-3" />
            </div>
          </Link>

          <Link
            href="/content/videos"
            className="group bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow transition-all hover:border-autronis-accent/50 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-base font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors">
                Video&apos;s
              </h2>
            </div>
            <p className="text-sm text-autronis-text-secondary mb-2">
              {stats.videoInProductie > 0 && (
                <><span className="text-autronis-text-primary font-medium tabular-nums">{stats.videoInProductie}</span> in productie, </>
              )}
              <span className={cn("font-medium tabular-nums", stats.videoKlaar > 0 ? "text-emerald-400" : "text-autronis-text-primary")}>{stats.videoKlaar}</span> afgerond
            </p>
            {laatsteActiviteit.videos && (
              <p className="text-[10px] text-autronis-text-secondary/70 mb-2">Laatst: {laatsteActiviteit.videos}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-autronis-accent font-medium">
              Bekijken <ArrowRight className="w-3 h-3" />
            </div>
          </Link>

          <Link
            href="/content/kalender"
            className="group bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow transition-all hover:border-autronis-accent/50 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors">
                Kalender
              </h2>
            </div>
            <p className="text-sm text-autronis-text-secondary mb-2">
              <span className="text-autronis-text-primary font-medium tabular-nums">{stats.geplandPosts}</span> posts gepland
            </p>
            <div className="flex items-center gap-1 text-xs text-autronis-accent font-medium">
              Bekijken <ArrowRight className="w-3 h-3" />
            </div>
          </Link>

          <Link
            href="/content/banners"
            className="group bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow transition-all hover:border-autronis-accent/50 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-pink-400" />
              </div>
              <h2 className="text-base font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors">
                Banners
              </h2>
            </div>
            <p className="text-sm text-autronis-text-secondary mb-2">
              <span className="text-pink-400 font-medium tabular-nums">{stats.bannersKlaar}</span> banners gemaakt
            </p>
            {laatsteActiviteit.banners && (
              <p className="text-[10px] text-autronis-text-secondary/70 mb-2">Laatst: {laatsteActiviteit.banners}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-autronis-accent font-medium">
              Bekijken <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        </div>
      </div>

      {/* Pipeline */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide">Pipeline</h2>
          <div className="flex gap-2">
            {([
              { key: "alle" as const, label: "Alle" },
              { key: "posts" as const, label: "Posts" },
              { key: "videos" as const, label: "Video's" },
              { key: "banners" as const, label: "Banners" },
            ]).map((f) => (
              <button
                key={f.key}
                onClick={() => setPipelineFilter(f.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  pipelineFilter === f.key
                    ? "bg-autronis-accent/20 text-autronis-accent"
                    : "bg-autronis-bg text-autronis-text-secondary hover:text-autronis-text-primary border border-autronis-border"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Kanban columns */}
        <div className="grid grid-cols-4 gap-4">
          {KOLOM_CONFIG.map((kolom) => {
            const items = pipelineItems.filter((i) => i.kolom === kolom.key);
            return (
              <div
                key={kolom.key}
                className={cn("border rounded-2xl p-4 min-h-[200px]", kolom.tint)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(kolom.key)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", kolom.bgKleur)} />
                    <h3 className={cn("text-sm font-semibold", kolom.kleur)}>{kolom.label}</h3>
                  </div>
                  <motion.span
                    key={items.length}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="text-xs text-autronis-text-secondary tabular-nums bg-autronis-card px-2 py-0.5 rounded-full"
                  >
                    {items.length}
                  </motion.span>
                </div>

                  <div className="space-y-2">
                    {items.map((item, idx) => {
                      const pl = item.platform ? (PLATFORM_COLORS[item.platform] ?? null) : null;
                      return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        draggable
                        onDragStart={() => handleDragStart(item.id)}
                        className="bg-autronis-card border border-autronis-border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-autronis-accent/30 transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-3.5 h-3.5 text-autronis-text-secondary/30 group-hover:text-autronis-text-secondary/60 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              {item.type === "post" && <Newspaper className="w-3 h-3 text-blue-400 shrink-0" />}
                              {item.type === "video" && <Video className="w-3 h-3 text-purple-400 shrink-0" />}
                              {item.type === "banner" && <ImageIcon className="w-3 h-3 text-pink-400 shrink-0" />}
                              <p className="text-xs font-medium text-autronis-text-primary truncate">{item.titel}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {pl && (
                                <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium", pl.bg, pl.text)}>
                                  <pl.icon className="w-2.5 h-2.5" />
                                  {item.platform}
                                </span>
                              )}
                              {item.datum && (
                                <span className="text-[10px] text-autronis-text-secondary">{formatDatum(item.datum)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                    })}
                    {items.length === 0 && (
                      <p className="text-xs text-autronis-text-secondary/40 text-center py-8">Geen items</p>
                    )}
                  </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Content Suggesties */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide">Content suggesties</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {suggesties.map((suggestie, i) => {
            const prioKleur = suggestie.prio === "hoog"
              ? { border: "border-red-500/30", bg: "bg-red-500/5", icon: "text-red-400", iconBg: "bg-red-500/10" }
              : suggestie.prio === "normaal"
              ? { border: "border-amber-500/30", bg: "bg-amber-500/5", icon: "text-amber-400", iconBg: "bg-amber-500/10" }
              : { border: "border-autronis-accent/20", bg: "bg-autronis-card", icon: "text-autronis-accent", iconBg: "bg-autronis-accent/10" };
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className={cn(
                  "border rounded-2xl p-4 flex items-start gap-3 transition-all",
                  prioKleur.border,
                  prioKleur.bg,
                  suggestie.href && "hover:scale-[1.01] cursor-pointer"
                )}
                onClick={() => suggestie.href && (window.location.href = suggestie.href)}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", prioKleur.iconBg)}>
                  {suggestie.prio === "hoog" ? (
                    <AlertTriangle className={cn("w-4 h-4", prioKleur.icon)} />
                  ) : (
                    <Lightbulb className={cn("w-4 h-4", prioKleur.icon)} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-autronis-text-primary">{suggestie.tekst}</p>
                  {suggestie.actie === "genereer" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleGenereerLinkedin(); }}
                      disabled={genereerLinkedin.isPending}
                      className="mt-2 text-xs text-autronis-accent hover:text-autronis-accent-hover font-medium transition-colors disabled:opacity-50"
                    >
                      {genereerLinkedin.isPending ? "Bezig..." : "Genereer nu →"}
                    </button>
                  )}
                  {suggestie.href && !suggestie.actie && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-autronis-text-secondary/70 font-medium">
                      Ga naar <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Week-brief modal */}
      <AnimatePresence>
        {weekBriefOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setWeekBriefOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="glass-modal border border-autronis-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-autronis-text-primary">Plan content week</h3>
                  <p className="text-sm text-autronis-text-secondary mt-1">Claude genereert 7 posts op basis van je kennisbank.</p>
                </div>
                <button onClick={() => setWeekBriefOpen(false)} className="p-1.5 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 mb-5">
                {[
                  { label: "Posts", value: "7 posts (mix LinkedIn + Instagram)" },
                  { label: "Formats", value: "Tips, storytelling, thought leadership" },
                  { label: "Basis", value: `${inzichten.filter((i) => !i.isGebruikt).length} ongebruikte inzichten` },
                  { label: "Tone", value: "Menselijk, geen AI-taal" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm py-1.5 border-b border-autronis-border/40 last:border-0">
                    <span className="text-autronis-text-secondary">{item.label}</span>
                    <span className="text-autronis-text-primary font-medium">{item.value}</span>
                  </div>
                ))}
              </div>

              {inzichten.filter((i) => !i.isGebruikt).length < 3 && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-300">Weinig ongebruikte inzichten. Voeg er meer toe voor betere resultaten.</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setWeekBriefOpen(false)}
                  className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleBevestigWeek}
                  disabled={genereerWeek.isPending}
                  className="btn-shimmer flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {genereerWeek.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {genereerWeek.isPending ? "Bezig..." : "Genereer 7 posts"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </PageTransition>
  );
}
