"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { Users, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCharacterDef, drawSprite } from "./pixel-sprites";
import type { Agent } from "./types";

function MiniSprite({ agentId, size = 24 }: { agentId: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const def = getCharacterDef(agentId);
    const scale = Math.max(1, Math.floor(size / Math.max(def.cols, def.rows)));
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    const ox = Math.floor((size - def.cols * scale) / 2);
    const oy = Math.max(0, Math.floor((size - def.rows * scale) / 2));
    drawSprite(ctx, def.sprite, ox, oy, scale);
  }, [agentId, size]);
  return <canvas ref={ref} width={size} height={size} className="shrink-0" style={{ width: size, height: size, imageRendering: "pixelated" }} />;
}

function useLiveClock(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

function runtimeStr(startedAt: string): string {
  const diff = Date.now() - new Date(startedAt).getTime();
  const min = Math.floor(diff / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  if (min < 1) return `${sec}s`;
  if (min < 60) return `${min}m${sec}s`;
  return `${Math.floor(min / 60)}u${min % 60}m`;
}

interface AgentStatusGridProps {
  agents: Agent[];
  onSelect: (agent: Agent) => void;
}

export function AgentStatusGrid({ agents, onSelect }: AgentStatusGridProps) {
  useLiveClock(); // triggers re-render every second for live timers
  const { working, reviewing, blocked, idle } = useMemo(() => {
    const working = agents.filter((a) => a.status === "working" && a.team === "sem");
    const reviewing = agents.filter((a) => a.status === "reviewing" && a.team === "sem");
    const blocked = agents.filter((a) => a.status === "error" && a.team === "sem");
    const idle = agents.filter((a) => a.status === "idle" && a.team === "sem")
      .sort((a, b) => b.voltooideVandaag - a.voltooideVandaag)
      .slice(0, 6);
    return { working, reviewing, blocked, idle };
  }, [agents]);

  const hasContent = working.length > 0 || reviewing.length > 0 || blocked.length > 0;

  if (!hasContent && idle.length === 0) return null;

  return (
    <div className="rounded-xl border border-autronis-border/50 bg-autronis-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-autronis-border/30">
        <Users className="w-4 h-4 text-autronis-accent" />
        <span className="text-sm font-semibold text-autronis-text-primary">Agent Status</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Working agents */}
        {working.length > 0 && (
          <div>
            <p className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Actief ({working.length})
            </p>
            <div className="space-y-1">
              {working.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onSelect(a)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/agent-id", a.id);
                    e.dataTransfer.setData("text/plain", a.naam);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-autronis-card-hover transition-colors text-left cursor-grab active:cursor-grabbing"
                >
                  <MiniSprite agentId={a.id} size={22} />
                  <span className="text-[11px] font-semibold text-autronis-text-primary flex-1 truncate">{a.naam}</span>
                  <span className="text-[9px] text-autronis-text-tertiary truncate max-w-[100px]">
                    {a.huidigeTaak?.beschrijving?.slice(0, 25) ?? ""}
                  </span>
                  {a.huidigeTaak && (
                    <span className="text-[9px] text-autronis-text-tertiary flex items-center gap-0.5 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      {runtimeStr(a.huidigeTaak.startedAt)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reviewing */}
        {reviewing.length > 0 && (
          <div>
            <p className="text-[9px] font-semibold text-purple-400 uppercase tracking-wider mb-1.5">
              Review ({reviewing.length})
            </p>
            <div className="space-y-1">
              {reviewing.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onSelect(a)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/agent-id", a.id);
                    e.dataTransfer.setData("text/plain", a.naam);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-autronis-card-hover transition-colors text-left cursor-grab active:cursor-grabbing"
                >
                  <MiniSprite agentId={a.id} size={22} />
                  <span className="text-[11px] font-medium text-autronis-text-primary">{a.naam}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Blocked/Error */}
        {blocked.length > 0 && (
          <div>
            <p className="text-[9px] font-semibold text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Geblokkeerd ({blocked.length})
            </p>
            <div className="space-y-1">
              {blocked.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onSelect(a)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/agent-id", a.id);
                    e.dataTransfer.setData("text/plain", a.naam);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/10 transition-colors text-left cursor-grab active:cursor-grabbing"
                >
                  <MiniSprite agentId={a.id} size={22} />
                  <span className="text-[11px] font-medium text-red-400">{a.naam}</span>
                  <span className="text-[9px] text-red-400/60 truncate flex-1">{a.huidigeTaak?.beschrijving ?? "Error"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Idle (compact) — draggable to assign to projects */}
        {idle.length > 0 && (
          <div>
            <p className="text-[9px] font-semibold text-autronis-text-tertiary uppercase tracking-wider mb-1.5">
              Stand-by ({agents.filter((a) => a.status === "idle" && a.team === "sem").length})
              <span className="ml-1 font-normal opacity-60">— sleep naar project</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {idle.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onSelect(a)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/agent-id", a.id);
                    e.dataTransfer.setData("text/plain", a.naam);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-autronis-border/15 hover:bg-autronis-border/30 transition-colors cursor-grab active:cursor-grabbing"
                  title={`${a.naam} — sleep naar een project om toe te wijzen`}
                >
                  <MiniSprite agentId={a.id} size={16} />
                  <span className="text-[10px] text-autronis-text-tertiary">{a.naam}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
