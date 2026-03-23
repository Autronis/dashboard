"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  drawSprite,
  drawSemDesk,
  getCharacterDef,
} from "./pixel-sprites";
import { getProjectColor } from "./project-colors";
import type { Agent } from "./types";

// ============ THEME PALETTES ============
interface OfficePalette {
  bgGradTop: string;
  bgGradBot: string;
  gridColor: string;
  floorTones: { r: number; g: number; b: number }[];
  floorGapDarken: number;
  floorGrainColor: string;
  floorLightCenter: string;
  floorLightEdge: string;
  particleColor: string;
  particleAlphaBase: number;
  wallGradTop: string;
  wallGradBot: string;
  wallEdge: string;
  windowFrame: string;
  windowFrameHighlight: string;
  skyGradTop: string;
  skyGradMid: string;
  skyGradBot: string;
  starColors: string[];
  cityBg: string;
  cityWindowColor: string;
  windowLightColor: string;
  deskSurface: string;
  deskFront: string;
  deskLegs: string;
  chairBack: string;
  chairBackLight: string;
  chairSeat: string;
  chairArm: string;
  chairBase: string;
  monitorFrame: string;
  monitorScreen: string;
  keyboardBase: string;
  keyboardKeys: string;
  mouseColor: string;
  labelColor: string;
  shadowColor: string;
  emptyDeskShadow: string;
}

const DARK_PALETTE: OfficePalette = {
  bgGradTop: "#0a0f1a",
  bgGradBot: "#0a1a1f",
  gridColor: "#23C6B706",
  floorTones: [
    { r: 30, g: 22, b: 14 },
    { r: 36, g: 26, b: 16 },
    { r: 32, g: 24, b: 15 },
  ],
  floorGapDarken: 10,
  floorGrainColor: "rgba(255,240,220,0.015)",
  floorLightCenter: "rgba(255,255,255,0.015)",
  floorLightEdge: "rgba(0,0,0,0.03)",
  particleColor: "35, 198, 183",
  particleAlphaBase: 0.03,
  wallGradTop: "#1a2535",
  wallGradBot: "#2a3a4a",
  wallEdge: "#1e2e3e",
  windowFrame: "#5a6a7a",
  windowFrameHighlight: "#7a8a9a30",
  skyGradTop: "#060818",
  skyGradMid: "#0c1230",
  skyGradBot: "#1a1840",
  starColors: ["#ffffff", "#aaccff", "#ffddaa", "#aaddff", "#ff9966"],
  cityBg: "#0a0a1a",
  cityWindowColor: "rgba(255, 200, 100,",
  windowLightColor: "rgba(35, 198, 183,",
  deskSurface: "#4a3a2a",
  deskFront: "#5a4430",
  deskLegs: "#5a4430",
  chairBack: "#353545",
  chairBackLight: "#404055",
  chairSeat: "#303040",
  chairArm: "#2a2a38",
  chairBase: "#252530",
  monitorFrame: "#2a2a3a",
  monitorScreen: "#040406",
  keyboardBase: "#252530",
  keyboardKeys: "#353545",
  mouseColor: "#303038",
  labelColor: "#ffffffcc",
  shadowColor: "#00000010",
  emptyDeskShadow: "#00000010",
};

const LIGHT_PALETTE: OfficePalette = {
  bgGradTop: "#e8f4f8",
  bgGradBot: "#dceef2",
  gridColor: "#17B8A508",
  floorTones: [
    { r: 210, g: 190, b: 160 },  // light oak
    { r: 220, g: 198, b: 168 },  // birch
    { r: 215, g: 194, b: 164 },  // maple
  ],
  floorGapDarken: 15,
  floorGrainColor: "rgba(255,255,255,0.08)",
  floorLightCenter: "rgba(255,255,255,0.05)",
  floorLightEdge: "rgba(0,0,0,0.01)",
  particleColor: "15, 140, 130",
  particleAlphaBase: 0.08,
  wallGradTop: "#c8dae8",
  wallGradBot: "#b8ccd8",
  wallEdge: "#a0b4c0",
  windowFrame: "#8a9aaa",
  windowFrameHighlight: "#ffffff40",
  skyGradTop: "#87ceeb",
  skyGradMid: "#a8d8ea",
  skyGradBot: "#cce5f0",
  starColors: ["#ffffff", "#f0f0f0", "#e0e8f0", "#d0dce5", "#ffffff"],  // clouds
  cityBg: "#b0c8d8",
  cityWindowColor: "rgba(255, 255, 255,",
  windowLightColor: "rgba(15, 140, 130,",
  deskSurface: "#c8a878",
  deskFront: "#b89868",
  deskLegs: "#b89868",
  chairBack: "#808898",
  chairBackLight: "#909aa8",
  chairSeat: "#707888",
  chairArm: "#687080",
  chairBase: "#606870",
  monitorFrame: "#505868",
  monitorScreen: "#1a1e28",
  keyboardBase: "#606870",
  keyboardKeys: "#808898",
  mouseColor: "#707880",
  labelColor: "#1a2535ee",
  shadowColor: "#00000008",
  emptyDeskShadow: "#00000008",
};

// ============ LAYOUT ============

const S = 5;
const CANVAS_W = 1500;
const CANVAS_H = 1000;
const WALL_H = 40;

const UNIT_W = 200;
const UNIT_H = 150;
const GRID_X = 220;

// === Management row — Sem, Theo, Toby, Jones all on one line ===
const MGMT_Y = WALL_H + 2;
const SEM = { x: 20, y: MGMT_Y + 16 };

// Builders grid — shifted right, below management
const BUILDER_X = 340;
const BUILDER_START_Y = MGMT_Y + UNIT_H + 20;

// Center 4 management desks above 5 builder columns
const MGMT_OFFSET = Math.floor(UNIT_W / 2); // 100px offset to center 4 over 5

const DESK_POSITIONS: Record<string, { x: number; y: number }> = {
  // Het Bestuur — Theo, Toby, Jones, Brent centered above builders
  theo:  { x: BUILDER_X + MGMT_OFFSET, y: MGMT_Y },
  toby:  { x: BUILDER_X + MGMT_OFFSET + UNIT_W, y: MGMT_Y },
  jones: { x: BUILDER_X + MGMT_OFFSET + UNIT_W * 2, y: MGMT_Y },
  brent: { x: BUILDER_X + MGMT_OFFSET + UNIT_W * 3, y: MGMT_Y },
  // Staf — left column
  ari: { x: 20, y: BUILDER_START_Y + Math.floor(UNIT_H / 2) + 10 },
  rodi: { x: 20, y: BUILDER_START_Y + UNIT_H + Math.floor(UNIT_H / 2) + 10 },
  // Team Syb — same layout, used on V2 floor
  autro:         { x: BUILDER_X + MGMT_OFFSET, y: MGMT_Y },
  daan:          { x: BUILDER_X + MGMT_OFFSET + UNIT_W, y: MGMT_Y },
  leo:           { x: BUILDER_X + MGMT_OFFSET + UNIT_W * 2, y: MGMT_Y },
  finn:          { x: BUILDER_X, y: BUILDER_START_Y + UNIT_H },
  "wout-syb":    { x: BUILDER_X + UNIT_W, y: BUILDER_START_Y + UNIT_H },
  "bas-syb":     { x: BUILDER_X + UNIT_W * 2, y: BUILDER_START_Y + UNIT_H },
  "gabriel-syb": { x: BUILDER_X + UNIT_W * 3, y: BUILDER_START_Y + UNIT_H },
  "ari-syb":     { x: 20, y: BUILDER_START_Y + Math.floor(UNIT_H / 2) + 10 },
  // Builders row 2 — Team Sem (5 columns)
  wout: { x: BUILDER_X, y: BUILDER_START_Y + UNIT_H },
  bas: { x: BUILDER_X + UNIT_W, y: BUILDER_START_Y + UNIT_H },
  gabriel: { x: BUILDER_X + UNIT_W * 2, y: BUILDER_START_Y + UNIT_H },
  tijmen: { x: BUILDER_X + UNIT_W * 3, y: BUILDER_START_Y + UNIT_H },
  pedro: { x: BUILDER_X + UNIT_W * 4, y: BUILDER_START_Y + UNIT_H },
  // Builders row 3
  vincent: { x: BUILDER_X, y: BUILDER_START_Y + UNIT_H * 2 },
  noah:    { x: BUILDER_X + UNIT_W, y: BUILDER_START_Y + UNIT_H * 2 },
  nikkie:  { x: BUILDER_X + UNIT_W * 2, y: BUILDER_START_Y + UNIT_H * 2 },
  adam:    { x: BUILDER_X + UNIT_W * 3, y: BUILDER_START_Y + UNIT_H * 2 },
};

// Empty desks
const EMPTY_DESKS = [
  // Row 1 (above builders)
  { x: BUILDER_X, y: BUILDER_START_Y },
  { x: BUILDER_X + UNIT_W, y: BUILDER_START_Y },
  { x: BUILDER_X + UNIT_W * 2, y: BUILDER_START_Y },
  { x: BUILDER_X + UNIT_W * 3, y: BUILDER_START_Y },
  { x: BUILDER_X + UNIT_W * 4, y: BUILDER_START_Y },
  // Row 3 (5th column)
  { x: BUILDER_X + UNIT_W * 4, y: BUILDER_START_Y + UNIT_H * 2 },
];

const DESKS_BOTTOM = BUILDER_START_Y + UNIT_H * 3 + 10;

// Command screen — right side, prominent
const MEETING = { x: BUILDER_X + UNIT_W * 5 + 20, y: MGMT_Y + 10, w: CANVAS_W - (BUILDER_X + UNIT_W * 5 + 20) - 180, h: 110 };

// Stand-by area — full width, multi-row grid
const COFFEE_Y = DESKS_BOTTOM + 40;
const COFFEE_X = 14;
const COFFEE_W = CANVAS_W - 28;
const STANDBY_COLS = 8; // max per row (leave room for decorations on right)
const STANDBY_SPACING = Math.floor((COFFEE_W - 300) / STANDBY_COLS); // ~120px, leave 300px right for bonsai+table
const STANDBY_ROW_H = 110; // vertical spacing between rows

const COFFEE_SEATS: { x: number; y: number }[] = [];
for (let r = 0; r < 3; r++) { // up to 3 rows = 30 agents
  for (let c = 0; c < STANDBY_COLS; c++) {
    COFFEE_SEATS.push({
      x: COFFEE_X + 14 + c * STANDBY_SPACING,
      y: COFFEE_Y + 30 + r * STANDBY_ROW_H,
    });
  }
}

const FRAME_MS = 1000 / 8;

// ============ 2D DESK (proven working design + shadow for depth) ============

// Lucide icon SVG paths (exact same as lucide-react) drawn on canvas
const LUCIDE_PATHS: Record<string, string[]> = {
  crown: [
    "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z",
    "M5 21h14",
  ],
  hammer: [
    "m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9",
    "m18 15 4-4",
    "m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5",
  ],
  search: [
    "M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0",
    "m21 21-4.3-4.3",
  ],
  compass: [
    "M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0",
    "M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49",
  ],
  bot: [
    "M12 8V4H8",
    "M2 14h2", "M20 14h2",
    "M15 13a3 3 0 0 1 0 6H9a3 3 0 0 1 0-6z",
    "M12 4a2 2 0 0 1 0 4",
  ],
  cog: [
    "M12 20a8 8 0 1 0 0-16a8 8 0 0 0 0 16Z",
    "M12 14a2 2 0 1 0 0-4a2 2 0 0 0 0 4Z",
    "M12 2v2", "M12 22v-2", "m17 20.66-1-1.73", "M11 10.27L7 3.34",
    "m20.66 17-1.73-1", "m3.34 7 1.73 1", "M14 12h8", "M2 12h2",
    "m20.66 7-1.73 1", "m3.34 17 1.73-1", "m17 3.34-1 1.73", "m11 13.73-4 6.93",
  ],
};

function drawRoleIcon(ctx: CanvasRenderingContext2D, role: string, agentId: string, ix: number, iy: number, size: number) {
  const sc = size / 24;
  ctx.save();
  ctx.translate(ix, iy);
  ctx.scale(sc, sc);

  const color = agentId === "sem" ? "#f59e0b"
    : role === "manager" ? "#f59e0b"
    : role === "reviewer" ? "#a855f7"
    : role === "architect" ? "#f59e0b"
    : role === "assistant" ? "#23C6B7"
    : role === "automation" ? "#4ade80"
    : "#3b82f6";

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = "none";

  const pathKey = agentId === "sem" ? "crown"
    : role === "manager" ? "crown"
    : role === "reviewer" ? "search"
    : role === "architect" ? "compass"
    : role === "assistant" ? "bot"
    : role === "automation" ? "cog"
    : "hammer";

  const paths = LUCIDE_PATHS[pathKey] ?? LUCIDE_PATHS.hammer;
  for (const d of paths) {
    const p = new Path2D(d);
    ctx.stroke(p);
  }

  ctx.restore();
}

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
  emptyDesk: boolean = false,
  pal: OfficePalette = DARK_PALETTE,
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
    const labelY2 = deskY + deskH + 5 * s;
    const maxW = deskW + 4 * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 2, labelY2 - 2, maxW + 10, 50);
    ctx.clip();

    const rolLabels: Record<string, { label: string; color: string }> = {
      manager: { label: "Manager", color: "#f59e0b" },
      builder: { label: "Builder", color: "#3b82f6" },
      reviewer: { label: "Reviewer", color: "#a855f7" },
      architect: { label: "Architect", color: "#f59e0b" },
      assistant: { label: "Research & Docs", color: "#23C6B7" },
      automation: { label: "Automation", color: "#4ade80" },
    };
    const isSem = agent.id === "sem";
    const rol = isSem
      ? { label: "CEO", color: "#f59e0b" }
      : (rolLabels[agent.rol ?? "builder"] ?? rolLabels.builder);

    // Role icon (custom drawn)
    drawRoleIcon(ctx, agent.rol ?? "builder", agent.id, labelX, labelY2 - 2, 14);
    const iconW = 17;

    // Line 1: Name + rol on same line (compact)
    ctx.font = "bold 12px Inter, system-ui, sans-serif";
    ctx.fillStyle = pal.labelColor;
    let name = agent.naam;
    while (ctx.measureText(name).width > maxW * 0.4 && name.length > 2) name = name.slice(0, -1);
    ctx.fillText(name, labelX + iconW, labelY2 + 10);

    // Rol inline after name (smaller, grey)
    const nmW = ctx.measureText(name).width;
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#a0b0ba";
    ctx.fillText(rol.label, labelX + iconW + nmW + 4, labelY2 + 10);

    // Line 2: → Project (more spacing below)
    if (agent.huidigeTaak) {
      ctx.font = "10px Inter, system-ui, sans-serif";
      let proj = agent.huidigeTaak.project;
      while (ctx.measureText("→ " + proj).width > maxW && proj.length > 3) proj = proj.slice(0, -2) + ".";
      ctx.fillStyle = projectColor;
      ctx.fillText("→ " + proj, labelX, labelY2 + 26);
    }

    ctx.restore();
    return;
  }

  // Dim desk if a project is hovered and this agent isn't on that project
  // (passed via projectColor === "#3a4a55" as a proxy for "not highlighted")

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
    // Glow under desk
    const hoverGrad = ctx.createRadialGradient(x + 14 * s, deskY + deskH / 2, 0, x + 14 * s, deskY + deskH / 2, 20 * s);
    hoverGrad.addColorStop(0, "#23C6B715");
    hoverGrad.addColorStop(1, "#23C6B700");
    ctx.fillStyle = hoverGrad;
    ctx.beginPath();
    ctx.arc(x + 14 * s, deskY + deskH / 2, 20 * s, 0, Math.PI * 2);
    ctx.fill();
    // "→ open" hint
    ctx.font = "9px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#23C6B760";
    ctx.fillText("→ open", x + 2 * s, y + 30 * s);
  }

  // Shadow + reflection under desk
  ctx.fillStyle = pal.shadowColor;
  ctx.beginPath();
  ctx.ellipse(x + 14 * s, deskY + deskH + 4 * s, 14 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Subtle floor reflection
  ctx.fillStyle = pal === LIGHT_PALETTE ? "#ffffff06" : "#ffffff03";
  ctx.fillRect(x + 4 * s, deskY + deskH + 5 * s, deskW - 4 * s, 2);

  // Office chair (behind desk, where agent sits)
  if (!isOffline) {
    const chairX = x + 7 * s;
    const chairBotY = deskY - s;
    // Backrest
    ctx.fillStyle = pal.chairBack;
    ctx.fillRect(chairX + s, chairBotY - 10 * s, 8 * s, 4 * s);
    ctx.fillStyle = pal.chairBackLight;
    ctx.fillRect(chairX + 2 * s, chairBotY - 9 * s, 6 * s, 2 * s);
    // Seat
    ctx.fillStyle = pal.chairSeat;
    ctx.fillRect(chairX, chairBotY - 2 * s, 10 * s, 2 * s);
    // Armrests
    ctx.fillStyle = pal.chairArm;
    ctx.fillRect(chairX - s, chairBotY - 4 * s, s, 3 * s);
    ctx.fillRect(chairX + 10 * s, chairBotY - 4 * s, s, 3 * s);
    // Base pole
    ctx.fillStyle = pal.chairBase;
    ctx.fillRect(chairX + 4 * s, chairBotY, 2 * s, s);
  }

  // Character sitting behind desk (skip if empty desk — agent is in stand-by)
  if (!isOffline && !isHovered && !emptyDesk) {
    const charH = charDef.rows * s;
    const sitY = deskY - charH + 4 * s;
    const bob = agent.status === "idle" ? Math.sin(tick * 0.25 + x) * 1.5 : 0;
    drawSprite(ctx, charDef.sprite, x + 6 * s, sitY + bob, s);
  }

  // Desk surface
  ctx.fillStyle = pal.deskSurface;
  ctx.fillRect(x + 2 * s, deskY, deskW, deskH);
  ctx.fillStyle = pal.deskFront;
  ctx.fillRect(x + 2 * s, deskY + deskH, deskW, 2 * s);
  ctx.fillStyle = pal.deskLegs;
  ctx.fillRect(x + 3 * s, deskY + deskH + 2 * s, 2 * s, 2 * s);
  ctx.fillRect(x + 23 * s, deskY + deskH + 2 * s, 2 * s, 2 * s);

  // Monitor — smaller version of Sem's style
  const monW = 7 * s;
  const monH = 5 * s;
  const monX = x + 19 * s;
  const monY = deskY - monH + s * 3;
  const glow = 0.6 + Math.sin(tick * 0.35 + x * 0.01) * 0.15;

  // Frame (always visible)
  ctx.fillStyle = pal.monitorFrame;
  ctx.fillRect(monX, monY, monW, monH);

  if (isOffline) {
    ctx.fillStyle = pal.monitorScreen;
    ctx.fillRect(monX + s, monY + s, 5 * s, 3 * s);
  } else if (isActive) {
    // Turquoise screen glow — same glow strength as Sem's monitors
    ctx.fillStyle = `rgba(35, 198, 183, ${glow * 0.25})`;
    ctx.fillRect(monX + s, monY + s, 5 * s, 3 * s);
    // Code lines — #23C6B750 like Sem's (clamped to screen area)
    ctx.fillStyle = "#23C6B750";
    for (let ln = 0; ln < 2; ln++) {
      ctx.fillRect(monX + 1.5 * s, monY + (1.5 + ln * 1.5) * s, (2 + (tick + ln) % 3) * s, s);
    }
  } else {
    // Idle but not offline — dim turquoise like a standby screen
    ctx.fillStyle = `rgba(35, 198, 183, ${glow * 0.08})`;
    ctx.fillRect(monX + s, monY + s, 5 * s, 3 * s);
  }

  // Stand
  ctx.fillStyle = pal.monitorFrame;
  ctx.fillRect(monX + 3 * s, monY + monH, s, s);

  // Keyboard + mouse + water bottle
  if (!isOffline) {
    const kbX = x + 9 * s;
    const kbY = deskY + 2 * s;
    ctx.fillStyle = pal.keyboardBase;
    ctx.fillRect(kbX, kbY, 6 * s, 1.5 * s);
    ctx.fillStyle = isActive && tick % 4 < 2 ? pal.chairBackLight : pal.keyboardKeys;
    ctx.fillRect(kbX + s * 0.3, kbY + s * 0.2, 5.4 * s, s * 0.4);
    ctx.fillRect(kbX + s * 0.3, kbY + s * 0.8, 5.4 * s, s * 0.4);
    // Mouse (right of keyboard)
    ctx.fillStyle = pal.mouseColor;
    ctx.beginPath();
    ctx.ellipse(kbX + 8 * s, kbY + s * 0.7, s * 0.8, s * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.chairSeat;
    ctx.fillRect(kbX + 7.4 * s, kbY + s * 0.1, s * 0.3, s * 0.5);
    // Water bottle (only on occupied desks)
    if (!emptyDesk) {
      const wbX = x + 3 * s;
      const wbY = deskY - 2;
      ctx.fillStyle = "#87ceeb40";
      ctx.fillRect(wbX, wbY - s * 2, s * 1.2, s * 3);
      ctx.fillStyle = "#6ab8d830";
      ctx.fillRect(wbX + s * 1.2, wbY - s * 1.8, s * 0.4, s * 2.8);
      ctx.fillStyle = "#60b8e835";
      ctx.fillRect(wbX + s * 0.1, wbY - s * 0.5, s * 1, s * 2);
      ctx.fillStyle = "#e8e8e8";
      ctx.fillRect(wbX - s * 0.1, wbY - s * 2.4, s * 1.4, s * 0.5);
      ctx.fillStyle = "#ffffff18";
      ctx.fillRect(wbX + s * 0.2, wbY - s * 1.8, s * 0.3, s * 2);
    }
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

  // Working indicator: dots next to monitor (right side of desk)
  if (!isOffline && !isHovered && isActive) {
    const dotX = x + deskW + 4;
    const dotY = deskY - 5 * s;
    const dotCount = (Math.floor(tick / 3) % 3) + 1;
    ctx.fillStyle = "#23C6B7";
    for (let d = 0; d < dotCount; d++) {
      ctx.beginPath();
      ctx.arc(dotX, dotY + d * 5, 1.5, 0, Math.PI * 2);
      ctx.fill();
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
  ceo?: { id: string; naam: string; avatar: string };
}

export function PixelOffice({ agents, selectedId, onSelect, ceo }: PixelOfficeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const tickRef = useRef(0);
  const lastTRef = useRef(0);
  const rafRef = useRef(0);

  const { resolvedTheme } = useTheme();
  const paletteRef = useRef<OfficePalette>(DARK_PALETTE);
  paletteRef.current = resolvedTheme === "light" ? LIGHT_PALETTE : DARK_PALETTE;

  // Smooth position interpolation for agent movement
  const animPositions = useRef(new Map<string, { x: number; y: number }>());
  // Track project card rectangles for hover detection
  const projectCardRects = useRef<{ proj: string; x: number; y: number; w: number; h: number }[]>([]);

  const ceoId = ceo?.id ?? "sem";
  const ceoNaam = ceo?.naam ?? "Sem";
  const ceoAvatar = ceo?.avatar ?? "#23C6B7";

  const ceoAgent: Agent = useMemo(() => ({
    id: ceoId, naam: ceoNaam, rol: "manager", team: ceoId === "syb" ? "syb" as const : "sem" as const, status: "working",
    huidigeTaak: { id: "ceo", beschrijving: "Alles overzien", project: "Autronis", startedAt: new Date().toISOString(), status: "bezig" },
    voltooideVandaag: 0, laatsteActiviteit: new Date().toISOString(),
    avatar: ceoAvatar, terminal: [], kosten: { tokensVandaag: 0, kostenVandaag: 0, tokensHuidigeTaak: 0 },
  }), [ceoId, ceoNaam, ceoAvatar]);

  // Management always stays at desk, builders only when active
  const ALWAYS_AT_DESK = new Set(["theo", "toby", "jones", "ari", "rodi", "brent", "autro", "daan", "leo", "ari-syb"]);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; agent: Agent }>();
    map.set("sem", { x: SEM.x, y: SEM.y, agent: semAgent });
    let ei = 0; // empty desk index

    // First pass: desk agents
    agents.forEach((a) => {
      const desk = DESK_POSITIONS[a.id];
      const isActive = a.status === "working" || a.status === "reviewing";
      const staysAtDesk = ALWAYS_AT_DESK.has(a.id);
      if (desk && (isActive || staysAtDesk)) {
        map.set(a.id, { x: desk.x, y: desk.y, agent: a });
      } else if (!desk && isActive && ei < EMPTY_DESKS.length) {
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

    // === Gradient background ===
    const pal = paletteRef.current;
    const isLight = pal === LIGHT_PALETTE;
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, pal.bgGradTop);
    bgGrad.addColorStop(1, pal.bgGradBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle moving grid (matrix/cyber effect)
    ctx.strokeStyle = pal.gridColor;
    ctx.lineWidth = 0.5;
    const gridOffset = (tick * 0.3) % 40;
    for (let gx = -40; gx < CANVAS_W + 40; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx + gridOffset, WALL_H); ctx.lineTo(gx + gridOffset, CANVAS_H); ctx.stroke();
    }
    for (let gy = WALL_H; gy < CANVAS_H; gy += 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CANVAS_W, gy); ctx.stroke();
    }

    // Wooden floor
    const plankH = 12;
    for (let py = WALL_H; py < CANVAS_H; py += plankH) {
      const plankIdx = Math.floor(py / plankH);
      const tone = pal.floorTones[plankIdx % 3];
      const v = ((plankIdx * 7 + 13) % 7) - 3;
      const r = tone.r + v;
      const g = tone.g + v;
      const b = tone.b + v;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, py, CANVAS_W, plankH);
      // Gap line
      const gd = pal.floorGapDarken;
      ctx.fillStyle = `rgb(${r - gd},${g - gd + 2},${b - gd + 4})`;
      ctx.fillRect(0, py, CANVAS_W, 1);
      // Wood grain
      if (plankIdx % 2 === 0) {
        ctx.fillStyle = pal.floorGrainColor;
        const gx = (plankIdx * 73) % CANVAS_W;
        ctx.fillRect(gx, py + 4, 70 + (plankIdx % 50), 1);
      }
    }

    // Floor lighting
    const floorLight = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 0, CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.5);
    floorLight.addColorStop(0, pal.floorLightCenter);
    floorLight.addColorStop(1, pal.floorLightEdge);
    ctx.fillStyle = floorLight;
    ctx.fillRect(0, WALL_H, CANVAS_W, CANVAS_H - WALL_H);

    // === Ambient particles ===
    for (let p = 0; p < 8; p++) {
      const px = ((tick * 0.3 + p * 187) % CANVAS_W);
      const py2 = WALL_H + 50 + ((tick * 0.15 + p * 97) % (CANVAS_H - WALL_H - 80));
      const alpha = pal.particleAlphaBase + Math.sin(tick * 0.1 + p * 2) * 0.02;
      ctx.fillStyle = `rgba(${pal.particleColor}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // === Wall ===
    const wallGrad = ctx.createLinearGradient(0, 0, 0, WALL_H);
    wallGrad.addColorStop(0, pal.wallGradTop);
    wallGrad.addColorStop(1, pal.wallGradBot);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, CANVAS_W, WALL_H);
    ctx.fillStyle = pal.wallEdge;
    ctx.fillRect(0, WALL_H, CANVAS_W, 2);

    // Windows — 5 wide rectangular windows with cross frames
    const winCount = 5;
    const winW = 80;
    const winH = WALL_H - 12;
    const winSpacing = (CANVAS_W - winCount * winW) / (winCount + 1);
    for (let i = 0; i < winCount; i++) {
      const wx = winSpacing + i * (winW + winSpacing);
      const wy = 6;

      // Outer frame
      ctx.fillStyle = pal.windowFrame;
      ctx.fillRect(wx - 2, wy - 2, winW + 4, winH + 4);

      // Sky gradient
      const skyGrad = ctx.createLinearGradient(wx, wy, wx, wy + winH);
      skyGrad.addColorStop(0, pal.skyGradTop);
      skyGrad.addColorStop(0.5, pal.skyGradMid);
      skyGrad.addColorStop(1, pal.skyGradBot);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(wx, wy, winW, winH);

      // Stars (dark) / Clouds (light)
      const starPositions = [
        [0.12, 0.2], [0.35, 0.15], [0.6, 0.3], [0.82, 0.12], [0.25, 0.55],
        [0.7, 0.6], [0.45, 0.75], [0.15, 0.8], [0.9, 0.45], [0.5, 0.4],
      ];
      if (isLight) {
        // Draw fluffy clouds
        for (let ci = 0; ci < 3; ci++) {
          const cx = wx + ((ci * 30 + tick * 0.05 + i * 20) % (winW + 10)) - 5;
          const cy = wy + 6 + ci * 7;
          ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(tick * 0.03 + ci) * 0.15})`;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 12 + ci * 2, 4 + ci, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(cx + 8, cy - 2, 8, 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        for (let si = 0; si < starPositions.length; si++) {
          const [sx, sy] = starPositions[si];
          const starAlpha = 0.3 + Math.sin(tick * 0.15 + i * 5 + si * 3.7) * 0.25;
          const starSize = si < 3 ? 2 : 1.2;
          ctx.fillStyle = `${pal.starColors[si % pal.starColors.length]}${Math.round(starAlpha * 255).toString(16).padStart(2, "0")}`;
          ctx.fillRect(wx + sx * winW, wy + sy * winH, starSize, starSize);
        }
      }

      // Distant city skyline silhouette (bottom of window)
      if (!isLight) {
        ctx.fillStyle = pal.cityBg;
        const bldgH = [8, 12, 6, 14, 9, 7, 11, 5, 10, 8];
        for (let b = 0; b < 10; b++) {
          const bx = wx + b * (winW / 10);
          const bh = bldgH[(b + i * 3) % bldgH.length];
          ctx.fillRect(bx, wy + winH - bh, winW / 10, bh);
        }
        // Tiny building windows (warm glow)
        for (let b = 0; b < 6; b++) {
          const blx = wx + 4 + ((i * 13 + b * 11) % (winW - 8));
          const bly = wy + winH - 3 - ((b * 3 + i * 2) % 8);
          const bla = 0.4 + Math.sin(tick * 0.1 + i * 4 + b * 7) * 0.3;
          ctx.fillStyle = `${pal.cityWindowColor} ${bla})`;
          ctx.fillRect(blx, bly, 2, 2);
        }
      } else {
        // Light mode: distant green hills/trees
        ctx.fillStyle = "#8cc088";
        const hillH = [4, 6, 3, 7, 5, 4, 6, 3, 5, 4];
        for (let b = 0; b < 10; b++) {
          const bx = wx + b * (winW / 10);
          const bh = hillH[(b + i * 3) % hillH.length];
          ctx.beginPath();
          ctx.ellipse(bx + winW / 20, wy + winH - bh / 2, winW / 10, bh, 0, Math.PI, 0);
          ctx.fill();
        }
      }

      // Cross frame (4 panes)
      ctx.fillStyle = pal.windowFrame;
      ctx.fillRect(wx + winW / 2 - 1.5, wy, 3, winH);
      ctx.fillRect(wx, wy + winH / 2 - 1.5, winW, 3);

      // Inner frame highlight (subtle 3D)
      ctx.fillStyle = pal.windowFrameHighlight;
      ctx.fillRect(wx, wy, winW, 1);
      ctx.fillRect(wx, wy, 1, winH);

      // Light fall from window onto floor
      const lightGrad = ctx.createLinearGradient(wx + winW / 2, WALL_H, wx + winW / 2, WALL_H + 120);
      const lightAlpha = isLight ? 0.06 : 0.04;
      lightGrad.addColorStop(0, `${pal.windowLightColor} ${lightAlpha})`);
      lightGrad.addColorStop(1, `${pal.windowLightColor} 0)`);
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(wx - 10, WALL_H);
      ctx.lineTo(wx + winW + 10, WALL_H);
      ctx.lineTo(wx + winW + 30, WALL_H + 120);
      ctx.lineTo(wx - 30, WALL_H + 120);
      ctx.closePath();
      ctx.fill();
    }

    // (geen separator — bedden staan op dezelfde vloer)

    // Empty desks (just desk + monitor, no chair)
    EMPTY_DESKS.forEach(({ x: ex, y: ey }) => {
      const edY = ey + 18 * S;
      const edW = 24 * S;
      const edH = 5 * S;
      // Shadow
      ctx.fillStyle = pal.emptyDeskShadow;
      ctx.beginPath();
      ctx.ellipse(ex + 14 * S, edY + edH + 4 * S, 14 * S, 3 * S, 0, 0, Math.PI * 2);
      ctx.fill();
      // Desk surface
      ctx.fillStyle = pal.deskSurface;
      ctx.fillRect(ex + 2 * S, edY, edW, edH);
      ctx.fillStyle = pal.deskFront;
      ctx.fillRect(ex + 2 * S, edY + edH, edW, 2 * S);
      ctx.fillStyle = pal.deskLegs;
      ctx.fillRect(ex + 3 * S, edY + edH + 2 * S, 2 * S, 2 * S);
      ctx.fillRect(ex + 23 * S, edY + edH + 2 * S, 2 * S, 2 * S);
      // Chair at empty desk
      const ecX = ex + 7 * S;
      const ecBotY = edY - S;
      ctx.fillStyle = pal.chairBack;
      ctx.fillRect(ecX + S, ecBotY - 10 * S, 8 * S, 4 * S);
      ctx.fillStyle = pal.chairBackLight;
      ctx.fillRect(ecX + 2 * S, ecBotY - 9 * S, 6 * S, 2 * S);
      ctx.fillStyle = pal.chairSeat;
      ctx.fillRect(ecX, ecBotY - 2 * S, 10 * S, 2 * S);
      ctx.fillStyle = pal.chairArm;
      ctx.fillRect(ecX - S, ecBotY - 4 * S, S, 3 * S);
      ctx.fillRect(ecX + 10 * S, ecBotY - 4 * S, S, 3 * S);
      ctx.fillStyle = pal.chairBase;
      ctx.fillRect(ecX + 4 * S, ecBotY, 2 * S, S);
      // Monitor (off)
      const emW = 7 * S;
      const emH = 5 * S;
      const emX = ex + 19 * S;
      const emY = edY - emH + S * 3;
      ctx.fillStyle = pal.monitorFrame;
      ctx.fillRect(emX, emY, emW, emH);
      ctx.fillStyle = pal.monitorScreen;
      ctx.fillRect(emX + S, emY + S, 5 * S, 3 * S);
      // Stand
      ctx.fillStyle = pal.monitorFrame;
      ctx.fillRect(emX + 3 * S, emY + emH, S, S);
      // Keyboard on empty desk
      const ekbX = ex + 9 * S;
      const ekbY = edY + 2 * S;
      ctx.fillStyle = pal.keyboardBase;
      ctx.fillRect(ekbX, ekbY, 6 * S, 1.5 * S);
      ctx.fillStyle = pal.keyboardKeys;
      ctx.fillRect(ekbX + S * 0.3, ekbY + S * 0.2, 5.4 * S, S * 0.4);
      ctx.fillRect(ekbX + S * 0.3, ekbY + S * 0.8, 5.4 * S, S * 0.4);
      // Mouse
      ctx.fillStyle = pal.mouseColor;
      ctx.beginPath();
      ctx.ellipse(ekbX + 8 * S, ekbY + S * 0.7, S * 0.8, S * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // === Wide Wall-mounted Command Screen ===
    const scrX = MEETING.x;
    const scrY = MEETING.y;
    const scrW = MEETING.w;
    const scrH = MEETING.h;
    const fw = 5; // thick pixel frame like desk monitors

    // (command center removed — metrics shown in command bar above)

    // === Slaapkamer (geen achtergrond — zelfde vloer) ===

    // === Group labels — all centered over full canvas width, like STAND-BY ===
    ctx.font = "bold italic 13px Inter, system-ui, sans-serif";
    ctx.letterSpacing = "3px";
    ctx.fillStyle = pal.labelColor;
    ctx.textAlign = "center";
    const centerX = CANVAS_W / 2;
    // "DE BAAS" + "HET BESTUUR" on same line (management row)
    // Hardcoded: each label Y = agent Y - 30
    ctx.fillText("DE GROTE BAAS", SEM.x + 14 * S, SEM.y + 12);
    ctx.fillText("HET BESTUUR", BUILDER_X + MGMT_OFFSET + UNIT_W * 2 - 30, DESK_POSITIONS.theo.y + 30);
    ctx.textAlign = "left";
    ctx.fillText("DE STAF", 45, DESK_POSITIONS.ari.y + 20);
    ctx.textAlign = "center";
    ctx.fillText("DE ENGINEERS", BUILDER_X + (UNIT_W * 5) / 2 - 30, DESK_POSITIONS.wout.y - 125);
    // "STAND-BY" — with same gap above as other labels
    ctx.fillText("STAND-BY", centerX, COFFEE_Y - 10);
    ctx.textAlign = "left";
    ctx.letterSpacing = "0px";

    // === Coffee machine + Water cooler on 3D table next to Sem ===
    const wcX = SEM.x + 30 * S + 10;
    const wcY = SEM.y + 12 * S;

    // 3D Table (bigger, same style as desks)
    const tW = 80;
    const tH = 14;
    const tD = 6;
    const tY = wcY + 40;
    // Shadow
    ctx.fillStyle = pal.emptyDeskShadow;
    ctx.beginPath();
    ctx.ellipse(wcX + tW / 2 - 4, tY + tH + tD + 8, tW / 2 + 4, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Table legs
    ctx.fillStyle = pal.deskFront;
    ctx.fillRect(wcX, tY + tH + tD, 3, 8);
    ctx.fillRect(wcX + tW - 6, tY + tH + tD, 3, 8);
    // Front face
    ctx.fillStyle = pal.deskFront;
    ctx.fillRect(wcX - 2, tY + tH, tW, tD);
    // Right side face
    ctx.fillStyle = pal.deskLegs;
    ctx.fillRect(wcX + tW - 2, tY + tH - 1, 4, tD + 1);
    // Top surface
    ctx.fillStyle = pal.deskSurface;
    ctx.fillRect(wcX - 2, tY, tW, tH);
    // Reflection
    ctx.fillStyle = isLight ? "#ffffff08" : "#ffffff03";
    ctx.fillRect(wcX, tY + tH + tD + 1, tW - 4, 2);

    // --- Coffee machine (left, bigger, dark) ---
    const cmX = wcX;
    const cmY = tY;
    const cmW = 30;
    const cmH = 38;
    // Body
    ctx.fillStyle = "#2a2a32";
    ctx.fillRect(cmX, cmY - cmH, cmW, cmH);
    // Right side (3D)
    ctx.fillStyle = "#222228";
    ctx.fillRect(cmX + cmW, cmY - cmH + 3, 5, cmH - 3);
    // Top
    ctx.fillStyle = "#333340";
    ctx.fillRect(cmX, cmY - cmH - 3, cmW, 4);
    ctx.fillStyle = "#2a2a32";
    ctx.fillRect(cmX + cmW, cmY - cmH - 1, 5, 4);
    // Display
    ctx.fillStyle = "#444450";
    ctx.fillRect(cmX + 4, cmY - cmH + 8, 20, 6);
    ctx.fillStyle = "#f59e0b50";
    ctx.fillRect(cmX + 5, cmY - cmH + 9, 8, 4);
    // Buttons
    ctx.fillStyle = "#555560";
    ctx.fillRect(cmX + 4, cmY - cmH + 17, 5, 4);
    ctx.fillRect(cmX + 11, cmY - cmH + 17, 5, 4);
    ctx.fillRect(cmX + 18, cmY - cmH + 17, 5, 4);
    // Nozzle area
    ctx.fillStyle = "#1a1a20";
    ctx.fillRect(cmX + 5, cmY - 14, 18, 12);
    // Cup
    ctx.fillStyle = "#d0c8b8";
    ctx.fillRect(cmX + 9, cmY - 8, 8, 7);
    ctx.fillStyle = "#5c3a1a";
    ctx.fillRect(cmX + 10, cmY - 7, 6, 4);
    // Drip tray
    ctx.fillStyle = "#3a3a42";
    ctx.fillRect(cmX + 3, cmY - 2, 22, 2);
    // Steam handle
    ctx.fillStyle = "#444";
    ctx.fillRect(cmX - 6, cmY - 18, 6, 3);
    ctx.fillRect(cmX - 8, cmY - 18, 3, 8);

    // --- Water cooler (right, bigger) ---
    const wrX = wcX + 40;
    const wrW = 28;
    const wrH = 32;
    // Body
    ctx.fillStyle = "#c8c8d0";
    ctx.fillRect(wrX, cmY - wrH, wrW, wrH);
    // Right side (3D)
    ctx.fillStyle = "#b0b0b8";
    ctx.fillRect(wrX + wrW, cmY - wrH + 3, 5, wrH - 3);
    // Top
    ctx.fillStyle = "#d8d8e0";
    ctx.fillRect(wrX, cmY - wrH - 3, wrW, 4);
    ctx.fillStyle = "#c8c8d0";
    ctx.fillRect(wrX + wrW, cmY - wrH - 1, 5, 4);
    // Panel
    ctx.fillStyle = "#8888a0";
    ctx.fillRect(wrX + 4, cmY - wrH + 8, 18, 6);
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(wrX + 5, cmY - wrH + 9, 4, 4);
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(wrX + 11, cmY - wrH + 9, 4, 4);
    // Tap
    ctx.fillStyle = "#999";
    ctx.fillRect(wrX + 7, cmY - wrH + 18, 10, 3);
    ctx.fillRect(wrX + 11, cmY - wrH + 21, 3, 5);
    // Drip tray
    ctx.fillStyle = "#bbb";
    ctx.fillRect(wrX + 4, cmY - 4, 18, 3);

    // Water bottle (bigger, rounded)
    const btlTop = cmY - wrH - 3;
    ctx.fillStyle = "#87ceeb40";
    ctx.beginPath();
    ctx.moveTo(wrX + 4, btlTop);
    ctx.lineTo(wrX + 4, btlTop - 22);
    ctx.quadraticCurveTo(wrX + wrW / 2, btlTop - 30, wrX + wrW - 4, btlTop - 22);
    ctx.lineTo(wrX + wrW - 4, btlTop);
    ctx.closePath();
    ctx.fill();
    // Highlight
    ctx.fillStyle = "#a8e4f828";
    ctx.fillRect(wrX + 7, btlTop - 26, 3, 22);
    // Neck
    ctx.fillStyle = "#ffffff50";
    ctx.fillRect(wrX + 9, btlTop - 34, 8, 8);
    // Cap
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(wrX + 8, btlTop - 36, 10, 3);
    // Water level
    ctx.fillStyle = "#60b8e820";
    ctx.fillRect(wrX + 5, btlTop - 14, wrW - 10, 12);

    // === 3D Plant (detailed, like reference) ===
    const drawPlant3D = (px: number, py: number, sw: number) => {
      // Shadow on floor
      ctx.fillStyle = "#00000012";
      ctx.beginPath();
      ctx.ellipse(px + 18, py + 50, 20, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3D Pot — theme-aware
      // Front face
      ctx.fillStyle = isLight ? "#8a7060" : "#2a2a35";
      ctx.fillRect(px, py + 24, 30, 22);
      // Right side (3D depth)
      ctx.fillStyle = isLight ? "#7a6050" : "#1e1e28";
      ctx.fillRect(px + 30, py + 26, 6, 20);
      // Top rim
      ctx.fillStyle = isLight ? "#9a8070" : "#3a3a48";
      ctx.fillRect(px - 2, py + 21, 34, 4);
      ctx.fillStyle = isLight ? "#8a7060" : "#2a2a35";
      ctx.fillRect(px + 32, py + 23, 6, 3);
      // Bottom base
      ctx.fillStyle = isLight ? "#6a5545" : "#222230";
      ctx.fillRect(px + 2, py + 46, 28, 3);
      // Dirt/soil visible at top
      ctx.fillStyle = isLight ? "#6a5038" : "#4a3828";
      ctx.fillRect(px + 2, py + 24, 26, 3);
      ctx.fillStyle = isLight ? "#7a6040" : "#5a4430";
      ctx.fillRect(px + 4, py + 24, 10, 2);

      // Stems (multiple)
      ctx.fillStyle = "#2a6838";
      ctx.fillRect(px + 10 + sw * 0.3, py + 4, 3, 22);
      ctx.fillRect(px + 18 + sw * 0.4, py + 8, 2, 18);
      ctx.fillRect(px + 6 + sw * 0.2, py + 10, 2, 16);

      // Leaves — 3 layers for depth (back → mid → front), each with sway
      // Back leaves (darkest, largest)
      const drawLeaf = (lx: number, ly: number, w: number, h: number, angle: number, clr: string) => {
        ctx.fillStyle = clr;
        ctx.save();
        ctx.translate(lx + sw * 0.6, ly);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      // Back layer
      drawLeaf(px + 2, py + 6, 10, 5, -0.3, "#1a5c2a");
      drawLeaf(px + 28, py + 4, 9, 5, 0.4, "#1a5c2a");
      drawLeaf(px + 14, py + 2, 8, 6, 0.1, "#1a5c2a");
      // Mid layer
      drawLeaf(px + 6, py - 2, 9, 4, -0.5, "#2d8a4e");
      drawLeaf(px + 24, py - 4, 10, 5, 0.3, "#2d8a4e");
      drawLeaf(px + 16, py - 6, 7, 4, -0.2, "#3aaa5e");
      drawLeaf(px + 8, py + 8, 8, 4, -0.6, "#2d8a4e");
      drawLeaf(px + 22, py + 6, 7, 4, 0.5, "#2d8a4e");
      // Front layer (brightest, smallest)
      drawLeaf(px + 10, py - 8, 7, 3, -0.4, "#4ade60");
      drawLeaf(px + 20, py - 10, 6, 3, 0.2, "#4ade60");
      drawLeaf(px + 14, py - 12, 5, 3, 0, "#6aee80");
      drawLeaf(px + 4, py - 4, 6, 3, -0.7, "#5aee70");
      drawLeaf(px + 26, py - 6, 5, 3, 0.6, "#5aee70");
      // Leaf vein details (tiny bright lines)
      ctx.fillStyle = "#80ff9020";
      ctx.fillRect(px + 12 + sw * 0.4, py - 8, 4, 1);
      ctx.fillRect(px + 18 + sw * 0.5, py - 6, 3, 1);
    };

    // 3D plant table helper (with right side face, thicker top, visible legs)
    const drawPlantTable = (tx: number, ty: number, tw: number = 44) => {
      const th = 10; const td = 6; const legH = 14;
      // Shadow
      ctx.fillStyle = pal.emptyDeskShadow;
      ctx.beginPath();
      ctx.ellipse(tx + tw / 2, ty + th + td + legH + 4, tw / 2 + 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Legs (4 corners)
      ctx.fillStyle = pal.deskFront;
      ctx.fillRect(tx + 3, ty + th + td, 3, legH);
      ctx.fillRect(tx + tw - 6, ty + th + td, 3, legH);
      ctx.fillRect(tx + 3, ty + th + td + legH - 2, 4, 2); // feet
      ctx.fillRect(tx + tw - 7, ty + th + td + legH - 2, 4, 2);
      // Front face
      ctx.fillStyle = pal.deskFront;
      ctx.fillRect(tx, ty + th, tw, td);
      // Right side face (3D depth)
      ctx.fillStyle = pal.deskLegs;
      ctx.fillRect(tx + tw, ty + th - 1, 5, td + 1);
      // Top surface
      ctx.fillStyle = pal.deskSurface;
      ctx.fillRect(tx, ty, tw, th);
      // Top right side (3D)
      ctx.fillStyle = pal.deskFront;
      ctx.fillRect(tx + tw, ty + 2, 5, th - 2);
      // Wood grain highlight
      ctx.fillStyle = isLight ? "#ffffff10" : "#ffffff06";
      ctx.fillRect(tx + 4, ty + 2, tw - 8, 2);
    };

    // Plant 1: next to Sem's coffee table
    const p1TblX = wcX + tW + 10;
    const p1TblY = tY - 2;
    drawPlantTable(p1TblX, p1TblY);
    const plantSway1 = Math.sin(tick * 0.06) * 2;
    drawPlant3D(p1TblX + 7, p1TblY - 49, plantSway1);

    // Bonsai tree: bottom-right corner on table
    const bsX = CANVAS_W - 90;
    const bsY = CANVAS_H - 170;
    const bsSway = Math.sin(tick * 0.04 + 1.5) * 0.8;

    // Table under bonsai (wider)
    const bsTblW = 56;
    const bsTblX = bsX + 18 - bsTblW / 2; // center under pot
    drawPlantTable(bsTblX, bsY + 52, 56);

    // --- Pot (theme-aware ceramic with brown soil) ---
    // Pot body
    ctx.fillStyle = isLight ? "#8a7060" : "#2a2a3a";
    ctx.fillRect(bsX - 6, bsY + 28, 48, 22);
    // Pot right side (3D)
    ctx.fillStyle = isLight ? "#7a6050" : "#1e1e2e";
    ctx.fillRect(bsX + 42, bsY + 30, 5, 20);
    // Pot rim top
    ctx.fillStyle = isLight ? "#9a8070" : "#353548";
    ctx.fillRect(bsX - 8, bsY + 26, 52, 4);
    ctx.fillStyle = isLight ? "#8a7060" : "#2a2a3a";
    ctx.fillRect(bsX + 44, bsY + 27, 5, 3);
    // Pot rim bottom detail
    ctx.fillStyle = isLight ? "#7a6858" : "#303042";
    ctx.fillRect(bsX - 6, bsY + 44, 48, 3);
    // Pot base
    ctx.fillStyle = isLight ? "#6a5545" : "#222235";
    ctx.fillRect(bsX - 4, bsY + 48, 44, 4);
    // Pot feet
    ctx.fillStyle = isLight ? "#7a6050" : "#1e1e2e";
    ctx.fillRect(bsX - 2, bsY + 52, 6, 3);
    ctx.fillRect(bsX + 32, bsY + 52, 6, 3);
    // Soil (brown)
    ctx.fillStyle = isLight ? "#6a5038" : "#4a3020";
    ctx.fillRect(bsX - 2, bsY + 30, 40, 4);
    ctx.fillStyle = isLight ? "#7a6040" : "#5a3828";
    ctx.fillRect(bsX, bsY + 30, 12, 3);
    ctx.fillRect(bsX + 22, bsY + 31, 14, 2);
    // Pebbles/stones in soil
    ctx.fillStyle = "#6a5040";
    ctx.fillRect(bsX + 4, bsY + 30, 3, 2);
    ctx.fillRect(bsX + 18, bsY + 31, 4, 2);
    ctx.fillRect(bsX + 30, bsY + 30, 3, 2);
    ctx.fillRect(bsX + 10, bsY + 32, 2, 1);
    // Moss on soil
    ctx.fillStyle = "#3a7a3a";
    ctx.fillRect(bsX + 12, bsY + 30, 3, 2);
    ctx.fillRect(bsX + 24, bsY + 31, 2, 1);
    ctx.fillStyle = "#2a6828";
    ctx.fillRect(bsX + 7, bsY + 31, 2, 1);
    ctx.fillRect(bsX + 34, bsY + 30, 2, 2);

    // --- Trunk (dark, twisted, detailed) ---
    // Main trunk
    ctx.fillStyle = "#2a1a2a";
    ctx.fillRect(bsX + 15 + bsSway * 0.3, bsY + 8, 6, 24);
    ctx.fillRect(bsX + 13 + bsSway * 0.4, bsY + 14, 4, 16);
    ctx.fillRect(bsX + 21 + bsSway * 0.2, bsY + 16, 3, 14);
    // Trunk curve/twist detail
    ctx.fillStyle = "#3a2a3a";
    ctx.fillRect(bsX + 16 + bsSway * 0.3, bsY + 10, 3, 5);
    ctx.fillRect(bsX + 14 + bsSway * 0.4, bsY + 18, 2, 4);
    ctx.fillRect(bsX + 19 + bsSway * 0.25, bsY + 22, 2, 6);
    // Bark texture
    ctx.fillStyle = "#1a0e1a";
    ctx.fillRect(bsX + 17 + bsSway * 0.3, bsY + 13, 1, 3);
    ctx.fillRect(bsX + 15 + bsSway * 0.4, bsY + 21, 1, 2);
    ctx.fillRect(bsX + 20 + bsSway * 0.2, bsY + 25, 1, 3);
    // Branch to right (thicker, with sub-branches)
    ctx.fillStyle = "#2a1a2a";
    ctx.fillRect(bsX + 22 + bsSway * 0.2, bsY + 10, 10, 3);
    ctx.fillRect(bsX + 30 + bsSway * 0.15, bsY + 6, 3, 7);
    ctx.fillRect(bsX + 26 + bsSway * 0.18, bsY + 7, 2, 4);
    ctx.fillStyle = "#3a2a3a";
    ctx.fillRect(bsX + 24 + bsSway * 0.2, bsY + 11, 3, 1);
    // Branch to left (thicker, with sub-branches)
    ctx.fillStyle = "#2a1a2a";
    ctx.fillRect(bsX + 5 + bsSway * 0.5, bsY + 6, 11, 3);
    ctx.fillRect(bsX + 3 + bsSway * 0.5, bsY + 3, 3, 6);
    ctx.fillRect(bsX + 8 + bsSway * 0.45, bsY + 4, 2, 3);
    ctx.fillStyle = "#3a2a3a";
    ctx.fillRect(bsX + 7 + bsSway * 0.5, bsY + 7, 4, 1);
    // Small branch up
    ctx.fillStyle = "#2a1a2a";
    ctx.fillRect(bsX + 17 + bsSway * 0.35, bsY + 5, 2, 5);

    // --- Foliage (pink/purple bonsai canopy — more layers, more detail) ---
    const drawCanopy = (cx: number, cy: number, w: number, h: number, clr: string) => {
      ctx.fillStyle = clr;
      ctx.beginPath();
      ctx.ellipse(cx + bsSway * 0.6, cy, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    // Deep shadow layer
    drawCanopy(bsX + 18, bsY + 4, 16, 7, "#4a2a4a");
    drawCanopy(bsX + 34, bsY + 8, 10, 5, "#4a2a4a");
    drawCanopy(bsX + 4, bsY + 6, 10, 5, "#4a2a4a");
    // Back layer (dark purple)
    drawCanopy(bsX + 18, bsY + 2, 15, 6, "#6a3a6a");
    drawCanopy(bsX + 33, bsY + 6, 10, 5, "#6a3a6a");
    drawCanopy(bsX + 5, bsY + 4, 10, 5, "#6a3a6a");
    drawCanopy(bsX + 12, bsY + 9, 8, 4, "#5a2a5a");
    drawCanopy(bsX + 26, bsY + 11, 7, 3, "#5a2a5a");
    // Mid layer (pink-purple)
    drawCanopy(bsX + 20, bsY - 1, 13, 5, "#b06a9a");
    drawCanopy(bsX + 35, bsY + 4, 8, 4, "#b06a9a");
    drawCanopy(bsX + 3, bsY + 2, 8, 4, "#b06a9a");
    drawCanopy(bsX + 14, bsY + 7, 9, 4, "#9a5a8a");
    drawCanopy(bsX + 29, bsY + 9, 7, 3, "#9a5a8a");
    drawCanopy(bsX + 8, bsY + 8, 6, 3, "#9a5a8a");
    // Front layer (pink)
    drawCanopy(bsX + 18, bsY - 4, 11, 4, "#d898b8");
    drawCanopy(bsX + 33, bsY + 2, 7, 3, "#d898b8");
    drawCanopy(bsX + 7, bsY, 7, 3, "#d898b8");
    drawCanopy(bsX + 24, bsY - 2, 6, 3, "#d898b8");
    // Highlight layer (lightest pink)
    drawCanopy(bsX + 20, bsY - 7, 7, 3, "#e8b0cc");
    drawCanopy(bsX + 31, bsY, 5, 2, "#e8b0cc");
    drawCanopy(bsX + 9, bsY - 2, 5, 2, "#e8b0cc");
    // Top highlights (brightest)
    drawCanopy(bsX + 19, bsY - 9, 5, 2, "#f0c0dd");
    drawCanopy(bsX + 28, bsY - 3, 3, 1.5, "#f0c0dd");
    drawCanopy(bsX + 12, bsY - 4, 3, 1.5, "#f0c0dd");
    // Green edge details (foliage underside)
    ctx.fillStyle = "#2a6a3a50";
    ctx.fillRect(bsX + 6 + bsSway * 0.5, bsY + 7, 5, 2);
    ctx.fillRect(bsX + 28 + bsSway * 0.3, bsY + 10, 4, 2);
    ctx.fillRect(bsX + 1 + bsSway * 0.5, bsY + 5, 3, 2);
    ctx.fillRect(bsX + 36 + bsSway * 0.2, bsY + 7, 3, 1);
    ctx.fillRect(bsX + 15 + bsSway * 0.4, bsY + 10, 4, 1);

    // === Sem desk ===
    drawSemDesk(ctx, SEM.x, SEM.y, tick, selectedId === "sem", S, isLight);

    // === Desks pass 1 — always draw desk, but agent only if active/management ===
    Object.entries(DESK_POSITIONS).forEach(([id, pos]) => {
      const agent = agents.find((a) => a.id === id);
      if (!agent) return;
      const isActive = agent.status === "working" || agent.status === "reviewing";
      const staysAtDesk = ALWAYS_AT_DESK.has(id);
      if (!isActive && !staysAtDesk) {
        // Draw empty desk (agent is in stand-by) — desk with furniture but no character
        drawDesk(ctx, pos.x, pos.y, agent, "#3a4a55", tick, false, false, false, S, true, pal);
        return;
      }
      const pc = agent.huidigeTaak ? getProjectColor(agent.huidigeTaak.project) : "#3a4a55";
      drawDesk(ctx, pos.x, pos.y, agent, pc, tick, selectedId === id, hovered === id, false, S, false, pal);
    });

    // === Desks pass 2: labels (only for occupied desks) ===
    Object.entries(DESK_POSITIONS).forEach(([id, pos]) => {
      const agent = agents.find((a) => a.id === id);
      if (!agent) return;
      const isActive = agent.status === "working" || agent.status === "reviewing";
      const staysAtDesk = ALWAYS_AT_DESK.has(id);
      if (!isActive && !staysAtDesk) return; // no label for empty desk
      const pc = agent.huidigeTaak ? getProjectColor(agent.huidigeTaak.project) : "#3a4a55";
      drawDesk(ctx, pos.x, pos.y, agent, pc, tick, selectedId === id, hovered === id, true, S, false, pal);
    });

    // === System connections between agents ===
    // Build project groups for connections
    const projectGroups: Record<string, { x: number; y: number; id: string }[]> = {};
    Object.entries(DESK_POSITIONS).forEach(([id, pos]) => {
      const agent = agents.find((a) => a.id === id);
      if (!agent || !agent.huidigeTaak || agent.status === "idle" || agent.status === "offline") return;
      if (agent.rol === "manager") return;
      const proj = agent.huidigeTaak.project;
      if (!projectGroups[proj]) projectGroups[proj] = [];
      projectGroups[proj].push({ x: pos.x + 14 * S, y: pos.y + 14 * S, id });
    });

    // Draw thin connections between related desks
    Object.entries(projectGroups).forEach(([proj, group]) => {
      if (group.length < 2) return;
      const color = getProjectColor(proj);
      // If a project is hovered in sidebar, highlight its connections, dim others
      const isHighlighted = hoveredProject === proj;
      const isDimmed = hoveredProject !== null && !isHighlighted;
      const lineAlpha = isDimmed ? "08" : isHighlighted ? "50" : "20";
      const dotAlpha = isDimmed ? "10" : isHighlighted ? "80" : "40";

      ctx.strokeStyle = `${color}${lineAlpha}`;
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.setLineDash([3, 5]);
      for (let i = 0; i < group.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(group[i].x, group[i].y);
        ctx.lineTo(group[i + 1].x, group[i + 1].y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Moving data dot
      if (group.length >= 2 && !isDimmed) {
        const t = (tick * 0.04) % 1;
        const dotX = group[0].x + (group[1].x - group[0].x) * t;
        const dotY = group[0].y + (group[1].y - group[0].y) * t;
        ctx.fillStyle = `${color}${dotAlpha}`;
        ctx.beginPath();
        ctx.arc(dotX, dotY, isHighlighted ? 3.5 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // === 3D table with coffee machine + water cooler next to bottom-right plant ===
    const sbTX = CANVAS_W - 190;
    const sbTW = 80;
    const sbTH = 14;
    const sbTD = 6;
    const sbTY = CANVAS_H - 115;
    // Shadow
    ctx.fillStyle = pal.emptyDeskShadow;
    ctx.beginPath();
    ctx.ellipse(sbTX + sbTW / 2 - 4, sbTY + sbTH + sbTD + 8, sbTW / 2 + 4, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Table legs
    ctx.fillStyle = pal.deskFront;
    ctx.fillRect(sbTX, sbTY + sbTH + sbTD, 3, 8);
    ctx.fillRect(sbTX + sbTW - 6, sbTY + sbTH + sbTD, 3, 8);
    // Front face
    ctx.fillStyle = pal.deskFront;
    ctx.fillRect(sbTX - 2, sbTY + sbTH, sbTW, sbTD);
    // Right side face
    ctx.fillStyle = pal.deskLegs;
    ctx.fillRect(sbTX + sbTW - 2, sbTY + sbTH - 1, 4, sbTD + 1);
    // Top surface
    ctx.fillStyle = pal.deskSurface;
    ctx.fillRect(sbTX - 2, sbTY, sbTW, sbTH);

    // --- Coffee machine (left on table) ---
    const sbCmX = sbTX;
    const sbCmY = sbTY;
    const sbCmW = 30;
    const sbCmH = 38;
    ctx.fillStyle = "#2a2a32";
    ctx.fillRect(sbCmX, sbCmY - sbCmH, sbCmW, sbCmH);
    ctx.fillStyle = "#222228";
    ctx.fillRect(sbCmX + sbCmW, sbCmY - sbCmH + 3, 5, sbCmH - 3);
    ctx.fillStyle = "#333340";
    ctx.fillRect(sbCmX, sbCmY - sbCmH - 3, sbCmW, 4);
    ctx.fillStyle = "#2a2a32";
    ctx.fillRect(sbCmX + sbCmW, sbCmY - sbCmH - 1, 5, 4);
    // Display
    ctx.fillStyle = "#444450";
    ctx.fillRect(sbCmX + 4, sbCmY - sbCmH + 8, 20, 6);
    ctx.fillStyle = "#f59e0b50";
    ctx.fillRect(sbCmX + 5, sbCmY - sbCmH + 9, 8, 4);
    // Buttons
    ctx.fillStyle = "#555560";
    ctx.fillRect(sbCmX + 4, sbCmY - sbCmH + 17, 5, 4);
    ctx.fillRect(sbCmX + 11, sbCmY - sbCmH + 17, 5, 4);
    ctx.fillRect(sbCmX + 18, sbCmY - sbCmH + 17, 5, 4);
    // Nozzle area
    ctx.fillStyle = "#1a1a20";
    ctx.fillRect(sbCmX + 5, sbCmY - 14, 18, 12);
    // Cup
    ctx.fillStyle = "#d0c8b8";
    ctx.fillRect(sbCmX + 9, sbCmY - 8, 8, 7);
    ctx.fillStyle = "#5c3a1a";
    ctx.fillRect(sbCmX + 10, sbCmY - 7, 6, 4);
    // Drip tray
    ctx.fillStyle = "#3a3a42";
    ctx.fillRect(sbCmX + 3, sbCmY - 2, 22, 2);

    // --- Water cooler (right on table) ---
    const sbWrX = sbTX + 42;
    const sbWrW = 28;
    const sbWrH = 32;
    ctx.fillStyle = "#c8c8d0";
    ctx.fillRect(sbWrX, sbCmY - sbWrH, sbWrW, sbWrH);
    ctx.fillStyle = "#b0b0b8";
    ctx.fillRect(sbWrX + sbWrW, sbCmY - sbWrH + 3, 5, sbWrH - 3);
    ctx.fillStyle = "#d8d8e0";
    ctx.fillRect(sbWrX, sbCmY - sbWrH - 3, sbWrW, 4);
    ctx.fillStyle = "#c8c8d0";
    ctx.fillRect(sbWrX + sbWrW, sbCmY - sbWrH - 1, 5, 4);
    // Panel
    ctx.fillStyle = "#8888a0";
    ctx.fillRect(sbWrX + 4, sbCmY - sbWrH + 8, 18, 6);
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(sbWrX + 5, sbCmY - sbWrH + 9, 4, 4);
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(sbWrX + 11, sbCmY - sbWrH + 9, 4, 4);
    // Tap
    ctx.fillStyle = "#999";
    ctx.fillRect(sbWrX + 7, sbCmY - sbWrH + 18, 10, 3);
    ctx.fillRect(sbWrX + 11, sbCmY - sbWrH + 21, 3, 5);

    // === Idle agents (standing in a row) — same filter as positions map ===
    const standingAgents = agents.filter((a) => {
      if (a.status === "offline") return false;
      const desk = DESK_POSITIONS[a.id];
      const isActive = a.status === "working" || a.status === "reviewing";
      const staysAtDesk = ALWAYS_AT_DESK.has(a.id);
      if (desk && (isActive || staysAtDesk)) return false;
      if (!desk && isActive) return false;
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

      // Label below — same style as desk labels (name + role + project)
      const charH = charDef.rows * S;
      const sbIconSize = 14;
      const sbIconW = sbIconSize + 3;
      const labelY = ay + charH + 4;

      // Role icon
      drawRoleIcon(ctx, agent.rol, agent.id, ax, labelY - 2, sbIconSize);

      // Name + role inline
      const rolLabels: Record<string, { label: string }> = {
        manager: { label: "Manager" },
        builder: { label: "Builder" },
        reviewer: { label: "Reviewer" },
        architect: { label: "Architect" },
        assistant: { label: "Research & Docs" },
        automation: { label: "Automation" },
      };
      const rolLabel = rolLabels[agent.rol]?.label ?? "Builder";

      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      ctx.fillStyle = pal.labelColor;
      let name = agent.naam;
      ctx.fillText(name, ax + sbIconW, labelY + 10);

      const nmW = ctx.measureText(name).width;
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.fillStyle = isLight ? "#6a7a8a" : "#a0b0ba";
      ctx.fillText(rolLabel, ax + sbIconW + nmW + 4, labelY + 10);

      // Project line (if active) or "Stand-by"
      ctx.font = "10px Inter, system-ui, sans-serif";
      if (agent.huidigeTaak) {
        const projColor = getProjectColor(agent.huidigeTaak.project);
        let proj = agent.huidigeTaak.project;
        ctx.fillStyle = projColor;
        ctx.fillText("→ " + proj, ax, labelY + 24);
      } else {
        ctx.fillStyle = isLight ? "#8a9aaa" : "#5a6a7a";
        ctx.fillText("Stand-by", ax, labelY + 24);
      }

      if (selectedId === agent.id) {
        ctx.strokeStyle = "#23C6B7"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.strokeRect(ax - 6, ay - 6, charDef.cols * S + 12, charH + 38);
        ctx.setLineDash([]);
      }
    });

    // === Hover tooltip (clean, white text, no border) ===
    if (hovered) {
      const ha = positions.get(hovered);
      if (ha && ha.agent.status !== "offline") {
        const { agent } = ha;
        const desk = DESK_POSITIONS[agent.id];
        const rolTextMap: Record<string, string> = {
          manager: "Manager", builder: "Builder", reviewer: "Reviewer",
          architect: "Architect", assistant: "Research & Docs", automation: "Automation",
        };
        const rolText = agent.id === "sem" ? "CEO" : (rolTextMap[agent.rol] ?? "Builder");
        const proj = agent.huidigeTaak?.project ?? "Stand-by";
        const projColor = agent.huidigeTaak ? getProjectColor(proj) : "#8a9aaa";
        const cost = `\u20AC${agent.kosten.kostenVandaag.toFixed(2)}`;
        const task = agent.huidigeTaak?.beschrijving ?? "";
        const taskDisplay = task.length > 35 ? task.slice(0, 34) + "..." : task;

        const tw = 280;
        const th = task ? 82 : 62;
        // Use actual position from positions map (not desk position — agent might be in stand-by)
        const agentY = ha.y;
        const ttX = ha.x + 2 * S;
        // If tooltip would go above canvas, show below agent instead
        const above = agentY - th + 22;
        const ttY = above < 20 ? agentY + 28 * S : above;
        const tx = Math.max(10, Math.min(ttX, CANVAS_W - tw - 10));
        const ty = Math.max(10, ttY);

        // Background with subtle shadow
        ctx.fillStyle = "#00000030";
        ctx.beginPath(); ctx.roundRect(tx + 3, ty + 3, tw, th, 10); ctx.fill();
        ctx.fillStyle = "#0d1117f0";
        ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 10); ctx.fill();

        // Left accent bar
        ctx.fillStyle = projColor;
        ctx.fillRect(tx + 1, ty + 8, 3, th - 16);

        // Role icon (custom drawn, large)
        drawRoleIcon(ctx, agent.rol, agent.id, tx + 12, ty + 8, 18);
        const ttIconW = 24;

        // Name (large, white, bold)
        ctx.font = "bold 16px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(agent.naam, tx + 14 + ttIconW, ty + 22);

        // Cost (right-aligned, amber)
        ctx.font = "bold 12px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#f59e0b";
        const costW = ctx.measureText(cost).width;
        ctx.fillText(cost, tx + tw - costW - 14, ty + 22);

        // Role
        ctx.font = "11px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#8a9aaa";
        ctx.fillText(rolText, tx + 14, ty + 38);

        // Status dot
        const statusColor = agent.status === "working" ? "#4ade80" :
          agent.status === "reviewing" ? "#a855f7" :
          agent.status === "error" ? "#ef4444" : "#6b7280";
        ctx.fillStyle = statusColor;
        ctx.beginPath();
        const rolW = ctx.measureText(rolText).width;
        ctx.arc(tx + 14 + rolW + 8, ty + 35, 3, 0, Math.PI * 2);
        ctx.fill();

        // Project
        ctx.font = "bold 11px Inter, system-ui, sans-serif";
        ctx.fillStyle = projColor;
        ctx.fillText(proj, tx + 14, ty + 54);

        // Task description
        if (taskDisplay) {
          ctx.font = "10px Inter, system-ui, sans-serif";
          ctx.fillStyle = "#6b7b8b";
          ctx.fillText(taskDisplay, tx + 14, ty + 70);
        }
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

    ctx.fillStyle = isLight ? "#5a6a7a18" : "#3a4a5510"; ctx.font = "bold 18px monospace";
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
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    setMouse({ x: mx, y: my });
    const a = findAgent(mx, my);
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
