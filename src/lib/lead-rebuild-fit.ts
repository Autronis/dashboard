// Classifies a lead's sector into "goede fit" vs "minder fit" for a scroll-stop
// product animation. Scroll-stop shines on PHYSICAL PRODUCTS (gadgets, tools,
// hardware, food, etc.) because the exploded/animated hero needs a tangible
// object. Services, SaaS, agencies, and consultancies get a "static upgrade"
// verdict — still build a dark premium site, but skip the scroll-stop video.
//
// Input is `category` from Google Maps leads (Dutch strings like "Bouwbedrijf",
// "Webshop", "Restaurant", "Installatiebedrijf", ...).

export type FitVerdict = "scroll_stop_good" | "static_upgrade" | "unknown";

export type FitResult = {
  verdict: FitVerdict;
  label: string;       // Nederlandse uitleg voor in UI
  reason: string;      // korte rationale
};

// Keywords die suggereren dat het bedrijf een fysiek product heeft dat exploded
// kan worden geanimeerd. Elk keyword matcht substring, case-insensitive.
const PRODUCT_KEYWORDS = [
  // retail / product
  "winkel", "winkels", "store", "webshop", "webwinkel", "boutique", "showroom",
  // physical goods / maker
  "fabrikant", "producent", "manufactuur", "atelier", "werkplaats",
  "uitgeverij", "meubelmaker", "juwelier", "goudsmid", "zilversmid",
  // hardware / tools / gear
  "gereedschap", "hardware", "machine", "apparatuur", "instrument",
  "electronica", "elektronica", "audio", "computer", "fietsen", "rijwiel",
  "motor", "auto", "voertuig", "bootbouwer", "caravans",
  // food & drink (tangible product)
  "bakker", "slager", "brouwerij", "distilleerderij", "wijnhandel",
  "chocolaterie", "ijssalon", "koffiebrander", "koffiebranderij",
  // fashion / apparel
  "mode", "kleding", "schoenen", "sieraden", "accessoires", "leder", "hoeden",
  // sport / outdoor gear
  "sportzaak", "fietsen", "ski", "surf", "outdoor",
  // home / decor
  "meubels", "meubelen", "interieurzaak", "decoratie", "kunst", "keramiek",
];

// Keywords die een "dienst" aanduiden — scroll-stop past meestal niet.
const SERVICE_KEYWORDS = [
  // general services
  "dienstverlening", "consultancy", "consultant", "advisory", "adviesbureau",
  "makelaar", "notaris", "advocaat", "juridisch", "boekhouder", "accountant",
  "financieel", "verzekering", "uitzendbureau", "wervings",
  // building / contractor — they usually sell service, not a product to explode
  "bouwbedrijf", "aannemer", "installatiebedrijf", "installateur",
  "loodgieter", "elektricien", "timmerman", "schilder", "tegelzetter",
  "hovenier", "tuinaanleg", "glaszetter", "dakdekker",
  // cleaning / maintenance
  "schoonmaak", "schoonmaakbedrijf", "onderhoud",
  // healthcare
  "fysio", "tandarts", "huisarts", "psycholoog", "coach", "kliniek", "praktijk",
  // hospitality / food service (no packaged product)
  "restaurant", "café", "bar", "hotel", "bed and breakfast", "b&b",
  // agency / creative / marketing (meta: they SELL websites, we compete)
  "marketingbureau", "reclamebureau", "communicatie", "design studio",
  "agency", "creatief", "fotograaf", "videograaf",
  // education / training
  "school", "opleiding", "training", "les", "cursus", "docent",
  // automotive services
  "garage", "autobedrijf", "apk",
  // English equivalents (LinkedIn leads zijn vaak Engelstalig)
  "recruitment", "staffing", "consulting", "agency", "law firm", "lawyer",
  "accounting", "accountant", "real estate", "realtor", "insurance",
  "marketing", "advertising", "construction", "contractor", "plumbing",
  "electrician", "cleaning", "repair", "service", "services",
  "clinic", "dental", "medical", "therapy", "fitness studio",
  "cafe", "bistro", "pub", "lodging", "guesthouse",
  "studio", "photography", "videography",
];

export function classifyFit(category: string | null | undefined, name?: string | null): FitResult {
  const cat = category?.trim() || "";
  const nm = name?.trim() || "";

  if (!cat && !nm) {
    return {
      verdict: "unknown",
      label: "Onbekend",
      reason: "Geen categorie of naam bekend — handmatig inschatten",
    };
  }

  const haystack = `${cat.toLowerCase()} ${nm.toLowerCase()}`;
  const signal = cat || `bedrijfsnaam "${nm}"`;

  const productHit = PRODUCT_KEYWORDS.find((k) => haystack.includes(k));
  if (productHit) {
    return {
      verdict: "scroll_stop_good",
      label: "Scroll-stop geschikt",
      reason: `${signal} matcht "${productHit}" — fysiek product, scroll-stop animatie past`,
    };
  }

  const serviceHit = SERVICE_KEYWORDS.find((k) => haystack.includes(k));
  if (serviceHit) {
    return {
      verdict: "static_upgrade",
      label: "Statische upgrade",
      reason: `${signal} matcht "${serviceHit}" — dienstverlening, beter een dark premium statische site`,
    };
  }

  return {
    verdict: "unknown",
    label: "Onbekend",
    reason: `${signal} niet herkend — handmatig inschatten`,
  };
}
