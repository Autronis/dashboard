import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wikiArtikelen } from "@/lib/db/schema";
import { requireAuth, requireApiKey } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";

const DOCS_DIR = join(process.cwd(), "public", "docs");

function extractBodyContent(html: string): string {
  // Remove everything before <body> and after </body>
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1] : html;

  // Remove <script> tags
  let cleaned = content.replace(/<script[\s\S]*?<\/script>/gi, "");
  // Remove <style> tags
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove cover page (usually the first section)
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
    return titleMatch[1]
      .replace(/Autronis\s*[—–-]\s*/i, "")
      .trim();
  }
  return basename(filename, ".html")
    .replace(/^autronis-/i, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// GET /api/wiki/import — scan docs directory for importable files
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      await requireApiKey(req);
    } else {
      await requireAuth();
    }

    if (!existsSync(DOCS_DIR)) {
      return NextResponse.json({ bestanden: [], bericht: "Geen docs directory gevonden" });
    }

    const files = readdirSync(DOCS_DIR).filter(
      (f) => f.endsWith(".html") || f.endsWith(".md") || f.endsWith(".txt")
    );

    // Check which are already imported
    const existing = await db
      .select({ titel: wikiArtikelen.titel })
      .from(wikiArtikelen)
      .all();
    const existingTitles = new Set(existing.map((e) => e.titel.toLowerCase().trim()));

    const bestanden = files.map((f) => {
      const fullPath = join(DOCS_DIR, f);
      const html = readFileSync(fullPath, "utf-8");
      const titel = extractTitle(html, f);
      const alGeimporteerd = existingTitles.has(titel.toLowerCase().trim());
      return { bestand: f, titel, categorie: inferCategorie(f, titel), alGeimporteerd };
    });

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

    const body = (await req.json()) as {
      bestanden?: string[];
      overschrijven?: boolean;
    };

    if (!existsSync(DOCS_DIR)) {
      return NextResponse.json({ fout: "Geen docs directory gevonden" }, { status: 404 });
    }

    const filesToImport = body.bestanden
      ? body.bestanden
      : readdirSync(DOCS_DIR).filter(
          (f) => f.endsWith(".html") || f.endsWith(".md") || f.endsWith(".txt")
        );

    const results: Array<{ bestand: string; titel: string; status: string; id?: number }> = [];

    for (const filename of filesToImport) {
      const fullPath = join(DOCS_DIR, filename);
      if (!existsSync(fullPath)) {
        results.push({ bestand: filename, titel: "", status: "niet gevonden" });
        continue;
      }

      const raw = readFileSync(fullPath, "utf-8");
      const titel = extractTitle(raw, filename);
      const categorie = inferCategorie(filename, titel);
      const isHtml = filename.endsWith(".html");
      const inhoud = isHtml ? extractBodyContent(raw) : raw;

      // Check if already exists
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
            tags: JSON.stringify([filename.endsWith(".html") ? "html-import" : "import"]),
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
