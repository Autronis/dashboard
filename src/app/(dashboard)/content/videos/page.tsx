"use client";

import { useState, useEffect } from "react";
import {
  Video, Play, Download, Trash2, ChevronDown, ChevronUp, Loader2,
  Film, Lightbulb, ArrowRightLeft, Wrench, BarChart3, Quote, Briefcase,
  Monitor,
  Sparkles,
  X,
} from "lucide-react";
import {
  useContentVideos, useGenerateVideoScript, useRenderVideo, useDeleteVideo,
  useContentPosts, useVideoTemplates, useGenerateFromTemplate, useRenderVideoWithFormat,
} from "@/hooks/queries/use-content";
import type { VideoTemplateInfo } from "@/hooks/queries/use-content";
import { useToast } from "@/hooks/use-toast";
import type { ContentVideo, VideoStatus, VideoFormaat } from "@/types/content";
import { VIDEO_FORMAAT_LABELS } from "@/types/content";
import { PageTransition } from "@/components/ui/page-transition";

// ============ ICON MAP ============

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  lightbulb: <Lightbulb className="w-6 h-6" />,
  "arrow-right-left": <ArrowRightLeft className="w-6 h-6" />,
  wrench: <Wrench className="w-6 h-6" />,
  "bar-chart-3": <BarChart3 className="w-6 h-6" />,
  quote: <Quote className="w-6 h-6" />,
  briefcase: <Briefcase className="w-6 h-6" />,
};

// ============ STATUS BADGE ============

function StatusBadge({ status }: { status: VideoStatus }) {
  const map: Record<VideoStatus, { label: string; className: string }> = {
    script: { label: "Script", className: "bg-zinc-700 text-zinc-300" },
    rendering: { label: "Renderen...", className: "bg-yellow-500/20 text-yellow-400" },
    klaar: { label: "Klaar", className: "bg-emerald-500/20 text-emerald-400" },
    fout: { label: "Fout", className: "bg-red-500/20 text-red-400" },
  };

  const { label, className } = map[status] ?? map.script;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      {status === "rendering" && <Loader2 className="w-3 h-3 animate-spin" />}
      {label}
    </span>
  );
}

// ============ FORMAT BADGE ============

function FormaatBadge({ formaat }: { formaat?: VideoFormaat | null }) {
  if (!formaat || formaat === "square") return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-autronis-accent/10 text-autronis-accent">
      <Monitor className="w-3 h-3" />
      {VIDEO_FORMAAT_LABELS[formaat]}
    </span>
  );
}

// ============ SCENE BREAKDOWN ============

function SceneBreakdown({ video }: { video: ContentVideo }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
      >
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Script bekijken ({video.script.length} scenes)
      </button>

      {open && (
        <div className="mt-3 space-y-2 pl-2 border-l-2 border-autronis-border">
          {video.script.map((scene, idx) => (
            <div key={idx} className="text-xs space-y-0.5">
              <div className="flex items-center gap-2 text-autronis-text-secondary">
                <span className="font-mono">Scene {idx + 1}</span>
                {scene.icon && <span className="text-autronis-accent">[{scene.icon}]</span>}
                {scene.duur && <span>{scene.duur}s</span>}
                {scene.isCta && (
                  <span className="bg-autronis-accent/20 text-autronis-accent px-1.5 py-0.5 rounded text-xs">CTA</span>
                )}
              </div>
              <div className="space-y-0.5 pl-2">
                {scene.tekst.map((regel, rIdx) => (
                  <div
                    key={rIdx}
                    className={
                      rIdx === scene.accentRegel
                        ? scene.accentKleur === "geel"
                          ? "text-yellow-400 font-semibold"
                          : "text-autronis-accent font-semibold"
                        : "text-autronis-text-secondary"
                    }
                  >
                    {regel}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ VIDEO CARD ============

function VideoCard({ video }: { video: ContentVideo }) {
  const { addToast } = useToast();
  const renderVideo = useRenderVideo();
  const renderWithFormat = useRenderVideoWithFormat();
  const deleteVideo = useDeleteVideo();
  const [selectedFormaat, setSelectedFormaat] = useState<VideoFormaat>("square");

  function handleRender() {
    renderWithFormat.mutate(
      { videoId: video.id, formaat: selectedFormaat },
      {
        onSuccess: () => addToast("Video wordt gerenderd!", "succes"),
        onError: (err) => addToast(err.message, "fout"),
      }
    );
  }

  function handleDelete() {
    deleteVideo.mutate(video.id, {
      onSuccess: () => addToast("Video verwijderd", "info"),
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  const isPending = renderVideo.isPending || renderWithFormat.isPending;
  const displayTitle = video.titel ?? video.postTitel ?? `Video #${video.id}`;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-autronis-text-primary truncate">
            {displayTitle}
          </p>
          <div className="flex items-center gap-2 mt-1 text-sm text-autronis-text-secondary flex-wrap">
            {video.postPlatform && (
              <span className="capitalize">{video.postPlatform}</span>
            )}
            {video.templateId && (
              <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full text-xs font-medium">
                Template
              </span>
            )}
            {video.duurSeconden && (
              <span>· {video.duurSeconden}s</span>
            )}
            <FormaatBadge formaat={video.formaat} />
          </div>
        </div>
        <StatusBadge status={video.status as VideoStatus} />
      </div>

      {video.status === "klaar" && video.videoPath && (
        <video
          src={video.videoPath}
          controls
          className="w-full rounded-xl bg-black aspect-square object-contain"
        />
      )}

      <SceneBreakdown video={video} />

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {(video.status === "script" || video.status === "fout") && (
          <>
            <select
              value={selectedFormaat}
              onChange={(e) => setSelectedFormaat(e.target.value as VideoFormaat)}
              className="bg-autronis-bg border border-autronis-border rounded-lg px-2.5 py-1.5 text-autronis-text-primary text-xs focus:outline-none focus:border-autronis-accent/60"
            >
              {(Object.entries(VIDEO_FORMAAT_LABELS) as [VideoFormaat, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <button
              onClick={handleRender}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-autronis-accent/10 text-autronis-accent border border-autronis-accent/30 rounded-lg text-sm font-medium hover:bg-autronis-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {video.status === "fout" ? "Opnieuw renderen" : "Render video"}
            </button>
          </>
        )}

        {video.status === "klaar" && video.videoPath && (
          <a
            href={video.videoPath}
            download
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        )}

        <button
          onClick={handleDelete}
          disabled={deleteVideo.isPending}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
        >
          <Trash2 className="w-4 h-4" />
          Verwijder
        </button>
      </div>
    </div>
  );
}

// ============ TEMPLATE CARD ============

function TemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: VideoTemplateInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? "bg-autronis-accent/10 border-autronis-accent/50 ring-1 ring-autronis-accent/30"
          : "bg-autronis-bg border-autronis-border hover:border-autronis-accent/30"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isSelected ? "bg-autronis-accent/20 text-autronis-accent" : "bg-autronis-card text-autronis-text-secondary"
        }`}>
          {TEMPLATE_ICONS[template.icon] ?? <Video className="w-6 h-6" />}
        </div>
        <span className={`font-semibold text-sm ${isSelected ? "text-autronis-accent" : "text-autronis-text-primary"}`}>
          {template.naam}
        </span>
      </div>
      <p className="text-xs text-autronis-text-secondary line-clamp-2">
        {template.beschrijving}
      </p>
    </button>
  );
}

// ============ TEMPLATE FORM ============

function TemplateForm({
  template,
  onCancel,
  gallery,
}: {
  template: VideoTemplateInfo;
  onCancel: () => void;
  gallery: { id: number; afbeeldingUrl: string | null; productNaam: string }[];
}) {
  const { addToast } = useToast();
  const generateFromTemplate = useGenerateFromTemplate();
  const [input, setInput] = useState<Record<string, string>>({});
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);

  function handleChange(key: string, value: string) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function handleGenerate() {
    generateFromTemplate.mutate(
      { templateId: template.id, input },
      {
        onSuccess: () => {
          addToast("Video script gegenereerd!", "succes");
          setInput({});
          onCancel();
        },
        onError: (err) => addToast(err.message, "fout"),
      }
    );
  }

  const allRequiredFilled = template.velden
    .filter((v) => v.required)
    .every((v) => input[v.key]?.trim());

  return (
    <div className="space-y-4 mt-4 p-4 bg-autronis-bg rounded-xl border border-autronis-border">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-autronis-text-primary">
          {template.naam}
        </h3>
        <button
          onClick={onCancel}
          className="text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
        >
          Annuleren
        </button>
      </div>

      <div className="space-y-3">
        {template.velden.map((veld) => (
          <div key={veld.key}>
            <label className="block text-sm font-medium text-autronis-text-secondary mb-1">
              {veld.label}
              {veld.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {veld.type === "textarea" ? (
              <textarea
                value={input[veld.key] ?? ""}
                onChange={(e) => handleChange(veld.key, e.target.value)}
                placeholder={veld.placeholder}
                rows={3}
                className="w-full bg-autronis-card border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent/60 resize-none"
              />
            ) : veld.type === "number" ? (
              <input
                type="number"
                value={input[veld.key] ?? ""}
                onChange={(e) => handleChange(veld.key, e.target.value)}
                placeholder={veld.placeholder}
                className="w-full bg-autronis-card border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent/60"
              />
            ) : (
              <input
                type="text"
                value={input[veld.key] ?? ""}
                onChange={(e) => handleChange(veld.key, e.target.value)}
                placeholder={veld.placeholder}
                className="w-full bg-autronis-card border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent/60"
              />
            )}
          </div>
        ))}
      </div>

      {/* Referentie afbeelding */}
      <div>
        <label className="block text-sm font-medium text-autronis-text-secondary mb-1">
          Stijl referentie <span className="text-autronis-text-secondary/50 font-normal">(optioneel — kies een afbeelding als visuele inspiratie)</span>
        </label>
        {refPreview ? (
          <div className="flex items-center gap-3 bg-autronis-card border border-autronis-border rounded-lg px-3 py-2">
            <img src={refPreview} alt="ref" className="w-10 h-10 object-cover rounded" />
            <span className="text-xs text-autronis-text-secondary flex-1">Referentie geselecteerd</span>
            <button onClick={() => setRefPreview(null)} className="text-autronis-text-tertiary hover:text-red-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <button onClick={() => setShowGalleryPicker(v => !v)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-autronis-card border border-dashed border-autronis-border rounded-lg text-sm text-autronis-text-tertiary hover:border-autronis-accent/40 hover:text-autronis-accent transition-all">
              <Film className="w-4 h-4" /> Kies uit galerij
            </button>
            {showGalleryPicker && gallery.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 mt-2">
                {gallery.filter(g => g.afbeeldingUrl).slice(0, 15).map(g => (
                  <button key={g.id} onClick={() => { setRefPreview(g.afbeeldingUrl); setShowGalleryPicker(false); }}
                    className="shrink-0 w-14 h-14 rounded-lg border border-autronis-border hover:border-autronis-accent overflow-hidden transition-all">
                    <img src={g.afbeeldingUrl!} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <button
        onClick={handleGenerate}
        disabled={!allRequiredFilled || generateFromTemplate.isPending}
        className="flex items-center gap-2 px-4 py-2.5 bg-autronis-accent text-autronis-bg rounded-xl text-sm font-semibold hover:bg-autronis-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-press"
      >
        {generateFromTemplate.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Video className="w-4 h-4" />
        )}
        Genereer script
      </button>
    </div>
  );
}

// ============ MAIN PAGE ============

export default function VideosPage() {
  const { addToast } = useToast();
  const [selectedPostId, setSelectedPostId] = useState<number | "">("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"template" | "post">("template");

  const { data: videos, isLoading: videosLoading } = useContentVideos();
  const [galleryItems, setGalleryItems] = useState<{ id: number; afbeeldingUrl: string | null; productNaam: string }[]>([]);

  useEffect(() => {
    fetch("/api/assets/gallery").then(r => r.json()).then((d: { items: typeof galleryItems }) => {
      setGalleryItems((d.items ?? []).filter(g => g.afbeeldingUrl));
    }).catch(() => {});
  }, []);
  const { data: posts } = useContentPosts({ status: "goedgekeurd" });
  const { data: bewerktPosts } = useContentPosts({ status: "bewerkt" });
  const { data: templates } = useVideoTemplates();
  const generateScript = useGenerateVideoScript();

  const beschikbarePosts = [
    ...(posts ?? []),
    ...(bewerktPosts ?? []),
  ];

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId) ?? null;

  function handleGenereerVanPost() {
    if (!selectedPostId) return;
    generateScript.mutate(Number(selectedPostId), {
      onSuccess: () => {
        addToast("Video script gegenereerd!", "succes");
        setSelectedPostId("");
      },
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  return (
    <PageTransition>
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">Video&apos;s</h1>
          <p className="text-autronis-text-secondary mt-1">
            Genereer en beheer Autronis video&apos;s
          </p>
        </div>
        <a href="/content/videos/studio"
          className="flex items-center gap-2 px-5 py-2.5 bg-autronis-accent text-white rounded-xl text-sm font-semibold hover:bg-autronis-accent-hover transition-all shadow-lg shadow-autronis-accent/20">
          <Sparkles className="w-4 h-4" /> Video Studio (AI)
        </a>
      </div>

      {/* Create new video */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-autronis-accent/10 flex items-center justify-center">
            <Film className="w-5 h-5 text-autronis-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-autronis-text-primary">Nieuwe video</h2>
            <p className="text-sm text-autronis-text-secondary">
              Kies een template of maak een video van een bestaande post.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-autronis-bg rounded-xl w-fit">
          <button
            onClick={() => { setActiveTab("template"); setSelectedTemplateId(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "template"
                ? "bg-autronis-card text-autronis-text-primary shadow-sm"
                : "text-autronis-text-secondary hover:text-autronis-text-primary"
            }`}
          >
            Van template
          </button>
          <button
            onClick={() => { setActiveTab("post"); setSelectedTemplateId(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "post"
                ? "bg-autronis-card text-autronis-text-primary shadow-sm"
                : "text-autronis-text-secondary hover:text-autronis-text-primary"
            }`}
          >
            Van post
          </button>
        </div>

        {/* Template tab */}
        {activeTab === "template" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {(templates ?? []).map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={selectedTemplateId === template.id}
                  onSelect={() => setSelectedTemplateId(
                    selectedTemplateId === template.id ? null : template.id
                  )}
                />
              ))}
            </div>

            {selectedTemplate && (
              <TemplateForm
                template={selectedTemplate}
                onCancel={() => setSelectedTemplateId(null)}
                gallery={galleryItems}
              />
            )}
          </div>
        )}

        {/* Post tab */}
        {activeTab === "post" && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <select
                value={selectedPostId}
                onChange={(e) => setSelectedPostId(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-autronis-text-primary text-sm focus:outline-none focus:border-autronis-accent/60"
              >
                <option value="">Selecteer een post...</option>
                {beschikbarePosts.map((post) => (
                  <option key={post.id} value={post.id}>
                    [{post.platform}] {post.titel}
                  </option>
                ))}
              </select>

              <button
                onClick={handleGenereerVanPost}
                disabled={!selectedPostId || generateScript.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-autronis-accent text-autronis-bg rounded-xl text-sm font-semibold hover:bg-autronis-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-press"
              >
                {generateScript.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Video className="w-4 h-4" />
                )}
                Genereer script
              </button>
            </div>

            {beschikbarePosts.length === 0 && (
              <p className="text-sm text-autronis-text-secondary">
                Geen goedgekeurde posts beschikbaar. Keur eerst een post goed in het Posts-overzicht.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Video list */}
      {videosLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-autronis-accent" />
        </div>
      ) : !videos || videos.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-autronis-card border border-autronis-border flex items-center justify-center mx-auto">
            <Video className="w-8 h-8 text-autronis-text-secondary" />
          </div>
          <p className="text-autronis-text-secondary">
            Nog geen video&apos;s. Kies een template of selecteer een post om een video script te genereren.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
    </PageTransition>
  );
}
