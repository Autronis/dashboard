import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slimmeActiesBridge } from "@/lib/db/schema";
import { requireAuth, requireAuthOrApiKey } from "@/lib/auth";
import { and, gte, inArray } from "drizzle-orm";

const VALID_VOOR = ["sem", "syb", "team"] as const;
type Voor = (typeof VALID_VOOR)[number];

const VALID_PRIORITEIT = ["laag", "normaal", "hoog"] as const;
type Prioriteit = (typeof VALID_PRIORITEIT)[number];

interface ActieInput {
  titel: unknown;
  beschrijving?: unknown;
  cluster?: unknown;
  pijler?: unknown;
  duurMin?: unknown;
  voor?: unknown;
  prioriteit?: unknown;
  bronTaakId?: unknown;
  verlooptOp?: unknown;
}

// POST /api/slimme-acties-bridge — bridge schrijft batch.
// Body: { acties: [{ titel, beschrijving?, cluster?, pijler?, duurMin?, voor, prioriteit?, bronTaakId?, verlooptOp }] }
// Accepteert zowel session- als API-key auth (bridge belt met API-key).
export async function POST(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);
    const body = (await req.json()) as { acties?: ActieInput[] };
    const acties = Array.isArray(body.acties) ? body.acties : null;
    if (!acties || acties.length === 0) {
      return NextResponse.json({ fout: "acties[] is verplicht." }, { status: 400 });
    }

    const rijen: Array<{
      titel: string;
      beschrijving: string | null;
      cluster: string | null;
      pijler: string | null;
      duurMin: number | null;
      voor: Voor;
      prioriteit: Prioriteit;
      bronTaakId: number | null;
      verlooptOp: string;
    }> = [];

    for (const a of acties) {
      if (typeof a.titel !== "string" || !a.titel.trim()) {
        return NextResponse.json(
          { fout: "Elke actie heeft een titel nodig." },
          { status: 400 }
        );
      }
      const voor = (typeof a.voor === "string" ? a.voor : "team") as Voor;
      if (!VALID_VOOR.includes(voor)) {
        return NextResponse.json(
          { fout: `Ongeldige voor '${voor}'. Verwacht: ${VALID_VOOR.join(", ")}.` },
          { status: 400 }
        );
      }
      const prioriteit = (typeof a.prioriteit === "string" ? a.prioriteit : "normaal") as Prioriteit;
      if (!VALID_PRIORITEIT.includes(prioriteit)) {
        return NextResponse.json(
          { fout: `Ongeldige prioriteit '${prioriteit}'.` },
          { status: 400 }
        );
      }
      if (typeof a.verlooptOp !== "string" || !a.verlooptOp) {
        return NextResponse.json(
          { fout: "Elke actie heeft verlooptOp nodig (ISO timestamp)." },
          { status: 400 }
        );
      }
      rijen.push({
        titel: a.titel.trim(),
        beschrijving: typeof a.beschrijving === "string" ? a.beschrijving.trim() || null : null,
        cluster: typeof a.cluster === "string" ? a.cluster.trim() || null : null,
        pijler: typeof a.pijler === "string" ? a.pijler.trim() || null : null,
        duurMin: typeof a.duurMin === "number" ? a.duurMin : null,
        voor,
        prioriteit,
        bronTaakId: typeof a.bronTaakId === "number" ? a.bronTaakId : null,
        verlooptOp: a.verlooptOp,
      });
    }

    const inserted = await db.insert(slimmeActiesBridge).values(rijen).returning();
    return NextResponse.json({ acties: inserted, aantal: inserted.length }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// GET /api/slimme-acties-bridge?voor=sem|syb|team|alles (default=alles)
// Toont alleen niet-verlopen rijen.
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("voor") || "alles";
    const nu = new Date().toISOString();

    const voorSet: Voor[] =
      filter === "sem"
        ? ["sem", "team"]
        : filter === "syb"
        ? ["syb", "team"]
        : filter === "team"
        ? ["team"]
        : ["sem", "syb", "team"];

    const acties = await db
      .select()
      .from(slimmeActiesBridge)
      .where(
        and(
          inArray(slimmeActiesBridge.voor, voorSet),
          gte(slimmeActiesBridge.verlooptOp, nu)
        )
      )
      .orderBy(slimmeActiesBridge.prioriteit, slimmeActiesBridge.gecreeerdOp);

    return NextResponse.json(
      { acties },
      { headers: { "Cache-Control": "private, max-age=30" } }
    );
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
