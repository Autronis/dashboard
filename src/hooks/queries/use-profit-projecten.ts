import { useQuery } from "@tanstack/react-query";

export interface ProfitProject {
  id: number;
  naam: string;
  status: string | null;
  klantNaam: string | null;
  omzet: number;
  uren: number;
  uurtarief: number;
  kostenUren: number;
  profit: number;
  marge: number | null;
  geschatteUren: number | null;
  werkelijkeUren: number | null;
  voortgang: number | null;
}

interface ProfitTotalen {
  omzet: number;
  kostenUren: number;
  profit: number;
  uren: number;
}

interface ProfitResponse {
  projecten: ProfitProject[];
  totalen: ProfitTotalen;
}

export function useProfitPerProject() {
  return useQuery<ProfitResponse>({
    queryKey: ["profit-per-project"],
    queryFn: async () => {
      const res = await fetch("/api/financien/profit-per-project");
      if (!res.ok) throw new Error("Kan profit data niet ophalen");
      return res.json() as Promise<ProfitResponse>;
    },
    staleTime: 5 * 60 * 1000,
  });
}
