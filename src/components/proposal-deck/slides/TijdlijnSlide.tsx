// src/components/proposal-deck/slides/TijdlijnSlide.tsx
"use client";

import { TijdlijnSlide as TijdlijnSlideType } from "../types";
import {
  SLIDE_BASE,
  SLIDE_BG_LAYER,
  SLIDE_BG_OVERLAY,
  SLIDE_CONTENT,
  HEADING_LG,
  BODY_MD,
  ACCENT_TEXT,
  TYPE_LABEL,
} from "../styles";

export function TijdlijnSlide({ slide }: { slide: TijdlijnSlideType }) {
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
        <div className={TYPE_LABEL}>Tijdlijn</div>
        <h2 className={`${HEADING_LG} mb-12`}>{slide.titel}</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {slide.fases.map((fase, idx) => (
            <div
              key={idx}
              className="border border-[#2A3538] rounded-2xl p-6 bg-[#192225]"
            >
              <div
                className={`${ACCENT_TEXT} font-deck-heading font-bold text-sm tracking-widest uppercase mb-2`}
              >
                Fase {idx + 1} · {fase.duur}
              </div>
              <div className="text-xl md:text-2xl font-semibold text-white mb-3">
                {fase.naam}
              </div>
              <p className={BODY_MD}>{fase.omschrijving}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
