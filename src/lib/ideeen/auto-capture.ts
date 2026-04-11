import { db } from "@/lib/db";
import { ideeen } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

interface CaptureInput {
  naam: string;
  omschrijving: string;
  bron: string;
  bronTekst: string;
}

export async function createAutoCapture(input: CaptureInput): Promise<number> {
  // Get next nummer
  const maxResult = await db.all(sql`SELECT MAX(nummer) as max FROM ideeen`);
  const nextNummer = ((maxResult[0] as { max: number | null })?.max ?? 0) + 1;

  const result = await db.insert(ideeen).values({
    nummer: nextNummer,
    naam: input.naam,
    omschrijving: input.omschrijving,
    categorie: "inzicht",
    status: "idee",
    prioriteit: "normaal",
    bron: input.bron,
    bronTekst: input.bronTekst,
    aangemaaktDoor: 1,
  }).run();

  return Number(result.lastInsertRowid);
}
