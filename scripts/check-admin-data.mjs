// Mirror wat /api/administratie ophaalt voor jaar=2026 om te zien waarom
// de UI "geen documenten" toont.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// 1. Inkomende facturen 2026
const ink = await turso.execute(
  "SELECT id, leverancier, bedrag, datum, status, bank_transactie_id FROM inkomende_facturen WHERE datum >= '2026-01-01' AND datum <= '2026-12-31' ORDER BY datum DESC"
);
console.log(`\n=== inkomende_facturen 2026 (${ink.rows.length}) ===`);
for (const r of ink.rows) {
  console.log(`  id=${r.id} ${r.datum} €${r.bedrag} ${r.leverancier} status=${r.status}`);
}

// 2. Facturen (uitgaand) met pdf
const uit = await turso.execute(
  "SELECT id, factuurnummer, factuurdatum, bedrag_incl_btw, status, pdf_storage_url FROM facturen WHERE pdf_storage_url IS NOT NULL AND factuurdatum >= '2026-01-01' AND factuurdatum <= '2026-12-31' ORDER BY factuurdatum DESC"
);
console.log(`\n=== facturen uitgaand 2026 met PDF (${uit.rows.length}) ===`);
for (const r of uit.rows) {
  console.log(`  id=${r.id} ${r.factuurdatum} €${r.bedrag_incl_btw} ${r.factuurnummer} status=${r.status}`);
  console.log(`    pdf: ${r.pdf_storage_url}`);
}

// 3. Bank transacties met /bonnetjes/
const bon = await turso.execute(
  "SELECT id, datum, merchant_naam, omschrijving, bedrag, storage_url FROM bank_transacties WHERE storage_url LIKE '%/bonnetjes/%' AND datum >= '2026-01-01' AND datum <= '2026-12-31'"
);
console.log(`\n=== bonnetjes in bank_transacties (${bon.rows.length}) ===`);
for (const r of bon.rows) {
  console.log(`  id=${r.id} ${r.datum} €${r.bedrag} ${r.merchant_naam}`);
}
