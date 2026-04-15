// Backfill: voor bestaande type=bij bank_transacties (niet-vermogen, niet
// al gekoppeld) proberen we alsnog een factuur te vinden en te koppelen.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Alle type=bij transacties zonder gekoppelde factuur en niet vermogen
const txs = await turso.execute(`
  SELECT id, datum, omschrijving, merchant_naam, bedrag
  FROM bank_transacties
  WHERE type = 'bij'
    AND gekoppeld_factuur_id IS NULL
    AND (categorie IS NULL OR categorie != 'vermogen')
    AND bedrag > 0
  ORDER BY datum DESC
`);

console.log(`\n${txs.rows.length} inkomende tx kandidaten:\n`);

let gelukt = 0;
for (const tx of txs.rows) {
  const abs = Math.abs(Number(tx.bedrag));
  const lo = abs * 0.99;
  const hi = abs * 1.01;

  // Zoek factuur met matching bedrag
  const cand = await turso.execute({
    sql: `SELECT id, factuurnummer, bedrag_incl_btw, factuurdatum, status, pdf_storage_url
          FROM facturen
          WHERE is_actief = 1
            AND status != 'concept'
            AND bedrag_incl_btw BETWEEN ? AND ?
            AND (verwerkt_in_aangifte IS NULL)
          ORDER BY factuurdatum DESC
          LIMIT 5`,
    args: [lo, hi],
  });

  if (cand.rows.length === 0) {
    console.log(`  · tx#${tx.id} €${abs.toFixed(2)} ${tx.merchant_naam || tx.omschrijving} — geen factuur match`);
    continue;
  }

  // Pick best: factuurnummer in omschrijving, anders eerste
  const omschr = (tx.omschrijving || "").toLowerCase();
  let best = cand.rows[0];
  for (const f of cand.rows) {
    if (f.factuurnummer && omschr.includes(f.factuurnummer.toLowerCase())) {
      best = f;
      break;
    }
  }

  await turso.execute({
    sql: "UPDATE bank_transacties SET gekoppeld_factuur_id = ?, storage_url = ?, status = 'gematcht' WHERE id = ?",
    args: [best.id, best.pdf_storage_url, tx.id],
  });
  await turso.execute({
    sql: "UPDATE facturen SET status = 'betaald', betaald_op = ? WHERE id = ?",
    args: [tx.datum, best.id],
  });

  console.log(`  ✓ tx#${tx.id} €${abs.toFixed(2)} → factuur#${best.id} ${best.factuurnummer}`);
  gelukt++;
}

console.log(`\n✓ ${gelukt} / ${txs.rows.length} gekoppeld`);
