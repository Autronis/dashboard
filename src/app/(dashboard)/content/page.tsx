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
  Plus,
  Flame,
  ExternalLink,
  ChevronRight,
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

// ─── Helpers ───

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

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + oneJan.getDay() + 1) / 7);
}

function vorigeWeekStr(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const weekNr = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  const vw = weekNr - 1;
  if (vw <= 0) return `${now.getFullYear() - 1}-W52`;
  return `${now.getFullYear()}-W${String(vw).padStart(2, "0")}`;
}

// ─── Pipeline types ───

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

const KOLOM_CONFIG: { key: PipelineKolom; label: string; kleur: string; bgKleur: string; tint: string; nextLabel?: string }[] = [
  { key: "concept", label: "Concept", kleur: "text-gray-400", bgKleur: "bg-gray-500/20", tint: "bg-gray-500/[0.04] border-gray-500/15", nextLabel: "Goedkeuren" },
  { key: "goedgekeurd", label: "Goedgekeurd", kleur: "text-blue-400", bgKleur: "bg-blue-500/20", tint: "bg-blue-500/[0.04] border-blue-500/15", nextLabel: "Plannen" },
  { key: "gepland", label: "Gepland", kleur: "text-autronis-accent", bgKleur: "bg-autronis-accent/20", tint: "bg-autronis-accent/[0.04] border-autronis-accent/15", nextLabel: "Publiceren" },
  { key: "gepubliceerd", label: "Gepubliceerd", kleur: "text-emerald-400", bgKleur: "bg-emerald-500/20", tint: "bg-emerald-500/[0.04] border-emerald-500/15" },
];

const PLATFORM_COLORS: Record<string, { bg: string; text: string; icon: React.FC<{ className?: string }> }> = {
  linkedin: { bg: "bg-blue-500/10", text: "text-blue-400", icon: Linkedin },
  instagram: { bg: "bg-pink-500/10", text: "text-pink-400", icon: Instagram },
};

// ─── Content Streak ───

function ContentStreak({ weken }: { weken: number[] }) {
  // weken = array van 4 weken, elke waarde = aantal posts die week
  const streakCount = weken.reduceRight((streak, count) => (count > 0 && streak >= 0 ? streak + 1 : streak < 0 ? streak : -1), 0);
  const effectiveStreak = Math.max(streakCount, 0);

  if (effectiveStreak === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-xl"
    >
      <Flame className="w-3.5 h-3.5 text-orange-400" />
      <span className="text-xs font-semibold text-orange-400 tabular-nums">{effectiveStreak} wk streak</span>
    </motion.div>
  );
}

// ─── Main Page ───

export default function ContentPage() {
  const { addToast } = useToast();
  const { data: allePosts = [] } = useContentPosts();
  const { data: videos = [] } = useContentVideos();
  const { data: banners = [] } = useContentBanners();
  const { data: inzichten = [] } = useContentInzichten();
  const genereerBatch = useGenerateBatch();
  const genereerLinkedin = useGenerateBatch();
  const genereerStorytelling = useGenerateBatch();
  const genereerWeek = useGenerateBatch();
  const updatePost = useUpdatePost();

  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("alle");
  const [weekBriefOpen, setWeekBriefOpen] = useState(false);
  const [dragOverKolom, setDragOverKolom] = useState<PipelineKolom | null>(null);

  const huidigeWeek = formatWeek();
  const vorigeWeek = vorigeWeekStr();

  // ─── KPIs ───
  const stats = useMemo(() => {
    const nu = new Date();
    const dezeWeekPosts = allePosts.filter((p) => p.batchWeek === huidigeWeek);
    const vorigeWeekPosts = allePosts.filter((p) => p.batchWeek === vorigeWeek);
    const dezeMaandVideos = videos.filter((v) => {
      if (!v.aangemaaktOp) return false;
      const d = new Date(v.aangemaaktOp);
      return d.getMonth() === nu.getMonth() && d.getFullYear() === nu.getFullYear();
    });
    const conceptPosts = allePosts.filter((p) => p.status === "concept");
    const geplandPosts = allePosts.filter((p) => p.geplandOp && p.status !== "gepubliceerd");
    const gepubliceerdPosts = allePosts.filter((p) => p.status === "gepubliceerd");
    const bannersKlaar = banners.filter((b) => b.status === "klaar");

    return {
      postsDezeWeek: dezeWeekPosts.length,
      postsVorigeWeek: vorigeWeekPosts.length,
      videossDezeMaand: dezeMaandVideos.length,
      conceptPosts: conceptPosts.length,
      geplandPosts: geplandPosts.length,
      gepubliceerdPosts: gepubliceerdPosts.length,
      totalePosts: allePosts.length,
      videoKlaar: videos.filter((v) => v.status === "klaar").length,
      videoInProductie: videos.filter((v) => v.status === "rendering" || v.status === "script").length,
      totaleVideos: videos.length,
      bannersKlaar: bannersKlaar.length,
      totaleBanners: banners.length,
      inzichten: inzichten.length,
    };
  }, [allePosts, videos, banners, inzichten, huidigeWeek, vorigeWeek]);

  // Weekly post counts for streak
  const weekCounts = useMemo(() => {
    const nu = new Date();
    const counts: number[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(nu);
      weekStart.setDate(weekStart.getDate() - w * 7 - nu.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const count = allePosts.filter((p) => {
        const d = new Date(p.aangemaaktOp);
        return d >= weekStart && d <= weekEnd;
      }).length;
      counts.push(count);
    }
    return counts;
  }, [allePosts]);

  // ─── Content kalender ───
  const kalenderDagen = useMemo(() => {
    const vandaag = new Date();
    vandaag.setHours(0, 0, 0, 0);
    const dagen: { datum: Date; label: string; posts: ContentPost[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const dag = new Date(vandaag);
      dag.setDate(vandaag.getDate() + i);
      const dagStr = dag.toISOString().split("T")[0];
      const dagPosts = allePosts.filter((p) => p.geplandOp?.startsWith(dagStr));
      const label = i === 0 ? "Vandaag" : i === 1 ? "Morgen" : dag.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
      dagen.push({ datum: dag, label, posts: dagPosts });
    }
    return dagen;
  }, [allePosts]);

  const alleKalenderLeeg = kalenderDagen.every((d) => d.posts.length === 0);

  // ─── Pipeline items ───
  const pipelineItems = useMemo(() => {
    const items: PipelineItem[] = [];
    if (pipelineFilter === "alle" || pipelineFilter === "posts") {
      for (const post of allePosts) {
        items.push({ id: `post-${post.id}`, type: "post", titel: post.titel, platform: post.platform, datum: post.geplandOp ?? post.aangemaaktOp, kolom: mapPostToKolom(post), oorspronkelijkId: post.id });
      }
    }
    if (pipelineFilter === "alle" || pipelineFilter === "videos") {
      for (const video of videos) {
        items.push({ id: `video-${video.id}`, type: "video", titel: video.postTitel ?? `Video #${video.id}`, platform: video.postPlatform ?? undefined, datum: video.aangemaaktOp, kolom: mapVideoToKolom(video), oorspronkelijkId: video.id });
      }
    }
    if (pipelineFilter === "alle" || pipelineFilter === "banners") {
      for (const banner of banners) {
        items.push({ id: `banner-${banner.id}`, type: "banner", titel: banner.onderwerp, platform: banner.formaat.startsWith("instagram") ? "instagram" : "linkedin", datum: banner.aangemaaktOp, kolom: mapBannerToKolom(banner), oorspronkelijkId: banner.id });
      }
    }
    return items;
  }, [allePosts, videos, banners, pipelineFilter]);

  // ─── Suggesties ───
  const topSuggestie = useMemo(() => {
    const ongebruikteInzichten = inzichten.filter((i) => !i.isGebruikt);
    if (stats.postsDezeWeek === 0) return { tekst: "Je hebt deze week nog niet gepost", actie: "genereer", prio: "hoog" as const };
    if (ongebruikteInzichten.length < 3) return { tekst: `Slechts ${ongebruikteInzichten.length} ongebruikte inzichten — voeg er meer toe`, href: "/content/kennisbank", prio: "hoog" as const };
    if (stats.conceptPosts > 5) return { tekst: `${stats.conceptPosts} concepten staan te wachten — plan ze in`, href: "/content/posts", prio: "normaal" as const };
    if (stats.geplandPosts === 0 && stats.totalePosts > 0) return { tekst: "Geen posts gepland — plan je content week", prio: "normaal" as const };
    return null;
  }, [stats, inzichten]);

  const moreSuggesties = useMemo(() => {
    const tips: { tekst: string; href?: string; actie?: string; prio: "hoog" | "normaal" | "info" }[] = [];
    const ongebruikteInzichten = inzichten.filter((i) => !i.isGebruikt);
    if (stats.bannersKlaar < 3) tips.push({ tekst: "Maak meer banners voor consistent Instagram grid", href: "/content/banners", prio: "normaal" });
    if (ongebruikteInzichten.length >= 3 && stats.postsDezeWeek > 0) tips.push({ tekst: "Tip: maak content van je laatste project resultaten", href: "/content/kennisbank", prio: "info" });
    return tips.slice(0, 2);
  }, [stats, inzichten]);

  // ─── Last activity ───
  const laatsteActiviteit = useMemo(() => {
    const laatstePost = allePosts.length > 0 ? allePosts.reduce((a, b) => (a.aangemaaktOp > b.aangemaaktOp ? a : b)) : null;
    const laatsteVideo = videos.length > 0 ? videos.reduce((a, b) => ((a.aangemaaktOp ?? "") > (b.aangemaaktOp ?? "") ? a : b)) : null;
    const laatsteBanner = banners.length > 0 ? banners.reduce((a, b) => (a.aangemaaktOp > b.aangemaaktOp ? a : b)) : null;
    return {
      posts: laatstePost ? formatTijd(laatstePost.aangemaaktOp) : null,
      videos: laatsteVideo ? formatTijd(laatsteVideo.aangemaaktOp) : null,
      banners: laatsteBanner ? formatTijd(laatsteBanner.aangemaaktOp) : null,
    };
  }, [allePosts, videos, banners]);

  // ─── Handlers ───
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

  function handleGenereerStorytelling() {
    genereerStorytelling.mutate({ count: 1, platforms: ["linkedin"], format: "storytelling" }, {
      onSuccess: () => addToast("LinkedIn storytelling post gegenereerd", "succes"),
      onError: (err) => addToast(err.message || "Genereren mislukt", "fout"),
    });
  }

  function handleBevestigWeek() {
    setWeekBriefOpen(false);
    genereerWeek.mutate({ count: 7 }, {
      onSuccess: () => addToast("Week content gegenereerd (7 posts)", "succes"),
      onError: (err) => addToast(err.message || "Genereren mislukt", "fout"),
    });
  }

  function handleQuickMove(item: PipelineItem) {
    if (item.type !== "post") {
      addToast("Alleen posts kunnen verplaatst worden", "fout");
      return;
    }
    const kolomIndex = KOLOM_CONFIG.findIndex((k) => k.key === item.kolom);
    if (kolomIndex >= KOLOM_CONFIG.length - 1) return;
    const nextKolom = KOLOM_CONFIG[kolomIndex + 1].key;
    const statusMap: Record<PipelineKolom, ContentStatus> = {
      concept: "concept",
      goedgekeurd: "goedgekeurd",
      gepland: "goedgekeurd",
      gepubliceerd: "gepubliceerd",
    };
    updatePost.mutate(
      { id: item.oorspronkelijkId, status: statusMap[nextKolom] },
      {
        onSuccess: () => addToast(`Post verplaatst naar ${nextKolom}`, "succes"),
        onError: (err) => addToast(err.message || "Verplaatsen mislukt", "fout"),
      }
    );
  }

  // Drag & drop
  const dragItem = useRef<string | null>(null);

  const handleDragStart = useCallback((itemId: string) => {
    dragItem.current = itemId;
  }, []);

  const handleDrop = useCallback((kolom: PipelineKolom) => {
    setDragOverKolom(null);
    const itemId = dragItem.current;
    dragItem.current = null;
    if (!itemId) return;

    const item = pipelineItems.find((i) => i.id === itemId);
    if (!item || item.kolom === kolom) return;

    if (item.type === "post") {
      const statusMap: Record<PipelineKolom, ContentStatus> = {
        concept: "concept", goedgekeurd: "goedgekeurd", gepland: "goedgekeurd", gepubliceerd: "gepubliceerd",
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

  const postsDelta = stats.postsDezeWeek - stats.postsVorigeWeek;

  // ─── Module links data ───
  const modules = [
    { href: "/content/kennisbank", label: "Kennisbank", icon: BookOpen, kleur: "text-autronis-accent", bg: "bg-autronis-accent/10", count: stats.inzichten, sub: "inzichten", laatst: null },
    { href: "/content/posts", label: "Posts", icon: Newspaper, kleur: "text-blue-400", bg: "bg-blue-500/10", count: stats.conceptPosts, sub: "concept", laatst: laatsteActiviteit.posts },
    { href: "/content/videos", label: "Video's", icon: Video, kleur: "text-purple-400", bg: "bg-purple-500/10", count: stats.totaleVideos, sub: "totaal", laatst: laatsteActiviteit.videos },
    { href: "/content/kalender", label: "Kalender", icon: CalendarDays, kleur: "text-emerald-400", bg: "bg-emerald-500/10", count: stats.geplandPosts, sub: "gepland", laatst: null },
    { href: "/content/banners", label: "Banners", icon: ImageIcon, kleur: "text-pink-400", bg: "bg-pink-500/10", count: stats.bannersKlaar, sub: "gemaakt", laatst: laatsteActiviteit.banners },
  ];

  return (
    <PageTransition>
      <div className="max-w-[1400px] mx-auto p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">Content Engine</h1>
            <p className="text-autronis-text-secondary mt-1">
              Beheer je kennisbank en genereer social media content voor Autronis.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ContentStreak weken={weekCounts} />
            <button
              onClick={handleGenereer}
              disabled={genereerBatch.isPending}
              className="btn-shimmer inline-flex items-center gap-2 px-6 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
            >
              {genereerBatch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {genereerBatch.isPending ? "Claude schrijft..." : "Genereer content"}
            </button>
          </div>
        </div>

        {/* Top suggestie alert */}
        {topSuggestie && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex items-center gap-3 rounded-xl px-5 py-3 border",
              topSuggestie.prio === "hoog"
                ? "bg-red-500/5 border-red-500/20"
                : "bg-amber-500/5 border-amber-500/20"
            )}
          >
            {topSuggestie.prio === "hoog" ? (
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            ) : (
              <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
            <p className="text-sm text-autronis-text-primary flex-1">{topSuggestie.tekst}</p>
            {topSuggestie.actie === "genereer" && (
              <button
                onClick={handleGenereerLinkedin}
                disabled={genereerLinkedin.isPending}
                className="px-3 py-1.5 bg-autronis-accent/15 text-autronis-accent rounded-lg text-xs font-semibold hover:bg-autronis-accent/25 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                {genereerLinkedin.isPending ? "Bezig..." : "Genereer nu"}
              </button>
            )}
            {topSuggestie.href && (
              <Link href={topSuggestie.href} className="px-3 py-1.5 bg-autronis-accent/15 text-autronis-accent rounded-lg text-xs font-semibold hover:bg-autronis-accent/25 transition-colors flex-shrink-0">
                Bekijken
              </Link>
            )}
          </motion.div>
        )}

        {/* KPI cards + snelle acties rij */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Posts deze week",
              value: stats.postsDezeWeek,
              delta: postsDelta,
              icon: Newspaper,
              kleur: "text-blue-400",
              bg: "kpi-gradient-facturen",
            },
            {
              label: "Video's deze maand",
              value: stats.videossDezeMaand,
              delta: null,
              icon: Video,
              kleur: "text-purple-400",
              bg: "kpi-gradient-projecten",
            },
            {
              label: "Banners gemaakt",
              value: stats.bannersKlaar,
              delta: null,
              icon: ImageIcon,
              kleur: "text-pink-400",
              bg: "kpi-gradient-deadlines",
            },
            {
              label: "Inzichten opgeslagen",
              value: stats.inzichten,
              delta: null,
              icon: BookOpen,
              kleur: "text-emerald-400",
              bg: "kpi-gradient-betaald",
            },
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
              <div className="flex items-end gap-2">
                <p className={cn("text-2xl font-bold tabular-nums", kpi.kleur)}>
                  <AnimatedNumber value={kpi.value} />
                </p>
                {kpi.delta !== null && kpi.delta !== 0 && (
                  <span className={cn("text-xs font-semibold mb-0.5 tabular-nums", kpi.delta > 0 ? "text-emerald-400" : "text-red-400")}>
                    {kpi.delta > 0 ? "+" : ""}{kpi.delta} vs vorige week
                  </span>
                )}
              </div>
              {kpi.value === 0 && kpi.label.includes("Video") && (
                <p className="text-[10px] text-autronis-text-secondary/60 mt-1">Start met je eerste video</p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Snelle acties — direct na KPIs */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenereerLinkedin}
            disabled={genereerLinkedin.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {genereerLinkedin.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Newspaper className="w-4 h-4" />}
            Genereer LinkedIn post
          </button>
          <button
            onClick={handleGenereerStorytelling}
            disabled={genereerStorytelling.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {genereerStorytelling.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
            {genereerStorytelling.isPending ? "Bezig..." : "Storytelling post"}
          </button>
          <Link href="/content/banners?nieuw=1" className="inline-flex items-center gap-2 px-4 py-2.5 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 rounded-xl text-sm font-medium transition-colors">
            <ImageIcon className="w-4 h-4" />
            Maak banner
          </Link>
          <button
            onClick={() => setWeekBriefOpen(true)}
            disabled={genereerWeek.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {genereerWeek.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
            {genereerWeek.isPending ? "Bezig..." : "Plan content week"}
          </button>
          {moreSuggesties.map((s, i) => (
            s.href ? (
              <Link key={i} href={s.href} className="inline-flex items-center gap-2 px-4 py-2.5 bg-autronis-bg border border-autronis-border hover:border-autronis-accent/40 text-autronis-text-secondary hover:text-autronis-text-primary rounded-xl text-sm font-medium transition-colors">
                <Lightbulb className="w-3.5 h-3.5" />
                {s.tekst.length > 50 ? s.tekst.slice(0, 47) + "..." : s.tekst}
              </Link>
            ) : null
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

          {alleKalenderLeeg ? (
            <div className="flex items-center justify-between py-6 px-4 bg-autronis-bg/50 rounded-xl border border-autronis-border/50">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-autronis-text-secondary/40" />
                <div>
                  <p className="text-sm text-autronis-text-primary font-medium">Geen content gepland deze week</p>
                  <p className="text-xs text-autronis-text-secondary mt-0.5">Plan je eerste posts of laat Claude een week vullen</p>
                </div>
              </div>
              <button
                onClick={() => setWeekBriefOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Plan content week
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {kalenderDagen.map((dag, i) => {
                const isVandaag = i === 0;
                return (
                  <motion.div
                    key={dag.label}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="text-center"
                  >
                    <p className={cn("text-[11px] mb-2 font-medium", isVandaag ? "text-autronis-accent" : "text-autronis-text-secondary")}>{dag.label}</p>
                    <Link href="/content/kalender">
                      <div className={cn(
                        "min-h-[60px] rounded-xl border p-2 transition-all hover:scale-[1.02] relative group",
                        dag.posts.length > 0
                          ? "border-autronis-accent/30 bg-autronis-accent/5"
                          : "border-autronis-border bg-autronis-bg/50 hover:border-autronis-accent/20",
                        isVandaag && dag.posts.length === 0 && "ring-1 ring-autronis-accent/20"
                      )}>
                        {dag.posts.length > 0 ? (
                          <div className="space-y-1">
                            {dag.posts.slice(0, 2).map((post) => {
                              const pl = PLATFORM_COLORS[post.platform ?? "linkedin"] ?? PLATFORM_COLORS.linkedin;
                              return (
                                <div key={post.id} className="flex items-center gap-1">
                                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", post.platform === "linkedin" ? "bg-blue-400" : "bg-pink-400")} />
                                  <p className={cn("text-[10px] truncate font-medium", pl.text)}>{post.titel}</p>
                                </div>
                              );
                            })}
                            {dag.posts.length > 2 && <p className="text-[10px] text-autronis-text-secondary">+{dag.posts.length - 2}</p>}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Plus className="w-3.5 h-3.5 text-autronis-text-secondary/20 group-hover:text-autronis-accent/50 transition-colors" />
                          </div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modules — compacte horizontale rij */}
        <div className="grid grid-cols-5 gap-3">
          {modules.map((mod, i) => (
            <motion.div
              key={mod.href}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.04 }}
            >
              <Link href={mod.href} className="group flex items-center gap-3 bg-autronis-card border border-autronis-border rounded-xl p-3.5 card-glow hover:border-autronis-accent/40 transition-all">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", mod.bg)}>
                  <mod.icon className={cn("w-4 h-4", mod.kleur)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors truncate">{mod.label}</p>
                  <p className="text-[10px] text-autronis-text-secondary tabular-nums">
                    <span className="font-medium text-autronis-text-primary">{mod.count}</span> {mod.sub}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-autronis-text-secondary/30 group-hover:text-autronis-accent transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Pipeline */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide">Pipeline</h2>
            <div className="relative flex gap-1 bg-autronis-card border border-autronis-border rounded-lg p-1">
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
                    "relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors z-10",
                    pipelineFilter === f.key ? "text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary"
                  )}
                >
                  {pipelineFilter === f.key && (
                    <motion.div layoutId="pipeline-filter-bg" className="absolute inset-0 bg-autronis-accent rounded-md" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                  )}
                  <span className="relative">{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Kanban columns — adaptive width */}
          <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
            {KOLOM_CONFIG.map((kolom) => {
              const items = pipelineItems.filter((i) => i.kolom === kolom.key);
              const isDragOver = dragOverKolom === kolom.key;
              return (
                <div
                  key={kolom.key}
                  className={cn(
                    "border rounded-2xl p-4 min-h-[200px] transition-all flex-shrink-0 w-72 md:w-auto",
                    kolom.tint,
                    isDragOver && "ring-2 ring-autronis-accent/40 bg-autronis-accent/5"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOverKolom(kolom.key); }}
                  onDragLeave={() => setDragOverKolom(null)}
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

                  {isDragOver && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center py-3 mb-2 border-2 border-dashed border-autronis-accent/40 rounded-xl text-xs text-autronis-accent font-medium"
                    >
                      Sleep hier
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    {items.map((item, idx) => {
                      const pl = item.platform ? (PLATFORM_COLORS[item.platform] ?? null) : null;
                      const kolomIdx = KOLOM_CONFIG.findIndex((k) => k.key === item.kolom);
                      const nextLabel = KOLOM_CONFIG[kolomIdx]?.nextLabel;
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          draggable
                          onDragStart={() => handleDragStart(item.id)}
                          className="bg-autronis-card border border-autronis-border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-autronis-accent/30 transition-colors group"
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="w-3.5 h-3.5 text-autronis-text-secondary/20 group-hover:text-autronis-text-secondary/50 mt-0.5 shrink-0" />
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
                                {item.datum && <span className="text-[10px] text-autronis-text-secondary">{formatDatum(item.datum)}</span>}
                              </div>
                            </div>
                            {/* Quick move button */}
                            {nextLabel && item.type === "post" && (
                              <button
                                onClick={() => handleQuickMove(item)}
                                className="p-1 text-autronis-text-secondary/30 hover:text-autronis-accent rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                title={nextLabel}
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {/* Open link */}
                          <Link
                            href={item.type === "post" ? `/content/posts` : item.type === "video" ? `/content/videos` : `/content/banners`}
                            className="flex items-center gap-1 text-[10px] text-autronis-text-secondary/40 hover:text-autronis-accent mt-1.5 ml-5.5 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <ExternalLink className="w-2.5 h-2.5" /> Openen
                          </Link>
                        </motion.div>
                      );
                    })}
                    {items.length === 0 && !isDragOver && (
                      <p className="text-xs text-autronis-text-secondary/40 text-center py-8">Geen items</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
                <button onClick={() => setWeekBriefOpen(false)} className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
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
    </PageTransition>
  );
}
