// Fetch one specific message and show what's in it — diagnose why some
// sync per-email handlers are throwing.
import { createClient } from "@libsql/client";
import { google } from "googleapis";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const messageId = process.argv[2] || "19d7e57b167921ff";
console.log(`Probing message: ${messageId}`);

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const { rows } = await turso.execute("SELECT access_token, refresh_token, expires_at FROM google_tokens WHERE calendar_id = 'gmail' LIMIT 1");

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

try {
  const full = await gmail.users.messages.get({ userId: "me", id: messageId });
  const headers = full.data.payload?.headers || [];
  const from = headers.find(h => h.name?.toLowerCase() === "from")?.value || "?";
  const subject = headers.find(h => h.name?.toLowerCase() === "subject")?.value || "?";
  const date = headers.find(h => h.name?.toLowerCase() === "date")?.value || "?";

  console.log(`\nFrom:    ${from}`);
  console.log(`Subject: ${subject}`);
  console.log(`Date:    ${date}`);

  // Recursively find PDF parts
  function findPdfParts(payload) {
    const results = [];
    if (!payload) return results;
    if (payload.mimeType === "application/pdf" && payload.body?.attachmentId) {
      results.push({ filename: payload.filename, mimeType: payload.mimeType, size: payload.body.size, attachmentId: payload.body.attachmentId });
    }
    for (const p of payload.parts || []) results.push(...findPdfParts(p));
    return results;
  }

  const pdfs = findPdfParts(full.data.payload);
  console.log(`\nPDF attachments: ${pdfs.length}`);
  for (const p of pdfs) {
    console.log(`  ${p.filename}  (${p.mimeType}, ${p.size} bytes)`);
  }

  // Also list all parts to see structure
  function listAllParts(payload, indent = "") {
    if (!payload) return;
    console.log(`${indent}${payload.mimeType || "(no type)"}  filename=${payload.filename || "(none)"}  size=${payload.body?.size || 0}`);
    for (const p of payload.parts || []) listAllParts(p, indent + "  ");
  }
  console.log(`\nPayload structure:`);
  listAllParts(full.data.payload);
} catch (err) {
  console.error("Error:", err.message);
  if (err.response?.data) console.error("Details:", JSON.stringify(err.response.data, null, 2));
}
