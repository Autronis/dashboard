import { NextRequest, NextResponse } from "next/server";
import { db, tursoClient } from "@/lib/db";
import { wikiArtikelen, secondBrainItems, ideeen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

const TOEGESTANE_CATEGORIES = [
  "processen", "klanten", "technisch", "templates", "financien",
  "strategie", "geleerde-lessen", "tools", "ideeen", "educatie",
] as const;
type Categorie = typeof TOEGESTANE_CATEGORIES[number];

type BronType = "second-brain" | "idee" | "yt-knowledge" | "insta-knowledge";

interface PromoteBody {
  bronType: BronType;
  bronId: number | string;
  titel?: string;
  categorie?: Categorie;
  tags?: string[];
}

// POST /api/wiki/promote — promoot een source-item naar een Wiki-artikel en
// markeert de bron met `gepromoted_naar_wiki_id` + zet `bron_type` + `bron_id`
// op het nieuwe Wiki-artikel. Een item mag maar één keer gepromoot worden —
// we returnen het bestaande artikel als er al een link is.
//
// Sources:
//  - second-brain (Drizzle) — bronId int
//  - idee         (Drizzle) — bronId int
//  - yt-knowledge (raw ytk_videos via Turso) — bronId int
//  - insta-knowledge (raw isk_items via Turso) — bronId text (UUID)
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();

    const body = (await req.json()) as PromoteBody;
    const { bronType } = body;
    const bronIdStr = String(body.bronId ?? "");

    if (!bronType || !bronIdStr) {
      return NextResponse.json({ fout: "bronType en bronId zijn verplicht" }, { status: 400 });
    }

    const categorie: Categorie =
      body.categorie && TOEGESTANE_CATEGORIES.includes(body.categorie)
        ? body.categorie
        : "geleerde-lessen";

    let titel = body.titel?.trim() ?? "";
    let inhoud = "";

    if (bronType === "second-brain") {
      const bronIdNum = Number(bronIdStr);
      const [item] = await db
        .select()
        .from(secondBrainItems)
        .where(eq(secondBrainItems.id, bronIdNum));
      if (!item) return NextResponse.json({ fout: "Second Brain item niet gevonden" }, { status: 404 });
      if (item.gepromotedNaarWikiId) {
        const [bestaand] = await db
          .select()
          .from(wikiArtikelen)
          .where(eq(wikiArtikelen.id, item.gepromotedNaarWikiId));
        return NextResponse.json({ artikel: bestaand, reeds: true });
      }
      if (!titel) titel = item.titel?.trim() || `SB #${item.id}`;
      const delen: string[] = [];
      if (item.inhoud) delen.push(item.inhoud);
      if (item.bronUrl) delen.push(`\n\n**Bron:** ${item.bronUrl}`);
      if (item.aiSamenvatting) delen.push(`\n\n**Samenvatting:**\n${item.aiSamenvatting}`);
      inhoud = delen.join("");
    } else if (bronType === "idee") {
      const bronIdNum = Number(bronIdStr);
      const [item] = await db.select().from(ideeen).where(eq(ideeen.id, bronIdNum));
      if (!item) return NextResponse.json({ fout: "Idee niet gevonden" }, { status: 404 });
      if (item.gepromotedNaarWikiId) {
        const [bestaand] = await db
          .select()
          .from(wikiArtikelen)
          .where(eq(wikiArtikelen.id, item.gepromotedNaarWikiId));
        return NextResponse.json({ artikel: bestaand, reeds: true });
      }
      if (!titel) titel = item.naam;
      const delen: string[] = [];
      if (item.omschrijving) delen.push(item.omschrijving);
      if (item.uitwerking) delen.push(`\n\n---\n\n${item.uitwerking}`);
      if (item.doelgroep) delen.push(`\n\n**Doelgroep:** ${item.doelgroep}`);
      if (item.verdienmodel) delen.push(`\n\n**Verdienmodel:** ${item.verdienmodel}`);
      inhoud = delen.join("");
    } else if (bronType === "yt-knowledge") {
      if (!tursoClient) return NextResponse.json({ fout: "YT backend vereist Turso" }, { status: 500 });
      const res = await tursoClient.execute({
        sql: "SELECT v.id, v.title, v.channel_name, v.url, v.gepromoted_naar_wiki_id, a.summary, a.features, a.steps, a.tips, a.links, a.relevance_score, a.relevance_reason FROM ytk_videos v LEFT JOIN ytk_analyses a ON v.id = a.video_id WHERE v.id = ?",
        args: [bronIdStr],
      });
      const video = res.rows[0];
      if (!video) return NextResponse.json({ fout: "YT video niet gevonden" }, { status: 404 });
      if (video.gepromoted_naar_wiki_id) {
        const [bestaand] = await db
          .select()
          .from(wikiArtikelen)
          .where(eq(wikiArtikelen.id, Number(video.gepromoted_naar_wiki_id)));
        return NextResponse.json({ artikel: bestaand, reeds: true });
      }
      if (!titel) titel = `${video.title}${video.channel_name ? ` — ${video.channel_name}` : ""}`;
      inhoud = buildVideoInhoud(video);
    } else if (bronType === "insta-knowledge") {
      if (!tursoClient) return NextResponse.json({ fout: "Insta backend vereist Turso" }, { status: 500 });
      const res = await tursoClient.execute({
        sql: "SELECT i.id, i.instagram_id, i.type, i.url, i.caption, i.author_handle, i.gepromoted_naar_wiki_id, a.summary, a.features, a.steps, a.tips, a.links, a.relevance_score, a.relevance_reason FROM isk_items i LEFT JOIN isk_analyses a ON a.item_id = i.id WHERE i.id = ?",
        args: [bronIdStr],
      });
      const item = res.rows[0];
      if (!item) return NextResponse.json({ fout: "Instagram item niet gevonden" }, { status: 404 });
      if (item.gepromoted_naar_wiki_id) {
        const [bestaand] = await db
          .select()
          .from(wikiArtikelen)
          .where(eq(wikiArtikelen.id, Number(item.gepromoted_naar_wiki_id)));
        return NextResponse.json({ artikel: bestaand, reeds: true });
      }
      if (!titel) titel = (item.caption as string)?.slice(0, 80) || `Instagram ${item.type} @${item.author_handle ?? "?"}`;
      inhoud = buildInstaInhoud(item);
    } else {
      return NextResponse.json({ fout: `Promote vanaf ${bronType} nog niet ondersteund` }, { status: 400 });
    }

    if (!titel) return NextResponse.json({ fout: "Titel is verplicht" }, { status: 400 });

    const [artikel] = await db
      .insert(wikiArtikelen)
      .values({
        titel,
        inhoud,
        categorie,
        tags: JSON.stringify(body.tags ?? []),
        auteurId: gebruiker.id,
        gepubliceerd: 1,
        bronType,
        bronId: bronIdStr,
      })
      .returning();

    if (bronType === "second-brain") {
      await db
        .update(secondBrainItems)
        .set({ gepromotedNaarWikiId: artikel.id })
        .where(eq(secondBrainItems.id, Number(bronIdStr)));
    } else if (bronType === "idee") {
      await db
        .update(ideeen)
        .set({ gepromotedNaarWikiId: artikel.id })
        .where(eq(ideeen.id, Number(bronIdStr)));
    } else if (bronType === "yt-knowledge" && tursoClient) {
      await tursoClient.execute({
        sql: "UPDATE ytk_videos SET gepromoted_naar_wiki_id = ? WHERE id = ?",
        args: [artikel.id, bronIdStr],
      });
    } else if (bronType === "insta-knowledge" && tursoClient) {
      await tursoClient.execute({
        sql: "UPDATE isk_items SET gepromoted_naar_wiki_id = ? WHERE id = ?",
        args: [artikel.id, bronIdStr],
      });
    }

    return NextResponse.json({ artikel }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

function parseJsonArr(v: unknown): string[] {
  if (!v) return [];
  try {
    const p = JSON.parse(String(v));
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

function buildVideoInhoud(v: Record<string, unknown>): string {
  const delen: string[] = [];
  if (v.url) delen.push(`**URL:** ${v.url}`);
  if (v.channel_name) delen.push(`**Kanaal:** ${v.channel_name}`);
  if (v.relevance_score != null) delen.push(`**Relevance score:** ${v.relevance_score}/10`);
  if (v.summary) delen.push(`\n## Samenvatting\n\n${v.summary}`);
  const features = parseJsonArr(v.features);
  if (features.length) delen.push(`\n## Features\n\n${features.map((f) => `- ${f}`).join("\n")}`);
  const steps = parseJsonArr(v.steps);
  if (steps.length) delen.push(`\n## Stappen\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
  const tips = parseJsonArr(v.tips);
  if (tips.length) delen.push(`\n## Tips\n\n${tips.map((t) => `- ${t}`).join("\n")}`);
  const links = parseJsonArr(v.links);
  if (links.length) delen.push(`\n## Links\n\n${links.map((l) => `- ${l}`).join("\n")}`);
  if (v.relevance_reason) delen.push(`\n---\n\n_${v.relevance_reason}_`);
  return delen.join("\n\n");
}

function buildInstaInhoud(item: Record<string, unknown>): string {
  const delen: string[] = [];
  if (item.url) delen.push(`**URL:** ${item.url}`);
  if (item.author_handle) delen.push(`**Handle:** @${item.author_handle}`);
  if (item.relevance_score != null) delen.push(`**Relevance score:** ${item.relevance_score}/10`);
  if (item.caption) delen.push(`\n## Caption\n\n${item.caption}`);
  if (item.summary) delen.push(`\n## Samenvatting\n\n${item.summary}`);
  const features = parseJsonArr(item.features);
  if (features.length) delen.push(`\n## Features\n\n${features.map((f) => `- ${f}`).join("\n")}`);
  const steps = parseJsonArr(item.steps);
  if (steps.length) delen.push(`\n## Stappen\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
  const tips = parseJsonArr(item.tips);
  if (tips.length) delen.push(`\n## Tips\n\n${tips.map((t) => `- ${t}`).join("\n")}`);
  const links = parseJsonArr(item.links);
  if (links.length) delen.push(`\n## Links\n\n${links.map((l) => `- ${l}`).join("\n")}`);
  if (item.relevance_reason) delen.push(`\n---\n\n_${item.relevance_reason}_`);
  return delen.join("\n\n");
}
