import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projecten } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { fetchDocumentenByType, archiveNotionDocument } from "@/lib/notion";

// POST /api/documenten/scan-onnodig — Find plan documents for non-existent projects
export async function POST() {
  try {
    await requireAuth();

    // Get all active project names from database
    const actieveProjecten = await db
      .select({ naam: projecten.naam })
      .from(projecten)
      .where(eq(projecten.isActief, 1))
      .all();

    const projectNamen = actieveProjecten.map((p) => p.naam.toLowerCase().trim());

    // Fetch all plan documents from Notion
    const planDocs = await fetchDocumentenByType("plan");

    // Find plans that don't match any active project
    const onnodig: Array<{ notionId: string; titel: string }> = [];

    for (const doc of planDocs) {
      const titelLower = doc.titel.toLowerCase();
      // Check if any active project name appears in the document title
      const matched = projectNamen.some((naam) => {
        // Match "Project X — Projectplan" or "X Projectplan" patterns
        return titelLower.includes(naam) || naam.includes(titelLower.replace(/\s*[—\-]\s*projectplan$/i, "").replace(/\s*projectplan$/i, "").trim());
      });

      if (!matched) {
        onnodig.push({ notionId: doc.notionId, titel: doc.titel });
      }
    }

    return NextResponse.json({
      totaalPlannen: planDocs.length,
      actieveProjecten: projectNamen.length,
      onnodig,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Scan mislukt" },
      { status: 500 }
    );
  }
}

// DELETE /api/documenten/scan-onnodig — Archive specific documents
export async function DELETE(request: Request) {
  try {
    await requireAuth();
    const { notionIds } = (await request.json()) as { notionIds: string[] };

    if (!notionIds?.length) {
      return NextResponse.json({ fout: "Geen documenten opgegeven" }, { status: 400 });
    }

    let gearchiveerd = 0;
    for (const id of notionIds) {
      await archiveNotionDocument(id, true);
      gearchiveerd++;
    }

    return NextResponse.json({ gearchiveerd });
  } catch (error) {
    if (error instanceof Error && error.message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Verwijderen mislukt" },
      { status: 500 }
    );
  }
}
