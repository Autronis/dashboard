import { createClient } from "@libsql/client";
import fs from "fs";
const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const res = await turso.execute(`SELECT * FROM belasting_deadlines WHERE jaar IN (2026, 2027) ORDER BY datum`);
console.log(`\n${res.rows.length} deadlines in DB:\n`);
for (const r of res.rows) {
  console.log(`  ${r.datum}  [${r.type}] ${r.omschrijving}  afgerond=${r.afgerond} kwartaal=${r.kwartaal}`);
}
