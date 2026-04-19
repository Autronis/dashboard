import { NextRequest, NextResponse } from "next/server";
import { TrackedAnthropic } from "@/lib/ai/tracked-anthropic";
import { requireAuth } from "@/lib/auth";
import { getSupabaseLeads } from "@/lib/supabase-leads";

interface Body {
  leadId?: string;
  extraContext?: string;
}

interface WebsiteLeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  category: string | null;
  description: string | null;
  rating: number | null;
  reviews_count: number | null;
  search_query: string | null;
  website_url: string | null;
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
        "id,name,phone,email,address,city,postal_code,category,description,rating,reviews_count,search_query,website_url",
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
        { fout: "ANTHROPIC_API_KEY is niet geconfigureerd" },
        { status: 500 },
      );
    }

    const anthropic = TrackedAnthropic({ apiKey }, "/api/leads/website-leads/generate-prompt");

    const facts: string[] = [];
    if (lead.name) facts.push(`Bedrijfsnaam: ${lead.name}`);
    if (lead.category) facts.push(`Categorie: ${lead.category}`);
    if (lead.description) facts.push(`Omschrijving: ${lead.description}`);
    if (lead.search_query) facts.push(`Zoekopdracht waarmee ze zijn gevonden: ${lead.search_query}`);
    if (lead.city) facts.push(`Locatie: ${lead.city}${lead.postal_code ? ` (${lead.postal_code})` : ""}`);
    if (lead.rating && lead.reviews_count)
      facts.push(`Google rating: ${lead.rating}/5 (${lead.reviews_count} reviews)`);
    if (lead.phone) facts.push(`Telefoon: ${lead.phone}`);
    if (lead.email) facts.push(`Email: ${lead.email}`);
    if (lead.address) facts.push(`Adres: ${lead.address}`);
    if (lead.website_url) facts.push(`Bestaande website (voor context): ${lead.website_url}`);
    if (body.extraContext?.trim()) facts.push(`Extra context van Sem: ${body.extraContext.trim()}`);

    const systemPrompt = `Je bent een expert website-strateeg voor Autronis — een bureau dat snelle, moderne zakelijke websites bouwt (via Lovable / v0). Je schrijft prompts die direct in een AI website-builder gebruikt kunnen worden om een complete homepage + 3-5 sub-pagina's te genereren.

De prompts die jij schrijft:
- Zijn in het Nederlands
- Bevatten een duidelijke USP / positionering voor dit specifieke bedrijf
- Specificeren sectie-voor-sectie wat de homepage moet tonen (hero, services, over ons, reviews, contact)
- Noemen de tone of voice (professioneel/warm/technisch/speels — passend bij de branche)
- Suggereren kleuren + visuele stijl op basis van de branche
- Noemen specifieke call-to-actions per sectie
- Zijn concreet en uitvoerbaar — geen generieke marketing-taal

Output format: pure prompt-tekst, klaar om te kopiëren-plakken in Lovable. Geen meta-commentaar, geen "Here is the prompt:" prefix. Begin direct met de prompt zelf.`;

    const userPrompt = `Genereer een website-builder prompt voor dit bedrijf:

${facts.join("\n")}

De prompt moet leiden tot een complete, moderne zakelijke website (homepage + over-ons + diensten + reviews + contact) die past bij hun categorie en locatie. Als er weinig info is, gebruik je branche-kennis om aannames te maken — zolang ze plausibel zijn voor dit type bedrijf.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const promptText = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    return NextResponse.json({
      prompt: promptText,
      bedrijfsnaam: lead.name,
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
