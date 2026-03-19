import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, salesEngineScans, salesEngineKansen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { scrapeWebsite } from "@/lib/sales-engine/scraper";
import { analyzeWithClaude } from "@/lib/sales-engine/analyzer";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

interface BatchBedrijf {
  bedrijfsnaam: string;
  websiteUrl: string;
}

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function processScanInBackground(scanId: number, leadId: number, bedrijfsnaam: string, websiteUrl: string) {
  try {
    const scrapeResult = await scrapeWebsite(websiteUrl);
    db.update(salesEngineScans)
      .set({
        scrapeResultaat: JSON.stringify(scrapeResult),
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(salesEngineScans.id, scanId))
      .run();

    const analysis = await analyzeWithClaude(scrapeResult, {
      bedrijfsnaam,
      bedrijfsgrootte: "Onbekend",
      rol: "Onbekend",
      grootsteKnelpunt: "Batch scan - geen knelpunt opgegeven",
      huidigeTools: "",
    });

    for (const kans of analysis.kansen) {
      db.insert(salesEngineKansen)
        .values({
          scanId,
          titel: kans.titel,
          beschrijving: kans.beschrijving,
          categorie: kans.categorie,
          impact: kans.impact,
          geschatteTijdsbesparing: kans.geschatteTijdsbesparing,
          geschatteKosten: kans.geschatteKosten ?? null,
          geschatteBesparing: kans.geschatteBesparing ?? null,
          implementatieEffort: kans.implementatieEffort ?? null,
          prioriteit: kans.prioriteit,
        })
        .run();
    }

    db.update(salesEngineScans)
      .set({
        aiAnalyse: JSON.stringify(analysis),
        samenvatting: analysis.samenvatting,
        status: "completed",
        automationReadinessScore: analysis.automationReadinessScore ?? null,
        aanbevolenPakket: analysis.aanbevolenPakket ?? null,
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(salesEngineScans.id, scanId))
      .run();

    // Pipeline integratie
    const hoogImpactKansen = analysis.kansen.filter((k) => k.impact === "hoog").length;
    const geschatteWaarde = hoogImpactKansen * 2000;
    db.update(leads)
      .set({
        waarde: geschatteWaarde,
        status: "contact",
        volgendeActie: "Voorstel opstellen",
        notities: `AI Samenvatting: ${analysis.samenvatting}\n\nAutomation Readiness: ${analysis.automationReadinessScore}/10\nAanbevolen pakket: ${analysis.aanbevolenPakket}\nAantal kansen: ${analysis.kansen.length} (${hoogImpactKansen} hoog impact)`,
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(leads.id, leadId))
      .run();
  } catch (error) {
    db.update(salesEngineScans)
      .set({
        status: "failed",
        foutmelding: error instanceof Error ? error.message : "Onbekende fout",
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(salesEngineScans.id, scanId))
      .run();
  }
}

async function processAllScans(scanItems: Array<{ scanId: number; leadId: number; bedrijfsnaam: string; websiteUrl: string }>) {
  for (const item of scanItems) {
    await processScanInBackground(item.scanId, item.leadId, item.bedrijfsnaam, item.websiteUrl);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    let rawBody: Record<string, unknown>;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ fout: "Ongeldig JSON verzoek" }, { status: 400 });
    }

    const bedrijven = rawBody.bedrijven as BatchBedrijf[] | undefined;
    if (!Array.isArray(bedrijven) || bedrijven.length === 0) {
      return NextResponse.json({ fout: "Geen bedrijven opgegeven" }, { status: 400 });
    }

    if (bedrijven.length > 20) {
      return NextResponse.json({ fout: "Maximaal 20 bedrijven per batch" }, { status: 400 });
    }

    // Validate all entries
    for (let i = 0; i < bedrijven.length; i++) {
      const b = bedrijven[i];
      if (!b.bedrijfsnaam || typeof b.bedrijfsnaam !== "string" || !b.bedrijfsnaam.trim()) {
        return NextResponse.json({ fout: `Bedrijfsnaam is verplicht (regel ${i + 1})` }, { status: 400 });
      }
      if (!b.websiteUrl || typeof b.websiteUrl !== "string" || !b.websiteUrl.trim()) {
        return NextResponse.json({ fout: `Website URL is verplicht (regel ${i + 1})` }, { status: 400 });
      }
      if (!validateUrl(b.websiteUrl.trim())) {
        return NextResponse.json({ fout: `Ongeldige URL: ${b.websiteUrl} (regel ${i + 1})` }, { status: 400 });
      }
    }

    const batchId = randomUUID();
    const scanItems: Array<{ scanId: number; leadId: number; bedrijfsnaam: string; websiteUrl: string }> = [];

    for (const bedrijf of bedrijven) {
      const naam = bedrijf.bedrijfsnaam.trim();
      const url = bedrijf.websiteUrl.trim();

      // Find or create lead
      let existingLead = db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.bedrijfsnaam, naam))
        .get();

      if (!existingLead) {
        const [newLead] = db
          .insert(leads)
          .values({
            bedrijfsnaam: naam,
            status: "nieuw",
            bron: "batch-scan",
          })
          .returning()
          .all();
        existingLead = { id: newLead.id };
      }

      // Create scan record with pending status
      const [scan] = db
        .insert(salesEngineScans)
        .values({
          leadId: existingLead.id,
          websiteUrl: url,
          status: "pending",
          batchId,
        })
        .returning()
        .all();

      scanItems.push({ scanId: scan.id, leadId: existingLead.id, bedrijfsnaam: naam, websiteUrl: url });
    }

    // Fire off processing in background - don't await
    processAllScans(scanItems).catch(() => {
      // Errors are handled per-scan inside processAllScans
    });

    return NextResponse.json({
      batchId,
      aantal: scanItems.length,
      scans: scanItems.map((s) => ({ scanId: s.scanId, bedrijfsnaam: s.bedrijfsnaam })),
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const status = message === "Niet geauthenticeerd" ? 401 : 400;
    return NextResponse.json({ fout: message }, { status });
  }
}
