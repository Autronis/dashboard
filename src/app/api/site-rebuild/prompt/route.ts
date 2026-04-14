import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { scrapeUrl } from "@/lib/firecrawl";

// POST /api/site-rebuild/prompt
// Same body shape as /generate, but instead of calling Claude the endpoint
// returns a single assembled prompt string that the user can paste into
// claude.ai for iterative / extended-thinking work with artifacts.
// Response: { prompt: string, source: { kind, url?, title? } }
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const mode: "url" | "logo" = body?.mode;
    const url: string | undefined = body?.url;
    const brandName: string = (body?.brandName ?? "").trim();
    const accentRaw: string = typeof body?.accent === "string" ? body.accent.trim() : "";
    const accent: string = accentRaw || "AUTO"; // "AUTO" = Claude kiest een passende accent kleur
    const notes: string = typeof body?.notes === "string" ? body.notes.trim() : "";

    if (!brandName) {
      return NextResponse.json({ fout: "Brand naam is verplicht" }, { status: 400 });
    }
    if (mode !== "url" && mode !== "logo") {
      return NextResponse.json({ fout: "mode moet 'url' of 'logo' zijn" }, { status: 400 });
    }

    let sourceBlock = "";
    let sourceUrl: string | undefined;
    let sourceTitle: string | null = null;

    if (mode === "url") {
      if (!url?.trim()) {
        return NextResponse.json({ fout: "URL is verplicht bij mode=url" }, { status: 400 });
      }
      const scraped = await scrapeUrl(url.trim(), 15000);
      sourceUrl = scraped.url;
      sourceTitle = scraped.title;
      sourceBlock = `## Huidige website content (Firecrawl markdown van ${scraped.url})

${scraped.markdown}`;
    } else {
      sourceBlock = `## Geen bestaande website

Er is nog geen website. Gebruik alleen brand naam + onderstaande notes + jouw eigen interpretatie.
Bij onbekende features / specs / testimonials: honest placeholders gebruiken, niet verzinnen.`;
    }

    const prompt = `Je bent senior frontend designer bij Autronis, een studio die premium landing pages bouwt voor product- en tech-bedrijven.

Jouw opdracht: upgrade bestaande klant-content tot een jaw-dropping **dark premium landing page** die direct klaar is om live te zetten.

## Design system (verplicht)

- Jet-black achtergrond \`#0a0a0b\` met subtiele ambient glows
- Display headlines in **Space Grotesk** (clamp(3rem, 8vw, 7rem))
- Body in **Inter**
- Één accent kleur, spaarzaam gebruikt voor CTAs, onderlijnen, key numbers, hovers${accent === "AUTO" ? " — **kies er zelf één** die past bij de content/industrie van de bron (bv. tech → teal/cyaan, food → warm oranje, fashion → koper, healthcare → soft groen)" : `: **${accent}**`}
- Genereuze whitespace, 8pt grid, geen clutter
- Section flow: hero → proof bar → features (3-col) → specs (count-up numbers) → testimonial (als data beschikbaar) → CTA
- Geen stock photos. Gebruik CSS gradients, geometrische vormen, emoji, of svg glyphs
- Fully responsive via Tailwind utility classes
- Tenminste één CTA-knop die glow'd on hover

## Brand

- **Brand naam**: ${brandName}
- **Accent**: ${accent === "AUTO" ? "automatisch kiezen" : accent}
- **Extra instructies van de gebruiker**: ${notes || "(geen)"}

${sourceBlock}

## Wat ik van je wil

Lever **één Next.js 15 + Tailwind landing page** (artifact). Gebruik alleen Tailwind utility classes. Gebruik ECHTE copy uit de bovenstaande bron — herschrijf 'm voor punch maar verzin geen features/specs/testimonials die er niet staan.

Gebruik Claude artifacts zodat ik 'm live kan previewen en daarna kan itereren ("maak 'm bolder", "voeg pricing toe", "meer animatie", etc).

Als je iets niet weet: honest placeholder ("Coming soon", "tbd") of laat de sectie weg.`;

    return NextResponse.json({
      prompt,
      source: { kind: mode, url: sourceUrl, title: sourceTitle },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: msg },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500,
      }
    );
  }
}
