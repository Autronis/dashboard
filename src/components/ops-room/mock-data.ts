import type { Agent, TaskLogEntry } from "./types";

// ============ AGENT ROSTER ============
// Identity only — all activity data (status, tasks, costs, terminal)
// comes from the live API.
//
// Elke skill bestaat als losse agent per team (sem / syb) omdat Sem en Syb
// dezelfde skills op hun eigen machine hebben en niet per se tegelijk aan
// dezelfde taak werken. Visueel komen ze op aparte verdiepingen uit.

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

// ============ TEAM SEM (Verdieping 1) ============

export const semAgents: Agent[] = [
  // Main — Sem's Claude
  agent("atlas",   "Atlas",   "manager",    "sem", "#23C6B7"),
  // Skill-based agents
  agent("wout",    "Wout",    "automation", "sem", "#3b82f6"), // n8n
  agent("bas",     "Bas",     "assistant",  "sem", "#06b6d4"), // prompt eng
  agent("coen",    "Coen",    "builder",    "sem", "#2563eb"), // backend
  agent("gabriel", "Gabriel", "assistant",  "sem", "#94a3b8"), // docs/logger
  agent("ari",     "Ari",     "assistant",  "sem", "#23C6B7"), // research
  agent("daan",    "Daan",    "assistant",  "sem", "#fbbf24"), // interviewer
  agent("finn",    "Finn",    "builder",    "sem", "#38bdf8"), // frontend
  agent("leo",     "Leo",     "reviewer",   "sem", "#a78bfa"), // QA
];

// ============ TEAM SYB (Verdieping 2) ============

export const sybAgents: Agent[] = [
  // Main — Syb's Claude
  agent("autro",        "Autro",   "manager",    "syb", "#ff6b35"),
  // Dezelfde skills, op Syb's verdieping
  agent("wout-syb",     "Wout",    "automation", "syb", "#3b82f6"),
  agent("bas-syb",      "Bas",     "assistant",  "syb", "#06b6d4"),
  agent("coen-syb",     "Coen",    "builder",    "syb", "#2563eb"),
  agent("gabriel-syb",  "Gabriel", "assistant",  "syb", "#94a3b8"),
  agent("ari-syb",      "Ari",     "assistant",  "syb", "#23C6B7"),
  agent("daan-syb",     "Daan",    "assistant",  "syb", "#fbbf24"),
  agent("finn-syb",     "Finn",    "builder",    "syb", "#38bdf8"),
  agent("leo-syb",      "Leo",     "reviewer",   "syb", "#a78bfa"),
];

// ============ EXPORTS ============

export const agents: Agent[] = [...semAgents, ...sybAgents];

// Empty — activity feed comes from live API only
export const taskLog: TaskLogEntry[] = [];
