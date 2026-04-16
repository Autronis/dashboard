// Fix: buitenlandse leveranciers (Vercel, Anthropic, GitHub, etc.) hadden
// onterecht btwBedrag geschat op 21%. Deze moeten 0 zijn — geen NL BTW
// op buitenlandse diensten.
import { createClient } from "@libsql/client";
import fs from "fs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const t = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const BUITEN_EU = [
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

const BINNEN_EU = [
  "google ireland", "google cloud emea", "zoho corporation", "turso",
  "mollie", "adyen", "klarna", "revolut",
  "hetzner", "ovh", "scaleway",
  "spotify", "wetransfer",
];

function isBuitenlands(naam) {
  const lower = naam.toLowerCase();
  return BUITEN_EU.some(b => lower.includes(b)) || BINNEN_EU.some(b => lower.includes(b));
}

const rows = await t.execute(`
  SELECT id, merchant_naam, omschrijving, btw_bedrag
  FROM bank_transacties
  WHERE type = 'af'
    AND btw_bedrag IS NOT NULL
    AND btw_bedrag > 0
`);

console.log(`Checking ${rows.rows.length} tx with btw_bedrag > 0...`);
let fixed = 0;
for (const r of rows.rows) {
  const naam = `${r.merchant_naam ?? ""} ${r.omschrijving ?? ""}`;
  if (isBuitenlands(naam)) {
    await t.execute({ sql: "UPDATE bank_transacties SET btw_bedrag = 0 WHERE id = ?", args: [r.id] });
    console.log(`  FIX id=${r.id}: "${(r.merchant_naam ?? r.omschrijving).slice(0, 40)}" btw €${r.btw_bedrag} → €0`);
    fixed++;
  }
}
console.log(`Done. Fixed ${fixed} tx.`);
process.exit(0);
