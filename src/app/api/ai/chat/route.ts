import { NextRequest } from "next/server";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  aiGesprekken,
  facturen,
  tijdregistraties,
  projecten,
  klanten,
  leads,
  taken,
  screenTimeEntries,
} from "@/lib/db/schema";
import { eq, and, gte, sql, desc, ne } from "drizzle-orm";

interface Bericht {
  rol: "gebruiker" | "assistent";
  inhoud: string;
  timestamp: string;
}

function getMonthRange(): { van: string; tot: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { van: firstDay.toISOString(), tot: lastDay.toISOString() };
}

async function gatherBusinessContext(gebruikerId: number): Promise<string> {
  const { van, tot } = getMonthRange();

  // Revenue this month (betaald facturen)
  const omzetResult = await db
    .select({ totaal: sql<number>`COALESCE(SUM(${facturen.bedragInclBtw}), 0)` })
    .from(facturen)
    .where(
      and(
        eq(facturen.status, "betaald"),
        gte(facturen.betaaldOp, van),
      )
    )
    .get();

  const omzet = omzetResult?.totaal ?? 0;

  // Hours this month
  const urenResult = await db
    .select({ totaal: sql<number>`COALESCE(SUM(${tijdregistraties.duurMinuten}), 0)` })
    .from(tijdregistraties)
    .where(gte(tijdregistraties.startTijd, van))
    .get();

  const urenMinuten = urenResult?.totaal ?? 0;
  const uren = Math.round((urenMinuten / 60) * 10) / 10;

  // Active projects
  const actieveProjecten = await db
    .select({
      naam: projecten.naam,
      klantNaam: klanten.bedrijfsnaam,
      status: projecten.status,
      voortgang: projecten.voortgangPercentage,
    })
    .from(projecten)
    .leftJoin(klanten, eq(projecten.klantId, klanten.id))
    .where(and(eq(projecten.status, "actief"), eq(projecten.isActief, 1)))
    .all();

  // Open facturen
  const openFacturen = await db
    .select({
      factuurnummer: facturen.factuurnummer,
      bedrag: facturen.bedragInclBtw,
      status: facturen.status,
      klantNaam: klanten.bedrijfsnaam,
    })
    .from(facturen)
    .leftJoin(klanten, eq(facturen.klantId, klanten.id))
    .where(
      and(
        ne(facturen.status, "betaald"),
        eq(facturen.isActief, 1),
      )
    )
    .all();

  const openFacturenWaarde = openFacturen.reduce((sum: number, f: { bedrag: number | null }) => sum + (f.bedrag ?? 0), 0);

  // Leads pipeline
  const leadsData = await db
    .select({
      status: leads.status,
      count: sql<number>`COUNT(*)`,
      waarde: sql<number>`COALESCE(SUM(${leads.waarde}), 0)`,
    })
    .from(leads)
    .where(eq(leads.isActief, 1))
    .groupBy(leads.status)
    .all();

  const leadsSamenvatting = leadsData
    .map((l: { status: string | null; count: number; waarde: number }) => `${l.status}: ${l.count} (€${Math.round(l.waarde)})`)
    .join(", ");

  // Recent time entries
  const recenteTijden = await db
    .select({
      omschrijving: tijdregistraties.omschrijving,
      duur: tijdregistraties.duurMinuten,
      datum: tijdregistraties.startTijd,
      projectNaam: projecten.naam,
    })
    .from(tijdregistraties)
    .leftJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
    .orderBy(desc(tijdregistraties.startTijd))
    .limit(5)
    .all();

  const recenteTijdenTekst = recenteTijden
    .map((t: { omschrijving: string | null; duur: number | null; datum: string | null; projectNaam: string | null }) => {
      const duur = t.duur ? `${Math.round(t.duur / 60 * 10) / 10}u` : "lopend";
      return `- ${t.projectNaam ?? "Geen project"}: ${t.omschrijving ?? "Geen omschrijving"} (${duur})`;
    })
    .join("\n");

  // Klanten with active projects
  const klantenData = await db
    .select({
      bedrijfsnaam: klanten.bedrijfsnaam,
      actieveProjecten: sql<number>`(SELECT COUNT(*) FROM projecten WHERE klant_id = ${klanten.id} AND status = 'actief' AND is_actief = 1)`,
    })
    .from(klanten)
    .where(eq(klanten.isActief, 1))
    .all();

  const klantenTekst = klantenData
    .map((k: { bedrijfsnaam: string; actieveProjecten: number }) => `- ${k.bedrijfsnaam} (${k.actieveProjecten} actieve projecten)`)
    .join("\n");

  // Open taken
  const openTaken = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(taken)
    .where(ne(taken.status, "afgerond"))
    .get();

  const projectenTekst = actieveProjecten
    .map((p: { naam: string; klantNaam: string | null; voortgang: number | null }) => `- ${p.naam} (${p.klantNaam ?? "Intern"}, ${p.voortgang ?? 0}% klaar)`)
    .join("\n");

  const openFacturenTekst = openFacturen
    .map((f: { factuurnummer: string; klantNaam: string | null; bedrag: number | null; status: string | null }) => `- ${f.factuurnummer} — ${f.klantNaam ?? "Onbekend"}: €${Math.round(f.bedrag ?? 0)} (${f.status})`)
    .join("\n");

  // Screen time vandaag
  const vandaag = new Date().toISOString().split("T")[0];
  const screenTimeSamenvatting = await db
    .select({
      categorie: screenTimeEntries.categorie,
      totaal: sql<number>`SUM(duur_seconden)`,
    })
    .from(screenTimeEntries)
    .where(
      and(
        eq(screenTimeEntries.gebruikerId, gebruikerId),
        gte(screenTimeEntries.startTijd, `${vandaag}T00:00:00`)
      )
    )
    .groupBy(screenTimeEntries.categorie)
    .all();

  const topAppsVandaag = await db
    .select({
      app: screenTimeEntries.app,
      totaal: sql<number>`SUM(duur_seconden)`,
    })
    .from(screenTimeEntries)
    .where(
      and(
        eq(screenTimeEntries.gebruikerId, gebruikerId),
        gte(screenTimeEntries.startTijd, `${vandaag}T00:00:00`)
      )
    )
    .groupBy(screenTimeEntries.app)
    .orderBy(sql`SUM(duur_seconden) DESC`)
    .limit(5)
    .all();

  return `Je bent de AI-assistent van Autronis, een AI- en automatiseringsbureau opgericht door Sem en Syb.
Je helpt hen met bedrijfsinzichten op basis van actuele data uit hun dashboard.

Huidige bedrijfsdata (${new Date().toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}):

📊 FINANCIEEL
- Omzet deze maand (betaald): €${Math.round(omzet * 100) / 100}
- Openstaande facturen: ${openFacturen.length} stuks (€${Math.round(openFacturenWaarde)})
${openFacturenTekst ? `Details:\n${openFacturenTekst}` : ""}

⏱️ UREN
- Geregistreerde uren deze maand: ${uren} uur
- Recente tijdregistraties:
${recenteTijdenTekst || "  Geen recente registraties"}

📋 PROJECTEN
- Actieve projecten: ${actieveProjecten.length}
${projectenTekst || "  Geen actieve projecten"}

✅ TAKEN
- Openstaande taken: ${openTaken?.count ?? 0}

🎯 LEADS PIPELINE
${leadsSamenvatting || "Geen actieve leads"}

👥 KLANTEN
${klantenTekst || "Geen actieve klanten"}

🖥️ SCREEN TIME VANDAAG
${screenTimeSamenvatting.map((s: { categorie: string | null; totaal: number }) => `- ${s.categorie ?? "overig"}: ${Math.round(s.totaal / 60)} minuten`).join("\n") || "Geen data"}

Top apps vandaag:
${topAppsVandaag.map((a: { app: string; totaal: number }) => `- ${a.app}: ${Math.round(a.totaal / 60)} minuten`).join("\n") || "Geen data"}

Regels:
- Antwoord altijd in het Nederlands
- Wees beknopt en actionable
- Gebruik getallen en data uit de context hierboven
- Als je iets niet weet uit de data, zeg dat eerlijk
- Geef concrete suggesties en actiepunten waar mogelijk
- Formatteer bedragen altijd met € teken`;
}

export async function POST(request: NextRequest) {
  try {
    const gebruiker = await requireAuth();

    const body = await request.json() as { gesprekId?: number; bericht: string };
    const { gesprekId, bericht } = body;

    if (!bericht || typeof bericht !== "string" || bericht.trim().length === 0) {
      return Response.json({ fout: "Bericht is verplicht" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { fout: "ANTHROPIC_API_KEY is niet geconfigureerd. Voeg deze toe aan je environment variabelen." },
        { status: 500 }
      );
    }

    const client = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Get or create conversation
    let currentGesprekId = gesprekId;
    let bestaandeBerichten: Bericht[] = [];

    if (currentGesprekId) {
      const gesprek = await db
        .select()
        .from(aiGesprekken)
        .where(
          and(
            eq(aiGesprekken.id, currentGesprekId),
            eq(aiGesprekken.gebruikerId, gebruiker.id),
          )
        )
        .get();

      if (!gesprek) {
        return Response.json({ fout: "Gesprek niet gevonden" }, { status: 404 });
      }

      bestaandeBerichten = JSON.parse(gesprek.berichten ?? "[]") as Bericht[];
    } else {
      // Create new conversation
      const result = await db
        .insert(aiGesprekken)
        .values({
          gebruikerId: gebruiker.id,
          titel: bericht.slice(0, 80),
          berichten: "[]",
        })
        .returning()
        .get();

      currentGesprekId = result.id;
    }

    // Add user message
    const userBericht: Bericht = {
      rol: "gebruiker",
      inhoud: bericht,
      timestamp: new Date().toISOString(),
    };
    bestaandeBerichten.push(userBericht);

    // Build message history for Anthropic
    const anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> =
      bestaandeBerichten.map((b) => ({
        role: b.rol === "gebruiker" ? "user" as const : "assistant" as const,
        content: b.inhoud,
      }));

    // Gather business context
    const systemPrompt = await gatherBusinessContext(gebruiker.id);

    // Stream response
    const encoder = new TextEncoder();
    const finalGesprekId = currentGesprekId;

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";

        try {
          const messageStream = client.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2048,
            system: systemPrompt,
            messages: anthropicMessages,
          });

          messageStream.on("text", (text) => {
            fullResponse += text;
            const chunk = `data: ${JSON.stringify({ tekst: text })}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          });

          await messageStream.finalMessage();

          // Save conversation
          const assistentBericht: Bericht = {
            rol: "assistent",
            inhoud: fullResponse,
            timestamp: new Date().toISOString(),
          };
          bestaandeBerichten.push(assistentBericht);

          await db.update(aiGesprekken)
            .set({
              berichten: JSON.stringify(bestaandeBerichten),
              bijgewerktOp: new Date().toISOString(),
            })
            .where(eq(aiGesprekken.id, finalGesprekId))
            .run();

          // Send completion event
          const doneChunk = `data: ${JSON.stringify({ klaar: true, gesprekId: finalGesprekId })}\n\n`;
          controller.enqueue(encoder.encode(doneChunk));
          controller.close();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Onbekende fout bij AI verwerking";
          const errorChunk = `data: ${JSON.stringify({ fout: errorMessage })}\n\n`;
          controller.enqueue(encoder.encode(errorChunk));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return Response.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }
}
