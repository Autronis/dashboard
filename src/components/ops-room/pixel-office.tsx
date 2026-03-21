"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import {
  drawSprite,
  drawSemDesk,
  getCharacterDef,
} from "./pixel-sprites";
import { getProjectColor } from "./project-colors";
import type { Agent } from "./types";

// ============ LAYOUT ============

const S = 5;
const CANVAS_W = 1500;
const CANVAS_H = 730;
const WALL_H = 40;

const UNIT_W = 180;
const UNIT_H = 130;
const GRID_X = 220;

// === Management row — Sem, Theo, Toby, Jones all on one line ===
const MGMT_Y = WALL_H + 2;
const SEM = { x: 20, y: MGMT_Y };

// Builders grid — shifted right, below management
const BUILDER_X = 340;
const BUILDER_START_Y = MGMT_Y + UNIT_H + 20;

const DESK_POSITIONS: Record<string, { x: number; y: number }> = {
  // Management row — all 4 on one line
  theo: { x: SEM.x + UNIT_W, y: MGMT_Y },
  toby: { x: SEM.x + UNIT_W * 2, y: MGMT_Y },
  jones: { x: SEM.x + UNIT_W * 3, y: MGMT_Y },
  // Ari + Rodi under Sem (left column)
  ari: { x: 20, y: BUILDER_START_Y },
  rodi: { x: 20, y: BUILDER_START_Y + UNIT_H },
  // Builders (shifted right)
  wout: { x: BUILDER_X, y: BUILDER_START_Y },
  bas: { x: BUILDER_X + UNIT_W, y: BUILDER_START_Y },
  gabriel: { x: BUILDER_X + UNIT_W * 2, y: BUILDER_START_Y },
  tijmen: { x: BUILDER_X, y: BUILDER_START_Y + UNIT_H },
  pedro: { x: BUILDER_X + UNIT_W, y: BUILDER_START_Y + UNIT_H },
  vincent: { x: BUILDER_X + UNIT_W * 2, y: BUILDER_START_Y + UNIT_H },
};

// Empty desks
const EMPTY_DESKS = [
  { x: BUILDER_X + UNIT_W * 3, y: BUILDER_START_Y },
  { x: BUILDER_X + UNIT_W * 3, y: BUILDER_START_Y + UNIT_H },
  { x: BUILDER_X, y: BUILDER_START_Y + UNIT_H * 2 },
  { x: BUILDER_X + UNIT_W, y: BUILDER_START_Y + UNIT_H * 2 },
  { x: BUILDER_X + UNIT_W * 2, y: BUILDER_START_Y + UNIT_H * 2 },
  { x: BUILDER_X + UNIT_W * 3, y: BUILDER_START_Y + UNIT_H * 2 },
];

const DESKS_BOTTOM = BUILDER_START_Y + UNIT_H * 3;

// Meeting table — right of builder desks
const MEETING = { x: BUILDER_X + UNIT_W * 4 + 20, y: BUILDER_START_Y, w: 100, h: UNIT_H * 2 };

// Slaapkamer — tight, just beds
const COFFEE_Y = DESKS_BOTTOM + 4;
const COFFEE_X = 14;
const COFFEE_W = CANVAS_W - 28;
const COFFEE_H = 80;

const COFFEE_SEATS: { x: number; y: number }[] = [];
for (let c = 0; c < 14; c++) {
  COFFEE_SEATS.push({ x: COFFEE_X + 14 + c * 104, y: COFFEE_Y + 16 });
}

const FRAME_MS = 1000 / 8;

// ============ 2D DESK (proven working design + shadow for depth) ============

function drawDesk(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  agent: { naam: string; avatar: string; status: string; id: string; rol?: string; huidigeTaak?: { project: string; beschrijving: string } | null },
  projectColor: string,
  tick: number,
  isSelected: boolean,
  isHovered: boolean,
  labelsOnly: boolean,
  s: number,
) {
  const isActive = agent.status === "working" || agent.status === "reviewing";
  const isOffline = agent.status === "offline";
  const charDef = getCharacterDef(agent.id);

  const deskY = y + 18 * s;
  const deskW = 24 * s;
  const deskH = 5 * s;

  // Labels pass — 3-line format: Naam / Rol / → Project
  if (labelsOnly) {
    const labelX = x + 2 * s;
    const labelY2 = deskY + deskH + 4 * s;
    const maxW = deskW + 4 * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 2, labelY2 - 2, maxW + 10, 50);
    ctx.clip();

    const rolLabels: Record<string, string> = {
      manager: "Manager", builder: "Builder", reviewer: "Reviewer",
      architect: "Architect", assistant: "Research & Docs", automation: "Automation",
    };
    const rolText = rolLabels[agent.rol ?? "builder"] ?? "Builder";

    // Background for all 3 lines
    const bgH = agent.huidigeTaak ? 42 : 30;
    ctx.fillStyle = "#0a0f14dd";
    ctx.fillRect(labelX - 4, labelY2, maxW, bgH);

    // Line 1: Name (13px bold white)
    ctx.font = "bold 13px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    let name = agent.naam;
    while (ctx.measureText(name).width > maxW - 8 && name.length > 2) name = name.slice(0, -1);
    ctx.fillText(name, labelX, labelY2 + 12);

    // Line 2: Rol (11px, grey)
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#6b7b8b";
    ctx.fillText(rolText, labelX, labelY2 + 24);

    // Line 3: → Project (11px, turquoise/project color)
    if (agent.huidigeTaak) {
      ctx.font = "11px Inter, system-ui, sans-serif";
      let proj = agent.huidigeTaak.project;
      while (ctx.measureText("→ " + proj).width > maxW - 8 && proj.length > 3) proj = proj.slice(0, -2) + ".";
      ctx.fillStyle = projectColor;
      ctx.fillText("→ " + proj, labelX, labelY2 + 36);
    }

    // Status dot (right side of label)
    const dotX = labelX + maxW - 10;
    const dotY = labelY2 + 8;
    if (isActive) {
      ctx.fillStyle = "#4ade80"; // green = running
      ctx.beginPath(); ctx.arc(dotX, dotY, 3, 0, Math.PI * 2); ctx.fill();
    } else if (agent.status === "idle") {
      ctx.fillStyle = "#f59e0b"; // yellow = idle
      ctx.beginPath(); ctx.arc(dotX, dotY, 3, 0, Math.PI * 2); ctx.fill();
    } else if (agent.status === "error") {
      ctx.fillStyle = "#ef4444"; // red = error
      ctx.beginPath(); ctx.arc(dotX, dotY, 3, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
    return;
  }

  // Leadership glow (subtle glow behind management desks)
  const isLeadership = agent.rol === "manager" || agent.rol === "reviewer" || agent.rol === "architect";
  if (isLeadership && isActive) {
    const glowAlpha = 0.04 + Math.sin(tick * 0.1 + x * 0.01) * 0.02;
    const grad = ctx.createRadialGradient(x + 14 * s, deskY, 0, x + 14 * s, deskY, 18 * s);
    grad.addColorStop(0, `rgba(35, 198, 183, ${glowAlpha})`);
    grad.addColorStop(1, "rgba(35, 198, 183, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x + 14 * s, deskY, 18 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hover glow effect
  if (isHovered) {
    ctx.fillStyle = "#23C6B710";
    ctx.fillRect(x, y - 2 * s, 28 * s, 30 * s);
  }

  // Shadow under desk
  ctx.fillStyle = "#00000018";
  ctx.beginPath();
  ctx.ellipse(x + 14 * s, deskY + deskH + 4 * s, 14 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Character sitting behind desk
  if (!isOffline && !isHovered) {
    const charH = charDef.rows * s;
    const sitY = deskY - charH + 4 * s;
    const bob = agent.status === "idle" ? Math.sin(tick * 0.25 + x) * 1.5 : 0;
    drawSprite(ctx, charDef.sprite, x + 6 * s, sitY + bob, s);
  }

  // Desk surface
  ctx.fillStyle = "#5c4a3a";
  ctx.fillRect(x + 2 * s, deskY, deskW, deskH);
  ctx.fillStyle = "#4a3828";
  ctx.fillRect(x + 2 * s, deskY + deskH, deskW, 2 * s);
  ctx.fillStyle = "#3a2818";
  ctx.fillRect(x + 3 * s, deskY + deskH + 2 * s, 2 * s, 2 * s);
  ctx.fillRect(x + 23 * s, deskY + deskH + 2 * s, 2 * s, 2 * s);

  // Monitor (on right corner of desk)
  const monW = 8 * s;
  const monH = 6 * s;
  const monX = x + deskW - 4 * s;
  const monY = deskY - monH + 3 * s;
  ctx.fillStyle = "#1a1a25";
  ctx.fillRect(monX, monY, monW, monH);
  ctx.fillStyle = isOffline ? "#050508" : isActive ? "#0a0e16" : "#060810";
  ctx.fillRect(monX + s, monY + s, monW - 2 * s, monH - 2 * s);
  if (isActive) {
    // Screen glow pulse
    const screenGlow = 0.03 + Math.sin(tick * 0.3 + x * 0.01) * 0.02;
    ctx.fillStyle = `rgba(35, 198, 183, ${screenGlow})`;
    ctx.fillRect(monX + s, monY + s, monW - 2 * s, monH - 2 * s);
    // Code lines
    for (let ln = 0; ln < 3; ln++) {
      const lw = 2 + ((tick + ln * 3) % 4);
      const alpha = 0.12 + ((ln * 2 + tick) % 3) * 0.05;
      ctx.fillStyle = `#ffffff${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
      ctx.fillRect(monX + 2 * s, monY + (1.5 + ln * 1.5) * s, lw * s, s * 0.5);
    }
  }
  ctx.fillStyle = "#1a1a25";
  ctx.fillRect(monX + 3 * s, monY + monH, 2 * s, s);

  // Keyboard
  if (!isOffline) {
    const kbX = x + 9 * s;
    const kbY = deskY + 2 * s;
    ctx.fillStyle = "#252530";
    ctx.fillRect(kbX, kbY, 6 * s, 1.5 * s);
    ctx.fillStyle = isActive && tick % 4 < 2 ? "#404050" : "#353545";
    ctx.fillRect(kbX + s * 0.3, kbY + s * 0.2, 5.4 * s, s * 0.4);
    ctx.fillRect(kbX + s * 0.3, kbY + s * 0.8, 5.4 * s, s * 0.4);
  }

  // Empty chair (offline)
  if (isOffline) {
    ctx.fillStyle = "#3a3a4a";
    ctx.save();
    ctx.translate(x + 14 * s, deskY + 6 * s);
    ctx.rotate(0.15);
    ctx.fillRect(-3 * s, 0, 5 * s, 4 * s);
    ctx.fillRect(-4 * s, -2 * s, 7 * s, 2 * s);
    ctx.restore();
  }

  // Character standing (hovered)
  if (!isOffline && isHovered) {
    const charH = charDef.rows * s;
    const standX = x + 26 * s;
    const standY = deskY + deskH - charH + 2 * s;
    drawSprite(ctx, charDef.sprite, standX, standY, s);
    ctx.fillStyle = "#00000025";
    ctx.beginPath();
    ctx.ellipse(standX + 6 * s, standY + charH + 2, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Thinking/working indicator above head
  if (!isOffline && !isHovered) {
    const charH = charDef.rows * s;
    const indicY = deskY - charH + 2 * s - 12;
    const indicX = x + 10 * s;

    if (isActive) {
      // Working: animated dots (...)
      const dotCount = (Math.floor(tick / 3) % 3) + 1;
      ctx.fillStyle = "#23C6B7";
      for (let d = 0; d < dotCount; d++) {
        ctx.beginPath();
        ctx.arc(indicX + d * 5, indicY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (agent.status === "idle") {
      // Idle: subtle breathing (tiny up/down on the character already handled by bob)
      // Show small "zzz" or "..." above
      const breathAlpha = 0.3 + Math.sin(tick * 0.15 + x) * 0.15;
      ctx.fillStyle = `rgba(138, 155, 160, ${breathAlpha})`;
      ctx.font = "8px Inter, system-ui, sans-serif";
      ctx.fillText("idle", indicX - 4, indicY + 2);
    }
  }

  if (isSelected) {
    ctx.strokeStyle = "#23C6B7";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(x, y - s, 28 * s, 28 * s);
    ctx.setLineDash([]);
  }
}

// ============ COMPONENT ============

interface PixelOfficeProps {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (agent: Agent) => void;
}

export function PixelOffice({ agents, selectedId, onSelect }: PixelOfficeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const tickRef = useRef(0);
  const lastTRef = useRef(0);
  const rafRef = useRef(0);

  // Smooth position interpolation for agent movement
  const animPositions = useRef(new Map<string, { x: number; y: number }>());

  const semAgent: Agent = useMemo(() => ({
    id: "sem", naam: "Sem", rol: "manager", status: "working",
    huidigeTaak: { id: "ceo", beschrijving: "Alles overzien", project: "Autronis", startedAt: new Date().toISOString(), status: "bezig" },
    voltooideVandaag: 0, laatsteActiviteit: new Date().toISOString(),
    avatar: "#23C6B7", terminal: [], kosten: { tokensVandaag: 0, kostenVandaag: 0, tokensHuidigeTaak: 0 },
  }), []);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; agent: Agent }>();
    map.set("sem", { x: SEM.x, y: SEM.y, agent: semAgent });
    let ei = 0; // empty desk index
    const stayAtDesk = new Set(["theo", "toby", "jones", "ari", "rodi"]);

    // First pass: desk agents
    agents.forEach((a) => {
      const desk = DESK_POSITIONS[a.id];
      if (desk && (a.status !== "idle" || stayAtDesk.has(a.id))) {
        map.set(a.id, { x: desk.x, y: desk.y, agent: a });
      } else if (!desk && a.status !== "idle" && a.status !== "offline" && ei < EMPTY_DESKS.length) {
        map.set(a.id, { x: EMPTY_DESKS[ei].x, y: EMPTY_DESKS[ei].y, agent: a });
        ei++;
      }
    });

    // Second pass: idle agents who aren't at a desk → standing row
    // Use same filter as the draw loop so positions match exactly
    let si = 0;
    agents.forEach((a) => {
      if (map.has(a.id)) return; // already placed
      if (a.status === "offline") return;
      const seat = COFFEE_SEATS[si];
      if (seat) { map.set(a.id, { x: seat.x, y: seat.y, agent: a }); si++; }
    });
    return map;
  }, [agents, semAgent]);

  const findAgent = useCallback((mx: number, my: number): Agent | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const cx = mx * (CANVAS_W / r.width);
    const cy = my * (CANVAS_H / r.height);
    // Find closest agent within range, not just first hit
    let best: Agent | null = null;
    let bestDist = Infinity;
    for (const [, { x, y, agent }] of positions) {
      if (agent.status === "offline") continue;
      const charDef = getCharacterDef(agent.id);
      const hw = charDef.cols * S;
      const hh = charDef.rows * S;
      // For desk agents, use a larger hitbox (desk area)
      const isDesk = !!DESK_POSITIONS[agent.id];
      const hitW = isDesk ? 26 * S : hw + 10;
      const hitH = isDesk ? 24 * S : hh + 10;
      if (cx >= x - 5 && cx <= x + hitW && cy >= y - 5 && cy <= y + hitH) {
        const dx = cx - (x + hitW / 2);
        const dy = cy - (y + hitH / 2);
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) { bestDist = dist; best = agent; }
      }
    }
    return best;
  }, [positions]);

  // Update animated positions (lerp toward target)
  const getAnimPos = useCallback((id: string, targetX: number, targetY: number) => {
    const anim = animPositions.current;
    const cur = anim.get(id);
    if (!cur) {
      anim.set(id, { x: targetX, y: targetY });
      return { x: targetX, y: targetY };
    }
    const speed = 0.08; // lerp speed
    const nx = cur.x + (targetX - cur.x) * speed;
    const ny = cur.y + (targetY - cur.y) * speed;
    anim.set(id, { x: nx, y: ny });
    return { x: nx, y: ny };
  }, []);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const tick = tickRef.current;

    // === Dark wood floor (horizontal planks) ===
    ctx.fillStyle = "#1c1814";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const plankH = 12;
    for (let py = WALL_H; py < CANVAS_H; py += plankH) {
      // Alternate plank shades
      const shade = py % (plankH * 2) === 0 ? "#201c16" : "#1e1a14";
      ctx.fillStyle = shade;
      ctx.fillRect(0, py, CANVAS_W, plankH);
      // Plank gap line (very subtle)
      ctx.fillStyle = "#161210";
      ctx.fillRect(0, py, CANVAS_W, 1);
      // Subtle wood grain (tiny horizontal streaks)
      ctx.fillStyle = "#24201a08";
      const offset = (py * 7) % 200;
      ctx.fillRect(offset, py + 3, 80, 1);
      ctx.fillRect(offset + 300, py + 7, 60, 1);
      ctx.fillRect(offset + 600, py + 4, 90, 1);
      ctx.fillRect(offset + 900, py + 8, 70, 1);
      ctx.fillRect(offset + 1200, py + 5, 50, 1);
    }

    // === Wall (lighter than floor for contrast) ===
    ctx.fillStyle = "#2a3545";
    ctx.fillRect(0, 0, CANVAS_W, WALL_H);
    ctx.fillStyle = "#1e2e3e";
    ctx.fillRect(0, WALL_H, CANVAS_W, 3);

    // Windows (no light rays)
    for (let i = 0; i < 7; i++) {
      const wx = 60 + i * 200;
      ctx.fillStyle = "#4a5a6a";
      ctx.fillRect(wx, 4, 44, WALL_H - 8);
      ctx.fillStyle = "#1a3050";
      const pH = (WALL_H - 16) / 2;
      ctx.fillRect(wx + 3, 7, 17, pH);
      ctx.fillRect(wx + 24, 7, 17, pH);
      ctx.fillRect(wx + 3, 7 + pH + 3, 17, pH);
      ctx.fillRect(wx + 24, 7 + pH + 3, 17, pH);
    }

    // (geen separator — bedden staan op dezelfde vloer)

    // Empty desks (just desk + monitor, no chair)
    EMPTY_DESKS.forEach(({ x: ex, y: ey }) => {
      const edY = ey + 18 * S;
      const edW = 24 * S;
      const edH = 5 * S;
      // Shadow
      ctx.fillStyle = "#00000010";
      ctx.beginPath();
      ctx.ellipse(ex + 14 * S, edY + edH + 4 * S, 14 * S, 3 * S, 0, 0, Math.PI * 2);
      ctx.fill();
      // Desk surface
      ctx.fillStyle = "#4a3a2a";
      ctx.fillRect(ex + 2 * S, edY, edW, edH);
      ctx.fillStyle = "#3a2818";
      ctx.fillRect(ex + 2 * S, edY + edH, edW, 2 * S);
      ctx.fillStyle = "#2a1808";
      ctx.fillRect(ex + 3 * S, edY + edH + 2 * S, 2 * S, 2 * S);
      ctx.fillRect(ex + 23 * S, edY + edH + 2 * S, 2 * S, 2 * S);
      // Monitor (off)
      const mX = ex + edW - 4 * S;
      const mY = edY - 6 * S + 3 * S;
      ctx.fillStyle = "#1a1a25";
      ctx.fillRect(mX, mY, 8 * S, 6 * S);
      ctx.fillStyle = "#060608";
      ctx.fillRect(mX + S, mY + S, 6 * S, 4 * S);
      ctx.fillStyle = "#1a1a25";
      ctx.fillRect(mX + 3 * S, mY + 6 * S, 2 * S, S);
    });

    // === Meeting table (vertical, 3D, no label) ===
    const tblX = MEETING.x + 110, tblY = MEETING.y + 10;
    const tblW = 100, tblH = MEETING.h - 20;
    const tblD = 8;
    // Shadow
    ctx.fillStyle = "#00000018";
    ctx.beginPath(); ctx.ellipse(tblX + tblW / 2, tblY + tblH + tblD + 5, tblW / 2 + 4, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Legs
    ctx.fillStyle = "#3a2818";
    ctx.fillRect(tblX + 6, tblY + tblH + tblD, 4, 7);
    ctx.fillRect(tblX + tblW - 10, tblY + tblH + tblD, 4, 7);
    // Front face
    ctx.fillStyle = "#4a3828";
    ctx.fillRect(tblX, tblY + tblH, tblW, tblD);
    // Right side
    ctx.fillStyle = "#3a2818";
    ctx.fillRect(tblX + tblW, tblY + tblH - 2, 4, tblD + 2);
    // Top surface
    ctx.fillStyle = "#5c4a3a";
    ctx.beginPath(); ctx.roundRect(tblX, tblY, tblW, tblH, 4); ctx.fill();
    ctx.fillStyle = "#4a3828";
    ctx.beginPath(); ctx.roundRect(tblX + 3, tblY + 3, tblW - 6, tblH - 6, 3); ctx.fill();

    // Chairs along left and right sides
    const cs = 14, cd = 4;
    const drawChair = (cx: number, cy: number, backDir: "left" | "right") => {
      ctx.fillStyle = "#00000010";
      ctx.beginPath(); ctx.ellipse(cx + cs / 2, cy + cs + cd + 2, cs / 2 + 1, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2a2a38"; ctx.fillRect(cx, cy + cs, cs, cd);
      ctx.fillStyle = "#3a3a48"; ctx.fillRect(cx, cy, cs, cs);
      ctx.fillStyle = "#2a2a38";
      if (backDir === "left") ctx.fillRect(cx - 5, cy, 5, cs);
      else ctx.fillRect(cx + cs, cy, 5, cs);
    };
    const numChairs = Math.floor((tblH - 10) / 28);
    const chairStep = (tblH - 10) / numChairs;
    // Left side chairs
    for (let i = 0; i < numChairs; i++) drawChair(tblX - cs - 6, tblY + 5 + i * chairStep, "left");
    // Right side chairs
    for (let i = 0; i < numChairs; i++) drawChair(tblX + tblW + 4, tblY + 5 + i * chairStep, "right");

    // === Slaapkamer (geen achtergrond — zelfde vloer) ===

    // === Sem desk ===
    drawSemDesk(ctx, SEM.x, SEM.y, tick, selectedId === "sem", S);

    // === Desks pass 1 ===
    Object.entries(DESK_POSITIONS).forEach(([id, pos]) => {
      const agent = agents.find((a) => a.id === id);
      if (!agent) return;
      const pc = agent.huidigeTaak ? getProjectColor(agent.huidigeTaak.project) : "#3a4a55";
      drawDesk(ctx, pos.x, pos.y, agent, pc, tick, selectedId === id, hovered === id, false, S);
    });

    // === Desks pass 2: labels ===
    Object.entries(DESK_POSITIONS).forEach(([id, pos]) => {
      const agent = agents.find((a) => a.id === id);
      if (!agent) return;
      const pc = agent.huidigeTaak ? getProjectColor(agent.huidigeTaak.project) : "#3a4a55";
      drawDesk(ctx, pos.x, pos.y, agent, pc, tick, selectedId === id, hovered === id, true, S);
    });

    // === Communication lines between agents on same project ===
    const projectGroups: Record<string, { x: number; y: number; id: string }[]> = {};
    Object.entries(DESK_POSITIONS).forEach(([id, pos]) => {
      const agent = agents.find((a) => a.id === id);
      if (!agent || !agent.huidigeTaak || agent.status === "idle" || agent.status === "offline") return;
      // Skip management/reviewers — only show lines between builders
      if (agent.rol === "reviewer" || agent.rol === "manager" || agent.rol === "architect") return;
      const proj = agent.huidigeTaak.project;
      if (!projectGroups[proj]) projectGroups[proj] = [];
      projectGroups[proj].push({ x: pos.x + 14 * S, y: pos.y + 12 * S, id });
    });
    Object.entries(projectGroups).forEach(([proj, group]) => {
      if (group.length < 2) return;
      const color = getProjectColor(proj);
      ctx.strokeStyle = `${color}30`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i < group.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(group[i].x, group[i].y);
        ctx.lineTo(group[i + 1].x, group[i + 1].y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // Animated pulse dot along the line
      if (group.length >= 2) {
        const t = (tick * 0.05) % 1;
        const px = group[0].x + (group[1].x - group[0].x) * t;
        const py = group[0].y + (group[1].y - group[0].y) * t;
        ctx.fillStyle = `${color}60`;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // === Idle agents (standing in a row) — same filter as positions map ===
    const standingAgents = agents.filter((a) => {
      if (a.status === "offline") return false;
      // If they have a desk position AND should stay there, skip
      const desk = DESK_POSITIONS[a.id];
      const staySet = new Set(["theo", "toby", "jones", "ari", "rodi"]);
      if (desk && (a.status !== "idle" || staySet.has(a.id))) return false;
      // If placed at empty desk (active unknown agent), skip
      if (!desk && a.status !== "idle") return false;
      return true;
    });
    standingAgents.forEach((agent, i) => {
      const seat = COFFEE_SEATS[i];
      if (!seat) return;
      const charDef = getCharacterDef(agent.id);
      const { x: ax, y: ay } = getAnimPos(agent.id, seat.x, seat.y);

      // Character standing
      const bob = Math.sin(tick * 0.2 + i * 1.1) * 1;
      drawSprite(ctx, charDef.sprite, ax, ay + bob, S);

      // Name below
      const charH = charDef.rows * S;
      ctx.font = "bold 13px Inter, system-ui, sans-serif";
      const nw = ctx.measureText(agent.naam).width;
      ctx.fillStyle = "#0a0f14dd";
      ctx.fillRect(ax - 2, ay + charH + 4, nw + 8, 15);
      ctx.fillStyle = agent.avatar;
      ctx.fillText(agent.naam, ax + 2, ay + charH + 16);

      if (selectedId === agent.id) {
        ctx.strokeStyle = "#23C6B7"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.strokeRect(ax - 6, ay - 6, charDef.cols * S + 12, charH + 28);
        ctx.setLineDash([]);
      }
    });

    // === Hover tooltip ===
    if (hovered) {
      const ha = positions.get(hovered);
      if (ha && ha.agent.status !== "offline") {
        const { agent } = ha;
        const desk = DESK_POSITIONS[agent.id];
        const ttX = (desk?.x ?? ha.x) + 2 * S;
        const ttY = (desk?.y ?? ha.y) - 70;
        const tw = 260, th = 64;
        const tx = Math.max(10, Math.min(ttX, CANVAS_W - tw - 10));
        const ty = Math.max(10, ttY);
        ctx.fillStyle = "#0a0f14ee"; ctx.strokeStyle = "#23C6B740"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 15px monospace";
        ctx.fillText(agent.naam, tx + 10, ty + 20);
        ctx.fillStyle = "#6b7b8b"; ctx.font = "11px monospace";
        ctx.fillText(agent.rol.charAt(0).toUpperCase() + agent.rol.slice(1), tx + 10, ty + 36);
        const proj = agent.huidigeTaak?.project ?? "Stand-by";
        ctx.fillStyle = agent.huidigeTaak ? getProjectColor(proj) : "#6b7b8b";
        ctx.fillText(proj, tx + 10, ty + 52);
        ctx.fillStyle = "#f59e0b";
        ctx.fillText(`\u20AC${agent.kosten.kostenVandaag.toFixed(2)}`, tx + tw - 60, ty + 20);
      }
    }

    // === Speech bubble ===
    if (selectedId && selectedId !== hovered) {
      const sel = positions.get(selectedId);
      if (sel && sel.agent.huidigeTaak) {
        const { x: sx, y: sy, agent } = sel;
        const task = agent.huidigeTaak;
        const text = agent.terminal.length > 0 ? agent.terminal[agent.terminal.length - 1].tekst : task?.beschrijving ?? "";
        const display = text.length > 40 ? text.slice(0, 39) + "..." : text;
        const bw = Math.max(130, display.length * 7.5 + 24);
        const bx = Math.max(8, Math.min(sx + 50 - bw / 2, CANVAS_W - bw - 8));
        const by = sy - 34;
        ctx.fillStyle = "#0a0f14ee"; ctx.strokeStyle = "#23C6B7"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, 22, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#0a0f14ee";
        ctx.beginPath(); ctx.moveTo(sx + 40, by + 22); ctx.lineTo(sx + 50, by + 28); ctx.lineTo(sx + 60, by + 22); ctx.fill();
        ctx.fillStyle = "#e2e8f0"; ctx.font = "12px monospace"; ctx.fillText(display, bx + 8, by + 15);
      }
    }

    ctx.fillStyle = "#3a4a5510"; ctx.font = "bold 18px monospace";
    ctx.fillText("AUTRONIS HQ", CANVAS_W - 200, CANVAS_H - 16);

    tickRef.current++;
  }, [agents, positions, selectedId, hovered, mouse]);

  useEffect(() => {
    const loop = (t: number) => {
      if (t - lastTRef.current >= FRAME_MS) { lastTRef.current = t; draw(); }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const handleMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
    const a = findAgent(e.clientX - r.left, e.clientY - r.top);
    setHovered(a?.id ?? null);
    e.currentTarget.style.cursor = a ? "pointer" : "default";
  }, [findAgent]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const a = findAgent(e.clientX - r.left, e.clientY - r.top);
    if (a) onSelect(a);
  }, [findAgent, onSelect]);

  return (
    <div className="w-full rounded-2xl border border-autronis-border bg-[#0d1520] overflow-hidden">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full"
        style={{  }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHovered(null)}
        onClick={handleClick}
      />
    </div>
  );
}
