// Classificeer leveranciers als buiten-EU, binnen-EU of binnenlands (NL).
// Bepaalt of er NL BTW op de factuur zit:
//
//   buiten_eu  → geen NL BTW, verlegde BTW (rubriek 4a), btwBedrag = 0
//   binnen_eu  → geen NL BTW, verlegde BTW (rubriek 4b), btwBedrag = 0
//   null       → vermoedelijk binnenlands, standaard 21% BTW van toepassing
//
// Wordt gebruikt door:
//   - AI analyse (btwBedrag berekening na revolut sync)
//   - BTW voorbereiding (rubriek 4a/4b classificatie)
//   - Maandrapport (BTW schatting)

const BUITEN_EU_LEVERANCIERS = [
  "anthropic", "aws", "amazon web services", "openai",
  "vercel", "google cloud", "microsoft azure", "stripe",
  "digitalocean", "cloudflare", "github", "notion",
  "figma", "slack", "zoom", "higgsfield", "fal",
  "huggingface", "hugging face", "replicate", "modal",
  "heroku", "fly.io", "railway", "supabase",
  "twilio", "sendgrid", "mailgun", "postmark",
  "sentry", "datadog", "linear", "loom",
  "canva", "grammarly", "1password", "bitwarden",
];

const BINNEN_EU_LEVERANCIERS = [
  "google ireland", "google cloud emea", "zoho corporation", "turso",
  "mollie", "adyen", "klarna", "revolut",
  "hetzner", "ovh", "scaleway",
  "spotify", "wetransfer",
];

export function classificeerLeverancier(leverancier: string): "buiten_eu" | "binnen_eu" | null {
  const lower = leverancier.toLowerCase();
  if (BUITEN_EU_LEVERANCIERS.some((naam) => lower.includes(naam))) return "buiten_eu";
  if (BINNEN_EU_LEVERANCIERS.some((naam) => lower.includes(naam))) return "binnen_eu";
  return null;
}

// Schat BTW bedrag op basis van leverancier-land.
// buiten_eu/binnen_eu → €0 (geen NL BTW op factuur, verlegde BTW wordt
// apart behandeld in de BTW-aangifte rubrieken).
// binnenlands (null) → standaard 21% teruggerekend uit bedrag incl BTW.
export function schatBtwBedrag(bedragInclBtw: number, leverancier: string): number {
  const land = classificeerLeverancier(leverancier);
  if (land !== null) return 0;
  return Math.round((Math.abs(bedragInclBtw) / 1.21) * 0.21 * 100) / 100;
}
