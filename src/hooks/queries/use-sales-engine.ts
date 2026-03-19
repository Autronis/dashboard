import { useQuery } from "@tanstack/react-query";

interface ScanListItem {
  id: number;
  leadId: number | null;
  websiteUrl: string;
  samenvatting: string | null;
  status: string;
  foutmelding: string | null;
  aangemaaktOp: string | null;
  bedrijfsnaam: string | null;
  contactpersoon: string | null;
  email: string | null;
  aantalKansen: number;
  hoogsteImpact: string | null;
}

interface ScanKPIs {
  totaal: number;
  dezeWeek: number;
  succesRatio: number;
  failed: number;
}

interface ScanListData {
  scans: ScanListItem[];
  kpis: ScanKPIs;
}

interface ScanKans {
  id: number;
  scanId: number;
  titel: string;
  beschrijving: string;
  categorie: string;
  impact: string;
  geschatteTijdsbesparing: string | null;
  geschatteKosten: string | null;
  geschatteBesparing: string | null;
  implementatieEffort: string | null;
  prioriteit: number;
}

interface ScrapeResultaat {
  homepage: {
    url: string;
    title: string;
    metaDescription: string;
    headings: string[];
    bodyText: string;
  };
  subpaginas: Array<{
    url: string;
    title: string;
    headings: string[];
    bodyText: string;
  }>;
  techStack: string[];
  formulieren: string[];
  chatWidgets: string[];
  socialMedia: Record<string, string>;
}

interface BedrijfsProfiel {
  branche: string;
  watZeDoen: string;
  doelgroep: string;
}

interface AIAnalyse {
  bedrijfsProfiel: BedrijfsProfiel;
  kansen: Array<{
    titel: string;
    beschrijving: string;
    categorie: string;
    impact: string;
    geschatteTijdsbesparing: string;
    geschatteKosten: string;
    geschatteBesparing: string;
    implementatieEffort: string;
    prioriteit: number;
  }>;
  samenvatting: string;
  automationReadinessScore: number;
  concurrentiePositie: string;
  aanbevolenPakket: string;
}

interface ScanDetail {
  scan: {
    id: number;
    leadId: number | null;
    websiteUrl: string;
    bedrijfsgrootte: string | null;
    rol: string | null;
    grootsteKnelpunt: string | null;
    huidigeTools: string | null;
    opmerkingen: string | null;
    scrapeResultaat: ScrapeResultaat | null;
    aiAnalyse: AIAnalyse | null;
    samenvatting: string | null;
    status: string;
    foutmelding: string | null;
    automationReadinessScore: number | null;
    aanbevolenPakket: string | null;
    aangemaaktOp: string | null;
    bijgewerktOp: string | null;
  };
  lead: {
    id: number;
    bedrijfsnaam: string;
    contactpersoon: string | null;
    email: string | null;
  } | null;
  kansen: ScanKans[];
}

async function fetchScans(status?: string): Promise<ScanListData> {
  const params = new URLSearchParams();
  if (status && status !== "alle") params.set("status", status);
  const res = await fetch(`/api/sales-engine?${params}`);
  if (!res.ok) throw new Error("Kon scans niet laden");
  return res.json();
}

async function fetchScanDetail(id: number): Promise<ScanDetail> {
  const res = await fetch(`/api/sales-engine/${id}`);
  if (!res.ok) throw new Error("Kon scan niet laden");
  return res.json();
}

export function useSalesEngineScans(status?: string) {
  return useQuery({
    queryKey: ["sales-engine-scans", status],
    queryFn: () => fetchScans(status),
    staleTime: 30_000,
  });
}

export function useSalesEngineScanDetail(id: number | null) {
  return useQuery({
    queryKey: ["sales-engine-scan", id],
    queryFn: () => fetchScanDetail(id!),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

interface BatchStatus {
  batchId: string;
  totaal: number;
  completed: number;
  pending: number;
  failed: number;
  scans: Array<{
    id: number;
    bedrijfsnaam: string;
    status: string;
    websiteUrl: string;
  }>;
}

async function fetchBatchStatus(batchId: string): Promise<BatchStatus> {
  const res = await fetch(`/api/sales-engine/batch/${batchId}`);
  if (!res.ok) throw new Error("Kon batch status niet laden");
  return res.json();
}

export function useSalesEngineBatch(batchId: string | null) {
  return useQuery({
    queryKey: ["sales-engine-batch", batchId],
    queryFn: () => fetchBatchStatus(batchId!),
    enabled: batchId !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      return data.pending > 0 ? 3000 : false;
    },
    staleTime: 0,
  });
}

export type { ScanListItem, ScanKPIs, ScanListData, ScanKans, ScanDetail, ScrapeResultaat, AIAnalyse, BedrijfsProfiel, BatchStatus };
