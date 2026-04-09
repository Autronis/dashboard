import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wikiArtikelen, gebruikers } from "@/lib/db/schema";
import { requireAuth, requireApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";

function authCheck(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return requireApiKey(req);
  }
  return requireAuth();
}

// GET /api/wiki/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authCheck(_req);
    const { id } = await params;

    const [artikel] = await db
      .select({
        id: wikiArtikelen.id,
        titel: wikiArtikelen.titel,
        inhoud: wikiArtikelen.inhoud,
        categorie: wikiArtikelen.categorie,
        tags: wikiArtikelen.tags,
        gepubliceerd: wikiArtikelen.gepubliceerd,
        auteurId: wikiArtikelen.auteurId,
        auteurNaam: gebruikers.naam,
        aangemaaktOp: wikiArtikelen.aangemaaktOp,
        bijgewerktOp: wikiArtikelen.bijgewerktOp,
      })
      .from(wikiArtikelen)
      .leftJoin(gebruikers, eq(wikiArtikelen.auteurId, gebruikers.id))
      .where(eq(wikiArtikelen.id, Number(id)));

    if (!artikel) {
      return NextResponse.json({ fout: "Artikel niet gevonden." }, { status: 404 });
    }

    return NextResponse.json({ artikel });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/wiki/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authCheck(req);
    const { id } = await params;
    const body = await req.json();
    const { titel, inhoud, categorie, tags, gepubliceerd } = body;

    const [bestaand] = await db
      .select({ id: wikiArtikelen.id })
      .from(wikiArtikelen)
      .where(eq(wikiArtikelen.id, Number(id)));

    if (!bestaand) {
      return NextResponse.json({ fout: "Artikel niet gevonden." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      bijgewerktOp: new Date().toISOString(),
    };
    if (titel !== undefined) updateData.titel = titel.trim();
    if (inhoud !== undefined) updateData.inhoud = inhoud;
    if (categorie !== undefined) updateData.categorie = categorie;
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (gepubliceerd !== undefined) updateData.gepubliceerd = gepubliceerd;

    const [updated] = await db
      .update(wikiArtikelen)
      .set(updateData)
      .where(eq(wikiArtikelen.id, Number(id)))
      .returning();

    return NextResponse.json({ artikel: updated });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/wiki/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authCheck(_req);
    const { id } = await params;

    const [bestaand] = await db
      .select({ id: wikiArtikelen.id })
      .from(wikiArtikelen)
      .where(eq(wikiArtikelen.id, Number(id)));

    if (!bestaand) {
      return NextResponse.json({ fout: "Artikel niet gevonden." }, { status: 404 });
    }

    await db.delete(wikiArtikelen).where(eq(wikiArtikelen.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
