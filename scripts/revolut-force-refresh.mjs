// Clear cached access_token so next sync is forced to refresh.
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

await turso.execute(
  "UPDATE revolut_verbinding SET access_token = NULL, token_verloopt_op = NULL WHERE is_actief = 1"
);
console.log("access_token gewist — volgende sync zal refreshen.");
