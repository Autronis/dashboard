// src/components/proposal-deck/slides/InvesteringSlide.tsx
"use client";

import { InvesteringSlide as InvesteringSlideType } from "../types";
import type { ProposalMeta, ProposalRegel } from "../Deck";
import {
  SLIDE_BASE,
  SLIDE_BG_LAYER,
  SLIDE_BG_OVERLAY,
  SLIDE_CONTENT,
  ACCENT_TEXT,
  TYPE_LABEL,
  BODY_MD,
} from "../styles";

function formatBedrag(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function InvesteringSlide({
  slide,
  meta,
  regels,
}: {
  slide: InvesteringSlideType;
  meta: ProposalMeta;
  regels: ProposalRegel[];
}) {
  return (
    <section className={SLIDE_BASE} style={{ backgroundColor: "#0E1719" }}>
      {slide.bgImageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.bgImageUrl}
            alt=""
            className={`${SLIDE_BG_LAYER} object-cover w-full h-full`}
          />
          <div className={SLIDE_BG_OVERLAY} />
        </>
      )}
      <div className={SLIDE_CONTENT}>
        <div className={TYPE_LABEL}>Investering</div>
        <div className="grid gap-12 md:grid-cols-[1fr_auto] items-center">
          <div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2A3538]">
                  <th className="py-3 pr-4 text-xs uppercase tracking-wide text-white/60 font-semibold">
                    Omschrijving
                  </th>
                  <th className="py-3 px-2 text-xs uppercase tracking-wide text-white/60 font-semibold text-right">
                    Aantal
                  </th>
                  <th className="py-3 px-2 text-xs uppercase tracking-wide text-white/60 font-semibold text-right">
                    Prijs
                  </th>
                  <th className="py-3 pl-2 text-xs uppercase tracking-wide text-white/60 font-semibold text-right">
                    Totaal
                  </th>
                </tr>
              </thead>
              <tbody>
                {regels.map((r) => (
                  <tr key={r.id} className="border-b border-[#2A3538]/50">
                    <td className={`py-4 pr-4 ${BODY_MD} text-white`}>{r.omschrijving}</td>
                    <td className={`py-4 px-2 ${BODY_MD} text-right tabular-nums`}>
                      {r.aantal ?? 1}
                    </td>
                    <td className={`py-4 px-2 ${BODY_MD} text-right tabular-nums`}>
                      {formatBedrag(r.eenheidsprijs ?? 0)}
                    </td>
                    <td className={`py-4 pl-2 ${BODY_MD} text-right tabular-nums font-semibold text-white`}>
                      {formatBedrag(r.totaal ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-xs uppercase tracking-widest text-white/60 mb-3">
              Totaal
            </div>
            <div
              className={`font-deck-heading font-bold leading-none ${ACCENT_TEXT} text-[clamp(4rem,10vw,9rem)] tabular-nums`}
            >
              {formatBedrag(meta.totaalBedrag ?? 0)}
            </div>
            {meta.geldigTot && (
              <div className="text-sm text-white/60 mt-4">
                Geldig tot {new Date(meta.geldigTot).toLocaleDateString("nl-NL")}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
