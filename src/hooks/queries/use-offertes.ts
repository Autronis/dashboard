"use client";

import { useQuery } from "@tanstack/react-query";

export interface Offerte {
  id: number;
  offertenummer: string;
  titel: string | null;
  klantId: number;
  klantNaam: string;
  status: string;
  datum: string | null;
  geldigTot: string | null;
  bedragExclBtw: number | null;
  btwBedrag: number | null;
  bedragInclBtw: number | null;
  aangemaaktOp: string | null;
  bijgewerktOp: string | null;
  herinneringVerstuurdOp: string | null;
}

export interface OfferteKPIs {
  openstaandCount: number;
  openstaandWaarde: number;
  geaccepteerdDezeMaand: number;
  winRate: number;
  winRateVorigeMaand: number | null;
  totaalGeaccepteerd: number;
  totaalAfgewezen: number;
  statusCounts: Record<string, number>;
}

export function useOffertes(statusFilter: string, zoek: string) {
  return useQuery<{ offertes: Offerte[]; kpis: OfferteKPIs }>({
    queryKey: ["offertes", statusFilter, zoek],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "alle") params.set("status", statusFilter);
      if (zoek) params.set("zoek", zoek);
      const res = await fetch(`/api/offertes?${params}`);
      if (!res.ok) throw new Error("Kon offertes niet laden");
      return res.json();
    },
    staleTime: 30_000,
  });
}
