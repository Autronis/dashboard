import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wikiArtikelen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { sql } from "drizzle-orm";

const seedArtikelen = [
  {
    titel: "Hoe we een nieuw project starten",
    categorie: "processen",
    tags: ["workflow", "project", "onboarding"],
    inhoud: `# Nieuw project starten

## 1. Intake
- Eerste gesprek met klant (30-60 min)
- Behoeften inventariseren
- Huidige situatie in kaart brengen
- Budget en tijdlijn bespreken

## 2. Offerte
- Offerte maken via het dashboard (Financiën → Nieuw)
- Scope duidelijk omschrijven
- Uurtarief of fixed price bepalen
- Offerte versturen en opvolgen

## 3. Project aanmaken
- Klant aanmaken/selecteren in CRM
- Project aanmaken met status "actief"
- Taken toevoegen per fase
- Deadline instellen

## 4. Kickoff
- Kickoff meeting plannen
- Toegang regelen (API keys, credentials)
- Eerste taken toewijzen
- Timer starten bij eerste werkzaamheden`,
  },
  {
    titel: "Onze tech stack",
    categorie: "technisch",
    tags: ["stack", "tools", "development"],
    inhoud: `# Autronis Tech Stack

## Dashboard (dit project)
- **Framework:** Next.js 16 + React 19 + App Router
- **Database:** SQLite + Drizzle ORM
- **Auth:** iron-session + bcrypt
- **Styling:** Tailwind CSS v4
- **State:** Zustand
- **Icons:** lucide-react
- **Hosting:** Vercel

## Klant projecten
- **Automatisering:** Make.com, n8n
- **AI:** OpenAI API, Anthropic API, custom agents
- **Databases:** PostgreSQL, Supabase, Airtable
- **CRM:** HubSpot, Pipedrive integraties
- **E-commerce:** Shopify, WooCommerce koppelingen
- **Boekhouding:** Moneybird, Exact Online integraties

## Communicatie
- **Email:** Resend API
- **Hosting:** Vercel, Railway
- **Domains:** Cloudflare
- **Git:** GitHub`,
  },
  {
    titel: "Hoe we factureren",
    categorie: "processen",
    tags: ["factuur", "financien", "proces"],
    inhoud: `# Facturatie proces

## Wanneer factureren?
- Na oplevering van een fase/milestone
- Maandelijks voor lopende projecten
- Bij vastprijs projecten: 50% vooraf, 50% na oplevering

## Stappen
1. Ga naar **Financiën** → **Nieuwe factuur**
2. Selecteer de klant
3. Voeg factuurregels toe (uren × tarief of vaste bedragen)
4. BTW wordt automatisch berekend (21%)
5. Controleer bedragen
6. Verstuur via email (knop in dashboard)

## Betalingstermijn
- Standaard: 14 dagen
- Kan per klant afwijken (zie klantinstellingen)

## Herinnering
- Na 7 dagen: eerste herinnering (automatisch)
- Na 14 dagen: tweede herinnering
- Na 30 dagen: telefonisch contact`,
  },
  {
    titel: "Onboarding nieuwe klant",
    categorie: "klanten",
    tags: ["onboarding", "klant", "checklist"],
    inhoud: `# Onboarding nieuwe klant

## Checklist
- [ ] Klant aanmaken in CRM
- [ ] Contactgegevens completeren
- [ ] BTW-nummer verifiëren
- [ ] Uurtarief afspreken
- [ ] Contract/offerte getekend
- [ ] Project aanmaken
- [ ] Welkom email versturen
- [ ] Kickoff meeting plannen
- [ ] Toegang regelen (API keys, logins)
- [ ] Eerste taken definiëren

## Welkom email
Gebruik de template "Welkom nieuwe klant" in Templates.

## Belangrijke afspraken
- Communicatie via email, tenzij anders afgesproken
- Wekelijkse update (vrijdag)
- Factuur na elke fase`,
  },
  {
    titel: "BTW aangifte stappen",
    categorie: "financien",
    tags: ["btw", "belasting", "aangifte"],
    inhoud: `# BTW Aangifte

## Deadlines
- Q1: uiterlijk 30 april
- Q2: uiterlijk 31 juli
- Q3: uiterlijk 31 oktober
- Q4: uiterlijk 31 januari volgend jaar

## Stappen
1. Ga naar **Belasting** → **BTW** tab
2. Controleer of alle facturen zijn ingeboekt
3. Controleer of alle uitgaven zijn ingevoerd
4. Klik op "Controleer" voor AI check
5. Noteer het bedrag "Af te dragen"
6. Log in bij de Belastingdienst
7. Vul de aangifte in
8. Betaal het bedrag
9. Markeer als "Betaald" in het dashboard

## Tips
- Bewaar alle bonnen digitaal
- Check of alle inkoop-BTW is meegenomen
- Bij twijfel: vraag de boekhouder`,
  },
  {
    titel: "Urencriterium uitleg",
    categorie: "financien",
    tags: ["uren", "belasting", "zelfstandigenaftrek"],
    inhoud: `# Urencriterium

## Wat is het?
Als VOF-vennoot moet je minimaal **1.225 uur per jaar** aan je onderneming besteden om in aanmerking te komen voor de zelfstandigenaftrek.

## Wat telt mee?
- Alle uren die je aan Autronis besteedt
- Klantwerk, administratie, acquisitie, opleiding
- Automatisch bijgehouden via tijdregistratie in het dashboard

## Voordelen bij behalen
- Zelfstandigenaftrek
- MKB-winstvrijstelling (14%)
- Startersaftrek (eerste 3 jaar)

## Check je voortgang
Ga naar **Belasting** → **Overzicht** → Urencriterium blok.
Het dashboard berekent automatisch of je op schema ligt.

## Tips
- Registreer ALL je uren, ook administratie
- Gemiddeld ~24 uur per week nodig
- Check maandelijks of je op schema ligt`,
  },
  {
    titel: "Deploy process",
    categorie: "technisch",
    tags: ["deploy", "vercel", "hosting"],
    inhoud: `# Deploy Process

## Dashboard (dit project)
1. Push naar \`main\` branch op GitHub
2. Vercel pikt automatisch op
3. Build draait (~2 min)
4. Preview URL beschikbaar
5. Na check: promote naar production

## Klant projecten
- Per project verschilt het (zie project wiki)
- Meestal: Vercel of Railway
- Sommige klanten: eigen hosting

## Rollback
- Via Vercel dashboard: klik op vorige deployment
- Of: \`git revert\` + push

## Environment variables
- Nooit in code! Altijd via Vercel dashboard
- SESSION_SECRET, RESEND_API_KEY, etc.`,
  },
  {
    titel: "VOF regels en afspraken",
    categorie: "financien",
    tags: ["vof", "contract", "afspraken"],
    inhoud: `# VOF Regels & Afspraken

## Vennoten
- **Sem** — Founder, development, klantcontact
- **Syb** — Co-founder, development, operations

## Winstverdeling
- 50/50 tenzij anders afgesproken
- Maandelijks salaris: [bedrag invullen]
- Rest wordt gereserveerd of uitgekeerd per kwartaal

## Beslissingen
- Investeringen >€500: beide vennoten akkoord
- Nieuwe klant aannemen: overleg
- Nieuwe tools/licenties: overleg

## Financieel
- Gescheiden privé en zakelijk
- Privé onttrekkingen bijhouden in dashboard
- BTW aangifte: per kwartaal (zie BTW artikel)

## Verzekeringen
- Aansprakelijkheidsverzekering: [details]
- Zorgverzekering: individueel
`,
  },
  {
    titel: "Workflow automatisering met Make.com",
    categorie: "tools",
    tags: ["make", "automatisering", "workflow"],
    inhoud: `# Make.com (voorheen Integromat)

## Wanneer gebruiken?
- Klant heeft geen developers
- Simpele workflows (<10 stappen)
- Integraties tussen SaaS tools
- Snel proof of concept nodig

## Wanneer NIET?
- Complexe logica → n8n of custom code
- Hoge volumes (>10k operaties/maand) → kosten lopen op
- Klant wil self-hosted → n8n

## Best practices
- Naamgeving: [Klant] - [Workflow naam]
- Error handling: altijd een error route toevoegen
- Logging: belangrijke stappen loggen
- Documenteer elke scenario in de wiki

## Pricing
- Free: 1000 ops/maand
- Core: €9/maand — 10k ops
- Pro: €16/maand — onbeperkt
- Teams: €29/maand — meerdere gebruikers`,
  },
  {
    titel: "Geleerde lessen: project schattingen",
    categorie: "geleerde-lessen",
    tags: ["schatting", "planning", "les"],
    inhoud: `# Geleerde les: Project schattingen

## Wat ging fout?
We schatten projecten structureel te laag in, waardoor we uren overschreden en de winstmarge kleiner werd.

## Oorzaken
- Te optimistisch over scope
- Edge cases niet meegenomen
- Klant feedback loops onderschat
- Testing tijd vergeten

## Wat doen we nu anders?
1. **Altijd 1.5x multiplier** op eerste schatting
2. **Buffer van 20%** voor onvoorzien
3. **Fasering**: splits in fases, schat per fase
4. **T-shirt sizing**: S/M/L/XL eerst, dan uren
5. **Review**: tweede vennoot checkt de schatting

## Resultaat
Sinds we dit doen: 85% van projecten binnen budget (was 50%).`,
  },
];

export async function POST() {
  try {
    const gebruiker = await requireAuth();

    // Check of er al artikelen zijn
    const bestaande = await db
      .select({ count: sql<number>`count(*)` })
      .from(wikiArtikelen)
      .get();

    if (bestaande && bestaande.count > 0) {
      return NextResponse.json({
        fout: `Er zijn al ${bestaande.count} artikelen. Seed wordt overgeslagen.`,
      }, { status: 400 });
    }

    const aangemaakte: { id: number; titel: string }[] = [];

    for (const artikel of seedArtikelen) {
      const [nieuw] = await db
        .insert(wikiArtikelen)
        .values({
          titel: artikel.titel,
          inhoud: artikel.inhoud,
          categorie: artikel.categorie as typeof wikiArtikelen.$inferInsert.categorie,
          tags: JSON.stringify(artikel.tags),
          auteurId: gebruiker.id,
          gepubliceerd: 1,
        })
        .returning();

      aangemaakte.push({ id: nieuw.id, titel: nieuw.titel });
    }

    return NextResponse.json({
      succes: true,
      aantal: aangemaakte.length,
      artikelen: aangemaakte,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Seed mislukt" },
      { status: 500 }
    );
  }
}
