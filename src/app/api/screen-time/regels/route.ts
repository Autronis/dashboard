import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeRegels, projecten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

// GET /api/screen-time/regels
export async function GET() {
  try {
    await requireAuth();

    const regels = await db
      .select({
        id: screenTimeRegels.id,
        type: screenTimeRegels.type,
        patroon: screenTimeRegels.patroon,
        categorie: screenTimeRegels.categorie,
        projectId: screenTimeRegels.projectId,
        klantId: screenTimeRegels.klantId,
        prioriteit: screenTimeRegels.prioriteit,
        isActief: screenTimeRegels.isActief,
        aangemaaktOp: screenTimeRegels.aangemaaktOp,
        projectNaam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
      })
      .from(screenTimeRegels)
      .leftJoin(projecten, eq(screenTimeRegels.projectId, projecten.id))
      .leftJoin(klanten, eq(screenTimeRegels.klantId, klanten.id))
      .where(eq(screenTimeRegels.isActief, 1))
      .orderBy(desc(screenTimeRegels.prioriteit))
      .all();

    return NextResponse.json({ regels });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/screen-time/regels
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();

    if (!body.type?.trim()) {
      return NextResponse.json({ fout: "Type is verplicht." }, { status: 400 });
    }
    if (!body.patroon?.trim()) {
      return NextResponse.json({ fout: "Patroon is verplicht." }, { status: 400 });
    }
    if (!body.categorie?.trim()) {
      return NextResponse.json({ fout: "Categorie is verplicht." }, { status: 400 });
    }

    // Validate regex pattern
    try {
      new RegExp(body.patroon.trim());
    } catch {
      return NextResponse.json({ fout: "Ongeldig regex patroon." }, { status: 400 });
    }

    const regel = await db
      .insert(screenTimeRegels)
      .values({
        type: body.type.trim(),
        patroon: body.patroon.trim(),
        categorie: body.categorie.trim(),
        projectId: body.projectId ?? null,
        klantId: body.klantId ?? null,
        prioriteit: body.prioriteit ?? 0,
      })
      .returning()
      .get();

    return NextResponse.json({ regel }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
