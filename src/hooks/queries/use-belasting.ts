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
  rubriek1aOmzet: number;
  rubriek1aBtw: number;
  rubriek1bOmzet: number;
  rubriek1bBtw: number;
  rubriek4aOmzet: number;
  rubriek4aBtw: number;
  rubriek4bOmzet: number;
  rubriek4bBtw: number;
  rubriek5aBtw: number;
  rubriek5bBtw: number;
  saldo: number;
  betalingskenmerk: string | null;
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
    staleTime: 5 * 60_000,
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
  kmTotaal: number;
  kmTarief: number;
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
    staleTime: 5 * 60_000,
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
    staleTime: 5 * 60_000,
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
    staleTime: 5 * 60_000,
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
      return {
        reserveringen: data.reserveringen ?? [],
        totaalGereserveerd: data.samenvatting?.totaalGereserveerd ?? 0,
        suggestieMaandelijks: data.samenvatting?.suggestieMaandelijks ?? 0,
        geschatteBelasting: data.samenvatting?.geschatteBelasting ?? 0,
        tekort: data.samenvatting?.tekort ?? 0,
      };
    },
    staleTime: 5 * 60_000,
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
  omzet: { totaal: number; perKwartaal: number[] };
  kosten: { totaal: number; perCategorie: Record<string, number> };
  btw: { ontvangen: number; betaald: number; afgedragen: number; perKwartaal: Array<{ kwartaal: number; ontvangen: number; betaald: number; afdragen: number }> };
  uren: { totaal: number; doel: number; voldoet: boolean };
  kilometers: { totaalKm: number; aftrekbaarBedrag: number };
  investeringen: { totaal: number; afschrijvingen: number; kia: number };
  winstVerlies: { brutoOmzet: number; totaleKosten: number; afschrijvingen: number; kmAftrek: number; brutowinst: number; zelfstandigenaftrek: number; mkbVrijstelling: number; belastbaarInkomen: number; geschatteBelasting: number; effectiefTarief: number };
  reserveringen: { gereserveerd: number; nodig: number; tekort: number };
  voorlopigeAanslagen: { totaal: number; betaald: number; openstaand: number };
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
    staleTime: 5 * 60_000,
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
      return data.logs || [];
    },
    staleTime: 5 * 60_000,
  });
}

// --- Belasting Tips ---

export interface BelastingTip {
  id: number;
  categorie: "aftrekpost" | "regeling" | "subsidie" | "optimalisatie" | "weetje";
  titel: string;
  beschrijving: string;
  voordeel: string | null;
  bron: string | null;
  bronNaam: string | null;
  jaar: number | null;
  isAiGegenereerd: number;
  toegepast: number;
  toegepastOp: string | null;
  aangemaaktOp: string;
}

interface BelastingTipsData {
  tips: BelastingTip[];
  totaal: number;
  toegepast: number;
}

export function useBelastingTips(jaar: number) {
  return useQuery<BelastingTipsData>({
    queryKey: ["belasting-tips", jaar],
    queryFn: async () => {
      const res = await fetch(`/api/belasting/tips?jaar=${jaar}`);
      if (!res.ok) throw new Error("Kon tips niet laden");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

export function useToggleTip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, toegepast }: { id: number; toegepast: boolean }) => {
      const res = await fetch(`/api/belasting/tips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toegepast }),
      });
      if (!res.ok) throw new Error("Kon tip niet bijwerken");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["belasting-tips"] });
    },
  });
}

export function useGenereerTips() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (context: {
      omzet?: number;
      kosten?: number;
      winst?: number;
      urenBehaald?: number;
      investeringen?: number;
      branche?: string;
      toegepasteTips?: string[];
      jaar?: number;
    }) => {
      const res = await fetch("/api/belasting/tips/genereer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Kon geen tips genereren");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["belasting-tips"] });
    },
  });
}

export function useDeleteTip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/belasting/tips/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kon tip niet verwijderen");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["belasting-tips"] });
    },
  });
}
