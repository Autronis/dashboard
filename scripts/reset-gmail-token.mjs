// Force Gmail row to re-refresh on next call. The bug in google-calendar.ts
// had contaminated this row with a calendar access_token. The refresh_token
// itself is still the correct gmail one (different prefix from the calendar
// row), so refreshing it will yield a fresh gmail.readonly token.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Set expires_at to the past so the route auto-refreshes.
// Null the access_token so any stale-cached state is wiped.
await turso.execute({
  sql: "UPDATE google_tokens SET access_token = '', expires_at = '2025-01-01T00:00:00.000Z', bijgewerkt_op = ? WHERE calendar_id = 'gmail'",
  args: [new Date().toISOString()],
});
console.log("✓ Gmail token gereset — volgende sync zal refreshen met de gmail refresh_token");

const res = await turso.execute("SELECT id, calendar_id, expires_at FROM google_tokens ORDER BY id");
for (const r of res.rows) console.log(`  id=${r.id} cal=${r.calendar_id} expires=${r.expires_at}`);
