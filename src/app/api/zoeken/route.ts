import { NextRequest, NextResponse } from "next/server";
import { db, tursoClient } from "@/lib/db";
import { klanten, projecten, facturen, taken, leads, secondBrainItems, wikiArtikelen, ideeen, radarItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { like, eq, sql, or, and, desc } from "drizzle-orm";
import { fetchAllDocuments, searchNotionDocuments } from "@/lib/notion";
import { DocumentBase } from "@/types/documenten";

interface ZoekResultaat {
  type:
    | "klant"
    | "project"
    | "factuur"
    | "taak"
    | "lead"
    | "document"
    | "second-brain"
    | "wiki"
    | "idee"
    | "radar"
    | "yt-knowledge"
    | "insta-knowledge";
  id: number | string;
  titel: string;
  subtitel: string | null;
  link?: string;
  externalUrl?: string;
}

let documentCache: { data: DocumentBase[]; timestamp: number } = { data: [], timestamp: 0 };
const CACHE_TTL = 60_000;

async function getCachedDocuments(): Promise<DocumentBase[]> {
  if (Date.now() - documentCache.timestamp > CACHE_TTL) {
    try {
      const result = await fetchAllDocuments({ pageSize: 100 });
      documentCache = { data: result.documenten, timestamp: Date.now() };
    } catch {
      // Return stale cache on error
    }
  }
  return documentCache.data;
}

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const q = req.nextUrl.searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ resultaten: [] });
    }

    const zoekterm = `%${q}%`;
    const resultaten: ZoekResultaat[] = [];

    const [klantenRes, projectenRes, facturenRes, takenRes, leadsRes, secondBrainRes, wikiRes, ideeenRes, radarRes] = await Promise.all([
      db
        .select({ id: klanten.id, bedrijfsnaam: klanten.bedrijfsnaam, contactpersoon: klanten.contactpersoon })
        .from(klanten)
        .where(or(like(klanten.bedrijfsnaam, zoekterm), like(klanten.contactpersoon, zoekterm)))
        .limit(5),

      db
        .select({ id: projecten.id, naam: projecten.naam, klantId: projecten.klantId, klantNaam: klanten.bedrijfsnaam })
        .from(projecten)
        .innerJoin(klanten, eq(projecten.klantId, klanten.id))
        .where(like(projecten.naam, zoekterm))
        .limit(5),

      db
        .select({ id: facturen.id, factuurnummer: facturen.factuurnummer, klantNaam: klanten.bedrijfsnaam })
        .from(facturen)
        .innerJoin(klanten, eq(facturen.klantId, klanten.id))
        .where(or(like(facturen.factuurnummer, zoekterm), like(klanten.bedrijfsnaam, zoekterm)))
        .limit(5),

      db
        .select({ id: taken.id, titel: taken.titel, projectNaam: sql<string>`coalesce(${projecten.naam}, '')` })
        .from(taken)
        .leftJoin(projecten, eq(taken.projectId, projecten.id))
        .where(like(taken.titel, zoekterm))
        .limit(5),

      db
        .select({ id: leads.id, bedrijfsnaam: leads.bedrijfsnaam, contactpersoon: leads.contactpersoon })
        .from(leads)
        .where(or(like(leads.bedrijfsnaam, zoekterm), like(leads.contactpersoon, zoekterm)))
        .limit(5),

      db
        .select({
          id: secondBrainItems.id,
          titel: secondBrainItems.titel,
          samenvatting: secondBrainItems.aiSamenvatting,
        })
        .from(secondBrainItems)
        .where(
          and(
            eq(secondBrainItems.gebruikerId, gebruiker.id),
            eq(secondBrainItems.isGearchiveerd, 0),
            or(
              like(secondBrainItems.titel, zoekterm),
              like(secondBrainItems.inhoud, zoekterm),
              like(secondBrainItems.aiSamenvatting, zoekterm)
            )
          )
        )
        .limit(5),

      db
        .select({ id: wikiArtikelen.id, titel: wikiArtikelen.titel, categorie: wikiArtikelen.categorie })
        .from(wikiArtikelen)
        .where(or(like(wikiArtikelen.titel, zoekterm), like(wikiArtikelen.inhoud, zoekterm)))
        .orderBy(desc(wikiArtikelen.bijgewerktOp))
        .limit(5),

      db
        .select({ id: ideeen.id, naam: ideeen.naam, status: ideeen.status, categorie: ideeen.categorie })
        .from(ideeen)
        .where(or(like(ideeen.naam, zoekterm), like(ideeen.omschrijving, zoekterm), like(ideeen.uitwerking, zoekterm)))
        .orderBy(desc(ideeen.bijgewerktOp))
        .limit(5),

      db
        .select({ id: radarItems.id, titel: radarItems.titel, url: radarItems.url, score: radarItems.score })
        .from(radarItems)
        .where(
          and(
            eq(radarItems.nietRelevant, 0),
            or(like(radarItems.titel, zoekterm), like(radarItems.beschrijving, zoekterm), like(radarItems.aiSamenvatting, zoekterm))
          )
        )
        .orderBy(desc(radarItems.aangemaaktOp))
        .limit(5),
    ]);

    // YT + Insta live via Turso
    const [ytRes, instaRes] = await Promise.all([
      tursoClient
        ? tursoClient.execute({
            sql: "SELECT v.id, v.title, v.channel_name FROM ytk_videos v LEFT JOIN ytk_analyses a ON v.id = a.video_id WHERE v.title LIKE ? OR a.summary LIKE ? OR a.relevance_reason LIKE ? ORDER BY v.discovered_at DESC LIMIT 5",
            args: [zoekterm, zoekterm, zoekterm],
          })
        : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
      tursoClient
        ? tursoClient.execute({
            sql: "SELECT i.id, i.caption, i.author_handle FROM isk_items i LEFT JOIN isk_analyses a ON a.item_id = i.id WHERE i.caption LIKE ? OR a.summary LIKE ? OR a.relevance_reason LIKE ? ORDER BY i.discovered_at DESC LIMIT 5",
            args: [zoekterm, zoekterm, zoekterm],
          })
        : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
    ]);

    for (const k of klantenRes) {
      resultaten.push({ type: "klant", id: k.id, titel: k.bedrijfsnaam, subtitel: k.contactpersoon, link: `/klanten/${k.id}` });
    }
    for (const p of projectenRes) {
      resultaten.push({ type: "project", id: p.id, titel: p.naam, subtitel: p.klantNaam, link: `/klanten/${p.klantId}/projecten/${p.id}` });
    }
    for (const f of facturenRes) {
      resultaten.push({ type: "factuur", id: f.id, titel: f.factuurnummer, subtitel: f.klantNaam, link: `/financien/${f.id}` });
    }
    for (const t of takenRes) {
      resultaten.push({ type: "taak", id: t.id, titel: t.titel, subtitel: t.projectNaam || null, link: "/taken" });
    }
    for (const l of leadsRes) {
      resultaten.push({ type: "lead", id: l.id, titel: l.bedrijfsnaam, subtitel: l.contactpersoon, link: "/crm" });
    }
    for (const sb of secondBrainRes) {
      resultaten.push({
        type: "second-brain",
        id: sb.id,
        titel: sb.titel || "Zonder titel",
        subtitel: sb.samenvatting,
        link: "/second-brain",
      });
    }
    for (const w of wikiRes) {
      resultaten.push({
        type: "wiki",
        id: w.id,
        titel: w.titel,
        subtitel: w.categorie,
        link: `/wiki/${w.id}`,
      });
    }
    for (const i of ideeenRes) {
      resultaten.push({
        type: "idee",
        id: i.id,
        titel: i.naam,
        subtitel: [i.categorie, i.status].filter(Boolean).join(" · "),
        link: "/ideeen",
      });
    }
    for (const r of radarRes) {
      resultaten.push({
        type: "radar",
        id: r.id,
        titel: r.titel,
        subtitel: r.score != null ? `Score ${r.score}/10` : null,
        externalUrl: r.url,
      });
    }
    for (const v of ytRes.rows) {
      resultaten.push({
        type: "yt-knowledge",
        id: String(v.id),
        titel: String(v.title ?? "Video"),
        subtitel: v.channel_name ? String(v.channel_name) : null,
        link: "/yt-knowledge",
      });
    }
    for (const it of instaRes.rows) {
      const caption = String(it.caption ?? "").slice(0, 80);
      resultaten.push({
        type: "insta-knowledge",
        id: String(it.id),
        titel: caption || `Instagram @${it.author_handle ?? "?"}`,
        subtitel: it.author_handle ? `@${it.author_handle}` : null,
        link: "/insta-knowledge",
      });
    }

    // Title-based search from cache
    try {
      const documenten = await getCachedDocuments();
      const matchingDocs = documenten
        .filter(doc => doc.titel.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 5)
        .map(doc => ({
          id: doc.notionId,
          type: "document" as const,
          titel: doc.titel,
          subtitel: doc.samenvatting || doc.type,
          externalUrl: doc.notionUrl,
        }));
      resultaten.push(...matchingDocs);

      // Content-based search via Notion search API (if query is 3+ chars)
      if (q.length >= 3) {
        const contentResults = await searchNotionDocuments(q);
        const existingIds = new Set(matchingDocs.map(d => d.id));
        const contentDocs = contentResults
          .filter(doc => !existingIds.has(doc.notionId))
          .slice(0, 3)
          .map(doc => ({
            id: doc.notionId,
            type: "document" as const,
            titel: doc.titel,
            subtitel: `Gevonden in document · ${doc.samenvatting || doc.type}`,
            externalUrl: doc.notionUrl,
          }));
        resultaten.push(...contentDocs);
      }
    } catch {
      // Notion search failed silently
    }

    return NextResponse.json({ resultaten });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
