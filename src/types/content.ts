export type InzichtCategorie = "projectervaring" | "learning" | "tool_review" | "trend" | "tip";

export const INZICHT_CATEGORIE_LABELS: Record<InzichtCategorie, string> = {
  projectervaring: "Projectervaring",
  learning: "Technische learning",
  tool_review: "Tool review",
  trend: "Trend",
  tip: "Tip",
};

export const INZICHT_CATEGORIE_COLORS: Record<InzichtCategorie, { bg: string; text: string }> = {
  projectervaring: { bg: "bg-blue-500/10", text: "text-blue-400" },
  learning: { bg: "bg-purple-500/10", text: "text-purple-400" },
  tool_review: { bg: "bg-green-500/10", text: "text-green-400" },
  trend: { bg: "bg-orange-500/10", text: "text-orange-400" },
  tip: { bg: "bg-autronis-accent/10", text: "text-autronis-accent" },
};

export interface ProfielEntry {
  id: number;
  onderwerp: string;
  inhoud: string;
  bijgewerktOp: string;
}

export interface Inzicht {
  id: number;
  titel: string;
  inhoud: string;
  categorie: InzichtCategorie;
  klantId?: number;
  projectId?: number;
  klantNaam?: string;
  projectNaam?: string;
  isGebruikt: boolean;
  aangemaaktDoor: number;
  aangemaaktOp: string;
}

// ============ VIDEO TYPES ============

// Duplicated from @/remotion/types to avoid importing remotion in server/type context
export interface Scene {
  tekst: string[];
  accentRegel?: number;
  accentKleur?: "turquoise" | "geel";
  icon?: string;
  duur?: number;
  isCta?: boolean;
}

export type VideoStatus = "script" | "rendering" | "klaar" | "fout";

export interface ContentVideo {
  id: number;
  postId: number | null;
  script: Scene[];
  status: VideoStatus;
  videoPath?: string | null;
  duurSeconden?: number | null;
  aangemaaktOp: string | null;
  // Joined from post
  postTitel?: string;
  postPlatform?: string;
}

// ============ CONTENT TYPES ============

export type ContentPlatform = "linkedin" | "instagram";
export type ContentFormat = "post" | "caption" | "thought_leadership" | "tip" | "storytelling" | "how_to" | "vraag";
export type ContentStatus = "concept" | "goedgekeurd" | "bewerkt" | "afgewezen" | "gepubliceerd";

export interface ContentPost {
  id: number;
  titel: string;
  inhoud: string;
  platform: ContentPlatform;
  format: ContentFormat;
  status: ContentStatus;
  batchId?: string;
  batchWeek?: string;
  inzichtId?: number;
  bewerkteInhoud?: string;
  afwijsReden?: string;
  hashtags: string[];
  geplandOp?: string;
  gepubliceerdOp?: string;
  aangemaaktOp: string;
}

// ============ BANNER TYPES ============

export type BannerTemplateType = "quote" | "stat" | "tip" | "case_study";
export type BannerFormaat = "instagram" | "linkedin";
export type BannerStatus = "concept" | "klaar" | "fout";

export const BANNER_TEMPLATE_LABELS: Record<BannerTemplateType, string> = {
  quote: "Quote card",
  stat: "Stat card",
  tip: "Tip card",
  case_study: "Case study card",
};

export const BANNER_FORMAAT_SIZES: Record<BannerFormaat, { width: number; height: number; label: string }> = {
  instagram: { width: 1080, height: 1350, label: "Instagram (4:5)" },
  linkedin: { width: 1200, height: 627, label: "LinkedIn (1200x627)" },
};

export interface QuoteData {
  tekst: string;
  auteur?: string;
}

export interface StatData {
  label: string;
  van: string;
  naar: string;
  eenheid?: string;
}

export interface TipData {
  titel: string;
  punten: [string, string, string];
}

export interface CaseStudyData {
  klantNaam: string;
  resultaat: string;
  beschrijving?: string;
}

export type BannerData = QuoteData | StatData | TipData | CaseStudyData;

export interface ContentBanner {
  id: number;
  postId?: number;
  templateType: BannerTemplateType;
  templateVariant: number;
  formaat: BannerFormaat;
  data: BannerData;
  imagePath?: string;
  status: BannerStatus;
  gridPositie?: number;
  aangemaaktOp: string;
  // Joined
  postTitel?: string;
}
