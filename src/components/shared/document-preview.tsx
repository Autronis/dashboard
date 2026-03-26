"use client";

import { useEffect, useState } from "react";
import { formatBedrag, formatDatum } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────
interface Klant {
  bedrijfsnaam: string;
  contactpersoon?: string | null;
  email?: string | null;
  adres?: string | null;
}

interface Regel {
  omschrijving: string;
  aantal: number;
  eenheidsprijs: number;
  btwPercentage: number;
  totaal?: number;
}

interface Bedrijf {
  bedrijfsnaam?: string | null;
  email?: string | null;
  adres?: string | null;
  kvkNummer?: string | null;
  btwNummer?: string | null;
  iban?: string | null;
  telefoon?: string | null;
}

interface DocumentPreviewProps {
  type: "FACTUUR" | "OFFERTE";
  klant: Klant | null;
  nummer?: string | null;
  datum: string;
  vervaldatum?: string;
  geldigTot?: string;
  betalingstermijn?: number;
  titel?: string;
  regels: Regel[];
  subtotaal: number;
  btwBedrag: number;
  totaal: number;
  notities?: string | null;
  btwPercentage?: number;
  betaaldOp?: string | null;
  sticky?: boolean;
  bedrijf?: Bedrijf | null;
}

const TEAL = "#17B8A5";

export function DocumentPreview({
  type,
  klant,
  nummer,
  datum,
  vervaldatum,
  geldigTot,
  betalingstermijn,
  titel,
  regels,
  subtotaal,
  btwBedrag,
  totaal,
  notities,
  btwPercentage = 21,
  betaaldOp,
  sticky = false,
  bedrijf,
}: DocumentPreviewProps) {
  const [fetchedBedrijf, setFetchedBedrijf] = useState<Bedrijf | null>(null);

  useEffect(() => {
    if (!bedrijf) {
      fetch("/api/instellingen")
        .then((r) => r.json())
        .then((d) => { if (d.bedrijf) setFetchedBedrijf(d.bedrijf); })
        .catch(() => {});
    }
  }, [bedrijf]);

  const b = bedrijf || fetchedBedrijf;

  // Bereken betalingstermijn uit datum en vervaldatum als die niet expliciet is meegegeven
  const berekendeTermijn = (() => {
    if (betalingstermijn) return betalingstermijn;
    if (datum && vervaldatum) {
      const diff = Math.round(
        (new Date(vervaldatum).getTime() - new Date(datum).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diff > 0) return diff;
    }
    return 30;
  })();

  const isFactuur = type === "FACTUUR";
  const dateLabel = isFactuur ? "Factuurdatum" : "Offertedatum";
  const nummerLabel = isFactuur ? "Factuurnummer" : "Offertenummer";
  const aanLabel = isFactuur ? "Factuur aan" : "Offerte aan";

  return (
    <div
      className={`bg-white rounded-2xl shadow-lg overflow-hidden ${sticky ? "sticky top-8" : ""}`}
    >
      {/* ═══ Header ═══ */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Autronis"
              className="w-9 h-9 object-contain"
            />
            <div>
              <p className="text-sm font-bold tracking-widest text-gray-900">
                AUTRONIS
              </p>
              <p className="text-[10px] text-gray-400 tracking-wide mt-0.5">
                AI & Automatisering
              </p>
            </div>
          </div>
          <div className="text-right">
            <p
              className="text-xl font-bold tracking-wider"
              style={{ color: TEAL }}
            >
              {type}
            </p>
            {nummer && (
              <p className="text-[11px] text-gray-400 mt-1">{nummer}</p>
            )}
          </div>
        </div>
      </div>

      {/* Teal accent line */}
      <div className="mx-8 h-[2px]" style={{ backgroundColor: TEAL }} />

      {/* ═══ Body ═══ */}
      <div className="px-8 py-6">
        {/* Van / Aan section */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-wider mb-2"
              style={{ color: TEAL }}
            >
              Van
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              <span className="font-semibold text-gray-800">{b?.bedrijfsnaam || "Autronis"}</span>
              <br />
              {b?.email || "zakelijk@autronis.com"}
              <br />
              autronis.nl
              {b?.adres && (
                <>
                  <br />
                  {b.adres}
                </>
              )}
            </p>
          </div>
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-wider mb-2"
              style={{ color: TEAL }}
            >
              {aanLabel}
            </p>
            {klant ? (
              <p className="text-xs text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-800">{klant.bedrijfsnaam}</span>
                {klant.contactpersoon && (
                  <>
                    <br />
                    t.a.v. {klant.contactpersoon}
                  </>
                )}
                {klant.adres && (
                  <>
                    <br />
                    {klant.adres}
                  </>
                )}
                {klant.email && (
                  <>
                    <br />
                    {klant.email}
                  </>
                )}
              </p>
            ) : (
              <p className="text-xs text-gray-400 italic">
                Selecteer een klant...
              </p>
            )}
          </div>
        </div>

        {/* Meta bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border border-gray-100 rounded-lg px-4 py-3 mb-6">
          <MetaItem label={nummerLabel} value={nummer || "Auto"} muted={!nummer} />
          <MetaItem label={dateLabel} value={datum ? formatDatum(datum) : "\u2014"} />
          {isFactuur && vervaldatum && (
            <MetaItem label="Vervaldatum" value={formatDatum(vervaldatum)} />
          )}
          {isFactuur && (
            <MetaItem label="Betalingstermijn" value={`${berekendeTermijn} dagen`} />
          )}
          {!isFactuur && geldigTot && (
            <MetaItem label="Geldig tot" value={formatDatum(geldigTot)} />
          )}
          {titel && <MetaItem label="Titel" value={titel} />}
        </div>

        {/* ═══ Table ═══ */}
        <table className="w-full mb-5">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wider border-b-2 border-gray-200 text-gray-500">
              <th className="text-left py-2.5 px-3">Omschrijving</th>
              <th className="text-center py-2.5 px-2 w-14">Aantal</th>
              <th className="text-right py-2.5 px-2 w-20">Prijs</th>
              <th className="text-center py-2.5 px-2 w-14">BTW</th>
              <th className="text-right py-2.5 px-3 w-22">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {regels.map((regel, i) => {
              const regelTotaal =
                regel.totaal ?? regel.aantal * regel.eenheidsprijs;
              return (
                <tr
                  key={i}
                  className="border-b border-gray-100"
                >
                  <td className="py-2.5 px-3 text-xs text-gray-700">
                    {regel.omschrijving || (
                      <span className="text-gray-400 italic">...</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-xs text-gray-700 text-center tabular-nums">
                    {regel.aantal}
                  </td>
                  <td className="py-2.5 px-2 text-xs text-gray-700 text-right tabular-nums">
                    {formatBedrag(regel.eenheidsprijs)}
                  </td>
                  <td className="py-2.5 px-2 text-xs text-gray-700 text-center">
                    {regel.btwPercentage}%
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-700 text-right tabular-nums">
                    {formatBedrag(regelTotaal)}
                  </td>
                </tr>
              );
            })}
            {regels.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-5 text-xs text-gray-400 text-center italic"
                >
                  Voeg een regel toe...
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ═══ Totals ═══ */}
        <div className="flex justify-end mb-5">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Subtotaal</span>
              <span className="text-gray-800 tabular-nums">
                {formatBedrag(subtotaal)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">BTW ({btwPercentage}%)</span>
              <span className="text-gray-800 tabular-nums">
                {formatBedrag(btwBedrag)}
              </span>
            </div>
            <div
              className="flex justify-between pt-2.5 mt-1.5"
              style={{ borderTop: `2px solid ${TEAL}` }}
            >
              <span className="text-sm font-bold text-gray-800">Totaal</span>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: TEAL }}
              >
                {formatBedrag(totaal)}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ Notities ═══ */}
        {notities && notities.trim() && (
          <div
            className="mb-5 p-3 rounded-lg border border-gray-100"
            style={{ borderLeftWidth: 3, borderLeftColor: TEAL }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-wider mb-1"
              style={{ color: TEAL }}
            >
              Opmerkingen
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">{notities}</p>
          </div>
        )}

        {/* ═══ Betaalinstructies (factuur only) ═══ */}
        {isFactuur && (
          <div className="mb-5 p-3 rounded-lg border border-emerald-100 bg-emerald-50/50">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
              Betaalinstructies
            </p>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Gelieve het totaalbedrag binnen{" "}
              {berekendeTermijn} dagen over te maken
              {vervaldatum && (
                <>, uiterlijk op <span className="font-semibold">{formatDatum(vervaldatum)}</span></>
              )}
              .
              <br />
              Vermeld bij uw betaling: <span className="font-semibold">{nummer || "factuurnummer"}</span>
            </p>
          </div>
        )}

        {/* Betaald indicator */}
        {betaaldOp && (
          <div className="flex items-center gap-2 text-green-600 mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">
              Betaald op {formatDatum(betaaldOp)}
            </span>
          </div>
        )}
      </div>

      {/* ═══ Footer ═══ */}
      <div className="mx-8 h-px bg-gray-100" />
      <div className="px-8 py-4 flex justify-between items-start text-[10px]">
        <div className="text-gray-400 leading-relaxed">
          <span style={{ color: TEAL }} className="font-semibold">
            {bedrijf?.bedrijfsnaam || "Autronis"}
          </span>{" "}
          | {bedrijf?.email || "zakelijk@autronis.com"} | autronis.nl
        </div>
        <div className="text-gray-400 text-right leading-relaxed">
          {[
            b?.kvkNummer ? `KvK: ${b.kvkNummer}` : null,
            b?.btwNummer ? `BTW: ${b.btwNummer}` : null,
            b?.iban ? `IBAN: ${b.iban}` : null,
          ].filter(Boolean).join(" · ") || "KvK · BTW · IBAN"}
        </div>
      </div>
    </div>
  );
}

// ─── Helper ─────────────────────────────────────────────────────
function MetaItem({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`text-xs font-semibold mt-0.5 ${muted ? "text-gray-400 italic" : "text-gray-800"}`}
      >
        {value}
      </p>
    </div>
  );
}
