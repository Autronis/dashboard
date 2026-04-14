import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectIntakes, projecten } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";

const VALID_EIGENAAR = new Set(["sem", "syb", "team", "vrij"]);

// POST /api/projecten/intake/[id]/aanmaken
// Body: { naam: string, eigenaar: "sem"|"syb"|"team"|"vrij", omschrijving?: string }
// Creates a projecten row from the intake state, links it via projectId,
// bumps stap to "scope". The intake's klantConcept + gekozen invalshoek
// become the project description if no explicit omschrijving is given.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const { id } = await params;
    const intakeId = parseInt(id, 10);
    if (isNaN(intakeId)) {
      return NextResponse.json({ fout: "Ongeldig intake ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const naam: string = (body.naam || "").trim();
    const eigenaar: string = (body.eigenaar || "").trim();
    const omschrijvingOverride: string | undefined = body.omschrijving;

    if (!naam) {
      return NextResponse.json({ fout: "Naam is verplicht" }, { status: 400 });
    }
    if (!VALID_EIGENAAR.has(eigenaar)) {
      return NextResponse.json(
        { fout: `Eigenaar verplicht (sem|syb|team|vrij), kreeg: ${eigenaar || "(leeg)"}` },
        { status: 400 }
      );
    }

    const [intake] = await db
      .select()
      .from(projectIntakes)
      .where(eq(projectIntakes.id, intakeId));

    if (!intake) {
      return NextResponse.json({ fout: "Intake niet gevonden" }, { status: 404 });
    }
    if (intake.projectId) {
      return NextResponse.json(
        { fout: `Intake is al gekoppeld aan project ${intake.projectId}` },
        { status: 409 }
      );
    }

    // Build omschrijving from intake state if not given
    let omschrijving = omschrijvingOverride;
    if (!omschrijving) {
      const parts: string[] = [];
      if (intake.klantConcept) parts.push(intake.klantConcept);
      if (intake.gekozenInvalshoek) {
        // gekozenInvalshoek may be a name ("Lead-gen automation") or index
        parts.push(`\n---\nGekozen invalshoek: ${intake.gekozenInvalshoek}`);
      }
      omschrijving = parts.join("\n") || undefined;
    }

    const [project] = await db
      .insert(projecten)
      .values({
        naam,
        eigenaar: eigenaar as "sem" | "syb" | "team" | "vrij",
        omschrijving: omschrijving || null,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    // Link the intake to the new project + advance step
    const [updatedIntake] = await db
      .update(projectIntakes)
      .set({
        projectId: project.id,
        stap: "scope",
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(projectIntakes.id, intakeId))
      .returning();

    return NextResponse.json({
      project,
      intake: updatedIntake,
    });
  } catch (error) {
    console.error("[intake aanmaken]", error);
    return NextResponse.json(
      {
        fout: error instanceof Error ? error.message : "Project aanmaken mislukt",
      },
      { status: 500 }
    );
  }
}
