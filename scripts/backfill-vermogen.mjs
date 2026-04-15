// Backfill existing bank_transacties: mark owner equity deposits as
// categorie = "vermogen" so they stop polluting omzet / BTW totals.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Find all incoming transactions whose merchant or description matches
// Sem or Syb (Gijsberts/Sprenkeler).
const candidates = await turso.execute(`
  SELECT id, datum, merchant_naam, omschrijving, bedrag, categorie
  FROM bank_transacties
  WHERE type = 'bij'
    AND (
      LOWER(merchant_naam) LIKE '%gijsberts%' OR LOWER(omschrijving) LIKE '%gijsberts%' OR
      LOWER(merchant_naam) LIKE '%sprenkeler%' OR LOWER(omschrijving) LIKE '%sprenkeler%'
    )
  ORDER BY datum
`);

console.log(`\n${candidates.rows.length} kandidaten gevonden:\n`);
let updated = 0;
for (const r of candidates.rows) {
  const label = r.categorie === "vermogen" ? "(al vermogen)" : "→ vermogen";
  console.log(`  ${label} id=${r.id} ${r.datum} €${r.bedrag} ${r.merchant_naam || r.omschrijving}`);
  if (r.categorie !== "vermogen") {
    await turso.execute({
      sql: "UPDATE bank_transacties SET categorie = 'vermogen', btw_bedrag = 0, status = 'gecategoriseerd' WHERE id = ?",
      args: [r.id],
    });
    updated++;
  }
}

console.log(`\n✓ ${updated} transacties geüpdatet als vermogen`);
