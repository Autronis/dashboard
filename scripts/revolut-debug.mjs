// Quick one-off debug: query Revolut API directly for last N days,
// bypassing the sync dedupe logic. Run with: node scripts/revolut-debug.mjs
// Requires .env.local with REVOLUT_* creds loaded.
import { createClient } from "@libsql/client";
import * as crypto from "crypto";
import fs from "fs";

// Load .env.local manually (no dotenv dep needed)
const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const REVOLUT_BASE = "https://b2b.revolut.com/api/1.0";

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
  const signingInput = `${headerB64}.${payloadB64}`;
  const privateKey = process.env.REVOLUT_PRIVATE_KEY.replace(/\\n/g, "\n");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(privateKey, "base64url");
  return `${signingInput}.${signature}`;
}

async function main() {
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Get the stored refresh token
  const { rows } = await turso.execute(
    "SELECT id, refresh_token, access_token, token_verloopt_op, laatste_sync_op FROM revolut_verbinding WHERE is_actief = 1 ORDER BY aangemaakt_op DESC LIMIT 1"
  );
  if (rows.length === 0) {
    console.log("Geen actieve Revolut verbinding.");
    return;
  }
  const v = rows[0];
  console.log("Verbinding:", {
    id: v.id,
    verloopt: v.token_verloopt_op,
    laatsteSync: v.laatste_sync_op,
  });

  // Refresh the token
  const refreshRes = await fetch(`${REVOLUT_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: v.refresh_token,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: createClientAssertion(),
    }),
  });
  if (!refreshRes.ok) {
    console.error("Token refresh mislukt:", refreshRes.status, await refreshRes.text());
    return;
  }
  const { access_token } = await refreshRes.json();
  console.log("Access token verkregen (len:", access_token.length, ")");

  // Try WIDE range: last 14 days, include all states
  const from = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const txRes = await fetch(`${REVOLUT_BASE}/transactions?from=${from}&count=200`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!txRes.ok) {
    console.error("Tx fetch mislukt:", txRes.status, await txRes.text());
    return;
  }
  const txs = await txRes.json();
  console.log(`\n${txs.length} transacties teruggekregen (from=${from})\n`);

  // Group by state
  const byState = {};
  for (const t of txs) byState[t.state] = (byState[t.state] || 0) + 1;
  console.log("Per state:", byState);

  // Show transactions from 12 april onwards
  console.log("\n--- Transacties vanaf 12 april ---");
  const recent = txs
    .filter((t) => (t.completed_at || t.created_at) >= "2026-04-12")
    .sort((a, b) => (a.completed_at || a.created_at).localeCompare(b.completed_at || b.created_at));
  for (const t of recent) {
    const date = (t.completed_at || t.created_at).split("T")[0];
    const leg = t.legs?.[0];
    const amount = leg?.amount ?? 0;
    const desc = t.merchant?.name || leg?.description || t.reference || "(no desc)";
    console.log(`  ${date}  ${t.state.padEnd(10)}  ${String(amount).padStart(10)}  ${desc}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
