// src/app/proposal/[token]/page.tsx
import { db } from "@/lib/db";
import { proposals, proposalRegels, klanten } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { parseSlides } from "@/lib/proposal-schema";
import { DeckViewer } from "@/components/proposal-deck/DeckViewer";

export const dynamic = "force-dynamic";

export default async function PublicProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { token } = await params;
  const { preview } = await searchParams;

  const [row] = await db
    .select({
      id: proposals.id,
      klantNaam: klanten.bedrijfsnaam,
      titel: proposals.titel,
      status: proposals.status,
      secties: proposals.secties,
      totaalBedrag: proposals.totaalBedrag,
      geldigTot: proposals.geldigTot,
      aangemaaktOp: proposals.aangemaaktOp,
    })
    .from(proposals)
    .innerJoin(klanten, eq(proposals.klantId, klanten.id))
    .where(eq(proposals.token, token));

  if (!row) return notFound();

  const regels = await db
    .select()
    .from(proposalRegels)
    .where(eq(proposalRegels.proposalId, row.id));

  // Auto-transition status (skip if preview mode)
  if (!preview && row.status === "verzonden") {
    await db
      .update(proposals)
      .set({ status: "bekeken", bijgewerktOp: new Date().toISOString() })
      .where(eq(proposals.id, row.id));
  }

  const slides = parseSlides(row.secties);

  return (
    <DeckViewer
      slides={slides}
      context={{
        meta: {
          titel: row.titel,
          klantNaam: row.klantNaam,
          datum: row.aangemaaktOp,
          geldigTot: row.geldigTot,
          totaalBedrag: row.totaalBedrag,
        },
        regels,
      }}
      pdfUrl={`/api/proposals/${row.id}/pdf`}
    />
  );
}
