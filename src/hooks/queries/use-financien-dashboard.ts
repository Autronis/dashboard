import { useQuery } from "@tanstack/react-query";

export interface FinancienDashboard {
  inkomstenMaand: number;
  uitgavenMaand: number;
  inkomstenDelta: number | null;
  uitgavenDelta: number | null;
  btwTerugTeVragen: number;
  btwTeVerwerken: number;
  huidigKwartaal: string;
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
