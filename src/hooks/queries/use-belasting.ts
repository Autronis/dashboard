"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Deadline {
  id: number;
  type: "btw" | "inkomstenbelasting" | "icp" | "kvk_publicatie";
  omschrijving: string;
  datum: string;
  kwartaal: number | null;
  jaar: number;
  afgerond: number | null;
  notities: string | null;
}

export interface BtwAangifte {
  id: number;
  kwartaal: number;
  jaar: number;
  btwOntvangen: number;
  btwBetaald: number;
  btwAfdragen: number;
  status: "open" | "ingediend" | "betaald";
  ingediendOp: string | null;
  notities: string | null;
}

export interface UrenCriteriumData {
  id: number;
  gebruikerId: number | null;
  jaar: number;
  doelUren: number;
  behaaldUren: number;
  zelfstandigenaftrek: number;
  mkbVrijstelling: number;
  voldoet: boolean;
  voortgangPercentage: number;
}

interface BelastingData {
  deadlines: Deadline[];
  aangiftes: BtwAangifte[];
  urenCriterium: UrenCriteriumData | null;
}

export function useBelasting(jaar: number) {
  return useQuery<BelastingData>({
    queryKey: ["belasting", jaar],
    queryFn: async () => {
      const [deadlinesRes, btwRes, urenRes] = await Promise.all([
        fetch(`/api/belasting/deadlines?jaar=${jaar}`),
        fetch(`/api/belasting/btw?jaar=${jaar}`),
        fetch(`/api/belasting/uren-criterium?jaar=${jaar}`),
      ]);

      const deadlines = deadlinesRes.ok ? (await deadlinesRes.json()).deadlines ?? [] : [];
      const aangiftes = btwRes.ok ? (await btwRes.json()).aangiftes ?? [] : [];
      const urenCriterium = urenRes.ok ? (await urenRes.json()).urenCriterium ?? null : null;

      return { deadlines, aangiftes, urenCriterium };
    },
    staleTime: 30_000,
  });
}

// --- Winst & Verlies ---

export interface WinstVerliesKwartaal {
  kwartaal: number;
  omzet: number;
  kosten: number;
  winst: number;
}

export interface WinstVerliesData {
  jaar: number;
  brutoOmzet: number;
  kostenPerCategorie: Record<string, number>;
  totaleKosten: number;
  afschrijvingen: number;
  kmAftrek: number;
  brutowinst: number;
  zelfstandigenaftrek: number;
  mkbVrijstelling: number;
  belastbaarInkomen: number;
  geschatteBelasting: number;
  effectiefTarief: number;
  perKwartaal: WinstVerliesKwartaal[];
}

export function useWinstVerlies(jaar: number) {
  return useQuery({
    queryKey: ["winst-verlies", jaar],
    queryFn: async (): Promise<WinstVerliesData> => {
      const res = await fetch(`/api/belasting/winst-verlies?jaar=${jaar}`);
      if (!res.ok) throw new Error("Kon W&V niet laden");
      const data = await res.json();
      return data.winstVerlies;
    },
    staleTime: 60_000,
  });
}

// --- Investeringen ---

export interface Investering {
  id: number;
  naam: string;
  bedrag: number;
  datum: string;
  categorie: string;
  afschrijvingstermijn: number;
  restwaarde: number;
  notities: string | null;
  jaarlijkseAfschrijving: number;
}

export function useInvesteringen() {
  return useQuery({
    queryKey: ["investeringen"],
    queryFn: async (): Promise<Investering[]> => {
      const res = await fetch("/api/belasting/investeringen");
      if (!res.ok) throw new Error("Kon investeringen niet laden");
      const data = await res.json();
      return data.investeringen;
    },
    staleTime: 60_000,
  });
}

export function useCreateInvestering() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<Investering, "id" | "jaarlijkseAfschrijving">) => {
      const res = await fetch("/api/belasting/investeringen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon investering niet aanmaken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investeringen"] });
      queryClient.invalidateQueries({ queryKey: ["winst-verlies"] });
    },
  });
}

export function useUpdateInvestering() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Investering> & { id: number }) => {
      const res = await fetch(`/api/belasting/investeringen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon investering niet bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investeringen"] });
      queryClient.invalidateQueries({ queryKey: ["winst-verlies"] });
    },
  });
}

export function useDeleteInvestering() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/belasting/investeringen/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon investering niet verwijderen");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investeringen"] });
      queryClient.invalidateQueries({ queryKey: ["winst-verlies"] });
    },
  });
}

// --- Voorlopige Aanslagen ---

export interface VoorlopigeAanslag {
  id: number;
  jaar: number;
  type: string;
  bedrag: number;
  betaaldBedrag: number;
  status: string;
  vervaldatum: string | null;
  notities: string | null;
}

export function useVoorlopigeAanslagen(jaar: number) {
  return useQuery({
    queryKey: ["voorlopige-aanslagen", jaar],
    queryFn: async (): Promise<VoorlopigeAanslag[]> => {
      const res = await fetch(`/api/belasting/voorlopige-aanslagen?jaar=${jaar}`);
      if (!res.ok) throw new Error("Kon voorlopige aanslagen niet laden");
      const data = await res.json();
      return data.aanslagen;
    },
    staleTime: 60_000,
  });
}

export function useCreateVoorlopigeAanslag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<VoorlopigeAanslag, "id">) => {
      const res = await fetch("/api/belasting/voorlopige-aanslagen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon voorlopige aanslag niet aanmaken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voorlopige-aanslagen"] });
    },
  });
}

export function useUpdateVoorlopigeAanslag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<VoorlopigeAanslag> & { id: number }) => {
      const res = await fetch(`/api/belasting/voorlopige-aanslagen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon voorlopige aanslag niet bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voorlopige-aanslagen"] });
    },
  });
}

// --- Reserveringen ---

export interface Reservering {
  id: number;
  maand: string;
  bedrag: number;
  type: string;
  notities: string | null;
}

export interface ReserveringenData {
  reserveringen: Reservering[];
  totaalGereserveerd: number;
  suggestieMaandelijks: number;
  geschatteBelasting: number;
  tekort: number;
}

export function useReserveringen(jaar: number) {
  return useQuery({
    queryKey: ["reserveringen", jaar],
    queryFn: async (): Promise<ReserveringenData> => {
      const res = await fetch(`/api/belasting/reserveringen?jaar=${jaar}`);
      if (!res.ok) throw new Error("Kon reserveringen niet laden");
      const data = await res.json();
      return data.reserveringen;
    },
    staleTime: 60_000,
  });
}

export function useCreateReservering() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<Reservering, "id">) => {
      const res = await fetch("/api/belasting/reserveringen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon reservering niet aanmaken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reserveringen"] });
    },
  });
}

// --- Jaaroverzicht ---

export interface JaaroverzichtData {
  jaar: number;
  omzet: number;
  kosten: number;
  winst: number;
  belasting: number;
  btwAfgedragen: number;
  investeringen: number;
  uren: number;
}

export function useJaaroverzicht(jaar: number) {
  return useQuery({
    queryKey: ["jaaroverzicht", jaar],
    queryFn: async (): Promise<JaaroverzichtData> => {
      const res = await fetch(`/api/belasting/jaaroverzicht?jaar=${jaar}`);
      if (!res.ok) throw new Error("Kon jaaroverzicht niet laden");
      const data = await res.json();
      return data.jaaroverzicht;
    },
    staleTime: 60_000,
  });
}

// --- Audit Log ---

export interface AuditLogEntry {
  id: number;
  entiteitType: string;
  entiteitId: number;
  actie: string;
  details: string | null;
  gebruikerId: number | null;
  tijdstip: string;
}

export function useAuditLog(entiteitType?: string) {
  return useQuery({
    queryKey: ["audit-log", entiteitType ?? "all"],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const params = new URLSearchParams();
      if (entiteitType) params.set("entiteitType", entiteitType);
      const res = await fetch(`/api/belasting/audit-log?${params.toString()}`);
      if (!res.ok) throw new Error("Kon audit log niet laden");
      const data = await res.json();
      return data.entries;
    },
    staleTime: 30_000,
  });
}
