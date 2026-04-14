import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const res = await turso.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
);
console.log(`${res.rows.length} tabellen in Turso:`);
for (const row of res.rows) console.log(`  ${row.name}`);

// Look for any invoice/factuur tables
const relevante = res.rows.filter(r => /factu|inkom|bon/i.test(r.name));
console.log("\nRelevante tabellen voor PDF/bon matcher:");
relevante.forEach(r => console.log(`  ${r.name}`));
