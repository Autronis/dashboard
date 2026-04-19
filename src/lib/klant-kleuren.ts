// Stabiele hash van projectId naar één van 10 merkvriendelijke accent-kleuren.
// Zelfde projectId krijgt altijd dezelfde kleur (geen random per render).

const PALET = [
  "#14b8a6", // teal
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ec4899", // pink
  "#22c55e", // green
  "#f97316", // orange
  "#06b6d4", // cyan
  "#eab308", // yellow
  "#ef4444", // red
  "#a855f7", // purple
] as const;

export function klantKleur(projectId: number | null | undefined): string {
  if (projectId == null) return "#2A3538";
  const idx = Math.abs(projectId) % PALET.length;
  return PALET[idx];
}
