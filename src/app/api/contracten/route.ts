import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contracten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

// GET /api/contracten
export async function GET() {
  try {
    await requireAuth();

    const lijst = await db
      .select({
        id: contracten.id,
        klantId: contracten.klantId,
        klantNaam: klanten.bedrijfsnaam,
        titel: contracten.titel,
        type: contracten.type,
        status: contracten.status,
        aangemaaktOp: contracten.aangemaaktOp,
        bijgewerktOp: contracten.bijgewerktOp,
      })
      .from(contracten)
      .leftJoin(klanten, eq(contracten.klantId, klanten.id))
      .orderBy(desc(contracten.aangemaaktOp))
      .all();

    return NextResponse.json({ contracten: lijst });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/contracten
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { klantId, titel, type, inhoud } = body;

    if (!klantId || !titel || !type) {
      return NextResponse.json({ fout: "Klant, titel en type zijn verplicht." }, { status: 400 });
    }

    const validTypes = ["samenwerkingsovereenkomst", "sla", "nda"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ fout: "Ongeldig contracttype." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(contracten)
      .values({
        klantId: Number(klantId),
        titel: titel.trim(),
        type,
        inhoud: inhoud || "",
        status: "concept",
        aangemaaktDoor: gebruiker.id,
      })
      .returning()
      .all();

    return NextResponse.json({ contract: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
