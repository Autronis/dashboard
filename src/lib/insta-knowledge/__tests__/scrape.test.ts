// src/lib/insta-knowledge/__tests__/scrape.test.ts
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { parseInstagramUrl, parseInstagramPage, splitOgDescription } from "../scrape";

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

describe("splitOgDescription", () => {
  it("extracts caption + author from IG's metadata-prefixed format", () => {
    const raw = "45K likes, 1,676 comments - alex2learn on March 31, 2026: &quot;Should I drop the method #foryou&quot;";
    const r = splitOgDescription(raw);
    expect(r.author).toBe("alex2learn");
    expect(r.caption).toBe("Should I drop the method #foryou");
  });
  it("handles plain-number likes count (no K suffix)", () => {
    const raw = "123 likes, 4 comments - user.name on May 1, 2025: \"Hello world\"";
    const r = splitOgDescription(raw);
    expect(r.author).toBe("user.name");
    expect(r.caption).toBe("Hello world");
  });
  it("falls back to the full string when the pattern doesn't match", () => {
    const raw = "Some generic og description without the IG format";
    const r = splitOgDescription(raw);
    expect(r.author).toBe("");
    expect(r.caption).toBe(raw);
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
