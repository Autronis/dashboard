import type { ImageContent } from "./types";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB per image; IG CDN sizes fit
const MAX_IMAGES = 10;

function inferMediaType(contentType: string | null, url: string): ImageContent["mediaType"] {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("png")) return "image/png";
  if (ct.includes("gif")) return "image/gif";
  if (ct.includes("webp")) return "image/webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "image/jpeg";
  if (url.endsWith(".png")) return "image/png";
  if (url.endsWith(".gif")) return "image/gif";
  if (url.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/**
 * Download a list of image URLs and return them as base64-encoded data blocks
 * ready to hand to Anthropic's multimodal API. Skips images that fail to fetch
 * or exceed the size cap — never throws.
 */
export async function fetchImagesAsBase64(urls: string[]): Promise<ImageContent[]> {
  const result: ImageContent[] = [];
  for (const url of urls.slice(0, MAX_IMAGES)) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        },
      });
      if (!res.ok) continue;
      const contentLength = Number(res.headers.get("content-length") || 0);
      if (contentLength > MAX_IMAGE_BYTES) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_IMAGE_BYTES) continue;
      const mediaType = inferMediaType(res.headers.get("content-type"), url);
      result.push({ mediaType, data: buf.toString("base64") });
    } catch {
      // skip and continue
    }
  }
  return result;
}
