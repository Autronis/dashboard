import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/auth";
import { getSupabaseLeads } from "@/lib/supabase-leads";

interface Body {
  leadId?: string;
  websitePrompt?: string;
  extraContext?: string;
}

interface WebsiteLeadRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  category: string | null;
  description: string | null;
  website_url: string | null;
  search_query: string | null;
  rating: number | null;
  reviews_count: number | null;
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = (await req.json()) as Body;
    if (!body.leadId) {
      return NextResponse.json({ fout: "leadId is verplicht" }, { status: 400 });
    }

    const supabase = getSupabaseLeads();
    const { data, error } = await supabase
      .from("website_leads")
      .select(
        "id,name,email,phone,city,category,description,website_url,search_query,rating,reviews_count",
      )
      .eq("id", body.leadId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { fout: `Lead niet gevonden: ${error?.message ?? "geen data"}` },
        { status: 404 },
      );
    }

    const lead = data as WebsiteLeadRow;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { fout: "ANTHROPIC_API_KEY niet geconfigureerd" },
        { status: 500 },
      );
    }

    const anthropic = new Anthropic({ apiKey });

    const facts: string[] = [];
    if (lead.name) facts.push(`Bedrijfsnaam: ${lead.name}`);
    if (lead.category) facts.push(`Categorie: ${lead.category}`);
    if (lead.description) facts.push(`Omschrijving: ${lead.description}`);
    if (lead.city) facts.push(`Locatie: ${lead.city}`);
    if (lead.rating && lead.reviews_count)
      facts.push(`Google rating: ${lead.rating}/5 (${lead.reviews_count} reviews)`);
    if (lead.website_url) facts.push(`Bestaande website: ${lead.website_url}`);
    else facts.push(`Bestaande website: geen / onbekend`);
    if (lead.search_query) facts.push(`Gevonden via zoekopdracht: ${lead.search_query}`);
    if (body.extraContext?.trim()) facts.push(`Extra context: ${body.extraContext.trim()}`);

    const promptContext = body.websitePrompt
      ? `\n\nWij hebben al een concept-website uitgewerkt voor dit bedrijf (dit is het concept dat wij intern hebben — NIET letterlijk in de mail zetten, alleen gebruiken om concrete haakjes te noemen):\n---\n${body.websitePrompt}\n---`
      : "";

    const systemPrompt = `Je bent Sem van Autronis. Je schrijft koude outreach mails aan lokale MKB-bedrijven die (nog) geen moderne website hebben of duidelijk een nieuwe site kunnen gebruiken.

De mails die jij schrijft:
- Zijn in het Nederlands
- Zijn persoonlijk, direct, warm — geen corporate bla, geen "I hope this email finds you well"
- Openen met een specifieke observatie over het bedrijf (iets concreets uit hun info)
- Stellen voor om een nieuwe website te bouwen met een moderne, snelle aanpak
- Vragen om een kort telefoontje (15 minuten) om hun thema, kleuren, stijl en voorkeuren te bespreken
- Zijn kort: max 120 woorden
- Geen signature toevoegen — die wordt automatisch toegevoegd bij verzending
- Geen "Kind regards" of "Met vriendelijke groet" — dat zit ook al in de signature

Output: JSON met twee velden:
{
  "subject": "...",
  "body": "...volledige mail-body als string met \\n voor nieuwe regels..."
}

Alleen pure JSON, geen markdown fences, geen uitleg.`;

    const userPrompt = `Schrijf een pitch-mail voor een nieuwe website voor dit bedrijf:

${facts.join("\n")}
${promptContext}

De mail eindigt met een concrete vraag om een korte call om hun voorkeuren (thema, kleuren, stijl, content) door te nemen.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    let parsed: { subject?: string; body?: string } = {};
    try {
      const clean = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { fout: "Kon AI output niet parsen als JSON", raw: text },
        { status: 500 },
      );
    }

    return NextResponse.json({
      subject: parsed.subject ?? "",
      body: parsed.body ?? "",
      recipientEmail: lead.email,
      leadName: lead.name,
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
