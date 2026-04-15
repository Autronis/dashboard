import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const cols = await turso.execute("PRAGMA table_info(facturen)");
console.log(`facturen kolommen (${cols.rows.length}):`);
for (const c of cols.rows) {
  console.log(`  ${c.name}  ${c.type}${c.notnull ? " NOT NULL" : ""}${c.pk ? " PK" : ""}`);
}

const hasPdf = cols.rows.some((c) => c.name === "pdf_storage_url");
console.log(`\npdf_storage_url aanwezig: ${hasPdf ? "JA" : "NEE — moet toegevoegd worden"}`);
