import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const res = await turso.execute(
  "SELECT id, gebruiker_id, calendar_id, expires_at, bijgewerkt_op FROM google_tokens WHERE calendar_id = 'gmail'"
);
if (res.rows.length === 0) {
  console.log("❌ Geen Gmail token gevonden");
  process.exit(1);
}
for (const r of res.rows) {
  const exp = new Date(r.expires_at).getTime();
  const nu = Date.now();
  const mins = Math.round((exp - nu) / 60000);
  console.log(`✓ Gmail token: id=${r.id} gebruiker=${r.gebruiker_id}`);
  console.log(`  expires: ${r.expires_at} (${mins > 0 ? `${mins} min` : "EXPIRED, wordt auto-refreshed"})`);
  console.log(`  laatst bijgewerkt: ${r.bijgewerkt_op}`);
}
