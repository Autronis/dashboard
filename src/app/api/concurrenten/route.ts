import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { concurrenten, concurrentScans } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

// GET /api/concurrenten — lijst actieve concurrenten + laatste scan
export async function GET() {
  try {
    await requireAuth();

    const rows = db
      .select()
      .from(concurrenten)
      .where(eq(concurrenten.isActief, 1))
      .orderBy(concurrenten.naam)
      .all();

    // Haal laatste scan per concurrent op
    const metLaatsteScan = rows.map((c) => {
      const laatsteScan = db
        .select()
        .from(concurrentScans)
        .where(eq(concurrentScans.concurrentId, c.id))
        .orderBy(desc(concurrentScans.aangemaaktOp))
        .limit(1)
        .get();

      return { ...c, laatsteScan: laatsteScan ?? null };
    });

    const kpis = {
      totaal: rows.length,
      wijzigingenDezeWeek: 0, // Berekend in dashboard endpoint
      groeiend: metLaatsteScan.filter((c) => c.laatsteScan?.trendIndicator === "groeiend").length,
      laatsteScan: metLaatsteScan
        .map((c) => c.laatsteScan?.aangemaaktOp)
        .filter(Boolean)
        .sort()
        .reverse()[0] ?? null,
    };

    return NextResponse.json({ concurrenten: metLaatsteScan, kpis });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/concurrenten — nieuwe concurrent toevoegen
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();

    if (!body.naam?.trim()) {
      return NextResponse.json({ fout: "Naam is verplicht." }, { status: 400 });
    }
    if (!body.websiteUrl?.trim()) {
      return NextResponse.json({ fout: "Website URL is verplicht." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(concurrenten)
      .values({
        naam: body.naam.trim(),
        websiteUrl: body.websiteUrl.trim(),
        linkedinUrl: body.linkedinUrl?.trim() || null,
        instagramHandle: body.instagramHandle?.trim()?.replace(/^@/, "") || null,
        scanPaginas: body.scanPaginas ? JSON.stringify(body.scanPaginas) : undefined,
        beschrijving: body.beschrijving?.trim() || null,
        diensten: body.diensten ? JSON.stringify(body.diensten) : null,
        techStack: body.techStack ? JSON.stringify(body.techStack) : null,
        prijzen: body.prijzen?.trim() || null,
        teamGrootte: body.teamGrootte?.trim() || null,
        sterktes: body.sterktes ? JSON.stringify(body.sterktes) : null,
        zwaktes: body.zwaktes ? JSON.stringify(body.zwaktes) : null,
        overlapScore: body.overlapScore ?? null,
        overlapUitleg: body.overlapUitleg?.trim() || null,
        threatLevel: body.threatLevel || null,
        threatUitleg: body.threatUitleg?.trim() || null,
        notities: body.notities?.trim() || null,
      })
      .returning();

    return NextResponse.json({ concurrent: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
