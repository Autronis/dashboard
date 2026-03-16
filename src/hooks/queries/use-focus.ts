import { useQuery } from "@tanstack/react-query";
import type { FocusSessie, FocusStatistieken } from "@/types";

export function useFocusSessies(van?: string, tot?: string) {
  return useQuery<{ sessies: FocusSessie[] }>({
    queryKey: ["focus-sessies", van, tot],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (van) params.set("van", van);
      if (tot) params.set("tot", tot);
      const res = await fetch(`/api/focus?${params}`);
      if (!res.ok) throw new Error("Focus sessies ophalen mislukt");
      return res.json();
    },
  });
}

export function useFocusStatistieken() {
  return useQuery<FocusStatistieken>({
    queryKey: ["focus-statistieken"],
    queryFn: async () => {
      const res = await fetch("/api/focus/statistieken");
      if (!res.ok) throw new Error("Focus statistieken ophalen mislukt");
      return res.json();
    },
    refetchInterval: 60000,
  });
}
