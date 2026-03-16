import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface SecondBrainItem {
  id: number;
  gebruikerId: number;
  type: "tekst" | "url" | "afbeelding" | "pdf" | "code";
  titel: string | null;
  inhoud: string | null;
  aiSamenvatting: string | null;
  aiTags: string | null;
  bronUrl: string | null;
  bestandPad: string | null;
  taal: string | null;
  isFavoriet: number;
  isGearchiveerd: number;
  aangemaaktOp: string;
  bijgewerktOp: string;
}

interface SecondBrainResponse {
  items: SecondBrainItem[];
  kpis: {
    totaal: number;
    dezeWeek: number;
    perType: Record<string, number>;
  };
}

interface ZoekenResponse {
  antwoord: string;
  bronnen: { id: number; titel: string; type: string }[];
}

async function fetchItems(
  type: string,
  tag: string,
  zoek: string,
  favoriet: boolean
): Promise<SecondBrainResponse> {
  const params = new URLSearchParams();
  if (type !== "alle") params.set("type", type);
  if (tag) params.set("tag", tag);
  if (zoek) params.set("zoek", zoek);
  if (favoriet) params.set("favoriet", "1");
  const res = await fetch(`/api/second-brain?${params}`);
  if (!res.ok) throw new Error("Kon items niet laden");
  return res.json();
}

export function useSecondBrain(
  type: string,
  tag: string,
  zoek: string,
  favoriet: boolean
) {
  return useQuery({
    queryKey: ["second-brain", type, tag, zoek, favoriet],
    queryFn: () => fetchItems(type, tag, zoek, favoriet),
    staleTime: 30_000,
  });
}

export function useRecentSecondBrain(limiet: number = 5) {
  return useQuery({
    queryKey: ["second-brain", "recent", limiet],
    queryFn: async () => {
      const res = await fetch(`/api/second-brain?limiet=${limiet}`);
      if (!res.ok) throw new Error("Kon items niet laden");
      const data: SecondBrainResponse = await res.json();
      return data.items;
    },
    staleTime: 30_000,
  });
}

export function useCreateSecondBrainItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      type: string;
      titel?: string;
      inhoud?: string;
      taal?: string;
      bronUrl?: string;
    }) => {
      const res = await fetch("/api/second-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon item niet opslaan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["second-brain"] });
    },
  });
}

export function useVerwerkenSecondBrain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: FormData | { bronUrl: string }
    ) => {
      const isFormData = data instanceof FormData;
      const res = await fetch("/api/second-brain/verwerken", {
        method: "POST",
        ...(isFormData ? { body: data } : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon item niet verwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["second-brain"] });
    },
  });
}

export function useUpdateSecondBrainItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number; [key: string]: unknown }) => {
      const res = await fetch(`/api/second-brain/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon item niet bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["second-brain"] });
    },
  });
}

export function useDeleteSecondBrainItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/second-brain/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon item niet verwijderen");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["second-brain"] });
    },
  });
}

export function useAiZoeken() {
  return useMutation({
    mutationFn: async (vraag: string): Promise<ZoekenResponse> => {
      const res = await fetch("/api/second-brain/zoeken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vraag }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Zoeken mislukt");
      }
      return res.json();
    },
  });
}
