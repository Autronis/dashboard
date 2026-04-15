"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Info, Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// In-dashboard cheat sheet voor wat wel/niet als zakelijke kilometer telt.
// Collapsable zodat 't niet storend is als je 'm vaak ziet, maar 1 klik om
// te checken als je twijfelt over een rit. Bron: Belastingdienst + common-
// sense interpretatie voor een klein bureau/VOF.

export function RegelsInfoBlock() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-autronis-bg/40 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <Info className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-autronis-text-primary">
            Wat telt als zakelijke kilometer?
          </p>
          <p className="text-[11px] text-autronis-text-secondary mt-0.5">
            {open ? "Klik om in te klappen" : "Klik voor de regels — €0,23/km aftrek"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-autronis-text-secondary transition-transform flex-shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 pb-5 space-y-5 border-t border-autronis-border/50 pt-5">
              {/* Algemeen principe */}
              <div className="bg-autronis-bg/30 rounded-xl p-4">
                <p className="text-sm text-autronis-text-primary font-medium mb-1">
                  Het basisprincipe
                </p>
                <p className="text-xs text-autronis-text-secondary leading-relaxed">
                  Wat telt is <strong className="text-autronis-text-primary">het doel van de rit</strong>, niet
                  waar je naartoe rijdt. Is de rit nodig voor je bedrijfsvoering →
                  zakelijk (€0,23/km aftrek). Is hij voor jezelf → privé, niet aftrekbaar.
                  Heen én terug tellen allebei.
                </p>
              </div>

              {/* Wel zakelijk */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-emerald-400">Wel zakelijk</h3>
                </div>
                <ul className="space-y-2 ml-8">
                  {[
                    "Klantbezoek (ook eerste kennismaking / sales)",
                    "Vergadering bij leverancier, partner of projectlocatie",
                    "Materiaal / hardware ophalen (Coolblue, Amac, Kabelshop)",
                    "Kantoorinkopen (Action, Praxis, Hornbach, Ikea)",
                    "Boodschappen voor kantoor (koffie, thee, schoonmaak, water)",
                    "Training, scholing of cursus",
                    "Congres, netwerk-event, conferentie",
                    "Notaris, KvK, Belastingdienst bezoek",
                    "Incidenteel kantoorbezoek (bv. thuiswerk-basis en soms langs)",
                    "Reparatie / service bij auto-dealer voor bedrijfsauto",
                  ].map((regel) => (
                    <li key={regel} className="flex items-start gap-2 text-xs text-autronis-text-secondary">
                      <span className="text-emerald-400/60 mt-0.5">●</span>
                      <span>{regel}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Niet zakelijk */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-rose-500/15 flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-rose-400">Niet zakelijk (= privé)</h3>
                </div>
                <ul className="space-y-2 ml-8">
                  {[
                    "Dagelijks woon-werkverkeer naar vaste kantoorlocatie",
                    "Persoonlijke boodschappen (supermarkt voor eigen lunch / eten thuis)",
                    "Tanken voor privé-gebruik",
                    "Sport, hobby, familiebezoek, vakantie",
                    "Dagelijkse pendel van huis ↔ kantoor (ook als je daar werkt)",
                  ].map((regel) => (
                    <li key={regel} className="flex items-start gap-2 text-xs text-autronis-text-secondary">
                      <span className="text-rose-400/60 mt-0.5">●</span>
                      <span>{regel}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Grijze zones */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-amber-400">Grijze zones — gebruik je oordeel</h3>
                </div>
                <div className="space-y-3 ml-8">
                  <div className="bg-autronis-bg/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-autronis-text-primary mb-1">
                      Gemengde supermarkt-run
                    </p>
                    <p className="text-[11px] text-autronis-text-secondary">
                      Jumbo bezoeken voor kantoor-koffie + je eigen lunch → rit is
                      zakelijk als kantoor-inkoop het hoofddoel was. De aankoop splits je:
                      koffie als kosten boeken, je eigen eten niet.
                    </p>
                  </div>
                  <div className="bg-autronis-bg/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-autronis-text-primary mb-1">
                      Lunch / eten onderweg
                    </p>
                    <p className="text-[11px] text-autronis-text-secondary">
                      Je eigen lunch tijdens werk = privé (eigen levensonderhoud).
                      Lunch met klant = representatiekosten, 80% aftrekbaar
                      (boek als &quot;kosten&quot; categorie representatie).
                    </p>
                  </div>
                  <div className="bg-autronis-bg/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-autronis-text-primary mb-1">
                      Thuiswerk-basis + nevenkantoor
                    </p>
                    <p className="text-[11px] text-autronis-text-secondary">
                      Als je thuis je hoofdwerkplek hebt en soms naar een andere locatie
                      (zoals Edisonstraat) rijdt, kan dat als zakelijk bezoek gelden —
                      niet als je er élke dag komt. Bij twijfel:
                      houd bij hoe vaak per week je rijdt. Meer dan 3x/week = woon-werk.
                    </p>
                  </div>
                </div>
              </div>

              {/* Praktische tip */}
              <div className="bg-autronis-accent/5 border border-autronis-accent/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-autronis-accent mb-1">
                  💡 Praktisch
                </p>
                <p className="text-[11px] text-autronis-text-secondary leading-relaxed">
                  Bewaar het bonnetje van je aankopen op <code className="text-autronis-text-primary">/administratie</code>.
                  Bij controle vraagt de fiscus om bewijs dat de boodschap
                  écht zakelijk was — een Action-bon &quot;12x koffiebekers + schoonmaak&quot;
                  spreekt voor zichzelf. Je lunch-broodje niet.
                  Bij twijfel over een grote rit of een bijzondere situatie: bel
                  je accountant voor de zekerheid, het is €30 maar je weet het zeker.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
