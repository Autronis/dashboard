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
  vorigJaarKm: number;
  verschilVorigJaar: number;
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
