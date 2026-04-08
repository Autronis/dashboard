import { describe, it, expect } from "vitest";
import {
  clamp,
  berekenCommunicatieScore,
  berekenBetalingScore,
  berekenProjectScore,
  berekenTevredenheidScore,
  berekenActiviteitScore,
  berekenTotaalScore,
  scoreLabel,
  WEIGHTS,
} from "../lib/health-score";

// ─── clamp ──────────────────────────────────────────────────────

describe("clamp", () => {
  it("houdt waarden binnen 0-100", () => {
    expect(clamp(150)).toBe(100);
    expect(clamp(-20)).toBe(0);
    expect(clamp(50)).toBe(50);
  });

  it("rondt af naar heel getal", () => {
    expect(clamp(72.6)).toBe(73);
    expect(clamp(72.4)).toBe(72);
  });
});

// ─── Communicatie Score ─────────────────────────────────────────

describe("berekenCommunicatieScore", () => {
  it("geeft 50 als er geen contactdata is", () => {
    const result = berekenCommunicatieScore(null, 0, 0);
    expect(result.score).toBe(50);
  });

  it("geeft hoge score bij recent contact en veel interacties", () => {
    const result = berekenCommunicatieScore(3, 2, 3);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("geeft lage score bij lang geen contact", () => {
    const result = berekenCommunicatieScore(95, 0, 0);
    expect(result.score).toBeLessThan(20);
  });

  it("geeft middelmatige score bij 20 dagen geen contact maar wel activiteit", () => {
    const result = berekenCommunicatieScore(20, 1, 1);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThanOrEqual(80);
  });

  it("limiet frequentie score op 100 (>= 4 interacties)", () => {
    const r1 = berekenCommunicatieScore(5, 3, 3); // 6 interacties
    const r2 = berekenCommunicatieScore(5, 5, 5); // 10 interacties
    expect(r1.score).toBe(r2.score); // beide capped op 100 frequentie
  });
});

// ─── Betaling Score ─────────────────────────────────────────────

describe("berekenBetalingScore", () => {
  it("geeft 50 als er geen facturen zijn", () => {
    const result = berekenBetalingScore(0, 0, 0, 0, null);
    expect(result.score).toBe(50);
  });

  it("geeft 100 als alle facturen op tijd betaald zijn", () => {
    const result = berekenBetalingScore(5, 5, 0, 0, null);
    expect(result.score).toBe(100);
  });

  it("straft te laat betaalde facturen af", () => {
    const result = berekenBetalingScore(5, 3, 2, 0, null);
    expect(result.score).toBeLessThan(100);
  });

  it("straft overdue facturen zwaarder af bij meer dan 60 dagen", () => {
    const r30 = berekenBetalingScore(5, 4, 1, 1000, 25);
    const r60 = berekenBetalingScore(5, 4, 1, 1000, 65);
    expect(r60.score).toBeLessThan(r30.score);
  });

  it("score blijft binnen 0-100", () => {
    const result = berekenBetalingScore(5, 0, 5, 10000, 90);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ─── Project Score ──────────────────────────────────────────────

describe("berekenProjectScore", () => {
  it("geeft 50 als er geen projecten zijn", () => {
    const result = berekenProjectScore(0, 0, 0, 0);
    expect(result.score).toBe(50);
  });

  it("geeft bonus voor actieve en afgeronde projecten", () => {
    const result = berekenProjectScore(2, 60, 0, 1);
    expect(result.score).toBe(80); // 60 + 10 (actief) + 10 (afgerond)
  });

  it("straft overdue projecten af", () => {
    const zonder = berekenProjectScore(2, 50, 0, 0);
    const met = berekenProjectScore(2, 50, 2, 0);
    expect(met.score).toBeLessThan(zonder.score);
  });

  it("overdue penalty is 20 per project", () => {
    const r0 = berekenProjectScore(1, 50, 0, 0);
    const r1 = berekenProjectScore(1, 50, 1, 0);
    expect(r0.score - r1.score).toBe(20);
  });
});

// ─── Tevredenheid Score ─────────────────────────────────────────

describe("berekenTevredenheidScore", () => {
  it("geeft 50 als er geen scores zijn", () => {
    const result = berekenTevredenheidScore([]);
    expect(result.score).toBe(50);
  });

  it("converteert 1-5 schaal correct naar 0-100", () => {
    expect(berekenTevredenheidScore([5]).score).toBe(100);
    expect(berekenTevredenheidScore([1]).score).toBe(20);
    expect(berekenTevredenheidScore([3]).score).toBe(60);
  });

  it("berekent gemiddelde van meerdere scores", () => {
    const result = berekenTevredenheidScore([4, 5, 4, 5]);
    expect(result.score).toBe(90); // gem 4.5 -> 90
  });
});

// ─── Activiteit Score ───────────────────────────────────────────

describe("berekenActiviteitScore", () => {
  it("geeft 0 bij geen activiteit en geen taken", () => {
    const result = berekenActiviteitScore(0, 0, 0);
    expect(result.score).toBe(0);
  });

  it("geeft hoge score bij 8+ uur en open taken", () => {
    const result = berekenActiviteitScore(500, 1000, 3);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("open taken alleen geven lagere score dan uren + taken", () => {
    const takenAlleen = berekenActiviteitScore(0, 0, 5);
    const metUren = berekenActiviteitScore(300, 500, 5);
    expect(metUren.score).toBeGreaterThan(takenAlleen.score);
  });

  it("score is 100 bij maximale activiteit", () => {
    const result = berekenActiviteitScore(480, 2000, 5);
    expect(result.score).toBe(100);
  });
});

// ─── Totaal Score ───────────────────────────────────────────────

describe("berekenTotaalScore", () => {
  it("gewichten tellen op tot 1.0", () => {
    const totaal = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
    expect(totaal).toBeCloseTo(1.0);
  });

  it("berekent gewogen gemiddelde correct", () => {
    const result = berekenTotaalScore({
      communicatie: 100,
      betaling: 100,
      project: 100,
      tevredenheid: 100,
      activiteit: 100,
    });
    expect(result).toBe(100);
  });

  it("berekent 0 correct", () => {
    const result = berekenTotaalScore({
      communicatie: 0,
      betaling: 0,
      project: 0,
      tevredenheid: 0,
      activiteit: 0,
    });
    expect(result).toBe(0);
  });

  it("betaling weegt het zwaarst (30%)", () => {
    const metHogeBetaling = berekenTotaalScore({
      communicatie: 50,
      betaling: 100,
      project: 50,
      tevredenheid: 50,
      activiteit: 50,
    });
    const metHogeCommunicatie = berekenTotaalScore({
      communicatie: 100,
      betaling: 50,
      project: 50,
      tevredenheid: 50,
      activiteit: 50,
    });
    expect(metHogeBetaling).toBeGreaterThan(metHogeCommunicatie);
  });
});

// ─── Score Labels ───────────────────────────────────────────────

describe("scoreLabel", () => {
  it("geeft correcte labels per range", () => {
    expect(scoreLabel(95)).toBe("Gezond");
    expect(scoreLabel(80)).toBe("Gezond");
    expect(scoreLabel(70)).toBe("Aandacht");
    expect(scoreLabel(60)).toBe("Aandacht");
    expect(scoreLabel(50)).toBe("Risico");
    expect(scoreLabel(40)).toBe("Risico");
    expect(scoreLabel(30)).toBe("Kritiek");
    expect(scoreLabel(0)).toBe("Kritiek");
  });
});
