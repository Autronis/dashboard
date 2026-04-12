"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  CalendarDays,
  Clock,
  Linkedin,
  Instagram,
  X,
  Plus,
  Send,
} from "lucide-react";
import { useContentPosts, useContentVideos, useSchedulePost, usePublishPost } from "@/hooks/queries/use-content";
import { useToast } from "@/hooks/use-toast";
import type { ContentPost, ContentPlatform, ContentStatus } from "@/types/content";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";

// ---- helpers ----

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function formatDayHeader(d: Date): { dayName: string; dayDate: string } {
  return {
    dayName: d.toLocaleDateString("nl-NL", { weekday: "short" }).replace(".", ""),
    dayDate: d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
  };
}

const DAY_NAMES = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

const STATUS_LABELS: Record<ContentStatus, string> = {
  concept: "Concept",
  goedgekeurd: "Goedgekeurd",
  bewerkt: "Bewerkt",
  afgewezen: "Afgewezen",
  gepubliceerd: "Gepubliceerd",
};

const STATUS_COLORS: Record<ContentStatus, string> = {
  concept: "bg-gray-500/20 text-gray-400",
  goedgekeurd: "bg-emerald-500/20 text-emerald-400",
  bewerkt: "bg-blue-500/20 text-blue-400",
  afgewezen: "bg-red-500/20 text-red-400",
  gepubliceerd: "bg-autronis-accent/20 text-autronis-accent",
};

const OPTIMAL_TIMES: Record<ContentPlatform, string[]> = {
  linkedin: ["08:00", "12:00", "17:00"],
  instagram: ["09:00", "12:00", "18:00"],
};

// ---- sub-components ----

function PlatformDot({ platform }: { platform: ContentPlatform }) {
  if (platform === "linkedin") {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-blue-500 flex-shrink-0 inline-block" />
    );
  }
  return (
    <span className="w-3.5 h-3.5 rounded-full bg-pink-500 flex-shrink-0 inline-block" />
  );
}

function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", STATUS_COLORS[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

interface PostCardProps {
  post: ContentPost;
  hasVideo: boolean;
  onClick: () => void;
  onPublish?: (id: number) => void;
  isPublishing?: boolean;
  isPast?: boolean;
}

function PostCard({ post, hasVideo, onClick, onPublish, isPublishing, isPast }: PostCardProps) {
  return (
    <div className="space-y-1">
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left bg-autronis-bg border rounded-lg p-2 hover:border-autronis-accent/50 transition-all group space-y-1",
          isPast && post.status !== "gepubliceerd"
            ? "border-amber-500/40"
            : "border-autronis-border"
        )}
      >
        <div className="flex items-center gap-1.5">
          <PlatformDot platform={post.platform} />
          <span className="text-xs font-medium text-autronis-text-primary truncate flex-1">
            {post.titel}
          </span>
          {hasVideo && (
            <Camera className="w-3 h-3 text-autronis-text-secondary flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          {post.geplandOp && (
            <span className="text-[10px] text-autronis-text-secondary flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {formatTime(post.geplandOp)}
            </span>
          )}
          <StatusBadge status={post.status} />
        </div>
      </button>
      {isPast && post.status !== "gepubliceerd" && onPublish && (
        <button
          onClick={() => onPublish(post.id)}
          disabled={isPublishing}
          className="w-full flex items-center justify-center gap-1 py-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <Send className="w-2.5 h-2.5" />
          {isPublishing ? "..." : "Publiceer nu"}
        </button>
      )}
    </div>
  );
}

interface PostDetailModalProps {
  post: ContentPost;
  hasVideo: boolean;
  onClose: () => void;
  onPublish: (id: number) => void;
  isPublishing: boolean;
}

function PostDetailModal({ post, hasVideo, onClose, onPublish, isPublishing }: PostDetailModalProps) {
  const content = post.bewerkteInhoud ?? post.inhoud;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-autronis-card border border-autronis-border rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-start justify-between p-5 border-b border-autronis-border">
          <div className="flex items-center gap-2">
            <PlatformDot platform={post.platform} />
            <h2 className="text-base font-semibold text-autronis-text-primary">{post.titel}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <StatusBadge status={post.status} />
            {post.geplandOp && (
              <span className="text-xs text-autronis-text-secondary bg-autronis-bg px-2 py-1 rounded-full border border-autronis-border flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(post.geplandOp).toLocaleString("nl-NL", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            {hasVideo && (
              <span className="text-xs text-autronis-text-secondary bg-autronis-bg px-2 py-1 rounded-full border border-autronis-border flex items-center gap-1">
                <Camera className="w-3 h-3" />
                Video beschikbaar
              </span>
            )}
          </div>

          <div className="bg-autronis-bg rounded-xl p-4 border border-autronis-border">
            <p className="text-sm text-autronis-text-primary whitespace-pre-wrap leading-relaxed">
              {content}
            </p>
          </div>

          {post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-autronis-accent bg-autronis-accent/10 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {post.status !== "gepubliceerd" && (
            <button
              onClick={() => onPublish(post.id)}
              disabled={isPublishing}
              className="w-full py-2.5 bg-autronis-accent text-autronis-bg font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPublishing ? "Bezig..." : "Markeer als gepubliceerd"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- schedule picker ----

interface SchedulePickerProps {
  post: ContentPost;
  onSchedule: (id: number, geplandOp: string) => void;
  isScheduling: boolean;
}

function SchedulePicker({ post, onSchedule, isScheduling }: SchedulePickerProps) {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-center gap-2">
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs bg-autronis-bg border border-autronis-border rounded-lg px-2 py-1.5 text-autronis-text-primary focus:outline-none focus:border-autronis-accent/60"
      />
      <button
        onClick={() => {
          if (value) onSchedule(post.id, new Date(value).toISOString());
        }}
        disabled={!value || isScheduling}
        className="text-xs px-3 py-1.5 bg-autronis-accent text-autronis-bg font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
      >
        {isScheduling ? "..." : "Inplannen"}
      </button>
    </div>
  );
}

// ---- stat card ----

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-autronis-card border border-autronis-border rounded-xl px-4 py-3 flex items-center gap-3 card-glow">
      <div className="text-autronis-accent">{icon}</div>
      <div>
        <div className="text-xl font-bold text-autronis-text-primary leading-none">{value}</div>
        <div className="text-xs text-autronis-text-secondary mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ---- main page ----

export default function ContentKalenderPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const [schedulingPostId, setSchedulingPostId] = useState<number | null>(null);

  const { data: posts = [] } = useContentPosts();
  const { data: videos = [] } = useContentVideos();
  const { addToast } = useToast();
  const schedulePost = useSchedulePost();
  const publishPost = usePublishPost();

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekEnd = addDays(weekStart, 6);

  const videoPostIds = useMemo(
    () => new Set(videos.filter((v) => v.postId !== null).map((v) => v.postId as number)),
    [videos]
  );

  const scheduledThisWeek = useMemo(
    () =>
      posts.filter((p) => {
        if (!p.geplandOp) return false;
        const d = new Date(p.geplandOp);
        return d >= weekStart && d <= addDays(weekEnd, 1);
      }),
    [posts, weekStart, weekEnd]
  );

  const unscheduled = useMemo(
    () =>
      posts.filter(
        (p) => !p.geplandOp && (p.status === "goedgekeurd" || p.status === "bewerkt")
      ),
    [posts]
  );

  const stats = useMemo(() => {
    const published = scheduledThisWeek.filter((p) => p.status === "gepubliceerd").length;
    const planned = scheduledThisWeek.filter((p) => p.status !== "gepubliceerd").length;
    const linkedin = scheduledThisWeek.filter((p) => p.platform === "linkedin").length;
    const instagram = scheduledThisWeek.filter((p) => p.platform === "instagram").length;
    return { total: scheduledThisWeek.length, published, planned, linkedin, instagram };
  }, [scheduledThisWeek]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Past 8 weeks heatmap data
  const heatmapDays = useMemo(() => {
    const days: { date: Date; count: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      for (let d = 0; d < 7; d++) {
        const date = addDays(addDays(today, -(w * 7)), d);
        const dateStr = date.toISOString().split("T")[0];
        const count = posts.filter((p) => p.geplandOp?.startsWith(dateStr) && p.status === "gepubliceerd").length;
        days.push({ date, count });
      }
    }
    return days;
  }, [posts, today]);

  function postsForDay(day: Date): ContentPost[] {
    return scheduledThisWeek.filter(
      (p) => p.geplandOp && isSameDay(new Date(p.geplandOp), day)
    );
  }

  function handleSchedule(id: number, geplandOp: string) {
    setSchedulingPostId(id);
    schedulePost.mutate(
      { id, geplandOp },
      {
        onSuccess: () => {
          addToast("Post ingepland", "succes");
          setSchedulingPostId(null);
        },
        onError: (err) => {
          addToast(err.message, "fout");
          setSchedulingPostId(null);
        },
      }
    );
  }

  function handlePublish(id: number) {
    publishPost.mutate(id, {
      onSuccess: () => {
        addToast("Post gemarkeerd als gepubliceerd", "succes");
        setSelectedPost(null);
      },
      onError: (err) => {
        addToast(err.message, "fout");
      },
    });
  }

  const weekLabel = `${weekStart.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })} – ${weekEnd.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <PageTransition>
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">Content Kalender</h1>
          <p className="text-autronis-text-secondary mt-1">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="p-2 rounded-lg border border-autronis-border hover:bg-autronis-border text-autronis-text-secondary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="px-3 py-2 rounded-lg border border-autronis-border hover:bg-autronis-border text-autronis-text-secondary text-sm font-medium transition-colors"
          >
            Deze week
          </button>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="p-2 rounded-lg border border-autronis-border hover:bg-autronis-border text-autronis-text-secondary transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <StatCard
          label="Posts deze week"
          value={stats.total}
          icon={<CalendarDays className="w-4 h-4" />}
        />
        <StatCard
          label="Gepubliceerd"
          value={stats.published}
          icon={<span className="text-sm font-bold">✓</span>}
        />
        <StatCard
          label="Ingepland"
          value={stats.planned}
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label="LinkedIn"
          value={stats.linkedin}
          icon={<Linkedin className="w-4 h-4" />}
        />
        <StatCard
          label="Instagram"
          value={stats.instagram}
          icon={<Instagram className="w-4 h-4" />}
        />
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, i) => {
          const { dayName, dayDate } = formatDayHeader(day);
          const isToday = isSameDay(day, today);
          const dayPosts = postsForDay(day);

          return (
            <div
              key={i}
              className={cn(
                "bg-autronis-card border rounded-xl flex flex-col min-h-[220px]",
                isToday ? "border-autronis-accent/60" : "border-autronis-border"
              )}
            >
              {/* Day header */}
              <div
                className={cn(
                  "px-3 py-2 border-b text-center",
                  isToday ? "border-autronis-accent/30" : "border-autronis-border"
                )}
              >
                <div
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    isToday ? "text-autronis-accent" : "text-autronis-text-secondary"
                  )}
                >
                  {dayName}
                </div>
                <div
                  className={cn(
                    "text-sm font-bold mt-0.5",
                    isToday ? "text-autronis-accent" : "text-autronis-text-primary"
                  )}
                >
                  {dayDate}
                </div>
              </div>

              {/* Optimal times hints */}
              <div className="px-2 pt-2 space-y-0.5">
                {["08:00", "09:00", "12:00", "17:00", "18:00"].map((time) => {
                  const isLinkedIn = OPTIMAL_TIMES.linkedin.includes(time);
                  const isInstagram = OPTIMAL_TIMES.instagram.includes(time);
                  if (!isLinkedIn && !isInstagram) return null;
                  return (
                    <div key={time} className="flex items-center gap-1 opacity-30">
                      <span className="text-[9px] text-autronis-text-secondary tabular-nums w-7">{time}</span>
                      {isLinkedIn && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      {isInstagram && <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />}
                    </div>
                  );
                })}
              </div>

              {/* Posts */}
              <div className="flex-1 p-2 pt-1 space-y-1.5 overflow-y-auto">
                {dayPosts.map((post) => {
                  const isPast = post.geplandOp ? new Date(post.geplandOp) < today : false;
                  return (
                    <PostCard
                      key={post.id}
                      post={post}
                      hasVideo={videoPostIds.has(post.id)}
                      onClick={() => setSelectedPost(post)}
                      onPublish={handlePublish}
                      isPublishing={publishPost.isPending}
                      isPast={isPast}
                    />
                  );
                })}
                {dayPosts.length === 0 && !isToday && (
                  <button
                    onClick={() => {
                      const slot = unscheduled[0];
                      if (slot) setSelectedPost(slot);
                    }}
                    className="w-full h-10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-autronis-text-secondary/50 hover:text-autronis-accent hover:bg-autronis-accent/5 rounded-lg border border-dashed border-transparent hover:border-autronis-accent/20"
                    title="Inplannen op deze dag"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Week heatmap */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-3">Publicatie heatmap — 8 weken</h2>
        <div className="flex gap-1 flex-wrap">
          {heatmapDays.map((day, i) => (
            <div
              key={i}
              title={`${day.date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}: ${day.count} gepubliceerd`}
              className={cn(
                "w-4 h-4 rounded-sm transition-colors",
                day.count === 0 ? "bg-autronis-border/50" :
                day.count === 1 ? "bg-autronis-accent/30" :
                day.count === 2 ? "bg-autronis-accent/60" :
                "bg-autronis-accent"
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-autronis-text-secondary">Minder</span>
          {["bg-autronis-border/50", "bg-autronis-accent/30", "bg-autronis-accent/60", "bg-autronis-accent"].map((c, i) => (
            <div key={i} className={cn("w-3 h-3 rounded-sm", c)} />
          ))}
          <span className="text-[10px] text-autronis-text-secondary">Meer</span>
        </div>
      </div>

      {/* Unscheduled */}
      {unscheduled.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-autronis-text-secondary" />
            Niet ingepland
            <span className="text-sm font-normal text-autronis-text-secondary">
              ({unscheduled.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unscheduled.map((post) => (
              <div
                key={post.id}
                className="bg-autronis-card border border-autronis-border rounded-xl p-4 space-y-3 card-glow"
              >
                <div className="flex items-start gap-2">
                  <PlatformDot platform={post.platform} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-autronis-text-primary truncate">{post.titel}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={post.status} />
                      {videoPostIds.has(post.id) && (
                        <Camera className="w-3 h-3 text-autronis-text-secondary" />
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPost(post)}
                    className="text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors underline flex-shrink-0"
                  >
                    Bekijk
                  </button>
                </div>
                <SchedulePicker
                  post={post}
                  onSchedule={handleSchedule}
                  isScheduling={schedulingPostId === post.id}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          hasVideo={videoPostIds.has(selectedPost.id)}
          onClose={() => setSelectedPost(null)}
          onPublish={handlePublish}
          isPublishing={publishPost.isPending}
        />
      )}
    </div>
    </PageTransition>
  );
}
