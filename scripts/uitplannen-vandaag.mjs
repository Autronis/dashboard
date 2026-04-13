#!/usr/bin/env node
// Clear ingeplandStart/ingeplandEind voor alle taken van user=1 (Sem) die
// niet afgerond zijn. Dry-run by default, --apply om echt te updaten.
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

const apply = process.argv.includes("--apply");
console.log(`Mode: ${apply ? "APPLY (echt updaten)" : "DRY-RUN (alleen tellen)"}`);

const where = `
  ingepland_start IS NOT NULL
  AND ingepland_start != ''
  AND (toegewezen_aan = 1 OR toegewezen_aan IS NULL)
  AND status != 'afgerond'
`;

const countRes = await client.execute(
  `SELECT COUNT(*) AS n, MIN(ingepland_start) AS eerste, MAX(ingepland_start) AS laatste FROM taken WHERE ${where}`
);
const { n, eerste, laatste } = countRes.rows[0];
console.log(`\n${n} taken zouden uitgepland worden (range ${eerste} → ${laatste}).`);

if (!apply) {
  console.log("\nDry-run: niks geupdate. Draai opnieuw met --apply om echt uit te plannen.");
  process.exit(0);
}

const upd = await client.execute(
  `UPDATE taken SET ingepland_start = NULL, ingepland_eind = NULL WHERE ${where}`
);
console.log(`\n✅ ${upd.rowsAffected} taken uitgepland.`);
