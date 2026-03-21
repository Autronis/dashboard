"use client";

import { useState, useCallback, useMemo } from "react";
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
import { OfficeViewSyb } from "@/components/ops-room/office-view-syb";
import type { Agent } from "@/components/ops-room";
import { useOpsRoom } from "@/hooks/queries/use-ops-room";

type ViewMode = "office" | "grid" | "list";
type FloorMode = "v1" | "v2" | "both";

export default function OpsRoomPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [floor, setFloor] = useState<FloorMode>("v1");
  const [viewMode, setViewMode] = useState<ViewMode>("office");

  const { data: liveAgents, isLoading, isError } = useOpsRoom();

  // Merge: mock roster as base, overlay live data
  const agents = useMemo(() => {
    if (!liveAgents || liveAgents.length === 0) return mockAgents;
    const liveMap = new Map(liveAgents.map((a) => [a.id, a]));
    const merged = mockAgents.map((mock) => {
      const live = liveMap.get(mock.id);
      if (!live) return mock;
      return {
        ...mock,
        status: live.status,
        huidigeTaak: live.huidigeTaak ?? mock.huidigeTaak,
        laatsteActiviteit: live.laatsteActiviteit,
        kosten: live.kosten.tokensVandaag > 0 ? live.kosten : mock.kosten,
        terminal: live.terminal.length > 0 ? live.terminal : mock.terminal,
      };
    });
    const mockIds = new Set(mockAgents.map((a) => a.id));
    const extraLive = liveAgents.filter((a) => !mockIds.has(a.id));
    return [...merged, ...extraLive];
  }, [liveAgents]);
  const isLive = liveAgents && liveAgents.length > 0;

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
      <div className="space-y-4">
        {/* ===== PRIMARY: Header + Command Bar ===== */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-autronis-accent/10">
              <Radio className="w-4.5 h-4.5 text-autronis-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-autronis-text-primary">Ops Room</h1>
                {isLive && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-green-500/15 text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    LIVE
                  </span>
                )}
                {isLoading && <Loader2 className="w-3.5 h-3.5 text-autronis-text-tertiary animate-spin" />}
              </div>
              <p className="text-xs text-autronis-text-tertiary">Command center</p>
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

        <CommandInput />

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
                  agents={agents}
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
                <OfficeViewSyb />
              </div>
            )}
            {/* Orchestrator panels below the office */}
            <ApprovalPanel />
            <LogPanel />
            <div className={cn(
              "grid gap-4",
              selectedAgent ? "grid-cols-1 lg:grid-cols-[1fr_320px]" : "grid-cols-1"
            )}>
              <div className="rounded-xl border border-autronis-border/50 bg-autronis-card p-4">
                <TaskFeed entries={taskLog} isDemo={!isLive} onAgentClick={handleAgentClickFromFeed} />
              </div>
              {selectedAgent && (
                <AgentDetail
                  agent={selectedAgent}
                  recentTasks={recentTasksForAgent}
                  onClose={handleClose}
                />
              )}
            </div>
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
                  <TaskFeed entries={taskLog} isDemo={!isLive} onAgentClick={handleAgentClickFromFeed} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
