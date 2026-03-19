import { useQuery } from "@tanstack/react-query";

interface MaandData {
  maand: string;
  label: string;
  omzet: number;
  uren: number;
}

interface ProjectData {
  projectNaam: string;
  klantNaam: string;
  uren: number;
  omzet: number;
}

interface GebruikerData {
  naam: string;
  uren: number;
  omzet: number;
}

interface AnalyticsData {
  kpis: {
    omzetDitJaar: number;
    omzetVorigJaar: number;
    urenDitJaar: number;
    gemiddeldUurtarief: number;
    actieveKlanten: number;
  };
  maanden: MaandData[];
  topProjecten: ProjectData[];
  perGebruiker: GebruikerData[];
}

interface HeatmapItem {
  datum: string;
  uren: number;
}

interface VergelijkGebruiker {
  id: number;
  naam: string;
  urenDezeMaand: number;
  omzetDezeMaand: number;
  takenAfgerond: number;
  actieveProjecten: number;
}

async function fetchAnalytics(jaar: number): Promise<AnalyticsData> {
  const res = await fetch(`/api/analytics?jaar=${jaar}`);
  if (!res.ok) throw new Error("Analytics laden mislukt");
  return res.json();
}

async function fetchHeatmap(): Promise<HeatmapItem[]> {
  const res = await fetch("/api/analytics/heatmap");
  if (!res.ok) return [];
  const json = (await res.json()) as { data: HeatmapItem[] };
  return json.data || [];
}

async function fetchVergelijk(): Promise<VergelijkGebruiker[]> {
  const res = await fetch("/api/analytics/vergelijk");
  if (!res.ok) return [];
  const json = (await res.json()) as { gebruikers: VergelijkGebruiker[] };
  return json.gebruikers || [];
}

export function useAnalytics(jaar: number) {
  return useQuery({
    queryKey: ["analytics", jaar],
    queryFn: () => fetchAnalytics(jaar),
    staleTime: 30_000,
  });
}

export function useHeatmap() {
  return useQuery({
    queryKey: ["analytics", "heatmap"],
    queryFn: fetchHeatmap,
    staleTime: 30_000,
  });
}

export function useVergelijk() {
  return useQuery({
    queryKey: ["analytics", "vergelijk"],
    queryFn: fetchVergelijk,
    staleTime: 30_000,
  });
}

// --- Forecast types & hook ---
interface ForecastMaand {
  maand: string;
  label: string;
  bestCase: number;
  verwacht: number;
  worstCase: number;
}

interface ForecastData {
  zekereOmzet: number;
  verwachteOmzetPerMaand: number;
  gemiddeldUurtarief: number;
  restUren: number;
  omzetTotNu: number;
  jaardoel: number;
  benodigdPerMaand: number;
  opKoers: boolean;
  maanden: ForecastMaand[];
}

async function fetchForecast(): Promise<ForecastData> {
  const res = await fetch("/api/analytics/forecast");
  if (!res.ok) throw new Error("Forecast laden mislukt");
  return res.json();
}

export function useForecast() {
  return useQuery({
    queryKey: ["analytics", "forecast"],
    queryFn: fetchForecast,
    staleTime: 60_000,
  });
}

// --- Runway types & hook ---
interface RunwayProjectie {
  maand: string;
  saldo: number;
  inkomsten: number;
  kosten: number;
}

interface RunwayData {
  huidigSaldo: number;
  gemiddeldeKostenPerMaand: number;
  gemiddeldeInkomstenPerMaand: number;
  nettoPerMaand: number;
  runwayMaanden: number | null;
  projectie: RunwayProjectie[];
}

async function fetchRunway(): Promise<RunwayData> {
  const res = await fetch("/api/analytics/runway");
  if (!res.ok) throw new Error("Runway laden mislukt");
  return res.json();
}

export function useRunway() {
  return useQuery({
    queryKey: ["analytics", "runway"],
    queryFn: fetchRunway,
    staleTime: 60_000,
  });
}

// --- Inzichten types & hook ---
interface Inzicht {
  tekst: string;
  type: "positief" | "waarschuwing" | "info";
  metric?: string;
}

interface InzichtenData {
  inzichten: Inzicht[];
}

async function fetchInzichten(): Promise<Inzicht[]> {
  const res = await fetch("/api/analytics/inzichten");
  if (!res.ok) throw new Error("Inzichten laden mislukt");
  const json = (await res.json()) as InzichtenData;
  return json.inzichten || [];
}

export function useInzichten() {
  return useQuery({
    queryKey: ["analytics", "inzichten"],
    queryFn: fetchInzichten,
    staleTime: 60_000,
  });
}

// --- MaandRapport types & hook ---
interface KlantRapport {
  naam: string;
  omzet: number;
  uren: number;
  uurtarief: number;
}

interface ProjectRapport {
  naam: string;
  klant: string;
  uren: number;
  omzet: number;
}

interface MaandRapport {
  periode: string;
  omzet: number;
  uren: number;
  gemiddeldUurtarief: number;
  billablePercentage: number;
  klanten: KlantRapport[];
  topProjecten: ProjectRapport[];
  vergelijkingVorigeMaand: { omzetDelta: number; urenDelta: number };
  samenvatting: string;
}

interface MaandRapportResponse {
  rapport: MaandRapport;
}

async function fetchMaandRapport(maand: string): Promise<MaandRapport> {
  const res = await fetch(`/api/analytics/rapport?maand=${maand}`);
  if (!res.ok) throw new Error("Maandrapport laden mislukt");
  const json = (await res.json()) as MaandRapportResponse;
  return json.rapport;
}

export function useMaandRapport(maand: string) {
  return useQuery({
    queryKey: ["analytics", "rapport", maand],
    queryFn: () => fetchMaandRapport(maand),
    staleTime: 60_000,
    enabled: !!maand,
  });
}

// --- Decision Engine types & hook ---
interface DecisionClientShare {
  naam: string;
  omzet: number;
  uren: number;
  percentage: number;
  uurtariefEffectief: number;
}

interface DecisionRateEntry {
  naam: string;
  doelTarief: number;
  effectiefTarief: number;
  uren: number;
  gap: number;
  misgelopen: number;
}

interface DecisionProjectInsight {
  naam: string;
  klant: string;
  uren: number;
  omzet: number;
  geschatteUren: number;
  euroPerUur: number;
  overBudgetPct: number | null;
  deadline: string | null;
  waarde: "hoog" | "gemiddeld" | "laag";
}

interface DecisionPipelineItem {
  id: number;
  klant: string;
  titel: string;
  bedrag: number;
  status: string;
  geldigTot: string | null;
  kans: number;
}

interface DecisionGoal {
  doel: string;
  huidig: number;
  target: number;
  gap: number;
  actie: string;
  percentage: number;
}

interface DecisionForecastMaand {
  maand: string;
  label: string;
  bestCase: number;
  verwacht: number;
  worstCase: number;
  confidence: number;
}

interface DecisionInsight {
  tekst: string;
  type: "positief" | "waarschuwing" | "kritiek" | "actie";
  impact?: string;
}

interface DecisionAction {
  actie: string;
  impact: string;
  prioriteit: "hoog" | "gemiddeld" | "laag";
  categorie: string;
}

interface DecisionEngineData {
  aiInsights: DecisionInsight[];
  nextActions: DecisionAction[];
  clientDependency: {
    hhi: number;
    topClientPct: number;
    riskLevel: "laag" | "gemiddeld" | "hoog";
    clients: DecisionClientShare[];
  };
  rateAnalysis: DecisionRateEntry[];
  efficiency: {
    revenuePerHour: number;
    billablePercent: number;
    nonBillableUren: number;
    lostRevenue: number;
    totaleUren: number;
    totaleOmzet: number;
  };
  projectInsights: DecisionProjectInsight[];
  actionableGoals: DecisionGoal[];
  pipeline: {
    totaal: number;
    gewogen: number;
    items: DecisionPipelineItem[];
  };
  cashflow: {
    uitstaand: number;
    overdue: number;
    overdueCount: number;
    gemInkomsten: number;
    gemKosten: number;
    nettoPerMaand: number;
    runwayMaanden: number | null;
    kostenJaar: number;
  };
  forecast: {
    omzetTotNu: number;
    jaardoel: number;
    benodigdPerMaand: number;
    gemOmzetPerMaand: number;
    confidence: number;
    opKoers: boolean;
    maanden: DecisionForecastMaand[];
    restWaarde: number;
  };
}

async function fetchDecisionEngine(): Promise<DecisionEngineData> {
  const res = await fetch("/api/analytics/decision-engine");
  if (!res.ok) throw new Error("Decision engine laden mislukt");
  return res.json();
}

export function useDecisionEngine() {
  return useQuery({
    queryKey: ["analytics", "decision-engine"],
    queryFn: fetchDecisionEngine,
    staleTime: 60_000,
  });
}

export type {
  AnalyticsData, MaandData, ProjectData, GebruikerData, HeatmapItem, VergelijkGebruiker,
  ForecastData, ForecastMaand, RunwayData, RunwayProjectie,
  Inzicht, InzichtenData, MaandRapport, KlantRapport, ProjectRapport,
  DecisionEngineData, DecisionInsight, DecisionAction, DecisionClientShare,
  DecisionRateEntry, DecisionProjectInsight, DecisionPipelineItem,
  DecisionGoal, DecisionForecastMaand,
};
