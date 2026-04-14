"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, X, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Klant {
  id: number;
  bedrijfsnaam: string;
}

interface KlantPickerProps {
  projectId: number;
  currentKlantId: number | null;
  currentKlantNaam: string | null;
}

/**
 * Klant koppelen / wisselen voor een project. Toont huidige klant (of
 * "Geen klant" placeholder) als een chip; klikken opent een searchable
 * dropdown met alle actieve klanten plus een "Loskoppelen" optie.
 */
export function KlantPicker({ projectId, currentKlantId, currentKlantNaam }: KlantPickerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [klanten, setKlanten] = useState<Klant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [zoek, setZoek] = useState("");
  const [optimisticId, setOptimisticId] = useState<number | null>(null);
  const [optimisticNaam, setOptimisticNaam] = useState<string | null>(null);

  const displayId = optimisticId !== null ? optimisticId : currentKlantId;
  const displayNaam = optimisticId !== null ? optimisticNaam : currentKlantNaam;

  // Lazy load klanten lijst de eerste keer dat dropdown opent
  useEffect(() => {
    if (!open || klanten !== null) return;
    setLoading(true);
    fetch("/api/klanten")
      .then((r) => r.json())
      .then((d: { klanten?: Array<{ id: number; bedrijfsnaam: string; isActief?: number }> }) => {
        const lijst = (d.klanten ?? [])
          .filter((k) => k.isActief !== 0)
          .map((k) => ({ id: k.id, bedrijfsnaam: k.bedrijfsnaam }))
          .sort((a, b) => a.bedrijfsnaam.localeCompare(b.bedrijfsnaam));
        setKlanten(lijst);
      })
      .catch((e) => {
        console.error("[klant-picker] kon klanten niet laden", e);
        setKlanten([]);
      })
      .finally(() => setLoading(false));
  }, [open, klanten]);

  const updateKlant = async (nieuweKlantId: number | null, nieuweKlantNaam: string | null) => {
    if (nieuweKlantId === displayId) {
      setOpen(false);
      return;
    }
    setPending(true);
    setOptimisticId(nieuweKlantId);
    setOptimisticNaam(nieuweKlantNaam);
    try {
      const res = await fetch(`/api/projecten/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klantId: nieuweKlantId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.fout || "Wijziging mislukt");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", String(projectId)] }),
        queryClient.invalidateQueries({ queryKey: ["projecten"] }),
        queryClient.invalidateQueries({ queryKey: ["klanten"] }),
      ]);
      setOpen(false);
    } catch (e) {
      console.error(e);
      setOptimisticId(null);
      setOptimisticNaam(null);
    } finally {
      setPending(false);
    }
  };

  const filtered = klanten?.filter((k) =>
    k.bedrijfsnaam.toLowerCase().includes(zoek.toLowerCase())
  ) ?? [];

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        title={displayNaam ? "Wijzig klant" : "Klant koppelen"}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
          displayNaam
            ? "bg-autronis-bg/50 border-autronis-border text-autronis-text-primary hover:border-autronis-accent/50"
            : "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20",
          pending && "opacity-50 cursor-wait"
        )}
      >
        <Building2 className="w-3 h-3" />
        {displayNaam || "Geen klant"}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-autronis-card border border-autronis-border rounded-xl shadow-2xl w-72 overflow-hidden">
            <div className="p-2 border-b border-autronis-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-autronis-text-secondary/60" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Zoek klant..."
                  value={zoek}
                  onChange={(e) => setZoek(e.target.value)}
                  className="w-full bg-autronis-bg border border-autronis-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto py-1">
              {loading && (
                <div className="flex items-center justify-center py-4 text-autronis-text-secondary text-xs">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Klanten laden...
                </div>
              )}

              {!loading && displayId !== null && (
                <button
                  onClick={() => updateKlant(null, null)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Klant loskoppelen
                </button>
              )}

              {!loading && filtered.length === 0 && klanten !== null && (
                <div className="px-3 py-4 text-center text-xs text-autronis-text-secondary">
                  {zoek ? "Geen klanten gevonden" : "Geen klanten beschikbaar"}
                </div>
              )}

              {!loading && filtered.map((k) => {
                const active = k.id === displayId;
                return (
                  <button
                    key={k.id}
                    onClick={() => updateKlant(k.id, k.bedrijfsnaam)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors",
                      active
                        ? "bg-autronis-accent/15 text-autronis-accent font-medium"
                        : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                    )}
                  >
                    <Building2 className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{k.bedrijfsnaam}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
