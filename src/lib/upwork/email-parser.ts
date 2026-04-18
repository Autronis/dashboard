import type { EmailParseResult, ParsedEmail, BudgetType } from "./types";

const JOB_ID_RE = /upwork\.com\/jobs\/[^"'\s>]+?(~0[0-9a-f]{16,})/i;
const URL_RE = /https:\/\/www\.upwork\.com\/jobs\/[^"'\s>?]+/i;
const HOURLY_RE = /\$(\d+(?:\.\d+)?)(?:\s*[-–—]\s*\$(\d+(?:\.\d+)?))?\s*\/\s*hr/i;
const FIXED_RE = /(?:Fixed[\s-]price|Budget)[^$]*\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i;
const COUNTRY_RE = /Country[:\s]+([A-Z][A-Za-z ]{1,40}?)(?:\s*[<.&]|$|\s{2,})/;

export function parseUpworkAlertEmail(subject: string, bodyHtml: string): EmailParseResult {
  if (!bodyHtml || bodyHtml.trim().length === 0) {
    return { ok: false, error: "Empty email body", reason: "empty_body" };
  }

  const looksLikeAlert =
    /new\s+job|matches\s+your|job\s+alert|top\s+job/i.test(subject) ||
    /upwork\.com\/jobs\//i.test(bodyHtml);

  if (!looksLikeAlert) {
    return { ok: false, error: "Does not look like a job alert email", reason: "unknown_format" };
  }

  const jobIdMatch = bodyHtml.match(JOB_ID_RE);
  if (!jobIdMatch) {
    return { ok: false, error: "Could not extract Upwork job id from email", reason: "no_job_id" };
  }
  const jobId = jobIdMatch[1];

  const urlMatch = bodyHtml.match(URL_RE);
  const url = urlMatch ? urlMatch[0] : `https://www.upwork.com/jobs/${jobId}`;

  const titel = extractTitle(bodyHtml, subject);
  const budget = extractBudget(bodyHtml);
  const country = extractCountry(bodyHtml);

  const parsed: ParsedEmail = {
    ok: true,
    jobId,
    url,
    titel,
    ...(budget ?? {}),
    ...(country ? { country } : {}),
  };
  return parsed;
}

function extractTitle(bodyHtml: string, subject: string): string {
  const cleaned = subject.replace(/^(New job[:]|New[:]|A new job matches.*?:|Top job matches.*?)\s*/i, "").trim();
  if (cleaned.length > 3 && !/^upwork/i.test(cleaned)) {
    return cleaned;
  }
  const linkMatch = bodyHtml.match(/<a[^>]+href="[^"]*upwork\.com\/jobs\/[^"]+"[^>]*>([^<]{5,200})<\/a>/i);
  if (linkMatch) return decodeHtmlEntities(linkMatch[1].trim());
  return "(titel onbekend)";
}

function extractBudget(bodyHtml: string): Pick<ParsedEmail, "budgetPreviewType" | "budgetPreviewMin" | "budgetPreviewMax"> | null {
  const hourly = bodyHtml.match(HOURLY_RE);
  if (hourly) {
    return {
      budgetPreviewType: "hourly" as BudgetType,
      budgetPreviewMin: parseFloat(hourly[1]),
      budgetPreviewMax: hourly[2] ? parseFloat(hourly[2]) : undefined,
    };
  }
  const fixed = bodyHtml.match(FIXED_RE);
  if (fixed) {
    return {
      budgetPreviewType: "fixed" as BudgetType,
      budgetPreviewMin: parseFloat(fixed[1].replace(/,/g, "")),
    };
  }
  return null;
}

function extractCountry(bodyHtml: string): string | undefined {
  const match = bodyHtml.match(COUNTRY_RE);
  return match ? match[1].trim() : undefined;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&middot;/g, "·");
}
