// src/components/proposal-deck/slides/CoverSlide.tsx
"use client";

import Image from "next/image";
import { CoverSlide as CoverSlideType } from "../types";
import type { ProposalMeta } from "../Deck";
import {
  SLIDE_BASE,
  SLIDE_BG_LAYER,
  SLIDE_BG_OVERLAY,
  SLIDE_CONTENT,
  HEADING_XL,
  BODY_LG,
  ACCENT_TEXT,
  TYPE_LABEL,
} from "../styles";

export function CoverSlide({
  slide,
  meta,
}: {
  slide: CoverSlideType;
  meta: ProposalMeta;
}) {
  const datum = meta.datum
    ? new Date(meta.datum).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

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
        <div className="absolute top-12 left-12">
          <Image src="/icon.png" alt="Autronis" width={48} height={48} priority />
        </div>
        <div className="space-y-8">
          <div className={TYPE_LABEL}>Voor</div>
          <h1 className={HEADING_XL}>{meta.klantNaam}</h1>
          <p className={`${BODY_LG} ${ACCENT_TEXT} max-w-3xl`}>{meta.titel}</p>
          {datum && <p className={BODY_LG}>{datum}</p>}
        </div>
      </div>
    </section>
  );
}
