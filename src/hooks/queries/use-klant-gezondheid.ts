import { useQuery } from "@tanstack/react-query";

export interface KlantHealthScore {
  klantId: number;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  email: string | null;
  branche: string | null;
  klantSinds: string | null;
  totaalScore: number;
  communicatieScore: number;
  betalingScore: number;
  projectScore: number;
  tevredenheidScore: number;
  activiteitScore: number;
  trend: number | null;
  details: {
    communicatie: Record<string, unknown>;
    betaling: Record<string, unknown>;
    project: Record<string, unknown>;
    tevredenheid: Record<string, unknown>;
    activiteit: Record<string, unknown>;
  };
}

export interface GezondheidsKpis {
  totaalKlanten: number;
  gemiddeldeScore: number;
  kritiek: number;
  risico: number;
  aandacht: number;
  gezond: number;
}

async function fetchGezondheid(): Promise<{
  klanten: KlantHealthScore[];
  kpis: GezondheidsKpis;
}> {
  const res = await fetch("/api/klant-gezondheid");
  if (!res.ok) throw new Error("Kon gezondheidsscores niet laden");
  return res.json();
}

export function useKlantGezondheid() {
  return useQuery({
    queryKey: ["klant-gezondheid"],
    queryFn: fetchGezondheid,
    staleTime: 60_000,
  });
}
