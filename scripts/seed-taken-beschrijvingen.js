const Database = require('better-sqlite3');
const db = new Database('./data/autronis.db');

const beschrijvingen = {
  // Learning Radar - Fase 1
  1: "Een n8n workflow die elke ochtend automatisch draait om nieuwe AI/tech artikelen op te halen. Dit is de basis van het hele systeem.",
  2: "RSS feeds configureren voor bronnen als TechCrunch AI, The Batch, AI News. Haalt titels, links en publicatiedatums op.",
  5: "Database tabel voor radar items met titel, bron, URL, score, samenvatting en datum. Zodat je historisch kunt zoeken.",
  3: "AI prompt die elk artikel beoordeelt op relevantie voor Autronis (1-10). Kijkt naar: toepasbaar voor klanten? Past bij workflow automatisering?",
  4: "Alleen items met score 7+ doorlaten. Voorkomt information overload - je ziet alleen wat echt relevant is.",
  // Learning Radar - Fase 2
  10: "Reddit API voor r/artificial en r/automation. Veel early signals komen van Reddit die niet via RSS verschijnen.",
  11: "Product Hunt API om nieuwe AI tools en SaaS te monitoren. Interessant voor klantgesprekken.",
  12: "GitHub Trending monitoren voor nieuwe AI/automation repositories. Welke open source tools krijgen momentum?",
  13: "Twitter/X monitoring voor AI thought leaders (als API betaalbaar is). Breaking news verschijnt eerst op X.",
  14: "Detecteer dubbel nieuws over meerdere bronnen en merge tot één item. Voorkomt dubbele entries.",
  // Learning Radar - Fase 3
  6: "AI genereert per item: wat is het, waarom relevant voor Autronis, wat kun je ermee. Scheelt 5 min leestijd per artikel.",
  7: "Items categoriseren in: Nieuwe tools, API updates, Trends, Kansen, Must-reads. Snel scannen wat je eerst wilt lezen.",
  8: "Wekelijkse samengevatte digest per categorie. Ideaal om maandagochtend met Syb door te nemen.",
  9: "Digest automatisch versturen via email of Telegram. Krijg het zonder dashboard te openen.",
  // Learning Radar - Fase 4
  15: "Compact widget op de homepage met top 5 items. Eén blik en je weet wat er speelt.",
  16: "Meest relevante AI-nieuwtje toevoegen aan Daily Briefing. Elke ochtend één ding leren.",
  17: "Volledige pagina met alle radar items, filters, zoeken en categorieën. Dieper duiken.",
  18: "Items markeren als bewaard voor later. Handig voor artikelen die je nog wilt lezen of delen.",
  19: "Full-text zoeken in historische radar items. Wanneer zag ik dat artikel over n8n alternatieven?",
  // Case Study Generator - Fase 1
  20: "De bestaande demo template analyseren: welke scenes, animaties en data gebruikt het. Startpunt voor configureerbare versie.",
  21: "Hardcoded waarden (klantnaam, metrics, kleuren) naar JSON config. Eén template voor meerdere klanten.",
  22: "TypeScript interface voor video template config: klantnaam, kleuren, teksten, timings. Per klant anders zonder code te wijzigen.",
  23: "Remotion template aanpassen zodat het config inleest en dynamisch rendert. Geen hardcoded data meer.",
  24: "Jobby klantdata als eerste config testen. Proof of concept dat het systeem werkt.",
  25: "Video renderen via CLI met npx remotion render. Automatiseerbaar zonder Remotion studio.",
  // Case Study Generator - Fase 2
  26: "Prompt die op basis van klantinput een case study genereert met context, probleem, oplossing en resultaat.",
  27: "Claude API koppelen voor tekst generatie. Inclusief retry logica en token management.",
  28: "Case study opslaan als JSON (voor video) en Markdown (voor website). Twee formaten, één proces.",
  29: "AI genereert relevante technology tags (Make.com, OpenAI, PostgreSQL) op basis van case study inhoud.",
  30: "Overtuigende klant-quote suggereren op basis van resultaten. Klant kan aanpassen maar heeft goed startpunt.",
  31: "Hele Fase 2 pipeline testen met Jobby data. Valideren dat tekst, tags en quote kloppen.",
  // Case Study Generator - Fase 3
  32: "Prompt voor voiceover script met per-scene timings. Audio synchroon met video scenes.",
  33: "ElevenLabs API integreren voor text-to-speech. Stem, snelheid en format configureerbaar.",
  34: "Audio bestanden opslaan en koppelen aan case study. Inclusief metadata over duur en formaat.",
  35: "Audio timings koppelen aan Remotion scene durations. Tekst en audio synchroon.",
  36: "Screen recording labels synchroniseren met voiceover timestamps. Label verschijnt wanneer het wordt uitgesproken.",
  // Case Study Generator - Fase 4
  37: "Webformulier voor case study input: klant, probleem, oplossing, metrics. Alles op één plek invoeren.",
  38: "Klant en project selectie uit dashboard data. Niet alles handmatig hoeven intypen.",
  39: "Screen recording bestanden uploaden voor de case study video. Drag & drop met preview.",
  40: "KPI metrics (40% tijdsbesparing) en processtappen invoeren die in de video getoond worden.",
  41: "AI suggesties voor timestamps bij screen recording labels. Waar moeten labels verschijnen?",
  42: "Preview van alle data voordat generatie start. Laatste check voordat je API calls verbruikt.",
  // Case Study Generator - Fase 5
  43: "Twee tot drie banner templates in 1080x1350 (Instagram/LinkedIn). Professioneel en consistent.",
  44: "Autronis huisstijl: donkere achtergrond, turquoise accenten, bold tekst. Herkenbaar als Autronis.",
  45: "Banners dynamisch: klantnaam, key metric en logo automatisch ingevuld per case study.",
  46: "Template rotatie zodat opeenvolgende banners niet identiek zijn. Variatie in het grid.",
  47: "Banners exporteren als hoge kwaliteit PNG, klaar voor social media.",
  // Case Study Generator - Fase 6
  48: "Dashboard pagina met alle case studies: status, preview en downloads.",
  49: "Detail pagina met KPI cards, context/probleem/oplossing/resultaat secties visueel gepresenteerd.",
  50: "Visueel system overview diagram: welke systemen gebruikt de klant en hoe zijn ze gekoppeld.",
  51: "Klant review/quote sectie. Toont de (eventueel AI-gegenereerde) testimonial.",
  52: "Embedded video player voor Watch demo. Speelt case study video direct af.",
  53: "Publieke variant voor autronis.com. Zonder login, SEO-geoptimaliseerd.",
  54: "Complete pipeline: formulier -> AI tekst -> voiceover -> video -> banner -> dashboard. Eén klik.",
  55: "n8n workflow of Node.js script als orchestrator. API calls, file management, status updates.",
  56: "Real-time voortgang tijdens generatie. Welke stap is bezig, hoelang duurt het nog.",
  57: "Robuuste error handling met retry. Als API faalt: opnieuw proberen en loggen.",
};

const update = db.prepare("UPDATE taken SET omschrijving = ? WHERE id = ?");
let count = 0;
for (const [id, beschrijving] of Object.entries(beschrijvingen)) {
  update.run(beschrijving, Number(id));
  count++;
}
console.log(count + " beschrijvingen toegevoegd");

// Verify
const sample = db.prepare("SELECT id, titel, fase, omschrijving FROM taken WHERE id IN (1, 22, 54)").all();
console.log(JSON.stringify(sample, null, 2));
