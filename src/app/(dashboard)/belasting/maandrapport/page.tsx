"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Download, Check, ArrowLeft,
} from "lucide-react";
import { cn, formatBedrag } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import {
  useMaandrapport,
  useUpdateEigenaar,
  useToggleVerrekening,
  type RapportItem,
  type MaandrapportData,
} from "@/hooks/queries/use-maandrapport";
import Link from "next/link";

const CATEGORIE_KLEUREN: Record<string, { bg: string; text: string }> = {
  hardware: { bg: "bg-blue-500/15", text: "text-blue-400" },
  kantoor: { bg: "bg-orange-500/15", text: "text-orange-400" },
  software: { bg: "bg-green-500/15", text: "text-green-400" },
  kvk: { bg: "bg-purple-500/15", text: "text-purple-400" },
  telefoon: { bg: "bg-pink-500/15", text: "text-pink-400" },
  afbetaling: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  hosting: { bg: "bg-teal-500/15", text: "text-teal-400" },
  reiskosten: { bg: "bg-cyan-500/15", text: "text-cyan-400" },
  marketing: { bg: "bg-rose-500/15", text: "text-rose-400" },
  onderwijs: { bg: "bg-indigo-500/15", text: "text-indigo-400" },
  verzekeringen: { bg: "bg-amber-500/15", text: "text-amber-400" },
  accountant: { bg: "bg-lime-500/15", text: "text-lime-400" },
  overig: { bg: "bg-zinc-500/15", text: "text-zinc-400" },
};

const MAAND_NAMEN = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

function formatDatumKort(datum: string): string {
  const parts = datum.split("-");
  if (parts.length >= 3) return `${parts[2]}-${parts[1]}`;
  return datum;
}

export default function MaandrapportPage() {
  const now = new Date();
  const [jaar, setJaar] = useState(now.getFullYear());
  const [maandNr, setMaandNr] = useState(now.getMonth() + 1);

  const maandStr = `${jaar}-${String(maandNr).padStart(2, "0")}`;
  const { data, isLoading, error } = useMaandrapport(maandStr);
  const updateEigenaar = useUpdateEigenaar();
  const toggleVerrekening = useToggleVerrekening();
  const { addToast } = useToast();

  const vorigeMaand = useCallback(() => {
    if (maandNr === 1) {
      setJaar((j) => j - 1);
      setMaandNr(12);
    } else {
      setMaandNr((m) => m - 1);
    }
  }, [maandNr]);

  const volgendeMaand = useCallback(() => {
    if (maandNr === 12) {
      setJaar((j) => j + 1);
      setMaandNr(1);
    } else {
      setMaandNr((m) => m + 1);
    }
  }, [maandNr]);

  const handleEigenaarTag = useCallback(async (item: RapportItem, eigenaar: "sem" | "syb" | "gedeeld", splitRatio?: string) => {
    try {
      await updateEigenaar.mutateAsync({ id: item.id, bron: item.bron, eigenaar, splitRatio });
      addToast("Eigenaar bijgewerkt", "succes");
    } catch {
      addToast("Kon eigenaar niet bijwerken", "fout");
    }
  }, [updateEigenaar, addToast]);

  const handleToggleVerrekening = useCallback(async (id: number, betaald: boolean) => {
    try {
      await toggleVerrekening.mutateAsync({ id, betaald });
      addToast(betaald ? "Gemarkeerd als betaald" : "Gemarkeerd als onbetaald", "succes");
    } catch {
      addToast("Kon verrekening niet bijwerken", "fout");
    }
  }, [toggleVerrekening, addToast]);

  const handlePdfExport = useCallback(async () => {
    try {
      const res = await fetch(`/api/belasting/maandrapport/pdf?maand=${maandStr}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `belastingoverzicht-${maandStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("PDF gedownload", "succes");
    } catch {
      addToast("Kon PDF niet genereren", "fout");
    }
  }, [maandStr, addToast]);

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/belasting" className="text-autronis-text-tertiary hover:text-autronis-text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-autronis-text-primary">Autronis VOF — Maandrapport</h1>
              <p className="text-sm text-autronis-text-tertiary">Gegenereerd op basis van bankdata</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3 py-2">
              <button onClick={vorigeMaand} className="text-autronis-text-tertiary hover:text-autronis-text-primary transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-autronis-text-secondary min-w-[120px] text-center">
                {MAAND_NAMEN[maandNr - 1]} {jaar}
              </span>
              <button onClick={volgendeMaand} className="text-autronis-text-tertiary hover:text-autronis-text-primary transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handlePdfExport}
              className="flex items-center gap-2 bg-autronis-accent hover:bg-autronis-accent-hover text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF Export
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-20 text-autronis-text-tertiary">Rapport laden...</div>
        )}

        {error && (
          <div className="text-center py-20 text-red-400">Fout bij het laden van het rapport</div>
        )}

        {data && (
          <>
            <TrendBar trend={data.trend} huidigeMaand={maandStr} />
            <KpiCards data={data} />
            <UitgavenTabel items={data.uitgaven} totaalUitgaven={data.totaalUitgaven} totaalBtw={data.totaalBtw} onTagEigenaar={handleEigenaarTag} maandNr={maandNr} />
            <BtwSplitSection btwSplit={data.btwSplit} />
            {data.verrekeningen.length > 0 && (
              <VerrekeningenSection verrekeningen={data.verrekeningen} totaal={data.totaalVerrekening} onToggle={handleToggleVerrekening} />
            )}
            <BorgSection borg={data.borg} />
            <SamenvattingSection totaalBtw={data.totaalBtw} totaalVerrekening={data.totaalVerrekening} totaalTerug={data.totaalTerug} />
          </>
        )}
      </div>
    </PageTransition>
  );
}

// ============ SUB-COMPONENTS ============

function TrendBar({ trend, huidigeMaand }: { trend: MaandrapportData["trend"]; huidigeMaand: string }) {
  const maxUitgaven = Math.max(...trend.map((t) => t.uitgaven), 1);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
      <div className="text-xs uppercase tracking-wider text-autronis-text-tertiary mb-4">Trend — afgelopen 6 maanden</div>
      <div className="flex items-end gap-4 h-14">
        {trend.map((t) => {
          const hoogte = Math.max((t.uitgaven / maxUitgaven) * 100, 4);
          const isHuidig = t.maand === huidigeMaand;
          return (
            <div key={t.maand} className="flex flex-col items-center gap-1.5 flex-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${hoogte}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={cn(
                  "w-full rounded-md",
                  isHuidig ? "bg-autronis-accent border-2 border-autronis-accent-hover" : "bg-autronis-accent/30"
                )}
              />
              <span className={cn("text-[10px]", isHuidig ? "text-autronis-text-primary font-semibold" : "text-autronis-text-tertiary")}>
                {MAAND_NAMEN[parseInt(t.maand.split("-")[1], 10) - 1]?.slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiCards({ data }: { data: MaandrapportData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Totaal uitgaven" value={formatBedrag(data.totaalUitgaven)} sub="ING + Revolut" />
      <KpiCard label="BTW terug" value={formatBedrag(data.totaalBtw)} sub={`Sem ${formatBedrag(data.btwSplit.sem.totaal)} + Syb ${formatBedrag(data.btwSplit.syb.totaal)}`} kleur="text-green-400" />
      {data.totaalVerrekening > 0 ? (
        <KpiCard label="Van Syb te ontvangen" value={formatBedrag(data.totaalVerrekening)} sub="Openstaande verrekeningen" kleur="text-orange-400" />
      ) : (
        <KpiCard label="Kosten per persoon" value={formatBedrag(data.totaalUitgaven / 2)} sub="Gelijkmatig verdeeld" kleur="text-blue-400" />
      )}
      <KpiCard label="Totaal terug" value={formatBedrag(data.totaalTerug)} sub="BTW + verrekeningen" kleur="text-purple-400" />
    </div>
  );
}

function KpiCard({ label, value, sub, kleur }: { label: string; value: string; sub: string; kleur?: string }) {
  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
      <div className="text-[10px] uppercase tracking-wider text-autronis-text-tertiary mb-1">{label}</div>
      <div className={cn("text-xl font-bold", kleur ?? "text-autronis-text-primary")}>{value}</div>
      <div className="text-[11px] text-autronis-text-tertiary mt-0.5">{sub}</div>
    </div>
  );
}

function UitgavenTabel({
  items, totaalUitgaven, totaalBtw, onTagEigenaar, maandNr,
}: {
  items: RapportItem[];
  totaalUitgaven: number;
  totaalBtw: number;
  onTagEigenaar: (item: RapportItem, eigenaar: "sem" | "syb" | "gedeeld", splitRatio?: string) => void;
  maandNr: number;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400" />
        Zakelijke uitgaven — {MAAND_NAMEN[maandNr - 1]}
      </h2>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden overflow-x-auto">
        {/* Header */}
        <div className="grid grid-cols-[70px_1fr_100px_80px_100px_80px_100px] min-w-[630px] px-4 py-2.5 text-[10px] uppercase tracking-wider text-autronis-text-tertiary bg-autronis-card/80 border-b border-autronis-border">
          <span>Datum</span>
          <span>Omschrijving</span>
          <span>Categorie</span>
          <span>Bron</span>
          <span className="text-right">Incl. BTW</span>
          <span className="text-right">BTW</span>
          <span className="text-center">Eigenaar</span>
        </div>

        {items.length === 0 && (
          <div className="px-4 py-8 text-center text-autronis-text-tertiary text-sm">Geen uitgaven gevonden voor deze maand</div>
        )}

        {items.map((item) => (
          <div
            key={`${item.bron}-${item.id}`}
            className={cn(
              "grid grid-cols-[70px_1fr_100px_80px_100px_80px_100px] min-w-[630px] px-4 py-2.5 text-[13px] border-b border-autronis-border/50 items-center hover:bg-white/[0.02] transition-colors",
              !item.eigenaar && "bg-orange-500/[0.03]"
            )}
          >
            <span className="text-autronis-text-tertiary">{formatDatumKort(item.datum)}</span>
            <span className="text-autronis-text-primary truncate">{item.omschrijving}</span>
            <span>
              {item.categorie && (
                <span className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-medium",
                  CATEGORIE_KLEUREN[item.categorie]?.bg ?? "bg-zinc-500/15",
                  CATEGORIE_KLEUREN[item.categorie]?.text ?? "text-zinc-400",
                )}>
                  {item.categorie.charAt(0).toUpperCase() + item.categorie.slice(1)}
                </span>
              )}
            </span>
            <span className="text-autronis-text-tertiary text-xs">{item.bankNaam ?? "—"}</span>
            <span className="text-autronis-text-primary text-right">{formatBedrag(item.bedragInclBtw)}</span>
            <span className="text-autronis-text-tertiary text-right">{item.btwBedrag ? formatBedrag(item.btwBedrag) : "—"}</span>
            <span className="flex justify-center">
              <EigenaarBadge item={item} onTag={onTagEigenaar} />
            </span>
          </div>
        ))}

        {items.length > 0 && (
          <div className="grid grid-cols-[70px_1fr_100px_80px_100px_80px_100px] min-w-[630px] px-4 py-3 text-[13px] font-bold text-autronis-text-primary bg-autronis-card/80 border-t border-autronis-border">
            <span />
            <span>Totaal</span>
            <span />
            <span />
            <span className="text-right">{formatBedrag(totaalUitgaven)}</span>
            <span className="text-right">{formatBedrag(totaalBtw)}</span>
            <span />
          </div>
        )}
      </div>
    </section>
  );
}

function EigenaarBadge({
  item,
  onTag,
}: {
  item: RapportItem;
  onTag: (item: RapportItem, eigenaar: "sem" | "syb" | "gedeeld", splitRatio?: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  if (item.eigenaar === "sem") {
    return <span className="bg-autronis-accent text-white px-2.5 py-0.5 rounded-full text-[11px] font-medium">Sem</span>;
  }
  if (item.eigenaar === "syb") {
    return <span className="bg-blue-500 text-white px-2.5 py-0.5 rounded-full text-[11px] font-medium">Syb</span>;
  }
  if (item.eigenaar === "gedeeld" && item.splitRatio) {
    return <span className="bg-yellow-500/15 text-yellow-400 px-2.5 py-0.5 rounded-full text-[11px] font-medium">{item.splitRatio}</span>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="border border-dashed border-autronis-border text-autronis-text-tertiary px-2.5 py-0.5 rounded-full text-[11px] font-medium hover:border-autronis-text-tertiary transition-colors"
      >
        + Tag
      </button>
      {showMenu && (
        <div className="absolute z-10 top-full mt-1 right-0 bg-autronis-card border border-autronis-border rounded-xl shadow-lg p-1.5 min-w-[120px]">
          <button onClick={() => { onTag(item, "sem"); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-white/5 text-autronis-text-secondary">Sem</button>
          <button onClick={() => { onTag(item, "syb"); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-white/5 text-autronis-text-secondary">Syb</button>
          <button onClick={() => { onTag(item, "gedeeld", "50/50"); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-white/5 text-autronis-text-secondary">50/50</button>
          <button onClick={() => { onTag(item, "gedeeld", "25/75"); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-white/5 text-autronis-text-secondary">25/75</button>
        </div>
      )}
    </div>
  );
}

function BtwSplitSection({ btwSplit }: { btwSplit: MaandrapportData["btwSplit"] }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-400" />
        BTW split — Sem vs Syb
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BtwSplitCard naam="Sem" data={btwSplit.sem} />
        <BtwSplitCard naam="Syb" data={btwSplit.syb} />
      </div>
    </section>
  );
}

function BtwSplitCard({ naam, data }: { naam: string; data: MaandrapportData["btwSplit"]["sem"] }) {
  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-autronis-text-primary mb-3">{naam} — BTW terug</h3>
      {data.items.length === 0 ? (
        <p className="text-sm text-autronis-text-tertiary">Geen BTW items</p>
      ) : (
        <div className="space-y-2">
          {data.items.map((item, i) => (
            <div key={i} className="flex justify-between text-[13px] pb-1.5 border-b border-autronis-border/50">
              <span className="text-autronis-text-tertiary">{item.omschrijving}</span>
              <span className="text-autronis-text-primary">{formatBedrag(item.bedrag)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-autronis-border">
            <span className="text-autronis-text-primary">Totaal {naam}</span>
            <span className="text-green-400">{formatBedrag(data.totaal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function VerrekeningenSection({
  verrekeningen, totaal, onToggle,
}: {
  verrekeningen: MaandrapportData["verrekeningen"];
  totaal: number;
  onToggle: (id: number, betaald: boolean) => void;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-purple-400" />
        Openstaand — Syb → Sem
      </h2>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 max-w-lg">
        <div className="space-y-2">
          {verrekeningen.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-[13px] pb-1.5 border-b border-autronis-border/50">
              <span className="text-autronis-text-tertiary">{v.omschrijving}</span>
              <div className="flex items-center gap-3">
                <span className="text-autronis-text-primary">{formatBedrag(v.bedrag)}</span>
                <button
                  onClick={() => onToggle(v.id, !v.betaald)}
                  className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                    v.betaald ? "bg-green-500 border-green-500" : "border-autronis-border hover:border-autronis-text-tertiary"
                  )}
                >
                  {v.betaald && <Check className="w-3 h-3 text-white" />}
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-autronis-border">
            <span className="text-autronis-text-primary">Syb moet Sem betalen</span>
            <span className="text-orange-400">{formatBedrag(totaal)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function BorgSection({ borg }: { borg: MaandrapportData["borg"] }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-400" />
        Borg kantoor — {borg.adres}
      </h2>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-4 px-4 py-2.5 text-[10px] uppercase tracking-wider text-autronis-text-tertiary bg-autronis-card/80 border-b border-autronis-border">
          <span>Huurder</span>
          <span className="text-right">Borg</span>
          <span className="text-right">Huur/maand</span>
          <span className="text-right">Status</span>
        </div>
        {borg.huurders.map((h, i) => (
          <div key={i} className="grid grid-cols-4 px-4 py-2.5 text-[13px] border-b border-autronis-border/50">
            <span className="text-autronis-text-primary">{h.naam}</span>
            <span className="text-autronis-text-secondary text-right">{formatBedrag(h.borg)}</span>
            <span className="text-autronis-text-secondary text-right">{formatBedrag(h.huurPerMaand)}</span>
            <span className="text-green-400 text-right">{h.status}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 text-[13px] text-indigo-300">
        <strong className="text-indigo-200">Borg is geen kostenpost</strong> — staat als vordering op de balans. Niet aftrekbaar voor BTW of winstbelasting.
      </div>
    </section>
  );
}

function SamenvattingSection({ totaalBtw, totaalVerrekening, totaalTerug }: { totaalBtw: number; totaalVerrekening: number; totaalTerug: number }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400" />
        Samenvatting — wat krijgt Sem terug?
      </h2>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 max-w-lg">
        <div className="space-y-2">
          <div className="flex justify-between text-[13px] pb-1.5 border-b border-autronis-border/50">
            <span className="text-autronis-text-tertiary">BTW terug (Belastingdienst)</span>
            <span className="text-green-400">{formatBedrag(totaalBtw)}</span>
          </div>
          {totaalVerrekening > 0 && (
            <div className="flex justify-between text-[13px] pb-1.5 border-b border-autronis-border/50">
              <span className="text-autronis-text-tertiary">Van Syb (openstaand)</span>
              <span className="text-orange-400">{formatBedrag(totaalVerrekening)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-autronis-border">
            <span className="text-autronis-text-primary">Totaal terug te krijgen</span>
            <span className="text-autronis-text-primary text-base">{formatBedrag(totaalTerug)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
