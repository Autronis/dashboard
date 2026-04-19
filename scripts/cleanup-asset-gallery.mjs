// One-shot cleanup voor asset_gallery rows met expirede externe URLs
// (Kie.ai tempfile.aiquickdraw.com en fal.media). Alive items worden
// gerescued naar Vercel Blob, dode items worden verwijderd.
//
// Usage:
//   node scripts/cleanup-asset-gallery.mjs            # dry-run
//   node scripts/cleanup-asset-gallery.mjs --apply    # echt doen
import { createClient } from "@libsql/client";
import { put } from "@vercel/blob";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const APPLY = process.argv.includes("--apply");
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const PERSISTENT_HOSTS = ["public.blob.vercel-storage.com", "blob.vercel-storage.com"];
const isPersistent = (url) => {
  try { return PERSISTENT_HOSTS.some((h) => new URL(url).hostname.endsWith(h)); }
  catch { return false; }
};

const rows = (await turso.execute(`
  SELECT id, type, product_naam, afbeelding_url, video_url
  FROM asset_gallery
  WHERE afbeelding_url IS NOT NULL OR video_url IS NOT NULL
`)).rows;

console.log(`Inspecteren: ${rows.length} rijen\n`);

const work = [];
for (const r of rows) {
  const url = r.afbeelding_url || r.video_url;
  const field = r.afbeelding_url ? "afbeelding_url" : "video_url";
  if (!url || isPersistent(url)) continue;
  work.push({ id: r.id, type: r.type, naam: r.product_naam, url, field });
}

console.log(`Externe URLs te checken: ${work.length}`);

const checks = await Promise.all(work.map(async (w) => {
  try {
    const res = await fetch(w.url, { method: "HEAD" });
    return { ...w, status: res.status, ok: res.ok };
  } catch {
    return { ...w, status: 0, ok: false };
  }
}));

const alive = checks.filter((c) => c.ok);
const dead = checks.filter((c) => !c.ok);
console.log(`  Alive (rescue):   ${alive.length}`);
console.log(`  Dead  (delete):   ${dead.length}\n`);

if (alive.length) {
  console.log("Alive items (te rescuen):");
  for (const a of alive) console.log(`  #${a.id} [${a.type}] ${a.naam} -> ${a.url.slice(0, 70)}...`);
  console.log();
}

if (!APPLY) {
  console.log("Dry-run klaar. Run met --apply om uit te voeren.");
  process.exit(0);
}

console.log("=== APPLY ===\n");

let rescued = 0, rescueFailed = 0;
for (const a of alive) {
  try {
    const r = await fetch(a.url);
    if (!r.ok) throw new Error(`fetch ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = a.field === "video_url" ? "mp4" : "png";
    const ct = a.field === "video_url" ? "video/mp4" : "image/png";
    const key = `asset-gallery/${a.id}-${Date.now()}.${ext}`;
    const blob = await put(key, buf, { access: "public", contentType: ct, addRandomSuffix: false });
    await turso.execute({
      sql: `UPDATE asset_gallery SET ${a.field} = ? WHERE id = ?`,
      args: [blob.url, a.id],
    });
    console.log(`  rescued #${a.id} -> ${blob.url}`);
    rescued++;
  } catch (e) {
    console.error(`  FAILED #${a.id}: ${e.message}`);
    rescueFailed++;
  }
}

let deleted = 0;
if (dead.length) {
  const deadIds = dead.map((d) => d.id);
  // Bulk delete in chunks van 100
  for (let i = 0; i < deadIds.length; i += 100) {
    const chunk = deadIds.slice(i, i + 100);
    const placeholders = chunk.map(() => "?").join(",");
    const res = await turso.execute({
      sql: `DELETE FROM asset_gallery WHERE id IN (${placeholders})`,
      args: chunk,
    });
    deleted += res.rowsAffected;
  }
}

console.log(`\nKlaar: ${rescued} gerescued, ${rescueFailed} mislukt, ${deleted} verwijderd.`);
