// Klant Health Score berekeningen — geëxtraheerd voor testbaarheid

export const WEIGHTS = {
  communicatie: 0.20,
  betaling: 0.30,
  project: 0.20,
  tevredenheid: 0.15,
  activiteit: 0.15,
};

export function clamp(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)));
}

export function berekenCommunicatieScore(
  dagenSindsContact: number | null,
  aantalMeetings30d: number,
  aantalNotities30d: number,
): { score: number; details: Record<string, unknown> } {
  if (dagenSindsContact === null) return { score: 50, details: { reden: "Geen contactdata" } };

  let recencyScore = 100;
  if (dagenSindsContact > 90) recencyScore = 10;
  else if (dagenSindsContact > 60) recencyScore = 30;
  else if (dagenSindsContact > 30) recencyScore = 55;
  else if (dagenSindsContact > 14) recencyScore = 80;

  const interacties = aantalMeetings30d + aantalNotities30d;
  const frequentieScore = Math.min(interacties * 25, 100);

  const score = clamp(recencyScore * 0.6 + frequentieScore * 0.4);
  return {
    score,
    details: { dagenSindsContact, aantalMeetings30d, aantalNotities30d, recencyScore, frequentieScore },
  };
}

export function berekenBetalingScore(
  totaalFacturen: number,
  opTijd: number,
  teLaat: number,
  openstaand: number,
  oudsteOverdueDagen: number | null,
): { score: number; details: Record<string, unknown> } {
  if (totaalFacturen === 0) return { score: 50, details: { reden: "Geen factuurhistorie" } };

  const opTijdRatio = opTijd / totaalFacturen;
  let score = opTijdRatio * 100;

  score -= teLaat * 10;

  if (oudsteOverdueDagen !== null && oudsteOverdueDagen > 0) {
    if (oudsteOverdueDagen > 60) score -= 40;
    else if (oudsteOverdueDagen > 30) score -= 25;
    else if (oudsteOverdueDagen > 14) score -= 10;
  }

  return { score: clamp(score), details: { totaalFacturen, opTijd, teLaat, openstaand, oudsteOverdueDagen } };
}

export function berekenProjectScore(
  actieveProjecten: number,
  gemVoortgang: number,
  overdueProjecten: number,
  afgerondeProjecten: number,
): { score: number; details: Record<string, unknown> } {
  if (actieveProjecten === 0 && afgerondeProjecten === 0) {
    return { score: 50, details: { reden: "Geen projecten" } };
  }

  let score = gemVoortgang;
  if (actieveProjecten > 0) score += 10;
  score -= overdueProjecten * 20;
  if (afgerondeProjecten > 0) score += 10;

  return { score: clamp(score), details: { actieveProjecten, gemVoortgang, overdueProjecten, afgerondeProjecten } };
}

export function berekenTevredenheidScore(
  scores: number[],
): { score: number; details: Record<string, unknown> } {
  if (scores.length === 0) return { score: 50, details: { reden: "Geen tevredenheidsdata" } };

  const gem = scores.reduce((s, v) => s + v, 0) / scores.length;
  const score = clamp((gem / 5) * 100);

  return { score, details: { gemiddelde: Math.round(gem * 10) / 10, aantalScores: scores.length } };
}

export function berekenActiviteitScore(
  totaalMinuten30d: number,
  totaalMinutenAllTime: number,
  openTaken: number,
): { score: number; details: Record<string, unknown> } {
  let recentScore = 0;
  if (totaalMinuten30d >= 480) recentScore = 100;
  else if (totaalMinuten30d >= 240) recentScore = 80;
  else if (totaalMinuten30d >= 60) recentScore = 50;
  else if (totaalMinuten30d > 0) recentScore = 30;

  const takenScore = openTaken > 0 ? Math.min(openTaken * 20, 100) : 0;

  const score = clamp(recentScore * 0.7 + takenScore * 0.3);
  return { score, details: { totaalMinuten30d, totaalMinutenAllTime, openTaken } };
}

export function berekenTotaalScore(scores: {
  communicatie: number;
  betaling: number;
  project: number;
  tevredenheid: number;
  activiteit: number;
}): number {
  return clamp(
    scores.communicatie * WEIGHTS.communicatie +
    scores.betaling * WEIGHTS.betaling +
    scores.project * WEIGHTS.project +
    scores.tevredenheid * WEIGHTS.tevredenheid +
    scores.activiteit * WEIGHTS.activiteit,
  );
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Gezond";
  if (score >= 60) return "Aandacht";
  if (score >= 40) return "Risico";
  return "Kritiek";
}
