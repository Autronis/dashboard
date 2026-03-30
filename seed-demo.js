// seed-demo.js — Comprehensive realistic demo data for Autronis dashboard
// Run: node seed-demo.js

const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'autronis.db');
const db = new Database(dbPath);

// ─── HELPERS ───────────────────────────────────────────
function dt(dateStr) {
  return dateStr; // SQLite stores as text
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pad(n) {
  return n.toString().padStart(2, '0');
}

function randomTime(hourMin, hourMax) {
  const h = randomBetween(hourMin, hourMax);
  const m = randomBetween(0, 59);
  return `${pad(h)}:${pad(m)}`;
}

function addHours(timeStr, hours) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = h * 60 + m + Math.round(hours * 60);
  const newH = Math.min(Math.floor(totalMinutes / 60), 23);
  const newM = totalMinutes % 60;
  return `${pad(newH)}:${pad(newM)}`;
}

function isWeekday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

function getWeekdays(startDate, endDate) {
  const days = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    if (isWeekday(current.toISOString().slice(0, 10))) {
      days.push(current.toISOString().slice(0, 10));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── START ─────────────────────────────────────────────
console.log('Seeding demo data into:', dbPath);
console.log('');

// 1. Disable FK, clear all tables
db.pragma('foreign_keys = OFF');

const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' AND name NOT LIKE '__drizzle%' AND name NOT LIKE '_litestream%'"
).all().map(r => r.name);

for (const table of tables) {
  db.prepare(`DELETE FROM "${table}"`).run();
}
console.log(`Cleared ${tables.length} tables`);

// Re-enable FK
db.pragma('foreign_keys = ON');

// ─── USERS ─────────────────────────────────────────────
const passwordHash = bcrypt.hashSync('Autronis2026!', 10);

db.prepare(`INSERT INTO gebruikers (id, naam, email, wachtwoord_hash, rol, uurtarief_standaard, thema_voorkeur, aangemaakt_op, bijgewerkt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  1, 'Sem Gijsberts', 'sem@autronis.com', passwordHash, 'admin', 95, 'donker', '2025-06-01 09:00:00', '2026-03-29 10:00:00'
);
db.prepare(`INSERT INTO gebruikers (id, naam, email, wachtwoord_hash, rol, uurtarief_standaard, thema_voorkeur, aangemaakt_op, bijgewerkt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  2, 'Syb Miedema', 'syb@autronis.com', passwordHash, 'gebruiker', 85, 'donker', '2025-06-15 09:00:00', '2026-03-29 10:00:00'
);
console.log('Inserted 2 users');

// ─── BEDRIJFSINSTELLINGEN ──────────────────────────────
db.prepare(`INSERT INTO bedrijfsinstellingen (id, bedrijfsnaam, adres, kvk_nummer, btw_nummer, iban, email, telefoon, standaard_btw, betalingstermijn_dagen, herinnering_na_dagen)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  1, 'Autronis', 'Edisonstraat 60, 7006 RE Doetinchem', '98329413', 'NL004944922B54', 'NL59REVO5327845486', 'zakelijk@autronis.com', '+31 6 12345678', 21, 30, 7
);
console.log('Inserted bedrijfsinstellingen');

// ─── KLANTEN ───────────────────────────────────────────
const klantenData = [
  { id: 1, bedrijfsnaam: 'Veldhuis Architecten', contactpersoon: 'Mark Veldhuis', email: 'mark@veldhuis-architecten.nl', telefoon: '+31 6 28374651', adres: 'Prinsengracht 412, 1016 JK Amsterdam', uurtarief: 105, branche: 'Architectuur', website: 'https://veldhuis-architecten.nl', kvk_nummer: '72345891', btw_nummer: 'NL861234567B01', aantal_medewerkers: '15-25', diensten: '["Website redesign","3D Portfolio","Klantportaal"]', tech_stack: '["WordPress","Revit","BIM"]', klant_sinds: '2025-09-01', aangemaakt_door: 1 },
  { id: 2, bedrijfsnaam: 'GreenLogic BV', contactpersoon: 'Lisa de Vries', email: 'l.devries@greenlogic.nl', telefoon: '+31 6 93847562', adres: 'Industrieweg 88, 3044 AH Rotterdam', uurtarief: 95, branche: 'Duurzame logistiek', website: 'https://greenlogic.nl', kvk_nummer: '81234576', btw_nummer: 'NL862345678B01', aantal_medewerkers: '25-50', diensten: '["Dashboard","Route-optimalisatie","CO2 rapportage"]', tech_stack: '["SAP","Azure","Power BI"]', klant_sinds: '2025-10-15', aangemaakt_door: 1 },
  { id: 3, bedrijfsnaam: 'Bakkerij van Dijk', contactpersoon: 'Jan van Dijk', email: 'info@bakkerijvandijk.nl', telefoon: '+31 6 45678923', adres: 'Dorpsstraat 12, 7071 BS Ulft', uurtarief: 85, branche: 'Food & Retail', website: 'https://bakkerijvandijk.nl', kvk_nummer: '65432198', btw_nummer: 'NL863456789B01', aantal_medewerkers: '5-10', diensten: '["Webshop","Bestelapp","Social media"]', tech_stack: '["Lightspeed","Instagram"]', klant_sinds: '2025-11-01', aangemaakt_door: 2 },
  { id: 4, bedrijfsnaam: 'SportFusion', contactpersoon: 'Thomas Bakker', email: 'thomas@sportfusion.nl', telefoon: '+31 6 78234561', adres: 'Stadionplein 5, 5612 AB Eindhoven', uurtarief: 110, branche: 'Sports tech', website: 'https://sportfusion.nl', kvk_nummer: '78901234', btw_nummer: 'NL864567890B01', aantal_medewerkers: '10-15', diensten: '["Trainingsplatform","Wearable integratie","AI coaching"]', tech_stack: '["React Native","Firebase","TensorFlow"]', klant_sinds: '2025-08-20', aangemaakt_door: 1 },
  { id: 5, bedrijfsnaam: 'De Gouden Draak', contactpersoon: 'Wei Chen', email: 'wei@degoudendraak.nl', telefoon: '+31 6 34567891', adres: 'Marktplein 7, 7001 BJ Doetinchem', uurtarief: 80, branche: 'Horeca', website: 'https://degoudendraak.nl', kvk_nummer: '56789012', btw_nummer: 'NL865678901B01', aantal_medewerkers: '10-15', diensten: '["Website","Reserveringssysteem","QR-menu"]', tech_stack: '["Next.js","Stripe"]', klant_sinds: '2026-01-10', aangemaakt_door: 2 },
  { id: 6, bedrijfsnaam: 'Nextera Solutions', contactpersoon: 'Pieter van Houten', email: 'pieter@nextera.nl', telefoon: '+31 6 56789234', adres: 'Zuidas 200, 1082 MD Amsterdam', uurtarief: 95, branche: 'IT Consultancy', website: 'https://nextera.nl', kvk_nummer: '89012345', btw_nummer: 'NL866789012B01', aantal_medewerkers: '50-100', diensten: '["Intranet","Kennisbank","API platform"]', tech_stack: '["Microsoft 365","Azure DevOps"]', klant_sinds: '2025-12-01', aangemaakt_door: 1 },
  { id: 7, bedrijfsnaam: 'Bloem & Blad', contactpersoon: 'Sophie Jansen', email: 'sophie@bloemenblad.nl', telefoon: '+31 6 67891234', adres: 'Kerkstraat 23, 6811 DA Arnhem', uurtarief: 85, branche: 'Retail', website: 'https://bloemenblad.nl', kvk_nummer: '90123456', btw_nummer: 'NL867890123B01', aantal_medewerkers: '3-5', diensten: '["Webshop","Bezorgtracking","Social media"]', tech_stack: '["Shopify","Canva"]', klant_sinds: '2026-01-15', aangemaakt_door: 2 },
  { id: 8, bedrijfsnaam: 'Van den Berg Advocaten', contactpersoon: 'Mr. R.J. van den Berg', email: 'info@vandenbergadvocaten.nl', telefoon: '+31 6 12348765', adres: 'Utrechtsestraat 90, 6811 LT Arnhem', uurtarief: 110, branche: 'Juridisch', website: 'https://vandenbergadvocaten.nl', kvk_nummer: '12345890', btw_nummer: 'NL868901234B01', aantal_medewerkers: '15-25', diensten: '["Klantportaal","Documentbeheer","Intake automatisering"]', tech_stack: '["Legal Files","Microsoft 365"]', klant_sinds: '2025-07-01', aangemaakt_door: 1 },
];

const insertKlant = db.prepare(`INSERT INTO klanten (id, bedrijfsnaam, contactpersoon, email, telefoon, adres, uurtarief, branche, website, kvk_nummer, btw_nummer, aantal_medewerkers, diensten, tech_stack, klant_sinds, aangemaakt_door, is_actief, klant_type, aangemaakt_op, bijgewerkt_op)
  VALUES (@id, @bedrijfsnaam, @contactpersoon, @email, @telefoon, @adres, @uurtarief, @branche, @website, @kvk_nummer, @btw_nummer, @aantal_medewerkers, @diensten, @tech_stack, @klant_sinds, @aangemaakt_door, 1, 'klant', '2025-06-01 09:00:00', '2026-03-29 10:00:00')`);

for (const k of klantenData) {
  insertKlant.run(k);
}
console.log(`Inserted ${klantenData.length} klanten`);

// ─── PROJECTEN ─────────────────────────────────────────
const projectenData = [
  // Actief (9)
  { id: 1,  klant_id: 1, naam: 'Website Redesign Veldhuis',             omschrijving: 'Volledig nieuwe website met 3D portfolio showcase en interactieve projectpresentaties', status: 'actief', voortgang_percentage: 72, deadline: '2026-05-15', geschatte_uren: 180, werkelijke_uren: 129.5, aangemaakt_door: 1 },
  { id: 2,  klant_id: 2, naam: 'GreenLogic Dashboard',                  omschrijving: 'Real-time logistiek dashboard met CO2 rapportage en route-optimalisatie', status: 'actief', voortgang_percentage: 45, deadline: '2026-06-30', geschatte_uren: 240, werkelijke_uren: 108, aangemaakt_door: 1 },
  { id: 3,  klant_id: 3, naam: 'Webshop Bakkerij van Dijk',             omschrijving: 'E-commerce platform voor brood, gebak en catering met bezorgplanning', status: 'actief', voortgang_percentage: 88, deadline: '2026-04-15', geschatte_uren: 120, werkelijke_uren: 105.5, aangemaakt_door: 2 },
  { id: 4,  klant_id: 4, naam: 'SportFusion Trainingsplatform',         omschrijving: 'AI-gedreven trainingsapp met wearable integratie en voortgangsanalyse', status: 'actief', voortgang_percentage: 35, deadline: '2026-08-01', geschatte_uren: 320, werkelijke_uren: 112, aangemaakt_door: 1 },
  { id: 5,  klant_id: 5, naam: 'Reserveringssysteem De Gouden Draak',   omschrijving: 'Online reserveringssysteem met tafelindeling en QR-menu', status: 'actief', voortgang_percentage: 60, deadline: '2026-04-30', geschatte_uren: 80, werkelijke_uren: 48, aangemaakt_door: 2 },
  { id: 6,  klant_id: 6, naam: 'Nextera Intranet Portal',               omschrijving: 'Modern intranet met kennisbank, projectdashboard en medewerkerprofielen', status: 'actief', voortgang_percentage: 52, deadline: '2026-07-15', geschatte_uren: 200, werkelijke_uren: 104, aangemaakt_door: 1 },
  { id: 7,  klant_id: 7, naam: 'Webshop Bloem & Blad',                  omschrijving: 'Shopify-based webshop met bezorgtracking en seizoensboeketten', status: 'actief', voortgang_percentage: 15, deadline: '2026-06-01', geschatte_uren: 60, werkelijke_uren: 9, aangemaakt_door: 2 },
  { id: 8,  klant_id: 8, naam: 'Klantportaal Van den Berg Advocaten',   omschrijving: 'Beveiligd klantportaal met documentbeheer, dossierstatus en communicatie', status: 'actief', voortgang_percentage: 78, deadline: '2026-05-01', geschatte_uren: 160, werkelijke_uren: 124.5, aangemaakt_door: 1 },
  { id: 9,  klant_id: 4, naam: 'SportFusion Marketing Website',         omschrijving: 'Marketing landingspagina met animaties en lead capture', status: 'actief', voortgang_percentage: 90, deadline: '2026-04-10', geschatte_uren: 40, werkelijke_uren: 36, aangemaakt_door: 2 },
  // Afgerond (3)
  { id: 10, klant_id: 1, naam: 'Veldhuis Brand Identity',               omschrijving: 'Visuele identiteit inclusief logo, kleurenpalet en typografie', status: 'afgerond', voortgang_percentage: 100, deadline: '2025-12-01', geschatte_uren: 40, werkelijke_uren: 38.5, aangemaakt_door: 1 },
  { id: 11, klant_id: 8, naam: 'Intake Automatisering VdB',             omschrijving: 'Geautomatiseerd intakeformulier met AI-classificatie van juridische zaken', status: 'afgerond', voortgang_percentage: 100, deadline: '2026-01-31', geschatte_uren: 60, werkelijke_uren: 55, aangemaakt_door: 2 },
  { id: 12, klant_id: 5, naam: 'QR-menu De Gouden Draak',               omschrijving: 'Digitaal menu met QR-codes, meertalig en foto-integratie', status: 'afgerond', voortgang_percentage: 100, deadline: '2026-02-15', geschatte_uren: 20, werkelijke_uren: 18, aangemaakt_door: 2 },
  // On-hold (2)
  { id: 13, klant_id: 3, naam: 'Bakkerij App (Fase 2)',                  omschrijving: 'Native mobiele app voor bestelgegevens en loyaliteitsprogramma', status: 'on-hold', voortgang_percentage: 10, deadline: '2026-09-01', geschatte_uren: 200, werkelijke_uren: 20, aangemaakt_door: 1 },
  { id: 14, klant_id: 6, naam: 'Nextera API Platform',                  omschrijving: 'Centraal API platform met documentatie en rate limiting', status: 'on-hold', voortgang_percentage: 5, deadline: '2026-10-01', geschatte_uren: 160, werkelijke_uren: 8, aangemaakt_door: 2 },
];

const insertProject = db.prepare(`INSERT INTO projecten (id, klant_id, naam, omschrijving, status, voortgang_percentage, deadline, geschatte_uren, werkelijke_uren, is_actief, aangemaakt_door, aangemaakt_op, bijgewerkt_op)
  VALUES (@id, @klant_id, @naam, @omschrijving, @status, @voortgang_percentage, @deadline, @geschatte_uren, @werkelijke_uren, 1, @aangemaakt_door, '2025-08-01 09:00:00', '2026-03-29 10:00:00')`);

for (const p of projectenData) {
  insertProject.run(p);
}
console.log(`Inserted ${projectenData.length} projecten`);

// ─── TAKEN ─────────────────────────────────────────────
const takenData = [
  // Project 1 - Website Redesign Veldhuis
  { id: 1,  project_id: 1, toegewezen_aan: 1, titel: 'Wireframes homepage en projectpagina', status: 'afgerond', deadline: '2026-02-01', prioriteit: 'hoog' },
  { id: 2,  project_id: 1, toegewezen_aan: 2, titel: 'Component library opzetten in Figma', status: 'afgerond', deadline: '2026-02-10', prioriteit: 'hoog' },
  { id: 3,  project_id: 1, toegewezen_aan: 1, titel: 'Next.js project setup en routing', status: 'afgerond', deadline: '2026-02-15', prioriteit: 'hoog' },
  { id: 4,  project_id: 1, toegewezen_aan: 2, titel: '3D portfolio viewer implementeren', status: 'bezig', deadline: '2026-04-01', prioriteit: 'hoog' },
  { id: 5,  project_id: 1, toegewezen_aan: 1, titel: 'CMS integratie voor projectcontent', status: 'bezig', deadline: '2026-04-10', prioriteit: 'normaal' },
  { id: 6,  project_id: 1, toegewezen_aan: 2, titel: 'Responsive styling en animaties', status: 'open', deadline: '2026-04-20', prioriteit: 'normaal' },

  // Project 2 - GreenLogic Dashboard
  { id: 7,  project_id: 2, toegewezen_aan: 1, titel: 'Database schema CO2 metingen', status: 'afgerond', deadline: '2026-01-20', prioriteit: 'hoog' },
  { id: 8,  project_id: 2, toegewezen_aan: 2, titel: 'API endpoints route-optimalisatie', status: 'afgerond', deadline: '2026-02-01', prioriteit: 'hoog' },
  { id: 9,  project_id: 2, toegewezen_aan: 1, titel: 'Real-time dashboard met WebSockets', status: 'bezig', deadline: '2026-04-15', prioriteit: 'hoog' },
  { id: 10, project_id: 2, toegewezen_aan: 2, titel: 'Kaartintegratie met routeweergave', status: 'bezig', deadline: '2026-04-20', prioriteit: 'normaal' },
  { id: 11, project_id: 2, toegewezen_aan: 1, titel: 'CO2 rapportage PDF export', status: 'open', deadline: '2026-05-01', prioriteit: 'normaal' },

  // Project 3 - Webshop Bakkerij van Dijk
  { id: 12, project_id: 3, toegewezen_aan: 2, titel: 'Productcatalogus en categorieën', status: 'afgerond', deadline: '2026-01-15', prioriteit: 'hoog' },
  { id: 13, project_id: 3, toegewezen_aan: 1, titel: 'Winkelwagen en checkout flow', status: 'afgerond', deadline: '2026-02-01', prioriteit: 'hoog' },
  { id: 14, project_id: 3, toegewezen_aan: 2, titel: 'Mollie betaalintegratie', status: 'afgerond', deadline: '2026-02-15', prioriteit: 'hoog' },
  { id: 15, project_id: 3, toegewezen_aan: 1, titel: 'Bezorgplanning algoritme', status: 'bezig', deadline: '2026-03-30', prioriteit: 'hoog' },
  { id: 16, project_id: 3, toegewezen_aan: 2, titel: 'Performance optimalisatie en testen', status: 'open', deadline: '2026-04-10', prioriteit: 'normaal' },

  // Project 4 - SportFusion Trainingsplatform
  { id: 17, project_id: 4, toegewezen_aan: 1, titel: 'User stories en technisch ontwerp', status: 'afgerond', deadline: '2026-01-10', prioriteit: 'hoog' },
  { id: 18, project_id: 4, toegewezen_aan: 2, titel: 'React Native app scaffolding', status: 'afgerond', deadline: '2026-01-25', prioriteit: 'hoog' },
  { id: 19, project_id: 4, toegewezen_aan: 1, titel: 'Workout tracking module', status: 'bezig', deadline: '2026-04-15', prioriteit: 'hoog' },
  { id: 20, project_id: 4, toegewezen_aan: 2, titel: 'Wearable API integratie (Garmin/Fitbit)', status: 'open', deadline: '2026-05-01', prioriteit: 'normaal' },
  { id: 21, project_id: 4, toegewezen_aan: 1, titel: 'AI coaching engine ontwikkelen', status: 'open', deadline: '2026-06-01', prioriteit: 'normaal' },

  // Project 5 - Reserveringssysteem De Gouden Draak
  { id: 22, project_id: 5, toegewezen_aan: 2, titel: 'Reserveringsformulier en validatie', status: 'afgerond', deadline: '2026-02-01', prioriteit: 'hoog' },
  { id: 23, project_id: 5, toegewezen_aan: 1, titel: 'Tafelindeling visuele editor', status: 'bezig', deadline: '2026-04-01', prioriteit: 'hoog' },
  { id: 24, project_id: 5, toegewezen_aan: 2, titel: 'E-mail bevestigingen en reminders', status: 'bezig', deadline: '2026-04-10', prioriteit: 'normaal' },

  // Project 6 - Nextera Intranet Portal
  { id: 25, project_id: 6, toegewezen_aan: 1, titel: 'Azure AD SSO integratie', status: 'afgerond', deadline: '2026-01-20', prioriteit: 'hoog' },
  { id: 26, project_id: 6, toegewezen_aan: 2, titel: 'Kennisbank met zoekfunctie', status: 'bezig', deadline: '2026-04-15', prioriteit: 'hoog' },
  { id: 27, project_id: 6, toegewezen_aan: 1, titel: 'Medewerkerprofielen en organogram', status: 'bezig', deadline: '2026-04-20', prioriteit: 'normaal' },
  { id: 28, project_id: 6, toegewezen_aan: 2, titel: 'Nieuwsfeed en aankondigingen', status: 'open', deadline: '2026-05-01', prioriteit: 'normaal' },

  // Project 7 - Webshop Bloem & Blad
  { id: 29, project_id: 7, toegewezen_aan: 2, titel: 'Shopify thema customization', status: 'bezig', deadline: '2026-04-15', prioriteit: 'hoog' },
  { id: 30, project_id: 7, toegewezen_aan: 1, titel: 'Seizoensboeketten configurator', status: 'open', deadline: '2026-05-01', prioriteit: 'normaal' },

  // Project 8 - Klantportaal Van den Berg Advocaten
  { id: 31, project_id: 8, toegewezen_aan: 1, titel: 'Authenticatie en rolsysteem', status: 'afgerond', deadline: '2026-01-15', prioriteit: 'hoog' },
  { id: 32, project_id: 8, toegewezen_aan: 2, titel: 'Documentupload en versioning', status: 'afgerond', deadline: '2026-02-01', prioriteit: 'hoog' },
  { id: 33, project_id: 8, toegewezen_aan: 1, titel: 'Dossierstatus timeline', status: 'bezig', deadline: '2026-03-30', prioriteit: 'hoog' },
  { id: 34, project_id: 8, toegewezen_aan: 2, titel: 'Beveiligde berichtenfunctie', status: 'bezig', deadline: '2026-04-10', prioriteit: 'normaal' },
  { id: 35, project_id: 8, toegewezen_aan: 1, titel: 'PDF generatie dossieroverzicht', status: 'open', deadline: '2026-04-20', prioriteit: 'normaal' },

  // Project 9 - SportFusion Marketing Website
  { id: 36, project_id: 9, toegewezen_aan: 2, titel: 'Landingspagina design en content', status: 'afgerond', deadline: '2026-03-01', prioriteit: 'hoog' },
  { id: 37, project_id: 9, toegewezen_aan: 1, titel: 'Scroll-animaties en micro-interactions', status: 'afgerond', deadline: '2026-03-15', prioriteit: 'normaal' },
  { id: 38, project_id: 9, toegewezen_aan: 2, titel: 'Lead capture formulier en CRM koppeling', status: 'bezig', deadline: '2026-04-05', prioriteit: 'hoog' },

  // Project 10 (afgerond) - Veldhuis Brand Identity
  { id: 39, project_id: 10, toegewezen_aan: 2, titel: 'Logo ontwerp en variaties', status: 'afgerond', deadline: '2025-11-15', prioriteit: 'hoog' },
  { id: 40, project_id: 10, toegewezen_aan: 1, titel: 'Brand guidelines document', status: 'afgerond', deadline: '2025-11-30', prioriteit: 'normaal' },

  // Project 11 (afgerond) - Intake Automatisering VdB
  { id: 41, project_id: 11, toegewezen_aan: 1, titel: 'Intakeformulier multi-step wizard', status: 'afgerond', deadline: '2026-01-10', prioriteit: 'hoog' },
  { id: 42, project_id: 11, toegewezen_aan: 2, titel: 'AI classificatie juridische zaken', status: 'afgerond', deadline: '2026-01-25', prioriteit: 'hoog' },

  // Extra taken for variety
  { id: 43, project_id: 2, toegewezen_aan: 2, titel: 'Dashboard widgets customization', status: 'open', deadline: '2026-05-15', prioriteit: 'laag' },
  { id: 44, project_id: 4, toegewezen_aan: 2, titel: 'Push notificaties implementeren', status: 'open', deadline: '2026-05-15', prioriteit: 'normaal' },
  { id: 45, project_id: 6, toegewezen_aan: 1, titel: 'Dark mode voor intranet', status: 'open', deadline: '2026-05-30', prioriteit: 'laag' },
];

const insertTaak = db.prepare(`INSERT INTO taken (id, project_id, toegewezen_aan, aangemaakt_door, titel, status, deadline, prioriteit, aangemaakt_op, bijgewerkt_op)
  VALUES (@id, @project_id, @toegewezen_aan, @aangemaakt_door, @titel, @status, @deadline, @prioriteit, '2026-01-05 09:00:00', '2026-03-29 10:00:00')`);

for (const t of takenData) {
  t.aangemaakt_door = t.toegewezen_aan === 1 ? 2 : 1; // cross-assign
  insertTaak.run(t);
}
console.log(`Inserted ${takenData.length} taken`);

// ─── TIJDREGISTRATIES ──────────────────────────────────
const weekdays = getWeekdays('2026-01-02', '2026-03-30');
const categories = ['development', 'development', 'development', 'development', 'meeting', 'administratie'];
const devDescriptions = [
  'Frontend componenten bouwen', 'API endpoints implementeren', 'Database queries optimaliseren',
  'Unit tests schrijven', 'Code review en refactoring', 'Bug fixes', 'UI styling en responsive design',
  'Deployment en CI/CD configuratie', 'Authenticatie implementeren', 'Performance optimalisatie',
  'State management opzetten', 'Formulier validatie', 'WebSocket integratie', 'Data migratie',
  'Documentatie bijwerken', 'TypeScript types updaten', 'Error handling verbeteren',
];
const meetingDescriptions = ['Standup meeting', 'Sprint planning', 'Klantoverleg', 'Demo presentatie', 'Retrospective'];
const adminDescriptions = ['E-mail en planning', 'Facturatie', 'Offerte schrijven', 'Administratie'];

const activeProjectIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
let tijdId = 1;
const insertTijd = db.prepare(`INSERT INTO tijdregistraties (id, gebruiker_id, project_id, omschrijving, start_tijd, eind_tijd, duur_minuten, categorie, is_handmatig, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`);

for (const userId of [1, 2]) {
  let count = 0;
  // Pick ~80 days from weekdays for this user (some days off)
  const shuffled = [...weekdays].sort(() => Math.random() - 0.5);
  const selectedDays = shuffled.slice(0, Math.min(80, weekdays.length));
  selectedDays.sort();

  for (const day of selectedDays) {
    const numSessions = randomBetween(1, 3);
    let lastEnd = null;
    for (let s = 0; s < numSessions; s++) {
      const projectId = pick(activeProjectIds);
      const cat = pick(categories);
      let desc;
      if (cat === 'meeting') desc = pick(meetingDescriptions);
      else if (cat === 'administratie') desc = pick(adminDescriptions);
      else desc = pick(devDescriptions);

      let startH, startM;
      if (s === 0) {
        startH = randomBetween(8, 9);
        startM = randomBetween(0, 59);
      } else {
        // Start after previous session + small break
        const [lh, lm] = lastEnd.split(':').map(Number);
        startH = lh;
        startM = lm + randomBetween(5, 30);
        if (startM >= 60) { startH++; startM -= 60; }
      }
      const startTime = `${pad(startH)}:${pad(startM)}`;
      const durationHours = randomFloat(1.5, 4.5, 1);
      const durationMinutes = Math.round(durationHours * 60);
      const endTime = addHours(startTime, durationHours);

      const startDt = `${day}T${startTime}:00`;
      const endDt = `${day}T${endTime}:00`;
      lastEnd = endTime;

      insertTijd.run(tijdId++, userId, projectId, desc, startDt, endDt, durationMinutes, cat, `${day}T${startTime}:00`);
      count++;
    }
  }
  console.log(`Inserted ${count} tijdregistraties for user ${userId}`);
}

// ─── FACTUREN ──────────────────────────────────────────
const facturenData = [
  { id: 1,  klant_id: 1, project_id: 10, factuurnummer: 'AUT-2025-001', status: 'betaald', bedrag_excl_btw: 4042.50, factuurdatum: '2025-12-05', vervaldatum: '2026-01-04', betaald_op: '2025-12-28', aangemaakt_door: 1 },
  { id: 2,  klant_id: 8, project_id: 11, factuurnummer: 'AUT-2026-001', status: 'betaald', bedrag_excl_btw: 5225.00, factuurdatum: '2026-02-01', vervaldatum: '2026-03-03', betaald_op: '2026-02-25', aangemaakt_door: 2 },
  { id: 3,  klant_id: 5, project_id: 12, factuurnummer: 'AUT-2026-002', status: 'betaald', bedrag_excl_btw: 1440.00, factuurdatum: '2026-02-18', vervaldatum: '2026-03-20', betaald_op: '2026-03-12', aangemaakt_door: 2 },
  { id: 4,  klant_id: 4, project_id: 9, factuurnummer: 'AUT-2026-003', status: 'betaald', bedrag_excl_btw: 3960.00, factuurdatum: '2026-03-01', vervaldatum: '2026-03-31', betaald_op: '2026-03-18', aangemaakt_door: 1 },
  { id: 5,  klant_id: 1, project_id: 1, factuurnummer: 'AUT-2026-004', status: 'betaald', bedrag_excl_btw: 7875.00, factuurdatum: '2026-03-05', vervaldatum: '2026-04-04', betaald_op: '2026-03-22', aangemaakt_door: 1 },
  { id: 6,  klant_id: 2, project_id: 2, factuurnummer: 'AUT-2026-005', status: 'verzonden', bedrag_excl_btw: 5700.00, factuurdatum: '2026-03-15', vervaldatum: '2026-04-14', betaald_op: null, aangemaakt_door: 1 },
  { id: 7,  klant_id: 6, project_id: 6, factuurnummer: 'AUT-2026-006', status: 'verzonden', bedrag_excl_btw: 4750.00, factuurdatum: '2026-03-18', vervaldatum: '2026-04-17', betaald_op: null, aangemaakt_door: 2 },
  { id: 8,  klant_id: 8, project_id: 8, factuurnummer: 'AUT-2026-007', status: 'verzonden', bedrag_excl_btw: 6325.00, factuurdatum: '2026-03-20', vervaldatum: '2026-04-19', betaald_op: null, aangemaakt_door: 1 },
  { id: 9,  klant_id: 3, project_id: 3, factuurnummer: 'AUT-2026-008', status: 'concept', bedrag_excl_btw: 2847.50, factuurdatum: null, vervaldatum: null, betaald_op: null, aangemaakt_door: 2 },
  { id: 10, klant_id: 7, project_id: 7, factuurnummer: 'AUT-2026-009', status: 'concept', bedrag_excl_btw: 765.00, factuurdatum: null, vervaldatum: null, betaald_op: null, aangemaakt_door: 2 },
  { id: 11, klant_id: 4, project_id: 4, factuurnummer: 'AUT-2026-010', status: 'te_laat', bedrag_excl_btw: 5500.00, factuurdatum: '2026-02-01', vervaldatum: '2026-03-03', betaald_op: null, aangemaakt_door: 1 },
  { id: 12, klant_id: 5, project_id: 5, factuurnummer: 'AUT-2026-011', status: 'te_laat', bedrag_excl_btw: 1920.00, factuurdatum: '2026-02-15', vervaldatum: '2026-03-17', betaald_op: null, aangemaakt_door: 2 },
];

const insertFactuur = db.prepare(`INSERT INTO facturen (id, klant_id, project_id, factuurnummer, status, bedrag_excl_btw, btw_percentage, btw_bedrag, bedrag_incl_btw, factuurdatum, vervaldatum, betaald_op, is_actief, aangemaakt_door, aangemaakt_op, bijgewerkt_op)
  VALUES (?, ?, ?, ?, ?, ?, 21, ?, ?, ?, ?, ?, 1, ?, '2026-01-01 09:00:00', '2026-03-29 10:00:00')`);

for (const f of facturenData) {
  const btw = parseFloat((f.bedrag_excl_btw * 0.21).toFixed(2));
  const incl = parseFloat((f.bedrag_excl_btw + btw).toFixed(2));
  insertFactuur.run(f.id, f.klant_id, f.project_id, f.factuurnummer, f.status, f.bedrag_excl_btw, btw, incl, f.factuurdatum, f.vervaldatum, f.betaald_op, f.aangemaakt_door);
}
console.log(`Inserted ${facturenData.length} facturen`);

// ─── FACTUUR REGELS ────────────────────────────────────
const regelDescriptions = [
  'Frontend development', 'Backend development', 'UI/UX Design', 'Projectmanagement',
  'Code review & testing', 'Technisch advies', 'API development', 'Database optimalisatie'
];

let regelId = 1;
const insertRegel = db.prepare(`INSERT INTO factuur_regels (id, factuur_id, omschrijving, aantal, eenheidsprijs, btw_percentage, totaal)
  VALUES (?, ?, ?, ?, ?, 21, ?)`);

for (const f of facturenData) {
  const numRegels = randomBetween(2, 4);
  let remaining = f.bedrag_excl_btw;
  const klantTarief = klantenData.find(k => k.id === f.klant_id).uurtarief;

  for (let i = 0; i < numRegels; i++) {
    const desc = regelDescriptions[(regelId - 1) % regelDescriptions.length];
    let uren, prijs;
    if (i === numRegels - 1) {
      // Last line: use remaining amount
      uren = parseFloat((remaining / klantTarief).toFixed(1));
      prijs = klantTarief;
    } else {
      uren = randomFloat(3, 20, 1);
      prijs = klantTarief;
      remaining -= uren * prijs;
    }
    const totaal = parseFloat((uren * prijs).toFixed(2));
    insertRegel.run(regelId++, f.id, desc, uren, prijs, totaal);
  }
}
console.log(`Inserted ${regelId - 1} factuur regels`);

// ─── INKOMSTEN ─────────────────────────────────────────
const insertInkomst = db.prepare(`INSERT INTO inkomsten (id, factuur_id, klant_id, omschrijving, bedrag, datum, categorie, aangemaakt_door, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, 'factuur', ?, '2026-01-01 09:00:00')`);

let inkomstId = 1;
for (const f of facturenData) {
  if (f.status === 'betaald') {
    const btw = parseFloat((f.bedrag_excl_btw * 0.21).toFixed(2));
    const incl = parseFloat((f.bedrag_excl_btw + btw).toFixed(2));
    const klant = klantenData.find(k => k.id === f.klant_id);
    insertInkomst.run(inkomstId++, f.id, f.klant_id, `Betaling ${f.factuurnummer} - ${klant.bedrijfsnaam}`, incl, f.betaald_op, f.aangemaakt_door);
  }
}
console.log(`Inserted ${inkomstId - 1} inkomsten`);

// ─── UITGAVEN ──────────────────────────────────────────
const uitgavenData = [
  { omschrijving: 'Vercel Pro abonnement januari', bedrag: 20.00, datum: '2026-01-03', categorie: 'hosting', leverancier: 'Vercel', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'GitHub Team januari', bedrag: 19.00, datum: '2026-01-03', categorie: 'tools', leverancier: 'GitHub', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Anthropic API credits', bedrag: 147.50, datum: '2026-01-08', categorie: 'ai', leverancier: 'Anthropic', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Notion Team plan', bedrag: 8.00, datum: '2026-01-10', categorie: 'tools', leverancier: 'Notion', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Kantoorbenodigdheden', bedrag: 34.95, datum: '2026-01-15', categorie: 'kantoor', leverancier: 'Staples', btw_bedrag: 6.07, btw_percentage: 21, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Vercel Pro abonnement februari', bedrag: 20.00, datum: '2026-02-03', categorie: 'hosting', leverancier: 'Vercel', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'GitHub Team februari', bedrag: 19.00, datum: '2026-02-03', categorie: 'tools', leverancier: 'GitHub', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Figma Professional', bedrag: 12.00, datum: '2026-02-05', categorie: 'design', leverancier: 'Figma', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Anthropic API credits februari', bedrag: 189.25, datum: '2026-02-10', categorie: 'ai', leverancier: 'Anthropic', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Google Workspace Business', bedrag: 12.00, datum: '2026-02-12', categorie: 'tools', leverancier: 'Google', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'AWS hosting kosten februari', bedrag: 43.87, datum: '2026-02-15', categorie: 'hosting', leverancier: 'Amazon Web Services', btw_bedrag: 7.62, btw_percentage: 21, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Slack Pro workspace', bedrag: 6.67, datum: '2026-02-18', categorie: 'communicatie', leverancier: 'Slack', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Linear abonnement', bedrag: 8.00, datum: '2026-02-20', categorie: 'tools', leverancier: 'Linear', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Zakelijke lunch klantoverleg', bedrag: 47.50, datum: '2026-02-25', categorie: 'representatie', leverancier: 'Restaurant De Graafschap', btw_bedrag: 8.25, btw_percentage: 21, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Vercel Pro abonnement maart', bedrag: 20.00, datum: '2026-03-03', categorie: 'hosting', leverancier: 'Vercel', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'GitHub Team maart', bedrag: 19.00, datum: '2026-03-03', categorie: 'tools', leverancier: 'GitHub', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Anthropic API credits maart', bedrag: 213.75, datum: '2026-03-08', categorie: 'ai', leverancier: 'Anthropic', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Domeinregistratie klanten', bedrag: 42.35, datum: '2026-03-10', categorie: 'hosting', leverancier: 'TransIP', btw_bedrag: 7.36, btw_percentage: 21, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Monitor reparatie', bedrag: 89.00, datum: '2026-03-12', categorie: 'hardware', leverancier: 'Coolblue', btw_bedrag: 15.47, btw_percentage: 21, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'AWS hosting kosten maart', bedrag: 51.23, datum: '2026-03-15', categorie: 'hosting', leverancier: 'Amazon Web Services', btw_bedrag: 8.91, btw_percentage: 21, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Boekhoudsoftware', bedrag: 14.95, datum: '2026-03-16', categorie: 'administratie', leverancier: 'Moneybird', btw_bedrag: 2.60, btw_percentage: 21, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Google Workspace maart', bedrag: 12.00, datum: '2026-03-18', categorie: 'tools', leverancier: 'Google', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Slack Pro maart', bedrag: 6.67, datum: '2026-03-20', categorie: 'communicatie', leverancier: 'Slack', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Conferentie tickets Frontend Love', bedrag: 299.00, datum: '2026-03-22', categorie: 'opleiding', leverancier: 'Frontend Love', btw_bedrag: 51.97, btw_percentage: 21, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Figma Professional maart', bedrag: 12.00, datum: '2026-03-25', categorie: 'design', leverancier: 'Figma', btw_bedrag: 0, btw_percentage: 0, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'Zakelijke reiskosten trein', bedrag: 23.40, datum: '2026-03-26', categorie: 'reiskosten', leverancier: 'NS', btw_bedrag: 2.12, btw_percentage: 9, fiscaal_aftrekbaar: 1 },
  { omschrijving: 'USB-C hub en kabels', bedrag: 34.99, datum: '2026-03-28', categorie: 'hardware', leverancier: 'Amazon', btw_bedrag: 6.08, btw_percentage: 21, fiscaal_aftrekbaar: 1 },
];

const insertUitgave = db.prepare(`INSERT INTO uitgaven (omschrijving, bedrag, datum, categorie, leverancier, btw_bedrag, btw_percentage, fiscaal_aftrekbaar, aangemaakt_door, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-01-01 09:00:00')`);

for (let i = 0; i < uitgavenData.length; i++) {
  const u = uitgavenData[i];
  insertUitgave.run(u.omschrijving, u.bedrag, u.datum, u.categorie, u.leverancier, u.btw_bedrag, u.btw_percentage, u.fiscaal_aftrekbaar, i % 2 === 0 ? 1 : 2);
}
console.log(`Inserted ${uitgavenData.length} uitgaven`);

// ─── ABONNEMENTEN ──────────────────────────────────────
const abonnementenData = [
  { naam: 'Vercel Pro', leverancier: 'Vercel', bedrag: 20.00, frequentie: 'maandelijks', categorie: 'hosting', start_datum: '2025-06-01', volgende_betaling: '2026-04-01', url: 'https://vercel.com' },
  { naam: 'GitHub Team', leverancier: 'GitHub', bedrag: 19.00, frequentie: 'maandelijks', categorie: 'tools', start_datum: '2025-06-01', volgende_betaling: '2026-04-01', url: 'https://github.com' },
  { naam: 'Anthropic API', leverancier: 'Anthropic', bedrag: 175.00, frequentie: 'maandelijks', categorie: 'ai', start_datum: '2025-07-01', volgende_betaling: '2026-04-01', url: 'https://console.anthropic.com' },
  { naam: 'Notion Team', leverancier: 'Notion', bedrag: 8.00, frequentie: 'maandelijks', categorie: 'tools', start_datum: '2025-06-01', volgende_betaling: '2026-04-01', url: 'https://notion.so' },
  { naam: 'Figma Professional', leverancier: 'Figma', bedrag: 12.00, frequentie: 'maandelijks', categorie: 'design', start_datum: '2025-08-01', volgende_betaling: '2026-04-01', url: 'https://figma.com' },
  { naam: 'Google Workspace Business', leverancier: 'Google', bedrag: 12.00, frequentie: 'maandelijks', categorie: 'tools', start_datum: '2025-06-01', volgende_betaling: '2026-04-01', url: 'https://workspace.google.com' },
  { naam: 'AWS', leverancier: 'Amazon Web Services', bedrag: 47.50, frequentie: 'maandelijks', categorie: 'hosting', start_datum: '2025-09-01', volgende_betaling: '2026-04-01', url: 'https://aws.amazon.com' },
  { naam: 'Slack Pro', leverancier: 'Slack', bedrag: 6.67, frequentie: 'maandelijks', categorie: 'communicatie', start_datum: '2025-06-01', volgende_betaling: '2026-04-01', url: 'https://slack.com' },
  { naam: 'Linear', leverancier: 'Linear', bedrag: 8.00, frequentie: 'maandelijks', categorie: 'tools', start_datum: '2025-10-01', volgende_betaling: '2026-04-01', url: 'https://linear.app' },
];

const insertAbonnement = db.prepare(`INSERT INTO abonnementen (naam, leverancier, bedrag, frequentie, categorie, start_datum, volgende_betaling, url, is_actief, aangemaakt_op, bijgewerkt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '2025-06-01 09:00:00', '2026-03-29 10:00:00')`);

for (const a of abonnementenData) {
  insertAbonnement.run(a.naam, a.leverancier, a.bedrag, a.frequentie, a.categorie, a.start_datum, a.volgende_betaling, a.url);
}
console.log(`Inserted ${abonnementenData.length} abonnementen`);

// ─── LEADS ─────────────────────────────────────────────
const leadsData = [
  { bedrijfsnaam: 'TechVentures Amsterdam', contactpersoon: 'David Mulder', email: 'd.mulder@techventures.nl', telefoon: '+31 6 98765432', waarde: 15000, status: 'offerte', bron: 'LinkedIn', notities: 'Geïnteresseerd in custom CRM. Offerte verstuurd op 20 maart.', volgende_actie: 'Follow-up call na offerte', volgende_actie_datum: '2026-04-03', aangemaakt_door: 1 },
  { bedrijfsnaam: 'Groen Wonen BV', contactpersoon: 'Emma Hendriks', email: 'emma@groenwonen.nl', telefoon: '+31 6 23456789', waarde: 8500, status: 'contact', bron: 'Website', notities: 'Wil een duurzaamheidsportaal. Eerste gesprek gehad, positief.', volgende_actie: 'Technisch voorstel sturen', volgende_actie_datum: '2026-04-01', aangemaakt_door: 2 },
  { bedrijfsnaam: 'Fitness Factory', contactpersoon: 'Rick Bos', email: 'rick@fitnessfactory.nl', telefoon: '+31 6 34567890', waarde: 12000, status: 'nieuw', bron: 'Referral SportFusion', notities: 'Via Thomas van SportFusion doorverwezen. Interesse in leden-app.', volgende_actie: 'Kennismakingsgesprek plannen', volgende_actie_datum: '2026-04-02', aangemaakt_door: 1 },
  { bedrijfsnaam: 'Studio Lux', contactpersoon: 'Anne de Boer', email: 'anne@studiolux.nl', telefoon: '+31 6 45678901', waarde: 5000, status: 'contact', bron: 'Instagram', notities: 'Interieurontwerp studio, wil een portfolio website met 3D tours.', volgende_actie: 'Intake gesprek', volgende_actie_datum: '2026-04-05', aangemaakt_door: 2 },
  { bedrijfsnaam: 'Brouwerij Het Anker', contactpersoon: 'Klaas Visser', email: 'klaas@hetanker.nl', telefoon: '+31 6 56789012', waarde: 6500, status: 'gewonnen', bron: 'Netwerkevent', notities: 'Webshop voor craft beer. Contract getekend!', volgende_actie: null, volgende_actie_datum: null, aangemaakt_door: 1 },
  { bedrijfsnaam: 'MediCare Plus', contactpersoon: 'Dr. S. Patel', email: 's.patel@medicareplus.nl', telefoon: '+31 6 67890123', waarde: 25000, status: 'offerte', bron: 'Google', notities: 'Groot patiëntenportaal project. Zoekt partner voor MVP.', volgende_actie: 'Presentatie geven aan directie', volgende_actie_datum: '2026-04-08', aangemaakt_door: 2 },
  { bedrijfsnaam: 'Drukkerij Modern', contactpersoon: 'Bert Willems', email: 'bert@drukkerijmodern.nl', telefoon: '+31 6 78901234', waarde: 3500, status: 'verloren', bron: 'KvK evenement', notities: 'Te duur bevonden. Kiest voor template website.', volgende_actie: null, volgende_actie_datum: null, aangemaakt_door: 1 },
];

const insertLead = db.prepare(`INSERT INTO leads (bedrijfsnaam, contactpersoon, email, telefoon, waarde, status, bron, notities, volgende_actie, volgende_actie_datum, is_actief, aangemaakt_door, aangemaakt_op, bijgewerkt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, '2026-02-01 09:00:00', '2026-03-29 10:00:00')`);

for (const l of leadsData) {
  insertLead.run(l.bedrijfsnaam, l.contactpersoon, l.email, l.telefoon, l.waarde, l.status, l.bron, l.notities, l.volgende_actie, l.volgende_actie_datum, l.aangemaakt_door);
}
console.log(`Inserted ${leadsData.length} leads`);

// ─── AGENDA ITEMS ──────────────────────────────────────
const agendaData = [
  // Upcoming for Sem
  { gebruiker_id: 1, titel: 'Sprint planning Q2', type: 'afspraak', start_datum: '2026-03-30T09:00:00', eind_datum: '2026-03-30T10:30:00', hele_dag: 0 },
  { gebruiker_id: 1, titel: 'Klantoverleg Veldhuis Architecten', type: 'afspraak', start_datum: '2026-03-30T14:00:00', eind_datum: '2026-03-30T15:00:00', hele_dag: 0 },
  { gebruiker_id: 1, titel: 'Demo GreenLogic dashboard', type: 'afspraak', start_datum: '2026-03-31T11:00:00', eind_datum: '2026-03-31T12:00:00', hele_dag: 0 },
  { gebruiker_id: 1, titel: 'Technisch overleg SportFusion API', type: 'afspraak', start_datum: '2026-04-01T10:00:00', eind_datum: '2026-04-01T11:00:00', hele_dag: 0 },
  { gebruiker_id: 1, titel: 'Kennismakingsgesprek Fitness Factory', type: 'afspraak', start_datum: '2026-04-02T13:30:00', eind_datum: '2026-04-02T14:30:00', hele_dag: 0 },
  { gebruiker_id: 1, titel: 'Code review sessie met Syb', type: 'afspraak', start_datum: '2026-04-03T09:00:00', eind_datum: '2026-04-03T10:00:00', hele_dag: 0 },
  { gebruiker_id: 1, titel: 'BTW aangifte Q1 deadline', type: 'deadline', start_datum: '2026-04-30T09:00:00', eind_datum: '2026-04-30T09:00:00', hele_dag: 1 },
  { gebruiker_id: 1, titel: 'Frontend Love conferentie', type: 'afspraak', start_datum: '2026-04-15T08:00:00', eind_datum: '2026-04-15T18:00:00', hele_dag: 1 },
  // Upcoming for Syb
  { gebruiker_id: 2, titel: 'Sprint planning Q2', type: 'afspraak', start_datum: '2026-03-30T09:00:00', eind_datum: '2026-03-30T10:30:00', hele_dag: 0 },
  { gebruiker_id: 2, titel: 'Design review Bloem & Blad webshop', type: 'afspraak', start_datum: '2026-03-30T15:00:00', eind_datum: '2026-03-30T16:00:00', hele_dag: 0 },
  { gebruiker_id: 2, titel: 'Klantoverleg Van den Berg Advocaten', type: 'afspraak', start_datum: '2026-03-31T14:00:00', eind_datum: '2026-03-31T15:00:00', hele_dag: 0 },
  { gebruiker_id: 2, titel: 'Demo reserveringssysteem De Gouden Draak', type: 'afspraak', start_datum: '2026-04-01T15:00:00', eind_datum: '2026-04-01T16:00:00', hele_dag: 0 },
  { gebruiker_id: 2, titel: 'Intake Studio Lux', type: 'afspraak', start_datum: '2026-04-05T10:00:00', eind_datum: '2026-04-05T11:00:00', hele_dag: 0 },
  { gebruiker_id: 2, titel: 'Code review sessie met Sem', type: 'afspraak', start_datum: '2026-04-03T09:00:00', eind_datum: '2026-04-03T10:00:00', hele_dag: 0 },
  { gebruiker_id: 2, titel: 'Presentatie MediCare Plus', type: 'afspraak', start_datum: '2026-04-08T10:00:00', eind_datum: '2026-04-08T12:00:00', hele_dag: 0 },
  { gebruiker_id: 2, titel: 'Frontend Love conferentie', type: 'afspraak', start_datum: '2026-04-15T08:00:00', eind_datum: '2026-04-15T18:00:00', hele_dag: 1 },
  // Past items
  { gebruiker_id: 1, titel: 'Retrospective Q1', type: 'afspraak', start_datum: '2026-03-27T16:00:00', eind_datum: '2026-03-27T17:00:00', hele_dag: 0 },
  { gebruiker_id: 2, titel: 'Retrospective Q1', type: 'afspraak', start_datum: '2026-03-27T16:00:00', eind_datum: '2026-03-27T17:00:00', hele_dag: 0 },
];

const insertAgenda = db.prepare(`INSERT INTO agenda_items (gebruiker_id, titel, type, start_datum, eind_datum, hele_dag, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, '2026-03-01 09:00:00')`);

for (const a of agendaData) {
  insertAgenda.run(a.gebruiker_id, a.titel, a.type, a.start_datum, a.eind_datum, a.hele_dag);
}
console.log(`Inserted ${agendaData.length} agenda items`);

// ─── OFFERTES ──────────────────────────────────────────
const offertesData = [
  { id: 1, klant_id: 1, project_id: 1,  offertenummer: 'OFF-2025-001', titel: 'Website Redesign met 3D Portfolio', status: 'geaccepteerd', datum: '2025-08-15', geldig_tot: '2025-09-15', bedrag_excl_btw: 18900.00, aangemaakt_door: 1 },
  { id: 2, klant_id: 4, project_id: 4,  offertenummer: 'OFF-2025-002', titel: 'SportFusion Trainingsplatform MVP', status: 'geaccepteerd', datum: '2025-08-01', geldig_tot: '2025-09-01', bedrag_excl_btw: 35200.00, aangemaakt_door: 1 },
  { id: 3, klant_id: 6, project_id: 6,  offertenummer: 'OFF-2025-003', titel: 'Nextera Modern Intranet', status: 'geaccepteerd', datum: '2025-11-20', geldig_tot: '2025-12-20', bedrag_excl_btw: 21000.00, aangemaakt_door: 2 },
  { id: 4, klant_id: null, project_id: null, offertenummer: 'OFF-2026-001', titel: 'Custom CRM Ontwikkeling TechVentures', status: 'verzonden', datum: '2026-03-20', geldig_tot: '2026-04-20', bedrag_excl_btw: 15000.00, aangemaakt_door: 1 },
  { id: 5, klant_id: null, project_id: null, offertenummer: 'OFF-2026-002', titel: 'Patiëntenportaal MediCare Plus MVP', status: 'concept', datum: null, geldig_tot: null, bedrag_excl_btw: 25000.00, aangemaakt_door: 2 },
];

const insertOfferte = db.prepare(`INSERT INTO offertes (id, klant_id, project_id, offertenummer, titel, status, datum, geldig_tot, bedrag_excl_btw, btw_percentage, btw_bedrag, bedrag_incl_btw, is_actief, aangemaakt_door, aangemaakt_op, bijgewerkt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 21, ?, ?, 1, ?, '2025-08-01 09:00:00', '2026-03-29 10:00:00')`);

for (const o of offertesData) {
  const btw = parseFloat((o.bedrag_excl_btw * 0.21).toFixed(2));
  const incl = parseFloat((o.bedrag_excl_btw + btw).toFixed(2));
  insertOfferte.run(o.id, o.klant_id, o.project_id, o.offertenummer, o.titel, o.status, o.datum, o.geldig_tot, o.bedrag_excl_btw, btw, incl, o.aangemaakt_door);
}
console.log(`Inserted ${offertesData.length} offertes`);

// ─── OFFERTE REGELS ────────────────────────────────────
const offerteRegelsData = [
  // Offerte 1 - Veldhuis website
  { offerte_id: 1, omschrijving: 'UX Research & Wireframing', aantal: 20, eenheidsprijs: 105 },
  { offerte_id: 1, omschrijving: 'Frontend Development (Next.js)', aantal: 80, eenheidsprijs: 105 },
  { offerte_id: 1, omschrijving: '3D Portfolio Viewer', aantal: 40, eenheidsprijs: 105 },
  { offerte_id: 1, omschrijving: 'CMS Integratie & Content Migratie', aantal: 40, eenheidsprijs: 105 },
  // Offerte 2 - SportFusion
  { offerte_id: 2, omschrijving: 'Technisch Ontwerp & Architectuur', aantal: 40, eenheidsprijs: 110 },
  { offerte_id: 2, omschrijving: 'React Native App Development', aantal: 160, eenheidsprijs: 110 },
  { offerte_id: 2, omschrijving: 'Backend & API Development', aantal: 80, eenheidsprijs: 110 },
  { offerte_id: 2, omschrijving: 'AI Coaching Engine', aantal: 40, eenheidsprijs: 110 },
  // Offerte 3 - Nextera
  { offerte_id: 3, omschrijving: 'Azure AD Integratie', aantal: 30, eenheidsprijs: 95 },
  { offerte_id: 3, omschrijving: 'Kennisbank & Zoekfunctie', aantal: 60, eenheidsprijs: 95 },
  { offerte_id: 3, omschrijving: 'Medewerkerprofielen & Dashboard', aantal: 80, eenheidsprijs: 95 },
  { offerte_id: 3, omschrijving: 'Projectmanagement & Oplevering', aantal: 50.53, eenheidsprijs: 95 },
  // Offerte 4 - TechVentures CRM
  { offerte_id: 4, omschrijving: 'Requirements & Design', aantal: 20, eenheidsprijs: 100 },
  { offerte_id: 4, omschrijving: 'CRM Core Development', aantal: 80, eenheidsprijs: 100 },
  { offerte_id: 4, omschrijving: 'Integraties & Migratie', aantal: 30, eenheidsprijs: 100 },
  { offerte_id: 4, omschrijving: 'Testing & Oplevering', aantal: 20, eenheidsprijs: 100 },
  // Offerte 5 - MediCare Plus
  { offerte_id: 5, omschrijving: 'HIPAA-compliant Architectuur', aantal: 40, eenheidsprijs: 110 },
  { offerte_id: 5, omschrijving: 'Patiëntenportaal Frontend', aantal: 80, eenheidsprijs: 110 },
  { offerte_id: 5, omschrijving: 'Backend & Integraties', aantal: 60, eenheidsprijs: 110 },
  { offerte_id: 5, omschrijving: 'Security Audit & Oplevering', aantal: 47.27, eenheidsprijs: 110 },
];

const insertOfferteRegel = db.prepare(`INSERT INTO offerte_regels (offerte_id, omschrijving, aantal, eenheidsprijs, btw_percentage, totaal)
  VALUES (?, ?, ?, ?, 21, ?)`);

for (const r of offerteRegelsData) {
  const totaal = parseFloat((r.aantal * r.eenheidsprijs).toFixed(2));
  insertOfferteRegel.run(r.offerte_id, r.omschrijving, r.aantal, r.eenheidsprijs, totaal);
}
console.log(`Inserted ${offerteRegelsData.length} offerte regels`);

// ─── MEETINGS ──────────────────────────────────────────
const meetingsData = [
  {
    klant_id: 1, project_id: 1, titel: 'Kick-off Website Redesign', datum: '2025-09-10T10:00:00',
    samenvatting: 'Eerste project kick-off met Mark Veldhuis. Doelen besproken: moderne uitstraling, 3D project showcase, snelle laadtijden. Mark wil een interactieve portfolio die hun architectuurprojecten tot leven brengt. Budget en planning besproken, akkoord op gefaseerde aanpak.',
    actiepunten: '["Wireframes eerste versie opleveren voor 25 sept","Moodboard samenstellen met referentie-websites","Technisch onderzoek Three.js vs Spline voor 3D viewer"]',
    besluiten: '["Next.js als framework","Headless CMS voor contentbeheer","Gefaseerde oplevering: homepage eerst, dan projectpaginas"]',
    aangemaakt_door: 1
  },
  {
    klant_id: 2, project_id: 2, titel: 'Requirements Workshop GreenLogic', datum: '2025-10-22T13:00:00',
    samenvatting: 'Uitgebreide workshop met Lisa de Vries en haar team over dashboardvereisten. Belangrijkste inzichten: real-time tracking van 200+ voertuigen, CO2 rapportage voor jaarverslag, route-optimalisatie moet 15% brandstofbesparing realiseren. API koppeling met hun SAP systeem is cruciaal.',
    actiepunten: '["SAP API documentatie opvragen bij GreenLogic IT","Prototype real-time kaartweergave bouwen","CO2 berekening formules valideren met duurzaamheidsteam"]',
    besluiten: '["WebSocket voor real-time updates","Mapbox voor kaartintegratie","Maandelijkse sprints met demo"]',
    aangemaakt_door: 1
  },
  {
    klant_id: 8, project_id: 8, titel: 'Security Review Klantportaal', datum: '2026-02-12T14:00:00',
    samenvatting: 'Security review sessie met Mr. van den Berg en externe IT auditor. Alle beveiligingsmaatregelen doorgenomen: 2FA, encryptie at rest, audit logging. Enkele verbeterpunten geïdentificeerd rondom session management en data retention policies. Auditor geeft positief advies.',
    actiepunten: '["Session timeout instellen op 30 minuten inactiviteit","Data retention policy implementeren (7 jaar)","Penetratietest plannen voor april"]',
    besluiten: '["TOTP-based 2FA voor alle gebruikers","Jaarlijkse security audit","IP whitelisting voor admin accounts"]',
    aangemaakt_door: 1
  },
  {
    klant_id: 4, project_id: 4, titel: 'Sprint Review SportFusion', datum: '2026-03-10T11:00:00',
    samenvatting: 'Sprint review van de eerste app-iteratie. Thomas is enthousiast over de workout tracking module. Feedback op UI: knoppen iets groter voor gebruik tijdens training. Wearable integratie geprioriteerd voor volgende sprint. Discussie over AI coaching - Thomas wil eerst focus op basis functionaliteit.',
    actiepunten: '["UI knoppen vergroten voor sportgebruik","Garmin API integratie starten","Gebruikerstest plannen met 5 beta-testers"]',
    besluiten: '["AI coaching uitgesteld naar fase 2","Garmin integratie eerst, dan Fitbit","Beta release gepland voor mei"]',
    aangemaakt_door: 2
  },
  {
    klant_id: 3, project_id: 3, titel: 'Oplevering Webshop Fase 1', datum: '2026-03-20T10:00:00',
    samenvatting: 'Bijna-oplevering van de webshop. Jan is zeer tevreden met het resultaat. Productcatalogus en bestelsysteem werken goed. Bezorgplanning nog in afrondende fase. Discussie over fase 2: mobiele app voor vaste klanten en loyaliteitsprogramma.',
    actiepunten: '["Bezorgplanning afronden deze week","Handleiding schrijven voor productbeheer","Fase 2 planning en offerte opstellen"]',
    besluiten: '["Go-live gepland voor 15 april","Jan beheert zelf producten via CMS","Fase 2 start najaar 2026"]',
    aangemaakt_door: 2
  },
  {
    klant_id: 6, project_id: 6, titel: 'Voortgangsoverleg Intranet', datum: '2026-03-25T15:00:00',
    samenvatting: 'Maandelijks voortgangsoverleg met Pieter. Kennisbank module is live en wordt goed gebruikt (120 artikelen, 45 dagelijkse bezoekers). Organogram module in development. Pieter vraagt om integratie met Microsoft Teams voor notificaties. Budget voor extra features besproken.',
    actiepunten: '["Teams integratie onderzoeken via Microsoft Graph API","Organogram afronden voor volgende sprint","Analytics dashboard voor intranet gebruik toevoegen"]',
    besluiten: '["Teams integratie als nice-to-have in scope","Prioriteit: organogram en nieuwsfeed","Volgende demo op 15 april"]',
    aangemaakt_door: 1
  },
];

const insertMeeting = db.prepare(`INSERT INTO meetings (klant_id, project_id, titel, datum, samenvatting, actiepunten, besluiten, status, aangemaakt_door, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'verwerkt', ?, '2025-09-01 09:00:00')`);

for (const m of meetingsData) {
  insertMeeting.run(m.klant_id, m.project_id, m.titel, m.datum, m.samenvatting, m.actiepunten, m.besluiten, m.aangemaakt_door);
}
console.log(`Inserted ${meetingsData.length} meetings`);

// ─── WIKI ARTIKELEN ────────────────────────────────────
const wikiData = [
  { titel: 'Git Workflow & Branch Strategie', inhoud: '# Git Workflow\n\nWij gebruiken een trunk-based development workflow met feature branches.\n\n## Branch naming\n- `feature/beschrijving` voor nieuwe features\n- `fix/beschrijving` voor bugfixes\n- `chore/beschrijving` voor onderhoud\n\n## Proces\n1. Maak een feature branch van `main`\n2. Ontwikkel en commit regelmatig\n3. Open een PR met beschrijving\n4. Minimaal 1 review nodig\n5. Squash merge naar main', categorie: 'development', auteur_id: 1 },
  { titel: 'Deployment Procedure', inhoud: '# Deployment\n\n## Vercel (Frontend)\n- Automatische deployments via GitHub\n- Preview deployments voor elke PR\n- Production deployment bij merge naar `main`\n\n## Checklist\n- [ ] Alle tests passing\n- [ ] TypeScript compilation ok\n- [ ] Environment variables gecheckt\n- [ ] Performance lighthouse check > 90', categorie: 'processen', auteur_id: 1 },
  { titel: 'Klant Onboarding Proces', inhoud: '# Klant Onboarding\n\n## Stappen\n1. **Kennismaking** - Eerste gesprek, behoeften inventariseren\n2. **Offerte** - Offerte opstellen en versturen\n3. **Contract** - Bij akkoord contract tekenen\n4. **Kick-off** - Project kick-off meeting\n5. **Setup** - Project setup in Linear, Notion, GitHub\n\n## Communicatie\n- Slack channel per klant\n- Wekelijkse standup call\n- Maandelijkse sprint review', categorie: 'processen', auteur_id: 2 },
  { titel: 'Facturatie Procedure', inhoud: '# Facturatie\n\n## Wanneer factureren\n- Sprint-based: na elke sprint op basis van gewerkte uren\n- Fixed-price: bij mijlpalen conform offerte\n\n## Proces\n1. Uren goedkeuren in dashboard\n2. Factuur aanmaken (concept)\n3. Review door tweede persoon\n4. Factuur versturen naar klant\n5. Betalingsherinnering na 7 dagen\n6. Tweede herinnering na 14 dagen', categorie: 'administratie', auteur_id: 1 },
  { titel: 'Tech Stack Documentatie', inhoud: '# Tech Stack\n\n## Frontend\n- **Framework**: Next.js 15 (App Router)\n- **Styling**: Tailwind CSS + shadcn/ui\n- **State**: TanStack Query\n- **Forms**: React Hook Form + Zod\n\n## Backend\n- **Database**: SQLite (Turso voor production)\n- **ORM**: Drizzle\n- **Auth**: Custom JWT + bcrypt\n- **AI**: Anthropic Claude API\n\n## Infrastructure\n- **Hosting**: Vercel\n- **CI/CD**: GitHub Actions\n- **Monitoring**: Vercel Analytics', categorie: 'development', auteur_id: 1 },
  { titel: 'Code Review Richtlijnen', inhoud: '# Code Review\n\n## Wat checken?\n- [ ] TypeScript types correct (nooit `any`)\n- [ ] Error handling aanwezig\n- [ ] Geen console.log in productie\n- [ ] Responsive design getest\n- [ ] Accessibility basics (labels, alt text)\n- [ ] Performance (geen onnodige re-renders)\n\n## Feedback geven\n- Wees constructief en specifiek\n- Stel vragen in plaats van bevelen\n- Prioriteer: blokkers vs nice-to-haves', categorie: 'development', auteur_id: 2 },
  { titel: 'Security Best Practices', inhoud: '# Security\n\n## Authentication\n- bcrypt voor wachtwoord hashing (cost factor 10)\n- JWT tokens met korte expiry (1 uur)\n- Refresh tokens met langere expiry (30 dagen)\n- 2FA optioneel maar aangeraden\n\n## Data\n- Input validatie met Zod schemas\n- Parameterized queries (Drizzle ORM)\n- CORS configuratie per environment\n- Rate limiting op API endpoints', categorie: 'security', auteur_id: 1 },
  { titel: 'Design Systeem', inhoud: '# Autronis Design Systeem\n\n## Kleuren\n- Primary: `#6366f1` (Indigo)\n- Accent: `#17B8A5` (Teal)\n- Background: `#0f172a` (Dark)\n- Surface: `#1e293b`\n\n## Typografie\n- Headings: Inter (semi-bold)\n- Body: Inter (regular)\n- Code: JetBrains Mono\n\n## Componenten\n- Gebruik shadcn/ui als basis\n- Custom componenten in `src/components/ui`\n- Consistente spacing: 4px grid', categorie: 'design', auteur_id: 2 },
  { titel: 'API Design Standaarden', inhoud: '# API Standards\n\n## REST Conventions\n- `GET /api/resource` - Lijst\n- `GET /api/resource/:id` - Detail\n- `POST /api/resource` - Aanmaken\n- `PUT /api/resource/:id` - Bijwerken\n- `DELETE /api/resource/:id` - Verwijderen\n\n## Response Format\n```json\n{ "data": {...}, "error": null }\n```\n\n## Error Handling\n- 400: Validatie fout\n- 401: Niet geauthenticeerd\n- 403: Geen rechten\n- 404: Niet gevonden\n- 500: Server fout', categorie: 'development', auteur_id: 1 },
  { titel: 'Notificatie & Communicatie Protocol', inhoud: '# Communicatie\n\n## Interne communicatie\n- **Slack**: dagelijkse communicatie, quick questions\n- **Linear**: taakbeheer, sprint planning\n- **GitHub**: code reviews, PR discussies\n- **Notion**: documentatie, meeting notes\n\n## Klantcommunicatie\n- **E-mail**: formele communicatie, facturen\n- **Slack Connect**: dagelijkse afstemming\n- **Google Meet**: wekelijkse standups\n- **Dashboard**: klantportaal voor projectstatus', categorie: 'processen', auteur_id: 2 },
];

const insertWiki = db.prepare(`INSERT INTO wiki_artikelen (titel, inhoud, categorie, auteur_id, gepubliceerd, aangemaakt_op, bijgewerkt_op)
  VALUES (?, ?, ?, ?, 1, '2025-08-01 09:00:00', '2026-03-29 10:00:00')`);

for (const w of wikiData) {
  insertWiki.run(w.titel, w.inhoud, w.categorie, w.auteur_id);
}
console.log(`Inserted ${wikiData.length} wiki artikelen`);

// ─── IDEEEN ────────────────────────────────────────────
const ideeenData = [
  { naam: 'AI-gestuurde offertes generator', categorie: 'product', status: 'in_onderzoek', omschrijving: 'Automatisch offertes genereren op basis van intake-formulier en historische projectdata. AI analyseert vergelijkbare projecten en stelt passend budget en timeline voor.', ai_score: 87, ai_haalbaarheid: 82, ai_marktpotentie: 90, ai_fit_autronis: 88, doelgroep: 'MKB bedrijven', verdienmodel: 'SaaS abonnement', aangemaakt_door: 1 },
  { naam: 'Client Health Score Dashboard', categorie: 'feature', status: 'idee', omschrijving: 'Dashboard dat automatisch klantgezondheid scoort op basis van communicatiefrequentie, betalingsgedrag, projectvoortgang en tevredenheidsscores.', ai_score: 79, ai_haalbaarheid: 88, ai_marktpotentie: 72, ai_fit_autronis: 85, doelgroep: 'Agencies', verdienmodel: 'Feature in dashboard', aangemaakt_door: 1 },
  { naam: 'Geautomatiseerde code audits', categorie: 'dienst', status: 'idee', omschrijving: 'Service die automatisch code quality, security en performance audits uitvoert voor MKB websites. Rapportage met concrete verbeterpunten en prioritering.', ai_score: 74, ai_haalbaarheid: 70, ai_marktpotentie: 78, ai_fit_autronis: 75, doelgroep: 'MKB met websites', verdienmodel: 'Per audit + abonnement', aangemaakt_door: 2 },
  { naam: 'White-label Dashboard voor Partners', categorie: 'product', status: 'in_onderzoek', omschrijving: 'Ons dashboard white-label aanbieden aan andere agencies. Zij gebruiken het onder eigen branding voor hun klanten.', ai_score: 91, ai_haalbaarheid: 65, ai_marktpotentie: 95, ai_fit_autronis: 92, doelgroep: 'Digital agencies', verdienmodel: 'SaaS per seat', aangemaakt_door: 1 },
  { naam: 'MKB Website Scanner', categorie: 'product', status: 'concept', omschrijving: 'Gratis tool die MKB websites scant op performance, SEO, security en toegankelijkheid. Genereert leads voor verbetertrajecten.', ai_score: 83, ai_haalbaarheid: 90, ai_marktpotentie: 85, ai_fit_autronis: 80, doelgroep: 'MKB ondernemers', verdienmodel: 'Freemium + lead gen', aangemaakt_door: 2 },
  { naam: 'AI Meeting Transcriptie & Actiepunten', categorie: 'feature', status: 'in_ontwikkeling', omschrijving: 'Automatisch meetings transcriberen en actiepunten, besluiten en vragen extraheren. Integratie met Google Meet en bestaande meeting module.', ai_score: 92, ai_haalbaarheid: 85, ai_marktpotentie: 88, ai_fit_autronis: 95, doelgroep: 'Intern + klanten', verdienmodel: 'Intern gebruik', aangemaakt_door: 1 },
  { naam: 'Retainer Management Module', categorie: 'feature', status: 'idee', omschrijving: 'Module voor het beheren van maandelijkse retainer contracten: urenpot, verbruik tracking, automatische facturatie en klantrapportage.', ai_score: 76, ai_haalbaarheid: 92, ai_marktpotentie: 70, ai_fit_autronis: 82, doelgroep: 'Agencies', verdienmodel: 'Dashboard feature', aangemaakt_door: 2 },
  { naam: 'Slim Capaciteitsplanning', categorie: 'feature', status: 'idee', omschrijving: 'AI-gestuurde capaciteitsplanning die beschikbaarheid, skills en projectdeadlines combineert. Waarschuwt bij overbezetting.', ai_score: 81, ai_haalbaarheid: 75, ai_marktpotentie: 80, ai_fit_autronis: 88, doelgroep: 'Agencies 5-20 man', verdienmodel: 'Dashboard feature', aangemaakt_door: 1 },
  { naam: 'Concurrentie Monitoring SaaS', categorie: 'product', status: 'concept', omschrijving: 'Geautomatiseerde concurrentie monitoring als standalone product. Dagelijks websites, social media en vacatures scannen van concurrenten.', ai_score: 68, ai_haalbaarheid: 72, ai_marktpotentie: 75, ai_fit_autronis: 60, doelgroep: 'MKB B2B', verdienmodel: 'SaaS abonnement', aangemaakt_door: 2 },
];

const insertIdee = db.prepare(`INSERT INTO ideeen (naam, categorie, status, omschrijving, ai_score, ai_haalbaarheid, ai_marktpotentie, ai_fit_autronis, doelgroep, verdienmodel, aangemaakt_door, aangemaakt_op, bijgewerkt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-01-15 09:00:00', '2026-03-29 10:00:00')`);

for (const i of ideeenData) {
  insertIdee.run(i.naam, i.categorie, i.status, i.omschrijving, i.ai_score, i.ai_haalbaarheid, i.ai_marktpotentie, i.ai_fit_autronis, i.doelgroep, i.verdienmodel, i.aangemaakt_door);
}
console.log(`Inserted ${ideeenData.length} ideeen`);

// ─── DOELEN ────────────────────────────────────────────
const doelenData = [
  // Sem - omzet doelen Q1 2026
  { gebruiker_id: 1, type: 'omzet', maand: 1, jaar: 2026, doelwaarde: 8000, huidige_waarde: 7450.50 },
  { gebruiker_id: 1, type: 'omzet', maand: 2, jaar: 2026, doelwaarde: 8000, huidige_waarde: 8215.00 },
  { gebruiker_id: 1, type: 'omzet', maand: 3, jaar: 2026, doelwaarde: 9000, huidige_waarde: 8730.25 },
  // Sem - uren doelen Q1 2026
  { gebruiker_id: 1, type: 'uren', maand: 1, jaar: 2026, doelwaarde: 140, huidige_waarde: 132 },
  { gebruiker_id: 1, type: 'uren', maand: 2, jaar: 2026, doelwaarde: 140, huidige_waarde: 145 },
  { gebruiker_id: 1, type: 'uren', maand: 3, jaar: 2026, doelwaarde: 150, huidige_waarde: 142 },
  // Syb - omzet doelen Q1 2026
  { gebruiker_id: 2, type: 'omzet', maand: 1, jaar: 2026, doelwaarde: 8000, huidige_waarde: 7125.00 },
  { gebruiker_id: 2, type: 'omzet', maand: 2, jaar: 2026, doelwaarde: 8000, huidige_waarde: 7890.50 },
  { gebruiker_id: 2, type: 'omzet', maand: 3, jaar: 2026, doelwaarde: 9000, huidige_waarde: 8450.75 },
  // Syb - uren doelen Q1 2026
  { gebruiker_id: 2, type: 'uren', maand: 1, jaar: 2026, doelwaarde: 140, huidige_waarde: 128 },
  { gebruiker_id: 2, type: 'uren', maand: 2, jaar: 2026, doelwaarde: 140, huidige_waarde: 138 },
  { gebruiker_id: 2, type: 'uren', maand: 3, jaar: 2026, doelwaarde: 150, huidige_waarde: 148 },
];

const insertDoel = db.prepare(`INSERT INTO doelen (gebruiker_id, type, maand, jaar, doelwaarde, huidige_waarde, aangemaakt_op, bijgewerkt_op)
  VALUES (?, ?, ?, ?, ?, ?, '2026-01-01 09:00:00', '2026-03-29 10:00:00')`);

for (const d of doelenData) {
  insertDoel.run(d.gebruiker_id, d.type, d.maand, d.jaar, d.doelwaarde, d.huidige_waarde);
}
console.log(`Inserted ${doelenData.length} doelen`);

// ─── BELASTING DEADLINES ───────────────────────────────
const deadlinesData = [
  { type: 'btw_aangifte', omschrijving: 'BTW aangifte Q1 2026', datum: '2026-04-30', kwartaal: 1, jaar: 2026, afgerond: 0 },
  { type: 'btw_aangifte', omschrijving: 'BTW aangifte Q2 2026', datum: '2026-07-31', kwartaal: 2, jaar: 2026, afgerond: 0 },
  { type: 'btw_aangifte', omschrijving: 'BTW aangifte Q3 2026', datum: '2026-10-31', kwartaal: 3, jaar: 2026, afgerond: 0 },
  { type: 'btw_aangifte', omschrijving: 'BTW aangifte Q4 2026', datum: '2027-01-31', kwartaal: 4, jaar: 2026, afgerond: 0 },
  { type: 'inkomstenbelasting', omschrijving: 'Aangifte inkomstenbelasting 2025', datum: '2026-05-01', kwartaal: null, jaar: 2025, afgerond: 0 },
  { type: 'voorlopige_aanslag', omschrijving: 'Voorlopige aanslag 2026 controleren', datum: '2026-03-01', kwartaal: null, jaar: 2026, afgerond: 1 },
];

const insertDeadline = db.prepare(`INSERT INTO belasting_deadlines (type, omschrijving, datum, kwartaal, jaar, afgerond, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, '2026-01-01 09:00:00')`);

for (const d of deadlinesData) {
  insertDeadline.run(d.type, d.omschrijving, d.datum, d.kwartaal, d.jaar, d.afgerond);
}
console.log(`Inserted ${deadlinesData.length} belasting deadlines`);

// ─── BTW AANGIFTES ─────────────────────────────────────
db.prepare(`INSERT INTO btw_aangiftes (kwartaal, jaar, btw_ontvangen, btw_betaald, btw_afdragen, status, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, '2026-01-01 09:00:00')`).run(
  1, 2026, 4875.32, 312.45, 4562.87, 'open'
);
console.log('Inserted 1 btw aangifte');

// ─── UREN CRITERIUM ────────────────────────────────────
db.prepare(`INSERT INTO uren_criterium (gebruiker_id, jaar, doel_uren, behaald_uren, zelfstandigenaftrek, mkb_vrijstelling, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, '2026-01-01 09:00:00')`).run(1, 2026, 1225, 419, 0, 0);
db.prepare(`INSERT INTO uren_criterium (gebruiker_id, jaar, doel_uren, behaald_uren, zelfstandigenaftrek, mkb_vrijstelling, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, '2026-01-01 09:00:00')`).run(2, 2026, 1225, 414, 0, 0);
console.log('Inserted 2 uren criterium entries');

// ─── KILOMETER REGISTRATIES ───────────────────────────
const kmData = [
  { gebruiker_id: 1, datum: '2026-01-15', van_locatie: 'Doetinchem (kantoor)', naar_locatie: 'Amsterdam (Veldhuis Architecten)', kilometers: 142, zakelijk_doel: 'Klantoverleg website redesign', klant_id: 1, project_id: 1 },
  { gebruiker_id: 2, datum: '2026-02-03', van_locatie: 'Doetinchem (kantoor)', naar_locatie: 'Rotterdam (GreenLogic BV)', kilometers: 156, zakelijk_doel: 'Workshop requirements dashboard', klant_id: 2, project_id: 2 },
  { gebruiker_id: 1, datum: '2026-02-18', van_locatie: 'Doetinchem (kantoor)', naar_locatie: 'Eindhoven (SportFusion)', kilometers: 168, zakelijk_doel: 'Sprint review trainingsapp', klant_id: 4, project_id: 4 },
  { gebruiker_id: 2, datum: '2026-03-05', van_locatie: 'Doetinchem (kantoor)', naar_locatie: 'Arnhem (Van den Berg Advocaten)', kilometers: 46, zakelijk_doel: 'Security review klantportaal', klant_id: 8, project_id: 8 },
  { gebruiker_id: 1, datum: '2026-03-20', van_locatie: 'Doetinchem (kantoor)', naar_locatie: 'Amsterdam (Nextera Solutions)', kilometers: 142, zakelijk_doel: 'Voortgangsoverleg intranet', klant_id: 6, project_id: 6 },
  { gebruiker_id: 2, datum: '2026-03-25', van_locatie: 'Doetinchem (kantoor)', naar_locatie: 'Arnhem (Bloem & Blad)', kilometers: 46, zakelijk_doel: 'Design review webshop', klant_id: 7, project_id: 7 },
];

const insertKm = db.prepare(`INSERT INTO kilometer_registraties (gebruiker_id, datum, van_locatie, naar_locatie, kilometers, zakelijk_doel, klant_id, project_id, tarief_per_km, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.23, '2026-01-01 09:00:00')`);

for (const k of kmData) {
  insertKm.run(k.gebruiker_id, k.datum, k.van_locatie, k.naar_locatie, k.kilometers, k.zakelijk_doel, k.klant_id, k.project_id);
}
console.log(`Inserted ${kmData.length} kilometer registraties`);

// ─── BANK TRANSACTIES ──────────────────────────────────
const bankData = [
  { datum: '2025-12-28', omschrijving: 'Veldhuis Architecten - AUT-2025-001', bedrag: 4891.43, type: 'bij', categorie: 'omzet', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-01-03', omschrijving: 'Vercel Inc. - Pro Plan', bedrag: -20.00, type: 'af', categorie: 'hosting', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-01-03', omschrijving: 'GitHub Inc. - Team', bedrag: -19.00, type: 'af', categorie: 'tools', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-01-08', omschrijving: 'Anthropic PBC - API Credits', bedrag: -147.50, type: 'af', categorie: 'ai', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-02-25', omschrijving: 'Van den Berg Advocaten - AUT-2026-001', bedrag: 6322.25, type: 'bij', categorie: 'omzet', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-03-03', omschrijving: 'Vercel Inc. - Pro Plan', bedrag: -20.00, type: 'af', categorie: 'hosting', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-03-08', omschrijving: 'Anthropic PBC - API Credits', bedrag: -213.75, type: 'af', categorie: 'ai', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-03-12', omschrijving: 'De Gouden Draak - AUT-2026-002', bedrag: 1742.40, type: 'bij', categorie: 'omzet', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-03-15', omschrijving: 'Amazon Web Services EMEA', bedrag: -51.23, type: 'af', categorie: 'hosting', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-03-18', omschrijving: 'SportFusion - AUT-2026-003', bedrag: 4791.60, type: 'bij', categorie: 'omzet', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-03-20', omschrijving: 'Google Ireland - Workspace', bedrag: -12.00, type: 'af', categorie: 'tools', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-03-22', omschrijving: 'Frontend Love - Conference Tickets', bedrag: -299.00, type: 'af', categorie: 'opleiding', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-03-22', omschrijving: 'Veldhuis Architecten - AUT-2026-004', bedrag: 9528.75, type: 'bij', categorie: 'omzet', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-03-25', omschrijving: 'Figma Inc. - Professional', bedrag: -12.00, type: 'af', categorie: 'design', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-03-26', omschrijving: 'NS Zakelijk - Dagkaart', bedrag: -23.40, type: 'af', categorie: 'reiskosten', status: 'gematcht', bank: 'Revolut Business' },
  { datum: '2026-03-28', omschrijving: 'Amazon Marketplace - Accessoires', bedrag: -34.99, type: 'af', categorie: 'hardware', status: 'gematcht', bank: 'Revolut Business' },
];

const insertBank = db.prepare(`INSERT INTO bank_transacties (datum, omschrijving, bedrag, type, categorie, status, bank, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, '2026-01-01 09:00:00')`);

for (const b of bankData) {
  insertBank.run(b.datum, b.omschrijving, b.bedrag, b.type, b.categorie, b.status, b.bank);
}
console.log(`Inserted ${bankData.length} bank transacties`);

// ─── SECOND BRAIN ITEMS ────────────────────────────────
const brainData = [
  { gebruiker_id: 1, type: 'artikel', titel: 'Building Scalable Real-time Applications with WebSockets', inhoud: 'Great overview of WebSocket architecture patterns for production apps. Covers connection pooling, heartbeat mechanisms, and scaling strategies.', ai_samenvatting: 'Technisch artikel over WebSocket architectuur met focus op schaalbaarheid en productie-readiness.', ai_tags: '["websockets","real-time","architectuur","scaling"]', bron_url: 'https://blog.logrocket.com/websocket-tutorial/', taal: 'en' },
  { gebruiker_id: 1, type: 'notitie', titel: 'AI Coaching Engine Architectuur Ideeën', inhoud: 'Mogelijke aanpak voor SportFusion AI coaching:\n- Supervised learning op workout data\n- LLM voor tekstuele feedback\n- Progressive overload algoritme\n- Injury prevention rules engine', ai_samenvatting: 'Architectuurnotities voor AI coaching engine met verschillende ML en rule-based aanpakken.', ai_tags: '["ai","machine-learning","sportfusion","architectuur"]', bron_url: null, taal: 'nl' },
  { gebruiker_id: 2, type: 'artikel', titel: 'The Complete Guide to Accessible Web Forms', inhoud: 'Comprehensive guide covering ARIA labels, error handling, keyboard navigation, and screen reader compatibility for web forms.', ai_samenvatting: 'Uitgebreide gids over toegankelijke webformulieren met ARIA, toetsenbordnavigatie en screen reader compatibiliteit.', ai_tags: '["accessibility","formulieren","aria","ux"]', bron_url: 'https://www.smashingmagazine.com/2023/02/guide-accessible-form-validation/', taal: 'en' },
  { gebruiker_id: 2, type: 'leeslijst', titel: 'Drizzle ORM - Advanced Patterns', inhoud: 'Bookmark: advanced Drizzle patterns including dynamic queries, complex joins, and migration strategies. Relevant for our dashboard optimization.', ai_samenvatting: 'Advanced Drizzle ORM patronen voor complexe queries en migraties.', ai_tags: '["drizzle","orm","database","typescript"]', bron_url: 'https://orm.drizzle.team/docs/guides', taal: 'en' },
  { gebruiker_id: 1, type: 'notitie', titel: 'Klant Feedback Patronen Q1', inhoud: 'Terugkerende feedback van klanten Q1 2026:\n- Meer visuele voortgangsrapportage gewenst\n- Snellere response times op vragen\n- Waardering voor proactieve suggesties\n- Behoefte aan simpelere documentatie', ai_samenvatting: 'Overzicht van terugkerende klantfeedback patronen in Q1 2026.', ai_tags: '["feedback","klanten","q1","verbetering"]', bron_url: null, taal: 'nl' },
];

const insertBrain = db.prepare(`INSERT INTO second_brain_items (gebruiker_id, type, titel, inhoud, ai_samenvatting, ai_tags, bron_url, taal, is_favoriet, is_gearchiveerd, aangemaakt_op, bijgewerkt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '2026-02-01 09:00:00', '2026-03-29 10:00:00')`);

for (const b of brainData) {
  insertBrain.run(b.gebruiker_id, b.type, b.titel, b.inhoud, b.ai_samenvatting, b.ai_tags, b.bron_url, b.taal);
}
console.log(`Inserted ${brainData.length} second brain items`);

// ─── DOCUMENTEN ────────────────────────────────────────
const docData = [
  { klant_id: 1, project_id: 1, naam: 'Wireframes v2 - Veldhuis Website', type: 'design', aangemaakt_door: 2 },
  { klant_id: 4, project_id: 4, naam: 'Technisch Ontwerp SportFusion Platform', type: 'specificatie', aangemaakt_door: 1 },
  { klant_id: 8, project_id: 8, naam: 'Security Audit Rapport - Klantportaal', type: 'rapport', aangemaakt_door: 1 },
  { klant_id: 2, project_id: 2, naam: 'API Specificatie GreenLogic Dashboard', type: 'specificatie', aangemaakt_door: 1 },
  { klant_id: 6, project_id: 6, naam: 'Handleiding Kennisbank Beheer', type: 'handleiding', aangemaakt_door: 2 },
  { klant_id: 3, project_id: 3, naam: 'Productfotografie Richtlijnen Bakkerij', type: 'handleiding', aangemaakt_door: 2 },
];

const insertDoc = db.prepare(`INSERT INTO documenten (klant_id, project_id, naam, type, aangemaakt_door, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, '2026-02-01 09:00:00')`);

for (const d of docData) {
  insertDoc.run(d.klant_id, d.project_id, d.naam, d.type, d.aangemaakt_door);
}
console.log(`Inserted ${docData.length} documenten`);

// ─── NOTIFICATIES ──────────────────────────────────────
const notifData = [
  { gebruiker_id: 1, type: 'factuur_te_laat', titel: 'Factuur AUT-2026-010 is verlopen', omschrijving: 'SportFusion heeft factuur AUT-2026-010 (€5.500,00) nog niet betaald. Vervaldatum was 3 maart.', link: '/facturen/11' },
  { gebruiker_id: 1, type: 'deadline_nadert', titel: 'Deadline Webshop Bakkerij nadert', omschrijving: 'De deadline voor Webshop Bakkerij van Dijk is over 17 dagen (15 april 2026).', link: '/projecten/3' },
  { gebruiker_id: 2, type: 'factuur_te_laat', titel: 'Factuur AUT-2026-011 is verlopen', omschrijving: 'De Gouden Draak heeft factuur AUT-2026-011 (€1.920,00) nog niet betaald. Vervaldatum was 17 maart.', link: '/facturen/12' },
  { gebruiker_id: 2, type: 'taak_toegewezen', titel: 'Nieuwe taak toegewezen', omschrijving: 'Sem heeft je de taak "Lead capture formulier en CRM koppeling" toegewezen voor SportFusion Marketing Website.', link: '/taken/38' },
  { gebruiker_id: 1, type: 'belasting_deadline', titel: 'BTW aangifte Q1 - 30 dagen', omschrijving: 'De BTW aangifte voor Q1 2026 moet voor 30 april ingediend worden.', link: '/belasting' },
];

const insertNotif = db.prepare(`INSERT INTO notificaties (gebruiker_id, type, titel, omschrijving, link, gelezen, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, 0, '2026-03-29 09:00:00')`);

for (const n of notifData) {
  insertNotif.run(n.gebruiker_id, n.type, n.titel, n.omschrijving, n.link);
}
console.log(`Inserted ${notifData.length} notificaties`);

// ─── TEAM ACTIVITEIT ───────────────────────────────────
const teamData = [
  { gebruiker_id: 1, type: 'taak_afgerond', taak_id: 37, project_id: 9, bericht: 'Scroll-animaties en micro-interactions afgerond voor SportFusion Marketing Website' },
  { gebruiker_id: 2, type: 'taak_gepakt', taak_id: 38, project_id: 9, bericht: 'Begonnen aan lead capture formulier en CRM koppeling' },
  { gebruiker_id: 1, type: 'bezig_met', taak_id: 33, project_id: 8, bericht: 'Bezig met dossierstatus timeline voor Van den Berg Advocaten portaal' },
  { gebruiker_id: 2, type: 'taak_afgerond', taak_id: 36, project_id: 9, bericht: 'Landingspagina design en content afgerond' },
  { gebruiker_id: 1, type: 'taak_update', taak_id: 9, project_id: 2, bericht: 'WebSocket connectie werkt, nu bezig met dashboard widgets' },
  { gebruiker_id: 2, type: 'bezig_met', taak_id: 26, project_id: 6, bericht: 'Bezig met zoekfunctie voor Nextera kennisbank' },
  { gebruiker_id: 1, type: 'taak_gepakt', taak_id: 15, project_id: 3, bericht: 'Bezorgplanning algoritme opgepakt voor Bakkerij van Dijk' },
  { gebruiker_id: 2, type: 'taak_update', taak_id: 4, project_id: 1, bericht: 'Three.js renderer werkt, bezig met modeloptimalisatie' },
  { gebruiker_id: 1, type: 'taak_afgerond', taak_id: 25, project_id: 6, bericht: 'Azure AD SSO integratie volledig werkend' },
  { gebruiker_id: 2, type: 'taak_afgerond', taak_id: 22, project_id: 5, bericht: 'Reserveringsformulier en validatie afgerond en getest' },
];

const insertTeam = db.prepare(`INSERT INTO team_activiteit (gebruiker_id, type, taak_id, project_id, bericht, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?)`);

const recentDates = [
  '2026-03-29 09:45:00', '2026-03-29 09:15:00', '2026-03-28 16:30:00',
  '2026-03-28 14:20:00', '2026-03-28 11:00:00', '2026-03-27 15:45:00',
  '2026-03-27 10:30:00', '2026-03-26 16:15:00', '2026-03-26 11:00:00',
  '2026-03-25 14:00:00',
];

for (let i = 0; i < teamData.length; i++) {
  const t = teamData[i];
  insertTeam.run(t.gebruiker_id, t.type, t.taak_id, t.project_id, t.bericht, recentDates[i]);
}
console.log(`Inserted ${teamData.length} team activiteit entries`);

// ─── BELASTING TIPS ────────────────────────────────────
const tipsData = [
  { categorie: 'aftrekpost', titel: 'Zelfstandigenaftrek 2026', beschrijving: 'Als je minimaal 1.225 uur per jaar besteedt aan je onderneming, heb je recht op de zelfstandigenaftrek. Dit verlaagt je belastbaar inkomen aanzienlijk.', voordeel: '€3.750 aftrek', bron: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/inkomstenbelasting/inkomstenbelasting_voor_ondernemers/zelfstandigenaftrek', bron_naam: 'Belastingdienst', jaar: 2026 },
  { categorie: 'aftrekpost', titel: 'MKB-winstvrijstelling', beschrijving: 'Na aftrek van de zelfstandigenaftrek mag je 13,31% van de resterende winst aftrekken als MKB-winstvrijstelling. Dit geldt automatisch voor alle IB-ondernemers.', voordeel: '13,31% van restwinst', bron: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/inkomstenbelasting/inkomstenbelasting_voor_ondernemers/mkb-winstvrijstelling', bron_naam: 'Belastingdienst', jaar: 2026 },
  { categorie: 'regeling', titel: 'Kleinschaligheidsinvesteringsaftrek (KIA)', beschrijving: 'Bij investeringen tussen €2.801 en €387.580 kun je een deel als extra aftrekpost opvoeren. Handig bij aanschaf van nieuwe apparatuur of software licenties.', voordeel: '28% bij investering €2.801-€69.764', bron: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/inkomstenbelasting/inkomstenbelasting_voor_ondernemers/investeringsaftrek/kleinschaligheidsinvesteringsaftrek', bron_naam: 'Belastingdienst', jaar: 2026 },
  { categorie: 'optimalisatie', titel: 'Thuiswerkkosten aftrekken', beschrijving: 'Als ZZP-er kun je een deel van je woonkosten aftrekken als je een werkruimte hebt die voldoet aan de eisen. Denk aan huur, energie en internetkosten.', voordeel: 'Variabel (afhankelijk van werkruimte)', bron: 'https://www.belastingdienst.nl/', bron_naam: 'Belastingdienst', jaar: null },
  { categorie: 'weetje', titel: 'Fiscale voordelen van elektrisch rijden', beschrijving: 'Een elektrische auto heeft lagere bijtelling (16% in 2026) en de milieu-investeringsaftrek (MIA) kan tot 45% van de investering opleveren als extra aftrek.', voordeel: '16% bijtelling + MIA tot 45%', bron: 'https://www.rvo.nl/subsidies-financiering/mia-vamil', bron_naam: 'RVO', jaar: 2026 },
];

const insertTip = db.prepare(`INSERT INTO belasting_tips (categorie, titel, beschrijving, voordeel, bron, bron_naam, jaar, is_ai_gegenereerd, toegepast, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, '2026-01-15 09:00:00')`);

for (const t of tipsData) {
  insertTip.run(t.categorie, t.titel, t.beschrijving, t.voordeel, t.bron, t.bron_naam, t.jaar);
}
console.log(`Inserted ${tipsData.length} belasting tips`);

// ─── SCREEN TIME ENTRIES ───────────────────────────────
// March 24-30, 2026 (Mon-Sun, but we only do weekdays + Saturday partially)
const stWeekdays = getWeekdays('2026-03-24', '2026-03-28'); // Mon-Fri
// Add Saturday March 28 partial day for realism... actually 28 is Saturday already, skip it
// Actually March 24 = Tuesday (2026-03-24 is a Tuesday), let's verify
// March 2026: 1=Sun, 2=Mon... 24=Tue, 25=Wed, 26=Thu, 27=Fri, 28=Sat, 29=Sun, 30=Mon
// So weekdays: 24, 25, 26, 27 (Tue-Fri) and 30 (Mon)
const screenTimeDays = ['2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-30'];

const stApps = [
  { app: 'VS Code', categorie: 'development', weight: 35 },
  { app: 'Chrome', categorie: 'development', weight: 20 },
  { app: 'Figma', categorie: 'design', weight: 10 },
  { app: 'Slack', categorie: 'communicatie', weight: 12 },
  { app: 'Google Meet', categorie: 'meeting', weight: 8 },
  { app: 'Notion', categorie: 'administratie', weight: 8 },
  { app: 'Terminal', categorie: 'development', weight: 5 },
  { app: 'YouTube', categorie: 'afleiding', weight: 2 },
];

const windowTitles = {
  'VS Code': ['src/components/Dashboard.tsx', 'api/routes/facturen.ts', 'lib/db/schema.ts', 'components/ui/DataTable.tsx', 'pages/klanten/[id].tsx', 'hooks/useProjects.ts', 'middleware.ts', 'app/layout.tsx'],
  'Chrome': ['localhost:3000 - Dashboard', 'Tailwind CSS Docs', 'MDN Web Docs', 'Stack Overflow', 'GitHub Pull Requests', 'Vercel Dashboard', 'Anthropic Console', 'Drizzle ORM Docs'],
  'Figma': ['Veldhuis - Website Redesign', 'SportFusion - App Screens', 'Bloem & Blad - Webshop', 'Design System - Components'],
  'Slack': ['#general - Autronis', '#project-veldhuis', '#project-greenlogic', 'DM - Sem Gijsberts', 'DM - Syb Miedema', '#dev-discussion'],
  'Google Meet': ['Klantoverleg Veldhuis', 'Sprint Planning', 'Demo GreenLogic', 'Standup', 'Intake Studio Lux'],
  'Notion': ['Sprint Board', 'Meeting Notes', 'Project Documentatie', 'Werkprocessen', 'Weekplanning'],
  'Terminal': ['npm run dev', 'git log --oneline', 'npx drizzle-kit push', 'node scripts/migrate.ts'],
  'YouTube': ['Fireship - 100 seconds', 'Theo - Next.js tips', 'Tech conference talk'],
};

const projectMappings = {
  'src/components/Dashboard.tsx': { project_id: null, klant_id: null },
  'Veldhuis - Website Redesign': { project_id: 1, klant_id: 1 },
  '#project-veldhuis': { project_id: 1, klant_id: 1 },
  'Klantoverleg Veldhuis': { project_id: 1, klant_id: 1 },
  'SportFusion - App Screens': { project_id: 4, klant_id: 4 },
  'Demo GreenLogic': { project_id: 2, klant_id: 2 },
  '#project-greenlogic': { project_id: 2, klant_id: 2 },
  'Bloem & Blad - Webshop': { project_id: 7, klant_id: 7 },
};

let stId = 1;
const insertST = db.prepare(`INSERT INTO screen_time_entries (client_id, gebruiker_id, app, venster_titel, categorie, project_id, klant_id, start_tijd, eind_tijd, duur_seconden, bron, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agent', ?)`);

for (const day of screenTimeDays) {
  for (const userId of [1, 2]) {
    // Generate 8-10 entries per day per user
    const numEntries = randomBetween(8, 10);
    let currentHour = randomBetween(8, 9);
    let currentMin = randomBetween(10, 45);

    for (let i = 0; i < numEntries; i++) {
      // Pick an app based on weights
      const totalWeight = stApps.reduce((sum, a) => sum + a.weight, 0);
      let rand = Math.random() * totalWeight;
      let selectedApp = stApps[0];
      for (const app of stApps) {
        rand -= app.weight;
        if (rand <= 0) { selectedApp = app; break; }
      }

      const vensterTitel = pick(windowTitles[selectedApp.app]);
      const mapping = projectMappings[vensterTitel] || { project_id: null, klant_id: null };

      // Duration: 15-90 minutes for productive, 5-20 for distractions
      const duurMin = selectedApp.categorie === 'afleiding' ? randomBetween(5, 20) : randomBetween(15, 90);
      const duurSec = duurMin * 60;

      const startTijd = `${day}T${pad(currentHour)}:${pad(currentMin)}:00`;
      const endMin = currentMin + duurMin;
      let endHour = currentHour + Math.floor(endMin / 60);
      const endMinActual = endMin % 60;
      if (endHour > 18) break; // Don't go past 18:00
      const eindTijd = `${day}T${pad(endHour)}:${pad(endMinActual)}:00`;

      const clientId = crypto.randomUUID();
      insertST.run(clientId, userId, selectedApp.app, vensterTitel, selectedApp.categorie, mapping.project_id, mapping.klant_id, startTijd, eindTijd, duurSec, startTijd);
      stId++;

      // Move current time forward
      currentHour = endHour;
      currentMin = endMinActual + randomBetween(2, 15);
      if (currentMin >= 60) { currentHour++; currentMin -= 60; }
    }
  }
}
console.log(`Inserted ${stId - 1} screen time entries`);

// ─── SCREEN TIME SAMENVATTINGEN ────────────────────────
const insertSTS = db.prepare(`INSERT INTO screen_time_samenvattingen (gebruiker_id, datum, samenvatting_kort, samenvatting_detail, totaal_seconden, productief_percentage, top_project, aangemaakt_op)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

for (const day of screenTimeDays) {
  for (const userId of [1, 2]) {
    const totaalSec = randomBetween(25200, 32400); // 7-9 hours
    const productief = randomBetween(78, 95);
    const naam = userId === 1 ? 'Sem' : 'Syb';
    const topProject = pick(['Website Redesign Veldhuis', 'GreenLogic Dashboard', 'SportFusion Trainingsplatform', 'Klantportaal Van den Berg Advocaten']);
    const kort = `${naam} heeft ${(totaalSec / 3600).toFixed(1)} uur gewerkt, ${productief}% productief. Meeste tijd aan ${topProject}.`;
    const detail = `Productiviteitsoverzicht voor ${day}: ${(totaalSec / 3600).toFixed(1)} uur totaal actief. Hoofdzakelijk development (${randomBetween(55, 70)}%), communicatie (${randomBetween(10, 18)}%), design (${randomBetween(5, 12)}%). ${productief}% van de tijd was productief besteed. Top project: ${topProject}.`;

    insertSTS.run(userId, day, kort, detail, totaalSec, productief, topProject, `${day}T23:00:00`);
  }
}
console.log(`Inserted ${screenTimeDays.length * 2} screen time samenvattingen`);

// ─── PRINT SUMMARY ─────────────────────────────────────
console.log('\n========================================');
console.log('  SEED COMPLETE - TABLE COUNTS');
console.log('========================================');

const countTables = [
  'gebruikers', 'bedrijfsinstellingen', 'klanten', 'projecten', 'taken',
  'tijdregistraties', 'facturen', 'factuur_regels', 'inkomsten', 'uitgaven',
  'abonnementen', 'leads', 'agenda_items', 'offertes', 'offerte_regels',
  'meetings', 'wiki_artikelen', 'ideeen', 'doelen', 'belasting_deadlines',
  'btw_aangiftes', 'uren_criterium', 'kilometer_registraties', 'bank_transacties',
  'second_brain_items', 'documenten', 'notificaties', 'team_activiteit',
  'belasting_tips', 'screen_time_entries', 'screen_time_samenvattingen',
];

let totalRows = 0;
for (const table of countTables) {
  try {
    const count = db.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get().c;
    console.log(`  ${table.padEnd(30)} ${count}`);
    totalRows += count;
  } catch (e) {
    console.log(`  ${table.padEnd(30)} ERROR: ${e.message}`);
  }
}

console.log('========================================');
console.log(`  TOTAL ROWS: ${totalRows}`);
console.log('========================================');

db.close();
console.log('\nDone! Database seeded successfully.');
