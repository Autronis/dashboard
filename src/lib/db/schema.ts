import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ============ GEBRUIKERS ============
export const gebruikers = sqliteTable("gebruikers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  email: text("email").notNull().unique(),
  wachtwoordHash: text("wachtwoord_hash").notNull(),
  rol: text("rol", { enum: ["admin", "gebruiker"] }).default("gebruiker"),
  uurtariefStandaard: real("uurtarief_standaard"),
  themaVoorkeur: text("thema_voorkeur", { enum: ["donker", "licht"] }).default("donker"),
  tweeFactorGeheim: text("twee_factor_geheim"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ KLANTEN ============
export const klanten = sqliteTable("klanten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bedrijfsnaam: text("bedrijfsnaam").notNull(),
  contactpersoon: text("contactpersoon"),
  email: text("email"),
  telefoon: text("telefoon"),
  adres: text("adres"),
  uurtarief: real("uurtarief"),
  notities: text("notities"),
  isActief: integer("is_actief").default(1),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ PROJECTEN ============
export const projecten = sqliteTable("projecten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  klantId: integer("klant_id").references(() => klanten.id),
  naam: text("naam").notNull(),
  omschrijving: text("omschrijving"),
  status: text("status", { enum: ["actief", "afgerond", "on-hold"] }).default("actief"),
  voortgangPercentage: integer("voortgang_percentage").default(0),
  deadline: text("deadline"),
  geschatteUren: real("geschatte_uren"),
  werkelijkeUren: real("werkelijke_uren").default(0),
  isActief: integer("is_actief").default(1),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ TIJDREGISTRATIES ============
export const tijdregistraties = sqliteTable("tijdregistraties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  projectId: integer("project_id").references(() => projecten.id),
  omschrijving: text("omschrijving"),
  startTijd: text("start_tijd").notNull(),
  eindTijd: text("eind_tijd"),
  duurMinuten: integer("duur_minuten"),
  categorie: text("categorie", { enum: ["development", "meeting", "administratie", "overig"] }).default("development"),
  isHandmatig: integer("is_handmatig").default(0),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ FACTUREN ============
export const facturen = sqliteTable("facturen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  klantId: integer("klant_id").references(() => klanten.id),
  projectId: integer("project_id").references(() => projecten.id),
  factuurnummer: text("factuurnummer").notNull().unique(),
  status: text("status", { enum: ["concept", "verzonden", "betaald", "te_laat"] }).default("concept"),
  bedragExclBtw: real("bedrag_excl_btw").notNull(),
  btwPercentage: real("btw_percentage").default(21),
  btwBedrag: real("btw_bedrag"),
  bedragInclBtw: real("bedrag_incl_btw"),
  factuurdatum: text("factuurdatum"),
  vervaldatum: text("vervaldatum"),
  betaaldOp: text("betaald_op"),
  isTerugkerend: integer("is_terugkerend").default(0),
  terugkeerInterval: text("terugkeer_interval", { enum: ["wekelijks", "maandelijks"] }),
  notities: text("notities"),
  isActief: integer("is_actief").default(1),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ FACTUUR REGELS ============
export const factuurRegels = sqliteTable("factuur_regels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  factuurId: integer("factuur_id").references(() => facturen.id, { onDelete: "cascade" }),
  omschrijving: text("omschrijving").notNull(),
  aantal: real("aantal").notNull(),
  eenheidsprijs: real("eenheidsprijs").notNull(),
  btwPercentage: real("btw_percentage").default(21),
  totaal: real("totaal"),
});

// ============ INKOMSTEN ============
export const inkomsten = sqliteTable("inkomsten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  factuurId: integer("factuur_id").references(() => facturen.id),
  klantId: integer("klant_id").references(() => klanten.id),
  omschrijving: text("omschrijving").notNull(),
  bedrag: real("bedrag").notNull(),
  datum: text("datum").notNull(),
  categorie: text("categorie"),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ UITGAVEN ============
export const uitgaven = sqliteTable("uitgaven", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  omschrijving: text("omschrijving").notNull(),
  bedrag: real("bedrag").notNull(),
  datum: text("datum").notNull(),
  categorie: text("categorie", { enum: ["kantoor", "hardware", "software", "reiskosten", "marketing", "onderwijs", "telefoon", "verzekeringen", "accountant", "overig"] }).default("overig"),
  leverancier: text("leverancier"),
  btwBedrag: real("btw_bedrag"),
  btwPercentage: real("btw_percentage").default(21),
  fiscaalAftrekbaar: integer("fiscaal_aftrekbaar").default(1),
  bonnetjeUrl: text("bonnetje_url"),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ DOELEN ============
export const doelen = sqliteTable("doelen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  type: text("type", { enum: ["omzet", "uren"] }).notNull(),
  maand: integer("maand").notNull(),
  jaar: integer("jaar").notNull(),
  doelwaarde: real("doelwaarde").notNull(),
  huidigeWaarde: real("huidige_waarde").default(0),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
}, (table) => ({
  uniekDoel: uniqueIndex("uniek_doel").on(table.gebruikerId, table.type, table.maand, table.jaar),
}));

// ============ LEADS ============
export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bedrijfsnaam: text("bedrijfsnaam").notNull(),
  contactpersoon: text("contactpersoon"),
  email: text("email"),
  telefoon: text("telefoon"),
  waarde: real("waarde"),
  status: text("status", { enum: ["nieuw", "contact", "offerte", "gewonnen", "verloren"] }).default("nieuw"),
  bron: text("bron"),
  notities: text("notities"),
  volgendeActie: text("volgende_actie"),
  volgendeActieDatum: text("volgende_actie_datum"),
  isActief: integer("is_actief").default(1),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ NOTIFICATIES ============
export const notificaties = sqliteTable("notificaties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").notNull().references(() => gebruikers.id),
  type: text("type", { enum: ["factuur_te_laat", "deadline_nadert", "factuur_betaald", "taak_toegewezen", "belasting_deadline", "verlof_aangevraagd", "verlof_goedgekeurd", "client_bericht", "proposal_ondertekend", "offerte_geaccepteerd"] }).notNull(),
  titel: text("titel").notNull(),
  omschrijving: text("omschrijving"),
  link: text("link"),
  gelezen: integer("gelezen").notNull().default(0),
  aangemaaktOp: text("aangemaakt_op").notNull().default(sql`(datetime('now'))`),
});

// ============ LEAD ACTIVITEITEN ============
export const leadActiviteiten = sqliteTable("lead_activiteiten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  gebruikerId: integer("gebruiker_id").notNull().references(() => gebruikers.id),
  type: text("type", { enum: ["email_verstuurd", "status_gewijzigd", "notitie_toegevoegd", "gebeld", "vergadering"] }).notNull(),
  titel: text("titel").notNull(),
  omschrijving: text("omschrijving"),
  aangemaaktOp: text("aangemaakt_op").notNull().default(sql`(datetime('now'))`),
});

// ============ AGENDA ITEMS ============
export const agendaItems = sqliteTable("agenda_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  titel: text("titel").notNull(),
  omschrijving: text("omschrijving"),
  type: text("type", { enum: ["afspraak", "deadline", "belasting", "herinnering"] }).default("afspraak"),
  startDatum: text("start_datum").notNull(),
  eindDatum: text("eind_datum"),
  heleDag: integer("hele_dag").default(0),
  herinneringMinuten: integer("herinnering_minuten"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ TAKEN ============
export const taken = sqliteTable("taken", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").references(() => projecten.id),
  toegewezenAan: integer("toegewezen_aan").references(() => gebruikers.id),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  titel: text("titel").notNull(),
  omschrijving: text("omschrijving"),
  status: text("status", { enum: ["open", "bezig", "afgerond"] }).default("open"),
  deadline: text("deadline"),
  prioriteit: text("prioriteit", { enum: ["laag", "normaal", "hoog"] }).default("normaal"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ NOTITIES ============
export const notities = sqliteTable("notities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  klantId: integer("klant_id").references(() => klanten.id),
  projectId: integer("project_id").references(() => projecten.id),
  leadId: integer("lead_id").references(() => leads.id),
  inhoud: text("inhoud").notNull(),
  type: text("type", { enum: ["notitie", "belangrijk", "afspraak"] }).default("notitie"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ DOCUMENTEN ============
export const documenten = sqliteTable("documenten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  klantId: integer("klant_id").references(() => klanten.id),
  projectId: integer("project_id").references(() => projecten.id),
  leadId: integer("lead_id").references(() => leads.id),
  naam: text("naam").notNull(),
  bestandspad: text("bestandspad").default(""),
  url: text("url"),
  type: text("type", { enum: ["contract", "offerte", "link", "overig"] }).default("overig"),
  versie: integer("versie").default(1),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ AUDIT LOG ============
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  actie: text("actie", { enum: ["aangemaakt", "bijgewerkt", "verwijderd", "ingelogd", "uitgelogd", "wachtwoord_gewijzigd", "2fa_ingeschakeld", "2fa_uitgeschakeld", "verzonden", "betaald", "geaccepteerd"] }).notNull(),
  entiteitType: text("entiteit_type").notNull(),
  entiteitId: integer("entiteit_id"),
  oudeWaarde: text("oude_waarde"),
  nieuweWaarde: text("nieuwe_waarde"),
  ipAdres: text("ip_adres"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ BEDRIJFSINSTELLINGEN ============
export const bedrijfsinstellingen = sqliteTable("bedrijfsinstellingen", {
  id: integer("id").primaryKey(),
  bedrijfsnaam: text("bedrijfsnaam").default("Autronis"),
  adres: text("adres"),
  kvkNummer: text("kvk_nummer"),
  btwNummer: text("btw_nummer"),
  iban: text("iban"),
  email: text("email"),
  telefoon: text("telefoon"),
  logoPad: text("logo_pad"),
  standaardBtw: real("standaard_btw").default(21),
  betalingstermijnDagen: integer("betalingstermijn_dagen").default(30),
  herinneringNaDagen: integer("herinnering_na_dagen").default(7),
});

// ============ MODULE 1: BELASTING & COMPLIANCE ============

export const belastingDeadlines = sqliteTable("belasting_deadlines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["btw", "inkomstenbelasting", "icp", "kvk_publicatie"] }).notNull(),
  omschrijving: text("omschrijving").notNull(),
  datum: text("datum").notNull(),
  kwartaal: integer("kwartaal"),
  jaar: integer("jaar").notNull(),
  herinneringDagen: text("herinnering_dagen").default("[30,14,3]"), // JSON array
  afgerond: integer("afgerond").default(0),
  notities: text("notities"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const btwAangiftes = sqliteTable("btw_aangiftes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kwartaal: integer("kwartaal").notNull(),
  jaar: integer("jaar").notNull(),
  btwOntvangen: real("btw_ontvangen").default(0),
  btwBetaald: real("btw_betaald").default(0),
  btwAfdragen: real("btw_afdragen").default(0),
  status: text("status", { enum: ["open", "ingediend", "betaald"] }).default("open"),
  ingediendOp: text("ingediend_op"),
  notities: text("notities"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const urenCriterium = sqliteTable("uren_criterium", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  jaar: integer("jaar").notNull(),
  doelUren: integer("doel_uren").default(1225),
  behaaldUren: real("behaald_uren").default(0),
  zelfstandigenaftrek: integer("zelfstandigenaftrek").default(0),
  mkbVrijstelling: integer("mkb_vrijstelling").default(0),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const kilometerRegistraties = sqliteTable("kilometer_registraties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  datum: text("datum").notNull(),
  vanLocatie: text("van_locatie").notNull(),
  naarLocatie: text("naar_locatie").notNull(),
  kilometers: real("kilometers").notNull(),
  zakelijkDoel: text("zakelijk_doel"),
  klantId: integer("klant_id").references(() => klanten.id),
  projectId: integer("project_id").references(() => projecten.id),
  tariefPerKm: real("tarief_per_km").default(0.23),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ MODULE 2: GEAVANCEERDE BOEKHOUDING ============

export const bankTransacties = sqliteTable("bank_transacties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  datum: text("datum").notNull(),
  omschrijving: text("omschrijving").notNull(),
  bedrag: real("bedrag").notNull(),
  type: text("type", { enum: ["bij", "af"] }).notNull(),
  categorie: text("categorie"),
  gekoppeldFactuurId: integer("gekoppeld_factuur_id").references(() => facturen.id),
  status: text("status", { enum: ["onbekend", "gecategoriseerd", "gematcht"] }).default("onbekend"),
  bank: text("bank"),
  tegenrekening: text("tegenrekening"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const offertes = sqliteTable("offertes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  klantId: integer("klant_id").references(() => klanten.id),
  projectId: integer("project_id").references(() => projecten.id),
  offertenummer: text("offertenummer").notNull().unique(),
  titel: text("titel"),
  status: text("status", { enum: ["concept", "verzonden", "geaccepteerd", "verlopen", "afgewezen"] }).default("concept"),
  datum: text("datum"),
  geldigTot: text("geldig_tot"),
  bedragExclBtw: real("bedrag_excl_btw").default(0),
  btwPercentage: real("btw_percentage").default(21),
  btwBedrag: real("btw_bedrag").default(0),
  bedragInclBtw: real("bedrag_incl_btw").default(0),
  notities: text("notities"),
  isActief: integer("is_actief").default(1),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

export const offerteRegels = sqliteTable("offerte_regels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  offerteId: integer("offerte_id").references(() => offertes.id, { onDelete: "cascade" }),
  omschrijving: text("omschrijving").notNull(),
  aantal: real("aantal").notNull(),
  eenheidsprijs: real("eenheidsprijs").notNull(),
  btwPercentage: real("btw_percentage").default(21),
  totaal: real("totaal"),
});

// ============ MODULE 3: HR & TEAM MANAGEMENT ============

export const verlof = sqliteTable("verlof", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  startDatum: text("start_datum").notNull(),
  eindDatum: text("eind_datum").notNull(),
  type: text("type", { enum: ["vakantie", "ziek", "bijzonder"] }).default("vakantie"),
  status: text("status", { enum: ["aangevraagd", "goedgekeurd", "afgewezen"] }).default("aangevraagd"),
  notities: text("notities"),
  beoordeeldDoor: integer("beoordeeld_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const feestdagen = sqliteTable("feestdagen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  datum: text("datum").notNull(),
  jaar: integer("jaar").notNull(),
});

export const onkostenDeclaraties = sqliteTable("onkosten_declaraties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  datum: text("datum").notNull(),
  omschrijving: text("omschrijving").notNull(),
  bedrag: real("bedrag").notNull(),
  categorie: text("categorie", { enum: ["kantoor", "hardware", "reiskosten", "marketing", "onderwijs", "telefoon", "verzekeringen", "overig"] }).default("overig"),
  bonnetjeUrl: text("bonnetje_url"),
  status: text("status", { enum: ["ingediend", "goedgekeurd", "uitbetaald", "afgewezen"] }).default("ingediend"),
  beoordeeldDoor: integer("beoordeeld_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const beschikbaarheid = sqliteTable("beschikbaarheid", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  week: integer("week").notNull(),
  jaar: integer("jaar").notNull(),
  beschikbareUren: real("beschikbare_uren").default(40),
});

// ============ MODULE 4: BUSINESS INTELLIGENCE ============

export const okrObjectives = sqliteTable("okr_objectives", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titel: text("titel").notNull(),
  omschrijving: text("omschrijving"),
  eigenaarId: integer("eigenaar_id").references(() => gebruikers.id),
  kwartaal: integer("kwartaal").notNull(),
  jaar: integer("jaar").notNull(),
  status: text("status", { enum: ["actief", "afgerond", "geannuleerd"] }).default("actief"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const okrKeyResults = sqliteTable("okr_key_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  objectiveId: integer("objective_id").references(() => okrObjectives.id, { onDelete: "cascade" }),
  titel: text("titel").notNull(),
  doelwaarde: real("doelwaarde").notNull(),
  huidigeWaarde: real("huidige_waarde").default(0),
  eenheid: text("eenheid"),
  autoKoppeling: text("auto_koppeling", { enum: ["omzet", "uren", "taken", "klanten", "geen"] }).default("geen"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ MODULE 5: AI ASSISTENT ============

export const aiGesprekken = sqliteTable("ai_gesprekken", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  titel: text("titel").default("Nieuw gesprek"),
  berichten: text("berichten").default("[]"), // JSON array
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ MODULE 6: SALES & PROPOSALS ============

export const proposals = sqliteTable("proposals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  klantId: integer("klant_id").references(() => klanten.id),
  titel: text("titel").notNull(),
  status: text("status", { enum: ["concept", "verzonden", "bekeken", "ondertekend", "afgewezen"] }).default("concept"),
  secties: text("secties").default("[]"), // JSON array
  totaalBedrag: real("totaal_bedrag").default(0),
  geldigTot: text("geldig_tot"),
  token: text("token").unique(),
  ondertekendOp: text("ondertekend_op"),
  ondertekendDoor: text("ondertekend_door"),
  ondertekening: text("ondertekening"), // JSON: { type, data, naam }
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

export const proposalRegels = sqliteTable("proposal_regels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  proposalId: integer("proposal_id").references(() => proposals.id, { onDelete: "cascade" }),
  omschrijving: text("omschrijving").notNull(),
  aantal: real("aantal").notNull(),
  eenheidsprijs: real("eenheidsprijs").notNull(),
  totaal: real("totaal"),
});

export const klanttevredenheid = sqliteTable("klanttevredenheid", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  klantId: integer("klant_id").references(() => klanten.id),
  projectId: integer("project_id").references(() => projecten.id),
  score: integer("score").notNull(), // 1-5
  opmerking: text("opmerking"),
  token: text("token").unique(),
  ingevuldOp: text("ingevuld_op"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ MODULE 7: KENNISBANK & PROCESSEN ============

export const wikiArtikelen = sqliteTable("wiki_artikelen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titel: text("titel").notNull(),
  inhoud: text("inhoud").default(""),
  categorie: text("categorie", { enum: ["processen", "klanten", "technisch", "templates", "financien"] }).default("processen"),
  tags: text("tags").default("[]"), // JSON array
  auteurId: integer("auteur_id").references(() => gebruikers.id),
  gepubliceerd: integer("gepubliceerd").default(1),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

export const projectTemplates = sqliteTable("project_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  beschrijving: text("beschrijving"),
  categorie: text("categorie"),
  taken: text("taken").default("[]"), // JSON array
  geschatteUren: real("geschatte_uren"),
  uurtarief: real("uurtarief"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const sops = sqliteTable("sops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titel: text("titel").notNull(),
  beschrijving: text("beschrijving"),
  stappen: text("stappen").default("[]"), // JSON array
  gekoppeldAan: text("gekoppeld_aan", { enum: ["onboarding", "offboarding", "project"] }),
  actief: integer("actief").default(1),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ MODULE 8: CLIENT PORTAL ============

export const clientPortalTokens = sqliteTable("client_portal_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  klantId: integer("klant_id").references(() => klanten.id),
  token: text("token").notNull().unique(),
  actief: integer("actief").default(1),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  laatstIngelogdOp: text("laatst_ingelogd_op"),
});

export const clientBerichten = sqliteTable("client_berichten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  klantId: integer("klant_id").references(() => klanten.id),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  bericht: text("bericht").notNull(),
  vanKlant: integer("van_klant").default(0),
  gelezen: integer("gelezen").default(0),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ MODULE 9: VEILIGHEID & COMPLIANCE ============

export const sessies = sqliteTable("sessies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  sessionToken: text("session_token").notNull(),
  apparaat: text("apparaat"),
  browser: text("browser"),
  ipAdres: text("ip_adres"),
  laatsteActiviteit: text("laatste_activiteit").default(sql`(datetime('now'))`),
  vertrouwdTot: text("vertrouwd_tot"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const backupCodes = sqliteTable("backup_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  code: text("code").notNull(),
  gebruikt: integer("gebruikt").default(0),
});

export const verwerkingsregister = sqliteTable("verwerkingsregister", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  verwerkingsdoel: text("verwerkingsdoel").notNull(),
  categorieGegevens: text("categorie_gegevens").notNull(),
  bewaartermijn: text("bewaartermijn"),
  rechtsgrond: text("rechtsgrond"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ MODULE 10: INTEGRATIES ============

export const webhookEndpoints = sqliteTable("webhook_endpoints", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  events: text("events").default("[]"), // JSON array
  secret: text("secret").notNull(),
  actief: integer("actief").default(1),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const webhookLogs = sqliteTable("webhook_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  endpointId: integer("endpoint_id").references(() => webhookEndpoints.id),
  event: text("event").notNull(),
  payload: text("payload"),
  statusCode: integer("status_code"),
  response: text("response"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  permissions: text("permissions").default("[]"), // JSON array
  laatstGebruiktOp: text("laatst_gebruikt_op"),
  isActief: integer("is_actief").default(1),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const mollieInstellingen = sqliteTable("mollie_instellingen", {
  id: integer("id").primaryKey(),
  apiKey: text("api_key"),
  actief: integer("actief").default(0),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ SCREEN TIME TRACKING ============

export const screenTimeEntries = sqliteTable("screen_time_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: text("client_id"),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  app: text("app").notNull(),
  vensterTitel: text("venster_titel"),
  url: text("url"),
  categorie: text("categorie", {
    enum: ["development", "communicatie", "design", "administratie", "afleiding", "overig", "inactief"],
  }).default("overig"),
  projectId: integer("project_id").references(() => projecten.id),
  klantId: integer("klant_id").references(() => klanten.id),
  startTijd: text("start_tijd").notNull(),
  eindTijd: text("eind_tijd").notNull(),
  duurSeconden: integer("duur_seconden").notNull(),
  bron: text("bron", { enum: ["agent", "handmatig"] }).default("agent"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
}, (table) => ({
  uniekClientId: uniqueIndex("uniek_client_id").on(table.clientId),
  idxGebruikerStart: index("idx_st_gebruiker_start").on(table.gebruikerId, table.startTijd),
  idxGebruikerCatStart: index("idx_st_gebruiker_cat_start").on(table.gebruikerId, table.categorie, table.startTijd),
}));

export const screenTimeRegels = sqliteTable("screen_time_regels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["app", "url", "venstertitel"] }).notNull(),
  patroon: text("patroon").notNull(),
  categorie: text("categorie", {
    enum: ["development", "communicatie", "design", "administratie", "afleiding", "overig", "inactief"],
  }).notNull(),
  projectId: integer("project_id").references(() => projecten.id),
  klantId: integer("klant_id").references(() => klanten.id),
  prioriteit: integer("prioriteit").default(0),
  isActief: integer("is_actief").default(1),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const screenTimeSuggesties = sqliteTable("screen_time_suggesties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  type: text("type", { enum: ["categorie", "tijdregistratie", "project_koppeling"] }).notNull(),
  startTijd: text("start_tijd").notNull(),
  eindTijd: text("eind_tijd").notNull(),
  voorstel: text("voorstel").notNull(),
  status: text("status", { enum: ["openstaand", "goedgekeurd", "afgewezen"] }).default("openstaand"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  verwerktOp: text("verwerkt_op"),
});

export const screenTimeSamenvattingen = sqliteTable("screen_time_samenvattingen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  datum: text("datum").notNull(),
  samenvattingKort: text("samenvatting_kort"),
  samenvattingDetail: text("samenvatting_detail"),
  totaalSeconden: integer("totaal_seconden"),
  productiefPercentage: integer("productief_percentage"),
  topProject: text("top_project"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
}, (table) => ({
  uniekGebruikerDatum: uniqueIndex("uniek_gebruiker_datum").on(table.gebruikerId, table.datum),
}));
