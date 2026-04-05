import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============ TYPES ============

export interface RadarBron {
  id: number;
  naam: string;
  url: string;
  type: string;
  actief: number;
  laatstGescand: string | null;
  aantalItems: number;
  aangemaaktOp: string;
}

export interface RadarItem {
  id: number;
  bronId: number;
  titel: string;
  url: string;
  beschrijving: string | null;
  auteur: string | null;
  gepubliceerdOp: string | null;
  score: number | null;
  scoreRedenering: string | null;
  aiSamenvatting: string | null;
  relevantie: string | null;
  leesMinuten: number | null;
  categorie: string | null;
  bewaard: number;
  nietRelevant: number;
  bronNaam: string | null;
  bronType: string | null;
  aangemaaktOp: string;
}

// ============ FETCH FUNCTIONS ============

async function fetchBronnen(): Promise<RadarBron[]> {
  const res = await fetch("/api/radar/bronnen");
  if (!res.ok) throw new Error("Kon bronnen niet laden");
  const data = await res.json();
  return data.bronnen || [];
}

export interface RadarItemFilters {
  categorie?: string;
  minScore?: number;
  bewaard?: boolean;
  nietRelevant?: boolean;
  zoek?: string;
  vanDatum?: string;
  totDatum?: string;
  offset?: number;
  limit?: number;
}

export interface RadarItemsResponse {
  items: RadarItem[];
  totaal: number;
}

async function fetchItems(filters?: RadarItemFilters): Promise<RadarItemsResponse> {
  const params = new URLSearchParams();
  if (filters?.categorie) params.set("categorie", filters.categorie);
  if (filters?.minScore != null) params.set("minScore", String(filters.minScore));
  if (filters?.bewaard != null) params.set("bewaard", filters.bewaard ? "1" : "0");
  if (filters?.nietRelevant != null) params.set("nietRelevant", filters.nietRelevant ? "1" : "0");
  if (filters?.zoek) params.set("zoek", filters.zoek);
  if (filters?.vanDatum) params.set("vanDatum", filters.vanDatum);
  if (filters?.totDatum) params.set("totDatum", filters.totDatum);
  if (filters?.offset != null) params.set("offset", String(filters.offset));
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const res = await fetch(`/api/radar/items?${params}`);
  if (!res.ok) throw new Error("Kon radar items niet laden");
  const data = await res.json();
  return { items: data.items || [], totaal: data.totaal ?? 0 };
}

// ============ QUERY HOOKS ============

export function useRadarBronnen() {
  return useQuery({
    queryKey: ["radar-bronnen"],
    queryFn: fetchBronnen,
    staleTime: 30_000,
  });
}

export function useRadarItems(filters?: RadarItemFilters) {
  return useQuery({
    queryKey: ["radar-items", filters],
    queryFn: () => fetchItems(filters),
    staleTime: 30_000,
  });
}

// ============ MUTATION HOOKS ============

export function useRadarFetch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/radar/fetch", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon items niet ophalen");
      }
      return res.json() as Promise<{ nieuw: number; totaal: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-items"] });
      queryClient.invalidateQueries({ queryKey: ["radar-bronnen"] });
    },
  });
}

export function useToggleBewaard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, bewaard }: { id: number; bewaard: boolean }) => {
      const res = await fetch(`/api/radar/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bewaard: bewaard ? 1 : 0 }),
      });
      if (!res.ok) throw new Error("Kon bewaard status niet wijzigen");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-items"] });
    },
  });
}

export function useMarkNietRelevant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/radar/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nietRelevant: 1 }),
      });
      if (!res.ok) throw new Error("Kon item niet markeren");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-items"] });
    },
  });
}

export function useAddBron() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { naam: string; url: string; type: string }) => {
      const res = await fetch("/api/radar/bronnen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Kon bron niet toevoegen");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-bronnen"] });
    },
  });
}

export function useDeleteBron() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/radar/bronnen/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kon bron niet verwijderen");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-bronnen"] });
      queryClient.invalidateQueries({ queryKey: ["radar-items"] });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/radar/items/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kon item niet verwijderen");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-items"] });
    },
  });
}
