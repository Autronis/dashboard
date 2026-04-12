"use client";

import { useEffect, useState } from "react";
import { usePortal } from "../layout";
import { FileText, CheckCircle2, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Factuur {
  id: number;
  factuurnummer: string;
  status: string;
  bedragExclBtw: number;
  btwBedrag: number;
  bedragInclBtw: number;
  factuurdatum: string;
  vervaldatum: string | null;
  betaaldOp: string | null;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  verstuurd: { label: "Open", icon: Clock, color: "text-blue-400", bg: "bg-blue-500/15" },
  betaald: { label: "Betaald", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  herinnering: { label: "Herinnering", icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/15" },
  verlopen: { label: "Verlopen", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/15" },
};

export default function PortalFacturen() {
  const { token } = usePortal();
  const [facturen, setFacturen] = useState<Factuur[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/${token}/facturen`);
        if (res.ok) {
          const data = await res.json();
          setFacturen(data.facturen || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#17B8A5]" />
      </div>
    );
  }

  const formatBedrag = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;
  const formatDatum = (d: string) => new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Facturen</h1>

      {facturen.length === 0 ? (
        <div className="bg-[#192225] border border-[#2A3538] rounded-2xl p-12 text-center">
          <FileText className="w-10 h-10 text-[#8A9BA0]/30 mx-auto mb-3" />
          <p className="text-[#8A9BA0]">Geen facturen gevonden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {facturen.map((f) => {
            const isVerlopen = f.status === "verstuurd" && f.vervaldatum && new Date(f.vervaldatum) < new Date();
            const effectiveStatus = isVerlopen ? "verlopen" : f.status;
            const cfg = statusConfig[effectiveStatus] || statusConfig.verstuurd;
            const Icon = cfg.icon;

            return (
              <div
                key={f.id}
                className="bg-[#192225] border border-[#2A3538] rounded-2xl p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">{f.factuurnummer}</span>
                      <span className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium", cfg.bg, cfg.color)}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#8A9BA0]">
                      <span>Datum: {formatDatum(f.factuurdatum)}</span>
                      {f.vervaldatum && <span>Vervalt: {formatDatum(f.vervaldatum)}</span>}
                    </div>
                    {f.betaaldOp && (
                      <p className="text-xs text-emerald-400 mt-1">Betaald op {formatDatum(f.betaaldOp)}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-white tabular-nums">{formatBedrag(f.bedragInclBtw)}</p>
                    <p className="text-[10px] text-[#8A9BA0]">incl. BTW</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
