// src/components/proposal-deck/slides/MarkdownSlide.tsx
"use client";

import { marked } from "marked";
import type {
  MarkdownSlide as MarkdownSlideData,
  MarkdownSlideType,
} from "../types";
import {
  SLIDE_BASE,
  SLIDE_BG_LAYER,
  SLIDE_BG_OVERLAY,
  SLIDE_CONTENT,
  HEADING_LG,
  BODY_LG,
  TYPE_LABEL,
} from "../styles";

const TYPE_LABELS: Record<MarkdownSlideType, string> = {
  situatie: "Situatie",
  aanpak: "Aanpak",
  waarom: "Waarom Autronis",
  volgende_stap: "Volgende stap",
  vrij: "",
};

export function MarkdownSlide({ slide }: { slide: MarkdownSlideData }) {
  const html = marked.parse(slide.body || "", { async: false }) as string;
  const label = TYPE_LABELS[slide.type];

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
        {label && <div className={TYPE_LABEL}>{label}</div>}
        <h2 className={`${HEADING_LG} mb-10`}>{slide.titel}</h2>
        <div
          className={`${BODY_LG} prose prose-invert max-w-3xl prose-headings:text-white prose-strong:text-white prose-a:text-[#17B8A5]`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  );
}
