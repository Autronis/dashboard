import { useQuery } from "@tanstack/react-query";

export interface FinancienTransactie {
  id: number;
  datum: string;
  omschrijving: string;
  bedrag: number;
  type: "bij" | "af";
  categorie: string | null;
  merchantNaam: string | null;
  aiBeschrijving: string | null;
  btwBedrag: number | null;
  status: "onbekend" | "gecategoriseerd" | "gematcht" | null;
  bank: string | null;
  fiscaalType: "investering" | "kosten" | "prive" | null;
  isAbonnement: number | null;
  gekoppeldFactuurId: number | null;
  storageUrl: string | null;
}

export interface TransactiesFilters {
  type: "bij" | "af";
  periode: "maand" | "kwartaal" | "jaar" | "alles";
  categorie?: string;
  zoek?: string;
}

export function useFinancienTransacties(filters: TransactiesFilters) {
  return useQuery<{ transacties: FinancienTransactie[]; aantal: number }>({
    queryKey: ["financien-transacties", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("type", filters.type);
      params.set("periode", filters.periode);
      if (filters.categorie && filters.categorie !== "alle") params.set("categorie", filters.categorie);
      if (filters.zoek) params.set("zoek", filters.zoek);
      const res = await fetch(`/api/financien/transacties?${params}`);
      if (!res.ok) throw new Error("Kon transacties niet laden");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export interface CategorieBreakdown {
  categorie: string;
  totaal: number;
  aantal: number;
  percentage: number;
}

export function useFinancienCategorieen(type: "bij" | "af", periode: string) {
  return useQuery<{ categorieen: CategorieBreakdown[]; totaal: number }>({
    queryKey: ["financien-categorieen", type, periode],
    queryFn: async () => {
      const res = await fetch(`/api/financien/categorieen?type=${type}&periode=${periode}`);
      if (!res.ok) throw new Error("Kon categorieen niet laden");
      return res.json();
    },
    staleTime: 30_000,
  });
}
