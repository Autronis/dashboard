"use client";

import { Check, X, AlertCircle } from "lucide-react";
import { UitlegBlock } from "@/components/ui/uitleg-block";

// In-dashboard cheat sheet voor wat wel/niet als zakelijke kilometer telt.
// Bron: Belastingdienst + common-sense interpretatie voor een klein bureau/VOF.

export function RegelsInfoBlock() {
  return (
    <UitlegBlock
      id="kilometers-regels"
      titel="Wat telt als zakelijke kilometer?"
      subtitel="Klik voor de regels — €0,23/km aftrek"
      accent="blue"
      defaultOpen={false}
    >
              {/* Algemeen principe */}
              <div className="bg-autronis-bg/30 rounded-xl p-4 space-y-2">
                <p className="text-sm text-autronis-text-primary font-medium">
                  Het basisprincipe
                </p>
                <p className="text-xs text-autronis-text-secondary leading-relaxed">
                  Wat telt is <strong className="text-autronis-text-primary">het doel van de rit</strong>, niet
                  waar je naartoe rijdt. Is de rit nodig voor je bedrijfsvoering →
                  zakelijk (€0,23/km aftrek). Is hij voor jezelf → privé, niet aftrekbaar.
                  Heen én terug tellen allebei. Files, omwegen en parkeer-rondjes tellen ook
                  mee in de km die je opgeeft.
                </p>
                <p className="text-[11px] text-autronis-text-secondary/80 leading-relaxed">
                  Dit regime geldt alleen voor je <strong className="text-autronis-text-primary">privé-auto die
                  je voor zakelijke ritten gebruikt</strong>. Voor een &quot;auto van de zaak&quot;
                  gelden andere regels (bijtelling) — die rijdt Sem niet, dus niet relevant.
                  Zakelijke <strong className="text-autronis-text-primary">fietsritten</strong> tellen ook voor €0,23/km
                  (sinds 2023 — registreer ze hier net zo goed).
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

              {/* APART aftrekbaar bovenop €0,23 */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-400 mb-2">
                  Bovenop de €0,23/km — apart aftrekbaar
                </p>
                <ul className="space-y-1.5">
                  {[
                    "Parkeerkosten bij een zakelijke rit (parkeergarage, parkeermeter, Q-Park) — bewaar het bonnetje",
                    "Tol (Liefkenshoektunnel, Franse péages, Eurotunnel) — apart bonnetje opvoeren",
                    "Veerboot (bv. TESO Texel) als 't voor een zakelijk doel is",
                    "Stallingskosten bij overnachting (klantbezoek met overnachten)",
                  ].map((regel) => (
                    <li key={regel} className="flex items-start gap-2 text-[11px] text-autronis-text-secondary">
                      <span className="text-blue-400/60 mt-0.5">+</span>
                      <span>{regel}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-autronis-text-secondary/70 mt-2 italic">
                  Deze boek je los als &quot;kosten&quot; in /administratie — niet bij km.
                </p>
              </div>

              {/* Zit AL in de €0,23 */}
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-rose-400 mb-2">
                  Zit al in de €0,23/km — NIET apart claimen
                </p>
                <ul className="space-y-1.5">
                  {[
                    "Brandstof / tanken voor zakelijke ritten",
                    "Onderhoud, APK, banden, ruitenwissers",
                    "Afschrijving, leasekosten, rente",
                    "Autoverzekering, MRB (wegenbelasting)",
                    "Carwash, ruitvloeistof, smeermiddelen",
                    "Verkeersboetes — die zijn sowieso NOOIT aftrekbaar",
                  ].map((regel) => (
                    <li key={regel} className="flex items-start gap-2 text-[11px] text-autronis-text-secondary">
                      <span className="text-rose-400/60 mt-0.5">−</span>
                      <span>{regel}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-autronis-text-secondary/70 mt-2 italic">
                  Het forfait van €0,23/km is een &quot;all-in&quot; vergoeding voor alle autokosten.
                  Dubbel claimen = naheffing bij controle.
                </p>
              </div>

              {/* Bewijsplicht / administratie */}
              <div className="bg-autronis-bg/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-autronis-text-primary mb-2">
                  Wat moet je bijhouden per rit (verplicht voor bewijs)
                </p>
                <ul className="space-y-1.5">
                  {[
                    "Datum",
                    "Vertrek- en aankomstadres (of locatienaam)",
                    "Aantal gereden kilometers (heen + terug)",
                    "Doel van de rit (klantnaam, vergadering, materiaal ophalen, etc.)",
                    "Eventueel: km-stand begin en eind van het jaar",
                  ].map((regel) => (
                    <li key={regel} className="flex items-start gap-2 text-[11px] text-autronis-text-secondary">
                      <span className="text-autronis-accent/60 mt-0.5">▸</span>
                      <span>{regel}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-autronis-text-secondary/70 mt-2 italic">
                  Dit dashboard vult dat allemaal automatisch in als je een rit toevoegt.
                  Bewaar de rittenadministratie minstens 7 jaar (fiscale bewaarplicht).
                </p>
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
    </UitlegBlock>
  );
}
