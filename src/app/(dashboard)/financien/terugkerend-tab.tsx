"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Play, Pause, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface TerugkerendFactuur {
  id: number;
  factuurnummer: string;
  klantNaam: string;
  bedragInclBtw: number;
  terugkeerAantal: number;
  terugkeerEenheid: string;
  terugkeerStatus: string;
  volgendeFactuurdatum: string | null;
}

export function TerugkerendTab() {
  const router = useRouter();
  const { addToast } = useToast();
  const [facturen, setFacturen] = useState<TerugkerendFactuur[]>([]);
  const [laden, setLaden] = useState(true);

  const ophalen = useCallback(async () => {
    try {
      const res = await fetch("/api/facturen?terugkerend=true");
      const data = await res.json();
      setFacturen(data.facturen || []);
    } catch {
      addToast("Fout bij ophalen terugkerende facturen", "fout");
    } finally {
      setLaden(false);
    }
  }, [addToast]);

  useEffect(() => { ophalen(); }, [ophalen]);

  const actieUitvoeren = async (id: number, actie: "pauzeren" | "hervatten" | "stoppen") => {
    try {
      const res = await fetch(`/api/facturen/${id}/terugkerend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actie }),
      });
      if (!res.ok) {
        const data = await res.json();
        addToast(data.fout || "Actie mislukt", "fout");
        return;
      }
      addToast(
        actie === "pauzeren" ? "Factuur gepauzeerd" :
        actie === "hervatten" ? "Factuur hervat" : "Factuur gestopt",
        "succes"
      );
      ophalen();
    } catch {
      addToast("Fout bij uitvoeren actie", "fout");
    }
  };

  const formatInterval = (aantal: number, eenheid: string) => {
    if (aantal === 1) {
      return eenheid === "dagen" ? "Dagelijks" : eenheid === "weken" ? "Wekelijks" : "Maandelijks";
    }
    return `Elke ${aantal} ${eenheid}`;
  };

  const statusKleur = (status: string) => {
    if (status === "actief") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (status === "gepauzeerd") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-red-500/10 text-red-400 border-red-500/20";
  };

  const actief = facturen.filter((f) => f.terugkeerStatus === "actief");
  const gepauzeerd = facturen.filter((f) => f.terugkeerStatus === "gepauzeerd");
  const maandelijksOmzet = actief.reduce((sum, f) => {
    const bedrag = f.bedragInclBtw || 0;
    if (f.terugkeerEenheid === "dagen") return sum + bedrag * (30 / (f.terugkeerAantal || 1));
    if (f.terugkeerEenheid === "weken") return sum + bedrag * (4.33 / (f.terugkeerAantal || 1));
    return sum + bedrag / (f.terugkeerAantal || 1);
  }, 0);

  if (laden) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-autronis-card rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-autronis-card rounded-2xl border border-autronis-border p-5">
          <p className="text-sm text-autronis-text-secondary">Actief</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{actief.length}</p>
        </div>
        <div className="bg-autronis-card rounded-2xl border border-autronis-border p-5">
          <p className="text-sm text-autronis-text-secondary">Gepauzeerd</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{gepauzeerd.length}</p>
        </div>
        <div className="bg-autronis-card rounded-2xl border border-autronis-border p-5">
          <p className="text-sm text-autronis-text-secondary">Maandelijkse omzet</p>
          <p className="text-2xl font-bold text-autronis-accent mt-1">
            {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(maandelijksOmzet)}
          </p>
        </div>
      </div>

      {/* Table */}
      {facturen.length === 0 ? (
        <div className="bg-autronis-card rounded-2xl border border-autronis-border p-12 text-center">
          <Repeat className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
          <p className="text-autronis-text-secondary">Nog geen terugkerende facturen</p>
          <p className="text-sm text-autronis-text-secondary/60 mt-1">
            Maak een factuur aan en zet herhaling aan
          </p>
        </div>
      ) : (
        <div className="bg-autronis-card rounded-2xl border border-autronis-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-autronis-border">
                <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Klant</th>
                <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Factuurnr.</th>
                <th className="text-right text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Bedrag</th>
                <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Interval</th>
                <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Volgende</th>
                <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-right text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autronis-border">
              {facturen.map((f) => (
                <tr
                  key={f.id}
                  className="hover:bg-autronis-bg/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/financien/${f.id}`)}
                >
                  <td className="px-6 py-4 text-sm text-autronis-text-primary">{f.klantNaam}</td>
                  <td className="px-6 py-4 text-sm text-autronis-text-secondary font-mono">{f.factuurnummer}</td>
                  <td className="px-6 py-4 text-sm text-autronis-text-primary text-right font-medium">
                    {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(f.bedragInclBtw)}
                  </td>
                  <td className="px-6 py-4 text-sm text-autronis-text-secondary">
                    {formatInterval(f.terugkeerAantal, f.terugkeerEenheid)}
                  </td>
                  <td className="px-6 py-4 text-sm text-autronis-text-secondary">
                    {f.volgendeFactuurdatum
                      ? new Date(f.volgendeFactuurdatum).toLocaleDateString("nl-NL")
                      : "\u2014"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full border", statusKleur(f.terugkeerStatus))}>
                      {f.terugkeerStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {f.terugkeerStatus === "actief" && (
                        <button
                          onClick={() => actieUitvoeren(f.id, "pauzeren")}
                          className="p-1.5 rounded-lg hover:bg-amber-500/10 text-autronis-text-secondary hover:text-amber-400 transition-colors"
                          title="Pauzeren"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {f.terugkeerStatus === "gepauzeerd" && (
                        <button
                          onClick={() => actieUitvoeren(f.id, "hervatten")}
                          className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-autronis-text-secondary hover:text-emerald-400 transition-colors"
                          title="Hervatten"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {f.terugkeerStatus !== "gestopt" && (
                        <button
                          onClick={() => actieUitvoeren(f.id, "stoppen")}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-autronis-text-secondary hover:text-red-400 transition-colors"
                          title="Stoppen"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
