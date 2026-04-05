import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface BriefingAgendaItem {
  titel: string;
  type: string;
  startDatum: string;
  heleDag: boolean;
}

interface BriefingTaak {
  id: number;
  titel: string;
  prioriteit: string;
  projectNaam: string | null;
  fase: string | null;
  deadline: string | null;
}

interface BriefingProject {
  naam: string;
  klantNaam: string;
  voortgang: number;
  deadline: string | null;
}

interface BriefingQuickWin {
  id: number;
  titel: string;
  projectNaam: string | null;
}

export interface Briefing {
  id: number;
  datum: string;
  samenvatting: string | null;
  agendaItems: BriefingAgendaItem[];
  takenPrioriteit: BriefingTaak[];
  projectUpdates: BriefingProject[];
  quickWins: BriefingQuickWin[];
}

async function fetchBriefing(datum: string): Promise<Briefing | null> {
  const res = await fetch(`/api/briefing?datum=${datum}`);
  if (!res.ok) throw new Error("Kon briefing niet laden");
  const data = await res.json();
  return data.briefing;
}

export function useBriefing(datum: string) {
  return useQuery({
    queryKey: ["briefing", datum],
    queryFn: () => fetchBriefing(datum),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useGenereerBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datum: string) => {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datum }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Fout bij genereren");
      }
      return res.json();
    },
    onSuccess: (_data, datum) => {
      queryClient.invalidateQueries({ queryKey: ["briefing", datum] });
    },
  });
}
