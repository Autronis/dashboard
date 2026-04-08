import { describe, it, expect } from "vitest";
import {
  berekenCommunicatieScore,
  berekenBetalingScore,
  berekenProjectScore,
  berekenTevredenheidScore,
  berekenActiviteitScore,
  berekenTotaalScore,
} from "../lib/health-score";

// Integration tests: test realistic client scenarios end-to-end

describe("Realistic client health scenarios", () => {
  it("gezonde klant: regelmatig contact, betaalt op tijd, actieve projecten", () => {
    const comm = berekenCommunicatieScore(3, 2, 3);
    const betaling = berekenBetalingScore(10, 10, 0, 0, null);
    const project = berekenProjectScore(2, 75, 0, 3);
    const tevredenheid = berekenTevredenheidScore([5, 4, 5, 4]);
    const activiteit = berekenActiviteitScore(480, 2000, 4);

    const totaal = berekenTotaalScore({
      communicatie: comm.score,
      betaling: betaling.score,
      project: project.score,
      tevredenheid: tevredenheid.score,
      activiteit: activiteit.score,
    });

    expect(totaal).toBeGreaterThanOrEqual(80);
    expect(comm.score).toBeGreaterThanOrEqual(80);
    expect(betaling.score).toBe(100);
    expect(tevredenheid.score).toBe(90);
  });

  it("risico klant: geen contact, overdue facturen, achterlopend project", () => {
    const comm = berekenCommunicatieScore(70, 0, 0);
    const betaling = berekenBetalingScore(5, 2, 2, 5000, 45);
    const project = berekenProjectScore(1, 20, 1, 0);
    const tevredenheid = berekenTevredenheidScore([2, 3]);
    const activiteit = berekenActiviteitScore(0, 500, 0);

    const totaal = berekenTotaalScore({
      communicatie: comm.score,
      betaling: betaling.score,
      project: project.score,
      tevredenheid: tevredenheid.score,
      activiteit: activiteit.score,
    });

    expect(totaal).toBeLessThan(40);
    expect(comm.score).toBeLessThan(30);
    expect(betaling.score).toBeLessThan(30);
  });

  it("nieuwe klant: weinig data, krijgt neutrale scores", () => {
    const comm = berekenCommunicatieScore(null, 0, 0);
    const betaling = berekenBetalingScore(0, 0, 0, 0, null);
    const project = berekenProjectScore(0, 0, 0, 0);
    const tevredenheid = berekenTevredenheidScore([]);
    const activiteit = berekenActiviteitScore(0, 0, 0);

    const totaal = berekenTotaalScore({
      communicatie: comm.score,
      betaling: betaling.score,
      project: project.score,
      tevredenheid: tevredenheid.score,
      activiteit: activiteit.score,
    });

    // Alle subscores zijn 50 (neutraal) behalve activiteit (0)
    expect(comm.score).toBe(50);
    expect(betaling.score).toBe(50);
    expect(project.score).toBe(50);
    expect(tevredenheid.score).toBe(50);
    expect(activiteit.score).toBe(0);
    expect(totaal).toBe(43); // 50*0.20 + 50*0.30 + 50*0.20 + 50*0.15 + 0*0.15 = 42.5 → 43
  });

  it("stille klant: lang geen contact maar betaalt wel", () => {
    const comm = berekenCommunicatieScore(45, 0, 0);
    const betaling = berekenBetalingScore(8, 8, 0, 0, null);
    const project = berekenProjectScore(0, 0, 0, 2);
    const tevredenheid = berekenTevredenheidScore([4]);
    const activiteit = berekenActiviteitScore(0, 800, 0);

    const totaal = berekenTotaalScore({
      communicatie: comm.score,
      betaling: betaling.score,
      project: project.score,
      tevredenheid: tevredenheid.score,
      activiteit: activiteit.score,
    });

    // Betaling hoog, communicatie laag — totaal ergens in het midden
    expect(betaling.score).toBe(100);
    expect(comm.score).toBeLessThan(40);
    expect(totaal).toBeGreaterThan(40);
    expect(totaal).toBeLessThan(80);
  });

  it("alle scores clampen correct bij extreme waarden", () => {
    const betaling = berekenBetalingScore(10, 0, 10, 50000, 120);
    expect(betaling.score).toBe(0); // zwaar negatief maar clamped op 0

    const project = berekenProjectScore(5, 100, 0, 10);
    expect(project.score).toBe(100); // hoog maar clamped op 100
  });
});
