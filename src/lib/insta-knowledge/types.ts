export type ItemType = "reel" | "post";
export type ItemStatus = "pending" | "processing" | "done" | "failed";

export interface RawItem {
  instagramId: string;
  type: ItemType;
  url: string;
  caption: string;
  authorHandle: string;
  mediaUrl?: string;
  imageUrls?: string[];
}

export interface ImageContent {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string; // base64-encoded
}

export interface AnalysisFeature {
  name: string;
  description: string;
  category: "core" | "workflow" | "integration" | "tips";
}

export interface AnalysisStep {
  order: number;
  title: string;
  description: string;
  code_snippet: string;
}

export interface AnalysisTip {
  tip: string;
  context: string;
}

export interface AnalysisLink {
  url: string;
  label: string;
  type: "tool" | "docs" | "community" | "github" | "course" | "other";
}

export interface AnalysisResult {
  idea_title: string;
  summary: string;
  features: AnalysisFeature[];
  steps: AnalysisStep[];
  tips: AnalysisTip[];
  links: AnalysisLink[];
  relevance_score: number;
  relevance_reason: string;
}

export interface SourceAdapter {
  readonly name: string;
  fetchItem(url: string): Promise<RawItem>;
}

export type WorkerOutcome =
  | { ok: true; analysisId: string; relevanceScore: number }
  | { ok: false; reason: string };
