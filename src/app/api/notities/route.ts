import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notities } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";

// POST /api/notities
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();
    const { klantId, projectId, inhoud, type } = body;

    if (!inhoud?.trim()) {
      return NextResponse.json({ fout: "Inhoud is verplicht." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(notities)
      .values({
        gebruikerId: gebruiker.id,
        klantId: klantId || null,
        projectId: projectId || null,
        inhoud: inhoud.trim(),
        type: type || "notitie",
      })
      .returning();

    return NextResponse.json({ notitie: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
