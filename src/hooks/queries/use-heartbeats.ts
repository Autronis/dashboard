import { useQuery } from "@tanstack/react-query";

export interface Heartbeat {
  sessionId: string;
  user: "sem" | "syb";
  chatTag: string | null;
  huidigeTaak: string | null;
  activeSkill: string | null;
  laatsteTool: string | null;
  project: string | null;
  tijdstip: string;
  status: "actief" | "idle";
}

async function fetchHeartbeats(): Promise<Heartbeat[]> {
  const res = await fetch("/api/ops-room/heartbeat", { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.heartbeats) ? data.heartbeats : [];
}

export function useHeartbeats() {
  return useQuery({
    queryKey: ["ops-room-heartbeats"],
    queryFn: fetchHeartbeats,
    staleTime: 3_000,
    refetchInterval: 5_000, // polt elke 5s, heartbeats TTL is 10 min
  });
}
