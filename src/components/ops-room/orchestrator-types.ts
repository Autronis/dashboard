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
  projectId: number | null; // linked project for auto-sync
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

// Agent specialization mapping — één entry per unieke skill-functie.
// De -syb varianten zijn dezelfde persoon/skill op Syb's verdieping.
export const AGENT_SPECIALIZATIONS: Record<string, AgentSpecialization> = {
  // Team Sem — main + skills
  atlas:   "orchestrator",
  wout:    "automation",
  bas:     "prompts",
  coen:    "backend",
  gabriel: "documentation",
  ari:     "research",
  daan:    "interviewer",
  finn:    "frontend",
  leo:     "reviewer",

  // Team Syb — main + zelfde skills
  autro:          "orchestrator",
  "wout-syb":     "automation",
  "bas-syb":      "prompts",
  "coen-syb":     "backend",
  "gabriel-syb":  "documentation",
  "ari-syb":      "research",
  "daan-syb":     "interviewer",
  "finn-syb":     "frontend",
  "leo-syb":      "reviewer",
};

// Agent team mapping — bepaalt welke agents bij welk team horen
export const AGENT_TEAMS: Record<string, AgentTeam> = {
  // Team Sem (V1)
  atlas: "sem",
  wout: "sem", bas: "sem", coen: "sem", gabriel: "sem",
  ari: "sem", daan: "sem", finn: "sem", leo: "sem",
  // Team Syb (V2)
  autro: "syb",
  "wout-syb": "syb", "bas-syb": "syb", "coen-syb": "syb", "gabriel-syb": "syb",
  "ari-syb": "syb", "daan-syb": "syb", "finn-syb": "syb", "leo-syb": "syb",
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
