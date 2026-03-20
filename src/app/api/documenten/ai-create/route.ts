import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { klanten, projecten } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createNotionDocument } from "@/lib/notion";
import { DocumentType, DocumentPayload } from "@/types/documenten";
import Anthropic from "@anthropic-ai/sdk";
import { AUTRONIS_CONTEXT } from "@/lib/ai/autronis-context";

interface AiCreateResult {
  type: DocumentType;
  titel: string;
  content: string;
  samenvatting: string;
  klantId?: number;
  projectId?: number;
  klantNaam?: string;
  projectNaam?: string;
}

export async function POST(request: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { prompt } = (await request.json()) as { prompt: string };

    if (!prompt || prompt.trim().length < 5) {
      return NextResponse.json({ fout: "Beschrijf wat voor document je wilt maken" }, { status: 400 });
    }

    // Fetch klanten en projecten voor context
    const alleKlanten = await db
      .select({ id: klanten.id, bedrijfsnaam: klanten.bedrijfsnaam })
      .from(klanten)
      .where(eq(klanten.isActief, 1))
      .all();

    const alleProjecten = await db
      .select({ id: projecten.id, naam: projecten.naam, klantId: projecten.klantId })
      .from(projecten)
      .where(eq(projecten.isActief, 1))
      .all();

    const klantenLijst = alleKlanten.map((k) => `- ${k.bedrijfsnaam} (id: ${k.id})`).join("\n");
    const projectenLijst = alleProjecten.map((p) => {
      const klant = alleKlanten.find((k) => k.id === p.klantId);
      return `- ${p.naam} (id: ${p.id}${klant ? `, klant: ${klant.bedrijfsnaam}` : ""})`;
    }).join("\n");

    const client = new Anthropic();

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: `${AUTRONIS_CONTEXT}

Je bent een documentgenerator. De gebruiker beschrijft in vrije tekst wat voor document hij wil. Jij:
1. Bepaalt het juiste document type
2. Koppelt het aan de juiste klant/project als dat uit de prompt blijkt
3. Genereert het volledige document

Beschikbare document types:
- contract: Voor contracten, overeenkomsten, SLA's
- klantdocument: Voor offertes, rapporten, klantgerichte documenten
- intern: Voor handleidingen, interne processen, documentatie
- belangrijke-info: Voor cruciale informatie, credentials, belangrijke afspraken
- plan: Voor projectplannen, roadmaps, strategische plannen
- notitie: Voor meeting notities, brainstorms, losse aantekeningen

Beschikbare klanten:
${klantenLijst || "Geen klanten gevonden"}

Beschikbare projecten:
${projectenLijst || "Geen projecten gevonden"}

Antwoord ALTIJD in dit exacte JSON formaat (geen markdown codeblocks, puur JSON):
{
  "type": "een van de 6 types hierboven",
  "titel": "passende titel voor het document",
  "content": "het volledige document met koppen en structuur",
  "samenvatting": "samenvatting van max 2 zinnen",
  "klantId": null of het klant ID als je een klant herkent,
  "projectId": null of het project ID als je een project herkent
}

Schrijf altijd in het Nederlands.`,
      messages: [
        { role: "user", content: prompt },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    let parsed: AiCreateResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Geen JSON gevonden in AI response");
      parsed = JSON.parse(jsonMatch[0]) as AiCreateResult;
    } catch {
      return NextResponse.json({ fout: "AI kon geen geldig document genereren. Probeer het opnieuw." }, { status: 500 });
    }

    // Resolve klant/project namen
    let klantNaam: string | undefined;
    let projectNaam: string | undefined;

    if (parsed.klantId) {
      const klant = alleKlanten.find((k) => k.id === parsed.klantId);
      klantNaam = klant?.bedrijfsnaam;
    }
    if (parsed.projectId) {
      const project = alleProjecten.find((p) => p.id === parsed.projectId);
      projectNaam = project?.naam;
    }

    // Build payload based on type
    const payloadBase = { titel: parsed.titel, content: parsed.content };
    let payload: DocumentPayload;

    switch (parsed.type) {
      case "contract":
        payload = { ...payloadBase, type: "contract", status: "concept", klantId: parsed.klantId, projectId: parsed.projectId };
        break;
      case "klantdocument":
        payload = { ...payloadBase, type: "klantdocument", subtype: "overig", klantId: parsed.klantId, projectId: parsed.projectId };
        break;
      case "intern":
        payload = { ...payloadBase, type: "intern", categorie: "overig" };
        break;
      case "belangrijke-info":
        payload = { ...payloadBase, type: "belangrijke-info", urgentie: "normaal", gerelateerdAan: parsed.klantId ? "klant" : "intern", klantId: parsed.klantId, projectId: parsed.projectId };
        break;
      case "plan":
        payload = { ...payloadBase, type: "plan", status: "concept", klantId: parsed.klantId, projectId: parsed.projectId };
        break;
      case "notitie":
        payload = { ...payloadBase, type: "notitie", subtype: "overig", klantId: parsed.klantId, projectId: parsed.projectId, datum: new Date().toISOString().split("T")[0] };
        break;
      default:
        payload = { ...payloadBase, type: "notitie", subtype: "overig" };
    }

    const result = await createNotionDocument(
      payload,
      parsed.samenvatting,
      gebruiker.naam,
      klantNaam,
      projectNaam
    );

    return NextResponse.json({
      document: {
        ...result,
        type: parsed.type,
        titel: parsed.titel,
        samenvatting: parsed.samenvatting,
        klantNaam,
        projectNaam,
        content: parsed.content,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon AI document niet aanmaken" },
      { status: 500 }
    );
  }
}
