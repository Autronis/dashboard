// src/lib/insta-knowledge/idea.ts
import { db } from "@/lib/db";
import { ideeen, gebruikers } from "@/lib/db/schema";
import { and, eq, like, sql } from "drizzle-orm";
import type { AnalysisResult } from "./types";

interface ItemContext {
  instagramId: string;
  url: string;
  authorHandle: string;
  type: "reel" | "post";
}

export async function createIdeaIfRelevant(
  item: ItemContext,
  analysis: AnalysisResult,
  analysisId: string
): Promise<{ created: boolean; ideaId?: number }> {
  if (analysis.relevance_score < 9) return { created: false };

  const existing = await db
    .select({ id: ideeen.id })
    .from(ideeen)
    .where(
      and(
        eq(ideeen.bron, "insta-knowledge"),
        like(ideeen.bronTekst, `%"instagramId":"${item.instagramId}"%`)
      )
    )
    .get();
  if (existing) return { created: false };

  const defaultUser = await db.select().from(gebruikers).limit(1).get();
  const userId = defaultUser?.id ?? 1;

  const featuresText = analysis.features
    .map((f) => `- **${f.name}**: ${f.description}`).join("\n");
  const stepsText = analysis.steps
    .map((s) => `${s.order}. **${s.title}**\n   ${s.description}${s.code_snippet ? `\n   \`${s.code_snippet}\`` : ""}`)
    .join("\n");
  const tipsText = analysis.tips.map((t) => `- ${t.tip} — _${t.context}_`).join("\n");
  const linksText = analysis.links
    .map((l) => `- [${l.label}](${l.url}) _(${l.type})_`).join("\n");

  const omschrijving =
    `${analysis.summary}\n\n**Relevantie:** ${analysis.relevance_score}/10 — ${analysis.relevance_reason}\n\n[Bekijk op Instagram](${item.url})`;
  const uitwerking =
    `## Features\n${featuresText}\n\n## Stappenplan\n${stepsText}\n\n## Tips\n${tipsText}${linksText ? `\n\n## Links\n${linksText}` : ""}\n\n---\n_Bron: Instagram ${item.type} van @${item.authorHandle} — Insta Knowledge Pipeline_`;

  const maxNummer = await db
    .select({ max: sql<number>`MAX(nummer)` })
    .from(ideeen).get();
  const nextNummer = (maxNummer?.max ?? 0) + 1;

  const bronTekst = JSON.stringify({
    instagramId: item.instagramId,
    itemUrl: item.url,
    authorHandle: item.authorHandle,
    type: item.type,
    analysisId,
    relevanceScore: analysis.relevance_score,
  });

  const inserted = await db.insert(ideeen).values({
    nummer: nextNummer,
    naam: analysis.idea_title,
    categorie: "content_media",
    status: "idee",
    prioriteit: "normaal",
    doelgroep: "persoonlijk",
    omschrijving,
    uitwerking,
    aiScore: analysis.relevance_score,
    isAiSuggestie: 1,
    gepromoveerd: 0,
    bron: "insta-knowledge",
    bronTekst,
    aangemaaktDoor: userId,
  }).returning({ id: ideeen.id }).get();

  return { created: true, ideaId: inserted?.id };
}
