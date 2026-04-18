import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseUpworkAlertEmail } from "./email-parser";
import { isParseError } from "./types";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "../../../tests/fixtures/upwork-emails", name), "utf-8");
}

describe("parseUpworkAlertEmail", () => {
  it("parses a standard fixed-price job alert", () => {
    const result = parseUpworkAlertEmail(
      "A new job matches your saved search: AI automation",
      fixture("new-job-standard.html"),
    );
    if (isParseError(result)) throw new Error(`Unexpected parse error: ${result.error}`);
    expect(result.jobId).toBe("~01a1b2c3d4e5f6789a");
    expect(result.url).toContain("upwork.com/jobs/");
    expect(result.titel.length).toBeGreaterThan(5);
    expect(result.budgetPreviewType).toBe("fixed");
    expect(result.budgetPreviewMin).toBe(3500);
  });

  it("parses an hourly job alert with rate range", () => {
    const result = parseUpworkAlertEmail(
      "A new job matches your saved search: LLM integration",
      fixture("new-job-hourly.html"),
    );
    if (isParseError(result)) throw new Error(`Unexpected parse error: ${result.error}`);
    expect(result.budgetPreviewType).toBe("hourly");
    expect(result.budgetPreviewMin).toBe(75);
    expect(result.budgetPreviewMax).toBe(120);
  });

  it("parses the first job from a digest email", () => {
    const result = parseUpworkAlertEmail("Top job matches this week", fixture("digest-multi.html"));
    if (isParseError(result)) throw new Error(`Unexpected parse error: ${result.error}`);
    expect(result.jobId).toBe("~03c3d4e5f67890abcd");
  });

  it("returns parse error on unknown email format", () => {
    const result = parseUpworkAlertEmail("Weekly Upwork Update", fixture("unknown-format.html"));
    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) expect(result.reason).toBe("unknown_format");
  });

  it("returns parse error on empty body", () => {
    const result = parseUpworkAlertEmail("New Job", "");
    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) expect(result.reason).toBe("empty_body");
  });

  it("returns parse error when job id cannot be extracted", () => {
    const result = parseUpworkAlertEmail("New job", "<html><body>Check it out</body></html>");
    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) expect(result.reason).toBe("no_job_id");
  });
});
