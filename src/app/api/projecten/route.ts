import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projecten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/projecten — All active projects with client name (for dropdowns)
export async function GET() {
  try {
    await requireAuth();

    const lijst = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        klantId: klanten.id,
        klantNaam: klanten.bedrijfsnaam,
        status: projecten.status,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(eq(projecten.isActief, 1));

    return NextResponse.json({ projecten: lijst });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
