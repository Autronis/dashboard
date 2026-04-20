import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wikiArtikelen, secondBrainItems, ideeen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

const TOEGESTANE_CATEGORIES = [
  "processen", "klanten", "technisch", "templates", "financien",
  "strategie", "geleerde-lessen", "tools", "ideeen", "educatie",
] as const;
type Categorie = typeof TOEGESTANE_CATEGORIES[number];

type BronType = "second-brain" | "idee" | "yt-knowledge" | "insta-knowledge";

interface PromoteBody {
  bronType: BronType;
  bronId: number;
  titel?: string;
  categorie?: Categorie;
  tags?: string[];
}

// POST /api/wiki/promote — promoot een source-item naar een Wiki-artikel en
// markeert de bron met `gepromoted_naar_wiki_id` + zet `bron_type` + `bron_id`
// op het nieuwe Wiki-artikel. Een item mag maar één keer gepromoot worden —
// we returnen het bestaande artikel als er al een link is.
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();

    const body = (await req.json()) as PromoteBody;
    const { bronType, bronId } = body;

    if (!bronType || !bronId) {
      return NextResponse.json({ fout: "bronType en bronId zijn verplicht" }, { status: 400 });
    }

    const categorie: Categorie =
      body.categorie && TOEGESTANE_CATEGORIES.includes(body.categorie)
        ? body.categorie
        : "geleerde-lessen";

    let titel = body.titel?.trim() ?? "";
    let inhoud = "";

    if (bronType === "second-brain") {
      const [item] = await db
        .select()
        .from(secondBrainItems)
        .where(eq(secondBrainItems.id, bronId));
      if (!item) return NextResponse.json({ fout: "Second Brain item niet gevonden" }, { status: 404 });
      if (item.gepromotedNaarWikiId) {
        const [bestaand] = await db
          .select()
          .from(wikiArtikelen)
          .where(eq(wikiArtikelen.id, item.gepromotedNaarWikiId));
        return NextResponse.json({ artikel: bestaand, reeds: true });
      }
      if (!titel) titel = item.titel?.trim() || `SB #${item.id}`;
      const delen: string[] = [];
      if (item.inhoud) delen.push(item.inhoud);
      if (item.bronUrl) delen.push(`\n\n**Bron:** ${item.bronUrl}`);
      if (item.aiSamenvatting) delen.push(`\n\n**Samenvatting:**\n${item.aiSamenvatting}`);
      inhoud = delen.join("");
    } else if (bronType === "idee") {
      const [item] = await db.select().from(ideeen).where(eq(ideeen.id, bronId));
      if (!item) return NextResponse.json({ fout: "Idee niet gevonden" }, { status: 404 });
      if (item.gepromotedNaarWikiId) {
        const [bestaand] = await db
          .select()
          .from(wikiArtikelen)
          .where(eq(wikiArtikelen.id, item.gepromotedNaarWikiId));
        return NextResponse.json({ artikel: bestaand, reeds: true });
      }
      if (!titel) titel = item.naam;
      const delen: string[] = [];
      if (item.omschrijving) delen.push(item.omschrijving);
      if (item.uitwerking) delen.push(`\n\n---\n\n${item.uitwerking}`);
      if (item.doelgroep) delen.push(`\n\n**Doelgroep:** ${item.doelgroep}`);
      if (item.verdienmodel) delen.push(`\n\n**Verdienmodel:** ${item.verdienmodel}`);
      inhoud = delen.join("");
    } else {
      return NextResponse.json({ fout: `Promote vanaf ${bronType} nog niet ondersteund` }, { status: 400 });
    }

    if (!titel) return NextResponse.json({ fout: "Titel is verplicht" }, { status: 400 });

    const [artikel] = await db
      .insert(wikiArtikelen)
      .values({
        titel,
        inhoud,
        categorie,
        tags: JSON.stringify(body.tags ?? []),
        auteurId: gebruiker.id,
        gepubliceerd: 1,
        bronType,
        bronId,
      })
      .returning();

    if (bronType === "second-brain") {
      await db
        .update(secondBrainItems)
        .set({ gepromotedNaarWikiId: artikel.id })
        .where(eq(secondBrainItems.id, bronId));
    } else if (bronType === "idee") {
      await db
        .update(ideeen)
        .set({ gepromotedNaarWikiId: artikel.id })
        .where(eq(ideeen.id, bronId));
    }

    return NextResponse.json({ artikel }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
