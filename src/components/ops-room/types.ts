export type AgentStatus = "idle" | "working" | "reviewing" | "error" | "offline";

export type AgentRole = "manager" | "builder" | "reviewer" | "architect" | "assistant" | "automation";

export interface TerminalLine {
  id: string;
  tekst: string;
  type: "info" | "success" | "error" | "command";
  tijdstip: string;
}

export interface AgentKosten {
  tokensVandaag: number;
  kostenVandaag: number; // in EUR
  tokensHuidigeTaak: number;
}

export interface AgentTask {
  id: string;
  beschrijving: string;
  project: string;
  startedAt: string;
  status: "bezig" | "afgerond" | "fout";
}

export type AgentTeam = "sem" | "syb";

export interface Agent {
  id: string;
  naam: string;
  rol: AgentRole;
  status: AgentStatus;
  team: AgentTeam;
  huidigeTaak: AgentTask | null;
  voltooideVandaag: number;
  laatsteActiviteit: string;
  avatar: string; // hex color for this agent's avatar
  terminal: TerminalLine[];
  kosten: AgentKosten;
}

export type ToolType = "edit" | "read" | "bash" | "write" | "grep" | "error" | "other";

export interface TaskLogEntry {
  id: string;
  agentId: string;
  agentNaam: string;
  beschrijving: string;
  project: string;
  tijdstip: string;
  status: "afgerond" | "bezig" | "fout";
  toolType?: ToolType;
}
