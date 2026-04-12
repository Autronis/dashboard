/**
 * Seed 9 default persoonlijke habits voor Sem
 *
 * Usage: npx tsx scripts/seed-persoonlijke-habits.ts
 */

import { db } from "@/lib/db";
import { persoonlijkeHabits } from "@/lib/db/schema";

const HABITS = [
  { naam: "6:30 opgestaan", type: "ochtend" as const, tijd: "06:30", volgorde: 1 },
  { naam: "7:00 in de gym", type: "ochtend" as const, tijd: "07:00", volgorde: 2 },
  { naam: "8:15 op kantoor", type: "ochtend" as const, tijd: "08:15", volgorde: 3 },
  { naam: "Ontbijt (kwark/havermout/fruit)", type: "ochtend" as const, tijd: "08:30", volgorde: 4 },
  { naam: "5G uit op kantoor", type: "hele_dag" as const, tijd: null, volgorde: 5 },
  { naam: "Telefoon NIET in badkamer", type: "hele_dag" as const, tijd: null, volgorde: 6 },
  { naam: "Geen porno", type: "hele_dag" as const, tijd: null, volgorde: 7 },
  { naam: "Voor 23:00 in bed", type: "avond" as const, tijd: "23:00", volgorde: 8 },
  { naam: "Geen schermen voor slapen", type: "avond" as const, tijd: null, volgorde: 9 },
];

async function seed() {
  const existing = await db.select().from(persoonlijkeHabits);
  if (existing.length > 0) {
    console.log(`Skip: ${existing.length} habits already exist.`);
    return;
  }
  for (const h of HABITS) {
    await db.insert(persoonlijkeHabits).values(h);
  }
  console.log(`Seeded ${HABITS.length} habits.`);
}

seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });