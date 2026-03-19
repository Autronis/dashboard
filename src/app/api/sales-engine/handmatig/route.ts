import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, salesEngineScans, salesEngineKansen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { scrapeWebsite } from "@/lib/sales-engine/scraper";
import { analyzeWithClaude } from "@/lib/sales-engine/analyzer";
import { eq } from "drizzle-orm";

interface HandmatigScanBody {
  bedrijfsnaam: string;
  websiteUrl: string;
  contactpersoon?: string;
  email?: string;
}

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateBody(body: Record<string, unknown>): HandmatigScanBody {
  if (!body.bedrijfsnaam || typeof body.bedrijfsnaam !== "string" || !body.bedrijfsnaam.trim()) {
    throw new Error("Bedrijfsnaam is verplicht");
  }
  if (!body.websiteUrl || typeof body.websiteUrl !== "string" || !body.websiteUrl.trim()) {
    throw new Error("Website URL is verplicht");
  }
  if (!validateUrl(body.websiteUrl as string)) {
    throw new Error("Ongeldige website URL (moet http:// of https:// zijn)");
  }

  return {
    bedrijfsnaam: (body.bedrijfsnaam as string).trim(),
    websiteUrl: (body.websiteUrl as string).trim(),
    contactpersoon: typeof body.contactpersoon === "string" ? body.contactpersoon.trim() || undefined : undefined,
    email: typeof body.email === "string" ? body.email.trim().toLowerCase() || undefined : undefined,
  };
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

    const body = validateBody(rawBody);

    // Match or create lead
    let existingLead = body.email
      ? db.select({ id: leads.id }).from(leads).where(eq(leads.email, body.email)).get()
      : db.select({ id: leads.id }).from(leads).where(eq(leads.bedrijfsnaam, body.bedrijfsnaam)).get();

    if (existingLead) {
      db.update(leads)
        .set({
          bedrijfsnaam: body.bedrijfsnaam,
          ...(body.contactpersoon ? { contactpersoon: body.contactpersoon } : {}),
          ...(body.email ? { email: body.email } : {}),
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(leads.id, existingLead.id))
        .run();
    } else {
      const [newLead] = db
        .insert(leads)
        .values({
          bedrijfsnaam: body.bedrijfsnaam,
          contactpersoon: body.contactpersoon ?? null,
          email: body.email ?? null,
          status: "nieuw",
          bron: "handmatig",
        })
        .returning()
        .all();
      existingLead = { id: newLead.id };
    }

    // Create scan record
    const [scan] = db
      .insert(salesEngineScans)
      .values({
        leadId: existingLead.id,
        websiteUrl: body.websiteUrl,
        status: "pending",
      })
      .returning()
      .all();

    try {
      // Scrape website
      const scrapeResult = await scrapeWebsite(body.websiteUrl);
      db.update(salesEngineScans)
        .set({
          scrapeResultaat: JSON.stringify(scrapeResult),
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(salesEngineScans.id, scan.id))
        .run();

      // AI analysis
      const analysis = await analyzeWithClaude(scrapeResult, {
        bedrijfsnaam: body.bedrijfsnaam,
        bedrijfsgrootte: "Onbekend",
        rol: "Onbekend",
        grootsteKnelpunt: "Handmatige scan - geen knelpunt opgegeven",
        huidigeTools: "",
      });

      // Save kansen
      for (const kans of analysis.kansen) {
        db.insert(salesEngineKansen)
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
      db.update(salesEngineScans)
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
      db.update(leads)
        .set({
          waarde: geschatteWaarde,
          status: "contact",
          volgendeActie: "Voorstel opstellen",
          notities: `AI Samenvatting: ${analysis.samenvatting}\n\nAutomation Readiness: ${analysis.automationReadinessScore}/10\nAanbevolen pakket: ${analysis.aanbevolenPakket}\nAantal kansen: ${analysis.kansen.length} (${hoogImpactKansen} hoog impact)`,
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(leads.id, existingLead.id))
        .run();

      return NextResponse.json({
        scanId: scan.id,
        leadId: existingLead.id,
        status: "completed",
        samenvatting: analysis.samenvatting,
        aantalKansen: analysis.kansen.length,
      }, { status: 201 });
    } catch (processingError) {
      db.update(salesEngineScans)
        .set({
          status: "failed",
          foutmelding: processingError instanceof Error ? processingError.message : "Onbekende fout",
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(salesEngineScans.id, scan.id))
        .run();

      return NextResponse.json(
        { fout: processingError instanceof Error ? processingError.message : "Scan mislukt", scanId: scan.id },
        { status: 500 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const status = message === "Niet geauthenticeerd" ? 401 : 400;
    return NextResponse.json({ fout: message }, { status });
  }
}
