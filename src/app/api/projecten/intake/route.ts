import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectIntakes, salesEngineScans, salesEngineKansen, leads } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq, isNull, desc, and, or } from "drizzle-orm";

// GET /api/projecten/intake — list open intakes
// Open = stap != 'klaar' AND projectId is NULL (not yet linked) OR stap != 'klaar'
export async function GET(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);

    const rows = await db
      .select()
      .from(projectIntakes)
      .where(or(isNull(projectIntakes.projectId), eq(projectIntakes.stap, "concept"), eq(projectIntakes.stap, "invalshoeken"), eq(projectIntakes.stap, "project"), eq(projectIntakes.stap, "scope"), eq(projectIntakes.stap, "klant")))
      .orderBy(desc(projectIntakes.aangemaaktOp))
      .all();

    return NextResponse.json({ intakes: rows });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Niet geauthenticeerd" },
      { status: 401 }
    );
  }
}

// POST /api/projecten/intake
// Body: { klantConcept?: string, scanId?: number, bron?: "dashboard" | "chat" | "sales-engine" }
// If scanId is given, klantConcept is pre-filled from the sales engine scan data.
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);

    const body = await req.json().catch(() => ({}));
    const scanId: number | undefined = body.scanId;
    let klantConcept: string = body.klantConcept || "";
    const bron: string = body.bron || (scanId ? "sales-engine" : "dashboard");

    // Pre-fill klantConcept from sales engine scan if provided
    if (scanId && !klantConcept) {
      const [scan] = await db
        .select({
          samenvatting: salesEngineScans.samenvatting,
          grootsteKnelpunt: salesEngineScans.grootsteKnelpunt,
          aanbevolenPakket: salesEngineScans.aanbevolenPakket,
          websiteUrl: salesEngineScans.websiteUrl,
          leadId: salesEngineScans.leadId,
        })
        .from(salesEngineScans)
        .where(eq(salesEngineScans.id, scanId));

      if (scan) {
        // Enrich with bedrijfsnaam if the scan has a linked lead
        let bedrijfsnaam: string | null = null;
        if (scan.leadId) {
          const [lead] = await db
            .select({ bedrijfsnaam: leads.bedrijfsnaam })
            .from(leads)
            .where(eq(leads.id, scan.leadId));
          bedrijfsnaam = lead?.bedrijfsnaam ?? null;
        }

        // Also pull top 3 kansen as bullet points
        const kansen = await db
          .select({
            titel: salesEngineKansen.titel,
            impact: salesEngineKansen.impact,
          })
          .from(salesEngineKansen)
          .where(and(eq(salesEngineKansen.scanId, scanId), eq(salesEngineKansen.impact, "hoog")))
          .limit(3);

        const parts: string[] = [];
        if (bedrijfsnaam) parts.push(`Klant: ${bedrijfsnaam}`);
        if (scan.websiteUrl) parts.push(`Website: ${scan.websiteUrl}`);
        if (scan.samenvatting) parts.push(`\nSamenvatting:\n${scan.samenvatting}`);
        if (scan.grootsteKnelpunt) parts.push(`\nGrootste knelpunt:\n${scan.grootsteKnelpunt}`);
        if (scan.aanbevolenPakket) parts.push(`\nAanbevolen pakket:\n${scan.aanbevolenPakket}`);
        if (kansen.length > 0) {
          parts.push(`\nTop automatisering kansen:`);
          for (const k of kansen) parts.push(`- ${k.titel}`);
        }
        klantConcept = parts.join("\n");
      }
    }

    const [created] = await db
      .insert(projectIntakes)
      .values({
        scanId: scanId ?? null,
        klantConcept: klantConcept || null,
        bron,
        stap: "concept",
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    return NextResponse.json({ intake: created }, { status: 201 });
  } catch (error) {
    console.error("[intake POST]", error);
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Aanmaken mislukt" },
      { status: 500 }
    );
  }
}
