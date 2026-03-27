import { useQuery } from "@tanstack/react-query";

interface BezigMet {
  taakId: number;
  taakTitel: string;
  status: string;
  gebruikerId: number;
  gebruikerNaam: string;
  projectNaam: string | null;
  projectId: number | null;
  bijgewerktOp: string | null;
}

interface Activiteit {
  id: number;
  gebruikerId: number;
  gebruikerNaam: string;
  type: string;
  taakId: number | null;
  projectId: number | null;
  bericht: string;
  aangemaaktOp: string | null;
}

interface ProjectStatus {
  projectId: number;
  projectNaam: string;
  medewerkers: Array<{ naam: string; taak: string }>;
}

export interface TeamLiveData {
  bezigMet: BezigMet[];
  recenteActiviteit: Activiteit[];
  projectStatus: ProjectStatus[];
  gedeeldeProjecten: Array<{ projectNaam: string; medewerkers: Array<{ naam: string; taak: string }> }>;
  huidigeGebruiker: { id: number; naam: string };
}

async function fetchTeamLive(): Promise<TeamLiveData> {
  const res = await fetch("/api/team/live");
  if (!res.ok) throw new Error("Kon team status niet laden");
  return res.json();
}

export function useTeamLive() {
  return useQuery({
    queryKey: ["team-live"],
    queryFn: fetchTeamLive,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
}
