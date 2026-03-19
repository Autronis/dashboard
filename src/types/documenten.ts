export type DocumentType = 'contract' | 'klantdocument' | 'intern' | 'belangrijke-info' | 'plan' | 'notitie';

// Visueel subtype — meer specifiek dan de 6 Notion database types
export type DocumentSubtype =
  | 'contract'
  | 'offerte'
  | 'factuur'
  | 'meeting-notities'
  | 'handleiding'
  | 'rapport'
  | 'klant-info'
  | 'credentials'
  | 'plan'
  | 'notitie'
  | 'belangrijk';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contract: 'Contract',
  klantdocument: 'Klantdocument',
  intern: 'Intern document',
  'belangrijke-info': 'Belangrijke info',
  plan: 'Plan / Roadmap',
  notitie: 'Notitie',
};

export const DOCUMENT_SUBTYPE_LABELS: Record<DocumentSubtype, string> = {
  contract: 'Contract',
  offerte: 'Offerte',
  factuur: 'Factuur',
  'meeting-notities': 'Meeting notities',
  handleiding: 'Handleiding',
  rapport: 'Rapport',
  'klant-info': 'Klant info',
  credentials: 'Credentials',
  plan: 'Plan / Roadmap',
  notitie: 'Notitie',
  belangrijk: 'Belangrijk',
};

// Map subtypes naar de juiste Notion database
export const SUBTYPE_TO_NOTION_TYPE: Record<DocumentSubtype, DocumentType> = {
  contract: 'contract',
  offerte: 'klantdocument',
  factuur: 'klantdocument',
  'meeting-notities': 'notitie',
  handleiding: 'intern',
  rapport: 'klantdocument',
  'klant-info': 'klantdocument',
  credentials: 'belangrijke-info',
  plan: 'plan',
  notitie: 'notitie',
  belangrijk: 'belangrijke-info',
};

export const DOCUMENT_TYPE_NOTION_DB_KEYS: Record<DocumentType, string> = {
  contract: 'NOTION_DB_CONTRACTEN',
  klantdocument: 'NOTION_DB_KLANTDOCUMENTEN',
  intern: 'NOTION_DB_INTERNE_DOCUMENTEN',
  'belangrijke-info': 'NOTION_DB_BELANGRIJKE_INFO',
  plan: 'NOTION_DB_PLANNEN',
  notitie: 'NOTION_DB_NOTITIES',
};

export interface DocumentTypeConfig {
  label: string;
  emoji: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const DOCUMENT_TYPE_CONFIG: Record<DocumentType, DocumentTypeConfig> = {
  contract: { label: "Contract", emoji: "📝", color: "#2563EB", bgClass: "bg-blue-600/10", textClass: "text-blue-400", borderClass: "border-blue-600" },
  klantdocument: { label: "Klantdocument", emoji: "📁", color: "#7C3AED", bgClass: "bg-violet-600/10", textClass: "text-violet-400", borderClass: "border-violet-600" },
  intern: { label: "Intern document", emoji: "📖", color: "#4B5563", bgClass: "bg-gray-600/10", textClass: "text-gray-400", borderClass: "border-gray-600" },
  "belangrijke-info": { label: "Belangrijke info", emoji: "⚠️", color: "#DC2626", bgClass: "bg-red-600/10", textClass: "text-red-400", borderClass: "border-red-600" },
  plan: { label: "Plan / Roadmap", emoji: "📋", color: "#16A34A", bgClass: "bg-green-600/10", textClass: "text-green-400", borderClass: "border-green-600" },
  notitie: { label: "Notitie", emoji: "💡", color: "#F59E0B", bgClass: "bg-amber-500/10", textClass: "text-amber-400", borderClass: "border-amber-500" },
};

export const DOCUMENT_SUBTYPE_CONFIG: Record<DocumentSubtype, DocumentTypeConfig> = {
  contract: { label: "Contract", emoji: "📝", color: "#2563EB", bgClass: "bg-blue-600/10", textClass: "text-blue-400", borderClass: "border-blue-600" },
  offerte: { label: "Offerte", emoji: "💰", color: "#17B8A5", bgClass: "bg-autronis-accent/10", textClass: "text-autronis-accent", borderClass: "border-autronis-accent" },
  factuur: { label: "Factuur", emoji: "🧾", color: "#059669", bgClass: "bg-emerald-600/10", textClass: "text-emerald-400", borderClass: "border-emerald-600" },
  'meeting-notities': { label: "Meeting notities", emoji: "📞", color: "#8B5CF6", bgClass: "bg-violet-500/10", textClass: "text-violet-400", borderClass: "border-violet-500" },
  handleiding: { label: "Handleiding", emoji: "📖", color: "#6366F1", bgClass: "bg-indigo-500/10", textClass: "text-indigo-400", borderClass: "border-indigo-500" },
  rapport: { label: "Rapport", emoji: "📊", color: "#0EA5E9", bgClass: "bg-sky-500/10", textClass: "text-sky-400", borderClass: "border-sky-500" },
  'klant-info': { label: "Klant info", emoji: "📁", color: "#7C3AED", bgClass: "bg-violet-600/10", textClass: "text-violet-400", borderClass: "border-violet-600" },
  credentials: { label: "Credentials", emoji: "🔑", color: "#EF4444", bgClass: "bg-red-500/10", textClass: "text-red-400", borderClass: "border-red-500" },
  plan: { label: "Plan / Roadmap", emoji: "📋", color: "#16A34A", bgClass: "bg-green-600/10", textClass: "text-green-400", borderClass: "border-green-600" },
  notitie: { label: "Notitie", emoji: "💡", color: "#F59E0B", bgClass: "bg-amber-500/10", textClass: "text-amber-400", borderClass: "border-amber-500" },
  belangrijk: { label: "Belangrijk", emoji: "⚠️", color: "#DC2626", bgClass: "bg-red-600/10", textClass: "text-red-400", borderClass: "border-red-600" },
};

// Groepeer categorieën voor mappenstructuur
export type DocumentMapCategorie = 'klant' | 'project' | 'intern' | 'templates';

export const DOCUMENT_MAP_LABELS: Record<DocumentMapCategorie, string> = {
  klant: 'Per klant',
  project: 'Per project',
  intern: 'Intern',
  templates: 'Templates',
};

export type SortOption = "datum-desc" | "datum-asc" | "titel-asc" | "titel-desc" | "klant-asc" | "klant-desc";

export const SORT_LABELS: Record<SortOption, string> = {
  "datum-desc": "Nieuwste eerst",
  "datum-asc": "Oudste eerst",
  "titel-asc": "Titel A-Z",
  "titel-desc": "Titel Z-A",
  "klant-asc": "Klant A-Z",
  "klant-desc": "Klant Z-A",
};

export interface DocumentBase {
  notionId: string;
  titel: string;
  type: DocumentType;
  samenvatting: string;
  aangemaaktDoor: string;
  aangemaaktOp: string;
  notionUrl: string;
  klantNaam?: string;
  projectNaam?: string;
  isOptimistic?: boolean;
}

export interface ContractPayload {
  type: 'contract';
  titel: string;
  klantId?: number;
  projectId?: number;
  status: 'concept' | 'actief' | 'verlopen';
  startdatum?: string;
  einddatum?: string;
  bedrag?: number;
  content: string;
}

export interface KlantdocumentPayload {
  type: 'klantdocument';
  titel: string;
  klantId?: number;
  projectId?: number;
  subtype: 'proposal' | 'oplevering' | 'overig';
  content: string;
}

export interface InternDocumentPayload {
  type: 'intern';
  titel: string;
  categorie: 'proces' | 'handleiding' | 'overig';
  eigenaar?: string;
  content: string;
}

export interface BelangrijkeInfoPayload {
  type: 'belangrijke-info';
  titel: string;
  urgentie: 'hoog' | 'normaal';
  gerelateerdAan: 'klant' | 'project' | 'intern';
  klantId?: number;
  projectId?: number;
  content: string;
}

export interface PlanPayload {
  type: 'plan';
  titel: string;
  klantId?: number;
  projectId?: number;
  status: 'concept' | 'definitief';
  content: string;
}

export interface NotitiePayload {
  type: 'notitie';
  titel: string;
  subtype: 'vergadering' | 'brainstorm' | 'overig';
  klantId?: number;
  projectId?: number;
  datum?: string;
  content: string;
}

export type DocumentPayload =
  | ContractPayload
  | KlantdocumentPayload
  | InternDocumentPayload
  | BelangrijkeInfoPayload
  | PlanPayload
  | NotitiePayload;

export interface PaginatedDocumenten {
  documenten: DocumentBase[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface AiDraftRequest {
  type: DocumentType;
  titel: string;
  klantNaam?: string;
  projectNaam?: string;
  extraContext?: string;
  velden: Record<string, string>;
}

export interface AiDraftResponse {
  content: string;
  samenvatting: string;
}

export interface AiCategorisatieResponse {
  samenvatting: string;
  extractedMetadata: {
    datums?: string[];
    bedragen?: number[];
  };
}
