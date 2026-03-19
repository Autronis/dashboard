import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { radarBronnen, radarItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// ============ SUPABASE CONFIG ============

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

interface SupabaseItem {
  id: string;
  title: string;
  url: string;
  description: string | null;
  author: string | null;
  published_at: string | null;
  score: number | null;
  score_reasoning: string | null;
  ai_summary: string | null;
  category: string | null;
  source_id: string;
  sources: { name: string; url: string } | null;
}

// ============ CATEGORY MAPPING ============

// Supabase gebruikt "opportunities", dashboard gebruikt "kansen"
type RadarCategorie = "ai_tools" | "api_updates" | "automation" | "business" | "competitors" | "tutorials" | "trends" | "kansen" | "must_reads";

function mapCategory(cat: string | null): RadarCategorie | null {
  if (!cat) return null;
  const mapping: Record<string, RadarCategorie> = {
    opportunities: "kansen",
    tools: "ai_tools",
    ai_tools: "ai_tools",
    api_updates: "api_updates",
    automation: "automation",
    business: "business",
    competitors: "competitors",
    tutorials: "tutorials",
    trends: "trends",
    kansen: "kansen",
    must_reads: "must_reads",
  };
  return mapping[cat] || null;
}

// ============ MAIN SYNC ============

// POST /api/radar/fetch — Sync items vanuit Supabase (Learning Radar pipeline)
export async function POST() {
  try {
    await requireAuth();

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json(
        { fout: "Supabase configuratie ontbreekt (SUPABASE_URL / SUPABASE_ANON_KEY)" },
        { status: 500 }
      );
    }

    // Haal gescoorde items op uit Supabase (score >= 1)
    const supabaseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/items?score=not.is.null&select=*,sources(name,url)&order=created_at.desc&limit=200`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!supabaseRes.ok) {
      const err = await supabaseRes.text();
      return NextResponse.json(
        { fout: `Supabase sync mislukt: ${err}` },
        { status: 500 }
      );
    }

    const supabaseItems: SupabaseItem[] = await supabaseRes.json();

    let nieuweItems = 0;
    let bijgewerkt = 0;

    for (const item of supabaseItems) {
      // Zorg dat de bron bestaat in lokale DB
      let bronId: number | null = null;
      if (item.sources?.name) {
        const bestaandeBron = db
          .select({ id: radarBronnen.id })
          .from(radarBronnen)
          .where(eq(radarBronnen.naam, item.sources.name))
          .get();

        if (bestaandeBron) {
          bronId = bestaandeBron.id;
        } else {
          const result = db
            .insert(radarBronnen)
            .values({
              naam: item.sources.name,
              url: item.sources.url,
              type: "rss",
              actief: 1,
            })
            .run();
          bronId = Number(result.lastInsertRowid);
        }
      }

      // Check of item al bestaat (op URL)
      const bestaand = db
        .select({ id: radarItems.id, score: radarItems.score })
        .from(radarItems)
        .where(eq(radarItems.url, item.url))
        .get();

      if (bestaand) {
        // Update score/samenvatting als die er nog niet was
        if (!bestaand.score && item.score) {
          db.update(radarItems)
            .set({
              score: item.score,
              scoreRedenering: item.score_reasoning,
              aiSamenvatting: item.ai_summary,
              categorie: mapCategory(item.category),
            })
            .where(eq(radarItems.id, bestaand.id))
            .run();
          bijgewerkt++;
        }
        continue;
      }

      // Nieuw item invoegen
      db.insert(radarItems)
        .values({
          bronId,
          titel: item.title,
          url: item.url,
          beschrijving: item.description,
          auteur: item.author,
          gepubliceerdOp: item.published_at,
          score: item.score,
          scoreRedenering: item.score_reasoning,
          aiSamenvatting: item.ai_summary,
          categorie: mapCategory(item.category),
        })
        .run();

      nieuweItems++;
    }

    const totaal = db
      .select({ id: radarItems.id })
      .from(radarItems)
      .all().length;

    return NextResponse.json({
      nieuw: nieuweItems,
      totaal,
      bijgewerkt,
      bron: "supabase",
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
