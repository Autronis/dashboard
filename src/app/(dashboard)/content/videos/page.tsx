"use client";

import { useState } from "react";
import { Video, Play, Download, Trash2, ChevronDown, ChevronUp, Loader2, Film } from "lucide-react";
import { useContentVideos, useGenerateVideoScript, useRenderVideo, useDeleteVideo } from "@/hooks/queries/use-content";
import { useContentPosts } from "@/hooks/queries/use-content";
import { useToast } from "@/hooks/use-toast";
import type { ContentVideo, VideoStatus } from "@/types/content";

function StatusBadge({ status }: { status: VideoStatus }) {
  const map: Record<VideoStatus, { label: string; className: string }> = {
    script: { label: "Script", className: "bg-zinc-700 text-zinc-300" },
    rendering: { label: "Renderen…", className: "bg-yellow-500/20 text-yellow-400" },
    klaar: { label: "Klaar", className: "bg-green-500/20 text-green-400" },
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

function VideoCard({ video }: { video: ContentVideo }) {
  const { addToast } = useToast();
  const renderVideo = useRenderVideo();
  const deleteVideo = useDeleteVideo();

  function handleRender() {
    renderVideo.mutate(video.id, {
      onSuccess: () => addToast("Video gerenderd!", "succes"),
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  function handleDelete() {
    deleteVideo.mutate(video.id, {
      onSuccess: () => addToast("Video verwijderd", "info"),
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-autronis-text-primary truncate">
            {video.postTitel ?? `Video #${video.id}`}
          </p>
          <div className="flex items-center gap-2 mt-1 text-sm text-autronis-text-secondary">
            {video.postPlatform && (
              <span className="capitalize">{video.postPlatform}</span>
            )}
            {video.duurSeconden && (
              <span>· {video.duurSeconden}s</span>
            )}
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

      <div className="flex items-center gap-2 pt-1">
        {video.status === "script" && (
          <button
            onClick={handleRender}
            disabled={renderVideo.isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-autronis-accent/10 text-autronis-accent border border-autronis-accent/30 rounded-lg text-sm font-medium hover:bg-autronis-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {renderVideo.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Render video
          </button>
        )}

        {video.status === "klaar" && video.videoPath && (
          <a
            href={video.videoPath}
            download
            className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/30 rounded-lg text-sm font-medium hover:bg-green-500/20 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        )}

        {video.status === "fout" && (
          <button
            onClick={handleRender}
            disabled={renderVideo.isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-autronis-accent/10 text-autronis-accent border border-autronis-accent/30 rounded-lg text-sm font-medium hover:bg-autronis-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {renderVideo.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Opnieuw renderen
          </button>
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

export default function VideosPage() {
  const { addToast } = useToast();
  const [selectedPostId, setSelectedPostId] = useState<number | "">("");

  const { data: videos, isLoading: videosLoading } = useContentVideos();
  const { data: posts } = useContentPosts({ status: "goedgekeurd" });
  const { data: bewerktPosts } = useContentPosts({ status: "bewerkt" });
  const generateScript = useGenerateVideoScript();

  const beschikbarePosts = [
    ...(posts ?? []),
    ...(bewerktPosts ?? []),
  ];

  function handleGenereer() {
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
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-autronis-text-primary">Video&apos;s</h1>
        <p className="text-autronis-text-secondary mt-1">
          Genereer en beheer Autronis video&apos;s
        </p>
      </div>

      {/* Create from post */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-autronis-accent/10 flex items-center justify-center">
            <Film className="w-5 h-5 text-autronis-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-autronis-text-primary">Maak video van een post</h2>
            <p className="text-sm text-autronis-text-secondary">
              Selecteer een goedgekeurde post om een video script te genereren.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <select
            value={selectedPostId}
            onChange={(e) => setSelectedPostId(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
            className="flex-1 bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-autronis-text-primary text-sm focus:outline-none focus:border-autronis-accent/60"
          >
            <option value="">Selecteer een post…</option>
            {beschikbarePosts.map((post) => (
              <option key={post.id} value={post.id}>
                [{post.platform}] {post.titel}
              </option>
            ))}
          </select>

          <button
            onClick={handleGenereer}
            disabled={!selectedPostId || generateScript.isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-autronis-accent text-autronis-bg rounded-xl text-sm font-semibold hover:bg-autronis-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            Nog geen video&apos;s. Selecteer een goedgekeurde post om een video script te genereren.
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
  );
}
