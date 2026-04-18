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

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

/**
 * Instagram's og:description typically has the shape:
 *   "X likes, Y comments - username on Month Day, Year: \"actual caption text\""
 * Extract the actual caption + author. If the pattern doesn't match, fall back
 * to returning the whole string as caption (better than nothing).
 */
export function splitOgDescription(raw: string): { caption: string; author: string } {
  const decoded = decodeHtmlEntities(raw);
  const m = decoded.match(
    /^[\d,.]+[KM]?\s+likes?,\s+[\d,.]+[KM]?\s+comments?\s+-\s+([A-Za-z0-9._]+)\s+on\s+[A-Za-z]+\s+\d+,\s+\d+:\s*["“]([\s\S]+?)["”]\s*\.?\s*$/
  );
  if (m) return { author: m[1], caption: m[2].trim() };
  return { author: "", caption: decoded };
}

/**
 * Extract caption, author handle, and media URL from an Instagram page HTML.
 * Works on public reels/posts. Returns empty strings when a value cannot be parsed.
 */
export function parseInstagramPage(html: string, url: string, type: ItemType, instagramId: string): RawItem {
  let caption = "";
  let authorHandle = "";

  const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/);
  if (ogDesc) {
    const split = splitOgDescription(ogDesc[1]);
    caption = split.caption;
    if (split.author) authorHandle = split.author;
  }

  if (!authorHandle) {
    const titleMeta = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/);
    if (titleMeta) {
      const m = titleMeta[1].match(/@([A-Za-z0-9._]+)/) || titleMeta[1].match(/\(([A-Za-z0-9._]+)\)/);
      if (m) authorHandle = m[1];
    }
  }

  // IG sometimes serves reels as /p/ URLs, so check video_url for both types.
  let mediaUrl: string | undefined;
  const videoMatch = html.match(/"video_url":"([^"]+)"/);
  if (videoMatch) mediaUrl = decodeJsonString(videoMatch[1]);

  // Fallback to edge_media_to_caption when og:description parse yielded nothing useful
  if (!caption || caption.length < 5) {
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
