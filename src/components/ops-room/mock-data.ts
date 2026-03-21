import type { Agent, TaskLogEntry } from "./types";

// ============ TEAM ROSTER ============
// Each agent has a unique avatar color

function ago(minutes: number): string {
  return new Date(Date.now() - 1000 * 60 * minutes).toISOString();
}

const noKosten = { tokensVandaag: 0, kostenVandaag: 0, tokensHuidigeTaak: 0 };

// --- Management ---

const theo: Agent = {
  id: "theo",
  naam: "Theo",
  rol: "manager",
  status: "working",
  huidigeTaak: { id: "t-theo", beschrijving: "Team overzicht bewaken", project: "Alle projecten", startedAt: ago(120), status: "bezig" },
  voltooideVandaag: 5,
  laatsteActiviteit: ago(1),
  avatar: "#f59e0b",
  terminal: [
    { id: "th1", tekst: "Wout → Dashboard toegewezen", type: "success", tijdstip: ago(60) },
    { id: "th2", tekst: "Object 51 → koffiehoek (project af)", type: "info", tijdstip: ago(30) },
    { id: "th3", tekst: "Sprint status: 4 actief, 1 idle", type: "info", tijdstip: ago(2) },
  ],
  kosten: { tokensVandaag: 12400, kostenVandaag: 0.19, tokensHuidigeTaak: 800 },
};

const toby: Agent = {
  id: "toby",
  naam: "Toby",
  rol: "reviewer",
  status: "working",
  huidigeTaak: { id: "t-toby", beschrijving: "Code review: Ops Room components", project: "Autronis Dashboard", startedAt: ago(8), status: "bezig" },
  voltooideVandaag: 6,
  laatsteActiviteit: ago(2),
  avatar: "#a855f7",
  terminal: [
    { id: "to1", tekst: "Reviewing office-view.tsx — 450 lines", type: "command", tijdstip: ago(5) },
    { id: "to2", tekst: "Found: unused import in isometric-grid", type: "error", tijdstip: ago(3) },
    { id: "to3", tekst: "Review rapport aangemaakt", type: "success", tijdstip: ago(2) },
  ],
  kosten: { tokensVandaag: 28700, kostenVandaag: 0.43, tokensHuidigeTaak: 4200 },
};

const jones: Agent = {
  id: "jones",
  naam: "Jones",
  rol: "architect",
  status: "idle",
  huidigeTaak: null,
  voltooideVandaag: 1,
  laatsteActiviteit: ago(180),
  avatar: "#eab308",
  terminal: [
    { id: "jo1", tekst: "Schema analyse: 84 tables mapped", type: "info", tijdstip: ago(181) },
    { id: "jo2", tekst: "Migration plan v3 opgeslagen", type: "success", tijdstip: ago(180) },
  ],
  kosten: { tokensVandaag: 8300, kostenVandaag: 0.12, tokensHuidigeTaak: 0 },
};

// --- Active Builders (1 per project) ---

const wout: Agent = {
  id: "wout",
  naam: "Wout",
  rol: "builder",
  status: "working",
  huidigeTaak: { id: "t-wout", beschrijving: "Ops Room kantoor-view bouwen", project: "Autronis Dashboard", startedAt: ago(45), status: "bezig" },
  voltooideVandaag: 9,
  laatsteActiviteit: ago(1),
  avatar: "#3b82f6",
  terminal: [
    { id: "w1", tekst: "Edit office-view.tsx — desk layout", type: "command", tijdstip: ago(3) },
    { id: "w2", tekst: "SVG avatars rendering correctly", type: "success", tijdstip: ago(2) },
    { id: "w3", tekst: "TypeScript check passed", type: "success", tijdstip: ago(1) },
  ],
  kosten: { tokensVandaag: 67200, kostenVandaag: 1.01, tokensHuidigeTaak: 18400 },
};

const bas: Agent = {
  id: "bas",
  naam: "Bas",
  rol: "builder",
  status: "working",
  huidigeTaak: { id: "t-bas", beschrijving: "Lead scoring algorithm", project: "Sales Engine", startedAt: ago(32), status: "bezig" },
  voltooideVandaag: 5,
  laatsteActiviteit: ago(3),
  avatar: "#06b6d4",
  terminal: [
    { id: "b1", tekst: "Read leads/route.ts", type: "command", tijdstip: ago(5) },
    { id: "b2", tekst: "Scoring model getraind op 200 leads", type: "info", tijdstip: ago(3) },
  ],
  kosten: { tokensVandaag: 41500, kostenVandaag: 0.62, tokensHuidigeTaak: 9800 },
};

const gabriel: Agent = {
  id: "gabriel",
  naam: "Gabriel",
  rol: "builder",
  status: "working",
  huidigeTaak: { id: "t-gab", beschrijving: "Portfolio rebalancing engine", project: "Investment Engine", startedAt: ago(60), status: "bezig" },
  voltooideVandaag: 4,
  laatsteActiviteit: ago(5),
  avatar: "#10b981",
  terminal: [
    { id: "g1", tekst: "Calculating optimal DCA weights...", type: "command", tijdstip: ago(6) },
    { id: "g2", tekst: "Backtested: +12% vs benchmark", type: "success", tijdstip: ago(5) },
  ],
  kosten: { tokensVandaag: 35800, kostenVandaag: 0.54, tokensHuidigeTaak: 11200 },
};

const object51: Agent = {
  id: "object51",
  naam: "Object 51",
  rol: "builder",
  status: "idle",
  huidigeTaak: null,
  voltooideVandaag: 8,
  laatsteActiviteit: ago(45),
  avatar: "#6366f1",
  terminal: [
    { id: "o1", tekst: "Case Study Generator deployed", type: "success", tijdstip: ago(46) },
    { id: "o2", tekst: "Project 100% compleet — moving to pool", type: "info", tijdstip: ago(45) },
  ],
  kosten: { tokensVandaag: 52100, kostenVandaag: 0.78, tokensHuidigeTaak: 0 },
};

const tijmen: Agent = {
  id: "tijmen",
  naam: "Tijmen",
  rol: "builder",
  status: "working",
  huidigeTaak: { id: "t-tij", beschrijving: "RSS feed parser bouwen", project: "Learning Radar", startedAt: ago(20), status: "bezig" },
  voltooideVandaag: 3,
  laatsteActiviteit: ago(2),
  avatar: "#f97316",
  terminal: [
    { id: "ti1", tekst: "Parsing 8 RSS bronnen...", type: "command", tijdstip: ago(3) },
    { id: "ti2", tekst: "142 items gefilterd, 23 relevant", type: "info", tijdstip: ago(2) },
  ],
  kosten: { tokensVandaag: 19300, kostenVandaag: 0.29, tokensHuidigeTaak: 6100 },
};

const pedro: Agent = {
  id: "pedro",
  naam: "Pedro",
  rol: "builder",
  status: "working",
  huidigeTaak: { id: "t-ped", beschrijving: "Hero section redesign", project: "Autronis Website", startedAt: ago(15), status: "bezig" },
  voltooideVandaag: 2,
  laatsteActiviteit: ago(4),
  avatar: "#ec4899",
  terminal: [
    { id: "p1", tekst: "Generating gradient backgrounds...", type: "command", tijdstip: ago(5) },
    { id: "p2", tekst: "Responsive breakpoints checked", type: "success", tijdstip: ago(4) },
  ],
  kosten: { tokensVandaag: 15600, kostenVandaag: 0.23, tokensHuidigeTaak: 4300 },
};

const vincent: Agent = {
  id: "vincent",
  naam: "Vincent",
  rol: "builder",
  status: "working",
  huidigeTaak: { id: "t-vin", beschrijving: "Kantoor SVG avatars", project: "Agent Office / Ops Room", startedAt: ago(10), status: "bezig" },
  voltooideVandaag: 6,
  laatsteActiviteit: ago(1),
  avatar: "#8b5cf6",
  terminal: [
    { id: "v1", tekst: "Read office-view.tsx", type: "command", tijdstip: ago(3) },
    { id: "v2", tekst: "Avatar component updated", type: "info", tijdstip: ago(2) },
    { id: "v3", tekst: "Build passed, no errors", type: "success", tijdstip: ago(1) },
  ],
  kosten: { tokensVandaag: 38900, kostenVandaag: 0.58, tokensHuidigeTaak: 7600 },
};

// --- Available Builders (koffiehoek) ---

function idleBuilder(id: string, naam: string, color: string, tasksToday: number): Agent {
  return {
    id, naam, rol: "builder", status: "idle", huidigeTaak: null,
    voltooideVandaag: tasksToday,
    laatsteActiviteit: ago(60 + Math.floor(Math.random() * 120)),
    avatar: color,
    terminal: [],
    kosten: noKosten,
  };
}

const availableBuilders: Agent[] = [
  idleBuilder("adam", "Adam", "#1e3a5f", 0),
  idleBuilder("noah", "Noah", "#60a5fa", 0),
  idleBuilder("jack", "Jack", "#6b7280", 0),
  idleBuilder("nikkie", "Nikkie", "#a7f3d0", 0),
  idleBuilder("xia", "Xia", "#f87171", 0),
  idleBuilder("thijs", "Thijs", "#1e3a5f", 0),
  idleBuilder("leonard", "Leonard", "#7f1d1d", 0),
  idleBuilder("rijk", "Rijk", "#ef4444", 0),
  idleBuilder("coen", "Coen", "#3b82f6", 0),
  idleBuilder("senna", "Senna", "#4a5c2a", 0),
];

// --- Support ---

const ari: Agent = {
  id: "ari",
  naam: "Ari",
  rol: "assistant",
  status: "working",
  huidigeTaak: { id: "t-ari", beschrijving: "Klantrapport genereren", project: "Documenten", startedAt: ago(5), status: "bezig" },
  voltooideVandaag: 14,
  laatsteActiviteit: ago(1),
  avatar: "#23C6B7",
  terminal: [
    { id: "ar1", tekst: "Fetching klantdata voor rapport...", type: "command", tijdstip: ago(3) },
    { id: "ar2", tekst: "PDF template geladen — 3 secties", type: "info", tijdstip: ago(2) },
    { id: "ar3", tekst: "Rendering rapport... 67% compleet", type: "info", tijdstip: ago(1) },
  ],
  kosten: { tokensVandaag: 89400, kostenVandaag: 1.34, tokensHuidigeTaak: 5600 },
};

const rodi: Agent = {
  id: "rodi",
  naam: "Rodi",
  rol: "automation",
  status: "working",
  huidigeTaak: { id: "t-rodi", beschrijving: "Dagelijkse data sync", project: "Systeem", startedAt: ago(10), status: "bezig" },
  voltooideVandaag: 28,
  laatsteActiviteit: ago(0),
  avatar: "#4ade80",
  terminal: [
    { id: "ro1", tekst: "Syncing Notion workspace... 142 pages", type: "command", tijdstip: ago(2) },
    { id: "ro2", tekst: "Updated 8 taken, 3 nieuwe gevonden", type: "success", tijdstip: ago(1) },
    { id: "ro3", tekst: "Syncing Google Calendar events...", type: "info", tijdstip: ago(0) },
  ],
  kosten: { tokensVandaag: 4200, kostenVandaag: 0.06, tokensHuidigeTaak: 800 },
};

// ============ EXPORTS ============

export const agents: Agent[] = [
  // Management (always visible, fixed desks)
  theo, toby, jones,
  // Active builders (at their project desks)
  wout, bas, gabriel, tijmen, pedro, vincent,
  // Completed project builder (koffiehoek)
  object51,
  // Support
  ari, rodi,
  // Available pool (koffiehoek)
  ...availableBuilders,
];

export const taskLog: TaskLogEntry[] = [
  { id: "log1", agentId: "wout", agentNaam: "Wout", beschrijving: "Office-view component gebouwd", project: "Autronis Dashboard", tijdstip: ago(5), status: "afgerond" },
  { id: "log2", agentId: "toby", agentNaam: "Toby", beschrijving: "Code review: 2 issues gevonden", project: "Autronis Dashboard", tijdstip: ago(8), status: "afgerond" },
  { id: "log3", agentId: "bas", agentNaam: "Bas", beschrijving: "Lead scoring v2 gedeployed", project: "Sales Engine", tijdstip: ago(15), status: "afgerond" },
  { id: "log4", agentId: "ari", agentNaam: "Ari", beschrijving: "Offerte automatisch opgesteld", project: "Documenten", tijdstip: ago(20), status: "afgerond" },
  { id: "log5", agentId: "rodi", agentNaam: "Rodi", beschrijving: "Notion taken gesynchroniseerd", project: "Systeem", tijdstip: ago(25), status: "afgerond" },
  { id: "log6", agentId: "theo", agentNaam: "Theo", beschrijving: "Object 51 → koffiehoek verplaatst", project: "Alle projecten", tijdstip: ago(30), status: "afgerond" },
  { id: "log7", agentId: "gabriel", agentNaam: "Gabriel", beschrijving: "Backtest engine geoptimaliseerd", project: "Investment Engine", tijdstip: ago(40), status: "afgerond" },
  { id: "log8", agentId: "vincent", agentNaam: "Vincent", beschrijving: "Isometrisch grid component gebouwd", project: "Agent Office / Ops Room", tijdstip: ago(50), status: "afgerond" },
  { id: "log9", agentId: "tijmen", agentNaam: "Tijmen", beschrijving: "RSS bronnen config pagina", project: "Learning Radar", tijdstip: ago(55), status: "afgerond" },
  { id: "log10", agentId: "pedro", agentNaam: "Pedro", beschrijving: "Contact formulier gerefactord", project: "Autronis Website", tijdstip: ago(65), status: "afgerond" },
  { id: "log11", agentId: "jones", agentNaam: "Jones", beschrijving: "Database schema redesign gepland", project: "Alle projecten", tijdstip: ago(180), status: "afgerond" },
  { id: "log12", agentId: "object51", agentNaam: "Object 51", beschrijving: "Case Study Generator v1 opgeleverd", project: "Case Study Generator", tijdstip: ago(45), status: "afgerond" },
];
