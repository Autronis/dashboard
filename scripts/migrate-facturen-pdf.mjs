// ALTER facturen ADD pdf_storage_url — mis uit een eerdere migratie.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Check first if column already exists (idempotent)
const cols = await turso.execute("PRAGMA table_info(facturen)");
if (cols.rows.some((c) => c.name === "pdf_storage_url")) {
  console.log("pdf_storage_url bestaat al — nothing to do");
  process.exit(0);
}

await turso.execute("ALTER TABLE facturen ADD COLUMN pdf_storage_url TEXT");
console.log("✓ ALTER TABLE facturen ADD pdf_storage_url");

const after = await turso.execute("PRAGMA table_info(facturen)");
const hasNow = after.rows.some((c) => c.name === "pdf_storage_url");
console.log(`Verified: pdf_storage_url present = ${hasNow}`);
