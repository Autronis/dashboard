import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Factuur {
  id: number;
  factuurnummer: string;
  klantId: number;
  klantNaam: string;
  status: string;
  bedragExclBtw: number;
  btwBedrag: number | null;
  bedragInclBtw: number | null;
  factuurdatum: string | null;
  vervaldatum: string | null;
  betaaldOp: string | null;
}

interface FactuurKPIs {
  openstaand: number;
  betaaldDezeMaand: number;
  teLaat: number;
  totaal: number;
}

interface FacturenData {
  facturen: Factuur[];
  kpis: FactuurKPIs;
}

interface OuderdomBucket {
  aantal: number;
  bedrag: number;
}

interface KlantOuderdom {
  klantNaam: string;
  openstaand: number;
  oudste: number;
  aantalFacturen: number;
}

interface OuderdomData {
  ouderdom: {
    "0-30": OuderdomBucket;
    "31-60": OuderdomBucket;
    "61-90": OuderdomBucket;
    "90+": OuderdomBucket;
    totaal: OuderdomBucket;
  };
  perKlant: KlantOuderdom[];
}

interface HerinneringenResultaat {
  verzonden: number;
  bijgewerkt: number;
  resultaten: Array<{
    factuurId: number;
    factuurnummer: string;
    klant: string | null;
    emailVerstuurd: boolean;
  }>;
}

interface PeriodiekResultaat {
  aangemaakt: number;
  facturen: Array<{
    factuurId: number;
    factuurnummer: string;
    bronFactuur: string;
  }>;
}

async function fetchFacturen(statusFilter: string, zoek: string): Promise<FacturenData> {
  const params = new URLSearchParams();
  if (statusFilter !== "alle") params.set("status", statusFilter);
  if (zoek) params.set("zoek", zoek);
  const res = await fetch(`/api/facturen?${params}`);
  if (!res.ok) throw new Error("Kon facturen niet laden");
  return res.json();
}

export function useFacturen(statusFilter: string, zoek: string) {
  return useQuery({
    queryKey: ["facturen", statusFilter, zoek],
    queryFn: () => fetchFacturen(statusFilter, zoek),
    staleTime: 30_000,
  });
}

export function useOuderdomsanalyse() {
  return useQuery({
    queryKey: ["facturen", "ouderdom"],
    queryFn: async (): Promise<OuderdomData> => {
      const res = await fetch("/api/facturen/ouderdom");
      if (!res.ok) throw new Error("Kon ouderdomsanalyse niet laden");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useVerstuurHerinneringen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<HerinneringenResultaat> => {
      const res = await fetch("/api/facturen/herinneringen", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Kon herinneringen niet versturen");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facturen"] });
    },
  });
}

export function useGenereerPeriodiek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<PeriodiekResultaat> => {
      const res = await fetch("/api/facturen/periodiek", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Kon periodieke facturen niet genereren");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facturen"] });
    },
  });
}

export function useScanBon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("bon", file);
      const res = await fetch("/api/uitgaven/scan", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Scan mislukt");
      }
      return res.json() as Promise<{
        uitgave: {
          id: number;
          omschrijving: string;
          bedrag: number;
          leverancier: string | null;
          categorie: string | null;
        };
        extracted: {
          leverancier?: string;
          bedrag?: number;
          omschrijving?: string;
          categorie?: string;
        };
        bonUrl: string;
      }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uitgaven"] });
      queryClient.invalidateQueries({ queryKey: ["facturen"] });
    },
  });
}

export function useHerinneringenPreview() {
  return useQuery({
    queryKey: ["facturen", "herinneringen-preview"],
    queryFn: async (): Promise<{ aantal: number; facturen: Array<{ id: number; factuurnummer: string; bedragInclBtw: number | null; vervaldatum: string | null; klantNaam: string | null }> }> => {
      const res = await fetch("/api/facturen/herinneringen");
      if (!res.ok) throw new Error("Preview mislukt");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function usePeriodiekePreview() {
  return useQuery({
    queryKey: ["facturen", "periodiek-preview"],
    queryFn: async (): Promise<{ aantal: number; facturen: Array<{ factuurnummer: string }> }> => {
      const res = await fetch("/api/facturen/periodiek");
      if (!res.ok) throw new Error("Preview mislukt");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export type { Factuur, FactuurKPIs, OuderdomData, OuderdomBucket };
