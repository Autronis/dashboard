const Database = require("better-sqlite3");
const db = new Database("autronis.db");

// Check bestaande tabellen
const existing = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
console.log("Bestaande tabellen:", existing.join(", "));

// Maak ontbrekende tabellen
db.exec(`
  CREATE TABLE IF NOT EXISTS gebruikers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    wachtwoord_hash TEXT NOT NULL,
    rol TEXT DEFAULT 'admin',
    uurtarief_standaard REAL,
    thema_voorkeur TEXT DEFAULT 'donker',
    twee_factor_geheim TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS klanten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bedrijfsnaam TEXT NOT NULL,
    contactpersoon TEXT,
    email TEXT,
    telefoon TEXT,
    adres TEXT,
    uurtarief REAL,
    notities TEXT,
    is_actief INTEGER DEFAULT 1,
    aangemaakt_door INTEGER REFERENCES gebruikers(id),
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS projecten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    klant_id INTEGER REFERENCES klanten(id),
    naam TEXT NOT NULL,
    omschrijving TEXT,
    status TEXT DEFAULT 'actief',
    voortgang_percentage INTEGER DEFAULT 0,
    deadline TEXT,
    geschatte_uren REAL,
    werkelijke_uren REAL DEFAULT 0,
    is_actief INTEGER DEFAULT 1,
    aangemaakt_door INTEGER REFERENCES gebruikers(id),
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  );
`);

// Seed gebruiker
let semId;
const sem = db.prepare("SELECT id FROM gebruikers WHERE email = ?").get("sem@autronis.com");
if (!sem) {
  const r = db.prepare("INSERT INTO gebruikers (naam, email, wachtwoord_hash, rol, uurtarief_standaard) VALUES (?, ?, ?, ?, ?)").run("Sem", "sem@autronis.com", "hash", "admin", 95);
  semId = r.lastInsertRowid;
  console.log("Gebruiker Sem aangemaakt");
} else {
  semId = sem.id;
}

// Seed klant
let klantId;
const klant = db.prepare("SELECT id FROM klanten WHERE bedrijfsnaam = ?").get("Autronis");
if (!klant) {
  const r = db.prepare("INSERT INTO klanten (bedrijfsnaam, contactpersoon, email) VALUES (?, ?, ?)").run("Autronis", "Sem", "sem@autronis.com");
  klantId = r.lastInsertRowid;
  console.log("Klant Autronis aangemaakt");
} else {
  klantId = klant.id;
}

// Seed projecten
const projectNames = [
  { naam: "Autronis Dashboard", omschrijving: "Intern business dashboard", status: "actief" },
  { naam: "Desktop Agent", omschrijving: "Tauri desktop app met system tray", status: "actief" },
  { naam: "Sales Engine", omschrijving: "Offerte en proposal generator", status: "actief" },
];

for (const p of projectNames) {
  const exists = db.prepare("SELECT id FROM projecten WHERE naam = ?").get(p.naam);
  if (!exists) {
    db.prepare("INSERT INTO projecten (klant_id, naam, omschrijving, status) VALUES (?, ?, ?, ?)").run(klantId, p.naam, p.omschrijving, p.status);
    console.log("Project aangemaakt:", p.naam);
  }
}

const dashboardId = db.prepare("SELECT id FROM projecten WHERE naam = ?").get("Autronis Dashboard").id;
const desktopId = db.prepare("SELECT id FROM projecten WHERE naam = ?").get("Desktop Agent").id;
const salesId = db.prepare("SELECT id FROM projecten WHERE naam = ?").get("Sales Engine").id;

// Verwijder bestaande taken
db.prepare("DELETE FROM taken").run();

const takenData = [
  // Dashboard — Foundation (afgerond)
  { pid: dashboardId, titel: "Dashboard homepage met KPI cards", fase: "Foundation", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Bouw de hoofdpagina met realtime KPI kaarten voor omzet, openstaande facturen en uren. Geeft Sem en Syb direct overzicht bij het openen van het dashboard." },
  { pid: dashboardId, titel: "Sidebar navigatie met actieve states", fase: "Foundation", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Implementeer een vaste zijbalk met navigatielinks en visuele actieve state. Zorgt voor snelle navigatie tussen alle dashboard modules." },
  { pid: dashboardId, titel: "Login pagina met iron-session auth", fase: "Foundation", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Maak een beveiligde loginpagina met cookie-based sessies en rate limiting. Voorkomt ongeautoriseerde toegang tot bedrijfsgegevens." },
  { pid: dashboardId, titel: "Klanten CRUD met soft delete", fase: "Foundation", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Bouw volledig klantbeheer met aanmaken, bewerken en soft delete functionaliteit. Klantgegevens blijven behouden voor historische rapportages." },
  { pid: dashboardId, titel: "Projecten overzicht per klant", fase: "Foundation", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Toon alle projecten gegroepeerd per klant met status en voortgang. Maakt het makkelijk om te zien waar elk project staat." },
  { pid: dashboardId, titel: "Tijdregistratie met live timer", fase: "Foundation", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Implementeer een live timer die uren bijhoudt per project met start/stop functionaliteit. Essentieel voor nauwkeurige facturatie op basis van gewerkte uren." },
  { pid: dashboardId, titel: "Facturen systeem met PDF generatie", fase: "Foundation", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Bouw een compleet factuursysteem met automatische nummering en PDF export. Stroomlijnt het facturatieproces en zorgt voor professionele facturen." },
  { pid: dashboardId, titel: "Analytics dashboard met grafieken", fase: "Foundation", status: "afgerond", prio: "normaal", uitv: "claude", omschr: "Maak een analytics pagina met omzet- en urengrafieken in pure CSS. Geeft inzicht in bedrijfsprestaties zonder externe chart libraries." },
  { pid: dashboardId, titel: "CRM/Leads pipeline", fase: "Foundation", status: "afgerond", prio: "normaal", uitv: "claude", omschr: "Bouw een lead pipeline met statusfasen van nieuw tot gewonnen/verloren. Helpt bij het bijhouden van potentiele klanten en verkoopkansen." },
  { pid: dashboardId, titel: "Agenda met maandweergave", fase: "Foundation", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Implementeer een kalenderweergave met maandoverzicht voor afspraken en deadlines. Voorkomt dat belangrijke data gemist worden." },
  { pid: dashboardId, titel: "Instellingen pagina", fase: "Foundation", status: "afgerond", prio: "normaal", uitv: "claude", omschr: "Maak een instellingenpagina voor bedrijfsgegevens, BTW-tarieven en betalingstermijnen. Centraliseert alle configuratie op een plek." },
  { pid: dashboardId, titel: "Taken pagina met project groepering", fase: "Foundation", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Bouw een takenoverzicht gegroepeerd per project met filters op status en prioriteit. Houdt alle werkzaamheden overzichtelijk en geprioriteerd." },

  // Dashboard — Intelligence (afgerond)
  { pid: dashboardId, titel: "Gewoontes tracker (habit widget)", fase: "Intelligence", status: "afgerond", prio: "normaal", uitv: "claude", omschr: "Implementeer een dagelijkse gewoontes tracker met streak-telling en statistieken. Helpt Sem bij het opbouwen van productieve routines." },
  { pid: dashboardId, titel: "Concurrenten analyse scanner", fase: "Intelligence", status: "afgerond", prio: "normaal", uitv: "claude", omschr: "Bouw een tool die concurrenten websites scant op wijzigingen en nieuwe content. Houdt Autronis op de hoogte van marktbewegingen." },
  { pid: dashboardId, titel: "Google Calendar sync (OAuth)", fase: "Intelligence", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Koppel Google Calendar via OAuth2 zodat agenda-items automatisch synchroniseren. Voorkomt dubbele invoer en houdt alles up-to-date." },
  { pid: dashboardId, titel: "Agenda dag/week/jaar views met tijdslots", fase: "Intelligence", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Voeg dag-, week- en jaarweergaven toe met visuele tijdslots. Geeft flexibiliteit in hoe je je planning bekijkt en plant." },
  { pid: dashboardId, titel: "Banner content generator", fase: "Intelligence", status: "afgerond", prio: "normaal", uitv: "claude", omschr: "Maak een tool die social media banners genereert met Autronis branding. Bespaart tijd bij het maken van marketing content." },
  { pid: dashboardId, titel: "Case studies pagina", fase: "Intelligence", status: "afgerond", prio: "normaal", uitv: "claude", omschr: "Bouw een pagina voor het documenteren van klantprojecten als case studies. Versterkt de sales pitch met bewezen resultaten." },
  { pid: dashboardId, titel: "Daily briefing API", fase: "Intelligence", status: "afgerond", prio: "normaal", uitv: "claude", omschr: "Maak een API die elke ochtend een samenvatting geeft van taken, afspraken en deadlines. Zorgt voor een gestructureerde start van de werkdag." },

  // Dashboard — Automation (open/bezig)
  { pid: dashboardId, titel: "Notificaties API route voor desktop agent", fase: "Automation", status: "open", prio: "normaal", uitv: "claude", omschr: "Bouw een API endpoint dat notificaties pusht naar de desktop agent. Zorgt ervoor dat Sem meldingen krijgt zonder het dashboard open te hebben." },
  { pid: dashboardId, titel: "Screen time productiviteit insights", fase: "Automation", status: "open", prio: "laag", uitv: "claude", omschr: "Analyseer screen time data om productiviteitspatronen te herkennen. Geeft inzicht in welke apps en websites de meeste tijd kosten." },
  { pid: dashboardId, titel: "Oude routes opruimen (/tijdregistratie redirect)", fase: "Automation", status: "open", prio: "laag", uitv: "claude", omschr: "Verwijder verouderde routes en voeg redirects toe voor oude URLs. Voorkomt 404-fouten en houdt de codebase schoon." },
  { pid: dashboardId, titel: "Daily Briefing + Learning Radar koppeling", fase: "Automation", status: "open", prio: "normaal", uitv: "claude", omschr: "Integreer de daily briefing met learning radar data voor gepersonaliseerde leersuggesties. Combineert dagplanning met kennisverbreding." },

  // Dashboard — Scale (open)
  { pid: dashboardId, titel: "Klant portal (extern toegankelijk)", fase: "Scale", status: "open", prio: "laag", uitv: "claude", omschr: "Bouw een extern portaal waar klanten hun projectstatus en facturen kunnen inzien. Vermindert communicatie-overhead en verhoogt transparantie." },
  { pid: dashboardId, titel: "PWA push notifications", fase: "Scale", status: "open", prio: "laag", uitv: "claude", omschr: "Voeg push notificaties toe via de PWA zodat meldingen ook op mobiel werken. Belangrijk voor het niet missen van deadlines en afspraken." },
  { pid: dashboardId, titel: "Vercel deployment configureren", fase: "Scale", status: "open", prio: "hoog", uitv: "handmatig", omschr: "Stel Vercel in met environment variables en custom domain voor productie. Maakt het dashboard toegankelijk buiten het lokale netwerk." },

  // Desktop Agent
  { pid: desktopId, titel: "Tauri app basis met system tray", fase: "Setup", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Zet de Tauri desktop applicatie op met een system tray icoon. Vormt de basis voor alle desktop functionaliteit." },
  { pid: desktopId, titel: "Auto-start Next.js server", fase: "Setup", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Start de Next.js server automatisch wanneer de desktop app opent. Zorgt dat het dashboard direct beschikbaar is zonder handmatig commando's." },
  { pid: desktopId, titel: "Native window met webview", fase: "Setup", status: "afgerond", prio: "hoog", uitv: "claude", omschr: "Render het dashboard in een native window via Tauri webview. Geeft een desktop-app gevoel in plaats van een browser tab." },
  { pid: desktopId, titel: "Focus timer met notificaties", fase: "Features", status: "afgerond", prio: "normaal", uitv: "claude", omschr: "Bouw een Pomodoro-achtige focus timer met native Windows notificaties. Helpt bij geconcentreerd werken met regelmatige pauzes." },
  { pid: desktopId, titel: "Screen time tracking (active window)", fase: "Features", status: "afgerond", prio: "normaal", uitv: "claude", omschr: "Track welke applicaties actief zijn en hoe lang ze gebruikt worden. Geeft inzicht in tijdsbesteding per app, vergelijkbaar met Rize." },
  { pid: desktopId, titel: "System monitor widget (CPU/RAM/NET)", fase: "Features", status: "afgerond", prio: "normaal", uitv: "claude", omschr: "Toon real-time systeemstatistieken zoals CPU, geheugen en netwerkgebruik. Handig om te zien of het systeem overbelast raakt tijdens het werken." },
  { pid: desktopId, titel: "Windows autostart bij boot", fase: "Features", status: "open", prio: "normaal", uitv: "claude", omschr: "Configureer de desktop agent om automatisch te starten bij Windows opstart. Zorgt dat tracking en notificaties altijd actief zijn." },

  // Sales Engine
  { pid: salesId, titel: "Database schema voor proposals", fase: "Design", status: "open", prio: "hoog", uitv: "claude", omschr: "Ontwerp het database schema voor offertes met regels, statussen en klantrelaties. Vormt de basis van het hele sales engine systeem." },
  { pid: salesId, titel: "Offerte template systeem", fase: "Build", status: "open", prio: "hoog", uitv: "claude", omschr: "Bouw een template systeem waarmee offertes snel samengesteld worden uit herbruikbare blokken. Bespaart tijd bij het maken van nieuwe offertes." },
  { pid: salesId, titel: "AI-gegenereerde offerte teksten", fase: "Build", status: "open", prio: "normaal", uitv: "claude", omschr: "Genereer professionele offerte teksten via AI op basis van projectbeschrijving en klantgegevens. Maakt offertes sneller en consistenter." },
  { pid: salesId, titel: "PDF export voor offertes", fase: "Build", status: "open", prio: "normaal", uitv: "claude", omschr: "Exporteer offertes als professionele PDF documenten met Autronis branding. Essentieel voor het versturen van offertes naar klanten." },
  { pid: salesId, titel: "Klant tracking en follow-up", fase: "Build", status: "open", prio: "normaal", uitv: "claude", omschr: "Bouw een systeem dat bijhoudt wanneer offertes geopend worden en follow-ups plant. Verhoogt de conversie door tijdig opvolgen." },
  { pid: salesId, titel: "Offerte templates ontwerpen in Figma", fase: "Design", status: "open", prio: "normaal", uitv: "handmatig", omschr: "Ontwerp visueel aantrekkelijke offerte templates in Figma met Autronis huisstijl. Bepaalt de look en feel van alle uitgaande offertes." },

  // Handmatige taken
  { pid: dashboardId, titel: "Google Cloud OAuth credentials instellen", fase: "Intelligence", status: "afgerond", prio: "hoog", uitv: "handmatig", omschr: "Stel OAuth2 credentials in via Google Cloud Console voor Calendar API toegang. Noodzakelijk voor de Google Calendar synchronisatie." },
  { pid: dashboardId, titel: "Bedrijfsgegevens invullen (KvK, BTW, IBAN)", fase: "Foundation", status: "open", prio: "normaal", uitv: "handmatig", omschr: "Vul de echte Autronis bedrijfsgegevens in op de instellingen pagina. Nodig voor correcte facturen en juridische compliance." },
];

const stmt = db.prepare("INSERT INTO taken (project_id, titel, omschrijving, fase, status, prioriteit, uitvoerder, volgorde, aangemaakt_op) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))");

let i = 0;
for (const t of takenData) {
  stmt.run(t.pid, t.titel, t.omschr, t.fase, t.status, t.prio, t.uitv, i);
  i++;
}

console.log(`${i} taken geseeded!`);
console.log("Klaar!");
db.close();
