// Import Q1 items from the April 2026 belasting-overzicht that were never
// booked in the Q1 aangifte. All get datum = 2026-04-01 so they land in Q2
// and count toward the current BTW aangifte. Real date preserved in omschrijving.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 1. Fix kantoorhuur datum: 2026-03-31 → 2026-04-01 (april kostenpost)
const huurUpdate = await turso.execute({
  sql: "UPDATE bank_transacties SET datum = '2026-04-01', btw_bedrag = 70.35 WHERE datum = '2026-03-31' AND merchant_naam = 'Kantoorhuur'",
  args: [],
});
console.log(`✓ Kantoorhuur naar 01-04 verplaatst (${huurUpdate.rowsAffected} rijen)`);

// 2. Q1 items to import. Amount is TOTAL (incl BTW). btw is the BTW portion.
// Bank 'ing-inhaal' and 'revolut-inhaal' — so they're identifiable and not
// confused with the API-synced transactions.
const inhaalItems = [
  // ING Q1 (jan-feb-mrt)
  { merchant: "Praxis/Gamma/Hornbach (Q1 divers)", omschrijving: "Q1 inhaal — bouwmarkten jan-feb, oorspronkelijk niet geboekt", bedrag: 285.72, btw: 49.58, bank: "ing-inhaal", categorie: "kantoor" },
  { merchant: "Megekko beeldscherm (in3 2/3 + 3/3)", omschrijving: "Q1 inhaal — afbetaling jan-feb", bedrag: 132.66, btw: 23.02, bank: "ing-inhaal", categorie: "hardware" },
  { merchant: "Hostnet (2x domein)", omschrijving: "Q1 inhaal — feb, 2x domein", bedrag: 22.02, btw: 3.82, bank: "ing-inhaal", categorie: "hosting" },
  { merchant: "Temu (Q1)", omschrijving: "Q1 inhaal — feb, buitenland (geen NL BTW)", bedrag: 33.97, btw: 0, bank: "ing-inhaal", categorie: "kantoor" },
  { merchant: "LampenShopOnline", omschrijving: "Q1 inhaal — feb", bedrag: 32.25, btw: 5.60, bank: "ing-inhaal", categorie: "kantoor" },
  { merchant: "Leen Bakker", omschrijving: "Q1 inhaal — jan", bedrag: 20.00, btw: 3.47, bank: "ing-inhaal", categorie: "kantoor" },
  { merchant: "Toolstation", omschrijving: "Q1 inhaal — jan", bedrag: 12.95, btw: 2.25, bank: "ing-inhaal", categorie: "kantoor" },
  { merchant: "Kabel24", omschrijving: "Q1 inhaal — feb", bedrag: 10.71, btw: 1.86, bank: "ing-inhaal", categorie: "hardware" },
  { merchant: "Bibliotheek WestAchte (printen)", omschrijving: "Q1 inhaal — mrt, printen", bedrag: 3.00, btw: 0.52, bank: "ing-inhaal", categorie: "kantoor" },

  // Persoonlijke Revolut (mrt)
  { merchant: "Lovable (14x €15 + 1x €25)", omschrijving: "Q1 inhaal — mrt, 2-6 mrt, persoonlijke Revolut", bedrag: 235.00, btw: 40.79, bank: "revolut-inhaal", categorie: "software" },
  { merchant: "Google Workspace (autronis)", omschrijving: "Q1 inhaal — mrt, 2 mrt, persoonlijke Revolut", bedrag: 0.16, btw: 0.03, bank: "revolut-inhaal", categorie: "software" },
];

// Guard: skip if an inhaal item already exists
let added = 0;
let skipped = 0;
for (const item of inhaalItems) {
  const exists = await turso.execute({
    sql: "SELECT id FROM bank_transacties WHERE merchant_naam = ? AND bank = ? LIMIT 1",
    args: [item.merchant, item.bank],
  });
  if (exists.rows.length > 0) {
    skipped++;
    continue;
  }
  await turso.execute({
    sql: `INSERT INTO bank_transacties
      (datum, omschrijving, bedrag, type, bank, merchant_naam, categorie, btw_bedrag, status)
      VALUES ('2026-04-01', ?, ?, 'af', ?, ?, ?, ?, 'gecategoriseerd')`,
    args: [item.omschrijving, item.bedrag, item.bank, item.merchant, item.categorie, item.btw],
  });
  added++;
}

console.log(`✓ ${added} Q1 inhaal items toegevoegd, ${skipped} overgeslagen (al aanwezig)`);

// Sanity check: toon Q2 totaal en BTW
const q2 = await turso.execute(
  "SELECT COUNT(*) as n, SUM(ABS(bedrag)) as totaal, SUM(btw_bedrag) as btw FROM bank_transacties WHERE datum >= '2026-04-01' AND datum < '2026-07-01' AND type = 'af'"
);
const r = q2.rows[0];
console.log(`\nQ2 2026 state:`);
console.log(`  ${r.n} uitgaven, totaal €${Number(r.totaal).toFixed(2)}, BTW €${Number(r.btw).toFixed(2)}`);
