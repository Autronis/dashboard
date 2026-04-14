import { db } from "@/lib/db";
import { taken } from "@/lib/db/schema";
import { and, eq, desc, isNotNull, inArray } from "drizzle-orm";

/**
 * Historische cluster-ownership lookup.
 *
 * Gebruikt wanneer een nieuwe taak in een cluster wordt aangemaakt (of
 * wanneer een bestaande taak voor het eerst een cluster krijgt). Als
 * eerder iemand in ditzelfde (projectId, cluster) tuple werk heeft
 * gedaan — een taak die bezig of afgerond is — dan erft de nieuwe taak
 * dezelfde toegewezenAan. Zo "blijft" een cluster binnen een project
 * bij de persoon die er al context van heeft.
 *
 * Voorbeeld: Syb maakt in project "Klant X" een Supabase schema
 * (cluster=backend-infra, toegewezenAan=Syb, status=afgerond). Volgende
 * week maakt Claude een nieuwe taak "API endpoint voor nieuwe tabel"
 * met cluster=backend-infra in project "Klant X". Deze helper returnt
 * Syb's user id zodat de nieuwe taak meteen aan hem wordt toegewezen.
 *
 * Returns null als er nog niemand in dit (project, cluster) werk heeft
 * gedaan — dan blijft de taak vrij (toegewezenAan=null) en gaat via de
 * normale flow (wie eerst oppakt, wint).
 */
export async function inferClusterOwner(
  projectId: number,
  cluster: string | null | undefined
): Promise<number | null> {
  if (!cluster || !projectId) return null;

  const rij = await db
    .select({
      toegewezenAan: taken.toegewezenAan,
      status: taken.status,
      bijgewerktOp: taken.bijgewerktOp,
    })
    .from(taken)
    .where(
      and(
        eq(taken.projectId, projectId),
        eq(taken.cluster, cluster),
        isNotNull(taken.toegewezenAan),
        // Alleen taken waar iemand actief mee bezig is (geweest)
        inArray(taken.status, ["bezig", "afgerond"])
      )
    )
    .orderBy(desc(taken.bijgewerktOp))
    .limit(1);

  return rij[0]?.toegewezenAan ?? null;
}
