import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries, screenTimeRegels } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/client";

type Categorie = "development" | "communicatie" | "design" | "administratie" | "afleiding" | "overig";

export async function POST() {
  try {
    await requireAuth();

    const ongecategoriseerd = await db
      .select({
        id: screenTimeEntries.id,
        app: screenTimeEntries.app,
        vensterTitel: screenTimeEntries.vensterTitel,
        url: screenTimeEntries.url,
      })
      .from(screenTimeEntries)
      .where(eq(screenTimeEntries.categorie, "overig"))
      .limit(50)
      .all();

    if (ongecategoriseerd.length === 0) {
      return NextResponse.json({ verwerkt: 0, nieuweRegels: [] });
    }

    const uniek = new Map<string, { app: string; url: string | null; vensterTitel: string | null }>();
    for (const entry of ongecategoriseerd) {
      const key = `${entry.app}|${entry.url || ""}`;
      if (!uniek.has(key)) {
        uniek.set(key, { app: entry.app, url: entry.url, vensterTitel: entry.vensterTitel });
      }
    }

    const appsLijst = Array.from(uniek.values())
      .map((a) => `- App: "${a.app}", URL: "${a.url || "geen"}", Venster: "${a.vensterTitel || "geen"}"`)
      .join("\n");

    const { text: tekst } = await aiComplete({
      prompt: `Categoriseer deze apps/websites in een van deze categorieën: development, communicatie, design, administratie, afleiding, overig.\n\n${appsLijst}\n\nAntwoord als JSON array: [{"app": "...", "url": "...", "categorie": "..."}]\nGeen uitleg, alleen de JSON.`,
      maxTokens: 1024,
    });
    let resultaten: Array<{ app: string; url: string; categorie: string }> = [];
    try {
      const jsonMatch = tekst.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        resultaten = JSON.parse(jsonMatch[0]);
      }
    } catch {
      return NextResponse.json({ fout: "AI response kon niet geparsed worden" }, { status: 500 });
    }

    const validCategorieen: Categorie[] = ["development", "communicatie", "design", "administratie", "afleiding", "overig"];
    const nieuweRegels: Array<{ app: string; categorie: string }> = [];

    for (const res of resultaten) {
      if (!validCategorieen.includes(res.categorie as Categorie)) continue;

      const categorie = res.categorie as Categorie;

      await db.insert(screenTimeRegels).values({
        type: "app",
        patroon: `^${res.app.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        categorie,
        prioriteit: 0,
      }).run();

      nieuweRegels.push({ app: res.app, categorie });

      await db.update(screenTimeEntries)
        .set({ categorie })
        .where(
          and(
            eq(screenTimeEntries.app, res.app),
            eq(screenTimeEntries.categorie, "overig")
          )
        )
        .run();
    }

    return NextResponse.json({ verwerkt: resultaten.length, nieuweRegels });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
