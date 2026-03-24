import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Abonnement {
  id: number;
  naam: string;
  leverancier: string | null;
  bedrag: number;
  frequentie: string;
  categorie: string;
  startDatum: string | null;
  volgendeBetaling: string | null;
  projectId: number | null;
  projectNaam: string | null;
  url: string | null;
  notities: string | null;
  isActief: number | null;
}

export interface AbonnementenTotalen {
  maandelijks: number;
  jaarlijks: number;
  aantal: number;
  aankomend: number;
}

interface AbonnementenResponse {
  abonnementen: Abonnement[];
  totalen: AbonnementenTotalen;
}

async function fetchAbonnementen(): Promise<AbonnementenResponse> {
  const res = await fetch("/api/abonnementen");
  if (!res.ok) throw new Error("Kon abonnementen niet laden");
  return res.json();
}

export function useAbonnementen() {
  return useQuery({
    queryKey: ["abonnementen"],
    queryFn: fetchAbonnementen,
    staleTime: 30_000,
  });
}

export function useCreateAbonnement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Abonnement>) => {
      const res = await fetch("/api/abonnementen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json() as { fout?: string };
        throw new Error(json.fout ?? "Aanmaken mislukt");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["abonnementen"] }),
  });
}

export function useUpdateAbonnement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Abonnement> & { id: number }) => {
      const res = await fetch(`/api/abonnementen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Bijwerken mislukt");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["abonnementen"] }),
  });
}

export function useDeleteAbonnement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/abonnementen/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Verwijderen mislukt");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["abonnementen"] }),
  });
}
