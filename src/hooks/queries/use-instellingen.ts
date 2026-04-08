import { useQuery } from "@tanstack/react-query";

interface Bedrijf {
  id: number | null;
  bedrijfsnaam: string;
  adres: string;
  kvkNummer: string;
  btwNummer: string;
  iban: string;
  email: string;
  telefoon: string;
  website: string;
  standaardBtw: number;
  betalingstermijnDagen: number;
  herinneringNaDagen: number;
}

interface Profiel {
  id: number;
  naam: string;
  email: string;
  rol: string;
  uurtariefStandaard: number | null;
}

interface InstellingenData {
  bedrijf: Bedrijf;
  profiel: Profiel;
}

async function fetchInstellingen(): Promise<InstellingenData> {
  const [bedrijfRes, profielRes] = await Promise.all([
    fetch("/api/instellingen"),
    fetch("/api/profiel"),
  ]);

  if (!bedrijfRes.ok) throw new Error("Kon instellingen niet laden");
  if (!profielRes.ok) throw new Error("Kon profiel niet laden");

  const bedrijfJson = await bedrijfRes.json();
  const profielJson = await profielRes.json();

  const b = bedrijfJson.bedrijf;

  return {
    bedrijf: {
      ...b,
      adres: b.adres || "",
      kvkNummer: b.kvkNummer || "",
      btwNummer: b.btwNummer || "",
      iban: b.iban || "",
      email: b.email || "",
      telefoon: b.telefoon || "",
      website: b.website || "",
    },
    profiel: profielJson.gebruiker,
  };
}

export function useInstellingen() {
  return useQuery({
    queryKey: ["instellingen"],
    queryFn: fetchInstellingen,
    staleTime: 30_000,
  });
}

export type { Bedrijf, Profiel, InstellingenData };
