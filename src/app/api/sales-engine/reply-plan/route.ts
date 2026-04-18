import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { salesEngineScans, salesEngineKansen } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

interface Body {
  leadName: string;
  website?: string | null;
  supabaseLeadId?: string | null;
  originalSubject: string | null;
  originalBody: string | null;
  replySubject: string | null;
  replyBody: string;
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = (await req.json()) as Body;

    if (!body.replyBody?.trim()) {
      return NextResponse.json({ fout: "replyBody is verplicht" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { fout: "ANTHROPIC_API_KEY niet geconfigureerd" },
        { status: 500 },
      );
    }

    // Zoek bestaande scan voor deze lead om kansen mee te geven aan Claude
    let kansenContext = "";
    if (body.supabaseLeadId) {
      const scan = await db
        .select()
        .from(salesEngineScans)
        .where(eq(salesEngineScans.supabaseLeadId, body.supabaseLeadId))
        .orderBy(desc(salesEngineScans.aangemaaktOp))
        .limit(1)
        .get();

      if (scan && scan.status === "completed") {
        const kansen = await db
          .select()
          .from(salesEngineKansen)
          .where(eq(salesEngineKansen.scanId, scan.id))
          .all();

        if (kansen.length > 0) {
          kansenContext = `\n\nWe hebben al een Sales Engine scan gedaan van ${body.website}. De top kansen:\n${kansen
            .slice(0, 5)
            .map(
              (k, i) =>
                `${i + 1}. ${k.titel} — impact: ${k.impact}, tijdsbesparing: ${k.geschatteTijdsbesparing || "n.v.t."}${k.geschatteBesparing ? `, besparing: €${k.geschatteBesparing}/maand` : ""}`,
            )
            .join("\n")}\n\nAutomation readiness score: ${scan.automationReadinessScore}/10. Aanbevolen pakket: ${scan.aanbevolenPakket || "n.v.t."}.`;
        }
      }
    }

    const anthropic = new Anthropic({ apiKey });

    const systemPrompt = `Je bent een B2B sales expert voor Autronis — een bureau dat bedrijven helpt met AI-automatiseringen en moderne websites. Je schrijft persoonlijke, menselijke antwoord-mails op inkomende replies van cold outreach.

Jouw antwoord-mails:
- Zijn in het Nederlands (tenzij de reply in het Engels is)
- Zijn persoonlijk en warm, geen corporate bla
- Reageren concreet op wat ze hebben gezegd
- Koppelen hun reactie aan een concrete volgende stap (call, demo, korte analyse)
- Zijn kort: max 150 woorden
- Geen "I hope this email finds you well" openingen
- Als ze nee zeggen: elegant afsluiten, deur open laten
- Als ze meer info willen: relevante kansen noemen die uit de Sales Engine scan kwamen (als die er zijn)

Output format: JSON object met twee keys:
{
  "antwoordMail": "...de volledige antwoord-mail als string met \\n newlines...",
  "plan": [
    "Stap 1: ...",
    "Stap 2: ...",
    "Stap 3: ..."
  ]
}

Plan moet 2-5 concrete stappen zijn die Sem na het sturen van de antwoord-mail zou moeten doen (bijv. calendar-link sturen, Loom opname maken, pakket prijs opzoeken).

Alleen pure JSON, geen markdown code blocks, geen uitleg.`;

    const userPrompt = `Cold mail die wij stuurden:
Onderwerp: ${body.originalSubject ?? "—"}

${body.originalBody ?? "—"}

---

Antwoord van ${body.leadName}:
Onderwerp: ${body.replySubject ?? "—"}

${body.replyBody}
${kansenContext}

Schrijf nu de beste antwoord-mail + een kort plan voor opvolging.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    let parsed: { antwoordMail?: string; plan?: string[] } = {};
    try {
      // strip possible markdown fence
      const clean = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
      parsed = JSON.parse(clean);
    } catch {
      // Fall back: return raw text as antwoordMail, empty plan
      parsed = { antwoordMail: text, plan: [] };
    }

    return NextResponse.json({
      antwoordMail: parsed.antwoordMail ?? "",
      plan: Array.isArray(parsed.plan) ? parsed.plan : [],
      hasScanContext: kansenContext.length > 0,
      tokensGebruikt: response.usage.input_tokens + response.usage.output_tokens,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 },
    );
  }
}
