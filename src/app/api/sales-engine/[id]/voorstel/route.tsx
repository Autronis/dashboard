import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salesEngineScans, salesEngineKansen, leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { MiniVoorstelPDF, type MiniVoorstelData } from "@/lib/sales-engine/pdf-template";

// Never cache this route — the template can change and we want every
// download to reflect the latest version.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STANDAARD_UURTARIEF = 75;

function parseUrenPerWeek(text: string | null): number {
  if (!text) return 0;
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*uur/i);
  if (!match) return 0;
  return parseFloat(match[1].replace(",", "."));
}

// GET /api/sales-engine/[id]/voorstel — Generate mini-voorstel PDF
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const scanId = parseInt(id, 10);
    if (isNaN(scanId)) {
      return NextResponse.json({ fout: "Ongeldig scan ID" }, { status: 400 });
    }

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

    // ROI calculations
    const kansenMetUren = kansen.map((k) => ({
      ...k,
      urenPerWeek: parseUrenPerWeek(k.geschatteTijdsbesparing),
    }));
    const totaalUrenPerWeek = kansenMetUren.reduce((sum, k) => sum + k.urenPerWeek, 0);
    const jaarlijkseBesparing = totaalUrenPerWeek * 52 * STANDAARD_UURTARIEF;
    const geschatteInvestering = totaalUrenPerWeek > 8 ? 5000 : totaalUrenPerWeek > 3 ? 3000 : 1500;
    const terugverdientijdMaanden = jaarlijkseBesparing > 0
      ? Math.ceil((geschatteInvestering / jaarlijkseBesparing) * 12)
      : 0;

    const data: MiniVoorstelData = {
      bedrijfsnaam: lead?.bedrijfsnaam ?? "Onbekend bedrijf",
      contactpersoon: lead?.contactpersoon ?? "Beste klant",
      websiteUrl: scan.websiteUrl,
      samenvatting: scan.samenvatting ?? "Op basis van onze analyse hebben wij diverse automatiseringskansen geïdentificeerd.",
      readinessScore: scan.automationReadinessScore ?? 5,
      aanbevolenPakket: scan.aanbevolenPakket ?? "business",
      kansen: kansen.map((k) => ({
        titel: k.titel,
        beschrijving: k.beschrijving ?? "",
        impact: k.impact ?? "midden",
        geschatteTijdsbesparing: k.geschatteTijdsbesparing,
        geschatteBesparing: k.geschatteBesparing,
        prioriteit: k.prioriteit ?? 99,
      })),
      jaarlijkseBesparing,
      geschatteInvestering,
      terugverdientijdMaanden,
      totaalUrenPerWeek,
    };

    const pdfBuffer = await renderToBuffer(
      <MiniVoorstelPDF data={data} />
    );

    const filename = `Autronis-Voorstel-${data.bedrijfsnaam.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
