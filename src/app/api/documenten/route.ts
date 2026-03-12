import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documenten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";

// POST /api/documenten
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();
    const { klantId, projectId, naam, url, type } = body;

    if (!naam?.trim()) {
      return NextResponse.json({ fout: "Naam is verplicht." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(documenten)
      .values({
        klantId: klantId || null,
        projectId: projectId || null,
        naam: naam.trim(),
        url: url?.trim() || null,
        type: type || "overig",
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    return NextResponse.json({ document: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
