const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const db = new Database(path.join(__dirname, "data", "autronis.db"));

// Delete existing screen time for today
db.exec("DELETE FROM screen_time_entries WHERE start_tijd LIKE '2026-03-31%'");
// Delete existing tijdregistraties for today
db.exec("DELETE FROM tijdregistraties WHERE start_tijd LIKE '2026-03-31%'");

const stmt = db.prepare("INSERT INTO screen_time_entries (client_id, gebruiker_id, app, venster_titel, url, categorie, project_id, klant_id, start_tijd, eind_tijd, duur_seconden, bron) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agent')");

// Ochtend
stmt.run(crypto.randomUUID(), "VS Code", "Website Redesign - hero-section.tsx", null, "development", 1, 1, "2026-03-31T08:17:00", "2026-03-31T09:43:00", 5160);
stmt.run(crypto.randomUUID(), "Slack", "Autronis - #dev", null, "communicatie", null, null, "2026-03-31T09:43:00", "2026-03-31T09:51:00", 480);
stmt.run(crypto.randomUUID(), "VS Code", "Website Redesign - portfolio-grid.tsx", null, "development", 1, 1, "2026-03-31T09:53:00", "2026-03-31T11:22:00", 5340);
stmt.run(crypto.randomUUID(), "Chrome", "Framer Motion API docs", "https://motion.dev/docs", "development", 1, 1, "2026-03-31T11:22:00", "2026-03-31T11:38:00", 960);
stmt.run(crypto.randomUUID(), "VS Code", "Website Redesign - animations.ts", null, "development", 1, 1, "2026-03-31T11:40:00", "2026-03-31T12:14:00", 2040);

// Middag
stmt.run(crypto.randomUUID(), "Google Meet", "Sprint review GreenLogic", null, "meeting", 3, 2, "2026-03-31T13:02:00", "2026-03-31T13:54:00", 3120);
stmt.run(crypto.randomUUID(), "Notion", "Meeting notes - GreenLogic", null, "administratie", 3, 2, "2026-03-31T13:54:00", "2026-03-31T14:11:00", 1020);
stmt.run(crypto.randomUUID(), "VS Code", "SportFusion - websocket-handler.ts", null, "development", 7, 4, "2026-03-31T14:17:00", "2026-03-31T15:48:00", 5460);
stmt.run(crypto.randomUUID(), "Chrome", "Socket.io v4 docs", "https://socket.io/docs/v4", "development", 7, 4, "2026-03-31T15:48:00", "2026-03-31T16:03:00", 900);
stmt.run(crypto.randomUUID(), "VS Code", "SportFusion - realtime-leaderboard.tsx", null, "development", 7, 4, "2026-03-31T16:06:00", "2026-03-31T17:23:00", 4620);
stmt.run(crypto.randomUUID(), "Slack", "DM met Syb - planning morgen", null, "communicatie", null, null, "2026-03-31T17:23:00", "2026-03-31T17:31:00", 480);
stmt.run(crypto.randomUUID(), "Notion", "Weekplanning bijwerken", null, "administratie", null, null, "2026-03-31T17:33:00", "2026-03-31T17:52:00", 1140);

// Daily summary
db.prepare("INSERT OR REPLACE INTO screen_time_samenvattingen (gebruiker_id, datum, samenvatting_kort, totaal_seconden, productief_percentage, top_project) VALUES (1, '2026-03-31', 'Productieve dag. Website animaties afgerond, GreenLogic sprint review, en SportFusion websockets.', 30720, 91, 'Website Redesign')").run();

// Tijdregistraties for today
const tr = db.prepare("INSERT INTO tijdregistraties (gebruiker_id, project_id, omschrijving, start_tijd, eind_tijd, duur_minuten, categorie, is_handmatig) VALUES (?, ?, ?, ?, ?, ?, ?, 0)");
tr.run(1, 1, "Hero section en portfolio grid gebouwd", "2026-03-31T08:17:00", "2026-03-31T12:14:00", 237, "development");
tr.run(1, 3, "Sprint review GreenLogic dashboard", "2026-03-31T13:02:00", "2026-03-31T14:11:00", 69, "meeting");
tr.run(1, 7, "Websocket handler en real-time leaderboard", "2026-03-31T14:17:00", "2026-03-31T17:23:00", 186, "development");

console.log("Added 12 screen time entries for today");
console.log("Added 3 tijdregistraties for today");
console.log("Total: ~8.5 uur development, 1 uur meeting, 30 min admin");
db.close();
