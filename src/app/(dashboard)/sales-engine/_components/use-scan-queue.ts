"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { decodeQueue, type ScanQueueItem } from "../../leads/_components/use-bulk-scan";

const STORAGE_KEY = "autronis-scan-queue";

function loadFromStorage(): ScanQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: ScanQueueItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or disabled — ignore, queue falls back to in-memory
  }
}

export function itemKey(item: ScanQueueItem): string {
  return `${item.bedrijfsnaam.toLowerCase()}|${item.website.toLowerCase()}`;
}

export function useScanQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ScanQueueItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setItems(loadFromStorage());
    setHydrated(true);
  }, []);

  // Merge URL ?queue= param into queue, dedupe, then clean the URL
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
        saveToStorage(merged);
        return merged;
      });
    }
    router.replace("/sales-engine", { scroll: false });
  }, [hydrated, searchParams, router]);

  const remove = useCallback((key: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => itemKey(i) !== key);
      saveToStorage(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    saveToStorage([]);
  }, []);

  return { items, remove, clear, hydrated };
}
