import type { Agent, TaskLogEntry } from "./types";

// ============ AGENT ROSTER ============
// Defines who the agents are (identity only).
// All activity data (status, tasks, costs, terminal) comes from the live API.

const noKosten = { tokensVandaag: 0, kostenVandaag: 0, tokensHuidigeTaak: 0 };

function agent(
  id: string, naam: string, rol: Agent["rol"], team: "sem" | "syb", avatar: string
): Agent {
  return {
    id, naam, rol, team, avatar,
    status: "idle",
    huidigeTaak: null,
    voltooideVandaag: 0,
    laatsteActiviteit: new Date().toISOString(),
    terminal: [],
    kosten: noKosten,
  };
}

// --- Team Sem: Management ---
const theo = agent("theo", "Theo", "manager", "sem", "#f59e0b");
const toby = agent("toby", "Toby", "reviewer", "sem", "#a855f7");
const jones = agent("jones", "Jones", "architect", "sem", "#eab308");

// --- Team Sem: Builders ---
const wout = agent("wout", "Wout", "builder", "sem", "#3b82f6");
const bas = agent("bas", "Bas", "builder", "sem", "#06b6d4");
const gabriel = agent("gabriel", "Gabriel", "builder", "sem", "#10b981");
const object51 = agent("object51", "Object 51", "builder", "sem", "#6366f1");
const tijmen = agent("tijmen", "Tijmen", "builder", "sem", "#f97316");
const pedro = agent("pedro", "Pedro", "builder", "sem", "#ec4899");
const vincent = agent("vincent", "Vincent", "builder", "sem", "#8b5cf6");

// --- Team Sem: Available Pool ---
const adam = agent("adam", "Adam", "builder", "sem", "#1e3a5f");
const noah = agent("noah", "Noah", "builder", "sem", "#60a5fa");
const jack = agent("jack", "Jack", "builder", "sem", "#6b7280");
const nikkie = agent("nikkie", "Nikkie", "builder", "sem", "#a7f3d0");
const xia = agent("xia", "Xia", "builder", "sem", "#f87171");
const thijs = agent("thijs", "Thijs", "builder", "sem", "#1e3a5f");
const leonard = agent("leonard", "Leonard", "builder", "sem", "#7f1d1d");
const rijk = agent("rijk", "Rijk", "builder", "sem", "#ef4444");
const coen = agent("coen", "Coen", "builder", "sem", "#3b82f6");
const senna = agent("senna", "Senna", "builder", "sem", "#4a5c2a");

// --- Team Sem: Support ---
const ari = agent("ari", "Ari", "assistant", "sem", "#23C6B7");
const rodi = agent("rodi", "Rodi", "automation", "sem", "#4ade80");
const brent = agent("brent", "Brent", "assistant", "sem", "#f59e0b");

// ============ TEAM SYB ============

export const sybAgents: Agent[] = [
  agent("autro", "AUTRO", "manager", "syb", "#ff6b35"),
  agent("daan", "DAAN", "assistant", "syb", "#fbbf24"),
  agent("finn", "FINN", "builder", "syb", "#38bdf8"),
  agent("wout-syb", "WOUT", "builder", "syb", "#818cf8"),
  agent("ari-syb", "ARI", "assistant", "syb", "#34d399"),
  agent("bas-syb", "BAS", "builder", "syb", "#fb923c"),
  agent("leo", "LEO", "reviewer", "syb", "#a78bfa"),
  agent("gabriel-syb", "GABRIEL", "builder", "syb", "#94a3b8"),
];

// ============ EXPORTS ============

export const semAgents: Agent[] = [
  // Management
  theo, toby, jones,
  // Builders
  wout, bas, gabriel, tijmen, pedro, vincent,
  object51,
  // Support
  ari, rodi, brent,
  // Available pool
  adam, noah, jack, nikkie, xia, thijs, leonard, rijk, coen, senna,
];

export const agents: Agent[] = [...semAgents, ...sybAgents];

// Empty — activity feed comes from live API only
export const taskLog: TaskLogEntry[] = [];
