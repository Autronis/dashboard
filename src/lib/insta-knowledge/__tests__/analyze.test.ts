// src/lib/insta-knowledge/__tests__/analyze.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("@/lib/ai/tracked-anthropic", () => ({
  TrackedAnthropic: () => ({ messages: { create: mockCreate } }),
}));

import { analyzeInstaContent } from "../analyze";

describe("analyzeInstaContent", () => {
  beforeEach(() => mockCreate.mockReset());

  it("parses valid JSON response", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          idea_title: "Claude hooks voor auto-sync",
          summary: "Korte samenvatting.",
          features: [{ name: "Hook", description: "x y z.", category: "workflow" }],
          steps: [],
          tips: [],
          links: [],
          relevance_score: 8,
          relevance_reason: "Direct toepasbaar op Claude Code setup.",
        }),
      }],
    });
    const result = await analyzeInstaContent({ caption: "Test", transcript: "T" });
    expect(result.relevance_score).toBe(8);
    expect(result.idea_title).toContain("Claude");
  });

  it("strips markdown fences", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "text",
        text: "```json\n" + JSON.stringify({
          idea_title: "Test", summary: "x", features: [], steps: [], tips: [], links: [],
          relevance_score: 5, relevance_reason: "ok",
        }) + "\n```",
      }],
    });
    const r = await analyzeInstaContent({ caption: "c" });
    expect(r.relevance_score).toBe(5);
  });

  it("throws on malformed response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ summary: "incomplete" }) }],
    });
    await expect(analyzeInstaContent({ caption: "c" })).rejects.toThrow();
  });
});
