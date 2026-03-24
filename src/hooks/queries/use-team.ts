"use client";

import { useQuery } from "@tanstack/react-query";

// ============ TYPES ============

export interface VerlofEntry {
  id: number;
  gebruikerId: number | null;
  gebruikerNaam: string | null;
  startDatum: string;
  eindDatum: string;
  type: string | null;
  status: string | null;
  notities: string | null;
  beoordeeldDoor: number | null;
  aangemaaktOp: string | null;
}

export interface Feestdag {
  id: number;
  naam: string;
  datum: string;
  jaar: number;
}

export interface Declaratie {
  id: number;
  gebruikerId: number | null;
  gebruikerNaam: string | null;
  datum: string;
  omschrijving: string;
  bedrag: number;
  categorie: string | null;
  bonnetjeUrl: string | null;
  status: string | null;
  beoordeeldDoor: number | null;
  aangemaaktOp: string | null;
}

export interface CapaciteitUser {
  gebruikerId: number;
  naam: string;
  basisUren: number;
  feestdagUren: number;
  verlofUren: number;
  beschikbaarUren: number;
  geplandUren: number;
  percentage: number;
}

export interface CapaciteitData {
  capaciteit: CapaciteitUser[];
  week: number;
  jaar: number;
  maandag: string;
  zondag: string;
  feestdagen: Feestdag[];
}

export interface CurrentUser {
  id: number;
  naam: string;
}

// ============ HOOKS ============

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await fetch("/api/profiel");
      if (!res.ok) return null;
      const data = await res.json();
      return data.gebruiker ? { id: data.gebruiker.id, naam: data.gebruiker.naam } : null;
    },
    staleTime: 60_000,
  });
}

export function useVerlof(jaar: number) {
  return useQuery<{ verlof: VerlofEntry[]; feestdagen: Feestdag[] }>({
    queryKey: ["team", "verlof", jaar],
    queryFn: async () => {
      const [verlofRes, feestdagenRes] = await Promise.all([
        fetch(`/api/team/verlof?jaar=${jaar}`),
        fetch(`/api/team/feestdagen?jaar=${jaar}`),
      ]);

      let verlof: VerlofEntry[] = [];
      let feestdagen: Feestdag[] = [];

      if (verlofRes.ok) {
        const data = await verlofRes.json();
        verlof = data.verlof;
      }

      if (feestdagenRes.ok) {
        const data = await feestdagenRes.json();
        feestdagen = data.feestdagen;
      } else {
        // Try to seed feestdagen
        const seedRes = await fetch("/api/team/feestdagen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jaar }),
        });
        if (seedRes.ok) {
          const data = await seedRes.json();
          feestdagen = data.feestdagen;
        }
      }

      return { verlof, feestdagen };
    },
    staleTime: 30_000,
  });
}

export function useDeclaraties(statusFilter: string) {
  return useQuery<{ declaraties: Declaratie[]; totaalUitstaand: number }>({
    queryKey: ["team", "declaraties", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "alle") params.set("status", statusFilter);
      const res = await fetch(`/api/team/declaraties?${params}`);
      if (!res.ok) throw new Error("Kon declaraties niet laden");
      const data = await res.json();
      return { declaraties: data.declaraties, totaalUitstaand: data.totaalUitstaand };
    },
    staleTime: 30_000,
  });
}

export function useCapaciteit(week: number, jaar: number) {
  return useQuery<CapaciteitData>({
    queryKey: ["team", "capaciteit", week, jaar],
    queryFn: async () => {
      const res = await fetch(`/api/team/capaciteit?week=${week}&jaar=${jaar}`);
      if (!res.ok) throw new Error("Kon capaciteit niet laden");
      return res.json();
    },
    staleTime: 300_000,
  });
}
