import { describe, it, expect } from "vitest";
import { getShortcutsForRoute, FALLBACK_SHORTCUTS } from "./action-registry";

describe("getShortcutsForRoute", () => {
  it("returns exact match for known route", () => {
    const result = getShortcutsForRoute("/ideeen");
    expect(result).toContain("idee-nieuw");
    expect(result).toContain("idee-voer-uit");
  });

  it("returns prefix match for sub-routes", () => {
    const result = getShortcutsForRoute("/financien/nieuw");
    expect(result).toContain("factuur-nieuw");
  });

  it("returns longest prefix match when multiple prefixes apply", () => {
    const result = getShortcutsForRoute("/klanten/123");
    expect(result).toContain("klant-nieuw");
  });

  it("returns exactly 5 shortcuts for main routes", () => {
    expect(getShortcutsForRoute("/")).toHaveLength(5);
    expect(getShortcutsForRoute("/taken")).toHaveLength(5);
    expect(getShortcutsForRoute("/ideeen")).toHaveLength(5);
  });

  it("returns fallback for unknown routes", () => {
    const result = getShortcutsForRoute("/unknown-route-xyz");
    expect(result).toEqual(FALLBACK_SHORTCUTS);
  });

  it("returns fallback for empty string", () => {
    const result = getShortcutsForRoute("");
    expect(result).toEqual(FALLBACK_SHORTCUTS);
  });
});
