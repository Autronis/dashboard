import { useQuery } from "@tanstack/react-query";

export type TaakEigenaar = "sem" | "syb" | "team" | "vrij";

export interface Taak {
  id: number;
  titel: string;
  omschrijving: string | null;
  fase: string | null;
  cluster: string | null;
  volgorde: number;
  status: string;
  deadline: string | null;
  prioriteit: string;
  uitvoerder: string | null;
  prompt: string | null;
  projectMap: string | null;
  aangemaaktOp: string | null;
  projectId: number | null;
  projectNaam: string | null;
  projectEigenaar: TaakEigenaar | null;
  klantNaam: string | null;
  toegewezenAanId: number | null;
  toegewezenAanNaam: string | null;
  eigenaar: TaakEigenaar | null;
}

export interface TakenKPIs {
  totaal: number;
  open: number;
  bezig: number;
  afgerond: number;
  verlopen: number;
}

export interface ProjectVoortgang {
  projectId: number;
  projectNaam: string;
  totaal: number;
  afgerond: number;
  fases: { fase: string; totaal: number; afgerond: number }[];
}

interface TakenResponse {
  taken: Taak[];
  kpis: TakenKPIs;
  projecten: ProjectVoortgang[];
}

export type TakenScope = "mij" | "syb" | "team" | "vrij" | "alle";

interface TakenFilters {
  status?: string;
  zoek?: string;
  projectId?: string;
  fase?: string;
  prioriteit?: string;
  toegewezenAan?: string;
  scope?: TakenScope;
}

async function fetchTaken(filters: TakenFilters): Promise<TakenResponse> {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "alle") params.set("status", filters.status);
  if (filters.zoek) params.set("zoek", filters.zoek);
  if (filters.projectId && filters.projectId !== "alle") params.set("projectId", filters.projectId);
  if (filters.fase && filters.fase !== "alle") params.set("fase", filters.fase);
  if (filters.prioriteit && filters.prioriteit !== "alle") params.set("prioriteit", filters.prioriteit);
  if (filters.toegewezenAan && filters.toegewezenAan !== "alle") params.set("toegewezenAan", filters.toegewezenAan);
  if (filters.scope && filters.scope !== "alle") params.set("scope", filters.scope);

  const res = await fetch(`/api/taken?${params}`);
  if (!res.ok) throw new Error("Kon taken niet laden");
  return res.json();
}

export function useTaken(filters: TakenFilters, options?: { pauseRefetch?: boolean }) {
  return useQuery({
    queryKey: ["taken", filters],
    queryFn: () => fetchTaken(filters),
    staleTime: 15_000,
    refetchInterval: options?.pauseRefetch ? false : 30_000,
  });
}
