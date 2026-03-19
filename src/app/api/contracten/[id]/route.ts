import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contracten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/contracten/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [contract] = db
      .select({
        id: contracten.id,
        klantId: contracten.klantId,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
        titel: contracten.titel,
        type: contracten.type,
        inhoud: contracten.inhoud,
        status: contracten.status,
        aangemaaktOp: contracten.aangemaaktOp,
        bijgewerktOp: contracten.bijgewerktOp,
      })
      .from(contracten)
      .leftJoin(klanten, eq(contracten.klantId, klanten.id))
      .where(eq(contracten.id, Number(id)))
      .all();

    if (!contract) {
      return NextResponse.json({ fout: "Contract niet gevonden." }, { status: 404 });
    }

    return NextResponse.json({ contract });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/contracten/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const { titel, inhoud, status } = body;

    const updates: Record<string, unknown> = {
      bijgewerktOp: new Date().toISOString(),
    };
    if (titel !== undefined) updates.titel = titel.trim();
    if (inhoud !== undefined) updates.inhoud = inhoud;
    if (status !== undefined) updates.status = status;

    db.update(contracten)
      .set(updates)
      .where(eq(contracten.id, Number(id)))
      .run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/contracten/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    db.delete(contracten)
      .where(eq(contracten.id, Number(id)))
      .run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
