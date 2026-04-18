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

function encodeBatch(leads: ScannableLead[]): string {
  const csv = leads
    .map((l) => `${(l.name || "Onbekend").replace(/,/g, " ")},${l.website ?? ""}`)
    .join("\n");
  if (typeof window !== "undefined") {
    return window.btoa(unescape(encodeURIComponent(csv)));
  }
  return Buffer.from(csv, "utf-8").toString("base64");
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

    if (withWebsite.length === 1) {
      const l = withWebsite[0];
      const params = new URLSearchParams();
      params.set("bedrijfsnaam", l.name || "Onbekend");
      params.set("website", l.website as string);
      if (l.email) params.set("email", l.email);
      if (l.supabaseLeadId) params.set("supabaseLeadId", l.supabaseLeadId);
      router.push(`/sales-engine?${params.toString()}`);
      return;
    }

    const batch = encodeBatch(withWebsite);
    router.push(`/sales-engine?batch=${encodeURIComponent(batch)}`);
  }

  return { runScan };
}
