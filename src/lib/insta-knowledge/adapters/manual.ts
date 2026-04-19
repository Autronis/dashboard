// src/lib/insta-knowledge/adapters/manual.ts
import type { SourceAdapter, RawItem } from "../types";
import { parseInstagramUrl, parseInstagramPage, fetchInstagramPage } from "../scrape";

export const manualAdapter: SourceAdapter = {
  name: "manual",
  async fetchItem(url: string): Promise<RawItem> {
    const parsed = parseInstagramUrl(url);
    if (!parsed) throw new Error("invalid_instagram_url");
    const html = await fetchInstagramPage(url);
    const primary = parseInstagramPage(html, url, parsed.type, parsed.instagramId);

    // IG sometimes serves video-posts without video_url on the /p/ HTML
    // but includes it on the /reel/ variant — try the alternate path when
    // we got a caption but no mediaUrl.
    if (!primary.mediaUrl && primary.caption) {
      const alt = url.includes("/p/")
        ? url.replace("/p/", "/reel/")
        : url.includes("/reel/")
        ? url.replace("/reel/", "/p/")
        : null;
      if (alt) {
        try {
          const altHtml = await fetchInstagramPage(alt);
          const altParsed = parseInstagramPage(altHtml, url, parsed.type, parsed.instagramId);
          if (altParsed.mediaUrl) return { ...primary, mediaUrl: altParsed.mediaUrl };
        } catch { /* fallback silently */ }
      }
    }
    return primary;
  },
};
