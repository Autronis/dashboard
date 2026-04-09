import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, gebruikers } from "@/lib/db/schema";
import { requireAuth, requireApiKey } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

// GET /api/projecten/taken?projectNaam=X&status=open|afgerond|all
// Returns tasks for a project, filterable by status
// Supports both session auth and Bearer API key (for Claude Code)
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      await requireApiKey(req);
    } else {
      await requireAuth();
    }

    const projectNaam = req.nextUrl.searchParams.get("projectNaam");
    const statusFilter = req.nextUrl.searchParams.get("status") || "open";

    if (!projectNaam) {
      return NextResponse.json({ fout: "projectNaam query parameter is verplicht" }, { status: 400 });
    }

    // Find project (case-insensitive)
    const project = await db
      .select()
      .from(projecten)
      .where(sql`LOWER(${projecten.naam}) = LOWER(${projectNaam})`)
      .get();

    if (!project) {
      return NextResponse.json({ fout: `Project "${projectNaam}" niet gevonden` }, { status: 404 });
    }

    // Build query
    const conditions = [eq(taken.projectId, project.id)];
    if (statusFilter === "open") {
      conditions.push(sql`${taken.status} != 'afgerond'`);
    } else if (statusFilter === "afgerond") {
      conditions.push(eq(taken.status, "afgerond"));
    }
    // statusFilter === "all" → no status filter

    const takenLijst = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        status: taken.status,
        prioriteit: taken.prioriteit,
        fase: taken.fase,
        volgorde: taken.volgorde,
        uitvoerder: taken.uitvoerder,
        toegewezenAanNaam: gebruikers.naam,
        aangemaaktOp: taken.aangemaaktOp,
        bijgewerktOp: taken.bijgewerktOp,
      })
      .from(taken)
      .leftJoin(gebruikers, eq(taken.toegewezenAan, gebruikers.id))
      .where(sql`${conditions.map((c) => sql`(${c})`).reduce((a, b) => sql`${a} AND ${b}`)}`)
      .orderBy(taken.volgorde);

    return NextResponse.json({
      project: { id: project.id, naam: project.naam, status: project.status, voortgang: project.voortgangPercentage },
      taken: takenLijst,
      totaal: takenLijst.length,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
