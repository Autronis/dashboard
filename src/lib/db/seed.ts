import { db } from "./index";
import {
  gebruikers,
  klanten,
  projecten,
  tijdregistraties,
  bedrijfsinstellingen,
} from "./schema";
import bcrypt from "bcrypt";

export async function seed() {
  console.log("Seeding database...");

  // Bedrijfsinstellingen
  await db
    .insert(bedrijfsinstellingen)
    .values({
      id: 1,
      bedrijfsnaam: "Autronis",
    })
    .onConflictDoNothing();

  // Gebruikers
  const wachtwoordHash = await bcrypt.hash("Autronis2026!", 10);

  const [sem] = await db
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
        naam: "Compagnon",
        email: "compagnon@autronis.com",
        wachtwoordHash,
        rol: "gebruiker",
        uurtariefStandaard: 85,
        themaVoorkeur: "donker",
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (!sem) {
    console.log("Users already seeded, skipping...");
    return;
  }

  // Klanten
  const [klant1, klant2, klant3] = await db
    .insert(klanten)
    .values([
      {
        bedrijfsnaam: "TechStart BV",
        contactpersoon: "Jan de Vries",
        email: "jan@techstart.nl",
        telefoon: "06-12345678",
        uurtarief: 95,
        isActief: 1,
        aangemaaktDoor: sem.id,
      },
      {
        bedrijfsnaam: "Retail Plus",
        contactpersoon: "Maria Jansen",
        email: "maria@retailplus.nl",
        telefoon: "06-87654321",
        uurtarief: 85,
        isActief: 1,
        aangemaaktDoor: sem.id,
      },
      {
        bedrijfsnaam: "Bouw & Infra NL",
        contactpersoon: "Pieter Bakker",
        email: "pieter@bouwinfra.nl",
        telefoon: "06-11223344",
        uurtarief: 90,
        isActief: 1,
        aangemaaktDoor: sem.id,
      },
    ])
    .returning();

  // Projecten
  const [project1, project2, project3, project4] = await db
    .insert(projecten)
    .values([
      {
        klantId: klant1.id,
        naam: "Webshop Redesign",
        omschrijving: "Volledige redesign van de webshop inclusief checkout flow",
        status: "actief",
        voortgangPercentage: 65,
        deadline: "2026-04-30",
        geschatteUren: 80,
        werkelijkeUren: 52,
        isActief: 1,
        aangemaaktDoor: sem.id,
      },
      {
        klantId: klant1.id,
        naam: "API Integratie",
        omschrijving: "Koppeling met externe payment provider",
        status: "actief",
        voortgangPercentage: 30,
        deadline: "2026-05-15",
        geschatteUren: 40,
        werkelijkeUren: 12,
        isActief: 1,
        aangemaaktDoor: sem.id,
      },
      {
        klantId: klant2.id,
        naam: "Dashboard Analytics",
        omschrijving: "Business intelligence dashboard voor retail data",
        status: "actief",
        voortgangPercentage: 80,
        deadline: "2026-03-31",
        geschatteUren: 60,
        werkelijkeUren: 48,
        isActief: 1,
        aangemaaktDoor: sem.id,
      },
      {
        klantId: klant3.id,
        naam: "Projectmanagement Tool",
        omschrijving: "Interne tool voor projectplanning en resourcebeheer",
        status: "on-hold",
        voortgangPercentage: 20,
        deadline: "2026-06-30",
        geschatteUren: 120,
        werkelijkeUren: 24,
        isActief: 1,
        aangemaaktDoor: sem.id,
      },
    ])
    .returning();

  // Tijdregistraties
  await db.insert(tijdregistraties).values([
    {
      gebruikerId: sem.id,
      projectId: project1.id,
      omschrijving: "Frontend componenten bouwen",
      startTijd: "2026-03-10T09:00:00",
      eindTijd: "2026-03-10T12:30:00",
      duurMinuten: 210,
      categorie: "development",
      isHandmatig: 0,
    },
    {
      gebruikerId: sem.id,
      projectId: project3.id,
      omschrijving: "Klantoverleg analytics requirements",
      startTijd: "2026-03-10T14:00:00",
      eindTijd: "2026-03-10T15:00:00",
      duurMinuten: 60,
      categorie: "meeting",
      isHandmatig: 0,
    },
    {
      gebruikerId: sem.id,
      projectId: project2.id,
      omschrijving: "API documentatie lezen en testen",
      startTijd: "2026-03-11T09:00:00",
      eindTijd: "2026-03-11T11:00:00",
      duurMinuten: 120,
      categorie: "development",
      isHandmatig: 0,
    },
  ]);

  console.log("Database seeded successfully!");
}
