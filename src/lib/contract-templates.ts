export type ContractType = "samenwerkingsovereenkomst" | "sla" | "nda";

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
  }
}

function getTypeNaam(type: ContractType): string {
  switch (type) {
    case "samenwerkingsovereenkomst": return "samenwerkingsovereenkomst";
    case "sla": return "Service Level Agreement (SLA)";
    case "nda": return "geheimhoudingsovereenkomst (NDA)";
  }
}
