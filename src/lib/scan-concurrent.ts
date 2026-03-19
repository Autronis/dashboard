import { createHash } from "crypto";
import { db } from "@/lib/db";
import { concurrenten, concurrentSnapshots, concurrentScans } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

// ============ TYPES ============

interface WebsiteChange {
  url: string;
  veranderd: boolean;
  samenvatting?: string;
}

interface Vacature {
  titel: string;
  url: string;
  bron: string;
  nieuw: boolean;
}

interface SocialData {
  platform: string;
  beschikbaar: boolean;
  data?: Record<string, unknown>;
  fout?: string;
}

interface ScanResult {
  websiteChanges: WebsiteChange[] | null;
  vacatures: Vacature[] | null;
  socialActivity: SocialData[] | null;
  aiSamenvatting: string | null;
  aiHighlights: string[] | null;
  trendIndicator: "groeiend" | "stabiel" | "krimpend" | null;
  kansen: string[] | null;
}

type StapCallback = (stap: string) => void;

// ============ HELPERS ============

const FETCH_TIMEOUT = 10_000;
const FETCH_DELAY = 2_000;

async function fetchWithTimeout(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ STAP 1: WEBSITE CHANGES ============

async function scanWebsite(
  concurrent: { id: number; websiteUrl: string; scanPaginas: string | null }
): Promise<WebsiteChange[]> {
  const baseUrl = concurrent.websiteUrl.replace(/\/$/, "");
  const paginas: string[] = concurrent.scanPaginas
    ? JSON.parse(concurrent.scanPaginas)
    : ["diensten", "over-ons", "pricing", "cases"];

  const urls = [baseUrl, ...paginas.map((p) => `${baseUrl}/${p.replace(/^\//, "")}`)];
  const changes: WebsiteChange[] = [];

  for (const url of urls) {
    const html = await fetchWithTimeout(url);
    if (!html) {
      changes.push({ url, veranderd: false, samenvatting: "Niet bereikbaar" });
      await sleep(FETCH_DELAY);
      continue;
    }

    const text = stripHtml(html);
    const hash = hashText(text);

    const vorige = await db
      .select()
      .from(concurrentSnapshots)
      .where(and(
        eq(concurrentSnapshots.concurrentId, concurrent.id),
        eq(concurrentSnapshots.url, url)
      ))
      .orderBy(desc(concurrentSnapshots.aangemaaktOp))
      .limit(1)
      .get();

    const veranderd = !vorige || vorige.contentHash !== hash;

    await db.insert(concurrentSnapshots).values({
      concurrentId: concurrent.id,
      url,
      contentHash: hash,
      extractedText: text.substring(0, 50_000),
    }).run();

    // Cleanup: bewaar alleen laatste 2 snapshots per URL
    const alleSnapshots = await db
      .select({ id: concurrentSnapshots.id })
      .from(concurrentSnapshots)
      .where(and(
        eq(concurrentSnapshots.concurrentId, concurrent.id),
        eq(concurrentSnapshots.url, url)
      ))
      .orderBy(desc(concurrentSnapshots.aangemaaktOp))
      .all();

    if (alleSnapshots.length > 2) {
      const teVerwijderen = alleSnapshots.slice(2).map((s) => s.id);
      for (const snapId of teVerwijderen) {
        await db.delete(concurrentSnapshots)
          .where(eq(concurrentSnapshots.id, snapId))
          .run();
      }
    }

    changes.push({
      url,
      veranderd,
      samenvatting: veranderd
        ? vorige
          ? `Inhoud gewijzigd (${text.length} tekens)`
          : "Eerste scan — baseline vastgelegd"
        : "Geen wijzigingen",
    });

    await sleep(FETCH_DELAY);
  }

  return changes;
}

// ============ STAP 2: VACATURES (BEST-EFFORT) ============

async function scanVacatures(
  concurrent: { naam: string }
): Promise<Vacature[] | null> {
  try {
    const zoekterm = encodeURIComponent(concurrent.naam);
    const indeedUrl = `https://nl.indeed.com/vacatures?q=${zoekterm}&fromage=7`;

    const html = await fetchWithTimeout(indeedUrl);
    if (!html) return null;

    const vacatures: Vacature[] = [];
    const titleRegex = /<h2[^>]*class="[^"]*jobTitle[^"]*"[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/gi;
    let match;
    while ((match = titleRegex.exec(html)) !== null) {
      vacatures.push({
        titel: match[2].trim(),
        url: match[1].startsWith("http") ? match[1] : `https://nl.indeed.com${match[1]}`,
        bron: "Indeed",
        nieuw: true,
      });
    }

    return vacatures.length > 0 ? vacatures : [];
  } catch {
    return null;
  }
}

// ============ STAP 3: SOCIAL ACTIVITY (BEST-EFFORT) ============

async function scanSocial(
  concurrent: { instagramHandle: string | null; linkedinUrl: string | null }
): Promise<SocialData[]> {
  const results: SocialData[] = [];

  if (concurrent.instagramHandle) {
    try {
      const html = await fetchWithTimeout(
        `https://www.instagram.com/${concurrent.instagramHandle}/`
      );
      if (html) {
        const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*/i);
        results.push({
          platform: "instagram",
          beschikbaar: true,
          data: { bio: descMatch?.[1] || "Geen data beschikbaar" },
        });
      } else {
        results.push({ platform: "instagram", beschikbaar: false, fout: "Niet bereikbaar" });
      }
    } catch {
      results.push({ platform: "instagram", beschikbaar: false, fout: "Scraping mislukt" });
    }
  }

  if (concurrent.linkedinUrl) {
    try {
      const html = await fetchWithTimeout(concurrent.linkedinUrl);
      if (html) {
        const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*/i);
        results.push({
          platform: "linkedin",
          beschikbaar: true,
          data: { omschrijving: descMatch?.[1] || "Geen data beschikbaar" },
        });
      } else {
        results.push({ platform: "linkedin", beschikbaar: false, fout: "Niet bereikbaar" });
      }
    } catch {
      results.push({ platform: "linkedin", beschikbaar: false, fout: "Scraping mislukt" });
    }
  }

  return results;
}

// ============ STAP 4: AI ANALYSE ============

export async function analyseMetAI(
  concurrent: { naam: string; websiteUrl: string },
  websiteChanges: WebsiteChange[] | null,
  vacatures: Vacature[] | null,
  socialActivity: SocialData[] | null,
  vorigeSamenvatting: string | null
): Promise<{
  aiSamenvatting: string;
  aiHighlights: string[];
  trendIndicator: "groeiend" | "stabiel" | "krimpend";
  kansen: string[];
}> {
  const anthropic = new Anthropic();

  const prompt = `Je bent een competitive intelligence analist voor Autronis (AI & automatiseringsbureau, 2-mans bedrijf).
Analyseer de volgende scan-data van concurrent "${concurrent.naam}" (${concurrent.websiteUrl}).

## Website changes
${websiteChanges ? JSON.stringify(websiteChanges, null, 2) : "Geen data (scan mislukt)"}

## Vacatures
${vacatures ? JSON.stringify(vacatures, null, 2) : "Geen data (scan mislukt)"}

## Social activity
${socialActivity ? JSON.stringify(socialActivity, null, 2) : "Geen data (scan mislukt)"}

## Vorige scan samenvatting
${vorigeSamenvatting || "Eerste scan — geen historie"}

Genereer een JSON response (ALLEEN valid JSON, geen markdown):
{
  "aiSamenvatting": "2-3 zinnen samenvatting in het Nederlands",
  "aiHighlights": ["opvallend punt 1", "opvallend punt 2"],
  "trendIndicator": "groeiend" | "stabiel" | "krimpend",
  "kansen": ["kans voor Autronis 1", "kans 2"]
}

Regels:
- Schrijf in het Nederlands
- Focus op wat relevant is voor een AI/automatiseringsbureau
- Als er weinig data is, geef een korte baseline samenvatting
- Highlights moeten actionable zijn
- Kansen moeten specifiek zijn voor Autronis`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const jsonStr = responseText.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch {
    return {
      aiSamenvatting: "Analyse kon niet worden gegenereerd.",
      aiHighlights: [],
      trendIndicator: "stabiel",
      kansen: [],
    };
  }
}

// ============ MAIN SCAN FUNCTION ============

export async function scanConcurrent(
  concurrentId: number,
  onStap?: StapCallback
): Promise<ScanResult> {
  const concurrent = await db
    .select()
    .from(concurrenten)
    .where(eq(concurrenten.id, concurrentId))
    .get();

  if (!concurrent) throw new Error("Concurrent niet gevonden");

  const vorigeScan = await db
    .select()
    .from(concurrentScans)
    .where(and(
      eq(concurrentScans.concurrentId, concurrentId),
      eq(concurrentScans.status, "voltooid")
    ))
    .orderBy(desc(concurrentScans.aangemaaktOp))
    .limit(1)
    .get();

  onStap?.("website");
  let websiteChanges: WebsiteChange[] | null = null;
  try { websiteChanges = await scanWebsite(concurrent); } catch { websiteChanges = null; }

  onStap?.("vacatures");
  let vacatures: Vacature[] | null = null;
  try { vacatures = await scanVacatures(concurrent); } catch { vacatures = null; }

  onStap?.("social");
  let socialActivity: SocialData[] | null = null;
  try { socialActivity = await scanSocial(concurrent); } catch { socialActivity = null; }

  onStap?.("ai");
  let aiResult = {
    aiSamenvatting: null as string | null,
    aiHighlights: null as string[] | null,
    trendIndicator: null as "groeiend" | "stabiel" | "krimpend" | null,
    kansen: null as string[] | null,
  };

  try {
    const result = await analyseMetAI(
      concurrent,
      websiteChanges,
      vacatures,
      socialActivity,
      vorigeScan?.aiSamenvatting ?? null
    );
    aiResult = result;
  } catch {
    // AI analyse mislukt — ga door zonder
  }

  return {
    websiteChanges,
    vacatures,
    socialActivity,
    ...aiResult,
  };
}
