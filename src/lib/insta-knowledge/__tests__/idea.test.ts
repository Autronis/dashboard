// src/lib/insta-knowledge/__tests__/idea.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      const self: Record<string, unknown> = {};
      (self as { from: () => unknown }).from = () => self;
      (self as { where: () => unknown }).where = () => self;
      (self as { limit: () => unknown }).limit = () => self;
      (self as { get: () => unknown }).get = () => mockSelect();
      return self;
    },
    insert: () => ({
      values: () => ({
        returning: () => ({ get: () => mockInsert({ id: 123 }) }),
      }),
    }),
  },
}));
vi.mock("@/lib/db/schema", () => ({ ideeen: {}, gebruikers: {} }));

import { createIdeaIfRelevant } from "../idea";
import type { AnalysisResult } from "../types";

const baseAnalysis: AnalysisResult = {
  idea_title: "Test idee",
  summary: "s",
  features: [], steps: [], tips: [], links: [],
  relevance_score: 5,
  relevance_reason: "r",
};

describe("createIdeaIfRelevant", () => {
  beforeEach(() => { mockInsert.mockReset(); mockSelect.mockReset(); });

  it("skips when score < 9", async () => {
    const r = await createIdeaIfRelevant(
      { instagramId: "A", url: "u", authorHandle: "h", type: "reel" },
      baseAnalysis, "aid"
    );
    expect(r.created).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("skips when dedup hit", async () => {
    mockSelect.mockReturnValueOnce({ id: 42 });
    const r = await createIdeaIfRelevant(
      { instagramId: "A", url: "u", authorHandle: "h", type: "reel" },
      { ...baseAnalysis, relevance_score: 10 }, "aid"
    );
    expect(r.created).toBe(false);
  });
});
