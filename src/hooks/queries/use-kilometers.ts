"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Rit {
  id: number;
  datum: string;
  vanLocatie: string;
  naarLocatie: string;
  kilometers: number;
  isRetour: number;
  doelType: string | null;
  zakelijkDoel: string | null;
  klantId: number | null;
  projectId: number | null;
  tariefPerKm: number | null;
  klantNaam: string | null;
  projectNaam: string | null;
}

export interface KlantOptie {
  id: number;
  bedrijfsnaam: string;
}

export interface ProjectOptie {
  id: number;
  naam: string;
  klantId: number | null;
}

export interface OpgeslagenRoute {
  id: number;
  naam: string;
  vanLocatie: string;
  naarLocatie: string;
  kilometers: number;
  klantId: number | null;
  projectId: number | null;
  doelType: string | null;
  aantalKeerGebruikt: number;
  klantNaam: string | null;
  projectNaam: string | null;
}

interface RittenData {
  ritten: Rit[];
  totaalKm: number;
  totaalBedrag: number;
  aantalRitten: number;
}

export interface JaaroverzichtData {
  jaar: number;
  totaalKm: number;
  aantalRitten: number;
  totaalAftrekbaar: number;
  tariefPerKm: number;
  perMaand: Array<{ maand: number; km: number; ritten: number; bedrag: number }>;
  perKlant: Array<{ klantId: number | null; klantNaam: string; km: number; ritten: number; bedrag: number }>;
  perDoelType: Array<{ type: string | null; km: number; ritten: number; bedrag: number }>;
  vorigJaarKm: number;
  verschilVorigJaar: number;
  werkelijkPercentage: number | null;
  totaalGereden: number | null;
  ontbrekendeMaanden: number[];
  brandstof?: {
    totaalBedrag: number;
    totaalLiters: number;
    aantalTankbeurten: number;
    kostenPerKm: number;
    perMaand: Array<{ maand: number; bedrag: number; liters: number; tankbeurten: number }>;
    recent: Array<{
      id: number;
      datum: string;
      bedrag: number;
      liters: number | null;
      kmStand: number | null;
      notitie: string | null;
      isAutomatisch: boolean;
    }>;
  };
}

export function useRitten(maand: number, jaar: number) {
  return useQuery<RittenData>({
    queryKey: ["kilometers", maand, jaar],
    queryFn: async () => {
      const res = await fetch(`/api/kilometers?maand=${maand}&jaar=${jaar}`);
      if (!res.ok) throw new Error("Kon ritten niet laden");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useJaaroverzicht(jaar: number) {
  return useQuery<JaaroverzichtData>({
    queryKey: ["kilometers", "jaaroverzicht", jaar],
    queryFn: async () => {
      const res = await fetch(`/api/kilometers/jaaroverzicht?jaar=${jaar}`);
      if (!res.ok) throw new Error("Kon jaaroverzicht niet laden");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useOpgeslagenRoutes() {
  return useQuery<OpgeslagenRoute[]>({
    queryKey: ["kilometers", "routes"],
    queryFn: async () => {
      const res = await fetch("/api/kilometers/routes");
      if (!res.ok) throw new Error("Kon routes niet laden");
      const data = await res.json();
      return data.routes ?? [];
    },
    staleTime: 60_000,
  });
}

export function useSaveRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (route: { naam: string; vanLocatie: string; naarLocatie: string; kilometers: number; klantId?: number | null; projectId?: number | null; doelType?: string | null }) => {
      const res = await fetch("/api/kilometers/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(route),
      });
      if (!res.ok) throw new Error("Kon route niet opslaan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers", "routes"] });
    },
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/kilometers/routes?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kon route niet verwijderen");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers", "routes"] });
    },
  });
}

export function useUseRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch("/api/kilometers/routes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Kon route niet bijwerken");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers", "routes"] });
    },
  });
}

// ─── Km-standen ─────────────────────────────────────────────────────────────

export interface KmStandData {
  standen: Array<{
    id: number;
    maand: number;
    jaar: number;
    beginStand: number;
    eindStand: number;
    totaalKm: number;
  }>;
  huidigeStand: number | null;
}

export function useKmStanden(jaar: number) {
  return useQuery<KmStandData>({
    queryKey: ["kilometers", "km-stand", jaar],
    queryFn: async () => {
      const res = await fetch(`/api/kilometers/km-stand?jaar=${jaar}`);
      if (!res.ok) throw new Error("Kon km-standen niet laden");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useKmStandFoto(kmStandId: number | null) {
  return useQuery({
    queryKey: ["kilometers", "km-stand-foto", kmStandId],
    queryFn: async () => {
      if (!kmStandId) return null;
      const res = await fetch(`/api/kilometers/km-stand/foto?kmStandId=${kmStandId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.foto as { id: number; bestandspad: string; bestandsnaam: string } | null;
    },
    enabled: !!kmStandId,
    staleTime: 60000,
  });
}

export function useUploadKmStandFoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kmStandId, foto }: { kmStandId: number; foto: File }) => {
      const formData = new FormData();
      formData.append("foto", foto);
      formData.append("kmStandId", String(kmStandId));
      const res = await fetch("/api/kilometers/km-stand/foto", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload mislukt");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["kilometers", "km-stand-foto", variables.kmStandId] });
    },
  });
}

export function useSaveKmStand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { jaar: number; maand: number; beginStand: number; eindStand: number }) => {
      const res = await fetch("/api/kilometers/km-stand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon km-stand niet opslaan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers", "km-stand"] });
    },
  });
}

// ─── Auto-instellingen ──────────────────────────────────────────────────────

export interface AutoInstellingenData {
  zakelijkPercentage: number;
  tariefPerKm: number;
}

export function useAutoInstellingen() {
  return useQuery<{ instellingen: AutoInstellingenData }>({
    queryKey: ["kilometers", "instellingen"],
    queryFn: async () => {
      const res = await fetch("/api/kilometers/instellingen");
      if (!res.ok) throw new Error("Kon instellingen niet laden");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useUpdateAutoInstellingen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { zakelijkPercentage?: number; tariefPerKm?: number }) => {
      const res = await fetch("/api/kilometers/instellingen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon instellingen niet bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers", "instellingen"] });
    },
  });
}

// ─── Terugkerende ritten ────────────────────────────────────────────────────

export interface TerugkerendeRit {
  id: number;
  naam: string;
  vanLocatie: string;
  naarLocatie: string;
  kilometers: number;
  isRetour: number;
  doelType: string | null;
  klantId: number | null;
  klantNaam: string | null;
  projectId: number | null;
  frequentie: "dagelijks" | "wekelijks" | "maandelijks";
  dagVanWeek: number | null;
  dagVanMaand: number | null;
  startDatum: string;
  eindDatum: string | null;
  isActief: number;
  laatsteGeneratie: string | null;
}

export function useTerugkerendeRitten() {
  return useQuery<{ ritten: TerugkerendeRit[] }>({
    queryKey: ["kilometers", "terugkerend"],
    queryFn: async () => {
      const res = await fetch("/api/kilometers/terugkerend");
      if (!res.ok) throw new Error("Kon terugkerende ritten niet laden");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useSaveTerugkerendeRit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      naam: string; vanLocatie: string; naarLocatie: string; kilometers: number;
      isRetour?: boolean; doelType?: string; klantId?: number | null; projectId?: number | null;
      frequentie: string; dagVanWeek?: number; dagVanMaand?: number;
      startDatum: string; eindDatum?: string;
    }) => {
      const res = await fetch("/api/kilometers/terugkerend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon terugkerende rit niet opslaan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers", "terugkerend"] });
    },
  });
}

export function useUpdateTerugkerendeRit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Record<string, unknown>) => {
      const res = await fetch(`/api/kilometers/terugkerend?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon terugkerende rit niet bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers", "terugkerend"] });
    },
  });
}

export function useDeleteTerugkerendeRit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/kilometers/terugkerend?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kon terugkerende rit niet verwijderen");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers", "terugkerend"] });
    },
  });
}

export function useGenereerTerugkerendeRitten() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/kilometers/terugkerend/genereer", { method: "POST" });
      if (!res.ok) throw new Error("Kon ritten niet genereren");
      return res.json() as Promise<{ aangemaakt: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers"] });
    },
  });
}

// ─── Brandstofkosten ────────────────────────────────────────────────────────

export interface BrandstofKost {
  id: number;
  datum: string;
  bedrag: number;
  liters: number | null;
  kmStand: number | null;
  notitie: string | null;
  bankTransactieId: number | null;
  isAutomatisch: boolean;
}

export interface BrandstofData {
  kosten: BrandstofKost[];
  totaalBedrag: number;
  gemiddeldPerMaand: number;
}

export function useBrandstofKosten(jaar: number) {
  return useQuery<BrandstofData>({
    queryKey: ["kilometers", "brandstof", jaar],
    queryFn: async () => {
      const res = await fetch(`/api/kilometers/brandstof?jaar=${jaar}`);
      if (!res.ok) throw new Error("Kon brandstofkosten niet laden");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useSaveBrandstofKost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { datum: string; bedrag: number; liters?: number; kmStand?: number; notitie?: string }) => {
      const res = await fetch("/api/kilometers/brandstof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon brandstofkost niet opslaan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers", "brandstof"] });
    },
  });
}

export function useDeleteBrandstofKost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/kilometers/brandstof?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kon brandstofkost niet verwijderen");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers", "brandstof"] });
    },
  });
}

// ─── Klanten & Projecten ────────────────────────────────────────────────────

export function useKlantenProjecten() {
  return useQuery<{ klanten: KlantOptie[]; projecten: ProjectOptie[] }>({
    queryKey: ["kilometers", "klanten-projecten"],
    queryFn: async () => {
      const [kRes, pRes] = await Promise.all([
        fetch("/api/klanten"),
        fetch("/api/projecten"),
      ]);
      const klanten = kRes.ok ? (await kRes.json()).klanten ?? [] : [];
      const projecten = pRes.ok ? (await pRes.json()).projecten ?? [] : [];
      return { klanten, projecten };
    },
    staleTime: 60_000,
  });
}

export function useAfstandBerekening() {
  return useMutation({
    mutationFn: async ({ van, naar }: { van: string; naar: string }) => {
      const res = await fetch(`/api/kilometers/distance?van=${encodeURIComponent(van)}&naar=${encodeURIComponent(naar)}`);
      if (!res.ok) return null;
      return res.json() as Promise<{ afstandMeters: number; afstandKm: number; duurSeconden: number; duurTekst: string }>;
    },
  });
}

// ─── Calendar Suggesties ─────────────────────────────────────────────────────

interface CalendarSuggestie {
  eventId: string;
  titel: string;
  locatie: string;
  startTijd: string;
  afstandKm: number | null;
  klantId: number | null;
  klantNaam: string | null;
}

export function useCalendarSuggesties() {
  return useQuery({
    queryKey: ["kilometers", "suggesties"],
    queryFn: async (): Promise<CalendarSuggestie[]> => {
      const res = await fetch("/api/kilometers/suggesties");
      if (!res.ok) return [];
      const data = await res.json();
      return data.suggesties ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Locatie Autocomplete ────────────────────────────────────────────────────

interface LocatieSuggestie {
  locatie: string;
  aantalGebruikt: number;
  bron: "eigen" | "google";
}

export function useLocatieSuggesties(zoekterm: string) {
  return useQuery({
    queryKey: ["kilometers", "locaties", zoekterm],
    queryFn: async (): Promise<LocatieSuggestie[]> => {
      if (!zoekterm || zoekterm.length < 2) return [];

      const eigenRes = await fetch(`/api/kilometers/locaties?q=${encodeURIComponent(zoekterm)}`);
      const eigenData = await eigenRes.json();
      const eigen: LocatieSuggestie[] = (eigenData.locaties ?? []).map(
        (l: { locatie: string; aantalGebruikt: number }) => ({ ...l, bron: "eigen" as const })
      );

      if (eigen.length >= 3) return eigen;

      const googleRes = await fetch(`/api/kilometers/locaties/google?q=${encodeURIComponent(zoekterm)}`);
      const googleData = await googleRes.json();
      const google: LocatieSuggestie[] = (googleData.suggesties ?? []).map(
        (s: { description: string }) => ({ locatie: s.description, aantalGebruikt: 0, bron: "google" as const })
      );

      return [...eigen, ...google];
    },
    enabled: zoekterm.length >= 2,
    staleTime: 10000,
  });
}
