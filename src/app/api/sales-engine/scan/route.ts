import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, salesEngineScans, salesEngineKansen } from "@/lib/db/schema";
import { requireApiKey } from "@/lib/auth";
import { scrapeWebsite } from "@/lib/sales-engine/scraper";
import { fetchGooglePlacesData } from "@/lib/sales-engine/google-places";
import { analyzeWithClaude } from "@/lib/sales-engine/analyzer";
import { eq, and, gte, sql } from "drizzle-orm";

interface ScanRequestBody {
  naam: string;
  email: string;
  bedrijfsnaam: string;
  bedrijfsgrootte: string;
  rol: string;
  websiteUrl: string;
  grootsteKnelpunt: string;
  huidigeTools?: string;
  opmerkingen?: string;
  autoOutreach?: boolean;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateBody(body: Record<string, unknown>): ScanRequestBody {
  const required = ["naam", "email", "bedrijfsnaam", "bedrijfsgrootte", "rol", "websiteUrl", "grootsteKnelpunt"];
  for (const field of required) {
    if (!body[field] || typeof body[field] !== "string" || !(body[field] as string).trim()) {
      throw new Error(`Veld '${field}' is verplicht`);
    }
  }
  if (!validateEmail(body.email as string)) {
    throw new Error("Ongeldig e-mailadres");
  }
  if (!validateUrl(body.websiteUrl as string)) {
    throw new Error("Ongeldige website URL (moet http:// of https:// zijn)");
  }
  return {
    naam: (body.naam as string).trim(),
    email: (body.email as string).trim().toLowerCase(),
    bedrijfsnaam: (body.bedrijfsnaam as string).trim(),
    bedrijfsgrootte: (body.bedrijfsgrootte as string).trim(),
    rol: (body.rol as string).trim(),
    websiteUrl: (body.websiteUrl as string).trim(),
    grootsteKnelpunt: (body.grootsteKnelpunt as string).trim(),
    huidigeTools: (body.huidigeTools as string)?.trim() || "",
    opmerkingen: (body.opmerkingen as string)?.trim() || "",
  };
}

export async function POST(req: NextRequest) {
  try {
    await requireApiKey(req);

    let rawBody: Record<string, unknown>;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Ongeldig JSON verzoek" }, { status: 400 });
    }

    const body = validateBody(rawBody);

    // Deduplication: check for recent scan with same email + URL
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const existingLeadForDedup = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.email, body.email))
      .get();

    const recentScan = existingLeadForDedup
      ? db
          .select({ id: salesEngineScans.id, leadId: salesEngineScans.leadId })
          .from(salesEngineScans)
          .where(
            and(
              eq(salesEngineScans.leadId, existingLeadForDedup.id),
              eq(salesEngineScans.websiteUrl, body.websiteUrl),
              gte(salesEngineScans.aangemaaktOp, tenMinutesAgo)
            )
          )
          .get()
      : null;

    if (recentScan) {
      return NextResponse.json({
        success: true,
        scanId: recentScan.id,
        leadId: recentScan.leadId,
        deduplicated: true,
      });
    }

    // Match or create lead
    let existingLead = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.email, body.email))
      .get();

    if (existingLead) {
      await db.update(leads)
        .set({
          bedrijfsnaam: body.bedrijfsnaam,
          contactpersoon: body.naam,
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(leads.id, existingLead.id))
        .run();
    } else {
      const [newLead] = await db
        .insert(leads)
        .values({
          bedrijfsnaam: body.bedrijfsnaam,
          contactpersoon: body.naam,
          email: body.email,
          status: "nieuw",
          bron: "cal.com",
          notities: `Rol: ${body.rol}\nBedrijfsgrootte: ${body.bedrijfsgrootte}\nKnelpunt: ${body.grootsteKnelpunt}`,
        })
        .returning()
        .all();
      existingLead = { id: newLead.id };
    }

    // Create scan record
    const [scan] = await db
      .insert(salesEngineScans)
      .values({
        leadId: existingLead.id,
        websiteUrl: body.websiteUrl,
        bedrijfsgrootte: body.bedrijfsgrootte,
        rol: body.rol,
        grootsteKnelpunt: body.grootsteKnelpunt,
        huidigeTools: body.huidigeTools || null,
        opmerkingen: body.opmerkingen || null,
        status: "pending",
      })
      .returning()
      .all();

    try {
      // Scrape website + Google Places (parallel)
      const [scrapeResult, placesData] = await Promise.all([
        scrapeWebsite(body.websiteUrl, body.bedrijfsnaam),
        fetchGooglePlacesData(body.bedrijfsnaam, body.websiteUrl),
      ]);
      scrapeResult.googlePlaces = placesData;

      await db.update(salesEngineScans)
        .set({
          scrapeResultaat: JSON.stringify(scrapeResult),
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(salesEngineScans.id, scan.id))
        .run();

      // AI analysis
      const analysis = await analyzeWithClaude(scrapeResult, {
        bedrijfsnaam: body.bedrijfsnaam,
        bedrijfsgrootte: body.bedrijfsgrootte,
        rol: body.rol,
        grootsteKnelpunt: body.grootsteKnelpunt,
        huidigeTools: body.huidigeTools || "",
      });

      // Save kansen
      for (const kans of analysis.kansen) {
        await db.insert(salesEngineKansen)
          .values({
            scanId: scan.id,
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

      // Update scan to completed
      await db.update(salesEngineScans)
        .set({
          aiAnalyse: JSON.stringify(analysis),
          samenvatting: analysis.samenvatting,
          status: "completed",
          automationReadinessScore: analysis.automationReadinessScore ?? null,
          aanbevolenPakket: analysis.aanbevolenPakket ?? null,
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(salesEngineScans.id, scan.id))
        .run();

      // Pipeline integratie: update lead met scan resultaten
      const hoogImpactKansen = analysis.kansen.filter((k) => k.impact === "hoog").length;
      const geschatteWaarde = hoogImpactKansen * 2000;
      await db.update(leads)
        .set({
          waarde: geschatteWaarde,
          status: "contact",
          volgendeActie: "Voorstel opstellen",
          notities: `AI Samenvatting: ${analysis.samenvatting}\n\nAutomation Readiness: ${analysis.automationReadinessScore}/10\nAanbevolen pakket: ${analysis.aanbevolenPakket}\nAantal kansen: ${analysis.kansen.length} (${hoogImpactKansen} hoog impact)`,
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(leads.id, existingLead.id))
        .run();

      return NextResponse.json({ success: true, scanId: scan.id, leadId: existingLead.id }, { status: 201 });
    } catch (processingError) {
      await db.update(salesEngineScans)
        .set({
          status: "failed",
          foutmelding: processingError instanceof Error ? processingError.message : "Onbekende fout",
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(salesEngineScans.id, scan.id))
        .run();

      return NextResponse.json(
        { success: false, error: processingError instanceof Error ? processingError.message : "Scan mislukt" },
        { status: 500 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const status = message.includes("API key") || message.includes("Ongeldige") ? 401 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
