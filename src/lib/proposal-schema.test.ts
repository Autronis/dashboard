// src/lib/proposal-schema.test.ts
import { describe, it, expect } from "vitest";
import { parseSlides, slidesSchema } from "./proposal-schema";

describe("parseSlides", () => {
  it("returns default slides when raw is null", () => {
    const result = parseSlides(null);
    expect(result.length).toBe(8);
    expect(result[0].type).toBe("cover");
    expect(result[result.length - 1].type).toBe("volgende_stap");
  });

  it("returns default slides when raw is empty string", () => {
    const result = parseSlides("");
    expect(result.length).toBe(8);
  });

  it("returns default slides when raw is empty array JSON", () => {
    const result = parseSlides("[]");
    expect(result.length).toBe(8);
  });

  it("parses valid new-shape slides", () => {
    const valid = JSON.stringify([
      { id: "a", type: "cover", actief: true },
      { id: "b", type: "situatie", titel: "X", body: "Y", actief: true },
      { id: "c", type: "investering", actief: true },
    ]);
    const result = parseSlides(valid);
    expect(result).toHaveLength(3);
    expect(result[1].type).toBe("situatie");
    if (result[1].type === "situatie") {
      expect(result[1].titel).toBe("X");
      expect(result[1].body).toBe("Y");
    }
  });

  it("maps old {titel, inhoud} shape to vrij slides", () => {
    const old = JSON.stringify([
      { id: "1", titel: "Oude sectie", inhoud: "Inhoud hier", actief: true },
      { id: "2", titel: "Tweede", inhoud: "Meer", actief: false },
    ]);
    const result = parseSlides(old);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("vrij");
    if (result[0].type === "vrij") {
      expect(result[0].titel).toBe("Oude sectie");
      expect(result[0].body).toBe("Inhoud hier");
    }
    expect(result[1].actief).toBe(false);
  });

  it("generates IDs when old shape lacks them", () => {
    const old = JSON.stringify([{ titel: "Zonder id", inhoud: "Body", actief: true }]);
    const result = parseSlides(old);
    expect(result[0].id).toBeTruthy();
    expect(typeof result[0].id).toBe("string");
  });

  it("returns empty array on malformed JSON", () => {
    const result = parseSlides("not-json");
    expect(result).toEqual([]);
  });

  it("returns empty array on completely unknown shape", () => {
    const result = parseSlides(JSON.stringify([{ foo: "bar" }]));
    expect(result).toEqual([]);
  });

  it("rejects invalid slide via slidesSchema safeParse", () => {
    const result = slidesSchema.safeParse([{ id: "x", type: "cover" }]); // missing actief
    expect(result.success).toBe(false);
  });

  it("accepts deliverables with items array", () => {
    const raw = JSON.stringify([
      { id: "d", type: "deliverables", titel: "T", items: ["A", "B"], actief: true },
    ]);
    const result = parseSlides(raw);
    expect(result).toHaveLength(1);
    if (result[0].type === "deliverables") {
      expect(result[0].items).toEqual(["A", "B"]);
    }
  });

  it("accepts tijdlijn with fases array", () => {
    const raw = JSON.stringify([
      {
        id: "t",
        type: "tijdlijn",
        titel: "T",
        fases: [{ naam: "F1", duur: "2w", omschrijving: "O" }],
        actief: true,
      },
    ]);
    const result = parseSlides(raw);
    if (result[0].type === "tijdlijn") {
      expect(result[0].fases).toHaveLength(1);
      expect(result[0].fases[0].naam).toBe("F1");
    }
  });
});
