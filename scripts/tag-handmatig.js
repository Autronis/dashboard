const Database = require('better-sqlite3');
const db = new Database('./data/autronis.db');

// Tasks that require manual action (Sem must do something himself — not AI-buildable)
// Format: [id, reason appended to description]
const handmatig = [
  // Case Study Generator
  [24, "\n\n⚠️ Handmatige actie: Jobby klantdata verzamelen en invullen."],
  [31, "\n\n⚠️ Handmatige actie: Jobby case study data aanleveren en resultaat reviewen."],
  [39, "\n\n⚠️ Handmatige actie: Screen recordings maken van het klantproject."],
  [40, "\n\n⚠️ Handmatige actie: Echte KPI metrics en processtappen invullen per klant."],
  [53, "\n\n⚠️ Handmatige actie: Domein/hosting configureren voor autronis.com pagina."],

  // Learning Radar (Dashboard)
  [2,  "\n\n⚠️ Handmatige actie: RSS feed URLs selecteren en configureren in Supabase."],
  [13, "\n\n⚠️ Handmatige actie: Twitter/X API key aanvragen en betalen."],
  [9,  "\n\n⚠️ Handmatige actie: Email/Telegram bot token aanmaken en configureren."],

  // Investment Engine
  [59, "\n\n⚠️ Handmatige actie: Binance API key aanmaken met juiste permissions."],
  [63, "\n\n⚠️ Handmatige actie: Bepalen welke assets en prijsniveaus alerts moeten krijgen."],
  [67, "\n\n⚠️ Handmatige actie: DCA bedragen en frequentie instellen per asset."],

  // Sales Engine
  [71, "\n\n⚠️ Handmatige actie: Intake vragen bepalen op basis van echte klantgesprekken."],
  [73, "\n\n⚠️ Handmatige actie: Autronis bedrijfsgegevens (KvK, BTW, IBAN) invullen voor PDF."],
  [76, "\n\n⚠️ Handmatige actie: Email templates schrijven in eigen tone-of-voice."],
];

const update = db.prepare("UPDATE taken SET omschrijving = omschrijving || ? WHERE id = ?");
let count = 0;
for (const [id, tag] of handmatig) {
  update.run(tag, id);
  count++;
}

console.log(count + " taken getagd als handmatige actie");

// Verify
const sample = db.prepare("SELECT id, titel, omschrijving FROM taken WHERE id IN (24, 59, 71)").all();
sample.forEach(t => console.log("\n" + t.id + ": " + t.titel + "\n" + t.omschrijving));
