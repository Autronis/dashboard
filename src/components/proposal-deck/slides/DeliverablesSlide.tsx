// src/components/proposal-deck/slides/DeliverablesSlide.tsx
"use client";

import { DeliverablesSlide as DeliverablesSlideType } from "../types";
import {
  SLIDE_BASE,
  SLIDE_BG_LAYER,
  SLIDE_BG_OVERLAY,
  SLIDE_CONTENT,
  HEADING_LG,
  BODY_LG,
  ACCENT_TEXT,
  TYPE_LABEL,
} from "../styles";

export function DeliverablesSlide({ slide }: { slide: DeliverablesSlideType }) {
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
        <div className={TYPE_LABEL}>Deliverables</div>
        <h2 className={`${HEADING_LG} mb-12`}>{slide.titel}</h2>
        <ul className="space-y-6">
          {slide.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-6">
              <span
                className={`${ACCENT_TEXT} font-deck-heading font-bold text-2xl md:text-3xl tabular-nums min-w-[3ch]`}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className={BODY_LG}>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
