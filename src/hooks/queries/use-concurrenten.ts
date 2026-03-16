import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============ TYPES ============

interface ConcurrentScan {
  id: number;
  concurrentId: number;
  status: string;
  scanDatum: string;
  websiteChanges: string | null;
  vacatures: string | null;
  socialActivity: string | null;
  aiSamenvatting: string | null;
  aiHighlights: string | null;
  trendIndicator: string | null;
  kansen: string | null;
  aangemaaktOp: string | null;
}

interface Concurrent {
  id: number;
  naam: string;
  websiteUrl: string;
  linkedinUrl: string | null;
  instagramHandle: string | null;
  scanPaginas: string | null;
  notities: string | null;
  isActief: number | null;
  aangemaaktOp: string | null;
  bijgewerktOp: string | null;
  laatsteScan: ConcurrentScan | null;
}

interface ConcurrentenData {
  concurrenten: Concurrent[];
  kpis: {
    totaal: number;
    wijzigingenDezeWeek: number;
    groeiend: number;
    laatsteScan: string | null;
  };
}

interface ConcurrentDetail {
  concurrent: Concurrent;
  scans: ConcurrentScan[];
}

interface ScanStatus {
  actief: boolean;
  concurrenten: Array<{
    id: number;
    naam: string;
    status: "wachtend" | "bezig" | "voltooid" | "mislukt";
    stap?: string;
    fout?: string;
  }>;
}

// ============ FETCH FUNCTIONS ============

async function fetchConcurrenten(): Promise<ConcurrentenData> {
  const res = await fetch("/api/concurrenten");
  if (!res.ok) throw new Error("Kon concurrenten niet laden");
  return res.json();
}

async function fetchConcurrentDetail(id: number): Promise<ConcurrentDetail> {
  const res = await fetch(`/api/concurrenten/${id}`);
  if (!res.ok) throw new Error("Kon concurrent niet laden");
  return res.json();
}

async function fetchScanStatus(): Promise<ScanStatus> {
  const res = await fetch("/api/concurrenten/scan/status");
  if (!res.ok) throw new Error("Kon scan status niet laden");
  return res.json();
}

// ============ HOOKS ============

export function useConcurrenten() {
  return useQuery({
    queryKey: ["concurrenten"],
    queryFn: fetchConcurrenten,
    staleTime: 30_000,
  });
}

export function useConcurrentDetail(id: number | null) {
  return useQuery({
    queryKey: ["concurrent", id],
    queryFn: () => fetchConcurrentDetail(id!),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useScanStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["scan-status"],
    queryFn: fetchScanStatus,
    enabled,
    refetchInterval: 2000,
  });
}

export function useCreateConcurrent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      naam: string;
      websiteUrl: string;
      linkedinUrl?: string;
      instagramHandle?: string;
      scanPaginas?: string[];
      notities?: string;
    }) => {
      const res = await fetch("/api/concurrenten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Fout bij aanmaken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concurrenten"] });
    },
  });
}

export function useUpdateConcurrent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; [key: string]: unknown }) => {
      const res = await fetch(`/api/concurrenten/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Fout bij bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concurrenten"] });
    },
  });
}

export function useDeleteConcurrent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/concurrenten/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Fout bij verwijderen");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concurrenten"] });
    },
  });
}

export function useStartScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (concurrentId?: number) => {
      const url = concurrentId
        ? `/api/concurrenten/scan/${concurrentId}`
        : "/api/concurrenten/scan";
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Fout bij starten scan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scan-status"] });
    },
  });
}

export type { Concurrent, ConcurrentScan, ConcurrentenData, ConcurrentDetail, ScanStatus };
