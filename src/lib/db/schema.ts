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
  isDemo: integer("is_demo").default(0),
  website: text("website"),
  branche: text("branche"),
  kvkNummer: text("kvk_nummer"),
  btwNummer: text("btw_nummer"),
  aantalMedewerkers: text("aantal_medewerkers"),
  diensten: text("diensten"), // JSON array
  techStack: text("tech_stack"), // JSON array
  klantSinds: text("klant_sinds"),
  aiVerrijktOp: text("ai_verrijkt_op"),
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
  categorie: text("categorie", { enum: ["development", "meeting", "administratie", "overig", "focus"] }).default("development"),
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
  googleEventId: text("google_event_id"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ EXTERNE KALENDERS ============
export const externeKalenders = sqliteTable("externe_kalenders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  naam: text("naam").notNull(),
  url: text("url").notNull(),
  bron: text("bron", { enum: ["google", "icloud", "outlook", "overig"] }).notNull(),
  kleur: text("kleur").default("#17B8A5"),
  isActief: integer("is_actief").default(1),
  laatstGesyncOp: text("laatst_gesynced_op"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ GOOGLE OAUTH TOKENS ============
export const googleTokens = sqliteTable("google_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id).notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: text("expires_at").notNull(),
  calendarId: text("calendar_id").default("primary"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ TAKEN ============
export const taken = sqliteTable("taken", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").references(() => projecten.id),
  toegewezenAan: integer("toegewezen_aan").references(() => gebruikers.id),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  titel: text("titel").notNull(),
  omschrijving: text("omschrijving"),
  fase: text("fase"),
  volgorde: integer("volgorde").default(0),
  status: text("status", { enum: ["open", "bezig", "afgerond"] }).default("open"),
  deadline: text("deadline"),
  prioriteit: text("prioriteit", { enum: ["laag", "normaal", "hoog"] }).default("normaal"),
  uitvoerder: text("uitvoerder", { enum: ["claude", "handmatig"] }).default("handmatig"),
  prompt: text("prompt"),
  projectMap: text("project_map"),
  googleEventId: text("google_event_id"),
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
  isRetour: integer("is_retour").default(0),
  zakelijkDoel: text("zakelijk_doel"),
  doelType: text("doel_type", { enum: ["klantbezoek", "meeting", "inkoop", "netwerk", "training", "boekhouder", "overig"] }),
  klantId: integer("klant_id").references(() => klanten.id),
  projectId: integer("project_id").references(() => projecten.id),
  opgeslagenRouteId: integer("opgeslagen_route_id"),
  tariefPerKm: real("tarief_per_km").default(0.23),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const opgeslagenRoutes = sqliteTable("opgeslagen_routes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  naam: text("naam").notNull(),
  vanLocatie: text("van_locatie").notNull(),
  naarLocatie: text("naar_locatie").notNull(),
  kilometers: real("kilometers").notNull(),
  klantId: integer("klant_id").references(() => klanten.id),
  projectId: integer("project_id").references(() => projecten.id),
  doelType: text("doel_type", { enum: ["klantbezoek", "meeting", "inkoop", "netwerk", "training", "boekhouder", "overig"] }),
  aantalKeerGebruikt: integer("aantal_keer_gebruikt").default(0),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const investeringen = sqliteTable("investeringen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  bedrag: real("bedrag").notNull(),
  datum: text("datum").notNull(),
  categorie: text("categorie", {
    enum: ["hardware", "software", "inventaris", "vervoer", "overig"],
  }).default("overig"),
  afschrijvingstermijn: integer("afschrijvingstermijn").default(5), // jaren
  restwaarde: real("restwaarde").default(0),
  notities: text("notities"),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const voorlopigeAanslagen = sqliteTable("voorlopige_aanslagen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jaar: integer("jaar").notNull(),
  type: text("type", { enum: ["inkomstenbelasting", "zvw"] }).default("inkomstenbelasting"),
  bedrag: real("bedrag").notNull(),
  betaaldBedrag: real("betaald_bedrag").default(0),
  status: text("status", { enum: ["openstaand", "betaald", "bezwaar"] }).default("openstaand"),
  vervaldatum: text("vervaldatum"),
  notities: text("notities"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const belastingReserveringen = sqliteTable("belasting_reserveringen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  maand: text("maand").notNull(), // YYYY-MM
  bedrag: real("bedrag").notNull(),
  type: text("type", { enum: ["btw", "inkomstenbelasting", "overig"] }).default("inkomstenbelasting"),
  notities: text("notities"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const belastingAuditLog = sqliteTable("belasting_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  actie: text("actie").notNull(),
  entiteitType: text("entiteit_type").notNull(), // btw_aangifte, deadline, investering, etc.
  entiteitId: integer("entiteit_id"),
  details: text("details"), // JSON
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
  type: text("type", { enum: ["per_uur", "fixed", "retainer"] }).default("per_uur"),
  korting: real("korting").default(0),
  kortingType: text("korting_type", { enum: ["percentage", "vast"] }).default("vast"),
  scope: text("scope"),
  deliverables: text("deliverables"),
  tijdlijn: text("tijdlijn"),
  voorwaarden: text("voorwaarden"),
  interneNotities: text("interne_notities"),
  acceptatieToken: text("acceptatie_token"),
  geaccepteerdOp: text("geaccepteerd_op"),
  herinneringVerstuurdOp: text("herinnering_verstuurd_op"),
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
  isOptioneel: integer("is_optioneel").default(0),
  sectie: text("sectie"),
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
  confidence: integer("confidence").default(70),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const okrCheckIns = sqliteTable("okr_check_ins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  objectiveId: integer("objective_id").references(() => okrObjectives.id, { onDelete: "cascade" }),
  voortgang: integer("voortgang").default(0),
  blocker: text("blocker"),
  volgendeStap: text("volgende_stap"),
  notities: text("notities"),
  week: integer("week").notNull(),
  jaar: integer("jaar").notNull(),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
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
  categorie: text("categorie", { enum: ["processen", "klanten", "technisch", "templates", "financien", "strategie", "geleerde-lessen", "tools", "ideeen", "educatie"] }).default("processen"),
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

// ============ BRIEFINGS ============

export const briefings = sqliteTable("briefings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  datum: text("datum").notNull(),
  samenvatting: text("samenvatting"),
  agendaItems: text("agenda_items").default("[]"),
  takenPrioriteit: text("taken_prioriteit").default("[]"),
  projectUpdates: text("project_updates").default("[]"),
  quickWins: text("quick_wins").default("[]"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
}, (table) => ({
  uniekGebruikerDatum: uniqueIndex("uniek_briefing_datum").on(table.gebruikerId, table.datum),
}));

// ============ MEETINGS ============

export const meetings = sqliteTable("meetings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  klantId: integer("klant_id").references(() => klanten.id),
  projectId: integer("project_id").references(() => projecten.id),
  titel: text("titel").notNull(),
  datum: text("datum").notNull(),
  duurMinuten: integer("duur_minuten"),
  audioPad: text("audio_pad"),
  transcript: text("transcript"),
  samenvatting: text("samenvatting"),
  actiepunten: text("actiepunten").default("[]"),
  besluiten: text("besluiten").default("[]"),
  openVragen: text("open_vragen").default("[]"),
  sentiment: text("sentiment"),
  tags: text("tags").default("[]"),
  status: text("status", { enum: ["verwerken", "klaar", "mislukt"] }).default("verwerken"),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ LEARNING RADAR ============

export const radarBronnen = sqliteTable("radar_bronnen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  url: text("url").notNull(),
  type: text("type", { enum: ["rss", "reddit", "twitter", "producthunt", "github", "api", "website", "newsletter"] }).default("rss"),
  actief: integer("actief").default(1),
  laatstGescand: text("laatst_gescand"),
  aantalItems: integer("aantal_items").default(0),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
}, (table) => ({
  uniekUrl: uniqueIndex("uniek_radar_bron_url").on(table.url),
}));

export const radarItems = sqliteTable("radar_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bronId: integer("bron_id").references(() => radarBronnen.id),
  titel: text("titel").notNull(),
  url: text("url").notNull(),
  beschrijving: text("beschrijving"),
  auteur: text("auteur"),
  gepubliceerdOp: text("gepubliceerd_op"),
  score: integer("score"),
  scoreRedenering: text("score_redenering"),
  aiSamenvatting: text("ai_samenvatting"),
  relevantie: text("relevantie"),
  leesMinuten: integer("lees_minuten"),
  categorie: text("categorie", { enum: ["ai_tools", "api_updates", "automation", "business", "competitors", "tutorials", "trends", "kansen", "must_reads"] }),
  bewaard: integer("bewaard").default(0),
  nietRelevant: integer("niet_relevant").default(0),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
}, (table) => ({
  uniekItemUrl: uniqueIndex("uniek_radar_item_url").on(table.url),
  idxScore: index("idx_radar_score").on(table.score),
}));

// ============ CONTENT ENGINE: KENNISBANK ============

export const contentProfiel = sqliteTable("content_profiel", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  onderwerp: text("onderwerp").notNull(), // "diensten", "tone_of_voice", "usps", "over_ons"
  inhoud: text("inhoud").notNull(),
  bijgewerktDoor: integer("bijgewerkt_door").references(() => gebruikers.id),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

export const contentInzichten = sqliteTable("content_inzichten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titel: text("titel").notNull(),
  inhoud: text("inhoud").notNull(),
  categorie: text("categorie", {
    enum: ["projectervaring", "learning", "tool_review", "trend", "tip"],
  }).notNull(),
  klantId: integer("klant_id").references(() => klanten.id),
  projectId: integer("project_id").references(() => projecten.id),
  isGebruikt: integer("is_gebruikt").default(0), // Bijhouden of AI dit al heeft gebruikt
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ CONTENT ENGINE: POSTS ============

export const contentPosts = sqliteTable("content_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titel: text("titel").notNull(),
  inhoud: text("inhoud").notNull(),
  platform: text("platform", {
    enum: ["linkedin", "instagram"],
  }).notNull(),
  format: text("format", {
    enum: ["post", "caption", "thought_leadership", "tip", "storytelling", "how_to", "vraag"],
  }).notNull(),
  status: text("status", {
    enum: ["concept", "goedgekeurd", "bewerkt", "afgewezen", "gepubliceerd"],
  }).default("concept"),
  batchId: text("batch_id"), // Groepeert posts per wekelijkse batch
  batchWeek: text("batch_week"), // "2026-W12" formaat
  inzichtId: integer("inzicht_id").references(() => contentInzichten.id),
  bewerkteInhoud: text("bewerkte_inhoud"), // Als gebruiker de tekst aanpast
  afwijsReden: text("afwijs_reden"),
  gegenereerdeHashtags: text("gegenereerde_hashtags"), // JSON array
  geplandOp: text("gepland_op"),
  gepubliceerdOp: text("gepubliceerd_op"),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ CONTENT ENGINE: VIDEO'S ============

export const contentVideos = sqliteTable("content_videos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").references(() => contentPosts.id),
  titel: text("titel"), // standalone video title (when not from post)
  templateId: text("template_id"), // which template was used (null = from post)
  script: text("script").notNull(), // JSON array of Scene objects
  status: text("status", {
    enum: ["script", "rendering", "klaar", "fout"],
  }).default("script"),
  videoPath: text("video_path"), // path to rendered MP4
  formaat: text("formaat", {
    enum: ["square", "reels", "feed", "youtube"],
  }).default("square"),
  duurSeconden: integer("duur_seconden"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ CONTENT ENGINE: BANNERS ============

export const contentBanners = sqliteTable("content_banners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").references(() => contentPosts.id),
  templateType: text("template_type", {
    enum: ["quote", "stat", "tip", "case_study", "capsule"],
  }).notNull(),
  templateVariant: integer("template_variant").default(0),
  formaat: text("formaat", {
    enum: ["instagram", "instagram_square", "linkedin", "instagram_story"],
  }).notNull(),
  data: text("data").notNull(), // JSON with template-specific fields
  imagePath: text("image_path"),
  status: text("status", {
    enum: ["concept", "klaar", "fout"],
  }).default("concept"),
  gridPositie: integer("grid_positie"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ GEWOONTES (HABITS) ============

export const gewoontes = sqliteTable("gewoontes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  naam: text("naam").notNull(),
  icoon: text("icoon").notNull().default("Target"), // Lucide icon name
  frequentie: text("frequentie", { enum: ["dagelijks", "weekelijks"] }).default("dagelijks"),
  streefwaarde: text("streefwaarde"), // e.g. "30 min", "1 persoon"
  doel: text("doel"), // What you want to achieve with this habit
  waarom: text("waarom"), // Why this habit matters to you
  verwachteTijd: text("verwachte_tijd"), // Expected time e.g. "15 min", "30 min"
  volgorde: integer("volgorde").default(0),
  isActief: integer("is_actief").default(1),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const gewoonteLogboek = sqliteTable("gewoonte_logboek", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gewoonteId: integer("gewoonte_id").references(() => gewoontes.id, { onDelete: "cascade" }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  datum: text("datum").notNull(), // YYYY-MM-DD
  voltooid: integer("voltooid").default(1),
  notitie: text("notitie"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
}, (table) => [
  index("idx_logboek_gewoonte_datum").on(table.gewoonteId, table.datum),
  index("idx_logboek_gebruiker_datum").on(table.gebruikerId, table.datum),
]);

// ============ IDEEEN ============

export const ideeen = sqliteTable("ideeen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nummer: integer("nummer"),
  naam: text("naam").notNull(),
  categorie: text("categorie", {
    enum: ["dashboard", "klant_verkoop", "intern", "dev_tools", "content_media", "geld_groei", "experimenteel", "website"],
  }),
  status: text("status", {
    enum: ["idee", "uitgewerkt", "actief", "gebouwd"],
  }).default("idee"),
  omschrijving: text("omschrijving"),
  uitwerking: text("uitwerking"),
  prioriteit: text("prioriteit", {
    enum: ["laag", "normaal", "hoog"],
  }).default("normaal"),
  projectId: integer("project_id").references(() => projecten.id),
  notionPageId: text("notion_page_id"),
  aiScore: integer("ai_score"),
  aiHaalbaarheid: integer("ai_haalbaarheid"),
  aiMarktpotentie: integer("ai_marktpotentie"),
  aiFitAutronis: integer("ai_fit_autronis"),
  doelgroep: text("doelgroep"),
  verdienmodel: text("verdienmodel"),
  isAiSuggestie: integer("is_ai_suggestie").default(0),
  gepromoveerd: integer("gepromoveerd").default(0),
  impact: integer("impact"),
  effort: integer("effort"),
  revenuePotential: integer("revenue_potential"),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ FOCUS SESSIES ============
export const focusSessies = sqliteTable("focus_sessies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  projectId: integer("project_id").references(() => projecten.id),
  taakId: integer("taak_id").references(() => taken.id),
  geplandeDuurMinuten: integer("geplande_duur_minuten").notNull(),
  werkelijkeDuurMinuten: integer("werkelijke_duur_minuten"),
  reflectie: text("reflectie"),
  tijdregistratieId: integer("tijdregistratie_id").notNull().references(() => tijdregistraties.id),
  status: text("status", { enum: ["actief", "voltooid", "afgebroken"] }).notNull().default("actief"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ── SECOND BRAIN ─────────────────────────────────────────
export const secondBrainItems = sqliteTable("second_brain_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id).notNull(),
  type: text("type", { enum: ["tekst", "url", "afbeelding", "pdf", "code"] }).notNull(),
  titel: text("titel"),
  inhoud: text("inhoud"),
  aiSamenvatting: text("ai_samenvatting"),
  aiTags: text("ai_tags"), // JSON array string
  bronUrl: text("bron_url"),
  bestandPad: text("bestand_pad"),
  taal: text("taal"),
  isFavoriet: integer("is_favoriet").default(0),
  isGearchiveerd: integer("is_gearchiveerd").default(0),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

// ============ CONCURRENTEN ============

export const concurrenten = sqliteTable("concurrenten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  websiteUrl: text("website_url").notNull(),
  linkedinUrl: text("linkedin_url"),
  instagramHandle: text("instagram_handle"),
  scanPaginas: text("scan_paginas").default('["diensten","over-ons","pricing","cases"]'),
  beschrijving: text("beschrijving"),
  diensten: text("diensten"), // JSON array
  techStack: text("tech_stack"), // JSON array
  prijzen: text("prijzen"),
  teamGrootte: text("team_grootte"),
  sterktes: text("sterktes"), // JSON array
  zwaktes: text("zwaktes"), // JSON array
  overlapScore: integer("overlap_score"),
  overlapUitleg: text("overlap_uitleg"),
  threatLevel: text("threat_level", { enum: ["laag", "medium", "hoog"] }),
  threatUitleg: text("threat_uitleg"),
  notities: text("notities"),
  isActief: integer("is_actief").default(1),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

export const concurrentSnapshots = sqliteTable("concurrent_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  concurrentId: integer("concurrent_id").references(() => concurrenten.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  contentHash: text("content_hash").notNull(),
  extractedText: text("extracted_text").notNull(),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
}, (table) => [
  index("idx_snapshots_concurrent_url").on(table.concurrentId, table.url),
]);

export const concurrentScans = sqliteTable("concurrent_scans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  concurrentId: integer("concurrent_id").references(() => concurrenten.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["bezig", "voltooid", "mislukt"] }).default("bezig"),
  scanDatum: text("scan_datum").notNull(),
  websiteChanges: text("website_changes"),
  vacatures: text("vacatures"),
  socialActivity: text("social_activity"),
  aiSamenvatting: text("ai_samenvatting"),
  aiHighlights: text("ai_highlights"),
  trendIndicator: text("trend_indicator", { enum: ["groeiend", "stabiel", "krimpend"] }),
  kansen: text("kansen"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
}, (table) => [
  index("idx_scans_concurrent").on(table.concurrentId),
]);

// ============ SALES ENGINE ============
export const salesEngineScans = sqliteTable("sales_engine_scans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").references(() => leads.id),
  websiteUrl: text("website_url").notNull(),
  bedrijfsgrootte: text("bedrijfsgrootte"),
  rol: text("rol"),
  grootsteKnelpunt: text("grootste_knelpunt"),
  huidigeTools: text("huidige_tools"),
  opmerkingen: text("opmerkingen"),
  scrapeResultaat: text("scrape_resultaat"),
  aiAnalyse: text("ai_analyse"),
  samenvatting: text("samenvatting"),
  status: text("status", { enum: ["pending", "completed", "failed"] }).notNull().default("pending"),
  foutmelding: text("foutmelding"),
  automationReadinessScore: integer("automation_readiness_score"),
  aanbevolenPakket: text("aanbevolen_pakket"),
  batchId: text("batch_id"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

export const salesEngineKansen = sqliteTable("sales_engine_kansen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scanId: integer("scan_id").references(() => salesEngineScans.id, { onDelete: "cascade" }),
  titel: text("titel").notNull(),
  beschrijving: text("beschrijving").notNull(),
  categorie: text("categorie", { enum: ["lead_gen", "communicatie", "administratie", "data", "content", "workflow", "crm", "e-commerce", "marketing", "klantenservice", "facturatie", "planning"] }).notNull(),
  impact: text("impact", { enum: ["hoog", "midden", "laag"] }).notNull(),
  geschatteTijdsbesparing: text("geschatte_tijdsbesparing"),
  geschatteKosten: text("geschatte_kosten"),
  geschatteBesparing: text("geschatte_besparing"),
  implementatieEffort: text("implementatie_effort"),
  prioriteit: integer("prioriteit").notNull(),
});

// ============ OUTREACH ============
export const outreachDomeinen = sqliteTable("outreach_domeinen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domein: text("domein").notNull(),
  emailAdres: text("email_adres").notNull(),
  displayNaam: text("display_naam").notNull(),
  sesConfigured: integer("ses_configured").default(0),
  dagLimiet: integer("dag_limiet").default(50),
  vandaagVerstuurd: integer("vandaag_verstuurd").default(0),
  laatsteResetDatum: text("laatste_reset_datum"),
  isActief: integer("is_actief").default(1),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

export const outreachSequenties = sqliteTable("outreach_sequenties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").references(() => leads.id),
  scanId: integer("scan_id").references(() => salesEngineScans.id),
  domeinId: integer("domein_id").references(() => outreachDomeinen.id),
  status: text("status", { enum: ["draft", "actief", "gepauzeerd", "voltooid", "gestopt"] }).notNull().default("draft"),
  abVariant: text("ab_variant", { enum: ["a", "b"] }).default("a"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

export const outreachEmails = sqliteTable("outreach_emails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sequentieId: integer("sequentie_id").notNull().references(() => outreachSequenties.id, { onDelete: "cascade" }),
  stapNummer: integer("stap_nummer").notNull(),
  onderwerp: text("onderwerp").notNull(),
  inhoud: text("inhoud").notNull(),
  geplandOp: text("gepland_op"),
  verstuurdOp: text("verstuurd_op"),
  geopendOp: text("geopend_op"),
  gekliktOp: text("geklikt_op"),
  beantwoordOp: text("beantwoord_op"),
  bouncedOp: text("bounced_op"),
  status: text("status", { enum: ["gepland", "verstuurd", "geopend", "geklikt", "beantwoord", "bounced", "geannuleerd"] }).notNull().default("gepland"),
  trackingId: text("tracking_id").notNull(),
  sesMessageId: text("ses_message_id"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});

// ============ CONTRACTEN ============
export const contracten = sqliteTable("contracten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  klantId: integer("klant_id").references(() => klanten.id),
  titel: text("titel").notNull(),
  type: text("type", { enum: ["samenwerkingsovereenkomst", "sla", "nda"] }).notNull(),
  inhoud: text("inhoud").default(""),
  status: text("status", { enum: ["concept", "verzonden", "ondertekend", "verlopen"] }).default("concept"),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});

export const outreachOptOuts = sqliteTable("outreach_opt_outs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});
