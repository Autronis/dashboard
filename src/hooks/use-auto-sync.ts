import { useEffect, useRef } from "react";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minuten
const STORAGE_KEY = "autronis-last-sync";

/**
 * Hook die projecten automatisch synct op de achtergrond.
 * Draait bij page load (max 1x per 5 min) + herhaalt elke 5 min zolang de pagina open is.
 */
export function useAutoSync() {
  const didRun = useRef(false);

  useEffect(() => {
    function doSync() {
      const lastSync = sessionStorage.getItem(STORAGE_KEY);
      const now = Date.now();
      if (lastSync && now - Number(lastSync) < SYNC_INTERVAL_MS) return;
      sessionStorage.setItem(STORAGE_KEY, String(now));
      fetch("/api/projecten/sync", { method: "POST" }).catch(() => {});
    }

    // Sync on mount
    if (!didRun.current) {
      didRun.current = true;
      doSync();
    }

    // Repeat every 5 min while page is open
    const interval = setInterval(doSync, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);
}
