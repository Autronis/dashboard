import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProfielEntry, Inzicht, InzichtCategorie, ContentPost, ContentStatus, ContentPlatform, ContentVideo, Scene, VideoStatus, ContentBanner, BannerFormaat, BannerIcon, BannerIllustration } from "@/types/content";

// ============ PROFIEL ============

async function fetchContentProfiel(): Promise<ProfielEntry[]> {
  const res = await fetch("/api/content/profiel");
  if (!res.ok) throw new Error("Kon profiel niet ophalen");
  const data = await res.json();
  return data.profiel ?? [];
}

export function useContentProfiel() {
  return useQuery({
    queryKey: ["content-profiel"],
    queryFn: fetchContentProfiel,
    staleTime: 60_000,
  });
}

export function useUpdateProfiel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id?: number; onderwerp: string; inhoud: string }) => {
      const res = await fetch("/api/content/profiel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon profiel niet opslaan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-profiel"] });
    },
  });
}

// ============ INZICHTEN ============

type RawInzicht = Omit<Inzicht, "isGebruikt"> & { isGebruikt: number };

async function fetchContentInzichten(): Promise<Inzicht[]> {
  const res = await fetch("/api/content/inzichten");
  if (!res.ok) throw new Error("Kon inzichten niet ophalen");
  const data = await res.json();
  return (data.inzichten ?? []).map((item: RawInzicht) => ({
    ...item,
    isGebruikt: item.isGebruikt === 1,
  }));
}

export function useContentInzichten() {
  return useQuery({
    queryKey: ["content-inzichten"],
    queryFn: fetchContentInzichten,
    staleTime: 30_000,
  });
}

export function useCreateInzicht() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      titel: string;
      inhoud: string;
      categorie: InzichtCategorie;
      klantId?: number;
      projectId?: number;
    }) => {
      const res = await fetch("/api/content/inzichten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon inzicht niet aanmaken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-inzichten"] });
    },
  });
}

export function useDeleteInzicht() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/content/inzichten/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon inzicht niet verwijderen");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-inzichten"] });
    },
  });
}

// ============ POSTS ============

type RawPost = Omit<ContentPost, "hashtags"> & { gegenereerdeHashtags?: string | null };

function mapPost(raw: RawPost): ContentPost {
  let hashtags: string[] = [];
  try {
    hashtags = JSON.parse(raw.gegenereerdeHashtags ?? "[]") as string[];
  } catch {
    hashtags = [];
  }
  return { ...raw, hashtags };
}

interface PostFilters {
  status?: ContentStatus;
  platform?: ContentPlatform;
  batchWeek?: string;
}

async function fetchContentPosts(filters?: PostFilters): Promise<ContentPost[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.platform) params.set("platform", filters.platform);
  if (filters?.batchWeek) params.set("batchWeek", filters.batchWeek);

  const url = `/api/content/posts${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Kon posts niet ophalen");
  const data = await res.json() as { posts: RawPost[] };
  return (data.posts ?? []).map(mapPost);
}

export function useContentPosts(filters?: PostFilters) {
  return useQuery({
    queryKey: ["content-posts", filters],
    queryFn: () => fetchContentPosts(filters),
    staleTime: 30_000,
  });
}

export function useGenerateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload?: { count?: number; platforms?: string[] }) => {
      const res = await fetch("/api/content/genereer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      if (!res.ok) {
        const data = await res.json() as { fout?: string };
        throw new Error(data.fout ?? "Genereren mislukt");
      }
      return res.json() as Promise<{ posts: ContentPost[]; batchId: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-posts"] });
    },
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: number;
      status?: ContentStatus;
      bewerkteInhoud?: string;
      afwijsReden?: string;
    }) => {
      const { id, ...body } = payload;
      const res = await fetch(`/api/content/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json() as { fout?: string };
        throw new Error(data.fout ?? "Bijwerken mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-posts"] });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/content/posts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json() as { fout?: string };
        throw new Error(data.fout ?? "Verwijderen mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-posts"] });
    },
  });
}

export function useSchedulePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id: number; geplandOp: string }) => {
      const { id, geplandOp } = payload;
      const res = await fetch(`/api/content/posts/${id}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geplandOp }),
      });
      if (!res.ok) {
        const data = await res.json() as { fout?: string };
        throw new Error(data.fout ?? "Inplannen mislukt");
      }
      return res.json() as Promise<{ succes: boolean; geplandOp: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-posts"] });
    },
  });
}

export function usePublishPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/content/posts/${id}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json() as { fout?: string };
        throw new Error(data.fout ?? "Publiceren mislukt");
      }
      return res.json() as Promise<{ succes: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-posts"] });
    },
  });
}

// ============ VIDEO'S ============

type RawVideo = Omit<ContentVideo, "script"> & { script: string };

function mapVideo(raw: RawVideo): ContentVideo {
  let script: Scene[] = [];
  try {
    script = JSON.parse(raw.script) as Scene[];
  } catch {
    script = [];
  }
  return { ...raw, script };
}

async function fetchContentVideos(): Promise<ContentVideo[]> {
  const res = await fetch("/api/content/videos");
  if (!res.ok) throw new Error("Kon video's niet ophalen");
  const data = await res.json() as { videos: (RawVideo & { status: VideoStatus })[] };
  return (data.videos ?? []).map(mapVideo);
}

export function useContentVideos() {
  return useQuery({
    queryKey: ["content-videos"],
    queryFn: fetchContentVideos,
    staleTime: 30_000,
  });
}

export function useGenerateVideoScript() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: number) => {
      const res = await fetch("/api/content/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        const data = await res.json() as { fout?: string };
        throw new Error(data.fout ?? "Genereren mislukt");
      }
      const data = await res.json() as { video: RawVideo & { status: VideoStatus } };
      return mapVideo(data.video);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-videos"] });
    },
  });
}

export function useRenderVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoId: number) => {
      const res = await fetch(`/api/content/videos/${videoId}/render`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json() as { fout?: string };
        throw new Error(data.fout ?? "Renderen mislukt");
      }
      return res.json() as Promise<{ ok: boolean; videoPath: string; duurSeconden: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-videos"] });
    },
  });
}

export function useDeleteVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoId: number) => {
      const res = await fetch(`/api/content/videos/${videoId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json() as { fout?: string };
        throw new Error(data.fout ?? "Verwijderen mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-videos"] });
    },
  });
}

// ============ BANNERS ============

async function fetchContentBanners(): Promise<ContentBanner[]> {
  const res = await fetch("/api/content/banners");
  if (!res.ok) throw new Error("Kon banners niet ophalen");
  const json = await res.json() as { banners: ContentBanner[] };
  return json.banners ?? [];
}

export function useContentBanners() {
  return useQuery({
    queryKey: ["content-banners"],
    queryFn: fetchContentBanners,
    staleTime: 30_000,
  });
}

export function useSaveBanner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      onderwerp: string;
      icon: BannerIcon;
      illustration: BannerIllustration;
      formaat: BannerFormaat;
    }) => {
      const res = await fetch("/api/content/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json() as { fout?: string };
        throw new Error(json.fout ?? "Opslaan mislukt");
      }
      return res.json() as Promise<{ banner: ContentBanner }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-banners"] });
    },
  });
}

export function useAnalyzeTopic() {
  return useMutation({
    mutationFn: async (onderwerp: string) => {
      const res = await fetch("/api/content/banners/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onderwerp }),
      });
      if (!res.ok) {
        const json = await res.json() as { fout?: string };
        throw new Error(json.fout ?? "Analyseren mislukt");
      }
      return res.json() as Promise<{ icon: BannerIcon; illustration: BannerIllustration; capsuleText: string }>;
    },
  });
}

export function useRenderBanner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/content/banners/${id}/render`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json() as { fout?: string };
        throw new Error(json.fout ?? "Renderen mislukt");
      }
      return res.json() as Promise<{ ok: boolean; imagePath: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-banners"] });
    },
  });
}

export function useDeleteBanner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/content/banners/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json() as { fout?: string };
        throw new Error(json.fout ?? "Verwijderen mislukt");
      }
      return res.json() as Promise<{ ok: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-banners"] });
    },
  });
}
