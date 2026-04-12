import { useQuery } from "@tanstack/react-query";

export interface FinancienDashboard {
  inkomstenMaand: number;
  uitgavenMaand: number;
  inkomstenDelta: number | null;
  uitgavenDelta: number | null;
  netto: number;
  nettoDelta: number | null;
  btwTerugTeVragen: number;
  btwAfTeDragen: number;
  btwTeVerwerken: number;
  huidigKwartaal: string;
  inkomstenSparkline: number[];
  uitgavenSparkline: number[];
}

export function useFinancienDashboard() {
  return useQuery<FinancienDashboard>({
    queryKey: ["financien-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/financien/dashboard");
      if (!res.ok) throw new Error("Kon financien dashboard niet laden");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
