const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const r = await client.execute({ sql: "SELECT id FROM gebruikers WHERE email LIKE ?", args: ["%sem%"] });
  const auteurId = r.rows.length > 0 ? r.rows[0].id : 1;

  await client.execute("DELETE FROM wiki_artikelen WHERE titel LIKE 'Video 1%'");

  const script = fs.readFileSync(path.join("c:", "Users", "semmi", "OneDrive", "Claude AI", "Business-ideas", "DEMO_VIDEO_SCRIPT.md"), "utf-8");

  await client.execute({
    sql: "INSERT INTO wiki_artikelen (titel, inhoud, categorie, tags, auteur_id, gepubliceerd) VALUES (?, ?, 'templates', ?, ?, 1)",
    args: ["Video 1 \u2014 Het Dashboard (Hoofdvideo)", script, JSON.stringify(["video", "demo", "script"]), auteurId],
  });

  console.log("Script with red voiceover markers uploaded to Turso!");
}

main().catch(console.error);
