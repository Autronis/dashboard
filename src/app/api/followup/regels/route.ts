import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { followUpRegels, followUpTemplates } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

// GET /api/followup/regels — list all rules with template info
export async function GET() {
  try {
    await requireAuth();

    const rows = await db
      .select({
        id: followUpRegels.id,
        naam: followUpRegels.naam,
        type: followUpRegels.type,
        doelgroep: followUpRegels.doelgroep,
        dagenDrempel: followUpRegels.dagenDrempel,
        templateId: followUpRegels.templateId,
        templateNaam: followUpTemplates.naam,
        isActief: followUpRegels.isActief,
        aangemaaktOp: followUpRegels.aangemaaktOp,
      })
      .from(followUpRegels)
      .leftJoin(followUpTemplates, eq(followUpRegels.templateId, followUpTemplates.id))
      .where(eq(followUpRegels.isActief, 1))
      .orderBy(desc(followUpRegels.aangemaaktOp));

    return NextResponse.json({ regels: rows });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/followup/regels — create a rule
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    if (!body.naam?.trim()) {
      return NextResponse.json({ fout: "Naam is verplicht." }, { status: 400 });
    }
    if (!body.type) {
      return NextResponse.json({ fout: "Type is verplicht." }, { status: 400 });
    }
    if (!body.dagenDrempel || body.dagenDrempel < 1) {
      return NextResponse.json({ fout: "Dagen drempel moet minimaal 1 zijn." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(followUpRegels)
      .values({
        naam: body.naam.trim(),
        type: body.type,
        doelgroep: body.doelgroep || "beide",
        dagenDrempel: body.dagenDrempel,
        templateId: body.templateId || null,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    return NextResponse.json({ regel: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
