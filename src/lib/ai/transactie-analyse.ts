// Shared transactie analyse helper. Used by the Revolut sync, the manual
// /api/bank/transacties/analyse endpoint, and the backfill script.
//
// Strategy:
//   1. If the transaction has a linked PDF (storage_url), download the
//      invoice and let Claude Sonnet Vision read the actual line items.
//      This gives precise descriptions like "USB-C kabel 2m + HDMI adapter"
//      instead of generic guesses based on the merchant name.
//   2. Otherwise fall back to a merchant-only prompt with Claude Haiku.
//      The prompt is deliberately conservative about marking things as
//      "prive" — unknown items default to "kosten" unless the merchant
//      is clearly non-business (supermarket food, fast food, personal care,
//      entertainment).
//
// Returned data is the same shape in both paths so callers can treat them
// interchangeably.

import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { downloadFromStorage } from "@/lib/supabase";

export interface AnalyseResult {
  beschrijving: string;
  isAbonnement: boolean;
  score: "noodzakelijk" | "nuttig" | "overbodig";
  fiscaalType: "investering" | "kosten" | "prive";
  subsidieMogelijkheden: string[];
  bron: "pdf" | "merchant";
}

export interface AnalyseInput {
  merchantNaam: string | null;
  omschrijving: string;
  bedrag: number;
  datum: string;
  aantalKeerGezien: number;
  gemiddeldBedrag: number;
  storagePath: string | null;
}

const MERCHANT_SYSTEM = `Je analyseert banktransacties voor Autronis, een klein AI- en automatiseringsbureau (ZZP/VOF).

Belangrijke regels:
- Autronis koopt veel hardware, software, kabels, monitoren, kantoorspullen via Coolblue, Temu, Action, Kruidvat, Kabelshop, Hornbach, etc. Dit zijn ZAKELIJKE uitgaven zolang er geen duidelijke privé-indicatie is.
- Markeer ALLEEN als "prive" wanneer het overduidelijk persoonlijk is (bv. fast food, supermarket food, fitness, persoonlijke verzorging van merken als L'Oreal/Nivea, streaming-abonnementen voor thuisgebruik).
- Bij twijfel: "kosten" (niet "prive"). De gebruiker markeert desnoods zelf achteraf als privé.
- "investering" is voor individuele posten >€450 aan hardware, software licenties, apparatuur, meubilair.`;

function mkMerchantPrompt(input: AnalyseInput): string {
  return `Analyseer deze banktransactie.

Transactie:
- Merchant: ${input.merchantNaam || input.omschrijving}
- Omschrijving: ${input.omschrijving}
- Bedrag: €${Math.abs(input.bedrag).toFixed(2)}
- Datum: ${input.datum}
- Frequentie: ${input.aantalKeerGezien}x in 90 dagen (gem €${input.gemiddeldBedrag.toFixed(2)})

Geef als JSON:
{
  "beschrijving": "Korte NL beschrijving (max 1 zin). Wees specifiek over wat het waarschijnlijk is, niet generiek.",
  "isAbonnement": true/false,
  "score": "noodzakelijk"|"nuttig"|"overbodig",
  "fiscaalType": "investering"|"kosten"|"prive",
  "subsidieMogelijkheden": ["WBSO","MIA","VAMIL","EIA"] of []
}

Alleen JSON, geen andere tekst.`;
}

function mkPdfPrompt(input: AnalyseInput): string {
  return `Bijgevoegd: een factuur / bonnetje. Lees de regels en zeg exact wat er is gekocht.

Bank transactie context:
- Merchant: ${input.merchantNaam || input.omschrijving}
- Bedrag op bank: €${Math.abs(input.bedrag).toFixed(2)}
- Datum betaling: ${input.datum}

Geef als JSON:
{
  "beschrijving": "Beschrijf in 1 NL zin wat er op deze factuur staat. Noem de daadwerkelijke producten/items uit de factuurregels, niet alleen de merchant. Max 120 chars.",
  "isAbonnement": true/false,
  "score": "noodzakelijk"|"nuttig"|"overbodig",
  "fiscaalType": "investering"|"kosten"|"prive",
  "subsidieMogelijkheden": ["WBSO","MIA","VAMIL","EIA"] of []
}

Regels:
- "investering" als er hardware/software/apparatuur op de regels staat met totaalbedrag >€450
- "kosten" voor alles wat operationeel of klein is
- "prive" ALLEEN als de items overduidelijk privé zijn (voedsel, persoonlijke verzorging, recreatie)

Alleen JSON.`;
}

function parseResponse(raw: string): Omit<AnalyseResult, "bron"> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const p = JSON.parse(match[0]) as {
      beschrijving?: string;
      isAbonnement?: boolean;
      score?: string;
      fiscaalType?: string;
      subsidieMogelijkheden?: string[];
    };
    if (!p.beschrijving || !p.fiscaalType) return null;
    return {
      beschrijving: p.beschrijving,
      isAbonnement: Boolean(p.isAbonnement),
      score: (["noodzakelijk", "nuttig", "overbodig"] as const).includes(p.score as "noodzakelijk" | "nuttig" | "overbodig")
        ? (p.score as "noodzakelijk" | "nuttig" | "overbodig")
        : "nuttig",
      fiscaalType: (["investering", "kosten", "prive"] as const).includes(p.fiscaalType as "investering" | "kosten" | "prive")
        ? (p.fiscaalType as "investering" | "kosten" | "prive")
        : "kosten",
      subsidieMogelijkheden: Array.isArray(p.subsidieMogelijkheden) ? p.subsidieMogelijkheden : [],
    };
  } catch {
    return null;
  }
}

export async function analyseTransactie(input: AnalyseInput): Promise<AnalyseResult | null> {
  const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }, "tx-analyse");

  // PDF path — if the tx has a linked invoice, read it with Sonnet Vision.
  if (input.storagePath) {
    try {
      const pdfBuffer = await downloadFromStorage(input.storagePath);
      const base64 = pdfBuffer.toString("base64");
      const res = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: MERCHANT_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
                title: input.storagePath.split("/").pop() ?? "factuur.pdf",
              },
              { type: "text", text: mkPdfPrompt(input) },
            ],
          },
        ],
      });
      const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
      const parsed = parseResponse(raw);
      if (parsed) return { ...parsed, bron: "pdf" };
      // If PDF path failed to produce valid JSON, fall through to merchant path.
    } catch {
      // Download or API failure — fall through to merchant path.
    }
  }

  // Merchant-only path — Haiku with conservative prompt.
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: MERCHANT_SYSTEM,
    messages: [{ role: "user", content: mkMerchantPrompt(input) }],
  });
  const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
  const parsed = parseResponse(raw);
  if (!parsed) return null;
  return { ...parsed, bron: "merchant" };
}
