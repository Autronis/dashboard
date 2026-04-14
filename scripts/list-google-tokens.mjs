import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const res = await turso.execute("SELECT id, gebruiker_id, calendar_id, expires_at, bijgewerkt_op, substr(access_token, 1, 30) || '...' as token_start, substr(refresh_token, 1, 20) || '...' as rt_start FROM google_tokens ORDER BY id");
console.log(`${res.rows.length} google_tokens rijen:`);
for (const r of res.rows) {
  console.log(`  id=${r.id} gebruiker=${r.gebruiker_id} calendar_id=${r.calendar_id}`);
  console.log(`    expires: ${r.expires_at}`);
  console.log(`    bijgewerkt: ${r.bijgewerkt_op}`);
  console.log(`    access_token: ${r.token_start}`);
  console.log(`    refresh_token: ${r.rt_start}`);
}
