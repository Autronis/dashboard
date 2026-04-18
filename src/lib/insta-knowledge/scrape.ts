// src/lib/insta-knowledge/scrape.ts
import type { ItemType, RawItem } from "./types";

const SHORTCODE_RE = /instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/;

export function parseInstagramUrl(url: string): { instagramId: string; type: ItemType } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("instagram.com")) return null;
    const match = parsed.pathname.match(/^\/(p|reel)\/([A-Za-z0-9_-]+)/);
    if (!match) return null;
    return { type: match[1] === "reel" ? "reel" : "post", instagramId: match[2] };
  } catch {
    return null;
  }
}

function decodeJsonString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

/**
 * Extract caption, author handle, and media URL from an Instagram page HTML.
 * Works on public reels/posts. Returns empty strings when a value cannot be parsed.
 */
export function parseInstagramPage(html: string, url: string, type: ItemType, instagramId: string): RawItem {
  let caption = "";
  const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/);
  if (ogDesc) caption = ogDesc[1];

  let authorHandle = "";
  const titleMeta = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/);
  if (titleMeta) {
    const m = titleMeta[1].match(/@([A-Za-z0-9._]+)/);
    if (m) authorHandle = m[1];
  }

  let mediaUrl: string | undefined;
  if (type === "reel") {
    const videoMatch = html.match(/"video_url":"([^"]+)"/);
    if (videoMatch) mediaUrl = decodeJsonString(videoMatch[1]);
  }

  if (!caption) {
    const edgeMatch = html.match(/"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/);
    if (edgeMatch) caption = decodeJsonString(edgeMatch[1]);
  }

  return { instagramId, type, url, caption, authorHandle, mediaUrl };
}

export async function fetchInstagramPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`instagram_fetch_${res.status}`);
  return await res.text();
}
