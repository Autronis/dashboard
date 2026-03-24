"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, LayoutGrid, List, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import {
  AgentStation,
  AgentDetail,
  TaskFeed,
  IsometricGrid,
  PixelOffice,
  agents as mockAgents,
  taskLog,
} from "@/components/ops-room";
import { CommandBar } from "@/components/ops-room/command-bar";
import { CommandInput } from "@/components/ops-room/command-input";
import { ApprovalPanel } from "@/components/ops-room/approval-panel";
import { LogPanel } from "@/components/ops-room/log-panel";
import { ProjectPanel } from "@/components/ops-room/project-panel";
import { Leaderboard } from "@/components/ops-room/leaderboard";
import { MissionControl } from "@/components/ops-room/mission-control";
import { ExecutionFeed } from "@/components/ops-room/execution-feed";
import { AgentStatusGrid } from "@/components/ops-room/agent-status-grid";
import { OfficeViewSyb } from "@/components/ops-room/office-view-syb";
import type { Agent } from "@/components/ops-room";
import { useOpsRoom } from "@/hooks/queries/use-ops-room";
import { useOrchestrator } from "@/components/ops-room/orchestrator-store";
import type { TaskLogEntry } from "@/components/ops-room";

type ViewMode = "office" | "grid" | "list";
type FloorMode = "v1" | "v2" | "both";

export default function OpsRoomPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [floor, setFloor] = useState<FloorMode>("v1");
  const [viewMode, setViewMode] = useState<ViewMode>("office");

  const { data: liveAgents, isLoading, isError } = useOpsRoom();
  const orchestratorAgents = useOrchestrator((s) => s.activeAgents);
  const orchestratorLogs = useOrchestrator((s) => s.logs);

  // Poll DB for active commands → extract working agent IDs (survives refresh)
  const { data: dbCommands } = useQuery({
    queryKey: ["orchestrator-commands-agents"],
    queryFn: async () => {
      const res = await fetch("/api/ops-room/orchestrate", {
        headers: { "x-ops-token": "autronis-ops-2026" },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.commands ?? []) as { opdracht: string; status: string; plan: { taken: { agentId: string | null; titel: string }[] } | null }[];
    },
    refetchInterval: 5000,
  });
  const dbActiveAgents = useMemo(() => {
    const map = new Map<string, { titel: string; opdracht: string }>();
    (dbCommands ?? []).forEach((cmd) => {
      if ((cmd.status === "approved" || cmd.status === "in_progress") && cmd.plan) {
        cmd.plan.taken.forEach((t) => {
          if (t.agentId) map.set(t.agentId, { titel: t.titel, opdracht: cmd.opdracht });
        });
      }
    });
    return map;
  }, [dbCommands]);

  // Merge: mock roster as base, overlay live data
  // When live data exists: agents WITHOUT live activity → idle (stand-by)
  const agents = useMemo(() => {
    if (!liveAgents || liveAgents.length === 0) return mockAgents;
    const liveMap = new Map(liveAgents.map((a) => [a.id, a]));
    const merged = mockAgents.map((mock) => {
      const live = liveMap.get(mock.id);
      if (!live) {
        // No live data — management stays active, builders go idle
        const alwaysActive = new Set(["theo", "toby", "jones", "ari", "rodi", "brent"]);
        if (alwaysActive.has(mock.id)) return mock;
        // Check if orchestrator or DB has this agent active
        if (orchestratorAgents.has(mock.id) || dbActiveAgents.has(mock.id)) {
          const dbTask = dbActiveAgents.get(mock.id);
          return {
            ...mock,
            status: "working" as const,
            huidigeTaak: dbTask ? {
              id: `db-${mock.id}`,
              beschrijving: dbTask.titel,
              project: dbTask.opdracht.slice(0, 40),
              startedAt: new Date().toISOString(),
              status: "bezig" as const,
            } : mock.huidigeTaak,
          };
        }
        // Builders without live data → idle
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
    return [...merged, ...extraLive];
  }, [liveAgents, orchestratorAgents, dbActiveAgents]);
  const isLive = liveAgents && liveAgents.length > 0;

  // Convert orchestrator logs + live API data to TaskLogEntry format
  const liveFeed: TaskLogEntry[] = useMemo(() => {
    const entries: TaskLogEntry[] = [];
    orchestratorLogs.forEach((log) => {
      const agent = agents.find((a) => a.id === log.agentId);
      const status = log.type === "error" ? "fout" as const
        : log.type === "task_complete" ? "afgerond" as const
        : "bezig" as const;
      entries.push({
        id: log.id,
        agentId: log.agentId,
        agentNaam: agent?.naam ?? log.agentId,
        status,
        beschrijving: log.message,
        project: agent?.huidigeTaak?.project ?? "Ops Room",
        tijdstip: log.timestamp,
      });
    });
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
  }, [orchestratorLogs, liveAgents, agents]);

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
        {/* ===== COMPACT HEADER ===== */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: title + command input */}
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2 shrink-0">
              <Radio className="w-4 h-4 text-autronis-accent" />
              <h1 className="text-base font-bold text-autronis-text-primary">Ops Room</h1>
              {isLive && (
                <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-semibold bg-green-500/15 text-green-400">
                  <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </span>
              )}
              {isLoading && <Loader2 className="w-3 h-3 text-autronis-text-tertiary animate-spin" />}
            </div>
            <div className="flex-1 max-w-lg">
              <CommandInput />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Floor switcher */}
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

            {/* View toggle */}
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

        <CommandBar agents={agents} isLive={isLive} />

        {isError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            Kon live data niet laden — toont demo data
          </div>
        )}

        {/* ===== MAIN VIEW ===== */}
        {viewMode === "office" ? (
          <>
            {/* Office view with floor switching */}
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
            {/* Mission Control + Approval */}
            <MissionControl agents={agents} />
            <ApprovalPanel />

            {/* 3-column control grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: Projects + Ranking */}
              <div className="space-y-4">
                <ProjectPanel agents={agents} />
                <Leaderboard agents={agents} />
              </div>

              {/* Center: Live Execution Feed */}
              <ExecutionFeed />

              {/* Right: Agent Status + Activity */}
              <div className="space-y-4">
                <AgentStatusGrid agents={agents} onSelect={handleSelectAgent} />
                <div className="rounded-xl border border-autronis-border/50 bg-autronis-card p-4">
                  <TaskFeed entries={liveFeed} isDemo={!isLive && orchestratorLogs.length === 0} onAgentClick={handleAgentClickFromFeed} />
                </div>
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
                  <TaskFeed entries={liveFeed} isDemo={!isLive && orchestratorLogs.length === 0} onAgentClick={handleAgentClickFromFeed} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
