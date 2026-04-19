#!/usr/bin/env node
// Toggle the `agenda_lanes_v2` feature flag on Turso.
// Usage: node scripts/toggle-lanes-v2.mjs on|off|status
// Reads creds from .env.local (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN).

import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

function loadEnv() {
  const text = readFileSync(".env.local", "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const cmd = process.argv[2] || "status";
if (!["on", "off", "status"].includes(cmd)) {
  console.error("Gebruik: node scripts/toggle-lanes-v2.mjs on|off|status");
  process.exit(1);
}

const env = loadEnv();
if (!env.TURSO_DATABASE_URL) {
  console.error("TURSO_DATABASE_URL niet gevonden in .env.local");
  process.exit(1);
}

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const naam = "agenda_lanes_v2";

if (cmd === "status") {
  const res = await client.execute({
    sql: "SELECT naam, actief, beschrijving FROM feature_flags WHERE naam = ?",
    args: [naam],
  });
  if (res.rows.length === 0) {
    console.log(`Flag '${naam}' bestaat nog niet op Turso. Start dev server minstens één keer om 'm te seeden.`);
  } else {
    const r = res.rows[0];
    console.log(`Flag: ${r.naam}\nActief: ${r.actief === 1 ? "ON" : "off"}\nBeschrijving: ${r.beschrijving}`);
  }
  process.exit(0);
}

const nieuwActief = cmd === "on" ? 1 : 0;
await client.execute({
  sql: "UPDATE feature_flags SET actief = ? WHERE naam = ?",
  args: [nieuwActief, naam],
});
console.log(`Flag '${naam}' gezet op ${nieuwActief === 1 ? "ON" : "off"}.`);
