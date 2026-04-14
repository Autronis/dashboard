"use client";

import { useEffect, useRef } from "react";

/**
 * Polling hook met visibility-awareness. Roept `callback` aan elke
 * `intervalMs` zolang de tab actief is. Wanneer de gebruiker naar een
 * andere tab gaat stopt het polling; bij terugkeer wordt direct een
 * fresh fetch gedaan en de interval herstart.
 *
 * Gebruik:
 *   const load = useCallback(async () => { ... }, []);
 *   usePoll(load, 12000);
 *
 * De callback wordt NIET direct bij mount aangeroepen — dat doet je
 * eigen useEffect al voor de initial load. Dit hook handelt alleen
 * de herhaling.
 */
export function usePoll(callback: () => void | Promise<void>, intervalMs: number): void {
  // Houd de laatste callback in een ref zodat we 'm niet hoeven mee te
  // geven aan de effect deps (anders restart de interval bij elke render).
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (intervalMs <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      stop();
      timer = setInterval(() => {
        if (!document.hidden) callbackRef.current();
      }, intervalMs);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
      } else {
        // Direct fresh fetch bij terugkeer + herstart interval
        callbackRef.current();
        start();
      }
    }

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
