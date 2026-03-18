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
  aantalProjecten: number;
  actieveProjecten: number;
  totaalMinuten: number;
  totaleOmzet: number;
  openstaand: number;
  effectiefUurtarief: number;
  gezondheid: "groen" | "oranje" | "rood";
  gezondheidReden: string;
  laatsteContact: string | null;
}

export interface KlantenKpis {
  actieveKlanten: number;
  totaleOmzet: number;
  totaalOpenstaand: number;
  gezondheid: { groen: number; oranje: number; rood: number };
}

async function fetchKlanten(): Promise<{ klanten: Klant[]; kpis: KlantenKpis }> {
  const res = await fetch("/api/klanten");
  if (!res.ok) throw new Error("Kon klanten niet laden");
  return res.json() as Promise<{ klanten: Klant[]; kpis: KlantenKpis }>;
}

export function useKlanten() {
  return useQuery({
    queryKey: ["klanten"],
    queryFn: fetchKlanten,
    staleTime: 30_000,
  });
}
