import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { followUpTemplates } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

// GET /api/followup/templates — list all templates
export async function GET() {
  try {
    await requireAuth();

    const rows = await db
      .select()
      .from(followUpTemplates)
      .where(eq(followUpTemplates.isActief, 1))
      .orderBy(desc(followUpTemplates.aangemaaktOp));

    return NextResponse.json({ templates: rows });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/followup/templates — create a template
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    if (!body.naam?.trim() || !body.onderwerp?.trim() || !body.inhoud?.trim()) {
      return NextResponse.json({ fout: "Naam, onderwerp en inhoud zijn verplicht." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(followUpTemplates)
      .values({
        naam: body.naam.trim(),
        onderwerp: body.onderwerp.trim(),
        inhoud: body.inhoud.trim(),
        type: body.type || "email",
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    return NextResponse.json({ template: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
