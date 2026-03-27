// Orchestrator engine types — manages agent workflow

export type CommandStatus = "pending" | "intake" | "intake_idee" | "planning" | "awaiting_approval" | "approved" | "in_progress" | "review" | "completed" | "rejected";

export type DaanMode = "taak" | "idee";

export type TaskStatus = "queued" | "assigned" | "in_progress" | "review" | "completed" | "blocked";

export type AgentSpecialization = "frontend" | "backend" | "database" | "automation" | "styling" | "architect" | "reviewer" | "documentation" | "ops" | "research" | "experimental" | "interviewer" | "orchestrator" | "prompts";

export type AgentTeam = "sem" | "syb";

// Permission levels for approval flow
// green: Theo decides autonomously (task distribution, code patterns)
// yellow: Theo notifies Sem, proceeds unless objection (new files, env vars)
// red: Must wait for Sem's approval (git push, deploy, DB changes, credentials)
export type PermissionLevel = "green" | "yellow" | "red";

export interface TheoQueueItem {
  id: string;
  agentId: string;
  bericht: string;
  tijdstip: string;
  afgehandeld: boolean;
}

export interface Command {
  id: string;
  dbId: number | null;         // database ID for persistent sync
  opdracht: string;           // what Sem typed
  status: CommandStatus;
  plan: Plan | null;           // Jones' plan (after architecture phase)
  aangemaakt: string;          // ISO timestamp
  feedback: string | null;     // Sem's feedback on rejection
  intakeVragen: string[] | null; // DAAN's follow-up questions if opdracht is vague
  intakeAntwoorden: string[] | null; // User's answers to intake questions
  daanMode: DaanMode | null; // null = not yet determined, "taak" = task intake, "idee" = idea sparring
  branch: string | null; // git branch for this command's changes
}

export interface Plan {
  id: string;
  commandId: string;
  beschrijving: string;        // high-level description by Jones
  taken: PlanTask[];
  goedgekeurd: boolean | null; // null = awaiting, true = approved, false = rejected
  goedgekeurdOp: string | null;
}

export interface PlanTask {
  id: string;
  titel: string;
  beschrijving: string;
  bestanden: string[];         // files this task will touch
  agentId: string | null;      // assigned agent (null = unassigned)
  specialisatie: AgentSpecialization;
  status: TaskStatus;
  afhankelijkVan: string[];    // task IDs this depends on
  resultaat: string | null;    // output when completed
  reviewStatus: "pending" | "approved" | "changes_requested" | null;
}

export interface ApprovalRequest {
  id: string;
  type: "plan" | "task_result" | "agent_request";
  permissie: PermissionLevel;
  titel: string;
  beschrijving: string;
  commandId: string;
  taskId: string | null;
  agentId: string | null;
  status: "pending" | "approved" | "rejected";
  feedback: string | null;
  aangemaakt: string;
}

// Agent specialization mapping
export const AGENT_SPECIALIZATIONS: Record<string, AgentSpecialization> = {
  // Builders
  wout: "frontend",
  bas: "backend",
  gabriel: "backend",
  tijmen: "frontend",
  pedro: "styling",
  vincent: "frontend",
  // Pool builders (assigned dynamically)
  adam: "frontend",
  noah: "frontend",
  jack: "backend",
  nikkie: "styling",
  xia: "frontend",
  thijs: "backend",
  leonard: "backend",
  rijk: "styling",
  coen: "automation",
  senna: "ops",
  // Management
  jones: "architect",
  toby: "reviewer",
  // Special
  object51: "experimental",
  // Support (Team Sem)
  ari: "research",
  rodi: "automation",
  brent: "interviewer",
  // Team Syb
  autro: "orchestrator",
  daan: "interviewer",
  finn: "frontend",
  "wout-syb": "automation",
  "ari-syb": "research",
  "bas-syb": "prompts",
  leo: "reviewer",
  "gabriel-syb": "documentation",
};

// Agent team mapping — bepaalt welke agents bij welk team horen
export const AGENT_TEAMS: Record<string, AgentTeam> = {
  // Team Sem (V1)
  wout: "sem", bas: "sem", gabriel: "sem", tijmen: "sem", pedro: "sem", vincent: "sem",
  adam: "sem", noah: "sem", jack: "sem", nikkie: "sem", xia: "sem", thijs: "sem",
  leonard: "sem", rijk: "sem", coen: "sem", senna: "sem",
  jones: "sem", toby: "sem", object51: "sem",
  ari: "sem", rodi: "sem", brent: "sem",
  // Team Syb (V2)
  autro: "syb", daan: "syb", finn: "syb",
  "wout-syb": "syb", "ari-syb": "syb", "bas-syb": "syb",
  leo: "syb", "gabriel-syb": "syb",
};

export const SPECIALIZATION_LABELS: Record<AgentSpecialization, string> = {
  frontend: "Frontend (Next.js/React)",
  backend: "Backend (API/Supabase)",
  database: "Database",
  automation: "n8n/Automatisering",
  styling: "Styling (CSS/UI)",
  experimental: "Experimenteel/AI",
  research: "Research & Docs",
  architect: "Architect",
  reviewer: "Reviewer",
  documentation: "Documentatie",
  ops: "DevOps",
  interviewer: "Intake & Interviews",
  orchestrator: "Orchestrator",
  prompts: "Prompt Engineering",
};
