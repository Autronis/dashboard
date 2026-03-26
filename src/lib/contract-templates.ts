export type ContractType = "samenwerkingsovereenkomst" | "sla" | "nda" | "onderhuurovereenkomst" | "freelance" | "projectovereenkomst" | "vof";

export interface ContractTemplate {
  id: ContractType;
  naam: string;
  beschrijving: string;
}

export const contractTemplates: ContractTemplate[] = [
  {
    id: "samenwerkingsovereenkomst",
    naam: "Samenwerkingsovereenkomst",
    beschrijving: "Standaard freelance/agency overeenkomst voor projecten en dienstverlening",
  },
  {
    id: "sla",
    naam: "SLA (Service Level Agreement)",
    beschrijving: "Overeenkomst voor maandelijks onderhoud, support en monitoring",
  },
  {
    id: "nda",
    naam: "NDA (Geheimhouding)",
    beschrijving: "Standaard geheimhoudingsovereenkomst voor vertrouwelijke informatie",
  },
  {
    id: "onderhuurovereenkomst",
    naam: "Onderhuurovereenkomst",
    beschrijving: "Overeenkomst voor het onderverhuren van kantoor- of werkruimte",
  },
  {
    id: "freelance",
    naam: "Freelance overeenkomst",
    beschrijving: "Overeenkomst voor freelance opdrachten en inhuur van specialisten",
  },
  {
    id: "projectovereenkomst",
    naam: "Projectovereenkomst",
    beschrijving: "Overeenkomst voor een specifiek project met vaste scope en prijs",
  },
  {
    id: "vof",
    naam: "VOF-overeenkomst",
    beschrijving: "Vennootschap onder firma overeenkomst tussen vennoten",
  },
];

export function generateContractPrompt(
  type: ContractType,
  bedrijfsnaam: string,
  klantNaam: string,
  klantContactpersoon: string | null,
  details: string
): string {
  const baseInstruction = `Genereer een professioneel ${getTypeNaam(type)} in het Nederlands.
Gebruik genummerde artikelen (Artikel 1, Artikel 2, etc.).
De partijen zijn:
- Opdrachtnemer: ${bedrijfsnaam} (hierna: "Opdrachtnemer")
- Opdrachtgever: ${klantNaam}${klantContactpersoon ? `, t.a.v. ${klantContactpersoon}` : ""} (hierna: "Opdrachtgever")

Aanvullende details: ${details || "Geen aanvullende details opgegeven."}

Format: gebruik markdown met ## voor artikelkoppen. Geen HTML.`;

  switch (type) {
    case "samenwerkingsovereenkomst":
      return `${baseInstruction}

Neem de volgende artikelen op:
1. Definities
2. Doel en scope van de samenwerking
3. Looptijd en beeindiging
4. Werkzaamheden en deliverables
5. Vergoeding en betalingsvoorwaarden
6. Intellectueel eigendom
7. Geheimhouding
8. Aansprakelijkheid
9. Overmacht
10. Geschillen en toepasselijk recht
11. Slotbepalingen

Maak het professioneel maar toegankelijk. Niet te juridisch jargon.`;

    case "sla":
      return `${baseInstruction}

Neem de volgende artikelen op:
1. Definities
2. Scope van de dienstverlening
3. Service levels en beschikbaarheid
4. Responstijden en prioriteiten (P1: 4 uur, P2: 8 uur, P3: 24 uur)
5. Onderhoud en updates
6. Monitoring en rapportage
7. Vergoeding en facturatie
8. Looptijd en opzegging
9. Escalatieprocedure
10. Aansprakelijkheid
11. Slotbepalingen

Maak concrete service levels met meetbare KPIs.`;

    case "nda":
      return `${baseInstruction}

Neem de volgende artikelen op:
1. Definities
2. Vertrouwelijke informatie (definitie)
3. Verplichtingen van partijen
4. Uitzonderingen
5. Duur van de geheimhouding (2 jaar na beeindiging)
6. Teruggave van informatie
7. Sancties bij schending
8. Toepasselijk recht
9. Slotbepalingen

Houd het beknopt en duidelijk. Maximaal 2 pagina's.`;

    case "onderhuurovereenkomst":
      return `${baseInstruction}

Dit is een onderhuurovereenkomst voor kantoor-/werkruimte. Neem de volgende artikelen op:
1. Partijen (onderverhuurder en onderhuurder met volledige gegevens)
2. Het gehuurde (omschrijving van de ruimte, adres, oppervlakte)
3. Bestemming (waarvoor de ruimte mag worden gebruikt)
4. Duur van de overeenkomst (ingangsdatum, looptijd, opzegtermijn)
5. Huurprijs en betaling (bedrag, frequentie, IBAN, BTW)
6. Bijkomende kosten (energie, internet, schoonmaak, servicekosten)
7. Staat van het gehuurde en onderhoud
8. Huisregels en gebruik gemeenschappelijke ruimtes
9. Onderverhuur en indeplaatsstelling (verbod zonder toestemming)
10. Verzekering en aansprakelijkheid
11. Beëindiging en oplevering
12. Toepasselijk recht en geschillen
13. Slotbepalingen en bijlagen

Maak het juridisch waterdicht. Gebruik concrete bedragen waar mogelijk.`;

    case "freelance":
      return `${baseInstruction}

Dit is een freelance overeenkomst (overeenkomst van opdracht). Neem de volgende artikelen op:
1. Partijen met volledige gegevens
2. Definities
3. Opdracht en werkzaamheden
4. Zelfstandigheid (geen arbeidsovereenkomst, geen gezagsverhouding)
5. Duur en beëindiging
6. Vergoeding, facturatie en betalingstermijn
7. Beschikbaarheid en werktijden
8. Intellectueel eigendom
9. Geheimhouding
10. Aansprakelijkheid en verzekering
11. Vervangingsclausule
12. Concurrentie- en relatiebeding (optioneel)
13. Toepasselijk recht
14. Slotbepalingen

Zorg dat het voldoet aan de criteria van de Belastingdienst voor ZZP/freelance (geen schijnzelfstandigheid).`;

    case "projectovereenkomst":
      return `${baseInstruction}

Dit is een projectovereenkomst voor een specifiek project. Neem de volgende artikelen op:
1. Partijen met volledige gegevens
2. Definities
3. Projectomschrijving en scope
4. Deliverables en acceptatiecriteria
5. Planning en milestones
6. Projectprijs en betalingsschema (bijv. 50% vooruit, 50% bij oplevering)
7. Wijzigingen en meerwerk
8. Intellectueel eigendom en licenties
9. Garantie en onderhoud na oplevering
10. Geheimhouding
11. Aansprakelijkheid
12. Overmacht
13. Beëindiging
14. Toepasselijk recht en geschillen
15. Slotbepalingen

Maak concrete afspraken over scope, prijs en planning.`;

    case "vof":
      return `Genereer een professionele en juridisch waterdichte VOF-overeenkomst (Vennootschap onder Firma) in het Nederlands.

Dit contract is GEEN standaard klantcontract. Het is een interne overeenkomst tussen de vennoten van ${bedrijfsnaam}.

De vennoten zijn:
- Sem Gijsberts (geboren: invullen, woonachtig: Doetinchem)
- Syb Sprenkeler (geboren: invullen, woonachtig: invullen)

Handelsnaam: ${bedrijfsnaam}
Vestigingsadres: Ruimzichtlaan 139, 7001KD Doetinchem

${details || ""}

Neem de volgende artikelen op (dit is een COMPLEET VOF-contract conform Nederlands recht):

1. **Naam en zetel** — handelsnaam, vestigingsadres, eventuele nevenvestigingen
2. **Doel van de vennootschap** — AI-oplossingen, automatisering en consultancy voor het MKB
3. **Duur** — ingangsdatum, onbepaalde tijd, opzegtermijn
4. **Inbreng** — wat brengt elke vennoot in (kennis, arbeid, kapitaal, middelen)
5. **Winst- en verliesverdeling** — verdeelsleutel (bijv. 50/50), uitkeringsbeleid, privéopnames
6. **Bevoegdheden en vertegenwoordiging** — wie mag tekenen, maximumbedragen zonder overleg, gezamenlijke beslissingen
7. **Taken en verantwoordelijkheden** — taakverdeling tussen vennoten, minimale inzet
8. **Boekjaar en administratie** — boekjaar = kalenderjaar, administratieplicht, jaarrekening
9. **Kapitaalrekeningen** — bijhouden per vennoot, rente, minimaal saldo
10. **Arbeidsongeschiktheid en afwezigheid** — regeling bij ziekte, vervanging, doorlopende verplichtingen
11. **Concurrentie- en relatiebeding** — tijdens en na de VOF, duur, boeteclausule
12. **Geheimhouding** — vertrouwelijke bedrijfsinformatie, ook na uittreding
13. **Toetreding en uittreding** — procedure, waardering, goodwill, uitkoopregeling
14. **Overlijden en arbeidsongeschiktheid** — voortzetting, uitkering aan erfgenamen
15. **Ontbinding en vereffening** — wanneer, hoe, verdeling activa/passiva
16. **Geschillen** — eerst mediation, dan arbitrage of rechtbank, toepasselijk recht
17. **Slotbepalingen** — wijzigingen schriftelijk, nietigheid deelbepaling, ondertekening

Format: gebruik markdown met ## voor artikelkoppen. Geen HTML.
Schrijf elk artikel volledig uit met concrete bepalingen. Dit moet een professioneel contract zijn dat direct ondertekend kan worden.`;
  }
}

function getTypeNaam(type: ContractType): string {
  switch (type) {
    case "samenwerkingsovereenkomst": return "samenwerkingsovereenkomst";
    case "sla": return "Service Level Agreement (SLA)";
    case "nda": return "geheimhoudingsovereenkomst (NDA)";
    case "onderhuurovereenkomst": return "onderhuurovereenkomst";
    case "freelance": return "freelance overeenkomst (overeenkomst van opdracht)";
    case "projectovereenkomst": return "projectovereenkomst";
    case "vof": return "VOF-overeenkomst (vennootschap onder firma)";
  }
}
