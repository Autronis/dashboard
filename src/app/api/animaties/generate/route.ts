import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function scrapeUrl(url: string): Promise<string> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });

  if (!res.ok) throw new Error(`Firecrawl error: ${res.status}`);
  const data = await res.json() as { success: boolean; data?: { markdown?: string } };
  if (!data.success || !data.data?.markdown) throw new Error("Geen content gevonden");
  return data.data.markdown.slice(0, 6000);
}

const SYSTEM_PROMPT = `Je bent een expert in het schrijven van AI image en video prompts voor scroll-stopping content.

Je genereert altijd precies 3 prompts als JSON:
- promptA: clean assembled product shot, pure white background, studio lighting, 16:9, photorealistic
- promptB: exploded/deconstructed view, alle componenten zwevend, zelfde witte achtergrond, 16:9
- promptC: video transitie van assembled naar deconstructed, 5 seconden, 16:9

Gebruik de product informatie om hyper-specifieke details toe te voegen (materialen, kleuren, exacte onderdelen).

Geef ALLEEN een JSON object terug met de velden: promptA, promptB, promptC, objectNaam, tabANaam, tabBNaam.
Geen markdown, geen uitleg, puur JSON.`;

export async function POST(req: NextRequest) {
  const { url, product } = await req.json() as { url?: string; product?: string };

  let context = "";
  let bronLabel = product ?? "";

  if (url) {
    try {
      const scraped = await scrapeUrl(url);
      context = `Website content:\n${scraped}`;
      bronLabel = url;
    } catch {
      return NextResponse.json({ error: "Kon URL niet scrapen. Probeer een productnaam." }, { status: 400 });
    }
  } else if (product) {
    context = `Product: ${product}`;
  } else {
    return NextResponse.json({ error: "Geef een URL of productnaam op." }, { status: 400 });
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Genereer 3 scroll-stop prompts voor Higgsfield Nano Banana 2 op basis van:\n\n${context}`,
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "Geen geldige prompts gegenereerd." }, { status: 500 });

  const prompts = JSON.parse(jsonMatch[0]) as {
    promptA: string;
    promptB: string;
    promptC: string;
    objectNaam: string;
    tabANaam: string;
    tabBNaam: string;
  };

  return NextResponse.json({ ...prompts, bron: bronLabel });
}
