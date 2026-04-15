import { useQuery } from "@tanstack/react-query";

export interface PartnerSaldo {
  ingelegd: number;
  eigenUitgaven: number;
  aandeelTeam: number;
  saldo: number;
}

export interface KapitaalrekeningResponse {
  jaar: number;
  sem: PartnerSaldo;
  syb: PartnerSaldo;
  teamUitgaven: number;
  verrekening: {
    van: "sem" | "syb" | null;
    naar: "sem" | "syb" | null;
    bedrag: number;
  };
  ongetagdStorting: number;
  ongetagdEigen: number;
}

export function useKapitaalrekening(jaar?: number) {
  const j = jaar ?? new Date().getFullYear();
  return useQuery<KapitaalrekeningResponse>({
    queryKey: ["kapitaalrekening", j],
    queryFn: async () => {
      const res = await fetch(`/api/financien/kapitaalrekening?jaar=${j}`);
      if (!res.ok) throw new Error("Kon kapitaalrekening niet laden");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}
