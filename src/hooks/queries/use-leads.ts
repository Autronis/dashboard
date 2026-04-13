import { useQuery } from "@tanstack/react-query";

interface Lead {
  id: number;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  email: string | null;
  telefoon: string | null;
  waarde: number | null;
  status: string;
  bron: string | null;
  notities: string | null;
  volgendeActie: string | null;
  volgendeActieDatum: string | null;
  aangemaaktOp: string | null;
}

interface KPIs {
  totaal: number;
  nieuw: number;
  contact: number;
  offerte: number;
  gewonnen: number;
  verloren: number;
  pipelineWaarde: number;
  gewonnenWaarde: number;
}

interface LeadsData {
  leads: Lead[];
  kpis: KPIs;
}

interface Activiteit {
  id: number;
  leadId: number;
  gebruikerId: number | null;
  type: string;
  titel: string;
  omschrijving: string | null;
  oudeStatus: string | null;
  nieuweStatus: string | null;
  aangemaaktOp: string | null;
}

async function fetchLeads(zoek: string): Promise<LeadsData> {
  const params = new URLSearchParams();
  if (zoek) params.set("zoek", zoek);
  const res = await fetch(`/api/klant-leads?${params}`);
  if (!res.ok) throw new Error("Kon leads niet laden");
  return res.json();
}

async function fetchActiviteiten(leadId: number): Promise<Activiteit[]> {
  const res = await fetch(`/api/klant-leads/${leadId}/activiteiten`);
  if (!res.ok) throw new Error("Kon activiteiten niet laden");
  const json = await res.json();
  return json.activiteiten;
}

async function fetchAfzenderEmail(): Promise<string> {
  const res = await fetch("/api/instellingen");
  if (!res.ok) throw new Error("Kon instellingen niet laden");
  const data = await res.json();
  return data.instellingen?.email || "";
}

export function useLeads(zoek: string) {
  return useQuery({
    queryKey: ["leads", zoek],
    queryFn: () => fetchLeads(zoek),
    staleTime: 30_000,
  });
}

export function useLeadActiviteiten(leadId: number | null) {
  return useQuery({
    queryKey: ["lead-activiteiten", leadId],
    queryFn: () => fetchActiviteiten(leadId!),
    enabled: leadId !== null,
    staleTime: 30_000,
  });
}

export function useAfzenderEmail() {
  return useQuery({
    queryKey: ["afzender-email"],
    queryFn: fetchAfzenderEmail,
    staleTime: 5 * 60_000,
  });
}

export type { Lead, KPIs, Activiteit };
