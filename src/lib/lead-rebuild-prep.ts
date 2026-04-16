// Per-lead prep pipeline for the `/leads/rebuild-prep` batch tool.
//
// Two modes per lead, automatically routed on lead.website:
//
//   (A) No website on file → SERP check via Firecrawl /v1/search to verify the
//       lead really has no site, then "from scratch" pitch prompt.
//   (B) Has website on file → Firecrawl /v1/scrape the existing site, inline
//       its markdown into the prompt, then "upgrade this site" prompt.
//
// Sector-fit classification (scroll_stop vs static_upgrade) runs for both modes.

import { scrapePage, ScrapeError, type ScrapeSource } from "./scraper";
import { classifyFit, type FitResult } from "./lead-rebuild-fit";
import { getSupabaseLeads } from "./supabase-leads";

export type SybSerpData = {
  hasWebsite: boolean | null;
  websiteUrl: string | null;
  confidence: string | null;
};

export type PrepLeadInput = {
  id: string;
  name: string | null;
  website: string | null;
  location: string | null;
  address: string | null;
  category: string | null;
  sybSerp?: SybSerpData | null;
};

export type SerpCheck = {
  ran: boolean;
  verdict: "site_found" | "no_site" | "skipped" | "error";
  foundUrl: string | null;
  candidates: { url: string; title: string }[];
  note: string;
};

export type SiteScrape = {
  ran: boolean;
  url: string | null;
  title: string | null;
  markdown: string | null;
  error: string | null;
  source: ScrapeSource | null;
};

export type PrepMode = "upgrade" | "fresh";

export type PrepLeadResult = {
  lead: PrepLeadInput;
  mode: PrepMode;
  serp: SerpCheck;
  scrape: SiteScrape;
  fit: FitResult;
  prompt: string;
};


const DESIGN_SYSTEM_BLOCK = `## Design system (verplicht)

- Jet-black achtergrond \`#0a0a0b\` met subtiele ambient glows
- Display headlines in **Space Grotesk** (clamp(3rem, 8vw, 7rem))
- Body in **Inter**
- Één accent kleur, spaarzaam gebruikt voor CTAs, onderlijnen, key numbers, hovers — **kies er zelf één** die past bij de content/industrie (bv. tech → teal/cyaan, food → warm oranje, fashion → koper, healthcare → soft groen)
- Genereuze whitespace, 8pt grid, geen clutter
- Section flow: hero → proof bar → features (3-col) → specs / numbers → testimonial (als plausibel) → CTA
- Geen stock photos. Gebruik CSS gradients, geometrische vormen, emoji, of svg glyphs
- Fully responsive via Tailwind utility classes
- Tenminste één CTA-knop die glow'd on hover`;

function fitLineFor(fit: FitResult): string {
  if (fit.verdict === "scroll_stop_good") {
    return `Sector-fit: **${fit.label}** ✅ — Dit is een fysiek product. **Overweeg een scroll-stop hero animatie** (exploded product view, scroll-driven reveal) als centrale wow-factor.`;
  }
  if (fit.verdict === "static_upgrade") {
    return `Sector-fit: **${fit.label}** — Dienstverlening, **geen scroll-stop animatie**. Bouw een dark premium statische site met sterke typografie en witruimte.`;
  }
  return `Sector-fit: **${fit.label}** — ${fit.reason}. Schat zelf in of scroll-stop past.`;
}

export function buildFreshPrompt(input: {
  name: string;
  location: string | null;
  category: string | null;
  fit: FitResult;
  serp: SerpCheck;
}): string {
  const { name, location, category, fit, serp } = input;

  const verdictLine =
    serp.verdict === "site_found" && serp.foundUrl
      ? `⚠️ SERP-check vond mogelijk een bestaande site: ${serp.foundUrl}. Check eerst of het echt van ${name} is voor je begint.`
      : serp.verdict === "no_site"
        ? `SERP-check bevestigt: geen bestaande site gevonden. Bouw from-scratch.`
        : serp.verdict === "error"
          ? `SERP-check faalde (${serp.note}). Ga uit van geen bestaande site.`
          : `SERP-check overgeslagen.`;

  return `Je bent senior frontend designer bij Autronis, een studio die premium landing pages bouwt voor product- en tech-bedrijven.

Jouw opdracht: bouw een jaw-dropping **dark premium landing page** voor een nieuwe lead uit onze database, klaar om aan de klant te laten zien als pitch.

${DESIGN_SYSTEM_BLOCK}

## Lead context

- **Bedrijfsnaam**: ${name}
- **Locatie**: ${location || "(onbekend)"}
- **Categorie (Google Maps)**: ${category || "(onbekend)"}
- ${fitLineFor(fit)}
- ${verdictLine}

## Wat ik van je wil

Lever **één Next.js 15 + Tailwind landing page** (artifact). Gebruik alleen Tailwind utility classes.

**Geen bestaande content beschikbaar** — dit is een cold lead. Verzin GEEN features, specs, testimonials of claims die je niet kan onderbouwen vanuit de categorie + locatie. Gebruik honest placeholders ("Coming soon", "Jouw USP hier", "Testimonial plek") waar data ontbreekt. De pitch is: "dit is hoe jullie site eruit kan zien" — niet "dit is jullie nieuwe site".

Gebruik Claude artifacts zodat ik 'm live kan previewen en daarna kan itereren ("maak 'm bolder", "voeg pricing toe", "meer animatie", etc).`;
}

export function buildUpgradePrompt(input: {
  name: string;
  location: string | null;
  category: string | null;
  fit: FitResult;
  scrape: SiteScrape;
}): string {
  const { name, location, category, fit, scrape } = input;

  const sourceBlock = scrape.markdown
    ? `## Huidige site — content (Firecrawl markdown van ${scrape.url})

${scrape.markdown}`
    : `## Huidige site

URL: ${scrape.url || "(onbekend)"}
${scrape.error ? `Scrape faalde: ${scrape.error}. Ga open de URL zelf in een browser voor context.` : "Scrape overgeslagen."}`;

  return `Je bent senior frontend designer bij Autronis, een studio die premium landing pages bouwt voor product- en tech-bedrijven.

Jouw opdracht: **upgrade** de bestaande website van een lead tot een jaw-dropping **dark premium landing page**, klaar om als pitch te laten zien ("zo kan jullie site eruit zien").

${DESIGN_SYSTEM_BLOCK}

## Lead context

- **Bedrijfsnaam**: ${name}
- **Locatie**: ${location || "(onbekend)"}
- **Categorie (Google Maps)**: ${category || "(onbekend)"}
- ${fitLineFor(fit)}

${sourceBlock}

## Wat ik van je wil

Lever **één Next.js 15 + Tailwind landing page** (artifact). Gebruik alleen Tailwind utility classes.

**Gebruik ECHTE copy uit de bron hierboven** — productnamen, services, USPs, testimonials. Herschrijf voor punch en ritme, maar verzin GEEN features, specs of claims die er niet staan. Als content ontbreekt: honest placeholder ("Coming soon", "tbd") of laat de sectie weg.

Dit is een upgrade-pitch: maak duidelijk zichtbaar welke secties sterker worden (bolder hero, premium proof-bar, modernere features grid). De klant moet "wow dit is veel beter dan wat we nu hebben" denken zodra ze 'm zien.

Gebruik Claude artifacts zodat ik 'm live kan previewen en daarna kan itereren ("maak 'm bolder", "voeg pricing toe", "meer animatie", etc).`;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function prepLead(lead: PrepLeadInput): Promise<PrepLeadResult> {
  const name = (lead.name ?? "").trim();
  const location = lead.location?.trim() || lead.address?.trim() || null;
  const fit = classifyFit(lead.category, name);

  const existingWebsite = lead.website?.trim() || null;

  // Empty state
  const emptySerp: SerpCheck = {
    ran: false,
    verdict: "skipped",
    foundUrl: null,
    candidates: [],
    note: "Niet van toepassing",
  };
  const emptyScrape: SiteScrape = {
    ran: false,
    url: null,
    title: null,
    markdown: null,
    error: null,
    source: null,
  };

  // ── Mode A: has website → scrape + upgrade prompt ──
  if (existingWebsite) {
    const url = normalizeUrl(existingWebsite);
    let scrape: SiteScrape = { ...emptyScrape, url };
    try {
      const result = await scrapePage(url);
      scrape = {
        ran: true,
        url: result.url,
        title: result.title,
        markdown: result.markdown,
        error: null,
        source: result.source,
      };
    } catch (e) {
      const errMsg =
        e instanceof ScrapeError
          ? `Scrape faalde (${e.attempts.map((a) => `${a.source}: ${a.error}`).join("; ")})`
          : e instanceof Error
            ? e.message
            : "Scrape faalde";
      scrape = {
        ran: true,
        url,
        title: null,
        markdown: null,
        error: errMsg,
        source: "failed",
      };
    }

    const prompt = buildUpgradePrompt({
      name: name || "(naam onbekend)",
      location,
      category: lead.category,
      fit,
      scrape,
    });

    return {
      lead,
      mode: "upgrade",
      serp: emptySerp,
      scrape,
      fit,
      prompt,
    };
  }

  // ── Mode B: no website → gebruik Syb's SERP data als beschikbaar ──
  // PrepLeadInput kan een sybSerp veld bevatten als de lead uit website_leads
  // komt (daar is de SERP check al gedaan). Voor LinkedIn leads zonder
  // website is er geen SERP data beschikbaar.
  let serp: SerpCheck;

  const sybData = lead.sybSerp;
  if (sybData) {
    if (sybData.hasWebsite && sybData.websiteUrl) {
      serp = {
        ran: true,
        verdict: "site_found",
        foundUrl: sybData.websiteUrl,
        candidates: [],
        note: `Syb's SERP: website gevonden (confidence: ${sybData.confidence || "unknown"})`,
      };
    } else {
      serp = {
        ran: true,
        verdict: "no_site",
        foundUrl: null,
        candidates: [],
        note: `Syb's SERP: bevestigd geen website (confidence: ${sybData.confidence || "NONE"})`,
      };
    }
  } else {
    serp = {
      ran: false,
      verdict: "skipped",
      foundUrl: null,
      candidates: [],
      note: "Geen SERP data beschikbaar voor deze lead",
    };
  }

  const prompt = buildFreshPrompt({
    name: name || "(naam onbekend)",
    location,
    category: lead.category,
    fit,
    serp,
  });

  return {
    lead,
    mode: "fresh",
    serp,
    scrape: emptyScrape,
    fit,
    prompt,
  };
}
