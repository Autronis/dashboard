"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Client-side demo mode voor de leads pagina's.
 * Persisteert in localStorage zodat een refresh de stand behoudt.
 * Gebruikt een custom event zodat verschillende componenten in de tree
 * synchroon blijven zonder een global store.
 *
 * Wanneer demo mode aan staat moeten gevoelige velden (lead namen,
 * email adressen, telefoonnummers, websites) worden geredact via
 * <RedactText> of de helpers fakeEmail / fakeWebsite.
 */

const STORAGE_KEY = "leads-demo-mode";
const EVENT_NAME = "leads-demo-mode-change";

function readDemo(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function useLeadsDemo(): {
  demoMode: boolean;
  setDemoMode: (value: boolean) => void;
} {
  const [demoMode, setDemoState] = useState<boolean>(false);

  useEffect(() => {
    setDemoState(readDemo());
    function handler() {
      setDemoState(readDemo());
    }
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setDemoMode = useCallback((value: boolean) => {
    if (typeof window === "undefined") return;
    if (value) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(EVENT_NAME));
    setDemoState(value);
  }, []);

  return { demoMode, setDemoMode };
}

export function fakeEmail(seed: string): string {
  const hash = simpleHash(seed);
  return `lead${hash}@example.com`;
}

export function fakeWebsite(seed: string): string {
  const hash = simpleHash(seed);
  return `https://example-${hash}.com`;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 6);
}
