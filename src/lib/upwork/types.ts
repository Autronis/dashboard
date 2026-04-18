export type UpworkAccount = "sem" | "syb";

export type BudgetType = "fixed" | "hourly";
export type BudgetTier = "low" | "mid" | "premium";
export type ExperienceLevel = "entry" | "intermediate" | "expert";

export type JobStatus =
  | "new"
  | "viewed"
  | "claimed"
  | "dismissed"
  | "submitted"
  | "ingest_partial"
  | "session_expired"
  | "deleted";

export type ParsedEmail = {
  ok: true;
  jobId: string;
  url: string;
  titel: string;
  budgetPreviewType?: BudgetType;
  budgetPreviewMin?: number;
  budgetPreviewMax?: number;
  country?: string;
};

export type EmailParseError = {
  ok: false;
  error: string;
  reason: "unknown_format" | "no_job_id" | "empty_body";
};

export type EmailParseResult = ParsedEmail | EmailParseError;

export function isParseError(r: EmailParseResult): r is EmailParseError {
  return !r.ok;
}

export type IngestPayload = {
  account: UpworkAccount;
  gmailMessageId: string;
  receivedAt: string;
  subject: string;
  bodyHtml: string;
};

export type DeepFetchResult =
  | { ok: true; data: DeepFetchData }
  | { ok: false; reason: "session_expired" | "not_found" | "rate_limited" | "parse_error"; message: string };

export type DeepFetchData = {
  beschrijving: string;
  budgetType?: BudgetType;
  budgetMin?: number;
  budgetMax?: number;
  country?: string;
  postedAt?: string;
  durationEstimate?: string;
  experienceLevel?: ExperienceLevel;
  categoryLabels?: string[];
  clientNaam?: string;
  clientVerified?: boolean;
  clientSpent?: number;
  clientHireRate?: number;
  clientReviews?: number;
  clientRating?: number;
  screeningQs?: string[];
  proposalsRangeMin?: number;
  proposalsRangeMax?: number;
};
