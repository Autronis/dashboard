"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface KeyResult {
  id?: number;
  objectiveId?: number;
  titel: string;
  doelwaarde: number;
  huidigeWaarde: number;
  eenheid: string | null;
  autoKoppeling: string | null;
  confidence?: number;
}

export interface Doel {
  id: number;
  titel: string;
  omschrijving: string | null;
  eigenaarId: number | null;
  kwartaal: number;
  jaar: number;
  status: string | null;
  keyResults: KeyResult[];
  voortgang: number;
}

export interface GebruikerOptie {
  id: number;
  naam: string;
}

export interface CheckIn {
  id: number;
  objectiveId: number;
  voortgang: number;
  blocker: string | null;
  volgendeStap: string | null;
  notities: string | null;
  week: number;
  jaar: number;
  aangemaaktOp: string;
}

export interface KrSuggestie {
  titel: string;
  doelwaarde: number;
  eenheid: string;
  autoKoppeling: string;
}

export function useDoelen(kwartaal: number, jaar: number) {
  return useQuery<{ doelen: Doel[] }>({
    queryKey: ["doelen", kwartaal, jaar],
    queryFn: async () => {
      const res = await fetch(`/api/doelen?kwartaal=${kwartaal}&jaar=${jaar}`);
      if (!res.ok) throw new Error("Laden mislukt");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useGebruikers() {
  return useQuery<GebruikerOptie[]>({
    queryKey: ["gebruikers"],
    queryFn: async () => {
      const res = await fetch("/api/profiel");
      if (!res.ok) return [];
      const json = await res.json();
      const allRes = await fetch("/api/analytics/vergelijk");
      if (allRes.ok) {
        const allJson = await allRes.json();
        return allJson.gebruikers || [json.gebruiker];
      }
      return [json.gebruiker];
    },
    staleTime: 60_000,
  });
}

export function useCheckIns(objectiveId: number | null) {
  return useQuery<CheckIn[]>({
    queryKey: ["doelen", "check-ins", objectiveId],
    queryFn: async () => {
      if (!objectiveId) return [];
      const res = await fetch(`/api/doelen/check-in?objectiveId=${objectiveId}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.checkIns ?? [];
    },
    enabled: !!objectiveId,
    staleTime: 30_000,
  });
}

export function useCreateCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      objectiveId: number;
      voortgang: number;
      blocker?: string;
      volgendeStap?: string;
      notities?: string;
    }) => {
      const res = await fetch("/api/doelen/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout ?? "Check-in mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doelen"] });
    },
  });
}

export function useSuggestKrs() {
  return useMutation<KrSuggestie[], Error, string>({
    mutationFn: async (titel: string) => {
      const res = await fetch("/api/doelen/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titel }),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.suggesties ?? [];
    },
  });
}
