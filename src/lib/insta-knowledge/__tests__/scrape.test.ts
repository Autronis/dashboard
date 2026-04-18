// src/lib/insta-knowledge/__tests__/scrape.test.ts
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { parseInstagramUrl, parseInstagramPage } from "../scrape";

const fixturesDir = join(__dirname, "fixtures");

describe("parseInstagramUrl", () => {
  it("extracts shortcode for reel", () => {
    expect(parseInstagramUrl("https://www.instagram.com/reel/ABC123/")).toEqual({
      type: "reel",
      instagramId: "ABC123",
    });
  });
  it("extracts shortcode for post", () => {
    expect(parseInstagramUrl("https://www.instagram.com/p/XYZ789/?hl=en")).toEqual({
      type: "post",
      instagramId: "XYZ789",
    });
  });
  it("returns null for non-instagram URL", () => {
    expect(parseInstagramUrl("https://example.com/reel/ABC")).toBeNull();
  });
  it("returns null for malformed URL string", () => {
    expect(parseInstagramUrl("not a url")).toBeNull();
  });
});

describe("parseInstagramPage", () => {
  it("parses reel HTML into RawItem with caption, author, mediaUrl", () => {
    const html = readFileSync(join(fixturesDir, "reel.html"), "utf8");
    const item = parseInstagramPage(html, "https://www.instagram.com/reel/ABC/", "reel", "ABC");
    expect(item.type).toBe("reel");
    expect(item.caption.length).toBeGreaterThan(0);
    expect(item.caption).toContain("Claude Code hooks");
    expect(item.authorHandle).toBe("demo_user");
    expect(item.mediaUrl).toMatch(/^https?:\/\//);
    expect(item.mediaUrl).toContain("video.mp4");
  });
  it("parses post HTML without mediaUrl", () => {
    const html = readFileSync(join(fixturesDir, "post.html"), "utf8");
    const item = parseInstagramPage(html, "https://www.instagram.com/p/XYZ/", "post", "XYZ");
    expect(item.type).toBe("post");
    expect(item.caption).toContain("10 tips");
    expect(item.authorHandle).toBe("example_user");
    expect(item.mediaUrl).toBeUndefined();
  });
});
