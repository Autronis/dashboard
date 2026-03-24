import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentInzichten, radarItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// Mapping van radar categorie naar InzichtCategorie
function mapToInzichtCategorie(
  radarCat: string | null
): "learning" | "trend" | "tool_review" | "tip" {
  switch (radarCat) {
    case "ai_tools":
    case "api_updates":
      return "tool_review";
    case "trends":
    case "competitors":
    case "business":
      return "trend";
    case "tutorials":
      return "learning";
    case "kansen":
    case "must_reads":
    case "automation":
    default:
      return "tip";
  }
}

// POST /api/radar/deel-inzicht
// Body: { itemId: number }
// Stuurt een radar item als inzicht naar de Content Engine kennisbank
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { itemId } = (await req.json()) as { itemId: number };

    if (!itemId) {
      return NextResponse.json({ fout: "itemId is verplicht" }, { status: 400 });
    }

    const item = await db.select().from(radarItems).where(eq(radarItems.id, itemId)).get();

    if (!item) {
      return NextResponse.json({ fout: "Item niet gevonden" }, { status: 404 });
    }

    const inhoudParts = [
      item.aiSamenvatting ?? item.beschrijving ?? "",
      "",
      `Bron: ${item.url}`,
      item.score ? `Score: ${item.score}/10` : null,
      item.scoreRedenering ? `Waarom relevant: ${item.scoreRedenering}` : null,
    ].filter(Boolean);

    const [inzicht] = await db
      .insert(contentInzichten)
      .values({
        titel: item.titel,
        inhoud: inhoudParts.join("\n"),
        categorie: mapToInzichtCategorie(item.categorie),
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    return NextResponse.json({ succes: true, inzichtId: inzicht.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500,
      }
    );
  }
}
