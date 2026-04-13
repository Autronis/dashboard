import { useQuery } from "@tanstack/react-query";

interface VergelijkGebruiker {
  id: number;
  naam: string;
  urenDezeMaand: number;
  omzetDezeMaand: number;
  takenAfgerond: number;
  actieveProjecten: number;
}

async function fetchVergelijk(): Promise<VergelijkGebruiker[]> {
  const res = await fetch("/api/analytics/vergelijk");
  if (!res.ok) return [];
  const json = (await res.json()) as { gebruikers: VergelijkGebruiker[] };
  return json.gebruikers || [];
}

export function useVergelijk() {
  return useQuery({
    queryKey: ["analytics", "vergelijk"],
    queryFn: fetchVergelijk,
    staleTime: 30_000,
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
  VergelijkGebruiker,
  DecisionEngineData, DecisionInsight, DecisionAction, DecisionClientShare,
  DecisionRateEntry, DecisionProjectInsight, DecisionPipelineItem,
  DecisionGoal, DecisionForecastMaand,
};
