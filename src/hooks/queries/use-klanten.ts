import { useQuery } from "@tanstack/react-query";

export interface Klant {
  id: number;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  email: string | null;
  telefoon: string | null;
  adres: string | null;
  notities: string | null;
  uurtarief: number | null;
  isActief: number;
  isDemo: number | null;
  website: string | null;
  branche: string | null;
  kvkNummer: string | null;
  btwNummer: string | null;
  aantalMedewerkers: string | null;
  klantSinds: string | null;
  aantalProjecten: number;
  actieveProjecten: number;
  totaalMinuten: number;
  totaleOmzet: number;
  openstaand: number;
  effectiefUurtarief: number;
  gezondheid: "groen" | "oranje" | "rood";
  gezondheidReden: string;
  laatsteContact: string | null;
  laatsteFactuurDatum: string | null;
  laatsteFactuurBedrag: number | null;
  openstaandeOffertes: number;
  tags: string[];
}

export interface KlantenKpis {
  actieveKlanten: number;
  totaleOmzet: number;
  totaalOpenstaand: number;
  gezondheid: { groen: number; oranje: number; rood: number };
}

async function fetchKlanten(toonDemo: boolean): Promise<{ klanten: Klant[]; kpis: KlantenKpis }> {
  const params = new URLSearchParams();
  if (toonDemo) params.set("demo", "1");
  const res = await fetch(`/api/klanten?${params.toString()}`);
  if (!res.ok) throw new Error("Kon klanten niet laden");
  return res.json() as Promise<{ klanten: Klant[]; kpis: KlantenKpis }>;
}

export function useKlanten(toonDemo = false) {
  return useQuery({
    queryKey: ["klanten", { toonDemo }],
    queryFn: () => fetchKlanten(toonDemo),
    staleTime: 30_000,
  });
}
