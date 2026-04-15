// Audit all matched inkomende_facturen vs their bank_transactie to find
// mismatches where leverancier names don't overlap at all.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const res = await turso.execute(`
  SELECT
    f.id AS f_id, f.leverancier, f.bedrag AS f_bedrag, f.datum AS f_datum,
    t.id AS t_id, t.merchant_naam, t.omschrijving, t.bedrag AS t_bedrag, t.datum AS t_datum
  FROM inkomende_facturen f
  JOIN bank_transacties t ON t.id = f.bank_transactie_id
  WHERE f.bank_transactie_id IS NOT NULL
  ORDER BY f.id
`);

console.log(`\n=== Alle ${res.rows.length} matches — check op merchant overlap ===\n`);
for (const r of res.rows) {
  const fNaam = String(r.leverancier).toLowerCase();
  const tNaam = String(r.merchant_naam || r.omschrijving || '').toLowerCase();
  // simpele overlap-check: bevat een van beide de ander?
  const woordenA = fNaam.split(/[\s,.\-]+/).filter((w) => w.length > 3);
  const woordenB = tNaam.split(/[\s,.\-]+/).filter((w) => w.length > 3);
  const overlap = woordenA.some((w) => tNaam.includes(w)) || woordenB.some((w) => fNaam.includes(w));
  const datumGap = Math.abs(new Date(r.t_datum).getTime() - new Date(r.f_datum).getTime()) / 86400000;
  const flag = overlap ? "✓" : "⚠️  NAAM MISMATCH";
  console.log(`${flag}  factuur#${r.f_id} "${r.leverancier}" €${r.f_bedrag} ${r.f_datum}`);
  console.log(`           ↔ tx#${r.t_id} "${r.merchant_naam || r.omschrijving}" €${r.t_bedrag} ${r.t_datum} (${datumGap.toFixed(0)}d gap)`);
}
