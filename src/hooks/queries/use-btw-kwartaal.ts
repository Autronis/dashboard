import { useQuery } from "@tanstack/react-query";

export interface BtwKwartaal {
  kwartaal: number;
  label: string;
  startDatum: string;
  eindDatum: string;
  status: "leeg" | "huidig" | "klaar" | "aangedaan";
  inkomsten: number;
  uitgaven: number;
  btwAfgedragen: number;
  btwTerug: number;
  teBetalen: number;
  itemsTeVerwerken: number;
  totaalItems: number;
}

export interface BtwKwartaalResponse {
  jaar: number;
  kwartalen: BtwKwartaal[];
}

export function useBtwKwartaal(jaar?: number) {
  const j = jaar ?? new Date().getFullYear();
  return useQuery<BtwKwartaalResponse>({
    queryKey: ["btw-kwartaal", j],
    queryFn: async () => {
      const res = await fetch(`/api/financien/btw-kwartaal?jaar=${j}`);
      if (!res.ok) throw new Error("Kon BTW kwartaal niet laden");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}
