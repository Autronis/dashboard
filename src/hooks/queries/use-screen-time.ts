import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ScreenTimeEntry,
  ScreenTimeRegel,
  ScreenTimeSuggestie,
  ScreenTimeCategorie,
  ScreenTimeSessie,
  ScreenTimeSamenvatting,
} from "@/types";

// ============ FETCH FUNCTIONS ============

async function fetchScreenTime(
  van: string,
  tot: string,
  gebruikerId?: number
): Promise<ScreenTimeEntry[]> {
  const params = new URLSearchParams({ van, tot });
  if (gebruikerId) params.set("gebruikerId", String(gebruikerId));
  const res = await fetch(`/api/screen-time?${params}`);
  if (!res.ok) throw new Error("Kon screen time niet laden");
  const data = await res.json();
  return data.entries || [];
}

async function fetchRegels(): Promise<ScreenTimeRegel[]> {
  const res = await fetch("/api/screen-time/regels");
  if (!res.ok) throw new Error("Kon regels niet laden");
  const data = await res.json();
  return data.regels || [];
}

async function fetchSuggesties(
  status?: string
): Promise<ScreenTimeSuggestie[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const res = await fetch(`/api/screen-time/suggesties?${params}`);
  if (!res.ok) throw new Error("Kon suggesties niet laden");
  const data = await res.json();
  return data.suggesties || [];
}

// ============ QUERY HOOKS ============

export function useScreenTime(van: string, tot: string, gebruikerId?: number) {
  return useQuery({
    queryKey: ["screen-time", van, tot, gebruikerId],
    queryFn: () => fetchScreenTime(van, tot, gebruikerId),
    staleTime: 30_000,
  });
}

export function useScreenTimeRegels() {
  return useQuery({
    queryKey: ["screen-time-regels"],
    queryFn: fetchRegels,
    staleTime: 30_000,
  });
}

export function useScreenTimeSuggesties(status?: string) {
  return useQuery({
    queryKey: ["screen-time-suggesties", status],
    queryFn: () => fetchSuggesties(status),
    staleTime: 30_000,
  });
}

// ============ MUTATION HOOKS ============

export function useScreenTimeRegelMutatie() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (body: {
      type: ScreenTimeRegel["type"];
      patroon: string;
      categorie: ScreenTimeCategorie;
      projectId?: number | null;
      klantId?: number | null;
      prioriteit?: number;
    }) => {
      const res = await fetch("/api/screen-time/regels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Kon regel niet aanmaken");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screen-time-regels"] });
    },
  });

  const update = useMutation({
    mutationFn: async (payload: {
      id: number;
      body: Partial<{
        type: ScreenTimeRegel["type"];
        patroon: string;
        categorie: ScreenTimeCategorie;
        projectId: number | null;
        klantId: number | null;
        prioriteit: number;
        isActief: number;
      }>;
    }) => {
      const res = await fetch(`/api/screen-time/regels/${payload.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      if (!res.ok) throw new Error("Kon regel niet bijwerken");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screen-time-regels"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/screen-time/regels/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kon regel niet verwijderen");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screen-time-regels"] });
    },
  });

  return { create, update, remove };
}

export function useScreenTimeSuggestieMutatie() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: number;
      status: "goedgekeurd" | "afgewezen";
    }) => {
      const res = await fetch(`/api/screen-time/suggesties/${payload.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: payload.status }),
      });
      if (!res.ok) throw new Error("Kon suggestie niet bijwerken");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screen-time-suggesties"] });
      queryClient.invalidateQueries({ queryKey: ["screen-time"] });
    },
  });
}

export function useCategoriseer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      entryIds: number[];
    }) => {
      const res = await fetch("/api/screen-time/categoriseer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Kon niet categoriseren");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screen-time"] });
      queryClient.invalidateQueries({ queryKey: ["screen-time-suggesties"] });
    },
  });
}

// ============ SESSIES ============

interface SessiesData {
  sessies: ScreenTimeSessie[];
  stats: {
    totaalActief: number;
    totaalIdle: number;
    productiefPercentage: number;
    aantalSessies: number;
  };
}

async function fetchSessies(datum: string, gebruikerId?: number): Promise<SessiesData> {
  const params = new URLSearchParams({ datum });
  if (gebruikerId) params.set("gebruikerId", String(gebruikerId));
  const res = await fetch(`/api/screen-time/sessies?${params}`);
  if (!res.ok) throw new Error("Kon sessies niet laden");
  return res.json();
}

export function useSessies(datum: string, gebruikerId?: number) {
  return useQuery({
    queryKey: ["screen-time-sessies", datum, gebruikerId],
    queryFn: () => fetchSessies(datum, gebruikerId),
    staleTime: 30_000,
  });
}

// ============ SAMENVATTINGEN ============

async function fetchSamenvatting(datum: string): Promise<ScreenTimeSamenvatting | null> {
  const res = await fetch(`/api/screen-time/samenvatting?datum=${datum}`);
  if (!res.ok) throw new Error("Kon samenvatting niet laden");
  const data = await res.json();
  return data.samenvatting;
}

export function useSamenvatting(datum: string) {
  return useQuery({
    queryKey: ["screen-time-samenvatting", datum],
    queryFn: () => fetchSamenvatting(datum),
    staleTime: 60_000,
  });
}

export function useGenereerSamenvatting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datum: string) => {
      const res = await fetch("/api/screen-time/samenvatting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datum }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Fout bij genereren");
      }
      return res.json();
    },
    onSuccess: (_data, datum) => {
      queryClient.invalidateQueries({ queryKey: ["screen-time-samenvatting", datum] });
    },
  });
}
