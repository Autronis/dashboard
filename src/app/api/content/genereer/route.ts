import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentProfiel, contentInzichten, contentPosts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, inArray } from "drizzle-orm";
import { generateContentBatch } from "@/lib/ai/content-generator";

function getCurrentIsoWeek(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();

    const body = await req.json() as { count?: number; platforms?: string[]; format?: string };
    const count = typeof body.count === "number" && body.count > 0 ? body.count : 7;
    const format = typeof body.format === "string" ? body.format : undefined;
    const platforms = (
      Array.isArray(body.platforms) && body.platforms.length > 0
        ? body.platforms.filter((p): p is "linkedin" | "instagram" =>
            p === "linkedin" || p === "instagram"
          )
        : ["linkedin", "instagram"]
    ) as ("linkedin" | "instagram")[];

    // Fetch profiel entries
    const profielEntries = await db.select().from(contentProfiel);

    const profielMap: Record<string, string> = {};
    for (const entry of profielEntries) {
      profielMap[entry.onderwerp] = entry.inhoud;
    }

    const profiel = {
      over_ons: profielMap["over_ons"] ?? "",
      diensten: profielMap["diensten"] ?? "",
      usps: profielMap["usps"] ?? "",
      tone_of_voice: profielMap["tone_of_voice"] ?? "",
    };

    // Fetch unused inzichten
    const inzichten = await db
      .select({
        id: contentInzichten.id,
        titel: contentInzichten.titel,
        inhoud: contentInzichten.inhoud,
        categorie: contentInzichten.categorie,
      })
      .from(contentInzichten)
      .where(eq(contentInzichten.isGebruikt, 0));

    const inzichtenInput = inzichten.map((i) => ({
      titel: i.titel,
      inhoud: i.inhoud,
      categorie: i.categorie,
    }));

    // Generate via AI
    const generated = await generateContentBatch(profiel, inzichtenInput, count, platforms, format);

    // Save posts to DB
    const batchId = crypto.randomUUID();
    const batchWeek = getCurrentIsoWeek();

    const insertedPosts = await db
      .insert(contentPosts)
      .values(
        generated.map((post) => {
          // Find matching inzicht id for tracking
          const matchedInzicht = post.inzichtTitel
            ? inzichten.find((i) => i.titel === post.inzichtTitel)
            : undefined;

          return {
            titel: post.titel,
            inhoud: post.inhoud,
            platform: post.platform,
            format: post.format as "post" | "caption" | "thought_leadership" | "tip" | "storytelling" | "how_to" | "vraag",
            status: "concept" as const,
            batchId,
            batchWeek,
            inzichtId: matchedInzicht?.id ?? null,
            gegenereerdeHashtags: JSON.stringify(post.hashtags),
            aangemaaktDoor: gebruiker.id,
          };
        })
      )
      .returning();

    // Mark used inzichten
    const usedInzichtIds = inzichten
      .filter((i) =>
        generated.some((post) => post.inzichtTitel === i.titel)
      )
      .map((i) => i.id);

    if (usedInzichtIds.length > 0) {
      await db
        .update(contentInzichten)
        .set({ isGebruikt: 1 })
        .where(inArray(contentInzichten.id, usedInzichtIds));
    }

    const posts = insertedPosts.map((row) => ({
      ...row,
      hashtags: (() => {
        try {
          return JSON.parse(row.gegenereerdeHashtags ?? "[]") as string[];
        } catch {
          return [];
        }
      })(),
    }));

    return NextResponse.json({ posts, batchId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
