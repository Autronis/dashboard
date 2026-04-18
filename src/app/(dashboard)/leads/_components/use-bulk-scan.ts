"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export interface ScannableLead {
  id: string;
  name: string | null;
  website: string | null;
  email: string | null;
  // Supabase lead-id (uuid) — alleen meegeven als de lead uit Syb's lead-dashboard
  // komt. Voor Turso-entiteiten (klanten, handmatig ingevoerde leads) laten op null.
  supabaseLeadId?: string | null;
}

export interface ScanQueueItem {
  bedrijfsnaam: string;
  website: string;
  email?: string;
  supabaseLeadId?: string;
}

export function encodeQueue(items: ScanQueueItem[]): string {
  const json = JSON.stringify(items);
  if (typeof window !== "undefined") {
    return window.btoa(unescape(encodeURIComponent(json)));
  }
  return Buffer.from(json, "utf-8").toString("base64");
}

export function decodeQueue(raw: string): ScanQueueItem[] {
  try {
    const step1 = decodeURIComponent(raw);
    const json =
      typeof window !== "undefined"
        ? decodeURIComponent(escape(window.atob(step1)))
        : Buffer.from(step1, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useBulkScan() {
  const router = useRouter();
  const { addToast } = useToast();

  function runScan(selected: ScannableLead[]): void {
    const withWebsite = selected.filter((l) => l.website?.trim());
    if (withWebsite.length === 0) {
      addToast("Geen leads met website geselecteerd", "fout");
      return;
    }
    const items: ScanQueueItem[] = withWebsite.map((l) => ({
      bedrijfsnaam: l.name || "Onbekend",
      website: l.website as string,
      ...(l.email ? { email: l.email } : {}),
      ...(l.supabaseLeadId ? { supabaseLeadId: l.supabaseLeadId } : {}),
    }));
    const encoded = encodeQueue(items);
    router.push(`/sales-engine?queue=${encodeURIComponent(encoded)}`);
  }

  return { runScan };
}
