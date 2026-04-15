import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// All facturen (uitgaande) for 2026
const f = await turso.execute(`
  SELECT id, factuurnummer, factuurdatum, bedrag_incl_btw, status, pdf_storage_url
  FROM facturen
  WHERE factuurdatum >= '2026-01-01' AND is_actief = 1
  ORDER BY factuurdatum DESC
`);
console.log(`\n=== facturen 2026 (${f.rows.length}) ===`);
for (const r of f.rows) {
  const pdf = r.pdf_storage_url ? "✓" : "✗";
  console.log(`  ${r.factuurdatum} ${r.factuurnummer} €${r.bedrag_incl_btw} ${r.status}  PDF:${pdf}`);
}

// Count by pdf_storage_url status
const metPdf = await turso.execute(`
  SELECT COUNT(*) as n, COALESCE(SUM(bedrag_incl_btw), 0) as totaal
  FROM facturen
  WHERE is_actief = 1 AND pdf_storage_url IS NOT NULL
    AND factuurdatum >= '2026-01-01' AND factuurdatum <= '2026-12-31'
`);
console.log(`\nMet PDF in /administratie: ${metPdf.rows[0].n} facturen, €${metPdf.rows[0].totaal}`);

const zonderPdf = await turso.execute(`
  SELECT COUNT(*) as n, COALESCE(SUM(bedrag_incl_btw), 0) as totaal
  FROM facturen
  WHERE is_actief = 1 AND pdf_storage_url IS NULL
    AND factuurdatum >= '2026-01-01' AND factuurdatum <= '2026-12-31'
`);
console.log(`Zonder PDF (dus NIET in /administratie getoond): ${zonderPdf.rows[0].n} facturen, €${zonderPdf.rows[0].totaal}`);
