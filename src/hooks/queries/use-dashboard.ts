import { useQuery } from "@tanstack/react-query";

interface DashboardData {
  gebruiker: { id: number; naam: string };
  kpis: {
    omzetDezeMaand: number;
    omzetVorigeMaand: number;
    urenDezeWeek: { totaal: number; eigen: number; teamgenoot: number; autronis: number; klant: number };
    urenVorigeWeek: number;
    actieveProjecten: number;
    deadlinesDezeWeek: number;
    takenAfgerondVandaag: number;
  };
  mijnTaken: {
    id: number;
    titel: string;
    omschrijving: string | null;
    status: string;
    deadline: string | null;
    prioriteit: string;
    fase: string | null;
    projectId: number | null;
    projectNaam: string | null;
    klantId: number | null;
  }[];
  deadlines: {
    projectId: number;
    projectNaam: string;
    klantId: number | null;
    klantNaam: string;
    deadline: string;
    voortgang: number | null;
  }[];
  teamgenoot: {
    id: number;
    naam: string;
    email: string;
    actieveTimer: {
      id: number;
      omschrijving: string | null;
      startTijd: string;
      projectNaam: string | null;
    } | null;
    urenPerDag: number[];
    urenTotaal: number;
    taken: { id: number; titel: string; projectNaam: string | null }[];
  } | null;
  actielijsten: {
    fase: string | null;
    totaal: number;
    afgerond: number;
    hoog: number;
  }[];
  projecten: { id: number; naam: string; klantNaam: string; voortgang: number | null; status: string }[];
}

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("Kon dashboard niet laden");
  return res.json();
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 15 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export type { DashboardData };
