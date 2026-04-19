"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Radio, LayoutGrid, List, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import {
  AgentStation,
  AgentDetail,
  TaskFeed,
  IsometricGrid,
  Leaderboard,
  agents as mockAgents,
  taskLog,
} from "@/components/ops-room";

const PixelOffice = dynamic(
  () => import("@/components/ops-room/pixel-office").then((m) => ({ default: m.PixelOffice })),
  { ssr: false }
);
import type { Agent } from "@/components/ops-room";
import { useOpsRoom } from "@/hooks/queries/use-ops-room";
import { useHeartbeats } from "@/hooks/queries/use-heartbeats";
import type { TaskLogEntry } from "@/components/ops-room";

type ViewMode = "office" | "grid" | "list";
type FloorMode = "v1" | "v2" | "both";

export default function OpsRoomPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [floor, setFloor] = useState<FloorMode>("v1");
  const [viewMode, setViewMode] = useState<ViewMode>("office");

  const { data: liveAgents, isLoading, isError } = useOpsRoom();
  const { data: heartbeats } = useHeartbeats();

  // Map heartbeats → per-agent activity. Een heartbeat van user=sem met
  // activeSkill=wout zet wout-op-V1 op "working". Default (geen skill) =
  // atlas/autro.
  const heartbeatAgents = useMemo(() => {
    const map = new Map<string, { project: string; taak: string; chatTag: string | null; status: "actief" | "idle" }>();
    (heartbeats ?? []).forEach((hb) => {
      const suffix = hb.user === "syb" ? "-syb" : "";
      const skill = hb.activeSkill ?? (hb.user === "syb" ? "autro" : "atlas");
      const id = skill === "atlas" || skill === "autro" ? skill : skill + suffix;
      if (map.get(id)?.status === "actief" && hb.status !== "actief") return;
      map.set(id, {
        project: hb.project ?? hb.chatTag ?? "Autronis",
        taak: hb.huidigeTaak ?? hb.laatsteTool ?? "Aan het werk",
        chatTag: hb.chatTag,
        status: hb.status,
      });
    });
    return map;
  }, [heartbeats]);

  const agents = useMemo(() => {
    const applyHeartbeat = (a: Agent): Agent => {
      const hb = heartbeatAgents.get(a.id);
      if (!hb) return a;
      return {
        ...a,
        status: (hb.status === "actief" ? "working" : "idle") as Agent["status"],
        huidigeTaak: {
          id: `hb-${a.id}`,
          beschrijving: hb.taak,
          project: hb.project,
          startedAt: new Date().toISOString(),
          status: "bezig" as const,
        },
      };
    };

    if (!liveAgents || liveAgents.length === 0) {
      return mockAgents.map((mock) => applyHeartbeat(mock));
    }

    const liveMap = new Map(liveAgents.map((a) => [a.id, a]));

    const merged = mockAgents.map((mock) => {
      const live = liveMap.get(mock.id);
      if (!live) {
        return {
          ...mock,
          status: "idle" as const,
          huidigeTaak: null,
          terminal: [],
          kosten: { tokensVandaag: 0, kostenVandaag: 0, tokensHuidigeTaak: 0 },
        };
      }
      return {
        ...mock,
        status: live.status,
        huidigeTaak: live.huidigeTaak,
        laatsteActiviteit: live.laatsteActiviteit,
        kosten: live.kosten.tokensVandaag > 0 ? live.kosten : mock.kosten,
        terminal: live.terminal.length > 0 ? live.terminal : mock.terminal,
      };
    });
    const mockIds = new Set(mockAgents.map((a) => a.id));
    const extraLive = liveAgents.filter((a) => !mockIds.has(a.id) && !a.id.startsWith("builder-") && !a.id.startsWith("test"));

    return [...merged, ...extraLive].map(applyHeartbeat);
  }, [liveAgents, heartbeatAgents]);
  const isLive = (liveAgents && liveAgents.length > 0) || heartbeatAgents.size > 0;

  const liveFeed: TaskLogEntry[] = useMemo(() => {
    const entries: TaskLogEntry[] = [];
    if (liveAgents) {
      liveAgents.forEach((a) => {
        if (a.huidigeTaak && a.status === "working") {
          entries.push({
            id: `live-${a.id}`,
            agentId: a.id,
            agentNaam: a.naam,
            status: "bezig" as const,
            beschrijving: a.huidigeTaak.beschrijving,
            project: a.huidigeTaak.project,
            tijdstip: a.laatsteActiviteit,
          });
        }
      });
    }
    entries.sort((a, b) => new Date(b.tijdstip).getTime() - new Date(a.tijdstip).getTime());
    return entries.length > 0 ? entries : taskLog;
  }, [liveAgents]);

  const handleSelectAgent = useCallback((agent: Agent) => {
    setSelectedAgent((prev) => (prev?.id === agent.id ? null : agent));
  }, []);

  const handleClose = useCallback(() => {
    setSelectedAgent(null);
  }, []);

  const handleAgentClickFromFeed = useCallback((agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) setSelectedAgent(agent);
  }, [agents]);

  const recentTasksForAgent = selectedAgent
    ? taskLog.filter((t) => t.agentId === selectedAgent.id).slice(0, 8)
    : [];

  const viewOptions: { mode: ViewMode; icon: typeof Building2; label: string }[] = [
    { mode: "office", icon: Building2, label: "Kantoor" },
    { mode: "grid", icon: LayoutGrid, label: "Grid" },
    { mode: "list", icon: List, label: "Lijst" },
  ];

  return (
    <PageTransition>
      <div className="space-y-3">
        <div className="sticky top-0 z-20 bg-autronis-bg space-y-2 py-2 -mt-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2 shrink-0">
                <Radio className="w-4 h-4 text-autronis-accent" />
                <h1 className="text-base font-bold text-autronis-text-primary">Ops Room</h1>
                {isLive && (
                  <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-semibold bg-emerald-500/15 text-emerald-400">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                )}
                {isLoading && <Loader2 className="w-3 h-3 text-autronis-text-tertiary animate-spin" />}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-autronis-card border border-autronis-border/50">
                {(["v1", "v2", "both"] as FloorMode[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFloor(f)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-semibold transition-colors",
                      floor === f
                        ? "bg-autronis-accent/15 text-autronis-accent"
                        : "text-autronis-text-tertiary hover:text-autronis-text-secondary"
                    )}
                  >
                    {f === "v1" ? "V1 ↑" : f === "v2" ? "V2 ↓" : "Beide"}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-autronis-card border border-autronis-border/50">
                {viewOptions.map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    title={label}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      viewMode === mode
                        ? "bg-autronis-accent/15 text-autronis-accent"
                        : "text-autronis-text-tertiary hover:text-autronis-text-secondary"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {isError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            Kon live data niet laden — toont demo data
          </div>
        )}

        {viewMode === "office" ? (
          <>
            {(floor === "v1" || floor === "both") && (
              <div>
                {floor === "both" && (
                  <p className="text-[10px] font-semibold text-autronis-accent uppercase tracking-wider mb-1">Team Sem — Verdieping 1</p>
                )}
                <PixelOffice
                  agents={agents.filter((a) => a.team === "sem")}
                  selectedId={selectedAgent?.id ?? null}
                  onSelect={handleSelectAgent}
                />
              </div>
            )}
            {(floor === "v2" || floor === "both") && (
              <div>
                {floor === "both" && (
                  <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-1 mt-4">Team Syb — Verdieping 2</p>
                )}
                <PixelOffice
                  agents={agents.filter((a) => a.team === "syb")}
                  selectedId={selectedAgent?.id ?? null}
                  onSelect={handleSelectAgent}
                  ceo={{ id: "syb", naam: "Syb", avatar: "#a855f7" }}
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
              <Leaderboard agents={agents} />
              <div className="rounded-xl border border-autronis-border/50 bg-autronis-card p-4">
                <TaskFeed entries={liveFeed} isDemo={!isLive} onAgentClick={handleAgentClickFromFeed} />
              </div>
            </div>
            {selectedAgent && (
              <AgentDetail
                agent={selectedAgent}
                recentTasks={recentTasksForAgent}
                onClose={handleClose}
              />
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
            <div className="space-y-3">
              {viewMode === "grid" ? (
                <IsometricGrid
                  agents={agents}
                  selectedId={selectedAgent?.id ?? null}
                  onSelect={handleSelectAgent}
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {agents
                    .filter((a) => a.status !== "idle" && a.status !== "offline")
                    .map((agent, i) => (
                      <AgentStation key={agent.id} agent={agent} index={i} onClick={handleSelectAgent} />
                    ))}
                  {agents.filter((a) => a.status === "idle" || a.status === "offline").length > 0 && (
                    <>
                      <div className="col-span-full mt-2 mb-1">
                        <p className="text-[10px] font-semibold text-autronis-text-tertiary uppercase tracking-wider">
                          Stand-by ({agents.filter((a) => a.status === "idle" || a.status === "offline").length})
                        </p>
                      </div>
                      {agents
                        .filter((a) => a.status === "idle" || a.status === "offline")
                        .map((agent, i) => (
                          <AgentStation key={agent.id} agent={agent} index={i} onClick={handleSelectAgent} />
                        ))}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-3">
              {selectedAgent ? (
                <AgentDetail
                  agent={selectedAgent}
                  recentTasks={recentTasksForAgent}
                  onClose={handleClose}
                />
              ) : (
                <div className="rounded-xl border border-autronis-border/50 bg-autronis-card p-4">
                  <TaskFeed entries={liveFeed} isDemo={!isLive} onAgentClick={handleAgentClickFromFeed} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
