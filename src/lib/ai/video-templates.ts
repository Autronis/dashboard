export type VideoTemplateCategorie =
  | "case_study"
  | "tip"
  | "before_after"
  | "tool_review"
  | "stats"
  | "quote"
  | "tutorial";

export interface VideoTemplateVeld {
  key: string;
  label: string;
  type: "text" | "textarea" | "number";
  required: boolean;
  placeholder?: string;
}

export interface VideoTemplate {
  id: string;
  naam: string;
  beschrijving: string;
  categorie: VideoTemplateCategorie;
  icon: string;
  promptTemplate: string;
  voorbeeldInput: Record<string, string>;
  velden: VideoTemplateVeld[];
}

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: "tip",
    naam: "Tip Video",
    beschrijving: "\"3 manieren om X te automatiseren\" — korte, punchende tips",
    categorie: "tip",
    icon: "lightbulb",
    velden: [
      { key: "onderwerp", label: "Onderwerp", type: "text", required: true, placeholder: "bijv. facturatie automatiseren" },
      { key: "tips", label: "Tips (1 per regel, 3-5 stuks)", type: "textarea", required: true, placeholder: "Gebruik Make.com voor triggers\nKoppel je boekhouding via API\nAutomatiseer herinneringen" },
    ],
    voorbeeldInput: {
      onderwerp: "facturatie automatiseren",
      tips: "Gebruik Make.com voor triggers\nKoppel je boekhouding via API\nAutomatiseer herinneringen",
    },
    promptTemplate: `Maak een video script voor een "tip video" over: {{onderwerp}}

De tips zijn:
{{tips}}

## Structuur
1. Opening scene: pakkende vraag of stelling over het onderwerp (geel accent — pijnpunt)
2. Per tip: 1-2 scenes die de tip helder uitleggen (turquoise accent)
3. Samenvatting scene: kort overzicht van alle tips
4. CTA scene: "Autronis.nl" of "Laat het automatiseren"

Totaal 8-12 scenes, 45-60 seconden.`,
  },
  {
    id: "before_after",
    naam: "Before/After",
    beschrijving: "\"Zonder vs met automatisering\" — contrast laten zien",
    categorie: "before_after",
    icon: "arrow-right-left",
    velden: [
      { key: "situatie", label: "Situatie", type: "text", required: true, placeholder: "bijv. Klantonboarding" },
      { key: "zonder", label: "Zonder automatisering (pijnpunten)", type: "textarea", required: true, placeholder: "Handmatig e-mails sturen\nExcel lijsten bijhouden\n3 uur per klant" },
      { key: "met", label: "Met automatisering (voordelen)", type: "textarea", required: true, placeholder: "Automatische welkomstmail\nCRM wordt vanzelf gevuld\n15 minuten per klant" },
      { key: "resultaat", label: "Eindresultaat", type: "text", required: true, placeholder: "bijv. 80% tijdsbesparing" },
    ],
    voorbeeldInput: {
      situatie: "Klantonboarding",
      zonder: "Handmatig e-mails sturen\nExcel lijsten bijhouden\n3 uur per klant",
      met: "Automatische welkomstmail\nCRM wordt vanzelf gevuld\n15 minuten per klant",
      resultaat: "80% tijdsbesparing",
    },
    promptTemplate: `Maak een video script voor een "before/after" vergelijking.

Situatie: {{situatie}}

ZONDER automatisering (pijnpunten):
{{zonder}}

MET automatisering (voordelen):
{{met}}

Eindresultaat: {{resultaat}}

## Structuur
1. Opening: herkenbare situatie schetsen (1-2 scenes)
2. "Zonder" blok: pijnpunten tonen met geel accent (3-4 scenes)
3. Transitie scene: "Maar wat als..." of "Er is een betere manier"
4. "Met" blok: voordelen tonen met turquoise accent (3-4 scenes)
5. Resultaat scene: het eindresultaat groot in beeld
6. CTA scene

Totaal 10-14 scenes, 45-60 seconden.`,
  },
  {
    id: "tool_review",
    naam: "Tool Review",
    beschrijving: "\"Waarom we X gebruiken\" — eerlijke tool review",
    categorie: "tool_review",
    icon: "wrench",
    velden: [
      { key: "toolNaam", label: "Tool naam", type: "text", required: true, placeholder: "bijv. Make.com" },
      { key: "watHetDoet", label: "Wat het doet", type: "text", required: true, placeholder: "bijv. Workflow automatisering platform" },
      { key: "voordelen", label: "Voordelen (1 per regel)", type: "textarea", required: true, placeholder: "Visuele workflow builder\n1000+ integraties\nBetaalbaar voor MKB" },
      { key: "nadelen", label: "Nadelen (1 per regel)", type: "textarea", required: true, placeholder: "Leercurve voor complexe flows\nSoms traag bij grote datasets" },
      { key: "score", label: "Score (1-10)", type: "number", required: true },
    ],
    voorbeeldInput: {
      toolNaam: "Make.com",
      watHetDoet: "Workflow automatisering platform",
      voordelen: "Visuele workflow builder\n1000+ integraties\nBetaalbaar voor MKB",
      nadelen: "Leercurve voor complexe flows\nSoms traag bij grote datasets",
      score: "9",
    },
    promptTemplate: `Maak een video script voor een tool review.

Tool: {{toolNaam}}
Wat het doet: {{watHetDoet}}

Voordelen:
{{voordelen}}

Nadelen:
{{nadelen}}

Score: {{score}}/10

## Structuur
1. Opening: tool naam + wat het doet (1-2 scenes)
2. Voordelen blok: elk voordeel als scene (turquoise accent)
3. Nadelen blok: eerlijk benoemen (geel accent)
4. Score scene: groot getal in beeld
5. Verdict scene: korte conclusie
6. CTA scene

Totaal 8-12 scenes, 45-60 seconden.`,
  },
  {
    id: "stats",
    naam: "Stats/Metrics",
    beschrijving: "Animatie van grote getallen en statistieken",
    categorie: "stats",
    icon: "bar-chart-3",
    velden: [
      { key: "titel", label: "Titel", type: "text", required: true, placeholder: "bijv. Automatisering in cijfers" },
      { key: "metrics", label: "Metrics (formaat: label | waarde, 1 per regel)", type: "textarea", required: true, placeholder: "Tijdsbesparing | 80%\nFouten verminderd | 95%\nROI | 3x" },
    ],
    voorbeeldInput: {
      titel: "Automatisering in cijfers",
      metrics: "Tijdsbesparing | 80%\nFouten verminderd | 95%\nROI | 3x",
    },
    promptTemplate: `Maak een video script dat statistieken/metrics visueel toont.

Titel: {{titel}}

Metrics:
{{metrics}}

## Structuur
1. Opening scene: pakkende vraag of stelling (geel accent)
2. Per metric: 1-2 scenes met het grote getal prominent in beeld
   - Gebruik het getal als accentregel
   - Turquoise accent voor positieve metrics
3. Samenvatting scene: "Dit is wat automatisering doet"
4. CTA scene

Totaal 8-12 scenes, 45-60 seconden. Maak de getallen GROOT en prominent.`,
  },
  {
    id: "quote",
    naam: "Quote",
    beschrijving: "Inspirerende of impactvolle quote",
    categorie: "quote",
    icon: "quote",
    velden: [
      { key: "quote", label: "Quote", type: "textarea", required: true, placeholder: "bijv. Automatiseer het saaie werk, focus op wat ertoe doet." },
      { key: "auteur", label: "Auteur", type: "text", required: true, placeholder: "bijv. Sem — Autronis" },
      { key: "context", label: "Context (optioneel)", type: "text", required: false, placeholder: "bijv. Over workflow automatisering" },
    ],
    voorbeeldInput: {
      quote: "Automatiseer het saaie werk, focus op wat ertoe doet.",
      auteur: "Sem — Autronis",
      context: "Over workflow automatisering",
    },
    promptTemplate: `Maak een video script voor een inspirerende quote.

Quote: "{{quote}}"
Auteur: {{auteur}}
Context: {{context}}

## Structuur
1. Opening scene: context of aanleiding (1-2 scenes, geel of turquoise)
2. Quote scenes: breek de quote op in 2-4 scenes, elk met een deel van de quote
   - De kernzin krijgt turquoise accent
   - Bouw spanning op naar het belangrijkste deel
3. Auteur scene: wie zei dit
4. CTA scene

Totaal 6-10 scenes, 30-45 seconden. Houd het kort en krachtig.`,
  },
  {
    id: "case_study",
    naam: "Case Study",
    beschrijving: "Klant resultaat showcase — probleem, oplossing, resultaat",
    categorie: "case_study",
    icon: "briefcase",
    velden: [
      { key: "klantNaam", label: "Klant naam", type: "text", required: true, placeholder: "bijv. Bakkerij de Groot" },
      { key: "probleem", label: "Probleem", type: "textarea", required: true, placeholder: "bijv. Bestellingen handmatig verwerken, 4 uur per dag" },
      { key: "oplossing", label: "Oplossing", type: "textarea", required: true, placeholder: "bijv. Automatische bestelpipeline met Make.com + Exact Online" },
      { key: "resultaat", label: "Resultaat", type: "textarea", required: true, placeholder: "bijv. 90% minder handmatig werk, 0 fouten, 3 uur/dag bespaard" },
      { key: "metric", label: "Key metric", type: "text", required: true, placeholder: "bijv. 90% tijdsbesparing" },
    ],
    voorbeeldInput: {
      klantNaam: "Bakkerij de Groot",
      probleem: "Bestellingen handmatig verwerken, 4 uur per dag",
      oplossing: "Automatische bestelpipeline met Make.com + Exact Online",
      resultaat: "90% minder handmatig werk, 0 fouten, 3 uur/dag bespaard",
      metric: "90% tijdsbesparing",
    },
    promptTemplate: `Maak een video script voor een case study.

Klant: {{klantNaam}}

Probleem:
{{probleem}}

Oplossing:
{{oplossing}}

Resultaat:
{{resultaat}}

Key metric: {{metric}}

## Structuur
1. Opening scene: klantnaam + branche (1 scene)
2. Probleem blok: schets de situatie (2-3 scenes, geel accent)
3. Transitie: "Autronis bouwde..." of "De oplossing:"
4. Oplossing blok: wat er gebouwd is (2-3 scenes, turquoise accent)
5. Resultaat blok: concrete resultaten (2-3 scenes, turquoise accent)
6. Key metric scene: het grote getal prominent in beeld
7. CTA scene

Totaal 10-14 scenes, 45-60 seconden.`,
  },
];

export function getTemplate(id: string): VideoTemplate | undefined {
  return VIDEO_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategorie(categorie: VideoTemplateCategorie): VideoTemplate[] {
  return VIDEO_TEMPLATES.filter((t) => t.categorie === categorie);
}
