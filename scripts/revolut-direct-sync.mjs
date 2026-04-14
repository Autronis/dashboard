// Direct Revolut sync — bypasses dev server. Fetches transactions from last
// N days and inserts any missing into bank_transacties. Safe to re-run.
import { createClient } from "@libsql/client";
import * as crypto from "crypto";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const REVOLUT_BASE = "https://b2b.revolut.com/api/1.0";
const DAYS_BACK = 30;

function createClientAssertion() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: process.env.REVOLUT_ISSUER_DOMAIN || "autronis.nl",
    sub: process.env.REVOLUT_CLIENT_ID,
    aud: "https://revolut.com",
    iat: now,
    exp: now + 120,
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const input = `${headerB64}.${payloadB64}`;
  const pk = process.env.REVOLUT_PRIVATE_KEY.replace(/\\n/g, "\n");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(input);
  return `${input}.${sign.sign(pk, "base64url")}`;
}

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const { rows } = await turso.execute(
  "SELECT id, refresh_token FROM revolut_verbinding WHERE is_actief = 1 ORDER BY aangemaakt_op DESC LIMIT 1"
);
if (rows.length === 0) throw new Error("Geen actieve Revolut verbinding");

// Refresh token
const refreshRes = await fetch(`${REVOLUT_BASE}/auth/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: rows[0].refresh_token,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: createClientAssertion(),
  }),
});
if (!refreshRes.ok) {
  throw new Error(`Refresh mislukt: ${refreshRes.status} ${await refreshRes.text()}`);
}
const tokenData = await refreshRes.json();
const accessToken = tokenData.access_token;
const verlooptOp = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

// Persist fresh token
await turso.execute({
  sql: "UPDATE revolut_verbinding SET access_token = ?, token_verloopt_op = ?, bijgewerkt_op = ? WHERE id = ?",
  args: [accessToken, verlooptOp, new Date().toISOString(), rows[0].id],
});
console.log(`✓ Token ververst, geldig tot ${verlooptOp}`);

// Fetch transactions
const from = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();
const txRes = await fetch(`${REVOLUT_BASE}/transactions?from=${from}&count=500`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
if (!txRes.ok) throw new Error(`Tx fetch mislukt: ${txRes.status} ${await txRes.text()}`);
const txs = await txRes.json();
console.log(`✓ ${txs.length} transacties opgehaald van Revolut (from=${from.split("T")[0]})`);

let nieuw = 0;
let overgeslagen = 0;
const nieuweRijen = [];

for (const tx of txs) {
  if (tx.state !== "completed") {
    overgeslagen++;
    continue;
  }
  const bestaand = await turso.execute({
    sql: "SELECT id FROM bank_transacties WHERE revolut_transactie_id = ? LIMIT 1",
    args: [tx.id],
  });
  if (bestaand.rows.length > 0) {
    overgeslagen++;
    continue;
  }
  for (const leg of tx.legs || []) {
    const isUitgaand = leg.amount < 0;
    const merchantNaam = tx.merchant?.name || leg.description || tx.reference || "Onbekend";
    const datum = (tx.completed_at || tx.created_at).split("T")[0];
    const omschrijving = leg.description || tx.reference || merchantNaam;
    const bedrag = Math.abs(leg.amount);

    await turso.execute({
      sql: `INSERT INTO bank_transacties
        (datum, omschrijving, bedrag, type, bank, revolut_transactie_id, merchant_naam, merchant_categorie, status)
        VALUES (?, ?, ?, ?, 'revolut', ?, ?, ?, 'onbekend')`,
      args: [
        datum,
        omschrijving,
        bedrag,
        isUitgaand ? "af" : "bij",
        tx.id,
        isUitgaand ? merchantNaam : null,
        tx.merchant?.category_code || null,
      ],
    });
    nieuw++;
    nieuweRijen.push({ datum, merchant: merchantNaam, bedrag, type: isUitgaand ? "af" : "bij" });
  }
}

// Update laatste_sync_op
await turso.execute({
  sql: "UPDATE revolut_verbinding SET laatste_sync_op = ? WHERE id = ?",
  args: [new Date().toISOString(), rows[0].id],
});

console.log(`\n✓ ${nieuw} nieuwe transacties ingevoegd, ${overgeslagen} overgeslagen (bestaande/niet-completed)`);
if (nieuweRijen.length > 0) {
  console.log("\nNieuwe transacties:");
  for (const r of nieuweRijen) {
    console.log(`  ${r.datum}  ${r.type === "af" ? "-" : "+"}€${r.bedrag.toFixed(2).padStart(8)}  ${r.merchant}`);
  }
}
