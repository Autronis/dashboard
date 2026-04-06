// ============ ENUM TYPES ============

export type ThemaVoorkeur = "donker" | "licht";

export type GebruikerRol = "admin" | "gebruiker";

export type ProjectStatus = "actief" | "afgerond" | "on-hold";

export type FactuurStatus = "concept" | "verzonden" | "betaald" | "te_laat";

export type LeadStatus = "nieuw" | "contact" | "offerte" | "gewonnen" | "verloren";

export type TaakStatus = "open" | "bezig" | "afgerond";

export type Prioriteit = "laag" | "normaal" | "hoog";

export type TijdCategorie = "development" | "meeting" | "administratie" | "overig" | "focus";

// ============ INTERFACES ============

export interface SessionGebruiker {
  id: number;
  naam: string;
  email: string;
  rol: GebruikerRol;
  themaVoorkeur: ThemaVoorkeur;
  uurtariefStandaard?: number | null;
}

// ============ SCREEN TIME TYPES ============

export type ScreenTimeCategorie = "development" | "communicatie" | "meeting" | "design" | "administratie" | "finance" | "afleiding" | "overig" | "inactief";

export interface ScreenTimeEntry {
  id: number;
  clientId: string | null;
  gebruikerId: number;
  app: string;
  vensterTitel: string | null;
  url: string | null;
  categorie: ScreenTimeCategorie;
  projectId: number | null;
  klantId: number | null;
  startTijd: string;
  eindTijd: string;
  duurSeconden: number;
  bron: "agent" | "handmatig";
  aangemaaktOp: string;
  projectNaam?: string;
  klantNaam?: string;
}

export interface ScreenTimeRegel {
  id: number;
  type: "app" | "url" | "venstertitel";
  patroon: string;
  categorie: ScreenTimeCategorie;
  projectId: number | null;
  klantId: number | null;
  prioriteit: number;
  isActief: number;
  aangemaaktOp: string;
  projectNaam?: string;
  klantNaam?: string;
}

export interface ScreenTimeSuggestie {
  id: number;
  gebruikerId: number;
  type: "categorie" | "tijdregistratie" | "project_koppeling";
  startTijd: string;
  eindTijd: string;
  voorstel: string;
  status: "openstaand" | "goedgekeurd" | "afgewezen";
  aangemaaktOp: string;
  verwerktOp: string | null;
}

export interface ScreenTimeSessie {
  app: string;
  categorie: ScreenTimeCategorie;
  projectId: number | null;
  projectNaam: string | null;
  klantNaam: string | null;
  startTijd: string;
  eindTijd: string;
  duurSeconden: number;
  venstertitels: string[];
  isIdle: boolean;
  beschrijving: string;
  locatie: "kantoor" | "thuis" | null;
}

export interface ScreenTimeSamenvatting {
  id: number;
  gebruikerId: number;
  datum: string;
  samenvattingKort: string | null;
  samenvattingDetail: string | null;
  totaalSeconden: number | null;
  productiefPercentage: number | null;
  topProject: string | null;
  aangemaaktOp: string;
}

// ============ FOCUS MODE ============

export type FocusSessieStatus = "actief" | "voltooid" | "afgebroken";

export interface FocusSessie {
  id: number;
  gebruikerId: number;
  projectId: number;
  taakId: number | null;
  geplandeDuurMinuten: number;
  werkelijkeDuurMinuten: number | null;
  reflectie: string | null;
  tijdregistratieId: number;
  status: FocusSessieStatus;
  aangemaaktOp: string;
  projectNaam?: string;
  taakTitel?: string;
}

export interface FocusStatistieken {
  vandaag: { sessies: number; totaleDuurMinuten: number };
  week: Array<{ dag: string; duurMinuten: number }>;
  vorigeWeek: { totaleDuurMinuten: number };
  streak: number;
  perProject: Array<{ projectId: number; projectNaam: string; duurMinuten: number; sessies: number }>;
}
