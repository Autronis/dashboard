"use client";

import { useState, useCallback, useEffect } from "react";

interface RecentDocument {
  id: string;
  titel: string;
  type: string;
  timestamp: number;
}

const RECENT_KEY = "autronis-recent-docs";
const PINNED_KEY = "autronis-pinned-docs";
const RECENT_HIDDEN_KEY = "autronis-recent-hidden";
const MAX_RECENT = 5;
const MAX_PINNED = 10;

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable
  }
}

export function useRecentDocuments() {
  const [recent, setRecent] = useState<RecentDocument[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setRecent(loadFromStorage<RecentDocument[]>(RECENT_KEY, []));
    setHidden(loadFromStorage<boolean>(RECENT_HIDDEN_KEY, false));
  }, []);

  const addRecent = useCallback((id: string, titel: string, type: string) => {
    setRecent((prev) => {
      const filtered = prev.filter((d) => d.id !== id);
      const updated = [{ id, titel, type, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT);
      saveToStorage(RECENT_KEY, updated);
      return updated;
    });
  }, []);

  const toggleHidden = useCallback(() => {
    setHidden((prev) => {
      const updated = !prev;
      saveToStorage(RECENT_HIDDEN_KEY, updated);
      return updated;
    });
  }, []);

  return { recent, addRecent, hidden, toggleHidden };
}

export function usePinnedDocuments() {
  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(() => {
    setPinned(loadFromStorage<string[]>(PINNED_KEY, []));
  }, []);

  const togglePin = useCallback((id: string) => {
    setPinned((prev) => {
      let updated: string[];
      if (prev.includes(id)) {
        updated = prev.filter((p) => p !== id);
      } else {
        if (prev.length >= MAX_PINNED) return prev; // Max reached
        updated = [...prev, id];
      }
      saveToStorage(PINNED_KEY, updated);
      return updated;
    });
  }, []);

  const isPinned = useCallback((id: string) => pinned.includes(id), [pinned]);

  return { pinned, togglePin, isPinned };
}
