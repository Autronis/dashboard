// Shared types + helpers voor de round-trip tussen /leads/rebuild-prep,
// /sales-engine/[id] en /animaties. Asset data wordt in sessionStorage
// opgeslagen onder key `rebuild-prep-assets-<leadId>`, waar leadId een
// UUID (echte lead) of `se-<scanId>` (sales engine scan) kan zijn.

export interface RebuildPrepAssets {
  leadId: string;
  productNaam: string;
  effect?: string | null;
  stijl?: string | null;
  promptA?: string | null;
  promptB?: string | null;
  promptVideo?: string | null;
  imageA?: string | null;
  imageB?: string | null;
  videoUrl?: string | null;
  savedAt: string;
}

export function loadAssetsForLead(leadId: string): RebuildPrepAssets | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`rebuild-prep-assets-${leadId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RebuildPrepAssets;
    if (!parsed || parsed.leadId !== leadId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAssetsForLead(assets: RebuildPrepAssets): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `rebuild-prep-assets-${assets.leadId}`,
      JSON.stringify(assets),
    );
  } catch {
    // quota exceeded / private mode — silent fail, de UI valt terug op
    // alleen-tekst-prompt zonder asset injection.
  }
}

export function buildAssetInjection(assets: RebuildPrepAssets): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("");
  lines.push("## Scroll-stop assets — beschikbaar");
  lines.push("");
  lines.push(
    "Deze zijn via de Asset Generator gegenereerd voor deze lead. Integreer de video als scroll-driven hero (forward/backward op scroll).",
  );
  lines.push("");
  if (assets.productNaam) lines.push(`- **Object**: ${assets.productNaam}`);
  if (assets.effect) lines.push(`- **Effect**: ${assets.effect}`);
  if (assets.stijl) lines.push(`- **Visuele stijl**: ${assets.stijl}`);
  if (assets.imageA) lines.push(`- **Thumbnail A (assembled)**: ${assets.imageA}`);
  if (assets.imageB) lines.push(`- **Thumbnail B (exploded)**: ${assets.imageB}`);
  if (assets.videoUrl) lines.push(`- **Video URL**: ${assets.videoUrl}`);
  lines.push("");
  lines.push(
    "Gebruik de video URL direct in een `<video>` tag of — voor scroll-scrubbed effect — via canvas + FFmpeg frame extraction (zie website-builder-3d patroon). Thumbnails A/B zijn start- en eindframe.",
  );
  lines.push("");
  lines.push(
    "⚠️ Kie.ai / Fal.ai URLs zijn tijdelijk (expiren na enkele uren). Download video + thumbnails naar Vercel Blob als je ze langer nodig hebt.",
  );
  return lines.join("\n");
}
