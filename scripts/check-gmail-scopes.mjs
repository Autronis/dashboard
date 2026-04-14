// Ask Google directly what scopes the stored access_token actually has.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const { rows } = await turso.execute("SELECT access_token FROM google_tokens WHERE calendar_id = 'gmail' LIMIT 1");

const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${rows[0].access_token}`);
const data = await res.json();
console.log("Token info:", JSON.stringify(data, null, 2));
