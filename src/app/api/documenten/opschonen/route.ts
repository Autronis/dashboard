import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fetchAllDocuments, archiveNotionDocument } from "@/lib/notion";

// POST /api/documenten/opschonen — Find and archive duplicate documents
export async function POST() {
  try {
    await requireAuth();

    // Fetch all plan documents (type where duplicates are reported)
    const allDocs = await fetchAllDocuments({ pageSize: 100 });
    const documenten = allDocs.documenten;

    // Group by normalized title + type
    const groups = new Map<string, typeof documenten>();
    for (const doc of documenten) {
      const key = `${doc.type}::${doc.titel.trim().toLowerCase()}`;
      const existing = groups.get(key) ?? [];
      existing.push(doc);
      groups.set(key, existing);
    }

    // Find duplicates (same title + type, keep the newest one)
    const duplicaten: { notionId: string; titel: string; type: string }[] = [];
    const gearchiveerd: string[] = [];

    for (const [, docs] of groups) {
      if (docs.length <= 1) continue;

      // Sort by creation date desc (newest first)
      const sorted = docs.sort((a, b) => b.aangemaaktOp.localeCompare(a.aangemaaktOp));

      // Archive all except the newest
      for (let i = 1; i < sorted.length; i++) {
        duplicaten.push({
          notionId: sorted[i].notionId,
          titel: sorted[i].titel,
          type: sorted[i].type,
        });

        try {
          await archiveNotionDocument(sorted[i].notionId, true);
          gearchiveerd.push(sorted[i].notionId);
        } catch {
          // Skip if archive fails (already archived, etc.)
        }
      }
    }

    return NextResponse.json({
      succes: true,
      totaalDocumenten: documenten.length,
      duplicatenGevonden: duplicaten.length,
      gearchiveerd: gearchiveerd.length,
      details: duplicaten.map((d) => ({
        titel: d.titel,
        type: d.type,
        gearchiveerd: gearchiveerd.includes(d.notionId),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
