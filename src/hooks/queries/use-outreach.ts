import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface OutreachEmail {
  id: number;
  sequentieId: number;
  stapNummer: number;
  onderwerp: string;
  inhoud: string;
  geplandOp: string | null;
  verstuurdOp: string | null;
  geopendOp: string | null;
  gekliktOp: string | null;
  beantwoordOp: string | null;
  bouncedOp: string | null;
  status: string;
  trackingId: string;
  sesMessageId: string | null;
  aangemaaktOp: string | null;
}

interface SequentieListItem {
  id: number;
  leadId: number | null;
  scanId: number | null;
  domeinId: number | null;
  status: string;
  abVariant: string | null;
  aangemaaktOp: string | null;
  bedrijfsnaam: string | null;
  contactpersoon: string | null;
  email: string | null;
  domein: string | null;
  totaalEmails: number;
  verstuurd: number;
  geopend: number;
  geklikt: number;
  beantwoord: number;
  bounced: number;
}

interface OutreachKPIs {
  totaalSequenties: number;
  actief: number;
  verstuurd: number;
  geopend: number;
  geklikt: number;
  beantwoord: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

interface OutreachListData {
  sequenties: SequentieListItem[];
  kpis: OutreachKPIs;
}

interface SequentieDetail {
  sequentie: {
    id: number;
    leadId: number | null;
    scanId: number | null;
    domeinId: number | null;
    status: string;
    abVariant: string | null;
    aangemaaktOp: string | null;
    bijgewerktOp: string | null;
  };
  lead: {
    id: number;
    bedrijfsnaam: string;
    contactpersoon: string | null;
    email: string | null;
  } | null;
  domein: {
    id: number;
    emailAdres: string;
    displayNaam: string;
    domein: string;
  } | null;
  scan: {
    id: number;
    websiteUrl: string;
    samenvatting: string | null;
  } | null;
  emails: OutreachEmail[];
}

interface OutreachDomein {
  id: number;
  domein: string;
  emailAdres: string;
  displayNaam: string;
  sesConfigured: number | null;
  dagLimiet: number | null;
  vandaagVerstuurd: number | null;
  isActief: number | null;
  aangemaaktOp: string | null;
}

async function fetchOutreach(status?: string): Promise<OutreachListData> {
  const params = new URLSearchParams();
  if (status && status !== "alle") params.set("status", status);
  const res = await fetch(`/api/outreach?${params}`);
  if (!res.ok) throw new Error("Kon outreach data niet laden");
  return res.json();
}

async function fetchSequentieDetail(id: number): Promise<SequentieDetail> {
  const res = await fetch(`/api/outreach/${id}`);
  if (!res.ok) throw new Error("Kon sequentie niet laden");
  return res.json();
}

async function fetchDomeinen(): Promise<{ domeinen: OutreachDomein[] }> {
  const res = await fetch("/api/outreach/domeinen");
  if (!res.ok) throw new Error("Kon domeinen niet laden");
  return res.json();
}

export function useOutreach(status?: string) {
  return useQuery({
    queryKey: ["outreach", status],
    queryFn: () => fetchOutreach(status),
    staleTime: 30_000,
  });
}

export function useOutreachDetail(id: number | null) {
  return useQuery({
    queryKey: ["outreach-detail", id],
    queryFn: () => fetchSequentieDetail(id!),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useOutreachDomeinen() {
  return useQuery({
    queryKey: ["outreach-domeinen"],
    queryFn: fetchDomeinen,
    staleTime: 60_000,
  });
}

export function useGenerateOutreach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scanId: number) => {
      const res = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Generatie mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach"] });
    },
  });
}

export function useActivateSequentie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/outreach/${id}/activate`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Activatie mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach"] });
    },
  });
}

export function usePauseSequentie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/outreach/${id}/pause`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Pauzeren mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach"] });
    },
  });
}

export type { SequentieListItem, OutreachKPIs, OutreachListData, SequentieDetail, OutreachEmail, OutreachDomein };
