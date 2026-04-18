import { describe, it, expect } from "vitest";
import { classifyBudgetTier } from "./budget-tier";

describe("classifyBudgetTier", () => {
  it("returns null when budget is undefined", () => {
    expect(classifyBudgetTier(undefined, undefined, undefined)).toBeNull();
  });

  it("returns null when type is set but min is undefined", () => {
    expect(classifyBudgetTier("fixed", undefined, undefined)).toBeNull();
  });

  it("classifies fixed <$500 as low", () => {
    expect(classifyBudgetTier("fixed", 200, 400)).toBe("low");
    expect(classifyBudgetTier("fixed", 499, undefined)).toBe("low");
  });

  it("classifies fixed $500-5000 as mid", () => {
    expect(classifyBudgetTier("fixed", 500, 1000)).toBe("mid");
    expect(classifyBudgetTier("fixed", 4999, undefined)).toBe("mid");
  });

  it("classifies fixed >$5000 as premium", () => {
    expect(classifyBudgetTier("fixed", 5000, 10000)).toBe("premium");
    expect(classifyBudgetTier("fixed", 25000, undefined)).toBe("premium");
  });

  it("classifies hourly <$20 as low", () => {
    expect(classifyBudgetTier("hourly", 10, 18)).toBe("low");
  });

  it("classifies hourly $20-60 as mid", () => {
    expect(classifyBudgetTier("hourly", 30, 45)).toBe("mid");
    expect(classifyBudgetTier("hourly", 60, undefined)).toBe("mid");
  });

  it("classifies hourly >$60 as premium", () => {
    expect(classifyBudgetTier("hourly", 75, 120)).toBe("premium");
  });

  it("uses max when min is missing", () => {
    expect(classifyBudgetTier("fixed", undefined, 6000)).toBe("premium");
  });

  it("returns null on negative values", () => {
    expect(classifyBudgetTier("fixed", -100, undefined)).toBeNull();
  });

  it("returns null on NaN values", () => {
    expect(classifyBudgetTier("fixed", NaN, undefined)).toBeNull();
    expect(classifyBudgetTier("hourly", NaN, 50)).toBeNull();
  });

  it("returns null on Infinity values", () => {
    expect(classifyBudgetTier("fixed", Infinity, undefined)).toBeNull();
    expect(classifyBudgetTier("hourly", -Infinity, undefined)).toBeNull();
  });
});
