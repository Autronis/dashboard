import { useQuery } from "@tanstack/react-query";

interface Klant {
  id: number;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  email: string | null;
  telefoon: string | null;
  adres: string | null;
  uurtarief: number | null;
  notities: string | null;
  website: string | null;
  branche: string | null;
  kvkNummer: string | null;
  btwNummer: string | null;
  aantalMedewerkers: string | null;
  diensten: string | null;
  techStack: string | null;
  klantSinds: string | null;
  aiVerrijktOp: string | null;
  isDemo: number | null;
}

interface Project {
  id: number;
  naam: string;
  omschrijving: string | null;
  status: string;
  voortgangPercentage: number | null;
  werkelijkeMinuten: number;
  geschatteUren: number | null;
  deadline: string | null;
  isActief: number;
}

interface Notitie {
  id: number;
  inhoud: string;
  type: string;
  aangemaaktOp: string;
}

interface DocumentItem {
  id: number;
  naam: string;
  url: string | null;
  type: string;
  aangemaaktOp: string;
}

interface Tijdregistratie {
  id: number;
  omschrijving: string;
  projectNaam: string | null;
  startTijd: string;
  duurMinuten: number;
  categorie: string | null;
}

interface FactuurItem {
  id: number;
  factuurnummer: string;
  status: string | null;
  bedragInclBtw: number | null;
  factuurdatum: string | null;
  vervaldatum: string | null;
  betaaldOp: string | null;
}

interface OfferteItem {
  id: number;
  offertenummer: string;
  titel: string | null;
  status: string | null;
  bedragInclBtw: number | null;
  datum: string | null;
  geldigTot: string | null;
}

interface MeetingItem {
  id: number;
  titel: string;
  datum: string;
  duurMinuten: number | null;
  samenvatting: string | null;
}

interface TijdlijnItem {
  id: string;
  type: "factuur" | "offerte" | "meeting" | "notitie" | "tijdregistratie";
  datum: string;
  titel: string;
  details: string | null;
  status?: string;
  bedrag?: number | null;
}

interface KlantKpis {
  aantalProjecten: number;
  totaalMinuten: number;
  omzet: number;
  uurtarief: number;
  openstaand: number;
  gemiddeldFactuurbedrag: number;
  gemiddeldeBetalingsDagen: number | null;
  aantalFacturen: number;
  aantalOffertes: number;
}

interface KlantData {
  klant: Klant;
  projecten: Project[];
  notities: Notitie[];
  documenten: DocumentItem[];
  recenteTijdregistraties: Tijdregistratie[];
  facturen: FactuurItem[];
  offertes: OfferteItem[];
  meetings: MeetingItem[];
  tijdlijn: TijdlijnItem[];
  kpis: KlantKpis;
}

async function fetchKlantDetail(id: number): Promise<KlantData> {
  const res = await fetch(`/api/klanten/${id}`);
  if (res.status === 404) throw new NotFoundError();
  if (!res.ok) throw new Error("Fout bij ophalen klantgegevens");
  return res.json();
}

export class NotFoundError extends Error {
  constructor() {
    super("Klant niet gevonden");
    this.name = "NotFoundError";
  }
}

export function useKlantDetail(id: number) {
  return useQuery({
    queryKey: ["klant", id],
    queryFn: () => fetchKlantDetail(id),
    staleTime: 30_000,
    enabled: id > 0,
  });
}

export type { KlantData, Klant, Project, Notitie, DocumentItem, Tijdregistratie, FactuurItem, OfferteItem, MeetingItem, TijdlijnItem, KlantKpis };
