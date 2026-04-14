import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectIntakes } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";

const VALID_STEPS = new Set(["concept", "invalshoeken", "project", "scope", "klant", "klaar"]);
const VALID_SCOPE_STATUS = new Set(["niet_gestart", "bezig", "klaar", "overgeslagen"]);

// GET /api/projecten/intake/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthOrApiKey(req);
    const { id } = await params;
    const intakeId = parseInt(id, 10);
    if (isNaN(intakeId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const [intake] = await db
      .select()
      .from(projectIntakes)
      .where(eq(projectIntakes.id, intakeId));

    if (!intake) {
      return NextResponse.json({ fout: "Intake niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ intake });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Niet geauthenticeerd" },
      { status: 401 }
    );
  }
}

// PATCH /api/projecten/intake/[id]
// Body: partial { stap, klantConcept, creatieveIdeeen, gekozenInvalshoek, scopeStatus }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthOrApiKey(req);
    const { id } = await params;
    const intakeId = parseInt(id, 10);
    if (isNaN(intakeId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const update: Partial<typeof projectIntakes.$inferInsert> = {};

    if (typeof body.stap === "string") {
      if (!VALID_STEPS.has(body.stap)) {
        return NextResponse.json({ fout: `Ongeldige stap: ${body.stap}` }, { status: 400 });
      }
      update.stap = body.stap;
    }
    if (typeof body.klantConcept === "string") update.klantConcept = body.klantConcept;
    if (typeof body.creatieveIdeeen === "string") update.creatieveIdeeen = body.creatieveIdeeen;
    if (Array.isArray(body.creatieveIdeeen)) update.creatieveIdeeen = JSON.stringify(body.creatieveIdeeen);
    if (typeof body.gekozenInvalshoek === "string") update.gekozenInvalshoek = body.gekozenInvalshoek;
    if (typeof body.scopeStatus === "string") {
      if (!VALID_SCOPE_STATUS.has(body.scopeStatus)) {
        return NextResponse.json({ fout: `Ongeldige scopeStatus: ${body.scopeStatus}` }, { status: 400 });
      }
      update.scopeStatus = body.scopeStatus;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ fout: "Geen velden om bij te werken" }, { status: 400 });
    }

    update.bijgewerktOp = new Date().toISOString();

    const [updated] = await db
      .update(projectIntakes)
      .set(update)
      .where(eq(projectIntakes.id, intakeId))
      .returning();

    if (!updated) {
      return NextResponse.json({ fout: "Intake niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ intake: updated });
  } catch (error) {
    console.error("[intake PATCH]", error);
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Bijwerken mislukt" },
      { status: 500 }
    );
  }
}
