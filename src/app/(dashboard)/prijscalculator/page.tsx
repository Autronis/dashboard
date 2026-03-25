"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, Plus, Trash2, FileText, ExternalLink, Loader2,
  ChevronDown, ChevronUp, Euro, Clock, Package, Percent,
} from "lucide-react";
import { cn, formatBedrag } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { useRouter } from "next/navigation";

interface Regel {
  id: number;
  omschrijving: string;
  type: "uren" | "fixed" | "module";
  aantal: number;
  eenheidsprijs: number;
  isOptioneel: boolean;
}

const PRESET_MODULES = [
  { naam: "AI Chatbot bouwen", prijs: 1500 },
  { naam: "Dashboard ontwikkeling", prijs: 2500 },
  { naam: "Automatisering (per flow)", prijs: 750 },
  { naam: "API koppeling", prijs: 500 },
  { naam: "Maandelijks onderhoud", prijs: 250 },
  { naam: "Training & onboarding", prijs: 400 },
  { naam: "Contentcreatie (per stuk)", prijs: 150 },
  { naam: "Strategy sessie (2u)", prijs: 350 },
];

const DEFAULT_UURTARIEF = 125;
const BTW_PCT = 21;

let nextId = 1;
function newId() { return nextId++; }

export default function PrijsCalculatorPage() {
  const { addToast } = useToast();
  const router = useRouter();
  const [uurtarief, setUurtarief] = useState(DEFAULT_UURTARIEF);
  const [regels, setRegels] = useState<Regel[]>([
    { id: newId(), omschrijving: "Analyse & ontwerp", type: "uren", aantal: 4, eenheidsprijs: DEFAULT_UURTARIEF, isOptioneel: false },
    { id: newId(), omschrijving: "Ontwikkeling", type: "uren", aantal: 16, eenheidsprijs: DEFAULT_UURTARIEF, isOptioneel: false },
  ]);
  const [korting, setKorting] = useState(0);
  const [kortingType, setKortingType] = useState<"percentage" | "vast">("percentage");
  const [showModules, setShowModules] = useState(false);
  const [saving, setSaving] = useState(false);
  const [klantId, setKlantId] = useState<number | null>(null);
  const [offerteTitel, setOfferteTitel] = useState("");
  const [btw, setBtw] = useState(true);

  const totaalExcl = useMemo(
    () => regels.filter((r) => !r.isOptioneel).reduce((sum, r) => sum + r.aantal * r.eenheidsprijs, 0),
    [regels]
  );

  const kortingBedrag = useMemo(() => {
    if (!korting) return 0;
    return kortingType === "percentage" ? totaalExcl * (korting / 100) : korting;
  }, [korting, kortingType, totaalExcl]);

  const naTotaal = totaalExcl - kortingBedrag;
  const btwBedrag = btw ? naTotaal * (BTW_PCT / 100) : 0;
  const totaalIncl = naTotaal + btwBedrag;

  const totaalOptioneel = useMemo(
    () => regels.filter((r) => r.isOptioneel).reduce((sum, r) => sum + r.aantal * r.eenheidsprijs, 0),
    [regels]
  );

  const updateRegel = useCallback((id: number, field: keyof Regel, value: string | number | boolean) => {
    setRegels((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }, []);

  const addRegel = useCallback((type: Regel["type"] = "uren") => {
    setRegels((prev) => [...prev, {
      id: newId(),
      omschrijving: type === "uren" ? "Nieuwe uren" : type === "fixed" ? "Vaste post" : "Module",
      type,
      aantal: type === "uren" ? 8 : 1,
      eenheidsprijs: type === "uren" ? uurtarief : 500,
      isOptioneel: false,
    }]);
  }, [uurtarief]);

  const removeRegel = useCallback((id: number) => {
    setRegels((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addModule = useCallback((naam: string, prijs: number) => {
    setRegels((prev) => [...prev, {
      id: newId(),
      omschrijving: naam,
      type: "module",
      aantal: 1,
      eenheidsprijs: prijs,
      isOptioneel: false,
    }]);
    setShowModules(false);
  }, []);

  const handleMaakOfferte = useCallback(async () => {
    if (!offerteTitel.trim()) {
      addToast("Vul een titel in", "fout");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/offertes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel: offerteTitel,
          klantId: klantId ?? undefined,
          type: regels.some((r) => r.type === "uren") ? "per_uur" : "fixed",
          bedragExclBtw: naTotaal,
          btwPercentage: btw ? BTW_PCT : 0,
          btwBedrag: btwBedrag,
          bedragInclBtw: totaalIncl,
          korting: kortingBedrag,
          kortingType,
          regels: regels.map((r) => ({
            omschrijving: r.omschrijving,
            aantal: r.aantal,
            eenheidsprijs: r.eenheidsprijs,
            btwPercentage: btw ? BTW_PCT : 0,
            totaal: r.aantal * r.eenheidsprijs,
            isOptioneel: r.isOptioneel ? 1 : 0,
          })),
        }),
      });
      const data = await res.json() as { offerte?: { id: number } };
      if (!res.ok) throw new Error("Aanmaken mislukt");
      addToast("Offerte aangemaakt!", "succes");
      if (data.offerte?.id) {
        router.push(`/offertes/${data.offerte.id}`);
      } else {
        router.push("/offertes");
      }
    } catch {
      addToast("Offerte aanmaken mislukt", "fout");
    } finally {
      setSaving(false);
    }
  }, [offerteTitel, klantId, regels, naTotaal, btw, btwBedrag, totaalIncl, kortingBedrag, kortingType, addToast, router]);

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-5 h-5 text-autronis-accent" />
              <h1 className="text-2xl font-bold text-autronis-text-primary">Prijscalculator</h1>
            </div>
            <p className="text-sm text-autronis-text-secondary">Bereken snel een prijs en maak direct een offerte aan.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Regels */}
          <div className="lg:col-span-2 space-y-4">

            {/* Uurtarief */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 flex items-center gap-4">
              <Clock className="w-5 h-5 text-autronis-accent shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-autronis-text-primary mb-1">Standaard uurtarief</p>
                <p className="text-xs text-autronis-text-secondary">Wordt automatisch ingevuld bij nieuwe uren-regels</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-autronis-text-secondary">€</span>
                <input
                  type="number"
                  value={uurtarief}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setUurtarief(v);
                    setRegels((prev) => prev.map((r) => r.type === "uren" ? { ...r, eenheidsprijs: v } : r));
                  }}
                  className="w-20 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-1.5 text-sm text-autronis-text-primary text-right focus:outline-none focus:border-autronis-accent"
                />
                <span className="text-autronis-text-secondary text-sm">/uur</span>
              </div>
            </div>

            {/* Regellijst */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-autronis-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-autronis-text-primary">Posten</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowModules((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-autronis-text-secondary border border-autronis-border rounded-lg hover:border-autronis-accent/50 hover:text-autronis-accent transition-colors"
                  >
                    <Package className="w-3.5 h-3.5" />
                    Modules
                    {showModules ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Module picker */}
              <AnimatePresence>
                {showModules && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b border-autronis-border"
                  >
                    <div className="p-4 grid grid-cols-2 gap-2">
                      {PRESET_MODULES.map((m) => (
                        <button
                          key={m.naam}
                          onClick={() => addModule(m.naam, m.prijs)}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-autronis-bg hover:bg-autronis-border/50 border border-autronis-border text-left transition-colors"
                        >
                          <span className="text-xs text-autronis-text-primary truncate">{m.naam}</span>
                          <span className="text-xs text-autronis-accent shrink-0 ml-2">{formatBedrag(m.prijs)}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Regel rows */}
              <div className="divide-y divide-autronis-border/50">
                {regels.map((regel) => (
                  <motion.div
                    key={regel.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="px-5 py-3 flex items-center gap-3"
                  >
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                      <input
                        value={regel.omschrijving}
                        onChange={(e) => updateRegel(regel.id, "omschrijving", e.target.value)}
                        className="bg-transparent text-sm text-autronis-text-primary focus:outline-none border-b border-transparent focus:border-autronis-accent transition-colors"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={regel.aantal}
                          onChange={(e) => updateRegel(regel.id, "aantal", Number(e.target.value))}
                          className="w-16 bg-autronis-bg border border-autronis-border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-autronis-accent"
                          min={0}
                        />
                        <span className="text-xs text-autronis-text-secondary">{regel.type === "uren" ? "u" : "×"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-autronis-text-secondary">€</span>
                        <input
                          type="number"
                          value={regel.eenheidsprijs}
                          onChange={(e) => updateRegel(regel.id, "eenheidsprijs", Number(e.target.value))}
                          className="w-20 bg-autronis-bg border border-autronis-border rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:border-autronis-accent"
                          min={0}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-autronis-text-primary w-24 text-right tabular-nums">
                          {formatBedrag(regel.aantal * regel.eenheidsprijs)}
                        </span>
                        <button
                          onClick={() => updateRegel(regel.id, "isOptioneel", !regel.isOptioneel)}
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full border transition-colors",
                            regel.isOptioneel
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                              : "border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                          )}
                        >
                          opt.
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeRegel(regel.id)}
                      className="text-autronis-text-secondary hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Add buttons */}
              <div className="px-5 py-3 border-t border-autronis-border flex gap-2">
                <button onClick={() => addRegel("uren")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-autronis-text-secondary hover:text-autronis-accent border border-autronis-border hover:border-autronis-accent/50 rounded-lg transition-colors">
                  <Plus className="w-3.5 h-3.5" /><Clock className="w-3.5 h-3.5" /> Uren
                </button>
                <button onClick={() => addRegel("fixed")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-autronis-text-secondary hover:text-autronis-accent border border-autronis-border hover:border-autronis-accent/50 rounded-lg transition-colors">
                  <Plus className="w-3.5 h-3.5" /><Euro className="w-3.5 h-3.5" /> Vaste post
                </button>
              </div>
            </div>
          </div>

          {/* Right: Totaal + Offerte */}
          <div className="space-y-4">

            {/* Totaal kaart */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 space-y-4 sticky top-6">
              <h3 className="text-sm font-semibold text-autronis-text-primary">Totaal</h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-autronis-text-secondary">Subtotaal</span>
                  <span className="text-autronis-text-primary font-medium tabular-nums">{formatBedrag(totaalExcl)}</span>
                </div>

                {totaalOptioneel > 0 && (
                  <div className="flex justify-between">
                    <span className="text-amber-400 text-xs">+ Optioneel</span>
                    <span className="text-amber-400 text-xs tabular-nums">{formatBedrag(totaalOptioneel)}</span>
                  </div>
                )}

                {/* Korting */}
                <div className="flex items-center gap-2">
                  <Percent className="w-3.5 h-3.5 text-autronis-text-secondary shrink-0" />
                  <input
                    type="number"
                    value={korting || ""}
                    onChange={(e) => setKorting(Number(e.target.value))}
                    placeholder="Korting"
                    min={0}
                    className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-1 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
                  />
                  <button
                    onClick={() => setKortingType((v) => v === "percentage" ? "vast" : "percentage")}
                    className="text-xs px-2 py-1 border border-autronis-border rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                  >
                    {kortingType === "percentage" ? "%" : "€"}
                  </button>
                </div>

                {kortingBedrag > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Korting</span>
                    <span className="tabular-nums">- {formatBedrag(kortingBedrag)}</span>
                  </div>
                )}

                <div className="pt-1 border-t border-autronis-border flex justify-between font-medium">
                  <span className="text-autronis-text-secondary">Excl. BTW</span>
                  <span className="tabular-nums">{formatBedrag(naTotaal)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setBtw((v) => !v)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-colors",
                      btw ? "bg-autronis-accent/15 border-autronis-accent/30 text-autronis-accent" : "border-autronis-border text-autronis-text-secondary"
                    )}
                  >
                    BTW {BTW_PCT}%
                  </button>
                  <span className="text-autronis-text-secondary tabular-nums text-xs">{btw ? formatBedrag(btwBedrag) : "—"}</span>
                </div>

                <div className="pt-2 border-t border-autronis-border flex justify-between">
                  <span className="font-semibold text-autronis-text-primary">Totaal {btw ? "incl." : "excl."} BTW</span>
                  <span className="text-lg font-bold text-autronis-accent tabular-nums">{formatBedrag(totaalIncl)}</span>
                </div>
              </div>

              {/* Offerte aanmaken */}
              <div className="pt-2 space-y-3 border-t border-autronis-border">
                <p className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wide">Offerte aanmaken</p>
                <input
                  type="text"
                  value={offerteTitel}
                  onChange={(e) => setOfferteTitel(e.target.value)}
                  placeholder="Offerte titel..."
                  className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent transition-colors"
                />
                <button
                  onClick={handleMaakOfferte}
                  disabled={saving || !offerteTitel.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-autronis-accent text-autronis-bg rounded-xl text-sm font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-40"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Maak offerte aan
                </button>
                <button
                  onClick={() => router.push("/offertes")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-autronis-text-secondary hover:text-autronis-accent text-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Naar offertes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
