// End-to-end sanity check. After the refactor, all 3 pages should read
// the same numbers from bank_transacties for Q2 2026.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const Q2_START = "2026-04-01";
const Q2_END = "2026-06-30";

// Kosten zoals nu berekend door alle belasting routes (via belasting-helpers)
const kostenRes = await turso.execute(`
  SELECT
    COALESCE(SUM(ABS(bedrag)), 0) as incl_btw,
    COALESCE(SUM(btw_bedrag), 0) as btw,
    COUNT(*) as aantal
  FROM bank_transacties
  WHERE type = 'af'
    AND datum >= '${Q2_START}' AND datum <= '${Q2_END}'
    AND (fiscaal_type IS NULL OR fiscaal_type != 'prive')
    AND (categorie IS NULL OR categorie != 'vermogen')
`);
const k = kostenRes.rows[0];
const kostenIncl = Number(k.incl_btw);
const kostenBtw = Number(k.btw);
const kostenExcl = kostenIncl - kostenBtw;

console.log("\n=== Q2 2026 — kosten uit bank_transacties (nieuwe canonical bron) ===");
console.log(`  ${k.aantal} transacties`);
console.log(`  Incl BTW: €${kostenIncl.toFixed(2)}`);
console.log(`  BTW:      €${kostenBtw.toFixed(2)}`);
console.log(`  Excl BTW: €${kostenExcl.toFixed(2)}`);

// Inkomsten (uit bank_transacties, vermogen uitgesloten)
const inkomstenRes = await turso.execute(`
  SELECT
    COALESCE(SUM(ABS(bedrag)), 0) as totaal,
    COUNT(*) as aantal
  FROM bank_transacties
  WHERE type = 'bij'
    AND datum >= '${Q2_START}' AND datum <= '${Q2_END}'
    AND (categorie IS NULL OR categorie != 'vermogen')
`);
console.log(`\n=== Q2 2026 — inkomsten uit bank_transacties (exc vermogen) ===`);
console.log(`  ${inkomstenRes.rows[0].aantal} transacties, €${Number(inkomstenRes.rows[0].totaal).toFixed(2)}`);

// Vermogen stortingen apart
const vermogenRes = await turso.execute(`
  SELECT COUNT(*) as aantal, COALESCE(SUM(ABS(bedrag)), 0) as totaal
  FROM bank_transacties
  WHERE type = 'bij' AND categorie = 'vermogen'
    AND datum >= '${Q2_START}' AND datum <= '${Q2_END}'
`);
console.log(`\n=== Q2 2026 — vermogensstortingen (apart, niet in omzet) ===`);
console.log(`  ${vermogenRes.rows[0].aantal} transacties, €${Number(vermogenRes.rows[0].totaal).toFixed(2)}`);

// Omzet uit facturen tabel — excludeert al verwerkte aangifte-items
const omzetRes = await turso.execute(`
  SELECT COALESCE(SUM(bedrag_excl_btw), 0) as totaal, COUNT(*) as aantal
  FROM facturen
  WHERE status = 'betaald' AND is_actief = 1
    AND betaald_op >= '${Q2_START}' AND betaald_op <= '${Q2_END}'
    AND verwerkt_in_aangifte IS NULL
`);

// Wat er sowieso als Q1 is gemarkeerd (blijft zichtbaar, telt niet mee)
const verwerktRes = await turso.execute(`
  SELECT factuurnummer, bedrag_excl_btw, verwerkt_in_aangifte, betaald_op
  FROM facturen WHERE verwerkt_in_aangifte IS NOT NULL
`);
console.log(`\n=== Gemarkeerd als al-aangegeven (niet in huidige totalen) ===`);
for (const r of verwerktRes.rows) {
  console.log(`  ${r.factuurnummer} €${r.bedrag_excl_btw} (${r.verwerkt_in_aangifte}, betaald ${r.betaald_op})`);
}

const verwerktInk = await turso.execute(`
  SELECT COUNT(*) as n FROM inkomende_facturen WHERE verwerkt_in_aangifte IS NOT NULL
`);
console.log(`\nInkomende facturen als Q1 gemarkeerd: ${verwerktInk.rows[0].n}`);
console.log(`\n=== Q2 2026 — omzet uit facturen tabel (excl BTW) ===`);
console.log(`  ${omzetRes.rows[0].aantal} betaalde facturen, €${Number(omzetRes.rows[0].totaal).toFixed(2)}`);

// Winst berekening (omzet excl - kosten excl)
const omzetExcl = Number(omzetRes.rows[0].totaal);
const winst = omzetExcl - kostenExcl;
console.log(`\n=== Q2 2026 — resultaat ===`);
console.log(`  Omzet excl BTW:   €${omzetExcl.toFixed(2)}`);
console.log(`  Kosten excl BTW:  €${kostenExcl.toFixed(2)}`);
console.log(`  Winst / verlies:  €${winst.toFixed(2)}`);
console.log(`  BTW te vorderen:  €${kostenBtw.toFixed(2)}`);
console.log(`  BTW af te dragen: €${(Number(omzetRes.rows[0].totaal) * 0.21).toFixed(2)} (als 21%)`);

// Uitgaven tabel check
const utgRes = await turso.execute("SELECT COUNT(*) as aantal FROM uitgaven WHERE datum >= '2026-01-01'");
console.log(`\n=== dode uitgaven tabel 2026 ===`);
console.log(`  ${utgRes.rows[0].aantal} rijen (moet 0 zijn)`);
