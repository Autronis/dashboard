import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const env = Object.fromEntries(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local"), "utf-8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim().replace(/^["']|["']$/g, "")]; })
);
const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

// Alle taken met een ingepland_start (niet null, niet leeg)
const r = await client.execute(
  "SELECT id, titel, ingepland_start, ingepland_eind, toegewezen_aan, project_id FROM taken WHERE ingepland_start IS NOT NULL AND ingepland_start != '' ORDER BY ingepland_start DESC LIMIT 50"
);
console.log(`Totaal ingeplande taken: ${r.rows.length}`);
for (const row of r.rows) {
  console.log(`  [${row.id}] proj=${row.project_id} user=${row.toegewezen_aan} start=${row.ingepland_start} eind=${row.ingepland_eind} — ${row.titel}`);
}
