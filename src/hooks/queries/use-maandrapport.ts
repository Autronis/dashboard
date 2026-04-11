"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============ TYPES ============

export interface RapportItem {
  id: number;
  bron: "bankTransacties" | "uitgaven";
  datum: string;
  omschrijving: string;
  categorie: string | null;
  bankNaam: string | null;
  bedragInclBtw: number;
  btwBedrag: number | null;
  eigenaar: string | null;
  splitRatio: string | null;
}

export interface BtwSplitPersoon {
  items: { omschrijving: string; bedrag: number }[];
  totaal: number;
}

export interface Verrekening {
  id: number;
  omschrijving: string;
  bedrag: number;
  betaald: boolean;
  vanGebruikerId: number;
  naarGebruikerId: number;
}

export interface BorgHuurder {
  naam: string;
  borg: number;
  huurPerMaand: number;
  status: string;
}

export interface BorgConfig {
  adres: string;
  totaalBorg: number;
  huurders: readonly BorgHuurder[];
}

export interface TrendPunt {
  maand: string;
  uitgaven: number;
  btw: number;
}

export interface MaandrapportData {
  maand: string;
  uitgaven: RapportItem[];
  totaalUitgaven: number;
  totaalBtw: number;
  btwSplit: {
    sem: BtwSplitPersoon;
    syb: BtwSplitPersoon;
  };
  verrekeningen: Verrekening[];
  totaalVerrekening: number;
  totaalTerug: number;
  trend: TrendPunt[];
  borg: BorgConfig;
}

export interface VerdeelRegel {
  id: number;
  type: "leverancier" | "categorie";
  waarde: string;
  eigenaar: "sem" | "syb" | "gedeeld";
  splitRatio: string;
}

// ============ QUERIES ============

export function useMaandrapport(maand: string) {
  return useQuery<MaandrapportData>({
    queryKey: ["maandrapport", maand],
    queryFn: async () => {
      const res = await fetch(`/api/belasting/maandrapport?maand=${maand}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon maandrapport niet ophalen");
      }
      const data = await res.json();
      return data.maandrapport;
    },
    staleTime: 30_000,
  });
}

export function useVerdeelRegels() {
  return useQuery<VerdeelRegel[]>({
    queryKey: ["verdeelregels"],
    queryFn: async () => {
      const res = await fetch("/api/belasting/verdeelregels");
      if (!res.ok) throw new Error("Kon verdeelregels niet ophalen");
      const data = await res.json();
      return data.regels;
    },
    staleTime: 60_000,
  });
}

// ============ MUTATIONS ============

export function useUpdateEigenaar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: number;
      bron: "bankTransacties" | "uitgaven";
      eigenaar: "sem" | "syb" | "gedeeld";
      splitRatio?: string;
    }) => {
      const endpoint = payload.bron === "bankTransacties"
        ? `/api/bank-transacties/${payload.id}/eigenaar`
        : `/api/uitgaven/${payload.id}/eigenaar`;

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eigenaar: payload.eigenaar, splitRatio: payload.splitRatio }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon eigenaar niet bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maandrapport"] });
    },
  });
}

export function useToggleVerrekening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id: number; betaald: boolean }) => {
      const res = await fetch(`/api/belasting/verrekeningen/${payload.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betaald: payload.betaald }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon verrekening niet bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maandrapport"] });
    },
  });
}

export function useCreateVerrekening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { omschrijving: string; bedrag: number; vanGebruikerId: number; naarGebruikerId: number }) => {
      const res = await fetch("/api/belasting/verrekeningen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon verrekening niet aanmaken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maandrapport"] });
    },
  });
}

export function useSaveVerdeelRegel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { type: string; waarde: string; eigenaar: string; splitRatio: string }) => {
      const res = await fetch("/api/belasting/verdeelregels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon verdeelregel niet opslaan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["verdeelregels"] });
      queryClient.invalidateQueries({ queryKey: ["maandrapport"] });
    },
  });
}
