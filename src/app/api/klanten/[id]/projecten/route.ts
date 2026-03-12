import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";

// POST /api/klanten/[id]/projecten — Create project for client
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const { naam, omschrijving, status, geschatteUren, deadline, voortgangPercentage } = body;

    if (!naam?.trim()) {
      return NextResponse.json({ fout: "Projectnaam is verplicht." }, { status: 400 });
    }

    if (geschatteUren !== undefined && geschatteUren !== null && geschatteUren <= 0) {
      return NextResponse.json({ fout: "Geschatte uren moet positief zijn." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(projecten)
      .values({
        klantId: Number(id),
        naam: naam.trim(),
        omschrijving: omschrijving?.trim() || null,
        status: status || "actief",
        geschatteUren: geschatteUren || null,
        deadline: deadline || null,
        voortgangPercentage: voortgangPercentage || 0,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    return NextResponse.json({ project: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
