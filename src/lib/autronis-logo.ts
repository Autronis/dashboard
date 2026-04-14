import { readFileSync } from "fs";
import path from "path";

/**
 * Load the Autronis logo once at module boot and cache as a data URL.
 *
 * Used by server-side PDF renderers (@react-pdf/renderer, which accepts
 * base64 data URLs on its Image component) so klant-facing documents
 * embed the logo without needing an external HTTP fetch.
 *
 * The source PNG lives in public/logo.png — same file the dashboard serves
 * at /logo.png. Keeping it as a runtime-read file means we don't bundle
 * a ~20KB binary into every route that imports this module.
 */
let cachedLogo: string | null = null;

export function getLogoDataUrl(): string {
  if (cachedLogo) return cachedLogo;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const buffer = readFileSync(logoPath);
    cachedLogo = `data:image/png;base64,${buffer.toString("base64")}`;
    return cachedLogo;
  } catch (err) {
    console.error("[autronis-logo] failed to load public/logo.png:", err);
    // Return a 1x1 transparent PNG fallback so PDFs don't crash if the file
    // is missing — the logo slot will just be empty.
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";
  }
}
