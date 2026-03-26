import { useQuery } from "@tanstack/react-query";

interface Project {
  id: number;
  naam: string;
  klantId: number;
  klantNaam: string;
  status: string;
}

interface Registratie {
  id: number;
  gebruikerId: number | null;
  projectId: number;
  omschrijving: string | null;
  startTijd: string;
  eindTijd: string | null;
  duurMinuten: number | null;
  categorie: string;
  isHandmatig: number;
  projectNaam: string | null;
  klantNaam: string | null;
}

async function fetchProjecten(): Promise<Project[]> {
  const res = await fetch("/api/projecten");
  if (!res.ok) throw new Error("Kon projecten niet laden");
  const data = await res.json();
  return data.projecten || [];
}

async function fetchRegistraties(van: string, tot: string, team = false): Promise<Registratie[]> {
  const teamParam = team ? "&team=true" : "";
  const res = await fetch(`/api/tijdregistraties?van=${van}&tot=${tot}${teamParam}`);
  if (!res.ok) throw new Error("Kon registraties niet laden");
  const data = await res.json();
  return data.registraties || [];
}

export function useProjecten() {
  return useQuery({
    queryKey: ["projecten"],
    queryFn: fetchProjecten,
    staleTime: 30_000,
  });
}

export function useRegistraties(van: string, tot: string) {
  return useQuery({
    queryKey: ["registraties", van, tot],
    queryFn: () => fetchRegistraties(van, tot),
    staleTime: 30_000,
  });
}

export function useTeamRegistraties(van: string, tot: string) {
  return useQuery({
    queryKey: ["registraties", "team", van, tot],
    queryFn: () => fetchRegistraties(van, tot, true),
    staleTime: 60_000,
  });
}

export type { Project, Registratie };
