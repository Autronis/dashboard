import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten, projecten, facturen, taken, leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { like, eq, sql, or } from "drizzle-orm";
import { fetchAllDocuments } from "@/lib/notion";
import { DocumentBase } from "@/types/documenten";

interface ZoekResultaat {
  type: "klant" | "project" | "factuur" | "taak" | "lead" | "document";
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
      documentCache = { data: await fetchAllDocuments(), timestamp: Date.now() };
    } catch {
      // Return stale cache on error
    }
  }
  return documentCache.data;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const q = req.nextUrl.searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ resultaten: [] });
    }

    const zoekterm = `%${q}%`;
    const resultaten: ZoekResultaat[] = [];

    const [klantenRes, projectenRes, facturenRes, takenRes, leadsRes] = await Promise.all([
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
