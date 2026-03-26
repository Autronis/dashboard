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
  taal?: "nl" | "en";
}

const previewTranslations = {
  nl: {
    from: "Van",
    invoiceTo: "Factuur aan",
    quoteTo: "Offerte aan",
    invoiceNumber: "Factuurnummer",
    quoteNumber: "Offertenummer",
    invoiceDate: "Factuurdatum",
    quoteDate: "Offertedatum",
    dueDate: "Vervaldatum",
    validUntil: "Geldig tot",
    paymentTerm: "Betalingstermijn",
    days: "dagen",
    title: "Titel",
    description: "Omschrijving",
    quantity: "Aantal",
    price: "Prijs",
    vat: "BTW",
    total: "Totaal",
    subtotal: "Subtotaal",
    notes: "Opmerkingen",
    addLine: "Voeg een regel toe...",
    selectClient: "Selecteer een klant...",
    attn: "t.a.v.",
    paymentInstructions: "Betaalinstructies",
    paymentText: (term: number) => `Gelieve het totaalbedrag binnen ${term} dagen over te maken`,
    paymentDue: (date: string) => `, uiterlijk op`,
    paymentRef: (nr: string) => `Vermeld bij uw betaling: `,
    paidOn: (date: string) => `Betaald op ${date}`,
    tagline: "AI & Automatisering",
    docType: { FACTUUR: "FACTUUR", OFFERTE: "OFFERTE" },
  },
  en: {
    from: "From",
    invoiceTo: "Invoice to",
    quoteTo: "Quote to",
    invoiceNumber: "Invoice number",
    quoteNumber: "Quote number",
    invoiceDate: "Invoice date",
    quoteDate: "Quote date",
    dueDate: "Due date",
    validUntil: "Valid until",
    paymentTerm: "Payment term",
    days: "days",
    title: "Title",
    description: "Description",
    quantity: "Qty",
    price: "Price",
    vat: "VAT",
    total: "Total",
    subtotal: "Subtotal",
    notes: "Notes",
    addLine: "Add a line item...",
    selectClient: "Select a client...",
    attn: "Attn.",
    paymentInstructions: "Payment instructions",
    paymentText: (term: number) => `Please transfer the total amount within ${term} days`,
    paymentDue: (date: string) => `, no later than`,
    paymentRef: (nr: string) => `Reference: `,
    paidOn: (date: string) => `Paid on ${date}`,
    tagline: "AI & Automation",
    docType: { FACTUUR: "INVOICE", OFFERTE: "QUOTE" },
  },
} as const;

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
  taal = "nl",
}: DocumentPreviewProps) {
  const [fetchedBedrijf, setFetchedBedrijf] = useState<Bedrijf | null>(null);
  const t = previewTranslations[taal];

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
  const dateLabel = isFactuur ? t.invoiceDate : t.quoteDate;
  const nummerLabel = isFactuur ? t.invoiceNumber : t.quoteNumber;
  const aanLabel = isFactuur ? t.invoiceTo : t.quoteTo;
  const displayType = t.docType[type];

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
                {t.tagline}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p
              className="text-xl font-bold tracking-wider"
              style={{ color: TEAL }}
            >
              {displayType}
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
              {t.from}
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
                    {t.attn} {klant.contactpersoon}
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
                {t.selectClient}
              </p>
            )}
          </div>
        </div>

        {/* Meta bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border border-gray-100 rounded-lg px-4 py-3 mb-6">
          <MetaItem label={nummerLabel} value={nummer || "Auto"} muted={!nummer} />
          <MetaItem label={dateLabel} value={datum ? formatDatum(datum) : "\u2014"} />
          {isFactuur && vervaldatum && (
            <MetaItem label={t.dueDate} value={formatDatum(vervaldatum)} />
          )}
          {isFactuur && (
            <MetaItem label={t.paymentTerm} value={`${berekendeTermijn} ${t.days}`} />
          )}
          {!isFactuur && geldigTot && (
            <MetaItem label={t.validUntil} value={formatDatum(geldigTot)} />
          )}
          {titel && <MetaItem label={t.title} value={titel} />}
        </div>

        {/* ═══ Table ═══ */}
        <table className="w-full mb-5">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wider border-b-2 border-gray-200 text-gray-500">
              <th className="text-left py-2.5 px-3">{t.description}</th>
              <th className="text-center py-2.5 px-2 w-14">{t.quantity}</th>
              <th className="text-right py-2.5 px-2 w-20">{t.price}</th>
              <th className="text-center py-2.5 px-2 w-14">{t.vat}</th>
              <th className="text-right py-2.5 px-3 w-22">{t.total}</th>
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
                  {t.addLine}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ═══ Totals ═══ */}
        <div className="flex justify-end mb-5">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">{t.subtotal}</span>
              <span className="text-gray-800 tabular-nums">
                {formatBedrag(subtotaal)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">{t.vat} ({btwPercentage}%)</span>
              <span className="text-gray-800 tabular-nums">
                {formatBedrag(btwBedrag)}
              </span>
            </div>
            <div
              className="flex justify-between pt-2.5 mt-1.5"
              style={{ borderTop: `2px solid ${TEAL}` }}
            >
              <span className="text-sm font-bold text-gray-800">{t.total}</span>
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
              {t.notes}
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">{notities}</p>
          </div>
        )}

        {/* ═══ Betaalinstructies (factuur only) ═══ */}
        {isFactuur && (
          <div className="mb-5 p-3 rounded-lg border border-emerald-100 bg-emerald-50/50">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
              {t.paymentInstructions}
            </p>
            <p className="text-xs text-emerald-700 leading-relaxed">
              {t.paymentText(berekendeTermijn)}
              {vervaldatum && (
                <>{t.paymentDue(formatDatum(vervaldatum))} <span className="font-semibold">{formatDatum(vervaldatum)}</span></>
              )}
              .
              <br />
              {t.paymentRef(nummer || (taal === "en" ? "invoice number" : "factuurnummer"))}<span className="font-semibold">{nummer || (taal === "en" ? "invoice number" : "factuurnummer")}</span>
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
              {t.paidOn(formatDatum(betaaldOp))}
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
