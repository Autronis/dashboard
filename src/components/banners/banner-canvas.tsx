"use client";

import { forwardRef } from "react";
import type { BannerFormaat, BannerIcon, BannerIllustration } from "@/types/content";
import { BANNER_FORMAAT_SIZES } from "@/types/content";
import { BannerRenderer } from "./banner-renderer";

interface BannerCanvasProps {
  onderwerp: string;
  icon: BannerIcon;
  illustration: BannerIllustration;
  formaat: BannerFormaat;
  scale?: number;
}

export const BannerCanvas = forwardRef<HTMLDivElement, BannerCanvasProps>(
  function BannerCanvas({ onderwerp, icon, illustration, formaat, scale = 1 }, ref) {
    const { width, height } = BANNER_FORMAAT_SIZES[formaat];
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;

    return (
      <div
        ref={ref}
        style={{
          width: scaledWidth,
          height: scaledHeight,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <BannerRenderer
          onderwerp={onderwerp}
          icon={icon}
          illustration={illustration}
          formaat={formaat}
          scale={scale}
        />
      </div>
    );
  }
);
