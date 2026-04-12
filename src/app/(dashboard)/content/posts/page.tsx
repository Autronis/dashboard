"use client";

import { useState } from "react";
import {
  Loader2,
  Sparkles,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Trash2,
  CheckSquare,
  Square,
  XCircle,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useContentPosts, useGenerateBatch, useUpdatePost, useDeletePost } from "@/hooks/queries/use-content";
import { useToast } from "@/hooks/use-toast";
import { Modal } from "@/components/ui/modal";
import type { ContentPost, ContentStatus, ContentPlatform, ContentFormat } from "@/types/content";
import { PageTransition } from "@/components/ui/page-transition";

const CHAR_LIMIT: Record<ContentPlatform, number> = {
  linkedin: 3000,
  instagram: 2200,
};

// ============ BADGE HELPERS ============

const STATUS_BADGE: Record<ContentStatus, { label: string; className: string }> = {
  concept: { label: "Concept", className: "bg-gray-500/15 text-gray-400" },
  goedgekeurd: { label: "Goedgekeurd", className: "bg-emerald-500/15 text-emerald-400" },
  bewerkt: { label: "Bewerkt", className: "bg-blue-500/15 text-blue-400" },
  afgewezen: { label: "Afgewezen", className: "bg-red-500/15 text-red-400" },
  gepubliceerd: { label: "Gepubliceerd", className: "bg-purple-500/15 text-purple-400" },
};

const FORMAT_BADGE: Record<ContentFormat, { label: string; className: string }> = {
  post: { label: "Post", className: "bg-slate-500/15 text-slate-400" },
  caption: { label: "Caption", className: "bg-pink-500/15 text-pink-400" },
  thought_leadership: { label: "Thought leadership", className: "bg-indigo-500/15 text-indigo-400" },
  tip: { label: "Tip", className: "bg-autronis-accent/15 text-autronis-accent" },
  storytelling: { label: "Storytelling", className: "bg-orange-500/15 text-orange-400" },
  how_to: { label: "How-to", className: "bg-teal-500/15 text-teal-400" },
  vraag: { label: "Vraag", className: "bg-yellow-500/15 text-yellow-400" },
};

// ============ PLATFORM BADGE ============

function PlatformBadge({ platform }: { platform: ContentPlatform }) {
  if (platform === "linkedin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#0a66c2]/15 text-[#0a66c2]">
        LinkedIn
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gradient-to-r from-pink-500/15 to-purple-500/15 text-pink-400">
      Instagram
    </span>
  );
}

// ============ REJECTION MODAL ============

interface AfwijsModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reden: string) => void;
  loading: boolean;
}

function AfwijsModal({ open, onClose, onConfirm, loading }: AfwijsModalProps) {
  const [reden, setReden] = useState("");

  return (
    <Modal open={open} onClose={onClose} titel="Post afwijzen" breedte="sm">
      <div className="space-y-4">
        <p className="text-sm text-autronis-text-secondary">
          Optioneel: geef een reden voor het afwijzen van deze post.
        </p>
        <textarea
          value={reden}
          onChange={(e) => setReden(e.target.value)}
          placeholder="Bijv. toon klopt niet, onderwerp niet relevant..."
          rows={3}
          className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary resize-none focus:outline-none focus:border-autronis-accent"
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={() => {
              onConfirm(reden);
              setReden("");
            }}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
          >
            {loading ? "Afwijzen..." : "Afwijzen"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============ POST CARD ============

interface PostCardProps {
  post: ContentPost;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  selectMode?: boolean;
}

function PostCard({ post, selected, onToggleSelect, selectMode }: PostCardProps) {
  const { addToast } = useToast();
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();

  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(post.bewerkteInhoud ?? post.inhoud);
  const [copied, setCopied] = useState(false);
  const [afwijsOpen, setAfwijsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const activeInhoud = post.bewerkteInhoud ?? post.inhoud;
  const preview = activeInhoud.length > 200 ? activeInhoud.slice(0, 200) + "..." : activeInhoud;
  const charLimit = CHAR_LIMIT[post.platform];
  const charCount = editText.length;
  const charOver = charCount > charLimit;

  const statusBadge = STATUS_BADGE[post.status];
  const formatBadge = FORMAT_BADGE[post.format] ?? { label: post.format, className: "bg-gray-500/15 text-gray-400" };

  async function handleGoedkeuren() {
    await updatePost.mutateAsync({ id: post.id, status: "goedgekeurd" });
    addToast("Post goedgekeurd", "succes");
  }

  async function handleSaveEdit() {
    await updatePost.mutateAsync({ id: post.id, bewerkteInhoud: editText });
    setEditMode(false);
    addToast("Post opgeslagen", "succes");
  }

  async function handleAfwijzen(reden: string) {
    await updatePost.mutateAsync({ id: post.id, afwijsReden: reden || undefined, status: "afgewezen" });
    setAfwijsOpen(false);
    addToast("Post afgewezen", "info");
  }

  async function handleDelete() {
    await deletePost.mutateAsync(post.id);
    addToast("Post verwijderd", "succes");
  }

  async function handleCopy() {
    const tekst = post.bewerkteInhoud ?? post.inhoud;
    const withHashtags = post.hashtags.length > 0
      ? `${tekst}\n\n${post.hashtags.join(" ")}`
      : tekst;
    await navigator.clipboard.writeText(withHashtags);
    setCopied(true);
    const platformLabel = post.platform === "linkedin" ? "LinkedIn" : "Instagram";
    addToast(`Gekopieerd voor ${platformLabel}`, "succes");
    setTimeout(() => setCopied(false), 2000);
  }

  const isBusy = updatePost.isPending || deletePost.isPending;

  return (
    <>
      <div
        className={cn(
          "bg-autronis-card border rounded-2xl p-5 flex flex-col gap-4 card-glow transition-all",
          selected ? "border-autronis-accent/50 ring-1 ring-autronis-accent/20" : "border-autronis-border hover:border-autronis-border/80",
          selectMode && "cursor-pointer"
        )}
        onClick={selectMode && onToggleSelect ? () => onToggleSelect(post.id) : undefined}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {selectMode && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleSelect?.(post.id); }}
                className="text-autronis-text-secondary"
              >
                {selected
                  ? <CheckSquare className="w-4 h-4 text-autronis-accent" />
                  : <Square className="w-4 h-4" />
                }
              </button>
            )}
            <PlatformBadge platform={post.platform} />
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${formatBadge.className}`}>
              {formatBadge.label}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          </div>
          {!selectMode && (
            <button
              onClick={handleDelete}
              disabled={isBusy}
              className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 flex-shrink-0"
              title="Verwijderen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-autronis-text-primary">{post.titel}</h3>

        {/* Rejection reason */}
        {post.status === "afgewezen" && post.afwijsReden && (
          <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/15 rounded-xl px-3 py-2">
            <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300/80">{post.afwijsReden}</p>
          </div>
        )}

        {/* Content */}
        {editMode ? (
          <div className="space-y-1.5">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={8}
              className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-3 py-2 text-sm text-autronis-text-primary resize-none focus:outline-none focus:border-autronis-accent"
            />
            <div className={cn("text-right text-xs tabular-nums", charOver ? "text-red-400" : "text-autronis-text-secondary")}>
              {charCount.toLocaleString("nl-NL")} / {charLimit.toLocaleString("nl-NL")}
              {charOver && <span className="ml-1 font-semibold">({charCount - charLimit} te lang)</span>}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="text-left w-full group"
          >
            <p className="text-sm text-autronis-text-secondary leading-relaxed whitespace-pre-line group-hover:text-autronis-text-primary transition-colors">
              {preview}
            </p>
            {activeInhoud.length > 200 && (
              <span className="inline-flex items-center gap-1 text-xs text-autronis-accent mt-1.5 group-hover:underline">
                <Eye className="w-3 h-3" />
                Lees meer
              </span>
            )}
          </button>
        )}

        {/* Hashtags */}
        {post.hashtags.length > 0 && !editMode && (
          <div className="flex flex-wrap gap-1.5">
            {post.hashtags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-autronis-accent/10 text-autronis-accent rounded-full px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        {!selectMode && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-autronis-border">
            {editMode ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={isBusy || charOver}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-autronis-accent text-white hover:bg-autronis-accent/90 transition-colors disabled:opacity-50"
                >
                  {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Opslaan
                </button>
                <button
                  onClick={() => { setEditMode(false); setEditText(post.bewerkteInhoud ?? post.inhoud); }}
                  disabled={isBusy}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                >
                  Annuleren
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleGoedkeuren}
                  disabled={isBusy || post.status === "goedgekeurd"}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Goedkeuren
                </button>
                <button
                  onClick={() => setEditMode(true)}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Bewerken
                </button>
                <button
                  onClick={() => setAfwijsOpen(true)}
                  disabled={isBusy || post.status === "afgewezen"}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  Afwijzen
                </button>
                <button
                  onClick={handleCopy}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors disabled:opacity-50 ml-auto"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied
                    ? `Gekopieerd voor ${post.platform === "linkedin" ? "LinkedIn" : "Instagram"}`
                    : "Kopieer"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <AfwijsModal
        open={afwijsOpen}
        onClose={() => setAfwijsOpen(false)}
        onConfirm={handleAfwijzen}
        loading={updatePost.isPending}
      />

      {/* Preview modal */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} titel={post.titel} breedte="lg">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <PlatformBadge platform={post.platform} />
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${formatBadge.className}`}>
              {formatBadge.label}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          </div>
          <p className="text-sm text-autronis-text-primary leading-relaxed whitespace-pre-line">
            {activeInhoud}
          </p>
          {post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-autronis-border">
              {post.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-autronis-accent/10 text-autronis-accent rounded-full px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 pt-2 border-t border-autronis-border">
            <button
              onClick={() => { handleCopy(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Gekopieerd" : "Kopieer"}
            </button>
            <button
              onClick={() => { setPreviewOpen(false); setEditMode(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Bewerken
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ============ PAGE ============

const STATUS_OPTIONS: { value: ContentStatus | "alle"; label: string }[] = [
  { value: "alle", label: "Alle statussen" },
  { value: "concept", label: "Concept" },
  { value: "goedgekeurd", label: "Goedgekeurd" },
  { value: "bewerkt", label: "Bewerkt" },
  { value: "afgewezen", label: "Afgewezen" },
  { value: "gepubliceerd", label: "Gepubliceerd" },
];

const PLATFORM_OPTIONS: { value: ContentPlatform | "alle"; label: string }[] = [
  { value: "alle", label: "Alle platforms" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
];

type TabType = "posts" | "afgewezen";

export default function ContentPostsPage() {
  const { addToast } = useToast();
  const generateBatch = useGenerateBatch();
  const updatePost = useUpdatePost();

  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "alle">("alle");
  const [platformFilter, setPlatformFilter] = useState<ContentPlatform | "alle">("alle");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const { data: allPostsRaw = [], isLoading } = useContentPosts();
  const afgewezenPosts = allPostsRaw.filter((p) => p.status === "afgewezen");

  const activePosts = allPostsRaw.filter((p) => {
    if (p.status === "afgewezen") return false;
    if (statusFilter !== "alle" && p.status !== statusFilter) return false;
    if (platformFilter !== "alle" && p.platform !== platformFilter) return false;
    return true;
  });

  const currentBatchWeek = allPostsRaw[0]?.batchWeek;

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkGoedkeuren() {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((id) => updatePost.mutateAsync({ id, status: "goedgekeurd" })));
    setSelectedIds(new Set());
    setSelectMode(false);
    addToast(`${ids.length} posts goedgekeurd`, "succes");
  }

  async function handleGenereer() {
    try {
      const result = await generateBatch.mutateAsync({});
      addToast(`${result.posts.length} posts gegenereerd`, "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Genereren mislukt", "fout");
    }
  }

  return (
    <PageTransition>
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">Content Posts</h1>
          <p className="text-autronis-text-secondary mt-1">
            AI-gegenereerde LinkedIn en Instagram posts beheren en publiceren.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <button
                onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleBulkGoedkeuren}
                disabled={selectedIds.size === 0 || updatePost.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-60 btn-press"
              >
                {updatePost.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                {selectedIds.size > 0 ? `Goedkeuren (${selectedIds.size})` : "Selecteer posts"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectMode(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary rounded-xl text-sm font-medium transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
                Bulk goedkeuren
              </button>
              <button
                onClick={handleGenereer}
                disabled={generateBatch.isPending}
                className="btn-shimmer flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-autronis-bg font-semibold rounded-xl hover:bg-autronis-accent-hover transition-colors disabled:opacity-60 whitespace-nowrap btn-press"
              >
                {generateBatch.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {generateBatch.isPending ? "Claude schrijft..." : "Genereer batch"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-autronis-bg rounded-xl p-1 border border-autronis-border w-fit">
        <button
          onClick={() => setActiveTab("posts")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === "posts" ? "bg-autronis-card text-autronis-text-primary" : "text-autronis-text-secondary hover:text-autronis-text-primary"
          )}
        >
          Posts
          <span className="ml-1.5 text-xs text-autronis-text-secondary tabular-nums">({activePosts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("afgewezen")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === "afgewezen" ? "bg-autronis-card text-autronis-text-primary" : "text-autronis-text-secondary hover:text-autronis-text-primary"
          )}
        >
          Afgewezen
          {afgewezenPosts.length > 0 && (
            <span className="ml-1.5 text-xs bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full tabular-nums">{afgewezenPosts.length}</span>
          )}
        </button>
      </div>

      {activeTab === "posts" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ContentStatus | "alle")}
              className="bg-autronis-card border border-autronis-border rounded-xl px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
            >
              {STATUS_OPTIONS.filter((o) => o.value !== "afgewezen").map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value as ContentPlatform | "alle")}
              className="bg-autronis-card border border-autronis-border rounded-xl px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
            >
              {PLATFORM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {currentBatchWeek && (
              <span className="text-xs text-autronis-text-secondary ml-auto">
                Batch <span className="font-mono text-autronis-text-primary">{currentBatchWeek}</span>
              </span>
            )}
          </div>

          {/* Generation loading state */}
          {generateBatch.isPending && (
            <div className="bg-autronis-card border border-autronis-accent/40 rounded-2xl p-6 flex items-center gap-4">
              <Loader2 className="w-6 h-6 text-autronis-accent animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-autronis-text-primary">
                  Claude is bezig met het schrijven van content...
                </p>
                <p className="text-xs text-autronis-text-secondary mt-0.5">
                  Dit kan 15-30 seconden duren. Even geduld.
                </p>
              </div>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-autronis-accent animate-spin" />
            </div>
          ) : activePosts.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {activePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  selected={selectedIds.has(post.id)}
                  onToggleSelect={toggleSelect}
                  selectMode={selectMode}
                />
              ))}
            </div>
          ) : !generateBatch.isPending ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Sparkles className="w-12 h-12 text-autronis-accent/40 mb-4" />
              <p className="text-lg font-semibold text-autronis-text-primary">
                Nog geen content gegenereerd.
              </p>
              <p className="text-sm text-autronis-text-secondary mt-1">
                Klik op &lsquo;Genereer batch&rsquo; om te starten.
              </p>
            </div>
          ) : null}
        </>
      )}

      {activeTab === "afgewezen" && (
        afgewezenPosts.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {afgewezenPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <ThumbsDown className="w-10 h-10 text-autronis-text-secondary/30 mb-3" />
            <p className="text-base font-medium text-autronis-text-primary">Geen afgewezen posts</p>
          </div>
        )
      )}
    </div>
    </PageTransition>
  );
}
