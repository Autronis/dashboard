import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const u = await turso.execute("SELECT COUNT(*) as n, COALESCE(SUM(bedrag), 0) as totaal FROM uitgaven WHERE datum >= '2026-01-01'");
console.log(`uitgaven tabel 2026: ${u.rows[0].n} rijen, totaal €${u.rows[0].totaal}`);

const b = await turso.execute("SELECT COUNT(*) as n, COALESCE(SUM(ABS(bedrag)), 0) as totaal FROM bank_transacties WHERE type='af' AND datum >= '2026-01-01'");
console.log(`bank_transacties af 2026: ${b.rows[0].n} rijen, totaal €${b.rows[0].totaal}`);

const f = await turso.execute("SELECT COUNT(*) as n, COALESCE(SUM(bedrag_excl_btw), 0) as totaal FROM facturen WHERE status='betaald' AND betaald_op >= '2026-01-01'");
console.log(`facturen betaald 2026 excl BTW: ${f.rows[0].n} rijen, totaal €${f.rows[0].totaal}`);
