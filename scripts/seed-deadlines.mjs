// Seed correct NL tax deadlines for 2026 + 2027 directly to Turso.
//
// Source: Belastingdienst (https://www.belastingdienst.nl) — de officiële
// data voor BTW-aangifte, inkomstenbelasting en ICP opgave.
//
// BTW per kwartaal: uiterlijk de laatste dag van de maand die volgt op het
// kwartaal (Q1 → 30 april, Q2 → 31 juli, Q3 → 31 oktober, Q4 → 31 januari
// het jaar erna).
//
// IB: aangifte over jaar X moet uiterlijk 1 mei van jaar X+1 ingediend zijn
// (uitstel mogelijk via Belastingdienst of accountant).
//
// ICP opgave loopt synchroon met de BTW-aangifte maar is alleen relevant
// als er EU-leveringen zijn met BTW-verlegging. Wordt wel geseed voor
// compleetheid zodat de gebruiker ziet dat deadline bestaat.
//
// KvK publicatieplicht NIET geseed — Autronis is een VOF (niet BV/NV).
//
// Q1 2026 wordt meteen als afgerond gemarkeerd want Sem heeft die al
// ingediend (blijkt uit facturen.verwerkt_in_aangifte = 'Q1-2026').
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const deadlines = [
  // 2026 BTW
  { type: "btw", omschrijving: "BTW aangifte Q1 2026", datum: "2026-04-30", kwartaal: 1, jaar: 2026, afgerond: 1 },
  { type: "btw", omschrijving: "BTW aangifte Q2 2026", datum: "2026-07-31", kwartaal: 2, jaar: 2026, afgerond: 0 },
  { type: "btw", omschrijving: "BTW aangifte Q3 2026", datum: "2026-10-31", kwartaal: 3, jaar: 2026, afgerond: 0 },
  { type: "btw", omschrijving: "BTW aangifte Q4 2026", datum: "2027-01-31", kwartaal: 4, jaar: 2026, afgerond: 0 },

  // 2026 ICP (gelijk aan BTW, alleen relevant bij EU-leveringen)
  { type: "icp", omschrijving: "ICP opgave Q1 2026", datum: "2026-04-30", kwartaal: 1, jaar: 2026, afgerond: 1 },
  { type: "icp", omschrijving: "ICP opgave Q2 2026", datum: "2026-07-31", kwartaal: 2, jaar: 2026, afgerond: 0 },
  { type: "icp", omschrijving: "ICP opgave Q3 2026", datum: "2026-10-31", kwartaal: 3, jaar: 2026, afgerond: 0 },
  { type: "icp", omschrijving: "ICP opgave Q4 2026", datum: "2027-01-31", kwartaal: 4, jaar: 2026, afgerond: 0 },

  // Inkomstenbelasting over 2025 (voor 1 mei 2026)
  { type: "inkomstenbelasting", omschrijving: "Inkomstenbelasting 2025", datum: "2026-05-01", kwartaal: null, jaar: 2025, afgerond: 0 },

  // Inkomstenbelasting over 2026 (voor 1 mei 2027)
  { type: "inkomstenbelasting", omschrijving: "Inkomstenbelasting 2026", datum: "2027-05-01", kwartaal: null, jaar: 2026, afgerond: 0 },

  // 2027 BTW (alvast zichtbaar als toekomst)
  { type: "btw", omschrijving: "BTW aangifte Q1 2027", datum: "2027-04-30", kwartaal: 1, jaar: 2027, afgerond: 0 },
  { type: "btw", omschrijving: "BTW aangifte Q2 2027", datum: "2027-07-31", kwartaal: 2, jaar: 2027, afgerond: 0 },
  { type: "btw", omschrijving: "BTW aangifte Q3 2027", datum: "2027-10-31", kwartaal: 3, jaar: 2027, afgerond: 0 },
  { type: "btw", omschrijving: "BTW aangifte Q4 2027", datum: "2028-01-31", kwartaal: 4, jaar: 2027, afgerond: 0 },
];

// Wipe alles van 2026 + 2027 en opnieuw inserteren (idempotent herseed).
await turso.execute("DELETE FROM belasting_deadlines WHERE jaar IN (2025, 2026, 2027)");

for (const d of deadlines) {
  await turso.execute({
    sql: `INSERT INTO belasting_deadlines (type, omschrijving, datum, kwartaal, jaar, afgerond)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [d.type, d.omschrijving, d.datum, d.kwartaal, d.jaar, d.afgerond],
  });
  console.log(`  ✓ ${d.datum} — ${d.omschrijving}${d.afgerond ? " (afgerond)" : ""}`);
}

console.log(`\n✓ ${deadlines.length} deadlines geseed`);
