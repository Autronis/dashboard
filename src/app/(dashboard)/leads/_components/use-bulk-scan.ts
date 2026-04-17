"use client";

import { useState } from "react";
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

export type ScanStatus = "pending" | "completed" | "failed";

export function useBulkScan() {
  const { addToast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<Record<string, ScanStatus>>({});
  const [scanIds, setScanIds] = useState<Record<string, number>>({});

  async function runScan(selected: ScannableLead[]): Promise<void> {
    const withWebsite = selected.filter((l) => l.website?.trim());
    if (withWebsite.length === 0) {
      addToast("Geen leads met website geselecteerd", "fout");
      return;
    }
    setIsScanning(true);
    let ok = 0;
    let fail = 0;
    for (const lead of withWebsite) {
      try {
        setScanResults((prev) => ({ ...prev, [lead.id]: "pending" }));
        const res = await fetch("/api/sales-engine/handmatig", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bedrijfsnaam: lead.name || "Onbekend",
            websiteUrl: lead.website,
            contactpersoon: lead.name,
            email: lead.email,
            supabaseLeadId: lead.supabaseLeadId ?? null,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setScanResults((prev) => ({ ...prev, [lead.id]: "completed" }));
        setScanIds((prev) => ({ ...prev, [lead.id]: data.scanId }));
        ok++;
      } catch {
        setScanResults((prev) => ({ ...prev, [lead.id]: "failed" }));
        fail++;
      }
    }
    setIsScanning(false);
    addToast(
      `${ok} scans gestart${fail > 0 ? `, ${fail} mislukt` : ""}`,
      ok > 0 ? "succes" : "fout",
    );
  }

  return { isScanning, scanResults, scanIds, runScan };
}
