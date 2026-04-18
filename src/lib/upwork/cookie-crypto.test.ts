import { describe, it, expect, beforeAll } from "vitest";
import { encryptCookies, decryptCookies } from "./cookie-crypto";
import { randomBytes } from "node:crypto";

describe("cookie-crypto", () => {
  beforeAll(() => {
    process.env.UPWORK_COOKIE_SECRET = randomBytes(32).toString("base64");
  });

  it("roundtrips a JSON payload", () => {
    const payload = JSON.stringify([{ name: "cf_bm", value: "abc", domain: ".upwork.com" }]);
    const encrypted = encryptCookies(payload);
    expect(encrypted).not.toBe(payload);
    expect(decryptCookies(encrypted)).toBe(payload);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const payload = "hello";
    expect(encryptCookies(payload)).not.toBe(encryptCookies(payload));
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptCookies("hello");
    const tampered = encrypted.slice(0, -2) + (encrypted.endsWith("A") ? "B" : "A") + encrypted.slice(-1);
    expect(() => decryptCookies(tampered)).toThrow();
  });

  it("throws when UPWORK_COOKIE_SECRET is missing", () => {
    const original = process.env.UPWORK_COOKIE_SECRET;
    delete process.env.UPWORK_COOKIE_SECRET;
    try {
      expect(() => encryptCookies("hello")).toThrow(/UPWORK_COOKIE_SECRET/);
    } finally {
      process.env.UPWORK_COOKIE_SECRET = original;
    }
  });
});
