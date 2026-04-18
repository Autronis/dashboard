"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { decodeQueue, type ScanQueueItem } from "../../leads/_components/use-bulk-scan";

const STORAGE_KEY = "autronis-scan-queue";
const DISMISSED_KEY = "autronis-scan-dismissed";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or disabled — ignore
  }
}

export function itemKey(item: ScanQueueItem): string {
  return `${item.bedrijfsnaam.toLowerCase().trim()}|${item.website.toLowerCase().trim()}`;
}

export function useScanQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ScanQueueItem[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    setItems(loadFromStorage<ScanQueueItem[]>(STORAGE_KEY, []));
    setDismissed(loadFromStorage<string[]>(DISMISSED_KEY, []));
    setHydrated(true);
  }, []);

  // Merge URL ?queue= param
  useEffect(() => {
    if (!hydrated) return;
    const queueParam = searchParams.get("queue");
    if (!queueParam) return;

    const incoming = decodeQueue(queueParam);
    if (incoming.length > 0) {
      setItems((prev) => {
        const existing = new Set(prev.map(itemKey));
        const merged = [...prev];
        for (const item of incoming) {
          if (!existing.has(itemKey(item))) merged.push(item);
        }
        saveToStorage(STORAGE_KEY, merged);
        return merged;
      });
      // Explicit add via URL = un-dismiss (user just clicked Scan on a leads page)
      setDismissed((prev) => {
        const incomingKeys = new Set(incoming.map(itemKey));
        const next = prev.filter((k) => !incomingKeys.has(k));
        saveToStorage(DISMISSED_KEY, next);
        return next;
      });
    }
    router.replace("/sales-engine", { scroll: false });
  }, [hydrated, searchParams, router]);

  // Auto-fill queue with candidates once per mount
  useEffect(() => {
    if (!hydrated || autoFilled) return;
    setAutoFilled(true);
    setAutoFillLoading(true);

    fetch("/api/sales-engine/queue-candidates")
      .then((res) => (res.ok ? res.json() : { candidates: [] }))
      .then((data) => {
        const candidates: ScanQueueItem[] = Array.isArray(data?.candidates)
          ? data.candidates.map((c: { bedrijfsnaam: string; website: string; email?: string; supabaseLeadId?: string }) => ({
              bedrijfsnaam: c.bedrijfsnaam,
              website: c.website,
              email: c.email,
              supabaseLeadId: c.supabaseLeadId,
            }))
          : [];
        setItems((prev) => {
          const existing = new Set(prev.map(itemKey));
          const dismissedSet = new Set(dismissed);
          const merged = [...prev];
          for (const c of candidates) {
            const key = itemKey(c);
            if (existing.has(key)) continue;
            if (dismissedSet.has(key)) continue;
            merged.push(c);
          }
          saveToStorage(STORAGE_KEY, merged);
          return merged;
        });
      })
      .catch(() => {
        // ignore — queue keeps whatever user added
      })
      .finally(() => setAutoFillLoading(false));
  }, [hydrated, autoFilled, dismissed]);

  const remove = useCallback((key: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => itemKey(i) !== key);
      saveToStorage(STORAGE_KEY, next);
      return next;
    });
    setDismissed((prev) => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      saveToStorage(DISMISSED_KEY, next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems((prev) => {
      const toDismiss = prev.map(itemKey);
      setDismissed((d) => {
        const merged = Array.from(new Set([...d, ...toDismiss]));
        saveToStorage(DISMISSED_KEY, merged);
        return merged;
      });
      saveToStorage(STORAGE_KEY, []);
      return [];
    });
  }, []);

  const resetDismissed = useCallback(() => {
    setDismissed([]);
    saveToStorage(DISMISSED_KEY, []);
    // Trigger re-fetch of candidates
    setAutoFilled(false);
  }, []);

  return { items, remove, clear, resetDismissed, hydrated, autoFillLoading };
}
