import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wikiArtikelen } from "@/lib/db/schema";
import { requireAuth, requireApiKey } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

// Known docs files — add new ones here or pass via request body
// Note: autronis-skills.html is geconsolideerd in ATLAS — Hoe Werkt Alles (wiki id 29),
// bestand is verwijderd om duplicaten te voorkomen.
const KNOWN_DOCS = ["autronis-werkwijze.html"];

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("host") || "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

async function fetchDocContent(baseUrl: string, filename: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/docs/${filename}`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1] : html;
  let cleaned = content.replace(/<script[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/<div class="cover">[\s\S]*?<\/div>\s*(?=<div|<section|<h[12])/i, "");
  return cleaned.trim();
}

function inferCategorie(filename: string, title: string): string {
  const lower = (filename + " " + title).toLowerCase();
  if (lower.includes("werkwijze") || lower.includes("architectuur") || lower.includes("systeem")) return "technisch";
  if (lower.includes("skill") || lower.includes("command")) return "tools";
  if (lower.includes("proces")) return "processen";
  if (lower.includes("klant") || lower.includes("client")) return "klanten";
  if (lower.includes("financ") || lower.includes("btw")) return "financien";
  if (lower.includes("strategie")) return "strategie";
  return "processen";
}

function extractTitle(html: string, filename: string): string {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].replace(/Autronis\s*[—–-]\s*/i, "").trim();
  }
  return filename
    .replace(/\.html?$/i, "")
    .replace(/^autronis-/i, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// GET /api/wiki/import — scan known docs for import status
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      await requireApiKey(req);
    } else {
      await requireAuth();
    }

    const baseUrl = getBaseUrl(req);
    const existing = await db
      .select({ titel: wikiArtikelen.titel })
      .from(wikiArtikelen)
      .all();
    const existingTitles = new Set(existing.map((e) => e.titel.toLowerCase().trim()));

    const bestanden = [];
    for (const filename of KNOWN_DOCS) {
      const html = await fetchDocContent(baseUrl, filename);
      if (!html) continue;
      const titel = extractTitle(html, filename);
      bestanden.push({
        bestand: filename,
        titel,
        categorie: inferCategorie(filename, titel),
        alGeimporteerd: existingTitles.has(titel.toLowerCase().trim()),
      });
    }

    return NextResponse.json({ bestanden });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/wiki/import — import docs into wiki
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    let userId: number;
    if (authHeader?.startsWith("Bearer ")) {
      userId = await requireApiKey(req);
    } else {
      const gebruiker = await requireAuth();
      userId = gebruiker.id;
    }

    const body = (await req.json().catch(() => ({}))) as {
      bestanden?: string[];
      overschrijven?: boolean;
    };

    const baseUrl = getBaseUrl(req);
    const filesToImport = body.bestanden || KNOWN_DOCS;
    const results: Array<{ bestand: string; titel: string; status: string; id?: number }> = [];

    for (const filename of filesToImport) {
      const raw = await fetchDocContent(baseUrl, filename);
      if (!raw) {
        results.push({ bestand: filename, titel: "", status: "niet gevonden" });
        continue;
      }

      const titel = extractTitle(raw, filename);
      const categorie = inferCategorie(filename, titel);
      const isHtml = filename.endsWith(".html");
      const inhoud = isHtml ? extractBodyContent(raw) : raw;

      const existing = await db
        .select({ id: wikiArtikelen.id })
        .from(wikiArtikelen)
        .where(sql`LOWER(TRIM(${wikiArtikelen.titel})) = LOWER(TRIM(${titel}))`)
        .get();

      if (existing && !body.overschrijven) {
        results.push({ bestand: filename, titel, status: "bestaat al", id: existing.id });
        continue;
      }

      if (existing) {
        await db
          .update(wikiArtikelen)
          .set({
            inhoud,
            categorie: categorie as typeof wikiArtikelen.categorie.enumValues[number],
            bijgewerktOp: new Date().toISOString(),
          })
          .where(eq(wikiArtikelen.id, existing.id));
        results.push({ bestand: filename, titel, status: "bijgewerkt", id: existing.id });
      } else {
        const [artikel] = await db
          .insert(wikiArtikelen)
          .values({
            titel,
            inhoud,
            categorie: categorie as typeof wikiArtikelen.categorie.enumValues[number],
            tags: JSON.stringify([isHtml ? "html-import" : "import"]),
            auteurId: userId,
            gepubliceerd: 1,
          })
          .returning();
        results.push({ bestand: filename, titel, status: "geimporteerd", id: artikel.id });
      }
    }

    return NextResponse.json({ resultaten: results });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
