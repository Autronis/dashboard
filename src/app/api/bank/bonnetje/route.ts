import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }, "/api/bank/bonnetje");

interface BonnetjeData {
  bedrag: number | null;
  btwBedrag: number | null;
  datum: string | null;
  winkel: string | null;
  categorie: string | null;
  items: string[];
}

async function analyseerBonnetje(base64: string, mediaType: string): Promise<BonnetjeData> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 },
        },
        {
          type: "text",
          text: `Analyseer dit bonnetje/kassabon. Geef:
1. bedrag: totaalbedrag incl BTW (als getal, bijv 23.50)
2. btwBedrag: BTW bedrag als dat op de bon staat (als getal), anders null
3. datum: datum van de bon in YYYY-MM-DD formaat, anders null
4. winkel: naam van de winkel/leverancier
5. categorie: kies uit: kantoor, hardware, software, reiskosten, marketing, onderwijs, telefoon, verzekeringen, accountant, overig
6. items: array van gekochte items (kort, max 5)

Antwoord ALLEEN als JSON: {"bedrag":23.50,"btwBedrag":4.08,"datum":"2026-03-31","winkel":"Lidl","categorie":"kantoor","items":["Papier A4","Pennen"]}`,
        },
      ],
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { bedrag: null, btwBedrag: null, datum: null, winkel: null, categorie: null, items: [] };

  return JSON.parse(jsonMatch[0]) as BonnetjeData;
}

// POST /api/bank/bonnetje — Upload receipt photo, OCR, auto-match
export async function POST(req: NextRequest) {
  try {
    // Auth via query param, header, of session cookie
    const queryKey = new URL(req.url).searchParams.get("key");
    const xApiKey = req.headers.get("x-api-key");
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const validKey = [queryKey, xApiKey, bearerToken].some(
      (k) => k && k === process.env.SESSION_SECRET
    );

    if (!validKey) {
      const { requireAuth } = await import("@/lib/auth");
      await requireAuth();
    }

    // Probeer het bonnetje uit de body te halen — ondersteunt:
    // 1. Multipart form met "bonnetje" veld (web upload)
    // 2. Raw image body (iOS Shortcuts met Request Body = File)
    // 3. Form met "base64" veld
    let base64: string;
    let mediaType: string;
    let buffer: Buffer;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const bonnetjeRaw = formData.get("bonnetje");
      const file = bonnetjeRaw instanceof File ? bonnetjeRaw : null;
      const blob = !file && bonnetjeRaw instanceof Blob ? bonnetjeRaw : null;
      const base64Input = formData.get("base64") as string | null;

      if (file) {
        buffer = Buffer.from(await file.arrayBuffer());
        base64 = buffer.toString("base64");
        mediaType = file.type || "image/jpeg";
      } else if (blob) {
        buffer = Buffer.from(await blob.arrayBuffer());
        base64 = buffer.toString("base64");
        mediaType = blob.type || "image/jpeg";
      } else if (base64Input) {
        base64 = base64Input;
        buffer = Buffer.from(base64, "base64");
        mediaType = (formData.get("mediaType") as string) || "image/jpeg";
      } else {
        return NextResponse.json({ fout: "Geen bonnetje meegestuurd" }, { status: 400 });
      }
    } else {
      // Raw body — iOS Shortcuts stuurt de foto direct als body (Request Body = File)
      const arrayBuffer = await req.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        return NextResponse.json({ fout: "Geen bonnetje meegestuurd" }, { status: 400 });
      }
      buffer = Buffer.from(arrayBuffer);
      base64 = buffer.toString("base64");
      mediaType = contentType.startsWith("image/") ? contentType.split(";")[0] : "image/jpeg";
    }

    // Comprimeer als de afbeelding > 4.5MB is (Claude API limiet = 5MB)
    const MAX_SIZE = 4_500_000;
    if (buffer.length > MAX_SIZE) {
      const sharp = (await import("sharp")).default;
      buffer = await sharp(buffer)
        .resize({ width: 2000, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      base64 = buffer.toString("base64");
      mediaType = "image/jpeg";
    }

    // 1. Save the receipt image to Supabase Storage
    const { uploadToStorage } = await import("@/lib/supabase");
    const ext = mediaType.includes("png") ? ".png" : ".jpg";
    const year = new Date().getFullYear();
    const fileName = `bon_${Date.now()}${ext}`;
    const storagePath = `${year}/bonnetjes/${fileName}`;
    await uploadToStorage(storagePath, buffer, mediaType);
    const bonPad = storagePath;

    // 2. OCR via Claude Vision
    const bonData = await analyseerBonnetje(base64, mediaType);

    // 3. Try to auto-match with a bank transaction
    // Zoekt op bedrag (±15%) OF winkelnaam, zonder strikte datumfilter
    // (OCR leest datums vaak verkeerd, en handmatige transacties hebben soms afwijkende datums)
    let matchedTransactie = null;
    if (bonData.bedrag || bonData.winkel) {
      const margin = (bonData.bedrag ?? 0) * 0.15;
      const winkelLower = (bonData.winkel ?? "").toLowerCase();

      const conditions = [
        eq(bankTransacties.type, "af"),
        sql`${bankTransacties.bonPad} IS NULL`,
      ];

      // Zoek op bedrag OF naam — niet allebei verplicht
      // Bank bedragen zijn negatief voor "af" transacties, bonnetje is positief
      const absBedrag = Math.abs(bonData.bedrag ?? 0);
      if (bonData.bedrag && winkelLower) {
        conditions.push(sql`(ABS(ABS(${bankTransacties.bedrag}) - ${absBedrag}) < ${margin} OR LOWER(COALESCE(${bankTransacties.merchantNaam}, '') || ' ' || COALESCE(${bankTransacties.omschrijving}, '')) LIKE ${'%' + winkelLower + '%'})`);
      } else if (bonData.bedrag) {
        conditions.push(sql`ABS(ABS(${bankTransacties.bedrag}) - ${absBedrag}) < ${margin}`);
      } else {
        conditions.push(sql`LOWER(COALESCE(${bankTransacties.merchantNaam}, '') || ' ' || COALESCE(${bankTransacties.omschrijving}, '')) LIKE ${'%' + winkelLower + '%'}`);
      }

      const matches = await db.select({
        id: bankTransacties.id,
        datum: bankTransacties.datum,
        omschrijving: bankTransacties.omschrijving,
        bedrag: bankTransacties.bedrag,
        merchantNaam: bankTransacties.merchantNaam,
      }).from(bankTransacties).where(and(...conditions)).limit(10);

      // Score matches
      if (matches.length > 0) {
        // Best match: closest amount + closest date + name similarity
        const scored = matches.map(m => {
          let score = 0;
          score += 10 - Math.abs(Math.abs(m.bedrag) - Math.abs(bonData.bedrag ?? 0)) * 2; // Amount closeness
          if (bonData.datum) {
            const dayDiff = Math.abs(new Date(m.datum).getTime() - new Date(bonData.datum).getTime()) / 86400000;
            score += 5 - dayDiff * 2;
          }
          if (bonData.winkel && (m.merchantNaam || m.omschrijving || "").toLowerCase().includes(bonData.winkel.toLowerCase())) {
            score += 10; // Name match bonus
          }
          return { ...m, score };
        }).sort((a, b) => b.score - a.score);

        matchedTransactie = scored[0];

        // Auto-link if score is high enough
        if (matchedTransactie.score >= 5) {
          await db.update(bankTransacties).set({
            bonPad,
            storageUrl: storagePath,
            categorie: bonData.categorie || undefined,
            btwBedrag: bonData.btwBedrag || undefined,
          }).where(eq(bankTransacties.id, matchedTransactie.id));
        }
      }
    }

    return NextResponse.json({
      succes: true,
      bonPad,
      ocr: bonData,
      match: matchedTransactie ? {
        id: matchedTransactie.id,
        datum: matchedTransactie.datum,
        omschrijving: matchedTransactie.omschrijving,
        bedrag: matchedTransactie.bedrag,
        autoGekoppeld: (matchedTransactie as { score: number }).score >= 5,
      } : null,
      suggesties: matchedTransactie ? undefined : "Geen matching transactie gevonden. Koppel handmatig.",
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Upload mislukt" },
      { status: 500 }
    );
  }
}

// GET: List all receipts
export async function GET() {
  try {
    const { requireAuth } = await import("@/lib/auth");
    await requireAuth();

    const metBon = await db.select({
      id: bankTransacties.id,
      datum: bankTransacties.datum,
      omschrijving: bankTransacties.omschrijving,
      bedrag: bankTransacties.bedrag,
      bonPad: bankTransacties.bonPad,
      categorie: bankTransacties.categorie,
    }).from(bankTransacties)
      .where(sql`${bankTransacties.bonPad} IS NOT NULL`)
      .orderBy(sql`${bankTransacties.datum} DESC`);

    const zonderBon = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(bankTransacties).where(
      and(
        eq(bankTransacties.type, "af"),
        sql`${bankTransacties.bonPad} IS NULL`,
        sql`${bankTransacties.fiscaalType} != 'prive' OR ${bankTransacties.fiscaalType} IS NULL`
      )
    );

    return NextResponse.json({
      metBon,
      zonderBon: zonderBon[0]?.count ?? 0,
    });
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Laden mislukt" }, { status: 500 });
  }
}
