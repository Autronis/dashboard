import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salesEngineScans, salesEngineKansen, leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { PresentatiePDF, type PresentatieData } from "@/lib/sales-engine/presentatie-template";

// Never cache — template can change and we always want the latest render.
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

// GET /api/sales-engine/[id]/presentatie — Generate presentatie PDF
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

    const scan = await db.select().from(salesEngineScans).where(eq(salesEngineScans.id, scanId)).get();
    if (!scan || scan.status !== "completed") {
      return NextResponse.json({ fout: "Scan niet gevonden of niet voltooid" }, { status: 404 });
    }

    const lead = scan.leadId
      ? await db.select().from(leads).where(eq(leads.id, scan.leadId)).get()
      : null;

    const kansen = await db.select().from(salesEngineKansen).where(eq(salesEngineKansen.scanId, scanId)).all();

    const kansenMetUren = kansen.map((k) => ({ ...k, urenPerWeek: parseUrenPerWeek(k.geschatteTijdsbesparing) }));
    const totaalUrenPerWeek = kansenMetUren.reduce((sum, k) => sum + k.urenPerWeek, 0);
    const jaarlijkseBesparing = totaalUrenPerWeek * 52 * STANDAARD_UURTARIEF;
    const geschatteInvestering = totaalUrenPerWeek > 8 ? 5000 : totaalUrenPerWeek > 3 ? 3000 : 1500;
    const terugverdientijdMaanden = jaarlijkseBesparing > 0
      ? Math.ceil((geschatteInvestering / jaarlijkseBesparing) * 12)
      : 0;

    // Parse bedrijfsprofiel from AI analyse
    let bedrijfsProfiel = null;
    try {
      const aiAnalyse = scan.aiAnalyse ? JSON.parse(scan.aiAnalyse) : null;
      if (aiAnalyse?.bedrijfsProfiel) bedrijfsProfiel = aiAnalyse.bedrijfsProfiel;
    } catch { /* ignore parse errors */ }

    const data: PresentatieData = {
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
        prioriteit: k.prioriteit ?? 99,
      })),
      jaarlijkseBesparing,
      geschatteInvestering,
      terugverdientijdMaanden,
      totaalUrenPerWeek,
      bedrijfsProfiel,
    };

    const pdfBuffer = await renderToBuffer(<PresentatiePDF data={data} />);
    const filename = `Autronis-Presentatie-${data.bedrijfsnaam.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
