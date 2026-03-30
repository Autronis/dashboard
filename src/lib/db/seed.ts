import { db } from "./index";
import {
  gebruikers,
  klanten,
  projecten,
  taken,
  tijdregistraties,
  facturen,
  factuurRegels,
  inkomsten,
  uitgaven,
  abonnementen,
  doelen,
  leads,
  leadActiviteiten,
  notificaties,
  agendaItems,
  offertes,
  offerteRegels,
  meetings,
  wikiArtikelen,
  ideeen,
  belastingDeadlines,
  btwAangiftes,
  urenCriterium,
  kilometerRegistraties,
  investeringen,
  bankTransacties,
  secondBrainItems,
  documenten,
  teamActiviteit,
  belastingTips,
  bedrijfsinstellingen,
} from "./schema";
import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";

export async function seed() {
  console.log("Seeding database with comprehensive demo data...");

  // ──────────────────────────────────────────────
  // 0. Clear all existing data (reverse FK order)
  // ──────────────────────────────────────────────
  const tablesToClear = [
    teamActiviteit,
    belastingTips,
    secondBrainItems,
    documenten,
    notificaties,
    leadActiviteiten,
    agendaItems,
    kilometerRegistraties,
    urenCriterium,
    btwAangiftes,
    belastingDeadlines,
    investeringen,
    bankTransacties,
    doelen,
    offerteRegels,
    offertes,
    meetings,
    wikiArtikelen,
    ideeen,
    factuurRegels,
    inkomsten,
    uitgaven,
    abonnementen,
    tijdregistraties,
    taken,
    projecten,
    leads,
    klanten,
    gebruikers,
    bedrijfsinstellingen,
  ];

  // Disable FK checks for cleanup
  await db.run(sql`PRAGMA foreign_keys = OFF`);
  for (const table of tablesToClear) {
    try {
      await db.delete(table);
    } catch {
      // Table might not exist yet, skip
    }
  }
  await db.run(sql`PRAGMA foreign_keys = ON`);

  console.log("Cleared all tables.");

  // ──────────────────────────────────────────────
  // 1. Bedrijfsinstellingen
  // ──────────────────────────────────────────────
  await db.insert(bedrijfsinstellingen).values({
    id: 1,
    bedrijfsnaam: "Autronis",
    adres: "Herengracht 182, 1016 BR Amsterdam",
    kvkNummer: "90182736",
    btwNummer: "NL004738291B01",
    iban: "NL91ABNA0417164300",
    email: "info@autronis.com",
    telefoon: "020-8912345",
    standaardBtw: 21,
    betalingstermijnDagen: 30,
    herinneringNaDagen: 7,
  });

  // ──────────────────────────────────────────────
  // 2. Gebruikers
  // ──────────────────────────────────────────────
  const wachtwoordHash = await bcrypt.hash("Autronis2026!", 10);

  const [sem, syb] = await db
    .insert(gebruikers)
    .values([
      {
        naam: "Sem Gijsberts",
        email: "sem@autronis.com",
        wachtwoordHash,
        rol: "admin",
        uurtariefStandaard: 95,
        themaVoorkeur: "donker",
      },
      {
        naam: "Syb Miedema",
        email: "syb@autronis.com",
        wachtwoordHash,
        rol: "gebruiker",
        uurtariefStandaard: 85,
        themaVoorkeur: "donker",
      },
    ])
    .returning();

  const semId = sem.id;
  const sybId = syb.id;

  // ──────────────────────────────────────────────
  // 3. Klanten (8)
  // ──────────────────────────────────────────────
  const [
    kVeldhuis, kGreenLogic, kBakkerij, kSportFusion,
    kGoudenDraak, kNextera, kBloem, kVanDenBerg,
  ] = await db
    .insert(klanten)
    .values([
      {
        bedrijfsnaam: "Veldhuis Architecten",
        contactpersoon: "Marieke Veldhuis",
        email: "marieke@veldhuisarchitecten.nl",
        telefoon: "06-18293745",
        adres: "Keizersgracht 401, 1016 EK Amsterdam",
        uurtarief: 95,
        branche: "Architectuur",
        kvkNummer: "71234567",
        btwNummer: "NL123456789B01",
        website: "https://veldhuisarchitecten.nl",
        taal: "nl",
        klantSinds: "2025-09-15",
        notities: "Premium klant, meerdere projecten tegelijk. Zeer tevreden over samenwerking.",
        isActief: 1,
        aangemaaktDoor: semId,
      },
      {
        bedrijfsnaam: "GreenLogic BV",
        contactpersoon: "Thomas van Houten",
        email: "thomas@greenlogic.nl",
        telefoon: "06-29384756",
        adres: "Stationsplein 45, 3013 AK Rotterdam",
        uurtarief: 95,
        branche: "Logistiek & Duurzaamheid",
        kvkNummer: "72345678",
        btwNummer: "NL234567890B01",
        website: "https://greenlogic.nl",
        taal: "nl",
        klantSinds: "2025-11-01",
        notities: "Startup met ambitie. Zoekt schaalbaarheid in hun logistieke processen.",
        isActief: 1,
        aangemaaktDoor: semId,
      },
      {
        bedrijfsnaam: "Bakkerij van Dijk",
        contactpersoon: "Hans van Dijk",
        email: "hans@bakkerijvandijk.nl",
        telefoon: "06-38475612",
        adres: "Dorpsstraat 12, 3451 BH Vleuten",
        uurtarief: 85,
        branche: "Horeca & Retail",
        kvkNummer: "73456789",
        btwNummer: "NL345678901B01",
        website: "https://bakkerijvandijk.nl",
        taal: "nl",
        klantSinds: "2025-10-20",
        notities: "Keten van 6 bakkerijen in regio Utrecht. Wil online bestellen aanbieden.",
        isActief: 1,
        aangemaaktDoor: sybId,
      },
      {
        bedrijfsnaam: "SportFusion",
        contactpersoon: "Lisa de Groot",
        email: "lisa@sportfusion.io",
        telefoon: "06-47561234",
        adres: "Johan Cruijff Boulevard 9, 1101 CR Amsterdam",
        uurtarief: 95,
        branche: "SportTech",
        kvkNummer: "74567890",
        btwNummer: "NL456789012B01",
        website: "https://sportfusion.io",
        taal: "en",
        klantSinds: "2026-01-10",
        notities: "Startup, seed-ronde net afgerond. Bouwt een app voor personal trainers.",
        isActief: 1,
        aangemaaktDoor: semId,
      },
      {
        bedrijfsnaam: "De Gouden Draak",
        contactpersoon: "Wei Chen",
        email: "wei@degoudendraak.nl",
        telefoon: "06-56123478",
        adres: "Zeedijk 105, 1012 AW Amsterdam",
        uurtarief: 85,
        branche: "Horeca",
        kvkNummer: "75678901",
        btwNummer: "NL567890123B01",
        website: "https://degoudendraak.nl",
        taal: "nl",
        klantSinds: "2025-12-05",
        notities: "Restaurantketen, 4 locaties in Amsterdam en Den Haag.",
        isActief: 1,
        aangemaaktDoor: sybId,
      },
      {
        bedrijfsnaam: "Nextera Solutions",
        contactpersoon: "Pieter Mulder",
        email: "pieter@nextera.nl",
        telefoon: "06-61234567",
        adres: "Lange Viestraat 2, 3511 BK Utrecht",
        uurtarief: 95,
        branche: "IT Consultancy",
        kvkNummer: "76789012",
        btwNummer: "NL678901234B01",
        website: "https://nextera.nl",
        taal: "nl",
        klantSinds: "2026-01-20",
        notities: "Middelgroot IT-bureau, zoekt een intern klantenportaal.",
        isActief: 1,
        aangemaaktDoor: semId,
      },
      {
        bedrijfsnaam: "Bloem & Blad",
        contactpersoon: "Anne-Marie Jansen",
        email: "annemarie@bloemenblad.nl",
        telefoon: "06-71234568",
        adres: "Bloemenmarkt 15, 1012 KE Amsterdam",
        uurtarief: 85,
        branche: "Retail & E-commerce",
        kvkNummer: "77890123",
        btwNummer: "NL789012345B01",
        website: "https://bloemenblad.nl",
        taal: "nl",
        klantSinds: "2025-08-10",
        notities: "Drie winkels, wil een webshop lanceren naast de fysieke locaties.",
        isActief: 1,
        aangemaaktDoor: sybId,
      },
      {
        bedrijfsnaam: "Van den Berg Advocaten",
        contactpersoon: "Mr. Richard van den Berg",
        email: "r.vandenberg@vdbadvocaten.nl",
        telefoon: "06-81234569",
        adres: "Weena 505, 3013 AL Rotterdam",
        uurtarief: 105,
        branche: "Juridisch",
        kvkNummer: "78901234",
        btwNummer: "NL890123456B01",
        website: "https://vdbadvocaten.nl",
        taal: "nl",
        klantSinds: "2025-11-15",
        notities: "Advocatenkantoor met 12 advocaten. Zoekt document management systeem.",
        isActief: 1,
        aangemaaktDoor: semId,
      },
    ])
    .returning();

  // ──────────────────────────────────────────────
  // 4. Projecten (14)
  // ──────────────────────────────────────────────
  const [
    pVeldhuisWebsite, pVeldhuisBIM,
    pGreenDashboard, pGreenAPI,
    pBakkerijBestel, pBakkerijApp,
    pSportFusionBackend,
    pGoudenDraakRes,
    pNexteraPortal,
    pBloemWebshop, pBloemCRM,
    pVdBergDocs, pVdBergPortal,
    pIntern,
  ] = await db
    .insert(projecten)
    .values([
      // Veldhuis Architecten - 2 projects
      {
        klantId: kVeldhuis.id,
        naam: "Website Redesign",
        omschrijving: "Volledige redesign van de website met portfolio, projectpagina's en contactformulier",
        status: "actief",
        voortgangPercentage: 72,
        deadline: "2026-04-15",
        geschatteUren: 80,
        werkelijkeUren: 58,
        isActief: 1,
        aangemaaktDoor: semId,
      },
      {
        klantId: kVeldhuis.id,
        naam: "BIM Viewer Integratie",
        omschrijving: "3D BIM-modellen zichtbaar maken op de website voor klantpresentaties",
        status: "on-hold",
        voortgangPercentage: 15,
        deadline: "2026-06-30",
        geschatteUren: 60,
        werkelijkeUren: 9,
        isActief: 1,
        aangemaaktDoor: semId,
      },
      // GreenLogic BV - 2 projects
      {
        klantId: kGreenLogic.id,
        naam: "Logistiek Dashboard",
        omschrijving: "Real-time dashboard voor route-optimalisatie en CO2-reductie tracking",
        status: "actief",
        voortgangPercentage: 55,
        deadline: "2026-04-30",
        geschatteUren: 100,
        werkelijkeUren: 55,
        isActief: 1,
        aangemaaktDoor: sybId,
      },
      {
        klantId: kGreenLogic.id,
        naam: "API Koppelingen",
        omschrijving: "Integraties met PostNL, DHL en eigen warehouse management systeem",
        status: "actief",
        voortgangPercentage: 35,
        deadline: "2026-05-15",
        geschatteUren: 45,
        werkelijkeUren: 16,
        isActief: 1,
        aangemaaktDoor: sybId,
      },
      // Bakkerij van Dijk - 2 projects
      {
        klantId: kBakkerij.id,
        naam: "Online Bestelsysteem",
        omschrijving: "Webshop voor brood- en gebakbestellingen met afhaallocaties",
        status: "actief",
        voortgangPercentage: 88,
        deadline: "2026-03-31",
        geschatteUren: 70,
        werkelijkeUren: 62,
        isActief: 1,
        aangemaaktDoor: sybId,
      },
      {
        klantId: kBakkerij.id,
        naam: "Bestel App",
        omschrijving: "Mobiele app (React Native) voor terugkerende klanten met notificaties",
        status: "on-hold",
        voortgangPercentage: 10,
        deadline: "2026-07-31",
        geschatteUren: 90,
        werkelijkeUren: 9,
        isActief: 1,
        aangemaaktDoor: sybId,
      },
      // SportFusion - 1 project
      {
        klantId: kSportFusion.id,
        naam: "Mobile App Backend",
        omschrijving: "REST API en database voor de SportFusion personal trainer app",
        status: "actief",
        voortgangPercentage: 42,
        deadline: "2026-05-30",
        geschatteUren: 120,
        werkelijkeUren: 50,
        isActief: 1,
        aangemaaktDoor: semId,
      },
      // De Gouden Draak - 1 project
      {
        klantId: kGoudenDraak.id,
        naam: "Reserveringssysteem",
        omschrijving: "Online reserveringssysteem met tafelindeling en automatische bevestigingen",
        status: "afgerond",
        voortgangPercentage: 100,
        deadline: "2026-02-28",
        geschatteUren: 50,
        werkelijkeUren: 47,
        isActief: 1,
        aangemaaktDoor: sybId,
      },
      // Nextera Solutions - 1 project
      {
        klantId: kNextera.id,
        naam: "Klantportaal",
        omschrijving: "Portaal waar klanten projectstatus, facturen en documenten kunnen inzien",
        status: "actief",
        voortgangPercentage: 28,
        deadline: "2026-06-15",
        geschatteUren: 95,
        werkelijkeUren: 27,
        isActief: 1,
        aangemaaktDoor: semId,
      },
      // Bloem & Blad - 2 projects
      {
        klantId: kBloem.id,
        naam: "E-commerce Platform",
        omschrijving: "Webshop met bezorgplanning, seizoensarrangementen en abonnementen",
        status: "afgerond",
        voortgangPercentage: 100,
        deadline: "2026-01-31",
        geschatteUren: 85,
        werkelijkeUren: 82,
        isActief: 1,
        aangemaaktDoor: sybId,
      },
      {
        klantId: kBloem.id,
        naam: "CRM Koppeling",
        omschrijving: "Integratie met Mailchimp en eigen klantendatabase voor marketingcampagnes",
        status: "actief",
        voortgangPercentage: 60,
        deadline: "2026-04-15",
        geschatteUren: 30,
        werkelijkeUren: 18,
        isActief: 1,
        aangemaaktDoor: sybId,
      },
      // Van den Berg Advocaten - 2 projects
      {
        klantId: kVanDenBerg.id,
        naam: "Document Management Systeem",
        omschrijving: "Veilig systeem voor opslag, delen en versiebeheer van juridische documenten",
        status: "actief",
        voortgangPercentage: 48,
        deadline: "2026-05-31",
        geschatteUren: 110,
        werkelijkeUren: 53,
        isActief: 1,
        aangemaaktDoor: semId,
      },
      {
        klantId: kVanDenBerg.id,
        naam: "Clientportaal",
        omschrijving: "Beveiligd portaal voor cliënten om documenten en voortgang te bekijken",
        status: "on-hold",
        voortgangPercentage: 5,
        deadline: "2026-08-31",
        geschatteUren: 70,
        werkelijkeUren: 4,
        isActief: 1,
        aangemaaktDoor: semId,
      },
      // Internal project
      {
        klantId: null,
        naam: "Autronis Dashboard",
        omschrijving: "Intern dashboard voor projectbeheer, tijdregistratie en facturatie",
        status: "actief",
        voortgangPercentage: 85,
        deadline: "2026-04-01",
        geschatteUren: 200,
        werkelijkeUren: 170,
        isActief: 1,
        aangemaaktDoor: semId,
      },
    ])
    .returning();

  // ──────────────────────────────────────────────
  // 5. Taken (35+)
  // ──────────────────────────────────────────────
  const insertedTaken = await db
    .insert(taken)
    .values([
      // Veldhuis Website - tasks
      { projectId: pVeldhuisWebsite.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "Homepage hero sectie ontwerpen", status: "afgerond", prioriteit: "hoog", fase: "Design", geschatteDuur: 120 },
      { projectId: pVeldhuisWebsite.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "Portfolio galerij component bouwen", status: "afgerond", prioriteit: "hoog", fase: "Development", geschatteDuur: 180 },
      { projectId: pVeldhuisWebsite.id, toegewezenAan: sybId, aangemaaktDoor: semId, titel: "Contactformulier met validatie", status: "bezig", prioriteit: "normaal", fase: "Development", geschatteDuur: 90 },
      { projectId: pVeldhuisWebsite.id, toegewezenAan: sybId, aangemaaktDoor: semId, titel: "SEO optimalisatie en meta tags", status: "open", prioriteit: "normaal", fase: "SEO", geschatteDuur: 60 },
      { projectId: pVeldhuisWebsite.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "Responsive design testen", status: "open", prioriteit: "hoog", fase: "QA", geschatteDuur: 120 },

      // GreenLogic Dashboard - tasks
      { projectId: pGreenDashboard.id, toegewezenAan: sybId, aangemaaktDoor: sybId, titel: "Dashboard layout en navigatie", status: "afgerond", prioriteit: "hoog", fase: "Frontend", geschatteDuur: 180 },
      { projectId: pGreenDashboard.id, toegewezenAan: sybId, aangemaaktDoor: sybId, titel: "CO2-reductie grafiek component", status: "afgerond", prioriteit: "hoog", fase: "Frontend", geschatteDuur: 240 },
      { projectId: pGreenDashboard.id, toegewezenAan: semId, aangemaaktDoor: sybId, titel: "Route-optimalisatie API endpoint", status: "bezig", prioriteit: "hoog", fase: "Backend", geschatteDuur: 300 },
      { projectId: pGreenDashboard.id, toegewezenAan: sybId, aangemaaktDoor: sybId, titel: "Real-time data websocket verbinding", status: "open", prioriteit: "normaal", fase: "Backend", geschatteDuur: 180 },

      // GreenLogic API - tasks
      { projectId: pGreenAPI.id, toegewezenAan: semId, aangemaaktDoor: sybId, titel: "PostNL API integratie", status: "bezig", prioriteit: "hoog", fase: "Integration", geschatteDuur: 240 },
      { projectId: pGreenAPI.id, toegewezenAan: semId, aangemaaktDoor: sybId, titel: "DHL tracking webhook", status: "open", prioriteit: "normaal", fase: "Integration", geschatteDuur: 180 },
      { projectId: pGreenAPI.id, toegewezenAan: sybId, aangemaaktDoor: sybId, titel: "WMS sync module", status: "open", prioriteit: "normaal", fase: "Backend", geschatteDuur: 300 },

      // Bakkerij Bestelsysteem - tasks
      { projectId: pBakkerijBestel.id, toegewezenAan: sybId, aangemaaktDoor: sybId, titel: "Productcatalogus pagina", status: "afgerond", prioriteit: "hoog", fase: "Frontend", geschatteDuur: 180 },
      { projectId: pBakkerijBestel.id, toegewezenAan: sybId, aangemaaktDoor: sybId, titel: "Winkelwagen en checkout flow", status: "afgerond", prioriteit: "hoog", fase: "Frontend", geschatteDuur: 300 },
      { projectId: pBakkerijBestel.id, toegewezenAan: semId, aangemaaktDoor: sybId, titel: "iDEAL betaalintegratie (Mollie)", status: "afgerond", prioriteit: "hoog", fase: "Backend", geschatteDuur: 120 },
      { projectId: pBakkerijBestel.id, toegewezenAan: sybId, aangemaaktDoor: sybId, titel: "Bevestigingsmail templates", status: "bezig", prioriteit: "normaal", fase: "Backend", geschatteDuur: 60 },
      { projectId: pBakkerijBestel.id, toegewezenAan: semId, aangemaaktDoor: sybId, titel: "Performance testen voor piekuren", status: "open", prioriteit: "laag", fase: "QA", geschatteDuur: 90 },

      // SportFusion Backend - tasks
      { projectId: pSportFusionBackend.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "Database schema ontwerp", status: "afgerond", prioriteit: "hoog", fase: "Architecture", geschatteDuur: 180 },
      { projectId: pSportFusionBackend.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "User authentication met JWT", status: "afgerond", prioriteit: "hoog", fase: "Backend", geschatteDuur: 240 },
      { projectId: pSportFusionBackend.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "Workout tracking endpoints", status: "bezig", prioriteit: "hoog", fase: "Backend", geschatteDuur: 300 },
      { projectId: pSportFusionBackend.id, toegewezenAan: sybId, aangemaaktDoor: semId, titel: "Push notificaties service", status: "open", prioriteit: "normaal", fase: "Backend", geschatteDuur: 180 },
      { projectId: pSportFusionBackend.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "Stripe subscription integratie", status: "open", prioriteit: "hoog", fase: "Backend", geschatteDuur: 240 },

      // Nextera Portal - tasks
      { projectId: pNexteraPortal.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "Authenticatie en rolbeheer", status: "afgerond", prioriteit: "hoog", fase: "Backend", geschatteDuur: 180 },
      { projectId: pNexteraPortal.id, toegewezenAan: sybId, aangemaaktDoor: semId, titel: "Project overzicht pagina", status: "bezig", prioriteit: "hoog", fase: "Frontend", geschatteDuur: 240 },
      { projectId: pNexteraPortal.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "Factuur inzage module", status: "open", prioriteit: "normaal", fase: "Frontend", geschatteDuur: 120 },

      // Van den Berg DMS - tasks
      { projectId: pVdBergDocs.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "Versiebeheer engine", status: "afgerond", prioriteit: "hoog", fase: "Backend", geschatteDuur: 360 },
      { projectId: pVdBergDocs.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "PDF viewer en annotaties", status: "bezig", prioriteit: "hoog", fase: "Frontend", geschatteDuur: 300 },
      { projectId: pVdBergDocs.id, toegewezenAan: sybId, aangemaaktDoor: semId, titel: "Zoekfunctie met full-text search", status: "open", prioriteit: "normaal", fase: "Backend", geschatteDuur: 240 },
      { projectId: pVdBergDocs.id, toegewezenAan: sybId, aangemaaktDoor: semId, titel: "Toegangsrechten per dossier", status: "open", prioriteit: "hoog", fase: "Backend", geschatteDuur: 180 },

      // Bloem CRM - tasks
      { projectId: pBloemCRM.id, toegewezenAan: sybId, aangemaaktDoor: sybId, titel: "Mailchimp API koppeling", status: "afgerond", prioriteit: "hoog", fase: "Integration", geschatteDuur: 120 },
      { projectId: pBloemCRM.id, toegewezenAan: sybId, aangemaaktDoor: sybId, titel: "Klantensegmentatie module", status: "bezig", prioriteit: "normaal", fase: "Backend", geschatteDuur: 180 },
      { projectId: pBloemCRM.id, toegewezenAan: sybId, aangemaaktDoor: sybId, titel: "Campagne statistieken dashboard", status: "open", prioriteit: "laag", fase: "Frontend", geschatteDuur: 120 },

      // Intern Dashboard - tasks
      { projectId: pIntern.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "Belasting module bouwen", status: "bezig", prioriteit: "hoog", fase: "Feature", geschatteDuur: 480 },
      { projectId: pIntern.id, toegewezenAan: sybId, aangemaaktDoor: semId, titel: "Wiki kennisbank pagina", status: "afgerond", prioriteit: "normaal", fase: "Feature", geschatteDuur: 240 },
      { projectId: pIntern.id, toegewezenAan: semId, aangemaaktDoor: semId, titel: "Agenda Google Calendar sync", status: "afgerond", prioriteit: "hoog", fase: "Integration", geschatteDuur: 180 },
    ])
    .returning();

  // ──────────────────────────────────────────────
  // 6. Tijdregistraties (55+)
  // ──────────────────────────────────────────────
  const timeEntries: Array<{
    gebruikerId: number;
    projectId: number;
    omschrijving: string;
    startTijd: string;
    eindTijd: string;
    duurMinuten: number;
    categorie: "development" | "meeting" | "administratie" | "overig" | "focus";
    isHandmatig: number;
  }> = [
    // ── January 2026 ──
    { gebruikerId: semId, projectId: pVeldhuisWebsite.id, omschrijving: "Kickoff meeting website redesign", startTijd: "2026-01-05T10:00:00", eindTijd: "2026-01-05T11:30:00", duurMinuten: 90, categorie: "meeting", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pVeldhuisWebsite.id, omschrijving: "Wireframes homepage en portfolio", startTijd: "2026-01-06T09:00:00", eindTijd: "2026-01-06T13:00:00", duurMinuten: 240, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pBloemWebshop.id, omschrijving: "Productpagina componenten bouwen", startTijd: "2026-01-06T09:00:00", eindTijd: "2026-01-06T12:00:00", duurMinuten: 180, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pVeldhuisWebsite.id, omschrijving: "Hero sectie development", startTijd: "2026-01-07T09:00:00", eindTijd: "2026-01-07T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pBloemWebshop.id, omschrijving: "Bezorgplanning kalender integratie", startTijd: "2026-01-07T10:00:00", eindTijd: "2026-01-07T14:30:00", duurMinuten: 270, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pSportFusionBackend.id, omschrijving: "Database schema en ERD uitwerken", startTijd: "2026-01-08T09:00:00", eindTijd: "2026-01-08T12:00:00", duurMinuten: 180, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pGoudenDraakRes.id, omschrijving: "Reserveringsformulier component", startTijd: "2026-01-08T09:00:00", eindTijd: "2026-01-08T13:00:00", duurMinuten: 240, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pSportFusionBackend.id, omschrijving: "JWT auth implementatie", startTijd: "2026-01-12T09:00:00", eindTijd: "2026-01-12T13:00:00", duurMinuten: 240, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pGoudenDraakRes.id, omschrijving: "Tafelindeling drag & drop", startTijd: "2026-01-12T10:00:00", eindTijd: "2026-01-12T15:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pBakkerijBestel.id, omschrijving: "Productcatalogus backend", startTijd: "2026-01-14T09:00:00", eindTijd: "2026-01-14T13:00:00", duurMinuten: 240, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pIntern.id, omschrijving: "Dashboard architectuur sessie", startTijd: "2026-01-14T14:00:00", eindTijd: "2026-01-14T16:00:00", duurMinuten: 120, categorie: "meeting", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pBloemWebshop.id, omschrijving: "Checkout flow en betaling", startTijd: "2026-01-16T09:00:00", eindTijd: "2026-01-16T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pVdBergDocs.id, omschrijving: "Versiebeheer engine opzet", startTijd: "2026-01-19T09:00:00", eindTijd: "2026-01-19T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pGoudenDraakRes.id, omschrijving: "Email bevestigingen automatisering", startTijd: "2026-01-19T09:00:00", eindTijd: "2026-01-19T12:00:00", duurMinuten: 180, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pVdBergDocs.id, omschrijving: "S3 integratie document opslag", startTijd: "2026-01-21T09:00:00", eindTijd: "2026-01-21T12:30:00", duurMinuten: 210, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pIntern.id, omschrijving: "Tijdregistratie module bouwen", startTijd: "2026-01-23T09:00:00", eindTijd: "2026-01-23T15:00:00", duurMinuten: 360, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pBakkerijBestel.id, omschrijving: "Winkelwagen component frontend", startTijd: "2026-01-23T09:00:00", eindTijd: "2026-01-23T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pBloemWebshop.id, omschrijving: "Bloem & Blad klantoverleg", startTijd: "2026-01-27T10:00:00", eindTijd: "2026-01-27T11:00:00", duurMinuten: 60, categorie: "meeting", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pBloemWebshop.id, omschrijving: "Abonnementensysteem seizoensboeketten", startTijd: "2026-01-28T09:00:00", eindTijd: "2026-01-28T13:00:00", duurMinuten: 240, categorie: "development", isHandmatig: 0 },

    // ── February 2026 ──
    { gebruikerId: semId, projectId: pVeldhuisWebsite.id, omschrijving: "Portfolio galerij met lightbox", startTijd: "2026-02-02T09:00:00", eindTijd: "2026-02-02T12:00:00", duurMinuten: 180, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pGreenDashboard.id, omschrijving: "Dashboard layout en navigatie", startTijd: "2026-02-02T09:00:00", eindTijd: "2026-02-02T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pGreenDashboard.id, omschrijving: "CO2-reductie chart component", startTijd: "2026-02-04T09:00:00", eindTijd: "2026-02-04T13:00:00", duurMinuten: 240, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pSportFusionBackend.id, omschrijving: "Workout tracking API endpoints", startTijd: "2026-02-04T09:00:00", eindTijd: "2026-02-04T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pNexteraPortal.id, omschrijving: "Authenticatie en rolbeheer", startTijd: "2026-02-06T09:00:00", eindTijd: "2026-02-06T12:00:00", duurMinuten: 180, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pBakkerijBestel.id, omschrijving: "Checkout flow met afhaallocatie keuze", startTijd: "2026-02-06T09:00:00", eindTijd: "2026-02-06T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pBakkerijBestel.id, omschrijving: "Mollie iDEAL integratie", startTijd: "2026-02-10T09:00:00", eindTijd: "2026-02-10T11:00:00", duurMinuten: 120, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pVdBergDocs.id, omschrijving: "PDF viewer frontend component", startTijd: "2026-02-11T09:00:00", eindTijd: "2026-02-11T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pGoudenDraakRes.id, omschrijving: "Finaal testen en bugfixes", startTijd: "2026-02-12T09:00:00", eindTijd: "2026-02-12T12:00:00", duurMinuten: 180, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pGoudenDraakRes.id, omschrijving: "Oplevering en klantdemo", startTijd: "2026-02-13T14:00:00", eindTijd: "2026-02-13T15:30:00", duurMinuten: 90, categorie: "meeting", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pGreenAPI.id, omschrijving: "PostNL API documentatie en setup", startTijd: "2026-02-17T09:00:00", eindTijd: "2026-02-17T12:00:00", duurMinuten: 180, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pGreenDashboard.id, omschrijving: "GreenLogic voortgangsbespreking", startTijd: "2026-02-17T14:00:00", eindTijd: "2026-02-17T15:00:00", duurMinuten: 60, categorie: "meeting", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pIntern.id, omschrijving: "Facturatie module bouwen", startTijd: "2026-02-19T09:00:00", eindTijd: "2026-02-19T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pBloemCRM.id, omschrijving: "Mailchimp API koppeling implementatie", startTijd: "2026-02-19T09:00:00", eindTijd: "2026-02-19T11:00:00", duurMinuten: 120, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pVdBergDocs.id, omschrijving: "Annotaties systeem bouwen", startTijd: "2026-02-24T09:00:00", eindTijd: "2026-02-24T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pGreenDashboard.id, omschrijving: "Kaartweergave met route visualisatie", startTijd: "2026-02-24T09:00:00", eindTijd: "2026-02-24T13:00:00", duurMinuten: 240, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pIntern.id, omschrijving: "Administratie en boekhouding", startTijd: "2026-02-26T09:00:00", eindTijd: "2026-02-26T11:00:00", duurMinuten: 120, categorie: "administratie", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pNexteraPortal.id, omschrijving: "Project overzicht pagina bouwen", startTijd: "2026-02-26T09:00:00", eindTijd: "2026-02-26T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },

    // ── March 2026 ──
    { gebruikerId: semId, projectId: pVeldhuisWebsite.id, omschrijving: "Animaties en scroll-effecten", startTijd: "2026-03-02T09:00:00", eindTijd: "2026-03-02T13:00:00", duurMinuten: 240, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pBakkerijBestel.id, omschrijving: "Bevestigingsmail templates", startTijd: "2026-03-02T09:00:00", eindTijd: "2026-03-02T11:00:00", duurMinuten: 120, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pGreenAPI.id, omschrijving: "PostNL tracking webhook implementatie", startTijd: "2026-03-04T09:00:00", eindTijd: "2026-03-04T13:00:00", duurMinuten: 240, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pBloemCRM.id, omschrijving: "Klantensegmentatie logica", startTijd: "2026-03-04T09:00:00", eindTijd: "2026-03-04T12:00:00", duurMinuten: 180, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pSportFusionBackend.id, omschrijving: "Sprint review met SportFusion team", startTijd: "2026-03-09T14:00:00", eindTijd: "2026-03-09T15:30:00", duurMinuten: 90, categorie: "meeting", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pGreenDashboard.id, omschrijving: "Fleet management overzicht", startTijd: "2026-03-10T09:00:00", eindTijd: "2026-03-10T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pVdBergDocs.id, omschrijving: "Van den Berg voortgangsoverleg", startTijd: "2026-03-11T10:00:00", eindTijd: "2026-03-11T11:00:00", duurMinuten: 60, categorie: "meeting", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pIntern.id, omschrijving: "Belasting module: BTW berekening", startTijd: "2026-03-12T09:00:00", eindTijd: "2026-03-12T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pNexteraPortal.id, omschrijving: "Nextera portaal design review", startTijd: "2026-03-12T14:00:00", eindTijd: "2026-03-12T15:00:00", duurMinuten: 60, categorie: "meeting", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pVeldhuisWebsite.id, omschrijving: "CMS integratie voor projecten", startTijd: "2026-03-16T09:00:00", eindTijd: "2026-03-16T13:00:00", duurMinuten: 240, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pBakkerijBestel.id, omschrijving: "UAT met bakkerij medewerkers", startTijd: "2026-03-16T14:00:00", eindTijd: "2026-03-16T16:00:00", duurMinuten: 120, categorie: "meeting", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pSportFusionBackend.id, omschrijving: "Workout tracking progress API", startTijd: "2026-03-18T09:00:00", eindTijd: "2026-03-18T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pGreenDashboard.id, omschrijving: "Dashboard filtering en export", startTijd: "2026-03-18T09:00:00", eindTijd: "2026-03-18T12:00:00", duurMinuten: 180, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pIntern.id, omschrijving: "Team standup maandag", startTijd: "2026-03-23T09:00:00", eindTijd: "2026-03-23T09:30:00", duurMinuten: 30, categorie: "meeting", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pIntern.id, omschrijving: "Team standup maandag", startTijd: "2026-03-23T09:00:00", eindTijd: "2026-03-23T09:30:00", duurMinuten: 30, categorie: "meeting", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pVdBergDocs.id, omschrijving: "Full-text search implementatie", startTijd: "2026-03-24T09:00:00", eindTijd: "2026-03-24T14:00:00", duurMinuten: 300, categorie: "development", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pBloemCRM.id, omschrijving: "Campaign analytics dashboard", startTijd: "2026-03-24T09:00:00", eindTijd: "2026-03-24T13:00:00", duurMinuten: 240, categorie: "development", isHandmatig: 0 },
    { gebruikerId: semId, projectId: pIntern.id, omschrijving: "Kwartaalplanning en strategie", startTijd: "2026-03-26T14:00:00", eindTijd: "2026-03-26T16:00:00", duurMinuten: 120, categorie: "meeting", isHandmatig: 0 },
    { gebruikerId: sybId, projectId: pIntern.id, omschrijving: "Kwartaalplanning en strategie", startTijd: "2026-03-26T14:00:00", eindTijd: "2026-03-26T16:00:00", duurMinuten: 120, categorie: "meeting", isHandmatig: 0 },
  ];

  await db.insert(tijdregistraties).values(timeEntries);

  // ──────────────────────────────────────────────
  // 7. Facturen (12) + Factuurregels
  // ──────────────────────────────────────────────
  const invoiceData: Array<{
    klantId: number;
    projectId: number;
    factuurnummer: string;
    status: "concept" | "verzonden" | "betaald" | "te_laat";
    bedragExclBtw: number;
    btwPercentage: number;
    btwBedrag: number;
    bedragInclBtw: number;
    factuurdatum: string;
    vervaldatum: string;
    betaaldOp: string | null;
    aangemaaktDoor: number;
  }> = [
    { klantId: kBloem.id, projectId: pBloemWebshop.id, factuurnummer: "AUT-2026-001", status: "betaald", bedragExclBtw: 4250, btwPercentage: 21, btwBedrag: 892.50, bedragInclBtw: 5142.50, factuurdatum: "2026-01-15", vervaldatum: "2026-02-14", betaaldOp: "2026-02-10", aangemaaktDoor: sybId },
    { klantId: kGoudenDraak.id, projectId: pGoudenDraakRes.id, factuurnummer: "AUT-2026-002", status: "betaald", bedragExclBtw: 3200, btwPercentage: 21, btwBedrag: 672, bedragInclBtw: 3872, factuurdatum: "2026-01-31", vervaldatum: "2026-03-02", betaaldOp: "2026-02-25", aangemaaktDoor: sybId },
    { klantId: kVeldhuis.id, projectId: pVeldhuisWebsite.id, factuurnummer: "AUT-2026-003", status: "betaald", bedragExclBtw: 3800, btwPercentage: 21, btwBedrag: 798, bedragInclBtw: 4598, factuurdatum: "2026-02-01", vervaldatum: "2026-03-03", betaaldOp: "2026-02-28", aangemaaktDoor: semId },
    { klantId: kSportFusion.id, projectId: pSportFusionBackend.id, factuurnummer: "AUT-2026-004", status: "betaald", bedragExclBtw: 2850, btwPercentage: 21, btwBedrag: 598.50, bedragInclBtw: 3448.50, factuurdatum: "2026-02-15", vervaldatum: "2026-03-17", betaaldOp: "2026-03-10", aangemaaktDoor: semId },
    { klantId: kBakkerij.id, projectId: pBakkerijBestel.id, factuurnummer: "AUT-2026-005", status: "betaald", bedragExclBtw: 3400, btwPercentage: 21, btwBedrag: 714, bedragInclBtw: 4114, factuurdatum: "2026-02-28", vervaldatum: "2026-03-30", betaaldOp: "2026-03-20", aangemaaktDoor: sybId },
    { klantId: kVanDenBerg.id, projectId: pVdBergDocs.id, factuurnummer: "AUT-2026-006", status: "verzonden", bedragExclBtw: 4750, btwPercentage: 21, btwBedrag: 997.50, bedragInclBtw: 5747.50, factuurdatum: "2026-03-01", vervaldatum: "2026-03-31", betaaldOp: null, aangemaaktDoor: semId },
    { klantId: kGreenLogic.id, projectId: pGreenDashboard.id, factuurnummer: "AUT-2026-007", status: "verzonden", bedragExclBtw: 3600, btwPercentage: 21, btwBedrag: 756, bedragInclBtw: 4356, factuurdatum: "2026-03-05", vervaldatum: "2026-04-04", betaaldOp: null, aangemaaktDoor: sybId },
    { klantId: kNextera.id, projectId: pNexteraPortal.id, factuurnummer: "AUT-2026-008", status: "verzonden", bedragExclBtw: 2375, btwPercentage: 21, btwBedrag: 498.75, bedragInclBtw: 2873.75, factuurdatum: "2026-03-10", vervaldatum: "2026-04-09", betaaldOp: null, aangemaaktDoor: semId },
    { klantId: kBloem.id, projectId: pBloemCRM.id, factuurnummer: "AUT-2026-009", status: "concept", bedragExclBtw: 1530, btwPercentage: 21, btwBedrag: 321.30, bedragInclBtw: 1851.30, factuurdatum: "2026-03-25", vervaldatum: "2026-04-24", betaaldOp: null, aangemaaktDoor: sybId },
    { klantId: kVeldhuis.id, projectId: pVeldhuisWebsite.id, factuurnummer: "AUT-2026-010", status: "concept", bedragExclBtw: 2660, btwPercentage: 21, btwBedrag: 558.60, bedragInclBtw: 3218.60, factuurdatum: "2026-03-28", vervaldatum: "2026-04-27", betaaldOp: null, aangemaaktDoor: semId },
    { klantId: kSportFusion.id, projectId: pSportFusionBackend.id, factuurnummer: "AUT-2026-011", status: "te_laat", bedragExclBtw: 1900, btwPercentage: 21, btwBedrag: 399, bedragInclBtw: 2299, factuurdatum: "2026-01-20", vervaldatum: "2026-02-19", betaaldOp: null, aangemaaktDoor: semId },
    { klantId: kGreenLogic.id, projectId: pGreenAPI.id, factuurnummer: "AUT-2026-012", status: "te_laat", bedragExclBtw: 1425, btwPercentage: 21, btwBedrag: 299.25, bedragInclBtw: 1724.25, factuurdatum: "2026-02-05", vervaldatum: "2026-03-07", betaaldOp: null, aangemaaktDoor: sybId },
  ];

  const insertedFacturen = await db.insert(facturen).values(invoiceData).returning();

  // Factuurregels
  const factuurRegelsData: Array<{
    factuurId: number;
    omschrijving: string;
    aantal: number;
    eenheidsprijs: number;
    btwPercentage: number;
    totaal: number;
  }> = [
    // AUT-2026-001 (Bloem webshop)
    { factuurId: insertedFacturen[0].id, omschrijving: "Frontend development webshop", aantal: 30, eenheidsprijs: 85, btwPercentage: 21, totaal: 2550 },
    { factuurId: insertedFacturen[0].id, omschrijving: "Backend development & API", aantal: 15, eenheidsprijs: 85, btwPercentage: 21, totaal: 1275 },
    { factuurId: insertedFacturen[0].id, omschrijving: "Design en UX consultancy", aantal: 5, eenheidsprijs: 85, btwPercentage: 21, totaal: 425 },
    // AUT-2026-002 (Gouden Draak)
    { factuurId: insertedFacturen[1].id, omschrijving: "Reserveringssysteem development", aantal: 28, eenheidsprijs: 85, btwPercentage: 21, totaal: 2380 },
    { factuurId: insertedFacturen[1].id, omschrijving: "UI/UX design tafelindeling", aantal: 6, eenheidsprijs: 85, btwPercentage: 21, totaal: 510 },
    { factuurId: insertedFacturen[1].id, omschrijving: "Testen en oplevering", aantal: 3.65, eenheidsprijs: 85, btwPercentage: 21, totaal: 310 },
    // AUT-2026-003 (Veldhuis website)
    { factuurId: insertedFacturen[2].id, omschrijving: "Website design en prototyping", aantal: 16, eenheidsprijs: 95, btwPercentage: 21, totaal: 1520 },
    { factuurId: insertedFacturen[2].id, omschrijving: "Frontend development Next.js", aantal: 20, eenheidsprijs: 95, btwPercentage: 21, totaal: 1900 },
    { factuurId: insertedFacturen[2].id, omschrijving: "Content management opzet", aantal: 4, eenheidsprijs: 95, btwPercentage: 21, totaal: 380 },
    // AUT-2026-004 (SportFusion)
    { factuurId: insertedFacturen[3].id, omschrijving: "API architectuur en database design", aantal: 12, eenheidsprijs: 95, btwPercentage: 21, totaal: 1140 },
    { factuurId: insertedFacturen[3].id, omschrijving: "Backend development Node.js", aantal: 18, eenheidsprijs: 95, btwPercentage: 21, totaal: 1710 },
    // AUT-2026-005 (Bakkerij)
    { factuurId: insertedFacturen[4].id, omschrijving: "Bestelsysteem development", aantal: 32, eenheidsprijs: 85, btwPercentage: 21, totaal: 2720 },
    { factuurId: insertedFacturen[4].id, omschrijving: "Mollie betaalintegratie", aantal: 4, eenheidsprijs: 95, btwPercentage: 21, totaal: 380 },
    { factuurId: insertedFacturen[4].id, omschrijving: "Acceptatietesten", aantal: 3.53, eenheidsprijs: 85, btwPercentage: 21, totaal: 300 },
    // AUT-2026-006 (Van den Berg DMS)
    { factuurId: insertedFacturen[5].id, omschrijving: "Document management backend", aantal: 30, eenheidsprijs: 105, btwPercentage: 21, totaal: 3150 },
    { factuurId: insertedFacturen[5].id, omschrijving: "PDF viewer en annotatie systeem", aantal: 10, eenheidsprijs: 105, btwPercentage: 21, totaal: 1050 },
    { factuurId: insertedFacturen[5].id, omschrijving: "Security audit", aantal: 5.24, eenheidsprijs: 105, btwPercentage: 21, totaal: 550 },
    // AUT-2026-007 (GreenLogic dashboard)
    { factuurId: insertedFacturen[6].id, omschrijving: "Dashboard frontend development", aantal: 24, eenheidsprijs: 95, btwPercentage: 21, totaal: 2280 },
    { factuurId: insertedFacturen[6].id, omschrijving: "Data visualisatie componenten", aantal: 10, eenheidsprijs: 95, btwPercentage: 21, totaal: 950 },
    { factuurId: insertedFacturen[6].id, omschrijving: "Klantoverleg en afstemming", aantal: 3.89, eenheidsprijs: 95, btwPercentage: 21, totaal: 370 },
    // AUT-2026-008 (Nextera portaal)
    { factuurId: insertedFacturen[7].id, omschrijving: "Authenticatie en rolbeheer", aantal: 14, eenheidsprijs: 95, btwPercentage: 21, totaal: 1330 },
    { factuurId: insertedFacturen[7].id, omschrijving: "Project overzicht pagina", aantal: 11, eenheidsprijs: 95, btwPercentage: 21, totaal: 1045 },
    // AUT-2026-009 (Bloem CRM)
    { factuurId: insertedFacturen[8].id, omschrijving: "Mailchimp integratie", aantal: 10, eenheidsprijs: 85, btwPercentage: 21, totaal: 850 },
    { factuurId: insertedFacturen[8].id, omschrijving: "Klantensegmentatie module", aantal: 8, eenheidsprijs: 85, btwPercentage: 21, totaal: 680 },
    // AUT-2026-010 (Veldhuis website pt2)
    { factuurId: insertedFacturen[9].id, omschrijving: "CMS integratie en animaties", aantal: 20, eenheidsprijs: 95, btwPercentage: 21, totaal: 1900 },
    { factuurId: insertedFacturen[9].id, omschrijving: "Performance optimalisatie", aantal: 8, eenheidsprijs: 95, btwPercentage: 21, totaal: 760 },
    // AUT-2026-011 (SportFusion te laat)
    { factuurId: insertedFacturen[10].id, omschrijving: "API development sprint 1", aantal: 20, eenheidsprijs: 95, btwPercentage: 21, totaal: 1900 },
    // AUT-2026-012 (GreenLogic te laat)
    { factuurId: insertedFacturen[11].id, omschrijving: "API integratie setup", aantal: 15, eenheidsprijs: 95, btwPercentage: 21, totaal: 1425 },
  ];

  await db.insert(factuurRegels).values(factuurRegelsData);

  // ──────────────────────────────────────────────
  // 8. Inkomsten (linked to paid invoices)
  // ──────────────────────────────────────────────
  const paidFacturen = insertedFacturen.filter((f) => f.status === "betaald");
  const inkomstenData = paidFacturen.map((f) => ({
    factuurId: f.id,
    klantId: f.klantId!,
    omschrijving: `Betaling factuur ${f.factuurnummer}`,
    bedrag: f.bedragInclBtw!,
    datum: f.betaaldOp!,
    categorie: "Projectwerk",
    aangemaaktDoor: f.aangemaaktDoor!,
  }));

  await db.insert(inkomsten).values(inkomstenData);

  // ──────────────────────────────────────────────
  // 9. Uitgaven (22)
  // ──────────────────────────────────────────────
  await db.insert(uitgaven).values([
    { omschrijving: "Vercel Pro - januari", bedrag: 20, datum: "2026-01-01", categorie: "software", leverancier: "Vercel", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "GitHub Team - januari", bedrag: 19, datum: "2026-01-01", categorie: "software", leverancier: "GitHub", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Anthropic API credits", bedrag: 45, datum: "2026-01-05", categorie: "software", leverancier: "Anthropic", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Logitech MX Keys toetsenbord", bedrag: 89.99, datum: "2026-01-10", categorie: "hardware", leverancier: "Coolblue", btwBedrag: 15.62, btwPercentage: 21, fiscaalAftrekbaar: 1, aangemaaktDoor: sybId },
    { omschrijving: "Tankbeurt Shell Amstelveen", bedrag: 78.50, datum: "2026-01-14", categorie: "reiskosten", leverancier: "Shell", btwBedrag: 13.62, btwPercentage: 21, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Vercel Pro - februari", bedrag: 20, datum: "2026-02-01", categorie: "software", leverancier: "Vercel", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "GitHub Team - februari", bedrag: 19, datum: "2026-02-01", categorie: "software", leverancier: "GitHub", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Figma Professional - februari", bedrag: 12, datum: "2026-02-01", categorie: "software", leverancier: "Figma", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: sybId },
    { omschrijving: "Kantoorartikelen Albert Heijn", bedrag: 34.20, datum: "2026-02-06", categorie: "kantoor", leverancier: "Albert Heijn", btwBedrag: 5.94, btwPercentage: 21, fiscaalAftrekbaar: 1, aangemaaktDoor: sybId },
    { omschrijving: "NS Zakelijk reiskosten", bedrag: 67.80, datum: "2026-02-10", categorie: "reiskosten", leverancier: "NS", btwBedrag: 5.94, btwPercentage: 9, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Anthropic API credits", bedrag: 62, datum: "2026-02-12", categorie: "software", leverancier: "Anthropic", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Notion Team - kwartaal", bedrag: 30, datum: "2026-02-15", categorie: "software", leverancier: "Notion", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Google Workspace - februari", bedrag: 11.50, datum: "2026-02-18", categorie: "software", leverancier: "Google", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Tankbeurt Shell Utrecht", bedrag: 82.30, datum: "2026-02-20", categorie: "reiskosten", leverancier: "Shell", btwBedrag: 14.29, btwPercentage: 21, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Vercel Pro - maart", bedrag: 20, datum: "2026-03-01", categorie: "software", leverancier: "Vercel", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "GitHub Team - maart", bedrag: 19, datum: "2026-03-01", categorie: "software", leverancier: "GitHub", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Figma Professional - maart", bedrag: 12, datum: "2026-03-01", categorie: "software", leverancier: "Figma", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: sybId },
    { omschrijving: "AWS hosting kosten", bedrag: 156.40, datum: "2026-03-03", categorie: "software", leverancier: "Amazon Web Services", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Slack Pro - maart", bedrag: 7.25, datum: "2026-03-05", categorie: "software", leverancier: "Slack", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Anthropic API credits", bedrag: 85, datum: "2026-03-08", categorie: "software", leverancier: "Anthropic", btwBedrag: 0, btwPercentage: 0, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "Koffie en lunch klantbezoek", bedrag: 24.50, datum: "2026-03-11", categorie: "kantoor", leverancier: "Doppio Espresso", btwBedrag: 2.14, btwPercentage: 9, fiscaalAftrekbaar: 1, aangemaaktDoor: semId },
    { omschrijving: "USB-C hub en kabels", bedrag: 49.95, datum: "2026-03-15", categorie: "hardware", leverancier: "MediaMarkt", btwBedrag: 8.67, btwPercentage: 21, fiscaalAftrekbaar: 1, aangemaaktDoor: sybId },
  ]);

  // ──────────────────────────────────────────────
  // 10. Abonnementen (9)
  // ──────────────────────────────────────────────
  await db.insert(abonnementen).values([
    { naam: "Vercel Pro", leverancier: "Vercel", bedrag: 20, frequentie: "maandelijks", categorie: "hosting", startDatum: "2025-06-01", volgendeBetaling: "2026-04-01", url: "https://vercel.com", isActief: 1 },
    { naam: "GitHub Team", leverancier: "GitHub", bedrag: 19, frequentie: "maandelijks", categorie: "tools", startDatum: "2025-06-01", volgendeBetaling: "2026-04-01", url: "https://github.com", isActief: 1 },
    { naam: "Anthropic API", leverancier: "Anthropic", bedrag: 65, frequentie: "maandelijks", categorie: "ai", startDatum: "2025-08-01", volgendeBetaling: "2026-04-01", url: "https://console.anthropic.com", notities: "Variabele kosten, gemiddeld ~€65/maand", isActief: 1 },
    { naam: "Notion Team", leverancier: "Notion", bedrag: 30, frequentie: "per_kwartaal", categorie: "tools", startDatum: "2025-09-01", volgendeBetaling: "2026-05-01", url: "https://notion.so", isActief: 1 },
    { naam: "Figma Professional", leverancier: "Figma", bedrag: 12, frequentie: "maandelijks", categorie: "design", startDatum: "2025-10-01", volgendeBetaling: "2026-04-01", url: "https://figma.com", isActief: 1 },
    { naam: "Google Workspace", leverancier: "Google", bedrag: 11.50, frequentie: "maandelijks", categorie: "communicatie", startDatum: "2025-06-01", volgendeBetaling: "2026-04-01", url: "https://workspace.google.com", isActief: 1 },
    { naam: "AWS Hosting", leverancier: "Amazon Web Services", bedrag: 156.40, frequentie: "maandelijks", categorie: "hosting", startDatum: "2025-07-01", volgendeBetaling: "2026-04-01", url: "https://aws.amazon.com", notities: "EC2 + S3 + CloudFront", isActief: 1 },
    { naam: "Slack Pro", leverancier: "Slack", bedrag: 7.25, frequentie: "maandelijks", categorie: "communicatie", startDatum: "2025-09-01", volgendeBetaling: "2026-04-01", url: "https://slack.com", isActief: 1 },
    { naam: "Linear", leverancier: "Linear", bedrag: 8, frequentie: "maandelijks", categorie: "tools", startDatum: "2026-01-01", volgendeBetaling: "2026-04-01", url: "https://linear.app", notities: "Issue tracking voor klantprojecten", isActief: 1 },
  ]);

  // ──────────────────────────────────────────────
  // 11. Leads (7)
  // ──────────────────────────────────────────────
  const insertedLeads = await db
    .insert(leads)
    .values([
      { bedrijfsnaam: "Keurslager Hendriks", contactpersoon: "Frank Hendriks", email: "frank@keurslagerhendriks.nl", telefoon: "06-91234567", waarde: 4500, status: "nieuw", bron: "website", notities: "Wil een online bestelsysteem zoals Bakkerij van Dijk", volgendeActie: "Eerste kennismakingsgesprek plannen", volgendeActieDatum: "2026-04-02", aangemaaktDoor: semId },
      { bedrijfsnaam: "Studio Bloom", contactpersoon: "Eva Bloom", email: "eva@studiobloom.nl", telefoon: "06-12987654", waarde: 8000, status: "contact", bron: "linkedin", notities: "Creatief bureau, wil hun portfolio site opnieuw laten bouwen. Hebben al een eerste gesprek gehad.", volgendeActie: "Offerte versturen", volgendeActieDatum: "2026-03-31", aangemaaktDoor: semId },
      { bedrijfsnaam: "FreshFood Delivery", contactpersoon: "Mohammed Al-Rashid", email: "mohammed@freshfood.nl", telefoon: "06-34567891", waarde: 12000, status: "offerte", bron: "referral", notities: "Via Bakkerij van Dijk doorverwezen. Wil platform voor maaltijdbezorging.", volgendeActie: "Offerte opvolgen", volgendeActieDatum: "2026-04-01", aangemaaktDoor: sybId },
      { bedrijfsnaam: "Tandartspraktijk Smile", contactpersoon: "Dr. Anke Smit", email: "info@tandartspraktijksmile.nl", telefoon: "06-45678912", waarde: 3500, status: "gewonnen", bron: "google", notities: "Website met online afsprakenplanner. Contract getekend, start volgende maand.", aangemaaktDoor: semId },
      { bedrijfsnaam: "Van Leeuwen Transport", contactpersoon: "Jaap van Leeuwen", email: "jaap@vlstransport.nl", telefoon: "06-56789123", waarde: 15000, status: "offerte", bron: "netwerk", notities: "Transportbedrijf, 50 vrachtwagens. Zoekt fleet management dashboard.", volgendeActie: "Demo plannen", volgendeActieDatum: "2026-04-03", aangemaaktDoor: sybId },
      { bedrijfsnaam: "Boekwinkel Pagina's", contactpersoon: "Iris de Boer", email: "iris@boekwinkelpaginas.nl", telefoon: "06-67891234", waarde: 2800, status: "verloren", bron: "website", notities: "Budget te beperkt voor custom oplossing. Doorverwezen naar Shopify.", aangemaaktDoor: sybId },
      { bedrijfsnaam: "GymPro Fitness", contactpersoon: "Kevin Bakker", email: "kevin@gymprofitness.nl", telefoon: "06-78912345", waarde: 6500, status: "contact", bron: "referral", notities: "Via SportFusion doorverwezen. Wil een ledenadministratie met app.", volgendeActie: "Technische intake plannen", volgendeActieDatum: "2026-04-05", aangemaaktDoor: semId },
    ])
    .returning();

  // Lead activiteiten
  await db.insert(leadActiviteiten).values([
    { leadId: insertedLeads[0].id, gebruikerId: semId, type: "notitie_toegevoegd", titel: "Eerste contactmoment", omschrijving: "Contactformulier ingevuld op website. Geïnteresseerd in bestelsysteem." },
    { leadId: insertedLeads[1].id, gebruikerId: semId, type: "gebeld", titel: "Kennismakingsgesprek", omschrijving: "30 minuten gebeld. Wil portfolio site met 3D elementen en animaties." },
    { leadId: insertedLeads[1].id, gebruikerId: semId, type: "email_verstuurd", titel: "Follow-up email", omschrijving: "Samenvatting gesprek en voorbeelden van ons werk gestuurd." },
    { leadId: insertedLeads[2].id, gebruikerId: sybId, type: "vergadering", titel: "Intake meeting", omschrijving: "1 uur op kantoor besproken. Complex platform, meerdere gebruikersrollen." },
    { leadId: insertedLeads[2].id, gebruikerId: sybId, type: "email_verstuurd", titel: "Offerte verstuurd", omschrijving: "Offerte van €12.000 verstuurd voor maaltijdbezorgplatform." },
    { leadId: insertedLeads[3].id, gebruikerId: semId, type: "status_gewijzigd", titel: "Lead gewonnen", omschrijving: "Contract getekend voor website met afsprakenplanner. Start april 2026." },
    { leadId: insertedLeads[4].id, gebruikerId: sybId, type: "vergadering", titel: "Demo en presentatie", omschrijving: "Demo gegeven van GreenLogic dashboard als referentie. Zeer geïnteresseerd." },
    { leadId: insertedLeads[5].id, gebruikerId: sybId, type: "status_gewijzigd", titel: "Lead verloren", omschrijving: "Budget past niet, doorverwezen naar SaaS-oplossing." },
    { leadId: insertedLeads[6].id, gebruikerId: semId, type: "gebeld", titel: "Introductiegesprek", omschrijving: "Via Lisa van SportFusion geïntroduceerd. Wil vergelijkbare features." },
  ]);

  // ──────────────────────────────────────────────
  // 12. Notificaties (7)
  // ──────────────────────────────────────────────
  await db.insert(notificaties).values([
    { gebruikerId: semId, type: "factuur_te_laat", titel: "Factuur AUT-2026-011 is verlopen", omschrijving: "SportFusion heeft factuur AUT-2026-011 niet betaald. Vervaldatum was 19 februari.", link: "/facturatie", gelezen: 0 },
    { gebruikerId: sybId, type: "factuur_te_laat", titel: "Factuur AUT-2026-012 is verlopen", omschrijving: "GreenLogic BV heeft factuur AUT-2026-012 niet betaald. Vervaldatum was 7 maart.", link: "/facturatie", gelezen: 0 },
    { gebruikerId: semId, type: "deadline_nadert", titel: "Deadline: Bakkerij Bestelsysteem", omschrijving: "Het Online Bestelsysteem voor Bakkerij van Dijk heeft deadline op 31 maart.", link: "/projecten", gelezen: 1 },
    { gebruikerId: semId, type: "factuur_betaald", titel: "Factuur AUT-2026-004 betaald", omschrijving: "SportFusion heeft factuur AUT-2026-004 van €3.448,50 betaald.", link: "/facturatie", gelezen: 1 },
    { gebruikerId: sybId, type: "taak_toegewezen", titel: "Nieuwe taak: Contactformulier met validatie", omschrijving: "Sem heeft je de taak 'Contactformulier met validatie' toegewezen voor Veldhuis Architecten.", link: "/taken", gelezen: 0 },
    { gebruikerId: semId, type: "belasting_deadline", titel: "BTW-aangifte Q1 2026", omschrijving: "De BTW-aangifte over Q1 2026 moet voor 30 april worden ingediend.", link: "/belasting", gelezen: 0 },
    { gebruikerId: semId, type: "offerte_geaccepteerd", titel: "Offerte OFF-2026-001 geaccepteerd", omschrijving: "Veldhuis Architecten heeft de offerte voor BIM Viewer Integratie geaccepteerd.", link: "/offertes", gelezen: 1 },
  ]);

  // ──────────────────────────────────────────────
  // 13. Agenda items (16)
  // ──────────────────────────────────────────────
  await db.insert(agendaItems).values([
    { gebruikerId: semId, titel: "Team standup", type: "afspraak", startDatum: "2026-03-30T09:00:00", eindDatum: "2026-03-30T09:30:00", omschrijving: "Wekelijkse team standup" },
    { gebruikerId: sybId, titel: "Team standup", type: "afspraak", startDatum: "2026-03-30T09:00:00", eindDatum: "2026-03-30T09:30:00", omschrijving: "Wekelijkse team standup" },
    { gebruikerId: semId, titel: "Klantoverleg Veldhuis Architecten", type: "afspraak", startDatum: "2026-03-30T10:30:00", eindDatum: "2026-03-30T11:30:00", omschrijving: "Voortgangsbespreking website redesign" },
    { gebruikerId: sybId, titel: "Sprint planning GreenLogic", type: "afspraak", startDatum: "2026-03-30T14:00:00", eindDatum: "2026-03-30T15:00:00", omschrijving: "Planning volgende sprint dashboard development" },
    { gebruikerId: semId, titel: "Deadline: Bakkerij Bestelsysteem", type: "deadline", startDatum: "2026-03-31T00:00:00", heleDag: 1, omschrijving: "Oplevering online bestelsysteem Bakkerij van Dijk" },
    { gebruikerId: semId, titel: "Kennismakingsgesprek Keurslager Hendriks", type: "afspraak", startDatum: "2026-04-02T11:00:00", eindDatum: "2026-04-02T12:00:00", omschrijving: "Eerste gesprek over online bestelsysteem" },
    { gebruikerId: sybId, titel: "Demo Van Leeuwen Transport", type: "afspraak", startDatum: "2026-04-03T14:00:00", eindDatum: "2026-04-03T15:30:00", omschrijving: "Demo fleet management dashboard" },
    { gebruikerId: semId, titel: "Team standup", type: "afspraak", startDatum: "2026-04-06T09:00:00", eindDatum: "2026-04-06T09:30:00" },
    { gebruikerId: sybId, titel: "Team standup", type: "afspraak", startDatum: "2026-04-06T09:00:00", eindDatum: "2026-04-06T09:30:00" },
    { gebruikerId: semId, titel: "Voortgangsoverleg SportFusion", type: "afspraak", startDatum: "2026-04-01T14:00:00", eindDatum: "2026-04-01T15:00:00", omschrijving: "Sprint review en planning" },
    { gebruikerId: semId, titel: "Technische intake GymPro Fitness", type: "afspraak", startDatum: "2026-04-05T10:00:00", eindDatum: "2026-04-05T11:30:00", omschrijving: "Technische requirements bespreken" },
    { gebruikerId: sybId, titel: "Bakkerij van Dijk - Go-live support", type: "afspraak", startDatum: "2026-03-31T10:00:00", eindDatum: "2026-03-31T12:00:00", omschrijving: "Ondersteuning bij lancering bestelsysteem" },
    { gebruikerId: semId, titel: "BTW-aangifte Q1 deadline", type: "belasting", startDatum: "2026-04-30T00:00:00", heleDag: 1, omschrijving: "BTW-aangifte Q1 2026 moet ingediend zijn" },
    { gebruikerId: semId, titel: "Offerte opvolgen FreshFood", type: "herinnering", startDatum: "2026-04-01T09:00:00", omschrijving: "Offerte opvolgen bij Mohammed van FreshFood Delivery" },
    { gebruikerId: sybId, titel: "Code review Nextera portaal", type: "afspraak", startDatum: "2026-04-02T09:30:00", eindDatum: "2026-04-02T10:30:00", omschrijving: "Code review van project overzicht pagina" },
    { gebruikerId: semId, titel: "Deadline: Veldhuis Website", type: "deadline", startDatum: "2026-04-15T00:00:00", heleDag: 1, omschrijving: "Oplevering website redesign Veldhuis Architecten" },
  ]);

  // ──────────────────────────────────────────────
  // 14. Offertes (5) + offerteRegels
  // ──────────────────────────────────────────────
  const insertedOffertes = await db
    .insert(offertes)
    .values([
      {
        klantId: kVeldhuis.id, projectId: pVeldhuisBIM.id, offertenummer: "OFF-2026-001",
        titel: "BIM Viewer Integratie", status: "geaccepteerd",
        datum: "2026-01-10", geldigTot: "2026-02-10",
        bedragExclBtw: 5700, btwPercentage: 21, btwBedrag: 1197, bedragInclBtw: 6897,
        type: "per_uur", scope: "Ontwikkeling van een 3D BIM viewer voor de Veldhuis website",
        deliverables: "3D viewer component, IFC import, navigatie tools",
        tijdlijn: "8 weken", aangemaaktDoor: semId, geaccepteerdOp: "2026-01-25",
      },
      {
        klantId: kSportFusion.id, projectId: pSportFusionBackend.id, offertenummer: "OFF-2026-002",
        titel: "Mobile App Backend - Fase 2", status: "verzonden",
        datum: "2026-03-15", geldigTot: "2026-04-15",
        bedragExclBtw: 8550, btwPercentage: 21, btwBedrag: 1795.50, bedragInclBtw: 10345.50,
        type: "fixed", scope: "Push notificaties, Stripe subscriptions en admin panel",
        deliverables: "Push service, betaalintegratie, admin dashboard",
        tijdlijn: "10 weken", aangemaaktDoor: semId,
      },
      {
        klantId: kNextera.id, projectId: pNexteraPortal.id, offertenummer: "OFF-2026-003",
        titel: "Klantportaal - Uitbreiding", status: "concept",
        datum: "2026-03-20", geldigTot: "2026-04-20",
        bedragExclBtw: 6650, btwPercentage: 21, btwBedrag: 1396.50, bedragInclBtw: 8046.50,
        type: "per_uur", scope: "Facturatie module, document sharing en notificaties",
        tijdlijn: "6 weken", aangemaaktDoor: semId,
      },
      {
        klantId: kGoudenDraak.id, offertenummer: "OFF-2026-004",
        titel: "Online Bestelmodule", status: "verzonden",
        datum: "2026-03-18", geldigTot: "2026-04-18",
        bedragExclBtw: 4250, btwPercentage: 21, btwBedrag: 892.50, bedragInclBtw: 5142.50,
        type: "fixed", scope: "Bestelmodule voor afhaal en bezorging gekoppeld aan reserveringssysteem",
        tijdlijn: "5 weken", aangemaaktDoor: sybId,
      },
      {
        klantId: kVanDenBerg.id, projectId: pVdBergPortal.id, offertenummer: "OFF-2026-005",
        titel: "Clientportaal Advocaten", status: "verlopen",
        datum: "2026-01-05", geldigTot: "2026-02-05",
        bedragExclBtw: 7350, btwPercentage: 21, btwBedrag: 1543.50, bedragInclBtw: 8893.50,
        type: "per_uur", scope: "Beveiligd portaal voor delen van juridische documenten met cliënten",
        tijdlijn: "12 weken", aangemaaktDoor: semId,
      },
    ])
    .returning();

  // Offerte regels
  await db.insert(offerteRegels).values([
    // OFF-2026-001
    { offerteId: insertedOffertes[0].id, omschrijving: "3D BIM Viewer development", aantal: 40, eenheidsprijs: 95, totaal: 3800 },
    { offerteId: insertedOffertes[0].id, omschrijving: "IFC bestandsformaat import", aantal: 12, eenheidsprijs: 95, totaal: 1140 },
    { offerteId: insertedOffertes[0].id, omschrijving: "UI/UX en testen", aantal: 8, eenheidsprijs: 95, totaal: 760 },
    // OFF-2026-002
    { offerteId: insertedOffertes[1].id, omschrijving: "Push notificaties service", aantal: 30, eenheidsprijs: 95, totaal: 2850 },
    { offerteId: insertedOffertes[1].id, omschrijving: "Stripe subscription integratie", aantal: 35, eenheidsprijs: 95, totaal: 3325 },
    { offerteId: insertedOffertes[1].id, omschrijving: "Admin panel", aantal: 25, eenheidsprijs: 95, totaal: 2375 },
    // OFF-2026-003
    { offerteId: insertedOffertes[2].id, omschrijving: "Facturatie module", aantal: 25, eenheidsprijs: 95, totaal: 2375 },
    { offerteId: insertedOffertes[2].id, omschrijving: "Document sharing systeem", aantal: 20, eenheidsprijs: 95, totaal: 1900 },
    { offerteId: insertedOffertes[2].id, omschrijving: "Notificaties en email", aantal: 15, eenheidsprijs: 95, totaal: 1425 },
    { offerteId: insertedOffertes[2].id, omschrijving: "Gebruikerstraining", aantal: 10, eenheidsprijs: 95, totaal: 950, isOptioneel: 1 },
    // OFF-2026-004
    { offerteId: insertedOffertes[3].id, omschrijving: "Bestelmodule frontend", aantal: 25, eenheidsprijs: 85, totaal: 2125 },
    { offerteId: insertedOffertes[3].id, omschrijving: "Bezorglogica en koppeling", aantal: 15, eenheidsprijs: 85, totaal: 1275 },
    { offerteId: insertedOffertes[3].id, omschrijving: "Testen en oplevering", aantal: 10, eenheidsprijs: 85, totaal: 850 },
    // OFF-2026-005
    { offerteId: insertedOffertes[4].id, omschrijving: "Portaal architectuur en auth", aantal: 20, eenheidsprijs: 105, totaal: 2100 },
    { offerteId: insertedOffertes[4].id, omschrijving: "Document delen en versiebeheer", aantal: 30, eenheidsprijs: 105, totaal: 3150 },
    { offerteId: insertedOffertes[4].id, omschrijving: "Notificaties en audit trail", aantal: 20, eenheidsprijs: 105, totaal: 2100 },
  ]);

  // ──────────────────────────────────────────────
  // 15. Meetings (6)
  // ──────────────────────────────────────────────
  await db.insert(meetings).values([
    {
      klantId: kVeldhuis.id, projectId: pVeldhuisWebsite.id,
      titel: "Kickoff Website Redesign",
      datum: "2026-01-05T10:00:00", duurMinuten: 60,
      transcript: "Marieke: We willen een moderne uitstraling die onze architectuurprojecten goed laat zien.\nSem: We stellen een portfolio-gebaseerd design voor met grote afbeeldingen en 3D elementen.\nMarieke: Dat klinkt perfect. De huidige site is echt verouderd.\nSem: We beginnen met wireframes volgende week.",
      samenvatting: "Kickoff meeting voor de website redesign van Veldhuis Architecten. Klant wil een moderne, portfolio-gerichte website die hun architectuurprojecten goed presenteert. Akkoord op design-first aanpak met wireframes als eerste stap.",
      actiepunten: JSON.stringify(["Wireframes maken voor homepage en portfolio", "Brandguide opvragen bij Marieke", "Concurrentieanalyse uitvoeren"]),
      besluiten: JSON.stringify(["Next.js als framework", "Headless CMS voor contentbeheer", "Deadline 15 april 2026"]),
      status: "klaar", aangemaaktDoor: semId,
    },
    {
      klantId: kGreenLogic.id, projectId: pGreenDashboard.id,
      titel: "Sprint Review Dashboard",
      datum: "2026-02-17T14:00:00", duurMinuten: 45,
      transcript: "Thomas: De CO2-grafiek ziet er geweldig uit. Kunnen we ook een vergelijking per route toevoegen?\nSyb: Ja, dat kan ik in de volgende sprint meenemen.\nThomas: En de real-time data, wanneer is dat klaar?\nSyb: Dat staat gepland voor sprint 4, over 2 weken.",
      samenvatting: "Sprint review van het logistiek dashboard. Klant is tevreden met de CO2-reductie grafiek. Verzoek om route-vergelijking feature. Real-time data wordt in sprint 4 opgepakt.",
      actiepunten: JSON.stringify(["Route-vergelijking toevoegen aan backlog", "Real-time websocket verbinding bouwen", "Performance tests uitvoeren"]),
      besluiten: JSON.stringify(["Route-vergelijking als P2 feature", "Real-time data in sprint 4"]),
      status: "klaar", aangemaaktDoor: sybId,
    },
    {
      klantId: kGoudenDraak.id, projectId: pGoudenDraakRes.id,
      titel: "Oplevering Reserveringssysteem",
      datum: "2026-02-13T14:00:00", duurMinuten: 90,
      transcript: "Wei: Het systeem werkt fantastisch. Onze gastheren zijn er blij mee.\nSyb: Fijn om te horen. Er zijn nog een paar kleine puntjes die ik morgen afhandel.\nWei: Kunnen jullie ook een bestelmodule maken voor afhaal?\nSyb: Daar kan ik een offerte voor opstellen.",
      samenvatting: "Succesvolle oplevering van het reserveringssysteem. Klant is zeer tevreden. Nieuwe lead voor bestelmodule voor afhaal en bezorging.",
      actiepunten: JSON.stringify(["Laatste bugfixes afhandelen", "Offerte opstellen voor bestelmodule", "Handleiding schrijven voor personeel"]),
      besluiten: JSON.stringify(["Systeem live op alle 4 locaties", "Offerte voor bestelmodule volgt"]),
      status: "klaar", aangemaaktDoor: sybId,
    },
    {
      klantId: kSportFusion.id, projectId: pSportFusionBackend.id,
      titel: "Sprint Review Backend API",
      datum: "2026-03-09T14:00:00", duurMinuten: 90,
      transcript: "Lisa: De auth werkt goed, maar we hebben ook social login nodig.\nSem: Dat kan ik toevoegen. Google en Apple Sign-In?\nLisa: Precies. En de workout tracking, hoe ver zijn we?\nSem: De basis endpoints zijn klaar. Deze sprint voeg ik progress tracking toe.",
      samenvatting: "Sprint review met SportFusion. Auth module is af, social login (Google/Apple) wordt toegevoegd. Workout tracking basis is klaar, progress tracking volgt deze sprint.",
      actiepunten: JSON.stringify(["Social login toevoegen", "Progress tracking endpoints bouwen", "API documentatie bijwerken"]),
      besluiten: JSON.stringify(["Social login wordt P1 voor volgende sprint", "Beta launch gepland voor mei"]),
      status: "klaar", aangemaaktDoor: semId,
    },
    {
      klantId: kVanDenBerg.id, projectId: pVdBergDocs.id,
      titel: "Voortgangsoverleg DMS",
      datum: "2026-03-11T10:00:00", duurMinuten: 60,
      transcript: "Richard: De PDF viewer is een goede start. We hebben ook annotatie-functionaliteit nodig.\nSem: Dat is al in development. Verwacht het volgende week.\nRichard: En de zoekfunctie? Onze advocaten zoeken veel op dossiernummer.\nSem: Full-text search met filtering op dossiernummer komt in de volgende sprint.",
      samenvatting: "Voortgangsbespreking Document Management Systeem. PDF viewer is in gebruik, annotaties volgen snel. Zoekfunctie met dossiernummer filtering wordt hoge prioriteit.",
      actiepunten: JSON.stringify(["Annotaties afmaken", "Full-text search met dossiernummer filter", "Security review plannen"]),
      besluiten: JSON.stringify(["Zoekfunctie wordt prioriteit", "Security audit voordat DMS live gaat"]),
      status: "klaar", aangemaaktDoor: semId,
    },
    {
      klantId: kBakkerij.id, projectId: pBakkerijBestel.id,
      titel: "UAT Bestelsysteem",
      datum: "2026-03-16T14:00:00", duurMinuten: 120,
      transcript: "Hans: Het bestellen werkt prima. Maar mijn medewerkers vinden het overzicht van bestellingen wat onoverzichtelijk.\nSyb: Ik pas de layout aan. Grotere knoppen en een betere filtering.\nHans: Kunnen we ook een dagrapport krijgen?\nSyb: Dat kan ik in de bevestigingsmail flow meenemen.",
      samenvatting: "User Acceptance Testing met bakkerij medewerkers. Bestelfunctionaliteit werkt goed, layout van bestellingsoverzicht wordt verbeterd. Dagrapport functie wordt toegevoegd.",
      actiepunten: JSON.stringify(["Layout bestellingsoverzicht verbeteren", "Dagrapport email toevoegen", "Go-live plannen voor 31 maart"]),
      besluiten: JSON.stringify(["Go-live op 31 maart", "Twee weken support na lancering"]),
      status: "klaar", aangemaaktDoor: sybId,
    },
  ]);

  // ──────────────────────────────────────────────
  // 16. Wiki artikelen (6)
  // ──────────────────────────────────────────────
  await db.insert(wikiArtikelen).values([
    {
      titel: "Onboarding Nieuw Project",
      inhoud: "# Onboarding Nieuw Project\n\n## Stappen\n1. **Intake gesprek** - Requirements verzamelen\n2. **Offerte** - Offerte opstellen en versturen\n3. **Contract** - Samenwerkingsovereenkomst tekenen\n4. **Kickoff** - Kickoff meeting plannen\n5. **Setup** - Repository, hosting en tools opzetten\n6. **Design** - Wireframes en mockups maken\n7. **Development** - Sprints plannen en starten\n\n## Checklists\n- [ ] GitHub repository aangemaakt\n- [ ] Vercel project opgezet\n- [ ] Klant in dashboard aangemaakt\n- [ ] Eerste sprint gepland\n- [ ] Slack kanaal aangemaakt",
      categorie: "processen",
      tags: JSON.stringify(["onboarding", "proces", "checklist"]),
      auteurId: semId,
      gepubliceerd: 1,
    },
    {
      titel: "Deployment Process",
      inhoud: "# Deployment Process\n\n## Production Deploy\n1. Merge PR naar `main` branch\n2. Vercel bouwt automatisch\n3. Preview deploy checken\n4. Promote naar production\n\n## Rollback\n- Via Vercel dashboard: Deployments > kies vorige deploy > Promote\n- Of: `git revert` en nieuwe deploy\n\n## Environment Variables\n- Production secrets staan in Vercel\n- Nooit secrets in code committen\n- `.env.example` altijd bijwerken",
      categorie: "technisch",
      tags: JSON.stringify(["deployment", "vercel", "git"]),
      auteurId: semId,
      gepubliceerd: 1,
    },
    {
      titel: "Code Review Richtlijnen",
      inhoud: "# Code Review Richtlijnen\n\n## Voordat je een PR maakt\n- TypeScript strict mode, geen `any`\n- Alle tests groen\n- Geen `console.log` in productie code\n- Zelfbeschrijvende variabelenamen\n\n## Review Checklist\n- [ ] Logica klopt\n- [ ] Edge cases afgehandeld\n- [ ] Geen security issues\n- [ ] Performance ok\n- [ ] Toegankelijkheid gecontroleerd\n\n## Conventies\n- Code in het Engels\n- UI-teksten in het Nederlands\n- Commit messages in het Engels",
      categorie: "technisch",
      tags: JSON.stringify(["code-review", "kwaliteit", "standaarden"]),
      auteurId: semId,
      gepubliceerd: 1,
    },
    {
      titel: "Facturatie Proces",
      inhoud: "# Facturatie Proces\n\n## Wanneer factureren\n- Bij afronding van een sprint/milestone\n- Maandelijks voor lopende projecten\n- Bij oplevering voor fixed-price projecten\n\n## Stappen\n1. Uren controleren in tijdregistratie\n2. Factuur aanmaken in dashboard\n3. Factuurregels toevoegen\n4. Review door Sem\n5. Versturen naar klant\n6. Betaling opvolgen na 14 dagen\n\n## Betalingstermijn\n- Standaard: 30 dagen\n- Herinnering na 7 dagen te laat\n- Tweede herinnering na 14 dagen",
      categorie: "financien",
      tags: JSON.stringify(["facturatie", "proces", "betalingen"]),
      auteurId: semId,
      gepubliceerd: 1,
    },
    {
      titel: "Tech Stack Overzicht",
      inhoud: "# Tech Stack\n\n## Frontend\n- **Next.js 14** - React framework\n- **Tailwind CSS** - Styling\n- **shadcn/ui** - Component library\n- **Framer Motion** - Animaties\n\n## Backend\n- **Next.js API Routes** - Server endpoints\n- **Drizzle ORM** - Database\n- **SQLite / Turso** - Database engine\n\n## Hosting & Infra\n- **Vercel** - Frontend hosting\n- **AWS** - File storage (S3)\n- **GitHub** - Version control\n\n## AI\n- **Anthropic Claude** - AI features\n- **OpenAI** - Embeddings",
      categorie: "technisch",
      tags: JSON.stringify(["tech-stack", "tools", "architectuur"]),
      auteurId: semId,
      gepubliceerd: 1,
    },
    {
      titel: "Klantcommunicatie Richtlijnen",
      inhoud: "# Klantcommunicatie\n\n## Tone of Voice\n- Professioneel maar toegankelijk\n- Geen jargon, leg technische zaken uit\n- Proactief communiceren over voortgang\n\n## Kanalen\n- **Slack** - dagelijkse communicatie\n- **Email** - formele communicatie, offertes, facturen\n- **Videocall** - sprint reviews, demo's\n\n## Frequentie\n- Wekelijkse update per project\n- Direct bij blokkades of vertragingen\n- Sprint review elke 2 weken",
      categorie: "klanten",
      tags: JSON.stringify(["communicatie", "klanten", "richtlijnen"]),
      auteurId: sybId,
      gepubliceerd: 1,
    },
  ]);

  // ──────────────────────────────────────────────
  // 17. Ideeën (9)
  // ──────────────────────────────────────────────
  await db.insert(ideeen).values([
    { nummer: 1, naam: "AI Klantenportaal", categorie: "klant_verkoop", status: "uitgewerkt", omschrijving: "Portaal waar klanten real-time projectstatus, facturen en communicatie kunnen zien", prioriteit: "hoog", aiScore: 87, aiHaalbaarheid: 82, aiMarktpotentie: 90, aiFitAutronis: 88, doelgroep: "Bestaande klanten", verdienmodel: "Upsell bij elk project", impact: 9, effort: 7, revenuePotential: 8, aangemaaktDoor: semId },
    { nummer: 2, naam: "Automatische Offerte Generator", categorie: "intern", status: "actief", omschrijving: "AI genereert offertes op basis van intake formulier en vergelijkbare projecten", prioriteit: "hoog", aiScore: 91, aiHaalbaarheid: 75, aiMarktpotentie: 85, aiFitAutronis: 95, impact: 8, effort: 6, revenuePotential: 7, aangemaaktDoor: semId },
    { nummer: 3, naam: "Wekelijkse AI Rapporten", categorie: "dashboard", status: "idee", omschrijving: "Automatisch gegenereerde wekelijkse rapportages per project voor klanten", prioriteit: "normaal", aiScore: 78, aiHaalbaarheid: 88, aiMarktpotentie: 72, aiFitAutronis: 80, impact: 6, effort: 4, revenuePotential: 5, aangemaaktDoor: sybId },
    { nummer: 4, naam: "White-label Dashboard", categorie: "geld_groei", status: "idee", omschrijving: "Ons dashboard als white-label SaaS product voor andere agencies", prioriteit: "normaal", aiScore: 83, aiHaalbaarheid: 60, aiMarktpotentie: 92, aiFitAutronis: 70, doelgroep: "Kleine agencies en freelancers", verdienmodel: "SaaS abonnement €49-149/maand", impact: 10, effort: 9, revenuePotential: 10, aangemaaktDoor: semId },
    { nummer: 5, naam: "Meeting Transcriptie Bot", categorie: "dev_tools", status: "gebouwd", omschrijving: "Automatische transcriptie en samenvatting van klantmeetings", prioriteit: "hoog", aiScore: 92, aiHaalbaarheid: 95, aiMarktpotentie: 80, aiFitAutronis: 90, projectId: pIntern.id, impact: 8, effort: 3, revenuePotential: 6, aangemaaktDoor: semId },
    { nummer: 6, naam: "Freelancer Marktplaats", categorie: "experimenteel", status: "idee", omschrijving: "Platform om freelancers te matchen met projecten die we niet zelf kunnen doen", prioriteit: "laag", aiScore: 55, aiHaalbaarheid: 45, aiMarktpotentie: 65, aiFitAutronis: 40, impact: 5, effort: 8, revenuePotential: 6, aangemaaktDoor: sybId },
    { nummer: 7, naam: "SEO Audit Tool", categorie: "klant_verkoop", status: "idee", omschrijving: "Geautomatiseerde SEO audits als lead magnet en upsell service", prioriteit: "normaal", aiScore: 74, aiHaalbaarheid: 80, aiMarktpotentie: 75, aiFitAutronis: 72, doelgroep: "MKB zonder online strategie", verdienmodel: "Gratis audit → betaalde optimalisatie", impact: 6, effort: 5, revenuePotential: 7, aangemaaktDoor: semId },
    { nummer: 8, naam: "AI Chatbot voor Klantensites", categorie: "klant_verkoop", status: "uitgewerkt", omschrijving: "Custom AI chatbot die klanten kunnen plaatsen op hun website", prioriteit: "hoog", aiScore: 88, aiHaalbaarheid: 85, aiMarktpotentie: 88, aiFitAutronis: 82, doelgroep: "Alle klanten", verdienmodel: "€99/maand per chatbot + setup fee", impact: 8, effort: 5, revenuePotential: 9, aangemaaktDoor: semId },
    { nummer: 9, naam: "Social Media Content Generator", categorie: "content_media", status: "idee", omschrijving: "AI-gestuurde content creatie voor LinkedIn en Instagram", prioriteit: "laag", aiScore: 68, aiHaalbaarheid: 90, aiMarktpotentie: 60, aiFitAutronis: 65, impact: 4, effort: 4, revenuePotential: 5, aangemaaktDoor: sybId },
  ]);

  // ──────────────────────────────────────────────
  // 18. Belasting data
  // ──────────────────────────────────────────────
  await db.insert(belastingDeadlines).values([
    { type: "btw", omschrijving: "BTW-aangifte Q4 2025", datum: "2026-01-31", kwartaal: 4, jaar: 2025, afgerond: 1, notities: "Op tijd ingediend" },
    { type: "btw", omschrijving: "BTW-aangifte Q1 2026", datum: "2026-04-30", kwartaal: 1, jaar: 2026, afgerond: 0 },
    { type: "btw", omschrijving: "BTW-aangifte Q2 2026", datum: "2026-07-31", kwartaal: 2, jaar: 2026, afgerond: 0 },
    { type: "inkomstenbelasting", omschrijving: "Inkomstenbelasting 2025", datum: "2026-05-01", jaar: 2025, afgerond: 0, notities: "Accountant is bezig met voorbereiding" },
    { type: "kvk_publicatie", omschrijving: "KvK jaarrekening 2025", datum: "2026-07-31", jaar: 2025, afgerond: 0 },
  ]);

  await db.insert(btwAangiftes).values([
    { kwartaal: 4, jaar: 2025, btwOntvangen: 3250, btwBetaald: 420, btwAfdragen: 2830, status: "betaald", ingediendOp: "2026-01-28" },
    { kwartaal: 1, jaar: 2026, btwOntvangen: 4680.75, btwBetaald: 66.08, btwAfdragen: 4614.67, status: "open", notities: "Moet nog worden berekend en ingediend" },
  ]);

  await db.insert(urenCriterium).values([
    { gebruikerId: semId, jaar: 2026, doelUren: 1225, behaaldUren: 312, zelfstandigenaftrek: 0, mkbVrijstelling: 0 },
    { gebruikerId: sybId, jaar: 2026, doelUren: 1225, behaaldUren: 298, zelfstandigenaftrek: 0, mkbVrijstelling: 0 },
  ]);

  await db.insert(kilometerRegistraties).values([
    { gebruikerId: semId, datum: "2026-01-05", vanLocatie: "Thuiskantoor Amstelveen", naarLocatie: "Veldhuis Architecten, Amsterdam", kilometers: 12.5, isRetour: 1, zakelijkDoel: "Kickoff meeting website redesign", doelType: "klantbezoek", klantId: kVeldhuis.id, projectId: pVeldhuisWebsite.id },
    { gebruikerId: sybId, datum: "2026-01-14", vanLocatie: "Thuiskantoor Groningen", naarLocatie: "Bakkerij van Dijk, Vleuten", kilometers: 195, isRetour: 1, zakelijkDoel: "Intake bestelsysteem", doelType: "klantbezoek", klantId: kBakkerij.id, projectId: pBakkerijBestel.id },
    { gebruikerId: semId, datum: "2026-02-06", vanLocatie: "Thuiskantoor Amstelveen", naarLocatie: "Nextera Solutions, Utrecht", kilometers: 42, isRetour: 1, zakelijkDoel: "Klantoverleg portaal", doelType: "klantbezoek", klantId: kNextera.id, projectId: pNexteraPortal.id },
    { gebruikerId: sybId, datum: "2026-02-13", vanLocatie: "Thuiskantoor Groningen", naarLocatie: "De Gouden Draak, Amsterdam", kilometers: 185, isRetour: 1, zakelijkDoel: "Oplevering reserveringssysteem", doelType: "klantbezoek", klantId: kGoudenDraak.id, projectId: pGoudenDraakRes.id },
    { gebruikerId: semId, datum: "2026-03-11", vanLocatie: "Thuiskantoor Amstelveen", naarLocatie: "Van den Berg Advocaten, Rotterdam", kilometers: 78, isRetour: 1, zakelijkDoel: "Voortgangsoverleg DMS", doelType: "klantbezoek", klantId: kVanDenBerg.id, projectId: pVdBergDocs.id },
    { gebruikerId: semId, datum: "2026-03-15", vanLocatie: "Thuiskantoor Amstelveen", naarLocatie: "Boekhouder Dekker, Amsterdam", kilometers: 8, isRetour: 1, zakelijkDoel: "Kwartaalbespreking boekhouding", doelType: "boekhouder" },
  ]);

  // ──────────────────────────────────────────────
  // 19. Doelen
  // ──────────────────────────────────────────────
  await db.insert(doelen).values([
    { gebruikerId: semId, type: "omzet", maand: 1, jaar: 2026, doelwaarde: 8000, huidigeWaarde: 7450 },
    { gebruikerId: semId, type: "omzet", maand: 2, jaar: 2026, doelwaarde: 10000, huidigeWaarde: 9850 },
    { gebruikerId: semId, type: "omzet", maand: 3, jaar: 2026, doelwaarde: 12000, huidigeWaarde: 8200 },
    { gebruikerId: sybId, type: "omzet", maand: 1, jaar: 2026, doelwaarde: 7000, huidigeWaarde: 6800 },
    { gebruikerId: sybId, type: "omzet", maand: 2, jaar: 2026, doelwaarde: 8000, huidigeWaarde: 7950 },
    { gebruikerId: sybId, type: "omzet", maand: 3, jaar: 2026, doelwaarde: 9000, huidigeWaarde: 6400 },
    { gebruikerId: semId, type: "uren", maand: 1, jaar: 2026, doelwaarde: 140, huidigeWaarde: 132 },
    { gebruikerId: semId, type: "uren", maand: 2, jaar: 2026, doelwaarde: 140, huidigeWaarde: 138 },
    { gebruikerId: semId, type: "uren", maand: 3, jaar: 2026, doelwaarde: 140, huidigeWaarde: 98 },
    { gebruikerId: sybId, type: "uren", maand: 1, jaar: 2026, doelwaarde: 130, huidigeWaarde: 125 },
    { gebruikerId: sybId, type: "uren", maand: 2, jaar: 2026, doelwaarde: 130, huidigeWaarde: 128 },
    { gebruikerId: sybId, type: "uren", maand: 3, jaar: 2026, doelwaarde: 130, huidigeWaarde: 92 },
  ]);

  // ──────────────────────────────────────────────
  // 20. Investeringen
  // ──────────────────────────────────────────────
  await db.insert(investeringen).values([
    { naam: "MacBook Pro 16\" M4 Max", bedrag: 3999, datum: "2025-09-01", categorie: "hardware", afschrijvingstermijn: 5, restwaarde: 400, notities: "Primaire werkstation Sem", aangemaaktDoor: semId },
    { naam: "Dell UltraSharp 32\" 4K Monitor", bedrag: 749, datum: "2025-10-15", categorie: "hardware", afschrijvingstermijn: 5, restwaarde: 50, notities: "Externe monitor voor thuiskantoor", aangemaaktDoor: semId },
    { naam: "MacBook Pro 14\" M4 Pro", bedrag: 2499, datum: "2025-11-01", categorie: "hardware", afschrijvingstermijn: 5, restwaarde: 300, notities: "Werkstation Syb", aangemaaktDoor: sybId },
    { naam: "Herman Miller Aeron Bureaustoel", bedrag: 1395, datum: "2026-01-15", categorie: "inventaris", afschrijvingstermijn: 5, restwaarde: 200, notities: "Ergonomische stoel voor thuiskantoor", aangemaaktDoor: semId },
  ]);

  // ──────────────────────────────────────────────
  // 21. Banktransacties (12)
  // ──────────────────────────────────────────────
  await db.insert(bankTransacties).values([
    { datum: "2026-02-10", omschrijving: "Bloem & Blad - Betaling factuur AUT-2026-001", bedrag: 5142.50, type: "bij", categorie: "Omzet", status: "gematcht", gekoppeldFactuurId: insertedFacturen[0].id, bank: "Revolut" },
    { datum: "2026-02-25", omschrijving: "De Gouden Draak - Betaling AUT-2026-002", bedrag: 3872, type: "bij", categorie: "Omzet", status: "gematcht", gekoppeldFactuurId: insertedFacturen[1].id, bank: "Revolut" },
    { datum: "2026-02-28", omschrijving: "Veldhuis Architecten - Betaling AUT-2026-003", bedrag: 4598, type: "bij", categorie: "Omzet", status: "gematcht", gekoppeldFactuurId: insertedFacturen[2].id, bank: "Revolut" },
    { datum: "2026-03-10", omschrijving: "SportFusion - Betaling AUT-2026-004", bedrag: 3448.50, type: "bij", categorie: "Omzet", status: "gematcht", gekoppeldFactuurId: insertedFacturen[3].id, bank: "Revolut" },
    { datum: "2026-03-20", omschrijving: "Bakkerij van Dijk - Betaling AUT-2026-005", bedrag: 4114, type: "bij", categorie: "Omzet", status: "gematcht", gekoppeldFactuurId: insertedFacturen[4].id, bank: "Revolut" },
    { datum: "2026-03-01", omschrijving: "Vercel Inc - Pro Plan", bedrag: 20, type: "af", categorie: "Software", status: "gecategoriseerd", bank: "Revolut", merchantNaam: "Vercel", isAbonnement: 1 },
    { datum: "2026-03-01", omschrijving: "GitHub Inc - Team Plan", bedrag: 19, type: "af", categorie: "Software", status: "gecategoriseerd", bank: "Revolut", merchantNaam: "GitHub", isAbonnement: 1 },
    { datum: "2026-03-03", omschrijving: "Amazon Web Services EMEA", bedrag: 156.40, type: "af", categorie: "Hosting", status: "gecategoriseerd", bank: "Revolut", merchantNaam: "AWS" },
    { datum: "2026-03-05", omschrijving: "Slack Technologies", bedrag: 7.25, type: "af", categorie: "Software", status: "gecategoriseerd", bank: "Revolut", merchantNaam: "Slack", isAbonnement: 1 },
    { datum: "2026-03-08", omschrijving: "Anthropic PBC", bedrag: 85, type: "af", categorie: "AI", status: "gecategoriseerd", bank: "Revolut", merchantNaam: "Anthropic" },
    { datum: "2026-03-11", omschrijving: "Doppio Espresso Amsterdam", bedrag: 24.50, type: "af", categorie: "Representatie", status: "gecategoriseerd", bank: "Revolut", merchantNaam: "Doppio Espresso" },
    { datum: "2026-03-15", omschrijving: "MediaMarkt Nederland BV", bedrag: 49.95, type: "af", categorie: "Hardware", status: "gecategoriseerd", bank: "Revolut", merchantNaam: "MediaMarkt" },
  ]);

  // ──────────────────────────────────────────────
  // 22. Second Brain items (6)
  // ──────────────────────────────────────────────
  await db.insert(secondBrainItems).values([
    { gebruikerId: semId, type: "url", titel: "Vercel AI SDK Docs", inhoud: "Documentatie voor het bouwen van AI-features met Vercel's AI SDK. Nuttig voor chatbot en AI assistent features.", bronUrl: "https://sdk.vercel.ai/docs", aiSamenvatting: "Vercel AI SDK biedt streaming, tool calling en multi-provider support.", aiTags: JSON.stringify(["ai", "vercel", "sdk", "development"]), isFavoriet: 1 },
    { gebruikerId: semId, type: "tekst", titel: "Notities: Pricing Strategie 2026", inhoud: "## Pricing Strategie\n\n- Standaard uurtarief: €95\n- Complex/security werk: €105-120\n- Retainer mogelijkheid: €2000/maand voor 25 uur\n- Fixed price projecten: 15% marge bovenop geschatte uren\n\nOverwegingen:\n- Markt accepteert €95-120 voor senior development\n- Retainer geeft voorspelbare omzet\n- Fixed price risico's mitigeren met goede scope", aiTags: JSON.stringify(["pricing", "strategie", "business"]), isFavoriet: 1 },
    { gebruikerId: sybId, type: "url", titel: "Drizzle ORM Best Practices", inhoud: "Handige patterns voor Drizzle ORM: migrations, relaties, query builders en performance optimalisatie.", bronUrl: "https://orm.drizzle.team/docs/overview", aiSamenvatting: "Drizzle ORM is een TypeScript-first ORM met goede DX en type safety.", aiTags: JSON.stringify(["drizzle", "orm", "database", "typescript"]) },
    { gebruikerId: semId, type: "code", titel: "Stripe Webhook Handler Pattern", inhoud: "```typescript\nexport async function POST(req: Request) {\n  const body = await req.text();\n  const sig = req.headers.get('stripe-signature')!;\n  const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);\n  \n  switch (event.type) {\n    case 'checkout.session.completed':\n      // Handle successful payment\n      break;\n    case 'invoice.paid':\n      // Handle subscription payment\n      break;\n  }\n}\n```", aiSamenvatting: "Stripe webhook handler pattern voor Next.js App Router met signature verificatie.", aiTags: JSON.stringify(["stripe", "webhook", "payment", "nextjs"]), taal: "typescript" },
    { gebruikerId: sybId, type: "tekst", titel: "Klant Interview Framework", inhoud: "## Interview Framework\n\n### Opening (5 min)\n- Bedankt voor de tijd\n- Doel van het gesprek uitleggen\n\n### Huidige Situatie (10 min)\n- Wat is het grootste probleem?\n- Hoe wordt het nu opgelost?\n- Wat kost het huidige proces?\n\n### Gewenste Situatie (10 min)\n- Hoe ziet de ideale oplossing eruit?\n- Wat is het budget?\n- Wanneer moet het af zijn?\n\n### Afsluiting (5 min)\n- Samenvatten\n- Vervolgafspraak plannen", aiTags: JSON.stringify(["interview", "klant", "sales", "framework"]) },
    { gebruikerId: semId, type: "url", titel: "Next.js 15 Server Actions", inhoud: "Overzicht van Server Actions in Next.js 15: form handling, revalidation, optimistic updates.", bronUrl: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations", aiSamenvatting: "Server Actions in Next.js 15 maken form handling en data mutations eenvoudiger zonder API routes.", aiTags: JSON.stringify(["nextjs", "server-actions", "react", "framework"]) },
  ]);

  // ──────────────────────────────────────────────
  // 23. Documenten (6)
  // ──────────────────────────────────────────────
  await db.insert(documenten).values([
    { klantId: kVeldhuis.id, projectId: pVeldhuisWebsite.id, naam: "Samenwerkingsovereenkomst Veldhuis", type: "contract", versie: 1, aangemaaktDoor: semId },
    { klantId: kSportFusion.id, projectId: pSportFusionBackend.id, naam: "Technische Specificatie SportFusion API", type: "overig", versie: 2, aangemaaktDoor: semId },
    { klantId: kVanDenBerg.id, projectId: pVdBergDocs.id, naam: "NDA Van den Berg Advocaten", type: "contract", versie: 1, aangemaaktDoor: semId },
    { klantId: kBakkerij.id, projectId: pBakkerijBestel.id, naam: "Offerte Bestelsysteem v2", type: "offerte", versie: 2, aangemaaktDoor: sybId },
    { klantId: kGreenLogic.id, projectId: pGreenDashboard.id, naam: "Architecture Decision Record - Dashboard", type: "overig", versie: 1, aangemaaktDoor: sybId },
    { klantId: kGoudenDraak.id, projectId: pGoudenDraakRes.id, naam: "Handleiding Reserveringssysteem", type: "overig", versie: 1, aangemaaktDoor: sybId },
  ]);

  // ──────────────────────────────────────────────
  // 24. Team activiteit (12)
  // ──────────────────────────────────────────────
  await db.insert(teamActiviteit).values([
    { gebruikerId: semId, type: "taak_gepakt", projectId: pVeldhuisWebsite.id, taakId: insertedTaken[0].id, bericht: "Begonnen aan homepage hero sectie ontwerpen", aangemaaktOp: "2026-03-16T09:05:00" },
    { gebruikerId: sybId, type: "taak_afgerond", projectId: pBakkerijBestel.id, taakId: insertedTaken[13].id, bericht: "Winkelwagen en checkout flow afgerond", aangemaaktOp: "2026-03-16T11:30:00" },
    { gebruikerId: semId, type: "taak_update", projectId: pGreenAPI.id, taakId: insertedTaken[9].id, bericht: "PostNL API integratie: authenticatie werkt, bezig met tracking endpoints", aangemaaktOp: "2026-03-17T14:00:00" },
    { gebruikerId: sybId, type: "taak_gepakt", projectId: pGreenDashboard.id, bericht: "Fleet management overzicht oppakken", aangemaaktOp: "2026-03-18T09:00:00" },
    { gebruikerId: semId, type: "taak_afgerond", projectId: pSportFusionBackend.id, taakId: insertedTaken[18].id, bericht: "JWT authenticatie volledig geïmplementeerd en getest", aangemaaktOp: "2026-03-18T16:00:00" },
    { gebruikerId: sybId, type: "status_wijziging", projectId: pGoudenDraakRes.id, bericht: "Project Reserveringssysteem: status gewijzigd naar afgerond", aangemaaktOp: "2026-03-19T10:00:00" },
    { gebruikerId: semId, type: "bezig_met", projectId: pVdBergDocs.id, bericht: "Werkt aan PDF viewer annotaties systeem", aangemaaktOp: "2026-03-24T09:15:00" },
    { gebruikerId: sybId, type: "taak_gepakt", projectId: pBloemCRM.id, taakId: insertedTaken[30].id, bericht: "Klantensegmentatie module opgepakt", aangemaaktOp: "2026-03-24T09:30:00" },
    { gebruikerId: semId, type: "taak_update", projectId: pIntern.id, taakId: insertedTaken[32].id, bericht: "Belasting module: BTW-aangifte overzicht klaar, nu aan deadlines", aangemaaktOp: "2026-03-25T15:00:00" },
    { gebruikerId: sybId, type: "taak_update", projectId: pNexteraPortal.id, taakId: insertedTaken[23].id, bericht: "Project overzicht pagina: layout klaar, data fetching in progress", aangemaaktOp: "2026-03-26T11:00:00" },
    { gebruikerId: semId, type: "bezig_met", projectId: pSportFusionBackend.id, bericht: "Workout tracking progress API endpoints bouwen", aangemaaktOp: "2026-03-27T09:00:00" },
    { gebruikerId: sybId, type: "taak_afgerond", projectId: pBakkerijBestel.id, taakId: insertedTaken[15].id, bericht: "Bevestigingsmail templates afgerond met alle varianten", aangemaaktOp: "2026-03-28T14:00:00" },
  ]);

  // ──────────────────────────────────────────────
  // 25. Belasting tips (6)
  // ──────────────────────────────────────────────
  await db.insert(belastingTips).values([
    { categorie: "aftrekpost", titel: "Zelfstandigenaftrek 2026", beschrijving: "Als je aan het urencriterium voldoet (1.225 uur per jaar), heb je recht op de zelfstandigenaftrek van €3.750.", voordeel: "€3.750 aftrek", bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/zelfstandigenaftrek", bronNaam: "Belastingdienst", jaar: 2026 },
    { categorie: "aftrekpost", titel: "Startersaftrek eerste 3 jaar", beschrijving: "Als starter heb je bovenop de zelfstandigenaftrek recht op €2.123 extra aftrek. Dit geldt voor de eerste 5 jaar, maximaal 3 keer.", voordeel: "€2.123 extra aftrek", bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/startersaftrek", bronNaam: "Belastingdienst", jaar: 2026, toegepast: 1, toegepastOp: "2026-01-15" },
    { categorie: "regeling", titel: "Kleinschaligheidsinvesteringsaftrek (KIA)", beschrijving: "Bij investeringen tussen €2.801 en €380.859 heb je recht op een extra aftrek. Voor investeringen tot €68.876 is dit 28% van het investeringsbedrag.", voordeel: "28% aftrek op investeringen", bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/kleinschaligheidsinvesteringsaftrek", bronNaam: "Belastingdienst", jaar: 2026, toegepast: 1, toegepastOp: "2026-02-01" },
    { categorie: "optimalisatie", titel: "Thuiswerkaftrek", beschrijving: "Je kunt een deel van je woonlasten aftrekken als je vanuit huis werkt. Denk aan een proportioneel deel van huur/hypotheek, energie en internet.", voordeel: "Variabel, afhankelijk van werkruimte", bronNaam: "Belastingdienst", jaar: 2026 },
    { categorie: "weetje", titel: "MKB-winstvrijstelling", beschrijving: "14% van de winst na aftrekposten is vrijgesteld van belasting. Dit wordt automatisch berekend.", voordeel: "14% winstvrijstelling", bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/mkb-winstvrijstelling", bronNaam: "Belastingdienst", jaar: 2026 },
    { categorie: "subsidie", titel: "WBSO - R&D fiscaal voordeel", beschrijving: "De WBSO biedt fiscaal voordeel voor R&D werkzaamheden. Als je AI-tools en automatiseringssoftware ontwikkelt, kom je mogelijk in aanmerking.", voordeel: "32% loonkostenaftrek", bron: "https://www.rvo.nl/subsidies-financiering/wbso", bronNaam: "RVO", jaar: 2026 },
  ]);

  console.log("Database seeded successfully with comprehensive demo data!");
  console.log("Summary:");
  console.log("  - 2 users (Sem & Syb)");
  console.log("  - 8 clients");
  console.log("  - 14 projects");
  console.log("  - 35 tasks");
  console.log("  - 55 time entries");
  console.log("  - 12 invoices with line items");
  console.log("  - 5 income records");
  console.log("  - 22 expenses");
  console.log("  - 9 subscriptions");
  console.log("  - 7 leads with activities");
  console.log("  - 7 notifications");
  console.log("  - 16 agenda items");
  console.log("  - 5 quotes with line items");
  console.log("  - 6 meetings with transcripts");
  console.log("  - 6 wiki articles");
  console.log("  - 9 ideas with AI scores");
  console.log("  - Tax data (deadlines, BTW, urencriterium, km)");
  console.log("  - 12 goals (revenue & hours)");
  console.log("  - 4 investments");
  console.log("  - 12 bank transactions");
  console.log("  - 6 second brain items");
  console.log("  - 6 documents");
  console.log("  - 12 team activity entries");
  console.log("  - 6 tax tips");
}
