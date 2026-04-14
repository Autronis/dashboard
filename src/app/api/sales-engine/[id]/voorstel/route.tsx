import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salesEngineScans, salesEngineKansen, leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { MiniVoorstelPDF, type MiniVoorstelData } from "@/lib/sales-engine/pdf-template";
import { berekenPakketten, isValidTier } from "@/lib/sales-engine/pakket-calculator";

// Never cache this route — the template can change and we want every
// download to reflect the latest version.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/sales-engine/[id]/voorstel?tier=basis|pro|enterprise
// Generates a klant-voorstel PDF with the three tier packages and the
// requested tier highlighted. Defaults to "pro" when no tier query given.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const scanId = parseInt(id, 10);
    if (isNaN(scanId)) {
      return NextResponse.json({ fout: "Ongeldig scan ID" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const tierParam = searchParams.get("tier") || "pro";
    const tier = isValidTier(tierParam) ? tierParam : "pro";

    const scan = await db
      .select()
      .from(salesEngineScans)
      .where(eq(salesEngineScans.id, scanId))
      .get();

    if (!scan) {
      return NextResponse.json({ fout: "Scan niet gevonden" }, { status: 404 });
    }

    if (scan.status !== "completed") {
      return NextResponse.json({ fout: "Scan is nog niet voltooid" }, { status: 400 });
    }

    const lead = scan.leadId
      ? await db.select().from(leads).where(eq(leads.id, scan.leadId)).get()
      : null;

    const kansen = await db
      .select()
      .from(salesEngineKansen)
      .where(eq(salesEngineKansen.scanId, scanId))
      .all();

    const kansenInput = kansen.map((k) => ({
      titel: k.titel,
      beschrijving: k.beschrijving ?? "",
      impact: k.impact ?? "midden",
      geschatteTijdsbesparing: k.geschatteTijdsbesparing,
      geschatteBesparing: k.geschatteBesparing,
      prioriteit: k.prioriteit ?? 99,
    }));

    // Calculate all three tiers — conservative value-based pricing per the
    // scope-generator skill (SKILL.md fase 4).
    const pakketten = berekenPakketten(kansenInput);
    const gekozen = pakketten[tier];

    const data: MiniVoorstelData = {
      bedrijfsnaam: lead?.bedrijfsnaam ?? "Onbekend bedrijf",
      contactpersoon: lead?.contactpersoon ?? "Beste klant",
      websiteUrl: scan.websiteUrl,
      samenvatting:
        scan.samenvatting ??
        "Op basis van onze analyse hebben wij diverse automatiseringskansen geïdentificeerd.",
      readinessScore: scan.automationReadinessScore ?? 5,
      aanbevolenPakket: gekozen.naam,
      kansen: kansenInput,
      pakketten,
      gekozenTier: tier,
    };

    const pdfBuffer = await renderToBuffer(<MiniVoorstelPDF data={data} />);

    const filename = `Autronis-Voorstel-${data.bedrijfsnaam.replace(
      /[^a-zA-Z0-9]/g,
      "-"
    )}-${tier}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd"
            ? 401
            : 500,
      }
    );
  }
}
