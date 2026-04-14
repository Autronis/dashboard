// Reset laatsteSyncOp to 30 days ago so the next sync catches any missed
// transactions (sync uses > laatsteSyncOp as cursor which misses stragglers
// created just before the last sync timestamp). Run once, then trigger sync.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const backdated = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
await turso.execute({
  sql: "UPDATE revolut_verbinding SET laatste_sync_op = ? WHERE is_actief = 1",
  args: [backdated],
});
console.log(`laatste_sync_op gezet op ${backdated}`);
