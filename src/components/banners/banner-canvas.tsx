"use client";

import { forwardRef } from "react";
import type { BannerTemplateType, BannerFormaat, BannerData, QuoteData, StatData, TipData, CaseStudyData } from "@/types/content";
import { QuoteTemplate } from "./templates/quote-template";
import { StatTemplate } from "./templates/stat-template";
import { TipTemplate } from "./templates/tip-template";
import { CaseStudyTemplate } from "./templates/case-study-template";

const FORMAAT_SIZES: Record<BannerFormaat, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1350 },
  linkedin: { width: 1200, height: 627 },
  instagram_story: { width: 1080, height: 1920 },
};

interface BannerCanvasProps {
  templateType: BannerTemplateType;
  variant: number;
  formaat: BannerFormaat;
  data: BannerData;
  scale?: number;
}

export const BannerCanvas = forwardRef<HTMLDivElement, BannerCanvasProps>(
  function BannerCanvas({ templateType, variant, formaat, data, scale = 1 }, ref) {
    const { width, height } = FORMAAT_SIZES[formaat];
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;

    function renderTemplate() {
      switch (templateType) {
        case "quote":
          return (
            <QuoteTemplate
              data={data as QuoteData}
              variant={variant}
              width={width}
              height={height}
            />
          );
        case "stat":
          return (
            <StatTemplate
              data={data as StatData}
              variant={variant}
              width={width}
              height={height}
            />
          );
        case "tip":
          return (
            <TipTemplate
              data={data as TipData}
              variant={variant}
              width={width}
              height={height}
            />
          );
        case "case_study":
          return (
            <CaseStudyTemplate
              data={data as CaseStudyData}
              variant={variant}
              width={width}
              height={height}
            />
          );
      }
    }

    return (
      <div
        style={{
          width: scaledWidth,
          height: scaledHeight,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div
          ref={ref}
          style={{
            width,
            height,
            transformOrigin: "top left",
            transform: scale !== 1 ? `scale(${scale})` : undefined,
          }}
        >
          {renderTemplate()}
        </div>
      </div>
    );
  }
);
