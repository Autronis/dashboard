#!/usr/bin/env node
// Seed 5 concrete voorbeeld bridge-acties zodat het Slimme Acties panel
// direct gevuld is (zonder tot de eerste 20:30 bridge-run te wachten).
// Gebruik: node scripts/seed-slimme-acties-demo.mjs

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

const env = loadEnv();
const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const nu = new Date();
const tomorrow = new Date(nu);
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(0, 0, 0, 0);
const verloopt = new Date(tomorrow.getTime() + 48 * 3600 * 1000).toISOString();

const seeds = [
  {
    titel: "Cold outreach batch — 10 webshops Zutphen",
    beschrijving: "Shopify/Magento prospects uit ICP, via Sales Engine scannen + gepersonaliseerde DM sturen",
    cluster: "klantcontact",
    pijler: "sales_engine",
    duur_min: 45,
    voor: "sem",
    prioriteit: "hoog",
  },
  {
    titel: "Case study Heemskerk publiceren",
    beschrijving: "500 woorden case study + screenshots van de n8n flow, plaatsen op autronis.com/cases + LinkedIn carousel",
    cluster: "content",
    pijler: "content",
    duur_min: 60,
    voor: "sem",
    prioriteit: "normaal",
  },
  {
    titel: "Follow-up LP Brands + Nukeware",
    beschrijving: "3 dagen geen reply — Loom van 30 sec met specifieke pijnpunt-vondst uit hun scan",
    cluster: "klantcontact",
    pijler: "sales_engine",
    duur_min: 20,
    voor: "sem",
    prioriteit: "hoog",
  },
  {
    titel: "ICP-filter update Lead Dashboard v2",
    beschrijving: "Filter aanpassen op 10-50 medewerkers + branches e-commerce / agencies / dienstverlening",
    cluster: "backend-infra",
    pijler: "inbound",
    duur_min: 30,
    voor: "syb",
    prioriteit: "normaal",
  },
  {
    titel: "Intake-call prep fietsenzaak",
    beschrijving: "Sales Engine scan draaien op bedrijfswebsite, rapport reviewen, drie haakjes voorbereiden voor morgen 10:00",
    cluster: "klantcontact",
    pijler: "delivery",
    duur_min: 25,
    voor: "team",
    prioriteit: "hoog",
  },
];

let ok = 0;
for (const s of seeds) {
  try {
    await client.execute({
      sql: `INSERT INTO slimme_acties_bridge
            (titel, beschrijving, cluster, pijler, duur_min, voor, prioriteit, verloopt_op)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        s.titel,
        s.beschrijving,
        s.cluster,
        s.pijler,
        s.duur_min,
        s.voor,
        s.prioriteit,
        verloopt,
      ],
    });
    ok++;
  } catch (e) {
    console.error(`fout bij '${s.titel}':`, e.message);
  }
}
console.log(`${ok}/${seeds.length} demo acties geseed, verloopt ${verloopt}.`);
