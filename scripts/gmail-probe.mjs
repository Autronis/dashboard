// Probe the Gmail connection: which email address is it, how many PDFs
// exist in the last 7/14/30 days, and what subjects.
import { createClient } from "@libsql/client";
import { google } from "googleapis";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const { rows } = await turso.execute(
  "SELECT access_token, refresh_token, expires_at FROM google_tokens WHERE calendar_id = 'gmail' LIMIT 1"
);
if (rows.length === 0) { console.log("Geen Gmail token"); process.exit(1); }

const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/auth/google/gmail/callback`
);
oauth2.setCredentials({
  access_token: rows[0].access_token,
  refresh_token: rows[0].refresh_token,
  expiry_date: new Date(rows[0].expires_at).getTime(),
});

const gmail = google.gmail({ version: "v1", auth: oauth2 });

// Which address?
const profile = await gmail.users.getProfile({ userId: "me" });
console.log(`\n📧 Gmail account: ${profile.data.emailAddress}`);
console.log(`   Totaal messages in inbox: ${profile.data.messagesTotal}`);

// Probe different windows
const windows = [
  { label: "laatste 2 dagen", q: "has:attachment filename:pdf newer_than:2d" },
  { label: "laatste 7 dagen", q: "has:attachment filename:pdf newer_than:7d" },
  { label: "laatste 30 dagen", q: "has:attachment filename:pdf newer_than:30d" },
  { label: "alle PDFs ooit", q: "has:attachment filename:pdf" },
];

for (const w of windows) {
  const list = await gmail.users.messages.list({ userId: "me", q: w.q, maxResults: 10 });
  const n = list.data.messages?.length ?? 0;
  console.log(`\n🔍 ${w.label}: ${n} mails`);
  if (n > 0) {
    for (const m of list.data.messages.slice(0, 5)) {
      const full = await gmail.users.messages.get({ userId: "me", id: m.id });
      const from = full.data.payload.headers.find(h => h.name?.toLowerCase() === "from")?.value || "?";
      const subject = full.data.payload.headers.find(h => h.name?.toLowerCase() === "subject")?.value || "?";
      const date = full.data.payload.headers.find(h => h.name?.toLowerCase() === "date")?.value || "?";
      console.log(`   — ${date.slice(0, 25)}  ${from.slice(0, 40).padEnd(40)}  ${subject.slice(0, 60)}`);
    }
    if (n > 5) console.log(`   ... + ${n - 5} meer`);
  }
}
