"use client";

import { useMemo, useRef, useEffect } from "react";
import { Trophy, Flame, Zap, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCharacterDef, drawSprite } from "./pixel-sprites";
import type { Agent } from "./types";

interface LeaderboardProps {
  agents: Agent[];
}

const MEDAL_COLORS = ["#fbbf24", "#94a3b8", "#cd7f32"]; // gold, silver, bronze
const MEDAL_LABELS = ["1e", "2e", "3e"];

function SpriteAvatar({ agentId, size = 28 }: { agentId: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const charDef = getCharacterDef(agentId);
    const scale = Math.floor(size / Math.max(charDef.cols, charDef.rows));
    const spriteW = charDef.cols * scale;
    const spriteH = charDef.rows * scale;

    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    // Center the sprite
    const offsetX = Math.floor((size - spriteW) / 2);
    const offsetY = Math.floor((size - spriteH) / 2);
    drawSprite(ctx, charDef.sprite, offsetX, Math.max(0, offsetY), scale);
  }, [agentId, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="shrink-0 rounded-md"
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}

export function Leaderboard({ agents }: LeaderboardProps) {
  const rankings = useMemo(() => {
    // Filter out management/support that don't do tasks
    const workers = agents.filter((a) =>
      a.voltooideVandaag > 0 || a.kosten.tokensVandaag > 0
    );

    // Sort by completed tasks (primary), then tokens used (secondary)
    const sorted = [...workers].sort((a, b) => {
      if (b.voltooideVandaag !== a.voltooideVandaag) return b.voltooideVandaag - a.voltooideVandaag;
      return b.kosten.tokensVandaag - a.kosten.tokensVandaag;
    });

    return sorted.slice(0, 5);
  }, [agents]);

  const topAgent = rankings[0];

  if (rankings.length === 0) return null;

  return (
    <div className="rounded-xl border border-autronis-border/50 bg-autronis-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-autronis-border/30">
        <Trophy className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-autronis-text-primary">Ranglijst</span>
        {topAgent && (
          <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-400">
            <Crown className="w-3 h-3" />
            {topAgent.naam} is vandaag de beste
          </span>
        )}
      </div>
      <div className="p-2 space-y-1">
        {rankings.map((agent, i) => {
          const isTop = i === 0;
          const medal = i < 3 ? MEDAL_COLORS[i] : null;
          const efficiency = agent.voltooideVandaag > 0 && agent.kosten.tokensVandaag > 0
            ? Math.round(agent.voltooideVandaag / (agent.kosten.tokensVandaag / 10000))
            : 0;

          return (
            <div
              key={agent.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isTop ? "bg-amber-500/5 border border-amber-500/15" : "hover:bg-autronis-card-hover",
              )}
            >
              {/* Rank */}
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                  medal ? "text-white" : "text-autronis-text-tertiary bg-autronis-border/30"
                )}
                style={medal ? { backgroundColor: medal } : undefined}
              >
                {i < 3 ? MEDAL_LABELS[i] : i + 1}
              </div>

              {/* Sprite Avatar */}
              <SpriteAvatar agentId={agent.id} size={28} />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs font-semibold truncate",
                  isTop ? "text-amber-400" : "text-autronis-text-primary"
                )}>
                  {agent.naam}
                  {isTop && <Flame className="w-3 h-3 inline ml-1 text-amber-400" />}
                </p>
                <p className="text-[9px] text-autronis-text-tertiary">
                  {agent.huidigeTaak?.project ?? "Stand-by"}
                </p>
              </div>

              {/* Stats */}
              <div className="text-right shrink-0">
                <p className="text-[11px] font-bold text-autronis-text-primary flex items-center gap-1 justify-end">
                  <Zap className="w-3 h-3 text-green-400" />
                  {agent.voltooideVandaag} taken
                </p>
                <p className="text-[9px] text-autronis-text-tertiary">
                  {`\u20AC${agent.kosten.kostenVandaag.toFixed(2)}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
