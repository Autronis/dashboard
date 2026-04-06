import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

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
