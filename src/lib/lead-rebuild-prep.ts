// Per-lead prep pipeline for the `/leads/rebuild-prep` batch tool.
//
// Flow:
//   1. SERP check — Firecrawl /v1/search to verify the lead really has no site.
//   2. Sector fit — keyword classifier on the Google Maps category.
//   3. Prompt assembly — paste-ready Claude prompt, inlined (no nested HTTP).
//
// The prompt format matches /api/site-rebuild/prompt so prep output can be
// pasted into claude.ai with extended thinking + artifacts.

import { searchWeb, type SearchResult } from "./firecrawl";
import { classifyFit, type FitResult } from "./lead-rebuild-fit";

export type PrepLeadInput = {
  id: string;
  name: string | null;
  website: string | null;
  location: string | null;
  address: string | null;
  category: string | null;
};

export type SerpCheck = {
  ran: boolean;
  verdict: "site_found" | "no_site" | "skipped" | "error";
  foundUrl: string | null;
  candidates: SearchResult[];
  note: string;
};

export type PrepLeadResult = {
  lead: PrepLeadInput;
  serp: SerpCheck;
  fit: FitResult;
  prompt: string;
};

// Domains that should never count as "the company's own website" in a SERP hit.
const DIRECTORY_HOSTS = [
  "google.com", "google.nl", "maps.google", "goo.gl",
  "facebook.com", "fb.com", "instagram.com", "linkedin.com", "twitter.com",
  "x.com", "tiktok.com", "youtube.com", "pinterest.com",
  "yelp.com", "tripadvisor.com", "tripadvisor.nl", "thefork.com",
  "kvk.nl", "opencorporates.com", "telefoonboek.nl", "detelefoongids.nl",
  "goudengids.nl", "bedrijvenpagina.nl", "iens.nl", "eet.nu",
  "werkspot.nl", "marktplaats.nl", "funda.nl",
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isDirectoryHit(url: string): boolean {
  const host = hostOf(url);
  if (!host) return true;
  return DIRECTORY_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
}

export function buildLeadPrompt(input: {
  name: string;
  location: string | null;
  category: string | null;
  fit: FitResult;
  serp: SerpCheck;
  existingWebsite: string | null;
}): string {
  const { name, location, category, fit, serp, existingWebsite } = input;

  const verdictLine = existingWebsite
    ? `Deze lead heeft al een site: ${existingWebsite}. Gebruik die als referentie (upgrade-job, niet from-scratch).`
    : serp.verdict === "site_found" && serp.foundUrl
      ? `⚠️ SERP-check vond mogelijk een bestaande site: ${serp.foundUrl}. Check eerst of het echt van ${name} is voor je begint.`
      : serp.verdict === "no_site"
        ? `SERP-check bevestigt: geen bestaande site gevonden. Bouw from-scratch.`
        : serp.verdict === "error"
          ? `SERP-check faalde (${serp.note}). Ga uit van geen bestaande site.`
          : `SERP-check overgeslagen.`;

  const fitLine =
    fit.verdict === "scroll_stop_good"
      ? `Sector-fit: **${fit.label}**. Dit is een fysiek product — overweeg een scroll-stop hero animatie.`
      : fit.verdict === "static_upgrade"
        ? `Sector-fit: **${fit.label}**. Dienstverlening — bouw een dark premium statische site, geen scroll-stop animatie.`
        : `Sector-fit: **${fit.label}**. ${fit.reason}`;

  return `Je bent senior frontend designer bij Autronis, een studio die premium landing pages bouwt voor product- en tech-bedrijven.

Jouw opdracht: bouw een jaw-dropping **dark premium landing page** voor een nieuwe lead uit onze database, klaar om aan de klant te laten zien als pitch.

## Design system (verplicht)

- Jet-black achtergrond \`#0a0a0b\` met subtiele ambient glows
- Display headlines in **Space Grotesk** (clamp(3rem, 8vw, 7rem))
- Body in **Inter**
- Één accent kleur, spaarzaam gebruikt voor CTAs, onderlijnen, key numbers, hovers — **kies er zelf één** die past bij de content/industrie (bv. tech → teal/cyaan, food → warm oranje, fashion → koper, healthcare → soft groen)
- Genereuze whitespace, 8pt grid, geen clutter
- Section flow: hero → proof bar → features (3-col) → specs / numbers → testimonial (als plausibel) → CTA
- Geen stock photos. Gebruik CSS gradients, geometrische vormen, emoji, of svg glyphs
- Fully responsive via Tailwind utility classes
- Tenminste één CTA-knop die glow'd on hover

## Lead context

- **Bedrijfsnaam**: ${name}
- **Locatie**: ${location || "(onbekend)"}
- **Categorie (Google Maps)**: ${category || "(onbekend)"}
- ${fitLine}
- ${verdictLine}

## Wat ik van je wil

Lever **één Next.js 15 + Tailwind landing page** (artifact). Gebruik alleen Tailwind utility classes.

**Geen bestaande content beschikbaar** — dit is een cold lead. Verzin GEEN features, specs, testimonials of claims die je niet kan onderbouwen vanuit de categorie + locatie. Gebruik honest placeholders ("Coming soon", "Jouw USP hier", "Testimonial plek") waar data ontbreekt. De pitch is: "dit is hoe jullie site eruit kan zien" — niet "dit is jullie nieuwe site".

Gebruik Claude artifacts zodat ik 'm live kan previewen en daarna kan itereren ("maak 'm bolder", "voeg pricing toe", "meer animatie", etc).`;
}

export async function prepLead(lead: PrepLeadInput): Promise<PrepLeadResult> {
  const name = (lead.name ?? "").trim();
  const location = lead.location?.trim() || lead.address?.trim() || null;

  const fit = classifyFit(lead.category, name);

  let serp: SerpCheck;

  if (!name) {
    serp = {
      ran: false,
      verdict: "skipped",
      foundUrl: null,
      candidates: [],
      note: "Geen bedrijfsnaam — SERP-check overgeslagen",
    };
  } else if (lead.website?.trim()) {
    serp = {
      ran: false,
      verdict: "skipped",
      foundUrl: lead.website.trim(),
      candidates: [],
      note: "Lead heeft al een website — SERP-check overgeslagen",
    };
  } else {
    const query = location ? `${name} ${location}` : name;
    try {
      const results = await searchWeb(query, 5);
      const firstOwn = results.find((r) => !isDirectoryHit(r.url));
      if (firstOwn) {
        serp = {
          ran: true,
          verdict: "site_found",
          foundUrl: firstOwn.url,
          candidates: results,
          note: `SERP top hit: ${hostOf(firstOwn.url)}`,
        };
      } else {
        serp = {
          ran: true,
          verdict: "no_site",
          foundUrl: null,
          candidates: results,
          note: results.length
            ? "Alleen directory-hits gevonden (geen eigen domein)"
            : "Geen SERP resultaten",
        };
      }
    } catch (e) {
      serp = {
        ran: true,
        verdict: "error",
        foundUrl: null,
        candidates: [],
        note: e instanceof Error ? e.message : "SERP-check faalde",
      };
    }
  }

  const prompt = buildLeadPrompt({
    name: name || "(naam onbekend)",
    location,
    category: lead.category,
    fit,
    serp,
    existingWebsite: lead.website?.trim() || null,
  });

  return { lead, serp, fit, prompt };
}
