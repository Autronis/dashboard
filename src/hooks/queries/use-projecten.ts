import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

export type ProjectEigenaar = "sem" | "syb" | "team" | "vrij";

export interface Project {
  id: number;
  naam: string;
  omschrijving: string | null;
  klantId: number | null;
  klantNaam: string | null;
  status: "actief" | "afgerond" | "on-hold";
  voortgangPercentage: number;
  deadline: string | null;
  geschatteUren: number | null;
  werkelijkeUren: number | null;
  eigenaar: ProjectEigenaar | null;
  bijgewerktOp: string | null;
  aangemaaktOp: string | null;
  takenTotaal: number;
  takenAfgerond: number;
  takenOpen: number;
  takenVoortgang: number;
  takenDezeWeek: number;
  totaalMinuten: number;
  laatsteActiviteit: string | null;
  sparkline: number[];
  taakTitels: string;
}

export interface ProjectKpis {
  totaal: number;
  actief: number;
  afgerond: number;
  onHold: number;
  takenOpen: number;
  totaleUren: number;
}

async function fetchProjecten(): Promise<{ projecten: Project[]; kpis: ProjectKpis }> {
  const res = await fetch("/api/projecten");
  if (!res.ok) throw new Error("Kon projecten niet laden");
  return res.json() as Promise<{ projecten: Project[]; kpis: ProjectKpis }>;
}

export function useProjecten() {
  const query = useQuery({
    queryKey: ["projecten"],
    queryFn: fetchProjecten,
    select: (data) => data.projecten,
    staleTime: 30_000,
  });

  // Auto-sync op eerste load
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    fetch("/api/projecten/sync", { method: "POST" })
      .then(() => query.refetch())
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
}

export function useProjectenMetKpis() {
  const query = useQuery({
    queryKey: ["projecten"],
    queryFn: fetchProjecten,
    staleTime: 30_000,
  });

  // Auto-sync op eerste load
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    fetch("/api/projecten/sync", { method: "POST" })
      .then(() => query.refetch())
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
}

// ============ Project Detail ============

export interface FaseTaak {
  id: number;
  titel: string;
  status: string;
  prioriteit: string;
  deadline: string | null;
  uitvoerder: string | null;
  bijgewerktOp: string | null;
}

export interface Fase {
  naam: string;
  taken: FaseTaak[];
  totaal: number;
  afgerond: number;
}

export interface ProjectDetail {
  id: number;
  naam: string;
  omschrijving: string | null;
  klantId: number | null;
  klantNaam: string | null;
  status: string;
  voortgangPercentage: number;
  deadline: string | null;
  geschatteUren: number | null;
  werkelijkeUren: number | null;
  eigenaar: ProjectEigenaar | null;
  aangemaaktOp: string | null;
  bijgewerktOp: string | null;
  totaalTaken: number;
  afgerondTaken: number;
  voortgang: number;
  totaalMinuten: number;
}

interface ProjectDetailResponse {
  project: ProjectDetail;
  fases: Fase[];
}

async function fetchProjectDetail(id: string): Promise<ProjectDetailResponse> {
  const res = await fetch(`/api/projecten/${id}`);
  if (res.status === 404) throw new Error("Project niet gevonden");
  if (!res.ok) throw new Error("Kon project niet laden");
  return res.json() as Promise<ProjectDetailResponse>;
}

export function useProjectDetail(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProjectDetail(id),
    staleTime: 30_000,
    enabled: !!id,
  });

  const setFases = useCallback((updater: (prev: Fase[]) => Fase[]) => {
    queryClient.setQueryData<ProjectDetailResponse>(["project", id], (old) => {
      if (!old) return old;
      return { ...old, fases: updater(old.fases) };
    });
  }, [queryClient, id]);

  return {
    project: query.data?.project ?? null,
    fases: query.data?.fases ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    setFases,
  };
}
