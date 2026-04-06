import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries, screenTimeRegels, projecten } from "@/lib/db/schema";
import { requireApiKey } from "@/lib/auth";
import { eq, and, desc, sql } from "drizzle-orm";

// ─── Server-side idle detection constants ───
const MAX_ENTRY_DURATION_SECONDS = 300; // 5 min cap per entry
const NACHT_START_UUR = 22; // 22:00
const NACHT_EIND_UUR = 8;  // 08:00

function isNachtUur(tijdStr: string): boolean {
  const uur = parseInt(
    new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "numeric", hour12: false }).format(new Date(tijdStr)),
    10
  );
  return uur >= NACHT_START_UUR || uur < NACHT_EIND_UUR;
}

/** Split een entry die langer is dan MAX_ENTRY_DURATION_SECONDS in chunks */
function splitEntry(entry: {
  clientId: string;
  app: string;
  venstertitel?: string;
  url?: string;
  startTijd: string;
  eindTijd: string;
  duurSeconden: number;
}): Array<{
  clientId: string;
  app: string;
  venstertitel?: string;
  url?: string;
  startTijd: string;
  eindTijd: string;
  duurSeconden: number;
}> {
  if (entry.duurSeconden <= MAX_ENTRY_DURATION_SECONDS) {
    return [entry];
  }

  const chunks: typeof entry[] = [];
  const startMs = new Date(entry.startTijd).getTime();
  let offset = 0;
  let chunkIdx = 0;

  while (offset < entry.duurSeconden) {
    const chunkDuur = Math.min(MAX_ENTRY_DURATION_SECONDS, entry.duurSeconden - offset);
    const chunkStart = new Date(startMs + offset * 1000);
    const chunkEnd = new Date(startMs + (offset + chunkDuur) * 1000);

    chunks.push({
      clientId: `${entry.clientId}_chunk${chunkIdx}`,
      app: entry.app,
      venstertitel: entry.venstertitel,
      url: entry.url,
      startTijd: chunkStart.toISOString(),
      eindTijd: chunkEnd.toISOString(),
      duurSeconden: chunkDuur,
    });

    offset += chunkDuur;
    chunkIdx++;
  }

  return chunks;
}

// ─── Smart auto-categorization based on URL + app + title patterns ───
// Rize-style: if no rule matches, use built-in heuristics before falling back to "overig"
const AUTO_CATEGORISATIE: Array<{
  test: (app: string, url: string, titel: string) => boolean;
  categorie: "development" | "communicatie" | "design" | "administratie" | "finance" | "meeting" | "afleiding" | "overig";
}> = [
  // ── FINANCE (first — title/URL matches override everything) ──
  { test: (app) => /tradingview/i.test(app), categorie: "finance" },
  { test: (_app, _url, titel) => /System Investing|Investing V\d/i.test(titel), categorie: "finance" },
  { test: (_app, url) => /tradingview\.com|binance\.com|coinbase\.com|coingecko\.com|coinank|coinglass/i.test(url), categorie: "finance" },
  { test: (_app, _url, titel) => /Google Spreadsheets.*Google Chrome/i.test(titel) && /invest/i.test(titel), categorie: "finance" },

  // ── DEVELOPMENT — code editors (app-level, always correct) ──
  { test: (app) => /code|cursor|vim|neovim|webstorm|intellij/i.test(app), categorie: "development" },
  { test: (app) => /terminal|cmd|powershell|warp|iterm|hyper|alacritty/i.test(app), categorie: "development" },
  { test: (_app, _url, titel) => /\.(tsx?|jsx?|rs|py|go|css|html|json|md)\s*[—–-]/i.test(titel), categorie: "development" },
  // Dev URLs
  { test: (_app, url) => /github\.com|gitlab\.com|bitbucket\.org|stackoverflow\.com/i.test(url), categorie: "development" },
  { test: (_app, url) => /claude\.ai|chat\.openai\.com|anthropic\.com|platform\.openai\.com/i.test(url), categorie: "development" },
  { test: (_app, url) => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url), categorie: "development" },
  { test: (_app, url) => /vercel\.com|netlify\.com|railway\.app|supabase\.com/i.test(url), categorie: "development" },
  { test: (_app, url) => /npmjs\.com|docs\.rs|crates\.io|pypi\.org/i.test(url), categorie: "development" },
  { test: (_app, url) => /notion\.so/i.test(url), categorie: "development" },
  { test: (_app, url) => /make\.com|n8n\.io|zapier\.com|autronis\.nl|autronis\.com/i.test(url), categorie: "development" },
  // Dev titles (only when NOT a background tab situation)
  { test: (_app, _url, titel) => /Lovable|Remix of Autronis/i.test(titel), categorie: "development" },
  { test: (_app, _url, titel) => /Claude.*Google Chrome|Claude - /i.test(titel), categorie: "development" },
  { test: (_app, _url, titel) => /Tailwind|React|Next\.js|MDN|W3Schools/i.test(titel), categorie: "development" },
  // NOTE: "Autronis Dashboard" Chrome title removed — too many false positives as background tab
  { test: (_app, _url, titel) => /localhost:\d+/i.test(titel), categorie: "development" },

  // ── COMMUNICATIE ──
  { test: (app) => /discord|slack|teams|zoom|telegram|whatsapp|signal/i.test(app), categorie: "communicatie" },
  { test: (_app, url) => /mail\.google\.com|outlook\.live\.com|outlook\.office/i.test(url), categorie: "communicatie" },
  { test: (_app, url) => /discord\.com|slack\.com|teams\.microsoft\.com/i.test(url), categorie: "communicatie" },
  { test: (_app, url) => /meet\.google\.com|zoom\.us/i.test(url), categorie: "communicatie" },
  { test: (_app, url) => /calendar\.google\.com/i.test(url), categorie: "communicatie" },
  { test: (_app, url) => /linkedin\.com/i.test(url), categorie: "communicatie" },

  // ── DESIGN ──
  { test: (app) => /figma|sketch|photoshop|illustrator|canva|affinity/i.test(app), categorie: "design" },
  { test: (_app, url) => /figma\.com|canva\.com|dribbble\.com|behance\.net/i.test(url), categorie: "design" },

  // ── ADMINISTRATIE ──
  { test: (_app, url) => /moneybird\.com|exactonline|twinfield|e-boekhouden/i.test(url), categorie: "administratie" },
  { test: (_app, url) => /mijnbelastingdienst|belastingdienst\.nl/i.test(url), categorie: "administratie" },
  { test: (_app, url) => /kvk\.nl|ing\.nl|rabobank\.nl|abnamro\.nl/i.test(url), categorie: "administratie" },
  { test: (_app, url) => /digid\.nl/i.test(url), categorie: "administratie" },
  { test: (_app, _url, titel) => /KVK|Kamer van Koophandel|kvk\.nl|eenmanszaak|vennootschap|VOF|DigiD/i.test(titel), categorie: "administratie" },
  { test: (_app, url) => /docs\.google\.com\/spreadsheet|sheets\.google/i.test(url), categorie: "administratie" },
  { test: (app) => /excel|numbers/i.test(app), categorie: "administratie" },

  // ── YOUTUBE educational → development (BEFORE afleiding) ──
  { test: (_app, url) => /youtube\.com.*(?:claude|code|programming|tutorial|dev|react|next|rust|agent|cursor|api|typescript|javascript|python|automation|n8n|make)/i.test(url), categorie: "development" },
  { test: (_app, _url, titel) => /YouTube.*(Claude|Code|Agent|Team|Programming|Tutorial|Developer|Coding|API|Build|Setup|Cursor|n8n)/i.test(titel), categorie: "development" },

  // ── AFLEIDING ──
  { test: (_app, url) => /youtube\.com/i.test(url), categorie: "afleiding" },
  { test: (_app, _url, titel) => /YouTube/i.test(titel), categorie: "afleiding" },
  { test: (_app, url) => /reddit\.com(?!.*(?:programming|webdev|react|rust|automation))/i.test(url), categorie: "afleiding" },
  { test: (_app, url) => /twitter\.com|x\.com|instagram\.com|facebook\.com|tiktok\.com/i.test(url), categorie: "afleiding" },
  { test: (_app, url) => /netflix\.com|disney|primevideo|twitch\.tv/i.test(url), categorie: "afleiding" },
  { test: (app) => /spotify|music/i.test(app), categorie: "afleiding" },
];

function autoCategoriseer(
  app: string,
  url: string,
  titel: string
): "development" | "communicatie" | "design" | "administratie" | "finance" | "meeting" | "afleiding" | "overig" | null {
  for (const rule of AUTO_CATEGORISATIE) {
    if (rule.test(app, url, titel)) return rule.categorie;
  }
  return null;
}

function detectProjectFromTitle(
  app: string,
  title: string,
  projects: Array<{ id: number; naam: string; klantId: number | null }>
): { projectId: number; klantId: number | null } | null {
  let extracted: string | null = null;

  // VS Code / Cursor: "file.tsx — project-name — Visual Studio Code"
  // The PROJECT NAME is the second-to-last segment (the workspace/folder name)
  if (app.toLowerCase().includes("code") || app.toLowerCase().includes("cursor")) {
    const parts = title.split(" — ");
    if (parts.length >= 2) {
      // The workspace/folder name — this is the project directory
      extracted = parts[parts.length - 2]?.trim() || null;
    }
  }
  // Terminal: extract current directory
  else if (app.toLowerCase().includes("terminal") || app.toLowerCase().includes("cmd") || app.toLowerCase().includes("powershell")) {
    const match = title.match(/[/\\]([^/\\]+)\s*$/);
    if (match) extracted = match[1];
  }

  if (!extracted) return null;

  // Clean up extracted name (remove common suffixes)
  const cleanExtracted = extracted
    .replace(/\s*\[.*?\]\s*/g, "") // remove [SSH], [WSL] etc
    .replace(/\s*-\s*$/, "")
    .trim()
    .toLowerCase();

  if (!cleanExtracted || cleanExtracted.length < 3) return null;

  // STRICT matching: the extracted workspace name must closely match a project name
  // Don't match if the extracted name is a generic word like "src", "app", "test"
  const genericNames = new Set(["src", "app", "test", "dist", "build", "node_modules", "public", "pages", "components", "lib", "data", "config", "docs"]);
  if (genericNames.has(cleanExtracted)) return null;

  // Find matching project — strict matching on directory/workspace name
  const match = projects.filter(p => {
    const projectLower = p.naam.toLowerCase().replace(/[-_\s]/g, "");
    const extractedClean = cleanExtracted.replace(/[-_\s]/g, "");

    // Exact match (normalized)
    if (projectLower === extractedClean) return true;

    // The extracted workspace dir name matches the project name closely
    // e.g. "autronis-dashboard" dir → "Autronis Dashboard" project
    // Both must be substantial and similarity > 80%
    if (extractedClean.length >= 5 && projectLower.length >= 5) {
      if (extractedClean === projectLower) return true;
      if (extractedClean.includes(projectLower) && projectLower.length / extractedClean.length > 0.5) return true;
      if (projectLower.includes(extractedClean) && extractedClean.length / projectLower.length > 0.8) return true;
    }

    return false;
  });

  if (match.length === 1) {
    return { projectId: match[0].id, klantId: match[0].klantId };
  }

  return null;
}

export async function POST(req: NextRequest) {
  let gebruikerId: number;
  try {
    gebruikerId = await requireApiKey(req);
  } catch {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { entries, locatie } = body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ fout: "Geen entries meegegeven" }, { status: 400 });
    }

    const regels = await db
      .select()
      .from(screenTimeRegels)
      .where(eq(screenTimeRegels.isActief, 1))
      .orderBy(desc(screenTimeRegels.prioriteit))
      .all();

    // Cache projects for title matching
    const projectCache = await db
      .select({ id: projecten.id, naam: projecten.naam, klantId: projecten.klantId })
      .from(projecten)
      .where(eq(projecten.isActief, 1))
      .all();

    let verwerkt = 0;
    let overgeslagen = 0;
    const categorieen: Array<{ clientId: string; categorie: string; projectId: number | null }> = [];

    for (const entry of entries) {
      if (!entry.clientId || !entry.app || !entry.startTijd || !entry.eindTijd || !entry.duurSeconden) {
        overgeslagen++;
        continue;
      }

      // Split entries > 5 min into chunks (idle detection)
      const chunks = splitEntry(entry);

      for (const chunk of chunks) {
        const bestaand = await db
          .select({ id: screenTimeEntries.id })
          .from(screenTimeEntries)
          .where(eq(screenTimeEntries.clientId, chunk.clientId))
          .get();

        if (bestaand) {
          overgeslagen++;
          continue;
        }

        let categorie: "development" | "communicatie" | "design" | "administratie" | "finance" | "meeting" | "afleiding" | "overig" | "inactief" = "overig";
        let projectId: number | null = null;
        let klantId: number | null = null;
        let matchedByRule = false;

        // Nachturen (22:00-08:00) → overig categorie
        const isNacht = isNachtUur(chunk.startTijd);

        // 1. Try user-defined rules first (highest priority)
        for (const regel of regels) {
          const matchTarget =
            regel.type === "app" ? chunk.app :
            regel.type === "url" ? (chunk.url || "") :
            (chunk.venstertitel || "");

          try {
            if (new RegExp(regel.patroon, "i").test(matchTarget)) {
              categorie = regel.categorie;
              projectId = regel.projectId;
              klantId = regel.klantId;
              matchedByRule = true;
              break;
            }
          } catch {
            // Invalid regex, skip rule
          }
        }

        // 2. If no rule matched, use smart auto-categorization (Rize-style)
        if (!matchedByRule) {
          const autoCategorie = autoCategoriseer(
            chunk.app,
            chunk.url || "",
            chunk.venstertitel || ""
          );
          if (autoCategorie) {
            categorie = autoCategorie;
          }
        }

        // Override categorie for night hours
        if (isNacht) {
          categorie = "overig";
        }

        // Project detection from window title (if no project assigned by rules)
        if (!projectId && chunk.venstertitel) {
          const detected = detectProjectFromTitle(chunk.app, chunk.venstertitel, projectCache);
          if (detected) {
            projectId = detected.projectId;
            klantId = detected.klantId;
          }
        }

        // Cap duration at MAX_ENTRY_DURATION_SECONDS
        const cappedDuur = Math.min(chunk.duurSeconden, MAX_ENTRY_DURATION_SECONDS);

        await db.insert(screenTimeEntries).values({
          clientId: chunk.clientId,
          gebruikerId,
          app: chunk.app,
          vensterTitel: chunk.venstertitel || null,
          url: chunk.url || null,
          categorie,
          projectId,
          klantId,
          startTijd: chunk.startTijd,
          eindTijd: chunk.eindTijd,
          duurSeconden: cappedDuur,
          bron: "agent",
          locatie: locatie === "kantoor" || locatie === "thuis" ? locatie : null,
        }).run();

        categorieen.push({ clientId: chunk.clientId, categorie, projectId });
        verwerkt++;
      }
    }


    return NextResponse.json({ verwerkt, overgeslagen, categorieen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
