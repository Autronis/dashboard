import { createClient } from "@libsql/client";
import fs from "fs";
const envFile = fs.readFileSync("./.env.local", "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const r = await turso.execute("SELECT * FROM btw_aangiftes WHERE jaar = 2026");
console.log(`${r.rows.length} aangiftes voor 2026:`);
for (const row of r.rows) console.log(`  Q${row.kwartaal} status=${row.status} ontvangen=${row.btw_ontvangen} betaald=${row.btw_betaald}`);
