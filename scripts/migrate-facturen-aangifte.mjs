// Add verwerkt_in_aangifte column to facturen + backfill the 4 existing
// March 2026 invoices (AUT-2026-001..004) as already reported in Q1-2026.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Add column (idempotent)
try {
  await turso.execute("ALTER TABLE facturen ADD COLUMN verwerkt_in_aangifte TEXT");
  console.log("✓ kolom facturen.verwerkt_in_aangifte toegevoegd");
} catch (e) {
  if (/duplicate column|already exists/i.test(e.message)) {
    console.log("· kolom bestond al");
  } else {
    throw e;
  }
}

// Backfill: mark AUT-2026-001..004 as Q1-2026 (Sem heeft ze al aangegeven)
const toMark = ["AUT-2026-001", "AUT-2026-002", "AUT-2026-003", "AUT-2026-004"];
let updated = 0;
for (const nr of toMark) {
  const r = await turso.execute({
    sql: "UPDATE facturen SET verwerkt_in_aangifte = 'Q1-2026' WHERE factuurnummer = ? AND verwerkt_in_aangifte IS NULL",
    args: [nr],
  });
  if (r.rowsAffected > 0) {
    updated += r.rowsAffected;
    console.log(`  ✓ ${nr} → Q1-2026`);
  } else {
    console.log(`  · ${nr} al gemarkeerd of niet gevonden`);
  }
}

console.log(`\n${updated} facturen gemarkeerd als verwerkt in Q1-2026`);
