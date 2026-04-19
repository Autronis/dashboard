import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten, klantContactmomenten, gebruikers } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

const GELDIGE_KANALEN = ["email", "telefoon", "meeting", "linkedin", "whatsapp", "anders"] as const;
type Kanaal = (typeof GELDIGE_KANALEN)[number];
const GELDIGE_RICHTINGEN = ["uitgaand", "inkomend"] as const;
type Richting = (typeof GELDIGE_RICHTINGEN)[number];

interface PostBody {
  kanaal: Kanaal;
  richting?: Richting;
  notitie?: string | null;
  contactDatum?: string | null; // ISO timestamp; default = now
}

// POST /api/klanten/[id]/contact — log a touch event (resets dagenSindsContact)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const { id } = await params;
    const klantId = Number(id);
    if (!Number.isFinite(klantId)) {
      return NextResponse.json({ fout: "Ongeldige klant id." }, { status: 400 });
    }

    const body = (await req.json()) as PostBody;
    if (!body?.kanaal || !GELDIGE_KANALEN.includes(body.kanaal)) {
      return NextResponse.json({ fout: `Kanaal vereist, één van: ${GELDIGE_KANALEN.join(", ")}.` }, { status: 400 });
    }
    const richting: Richting =
      body.richting && GELDIGE_RICHTINGEN.includes(body.richting) ? body.richting : "uitgaand";

    const [klant] = await db.select({ id: klanten.id }).from(klanten).where(eq(klanten.id, klantId));
    if (!klant) {
      return NextResponse.json({ fout: "Klant niet gevonden." }, { status: 404 });
    }

    const contactDatum = body.contactDatum || new Date().toISOString();
    const notitie = body.notitie?.trim() || null;

    const [inserted] = await db
      .insert(klantContactmomenten)
      .values({
        klantId,
        gebruikerId: gebruiker.id,
        kanaal: body.kanaal,
        richting,
        notitie,
        contactDatum,
      })
      .returning();

    return NextResponse.json({ contactmoment: inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: msg }, { status: 401 });
    }
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}

// GET /api/klanten/[id]/contact — list contactmomenten voor deze klant
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthOrApiKey(req);
    const { id } = await params;
    const klantId = Number(id);
    if (!Number.isFinite(klantId)) {
      return NextResponse.json({ fout: "Ongeldige klant id." }, { status: 400 });
    }

    const rows = await db
      .select({
        id: klantContactmomenten.id,
        kanaal: klantContactmomenten.kanaal,
        richting: klantContactmomenten.richting,
        notitie: klantContactmomenten.notitie,
        contactDatum: klantContactmomenten.contactDatum,
        aangemaaktOp: klantContactmomenten.aangemaaktOp,
        gebruikerNaam: gebruikers.naam,
      })
      .from(klantContactmomenten)
      .leftJoin(gebruikers, eq(klantContactmomenten.gebruikerId, gebruikers.id))
      .where(eq(klantContactmomenten.klantId, klantId))
      .orderBy(desc(klantContactmomenten.contactDatum));

    return NextResponse.json({ contactmomenten: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: msg }, { status: 401 });
    }
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
