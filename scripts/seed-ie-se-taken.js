const Database = require('better-sqlite3');
const db = new Database('./data/autronis.db');

const insert = db.prepare(`
  INSERT INTO taken (project_id, titel, omschrijving, fase, volgorde, prioriteit, status, toegewezen_aan, aangemaakt_door)
  VALUES (?, ?, ?, ?, ?, ?, 'open', 1, 1)
`);

// Investment Engine (project_id = 10)
const ieTaken = [
  // Fase 1: Data & Portfolio
  ["Portfolio dashboard met realtime P&L", "Overzicht van alle posities met winst/verlies per asset. De homepage van de app.", "Fase 1: Portfolio", 0, "hoog"],
  ["Binance API koppeling", "Realtime prijzen en portfolio data ophalen via Binance API. Basis voor alles.", "Fase 1: Portfolio", 1, "hoog"],
  ["Asset allocatie visualisatie", "Pie chart / bar chart die toont hoe je portfolio verdeeld is over assets.", "Fase 1: Portfolio", 2, "hoog"],
  ["Transactie historie", "Alle buy/sell transacties loggen en tonen. Basis voor P&L berekening.", "Fase 1: Portfolio", 3, "hoog"],

  // Fase 2: Analyse
  ["Technische analyse indicators", "RSI, MACD, Bollinger Bands etc. berekenen en tonen op price charts.", "Fase 2: Analyse", 0, "normaal"],
  ["Price alerts", "Notificatie wanneer een asset een bepaalde prijs bereikt. Push of email.", "Fase 2: Analyse", 1, "normaal"],
  ["Correlatie matrix", "Welke assets bewegen samen? Helpt bij diversificatie beslissingen.", "Fase 2: Analyse", 2, "normaal"],
  ["Historische performance vergelijking", "Vergelijk je portfolio performance met BTC, ETH, S&P500 over tijd.", "Fase 2: Analyse", 3, "normaal"],

  // Fase 3: AI & Strategie
  ["AI markt sentiment analyse", "AI analyseert nieuws en social media voor marktsentiment per asset.", "Fase 3: AI & Strategie", 0, "normaal"],
  ["Geautomatiseerde DCA strategie", "Dollar Cost Averaging automatisch uitvoeren op vaste momenten.", "Fase 3: AI & Strategie", 1, "normaal"],
  ["Risk management dashboard", "Max drawdown, Sharpe ratio, risk/reward metrics. Hoeveel risico loop je?", "Fase 3: AI & Strategie", 2, "normaal"],
  ["AI trade suggesties", "Op basis van technische analyse en sentiment, suggesties voor trades.", "Fase 3: AI & Strategie", 3, "laag"],
];

// Sales Engine (project_id = 11)
const seTaken = [
  // Fase 1: Proposals
  ["Proposal template systeem", "Herbruikbare templates voor offertes met dynamische secties. Basis van de engine.", "Fase 1: Proposals", 0, "hoog"],
  ["Klant intake formulier", "Formulier dat alle info verzamelt die nodig is voor een goede offerte.", "Fase 1: Proposals", 1, "hoog"],
  ["AI offerte generatie", "Op basis van intake een complete offerte laten schrijven door AI. Inclusief scope, timeline, prijs.", "Fase 1: Proposals", 2, "hoog"],
  ["PDF export met Autronis branding", "Professionele PDF genereren van de offerte, klaar om te versturen.", "Fase 1: Proposals", 3, "hoog"],

  // Fase 2: Pipeline
  ["Sales pipeline board", "Kanban-achtig bord: Lead → Contact → Offerte → Gewonnen/Verloren. Visueel overzicht.", "Fase 2: Pipeline", 0, "normaal"],
  ["Follow-up reminders", "Automatische herinneringen wanneer je een lead moet opvolgen.", "Fase 2: Pipeline", 1, "normaal"],
  ["Email templates", "Voorgeschreven emails voor elke fase: intro, follow-up, offerte, bedankt.", "Fase 2: Pipeline", 2, "normaal"],
  ["Win/loss analyse", "Waarom win of verlies je deals? Patronen herkennen om beter te worden.", "Fase 2: Pipeline", 3, "normaal"],

  // Fase 3: Integratie
  ["Koppeling met Autronis Dashboard", "Leads en deals synchroniseren met het hoofddashboard.", "Fase 3: Integratie", 0, "normaal"],
  ["Automatische factuur na gewonnen deal", "Als deal gewonnen → automatisch factuur aanmaken in het dashboard.", "Fase 3: Integratie", 1, "normaal"],
  ["ROI calculator voor klanten", "Tool die potentiele klanten laat zien hoeveel ze besparen met automatisering.", "Fase 3: Integratie", 2, "laag"],
  ["Case study koppeling", "Relevante case studies automatisch koppelen aan offertes voor social proof.", "Fase 3: Integratie", 3, "laag"],
];

let count = 0;
for (const [titel, beschrijving, fase, volgorde, prioriteit] of ieTaken) {
  insert.run(10, titel, beschrijving, fase, volgorde, prioriteit);
  count++;
}
for (const [titel, beschrijving, fase, volgorde, prioriteit] of seTaken) {
  insert.run(11, titel, beschrijving, fase, volgorde, prioriteit);
  count++;
}

console.log(count + " taken toegevoegd");

// Final overview
const projects = db.prepare(`
  SELECT p.naam,
    (SELECT COUNT(*) FROM taken t WHERE t.project_id = p.id) as totaal,
    (SELECT COUNT(*) FROM taken t WHERE t.project_id = p.id AND t.status = 'afgerond') as af
  FROM projecten p WHERE p.is_actief = 1 ORDER BY p.naam
`).all();
console.log("\nProjecten overzicht:");
projects.forEach(p => console.log("  " + p.naam + ": " + p.totaal + " taken (" + p.af + " af)"));
