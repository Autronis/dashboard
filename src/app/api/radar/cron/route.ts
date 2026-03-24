import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { radarBronnen, radarItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

type RadarCategorie =
  | "ai_tools"
  | "api_updates"
  | "automation"
  | "business"
  | "competitors"
  | "tutorials"
  | "trends"
  | "kansen"
  | "must_reads";

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
  return mapping[cat] ?? null;
}

// GET /api/radar/cron — Auto-sync vanuit Supabase
// Called by Vercel Cron elke dag om 08:00 CET
export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ fout: "Niet geautoriseerd" }, { status: 401 });
    }
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json(
      { fout: "Supabase configuratie ontbreekt" },
      { status: 500 }
    );
  }

  try {
    const supabaseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/items?score=not.is.null&select=*,sources(name,url)&order=created_at.desc&limit=200`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
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
      let bronId: number | null = null;
      if (item.sources?.name) {
        const bestaandeBron = await db
          .select({ id: radarBronnen.id })
          .from(radarBronnen)
          .where(eq(radarBronnen.naam, item.sources.name))
          .get();

        if (bestaandeBron) {
          bronId = bestaandeBron.id;
        } else {
          const result = await db
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

      const bestaand = await db
        .select({ id: radarItems.id, score: radarItems.score })
        .from(radarItems)
        .where(eq(radarItems.url, item.url))
        .get();

      if (bestaand) {
        if (!bestaand.score && item.score) {
          await db
            .update(radarItems)
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

      await db
        .insert(radarItems)
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

    return NextResponse.json({
      succes: true,
      nieuw: nieuweItems,
      bijgewerkt,
      totaal: supabaseItems.length,
      tijdstip: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
