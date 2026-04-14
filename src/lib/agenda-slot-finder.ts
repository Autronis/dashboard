import { db } from "@/lib/db";
import { taken } from "@/lib/db/schema";
import { or, eq } from "drizzle-orm";

/**
 * Anti-overlap slot finder voor de agenda. Gebruikt door:
 * - /api/agenda/ai-plan (inline versie bestond al)
 * - /api/taken/slim (nieuwe gebruik voor direct inplannen)
 *
 * Geeft het eerste vrije slot op een werkdag terug dat niet botst met
 * de blocking intervals (bestaande ingeplande taken + items die in
 * dezelfde call eerder zijn gepland).
 */

export interface BlockingInterval {
  start: number; // unix ms
  eind: number;
  label?: string;
}

export interface VrijSlot {
  start: number;
  eind: number;
}

/**
 * Vind een vrij slot op de gegeven datum dat niet botst met blocking
 * intervals. Begint bij `startVoorstel` (HH:MM formaat), schuift door
 * zolang er botsingen zijn, max 20 iteraties, respecteert dag eind.
 *
 * Returns null als er geen plek is op de dag (alles vol of voorstel na
 * dag eind).
 */
export function findVrijSlot(
  datum: string, // YYYY-MM-DD
  startVoorstel: string, // HH:MM — vroegste voorkeur
  duurMinuten: number,
  blockers: BlockingInterval[],
  dagEind: string = "17:00"
): VrijSlot | null {
  const voorstel = new Date(`${datum}T${startVoorstel}:00`).getTime();
  const dagEindMs = new Date(`${datum}T${dagEind}:00`).getTime();
  if (isNaN(voorstel) || isNaN(dagEindMs)) return null;

  const duurMs = duurMinuten * 60000;
  let s = voorstel;
  let e = s + duurMs;

  for (let iter = 0; iter < 20; iter++) {
    if (e > dagEindMs) return null;
    const botsing = blockers.find((b) => s < b.eind && e > b.start);
    if (!botsing) return { start: s, eind: e };
    // Schuif naar het einde van de botsende blocker + 5 min buffer
    s = botsing.eind + 5 * 60000;
    e = s + duurMs;
  }
  return null;
}

/**
 * Haal alle bestaande blocking intervals op voor een specifieke datum.
 * Pakt alle taken met status open OR bezig en ingeplandStart op die dag.
 */
export async function getBlockingIntervalsVoorDag(
  datum: string
): Promise<BlockingInterval[]> {
  const rows = await db
    .select({
      id: taken.id,
      titel: taken.titel,
      ingeplandStart: taken.ingeplandStart,
      ingeplandEind: taken.ingeplandEind,
      geschatteDuur: taken.geschatteDuur,
    })
    .from(taken)
    .where(or(eq(taken.status, "open"), eq(taken.status, "bezig")))
    .all();

  const intervals: BlockingInterval[] = [];
  for (const t of rows) {
    if (!t.ingeplandStart?.startsWith(datum)) continue;
    const s = new Date(t.ingeplandStart).getTime();
    const fallbackDuur = (t.geschatteDuur ?? 30) * 60000;
    const e = t.ingeplandEind ? new Date(t.ingeplandEind).getTime() : s + fallbackDuur;
    if (isNaN(s) || isNaN(e)) continue;
    intervals.push({ start: s, eind: e, label: t.titel });
  }
  return intervals;
}

/**
 * Helper: format een unix ms timestamp naar ISO local datetime string
 * (YYYY-MM-DDTHH:MM:SS) zoals de DB verwacht.
 */
export function formatSlotToIso(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
