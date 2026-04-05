import { useEffect, useRef, useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Agent } from "@/components/ops-room/types";

// Raw DB row from the API
interface AgentActiviteitRow {
  id: number;
  agentId: string;
  agentType: string;
  project: string;
  laatsteActie: string;
  details: string | null;
  status: string;
  tokensGebruikt: number;
  laatstGezien: string;
  aangemaaktOp: string;
}

// Map DB status to UI status
function mapStatus(status: string, laatstGezien: string): Agent["status"] {
  if (status === "error") return "error";
  if (status === "offline") return "offline";

  const minutesSinceLastSeen = (Date.now() - new Date(laatstGezien).getTime()) / 60000;
  if (minutesSinceLastSeen > 30) return "offline";
  if (minutesSinceLastSeen > 5) return "idle";

  if (status === "actief") return "working";
  if (status === "inactief") return "idle";
  return "idle";
}

// Map DB agentType to UI role
function mapRole(agentType: string): Agent["rol"] {
  const valid = ["manager", "builder", "reviewer", "architect", "assistant", "automation"] as const;
  return valid.includes(agentType as typeof valid[number])
    ? (agentType as Agent["rol"])
    : "builder";
}

// Estimate costs based on tokens (rough Claude pricing)
function estimateCost(tokens: number): number {
  // Approximate blended rate: ~$15/M tokens
  return (tokens / 1_000_000) * 15;
}

function mapRowToAgent(row: AgentActiviteitRow): Agent {
  const status = mapStatus(row.status, row.laatstGezien);
  const kosten = estimateCost(row.tokensGebruikt);

  return {
    id: row.agentId,
    naam: row.agentId.split("-")[0].charAt(0).toUpperCase() + row.agentId.split("-")[0].slice(1),
    rol: mapRole(row.agentType),
    team: (row.agentId.endsWith("-syb") || ["autro", "daan", "finn", "leo"].includes(row.agentId)) ? "syb" as const : "sem" as const,
    status,
    huidigeTaak: (status === "working" || status === "idle") && row.project ? {
      id: `task-${row.id}`,
      beschrijving: row.details ?? row.laatsteActie,
      project: row.project,
      startedAt: row.laatstGezien,
      status: status === "working" ? "bezig" : "afgerond",
    } : null,
    voltooideVandaag: 0, // TODO: track completed tasks separately
    laatsteActiviteit: row.laatstGezien,
    avatar: row.agentType.charAt(0).toUpperCase(),
    terminal: row.details ? [{
      id: `term-${row.id}`,
      tekst: row.details,
      type: row.status === "error" ? "error" as const : "info" as const,
      tijdstip: row.laatstGezien,
    }] : [],
    kosten: {
      tokensVandaag: row.tokensGebruikt,
      kostenVandaag: kosten,
      tokensHuidigeTaak: 0,
    },
  };
}

async function fetchOpsRoom(): Promise<Agent[]> {
  const res = await fetch("/api/ops-room/agents", {
    credentials: "include",
    headers: { "x-ops-token": "autronis-ops-2026" },
  });
  if (!res.ok) throw new Error("Kon Ops Room data niet laden");
  const data = await res.json();
  return (data.agents as AgentActiviteitRow[]).map(mapRowToAgent);
}

// SSE hook — connects to /api/ops-room/stream for real-time updates
function useOpsRoomSSE() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const retryCount = useRef(0);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const es = new EventSource("/api/ops-room/stream?token=autronis-ops-2026");
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
        retryCount.current = 0;
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "agents" && Array.isArray(data.agents)) {
            const agents = (data.agents as AgentActiviteitRow[]).map(mapRowToAgent);
            queryClient.setQueryData(["ops-room"], agents);
          }
        } catch { /* ignore parse errors */ }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        eventSourceRef.current = null;
        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
        retryCount.current++;
        reconnectTimeout.current = setTimeout(connect, delay);
      };
    } catch {
      setConnected(false);
    }
  }, [queryClient]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return connected;
}

export function useOpsRoom() {
  // SSE pushes data into the query cache
  const sseConnected = useOpsRoomSSE();

  // Fallback polling only when SSE is disconnected
  return useQuery({
    queryKey: ["ops-room"],
    queryFn: fetchOpsRoom,
    staleTime: 3 * 1000,
    refetchInterval: sseConnected ? false : 5 * 1000, // Only poll when SSE is down
  });
}
