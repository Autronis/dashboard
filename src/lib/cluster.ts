import { db } from "@/lib/db";
import { taken, projecten } from "@/lib/db/schema";
import { and, eq, desc, isNotNull, inArray } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

export const VALID_CLUSTERS = [
  "backend-infra",
  "frontend",
  "klantcontact",
  "content",
  "admin",
  "research",
] as const;

export type ClusterNaam = (typeof VALID_CLUSTERS)[number];

const VALID_SET = new Set<string>(VALID_CLUSTERS);

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
/**
 * Classificeert een enkele taak in één van de zes standaard Autronis
 * clusters via een Claude API call. Gebruikt door de lazy classifier in
 * PUT /api/taken/[id] wanneer iemand een taak inplant of op bezig zet
 * zonder cluster — zo hoeft de gebruiker nooit zelf te typen.
 *
 * Retourneert de cluster naam, of null als er geen zinnige classificatie
 * mogelijk was (AI returnde nonsense, API call faalde, etc). De caller
 * moet hier rekening mee houden en gewoon verder gaan zonder cluster.
 *
 * Side-effect: als een cluster wordt gevonden, wordt de taak meteen in
 * de DB geüpdatet. Dit zorgt dat volgende calls dezelfde classificatie
 * hergebruiken.
 */
export async function classifyTaakCluster(taakId: number): Promise<ClusterNaam | null> {
  try {
    const rij = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        omschrijving: taken.omschrijving,
        fase: taken.fase,
        cluster: taken.cluster,
        projectNaam: projecten.naam,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .where(eq(taken.id, taakId))
      .limit(1);

    const taak = rij[0];
    if (!taak) return null;
    if (taak.cluster && VALID_SET.has(taak.cluster)) {
      return taak.cluster as ClusterNaam;
    }

    const anthropic = Anthropic(undefined, "/api/taken/auto-cluster:single");
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `Je classificeert één taak voor softwarebedrijf Autronis in precies één van deze zes clusters:

- backend-infra: Supabase, n8n workflows, edge functions, API routes, scripts, database migraties, server-side integraties, DevOps, webhooks
- frontend: Lovable prototypes, dashboard widgets, UI componenten, Next.js pages, HTML email templates, React, Tailwind, animaties
- klantcontact: Intake calls, offertes, klant onboarden, follow-up mails, afspraken, presentaties, demo's
- content: Copy, blog posts, social media, video scripts, design werk, branding, images, SEO
- admin: Facturen, financiën, planning, belasting, administratie, documentatie, urenregistratie
- research: Concurrentie analyse, tool vergelijk, YouTube research, markt onderzoek, technische spikes

Antwoord met PRECIES één woord: een van deze zes cluster namen. Niks anders, geen uitleg, geen punten.`,
      messages: [{
        role: "user",
        content: `Taak: "${taak.titel}"
${taak.omschrijving ? `Omschrijving: ${taak.omschrijving.slice(0, 400)}` : ""}
${taak.fase ? `Fase: ${taak.fase}` : ""}
${taak.projectNaam ? `Project: ${taak.projectNaam}` : ""}`,
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    // Strip quotes, punctuation, whitespace
    const cleaned = raw.toLowerCase().replace(/[.\s"'`]/g, "").replace(/[^a-z-]/g, "");
    const match = VALID_CLUSTERS.find((c) => cleaned.includes(c));
    if (!match) return null;

    await db
      .update(taken)
      .set({ cluster: match, bijgewerktOp: new Date().toISOString() })
      .where(eq(taken.id, taakId));

    return match;
  } catch {
    // AI call faalde — niet kritiek, caller werkt zonder cluster door
    return null;
  }
}

export async function inferClusterOwner(
  projectId: number,
  cluster: string | null | undefined,
  fase?: string | null
): Promise<number | null> {
  if (!projectId) return null;

  // Primary: probeer een eigenaar te vinden binnen ditzelfde (project, cluster).
  if (cluster) {
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
    if (rij[0]?.toegewezenAan) return rij[0].toegewezenAan;
  }

  // Fallback: geen cluster (of niemand werkt al in dit cluster), maar wel een
  // fase. Erf de eigenaar van de meest recente werkende taak in dezelfde
  // (project, fase). Dit is een zwakkere signaal — meerdere clusters kunnen
  // namelijk in één fase zitten — maar voor projecten waar nog geen cluster
  // gezet is geeft dit nog steeds de juiste persoon mee in plaats van vrij
  // te laten. Zie taak #104434.
  if (fase) {
    const rij = await db
      .select({ toegewezenAan: taken.toegewezenAan })
      .from(taken)
      .where(
        and(
          eq(taken.projectId, projectId),
          eq(taken.fase, fase),
          isNotNull(taken.toegewezenAan),
          inArray(taken.status, ["bezig", "afgerond"])
        )
      )
      .orderBy(desc(taken.bijgewerktOp))
      .limit(1);
    return rij[0]?.toegewezenAan ?? null;
  }

  return null;
}
