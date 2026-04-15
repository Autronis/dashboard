import { useQuery } from "@tanstack/react-query";

export interface BorgTransactie {
  id: number;
  datum: string;
  omschrijving: string;
  merchantNaam: string | null;
  bedrag: number;
  type: "bij" | "af";
  bank: string | null;
}

export interface Huurder {
  naam: string;
  borg: number;
  huurPerMaand: number;
  status: string;
}

export interface BorgenResponse {
  saldo: number;
  totaalUitgegeven: number;
  totaalOntvangen: number;
  aantalTransacties: number;
  uitgegeven: BorgTransactie[];
  ontvangen: BorgTransactie[];
  arrangement: {
    adres: string;
    totaalBorg: number;
    borgPerHuurder: number;
    huurPerHuurder: number;
    huurders: ReadonlyArray<Huurder>;
  };
}

export function useBorgen() {
  return useQuery<BorgenResponse>({
    queryKey: ["borgen"],
    queryFn: async () => {
      const res = await fetch("/api/financien/borgen");
      if (!res.ok) throw new Error("Kon borgen niet laden");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}
