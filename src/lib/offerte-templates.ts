export interface OfferteTemplateRegel {
  omschrijving: string;
  aantal: number;
  eenheidsprijs: number;
  btwPercentage: number;
  isOptioneel?: boolean;
}

export interface OfferteTemplate {
  id: string;
  naam: string;
  beschrijving: string;
  standaardTitel: string;
  regels: OfferteTemplateRegel[];
}

export const offerteTemplates: OfferteTemplate[] = [
  {
    id: "workflow-automatisering",
    naam: "Workflow Automatisering",
    beschrijving: "Standaard pakket voor workflow automatisering met Make.com, n8n of API-integraties",
    standaardTitel: "Workflow Automatisering",
    regels: [
      { omschrijving: "Analyse & inventarisatie", aantal: 4, eenheidsprijs: 95, btwPercentage: 21 },
      { omschrijving: "Workflow ontwerp & configuratie", aantal: 8, eenheidsprijs: 95, btwPercentage: 21 },
      { omschrijving: "Implementatie & testen", aantal: 8, eenheidsprijs: 95, btwPercentage: 21 },
      { omschrijving: "Training & documentatie", aantal: 2, eenheidsprijs: 95, btwPercentage: 21 },
      { omschrijving: "Maandelijks onderhoud (optioneel)", aantal: 1, eenheidsprijs: 250, btwPercentage: 21, isOptioneel: true },
    ],
  },
  {
    id: "ai-integratie",
    naam: "AI Integratie",
    beschrijving: "AI strategie, API-integratie en custom AI-workflows voor jouw bedrijf",
    standaardTitel: "AI Integratie",
    regels: [
      { omschrijving: "AI strategie & use case definitie", aantal: 4, eenheidsprijs: 95, btwPercentage: 21 },
      { omschrijving: "API integratie & ontwikkeling", aantal: 12, eenheidsprijs: 95, btwPercentage: 21 },
      { omschrijving: "Training & fine-tuning", aantal: 4, eenheidsprijs: 95, btwPercentage: 21 },
      { omschrijving: "Testing & optimalisatie", aantal: 4, eenheidsprijs: 95, btwPercentage: 21 },
    ],
  },
  {
    id: "dashboard-rapportage",
    naam: "Dashboard / Rapportage",
    beschrijving: "Custom dashboard met realtime KPIs, data koppelingen en rapportages",
    standaardTitel: "Dashboard & Rapportage",
    regels: [
      { omschrijving: "Requirements & data inventarisatie", aantal: 4, eenheidsprijs: 95, btwPercentage: 21 },
      { omschrijving: "Dashboard ontwerp & development", aantal: 16, eenheidsprijs: 95, btwPercentage: 21 },
      { omschrijving: "Data koppelingen", aantal: 8, eenheidsprijs: 95, btwPercentage: 21 },
      { omschrijving: "Training & oplevering", aantal: 2, eenheidsprijs: 95, btwPercentage: 21 },
    ],
  },
];
