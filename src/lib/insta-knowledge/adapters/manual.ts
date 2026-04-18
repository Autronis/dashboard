// src/lib/insta-knowledge/adapters/manual.ts
import type { SourceAdapter, RawItem } from "../types";
import { parseInstagramUrl, parseInstagramPage, fetchInstagramPage } from "../scrape";

export const manualAdapter: SourceAdapter = {
  name: "manual",
  async fetchItem(url: string): Promise<RawItem> {
    const parsed = parseInstagramUrl(url);
    if (!parsed) throw new Error("invalid_instagram_url");
    const html = await fetchInstagramPage(url);
    return parseInstagramPage(html, url, parsed.type, parsed.instagramId);
  },
};
