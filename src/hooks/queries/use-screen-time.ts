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

export interface FocusInzicht {
  type: "positief" | "waarschuwing" | "tip" | "actie";
  tekst: string;
}

export interface BesteFocusBlok {
  beschrijving: string;
  startTijd: string;
  eindTijd: string;
  duurMin: number;
}

export interface SessiesData {
  sessies: ScreenTimeSessie[];
  stats: {
    totaalActief: number;
    totaalIdle: number;
    productiefPercentage: number;
    aantalSessies: number;
    focusScore: number;
    contextSwitches: number;
    langsteFocusMinuten: number;
    deepWorkMinuten: number;
    deepWorkTarget: number;
    deepWorkSessies: number;
    aantalFocusSessies: number;
    gemSessieLengte: number;
    afleidingMinuten: number;
    besteFocusBlok: BesteFocusBlok | null;
    pauzes: Array<{ start: string; eind: string; duurMinuten: number }>;
    totaalPauzeMinuten: number;
    inzichten: FocusInzicht[];
    mogelijkOnnauwkeurig: boolean;
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

// ============ WEEK SESSIES ============

export interface WeekDagData {
  datum: string;
  sessies: ScreenTimeSessie[];
  stats: SessiesData["stats"] | null;
}

export function useWeekSessies(startDatum: string) {
  const dagen = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDatum);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  return useQuery({
    queryKey: ["screen-time-week-sessies", startDatum],
    queryFn: async (): Promise<WeekDagData[]> => {
      const results = await Promise.all(
        dagen.map(async (datum) => {
          const res = await fetch(`/api/screen-time/sessies?datum=${datum}`);
          if (!res.ok) return { datum, sessies: [], stats: null };
          const data: SessiesData = await res.json();
          return { datum, sessies: data.sessies, stats: data.stats };
        })
      );
      return results;
    },
    staleTime: 30_000,
  });
}

// ============ MAAND SESSIES ============

/**
 * Fetches session stats for every day in a calendar month.
 * startDatum must be "YYYY-MM-DD" of the first day of the month.
 */
export function useMaandSessies(startDatum: string) {
  const dagen = (() => {
    const parts = startDatum.split("-");
    const year = Number(parts[0]);
    const monthIdx = Number(parts[1]) - 1;
    const aantalDagen = new Date(year, monthIdx + 1, 0).getDate();
    return Array.from({ length: aantalDagen }, (_, i) => {
      const d = new Date(year, monthIdx, 1 + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    });
  })();

  return useQuery({
    queryKey: ["screen-time-maand-sessies", startDatum],
    queryFn: async (): Promise<WeekDagData[]> => {
      const results = await Promise.all(
        dagen.map(async (datum) => {
          const res = await fetch(`/api/screen-time/sessies?datum=${datum}`);
          if (!res.ok) return { datum, sessies: [], stats: null };
          const data: SessiesData = await res.json();
          return { datum, sessies: data.sessies, stats: data.stats };
        })
      );
      return results;
    },
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

// ============ PERIODE SAMENVATTINGEN (week/maand) ============

export interface PeriodeSamenvatting {
  type: "week" | "maand";
  periode: string;
  van: string;
  tot: string;
  samenvattingKort: string;
  samenvattingDetail: string;
  totaalSeconden: number;
  productiefPercentage: number;
  aantalDagen: number;
  topProject: string | null;
}

export function useGenereerPeriodeSamenvatting() {
  return useMutation({
    mutationFn: async (params: { datum: string; type: "week" | "maand" }): Promise<PeriodeSamenvatting> => {
      const res = await fetch("/api/screen-time/samenvatting/periode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Fout bij genereren");
      }
      const data = await res.json();
      return data.samenvatting;
    },
  });
}
