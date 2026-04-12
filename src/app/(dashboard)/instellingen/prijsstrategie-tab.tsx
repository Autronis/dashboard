"use client";

import { useState, useMemo } from "react";
import {
  Calculator,
  TrendingUp,
  Clock,
  Euro,
  Save,
  Info,
} from "lucide-react";
import { cn, formatBedrag } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AnimatedNumber } from "@/components/ui/animated-number";

interface PrijsstrategieTabProps {
  huidigUurtarief: number | null;
}

export function PrijsstrategieTab({ huidigUurtarief }: PrijsstrategieTabProps) {
  const { addToast } = useToast();
  const [opslaan, setOpslaan] = useState(false);

  // Inputs
  const [gewenstSalaris, setGewenstSalaris] = useState(50000);
  const [zakelijkeKosten, setZakelijkeKosten] = useState(15000);
  const [vakantieDagen, setVakantieDagen] = useState(25);
  const [ziekteDagen, setZiekteDagen] = useState(10);
  const [nietBillableUren, setNietBillableUren] = useState(10);
  const [belastingPercentage, setBelastingPercentage] = useState(35);

  // Calculations
  const berekening = useMemo(() => {
    const werkbareWeken = 52 - (vakantieDagen + ziekteDagen) / 5;
    const billableUrenPerWeek = Math.max(40 - nietBillableUren, 0);
    const totaalBillableUren = werkbareWeken * billableUrenPerWeek;
    const brutoNodig = (gewenstSalaris + zakelijkeKosten) / (1 - belastingPercentage / 100);
    const minimumUurtarief = totaalBillableUren > 0 ? brutoNodig / totaalBillableUren : 0;
    const aanbevolenUurtarief = minimumUurtarief * 1.2;

    return {
      werkbareWeken: Math.round(werkbareWeken * 10) / 10,
      billableUrenPerWeek,
      totaalBillableUren: Math.round(totaalBillableUren),
      brutoNodig: Math.round(brutoNodig * 100) / 100,
      minimumUurtarief: Math.round(minimumUurtarief * 100) / 100,
      aanbevolenUurtarief: Math.round(aanbevolenUurtarief * 100) / 100,
    };
  }, [gewenstSalaris, zakelijkeKosten, vakantieDagen, ziekteDagen, nietBillableUren, belastingPercentage]);

  const verschilHuidig = huidigUurtarief
    ? huidigUurtarief - berekening.aanbevolenUurtarief
    : null;

  async function handleOpslaanTarief() {
    setOpslaan(true);
    try {
      const res = await fetch("/api/profiel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uurtariefStandaard: berekening.aanbevolenUurtarief }),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
      addToast(`Uurtarief bijgewerkt naar ${formatBedrag(berekening.aanbevolenUurtarief)}`, "succes");
    } catch {
      addToast("Kon tarief niet opslaan", "fout");
    } finally {
      setOpslaan(false);
    }
  }

  const inputClasses =
    "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors tabular-nums";

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-purple-500/10 rounded-xl">
          <Calculator className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-autronis-text-primary">Prijsstrategie Calculator</h2>
          <p className="text-sm text-autronis-text-secondary">Bereken je optimale uurtarief</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">
              Gewenst netto jaarsalaris
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-autronis-text-secondary">&euro;</span>
              <input
                type="number"
                value={gewenstSalaris}
                onChange={(e) => setGewenstSalaris(Number(e.target.value))}
                className={cn(inputClasses, "pl-8")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">
              Geschatte zakelijke kosten per jaar
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-autronis-text-secondary">&euro;</span>
              <input
                type="number"
                value={zakelijkeKosten}
                onChange={(e) => setZakelijkeKosten(Number(e.target.value))}
                className={cn(inputClasses, "pl-8")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">
                Vakantiedagen/jaar
              </label>
              <input
                type="number"
                value={vakantieDagen}
                onChange={(e) => setVakantieDagen(Number(e.target.value))}
                min={0}
                max={52 * 5}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">
                Ziektedagen/jaar
              </label>
              <input
                type="number"
                value={ziekteDagen}
                onChange={(e) => setZiekteDagen(Number(e.target.value))}
                min={0}
                className={inputClasses}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">
              Niet-billable uren per week
            </label>
            <input
              type="number"
              value={nietBillableUren}
              onChange={(e) => setNietBillableUren(Number(e.target.value))}
              min={0}
              max={40}
              className={inputClasses}
            />
            <p className="text-xs text-autronis-text-secondary">
              Admin, acquisitie, leren, meetings etc.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-autronis-text-secondary">
              Belastingpercentage (schatting)
            </label>
            <div className="relative">
              <input
                type="number"
                value={belastingPercentage}
                onChange={(e) => setBelastingPercentage(Number(e.target.value))}
                min={0}
                max={100}
                className={cn(inputClasses, "pr-8")}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-autronis-text-secondary">%</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-5">
          {/* Breakdown card */}
          <div className="bg-autronis-bg/50 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
              <Info className="w-4 h-4 text-autronis-accent" />
              Berekening
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-autronis-text-secondary flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Werkbare weken
                </span>
                <span className="text-autronis-text-primary tabular-nums">{berekening.werkbareWeken}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-autronis-text-secondary flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Billable uren/week
                </span>
                <span className="text-autronis-text-primary tabular-nums">{berekening.billableUrenPerWeek}u</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-autronis-text-secondary flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Totaal billable uren/jaar
                </span>
                <span className="text-autronis-text-primary font-semibold tabular-nums">{berekening.totaalBillableUren}u</span>
              </div>
              <div className="border-t border-autronis-border my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-autronis-text-secondary flex items-center gap-2">
                  <Euro className="w-3.5 h-3.5" />
                  Bruto omzet nodig
                </span>
                <span className="text-autronis-text-primary font-semibold tabular-nums">{formatBedrag(berekening.brutoNodig)}</span>
              </div>
            </div>
          </div>

          {/* Result cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-autronis-bg/50 rounded-xl p-5 text-center border border-autronis-border">
              <p className="text-xs text-autronis-text-secondary mb-2">Minimum uurtarief</p>
              <p className="text-2xl font-bold text-yellow-400 tabular-nums">
                <AnimatedNumber value={berekening.minimumUurtarief} format={formatBedrag} />
              </p>
              <p className="text-[10px] text-autronis-text-secondary mt-1">break-even</p>
            </div>
            <div className="bg-autronis-accent/10 rounded-xl p-5 text-center border border-autronis-accent/30">
              <p className="text-xs text-autronis-text-secondary mb-2">Aanbevolen uurtarief</p>
              <p className="text-2xl font-bold text-autronis-accent tabular-nums">
                <AnimatedNumber value={berekening.aanbevolenUurtarief} format={formatBedrag} />
              </p>
              <p className="text-[10px] text-autronis-text-secondary mt-1">+20% marge</p>
            </div>
          </div>

          {/* Comparison with current */}
          {huidigUurtarief !== null && huidigUurtarief > 0 && (
            <div className={cn(
              "rounded-xl p-4 flex items-center gap-3",
              verschilHuidig !== null && verschilHuidig >= 0
                ? "bg-emerald-500/10 border border-emerald-500/20"
                : "bg-red-500/10 border border-red-500/20"
            )}>
              <TrendingUp className={cn(
                "w-5 h-5 flex-shrink-0",
                verschilHuidig !== null && verschilHuidig >= 0 ? "text-emerald-400" : "text-red-400"
              )} />
              <div>
                <p className="text-sm text-autronis-text-primary">
                  Huidig tarief: <span className="font-semibold tabular-nums">{formatBedrag(huidigUurtarief)}/u</span>
                </p>
                <p className={cn(
                  "text-xs",
                  verschilHuidig !== null && verschilHuidig >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {verschilHuidig !== null && (
                    verschilHuidig >= 0
                      ? `${formatBedrag(verschilHuidig)} boven aanbevolen tarief`
                      : `${formatBedrag(Math.abs(verschilHuidig))} onder aanbevolen tarief`
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleOpslaanTarief}
            disabled={opslaan}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {opslaan ? "Opslaan..." : `Sla ${formatBedrag(berekening.aanbevolenUurtarief)}/u op als standaard tarief`}
          </button>
        </div>
      </div>
    </div>
  );
}
