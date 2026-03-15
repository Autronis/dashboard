export type DocumentType = 'contract' | 'klantdocument' | 'intern' | 'belangrijke-info' | 'plan' | 'notitie';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contract: 'Contract',
  klantdocument: 'Klantdocument',
  intern: 'Intern document',
  'belangrijke-info': 'Belangrijke info',
  plan: 'Plan / Roadmap',
  notitie: 'Notitie',
};

export const DOCUMENT_TYPE_NOTION_DB_KEYS: Record<DocumentType, string> = {
  contract: 'NOTION_DB_CONTRACTEN',
  klantdocument: 'NOTION_DB_KLANTDOCUMENTEN',
  intern: 'NOTION_DB_INTERNE_DOCUMENTEN',
  'belangrijke-info': 'NOTION_DB_BELANGRIJKE_INFO',
  plan: 'NOTION_DB_PLANNEN',
  notitie: 'NOTION_DB_NOTITIES',
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
