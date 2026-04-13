// src/components/proposal-deck/styles.ts
// Tailwind class sets used across slide components. Keep DRY.

export const SLIDE_BASE =
  "relative w-full h-screen flex items-center justify-center px-12 md:px-20 lg:px-32 overflow-hidden";

export const SLIDE_BG_LAYER = "absolute inset-0 z-0";
export const SLIDE_BG_OVERLAY = "absolute inset-0 bg-[#0E1719]/75 z-10";
export const SLIDE_CONTENT = "relative z-20 w-full max-w-6xl mx-auto";

export const HEADING_XL =
  "font-deck-heading text-[clamp(3rem,8vw,7rem)] font-bold leading-[0.95] tracking-tight text-white";
export const HEADING_LG =
  "font-deck-heading text-[clamp(2rem,5vw,4.5rem)] font-bold leading-tight tracking-tight text-white";
export const HEADING_MD =
  "font-deck-heading text-[clamp(1.5rem,3vw,2.5rem)] font-semibold leading-snug text-white";

export const BODY_LG = "text-[clamp(1.125rem,1.5vw,1.5rem)] text-white/80 leading-relaxed";
export const BODY_MD = "text-base md:text-lg text-white/70 leading-relaxed";

export const ACCENT_TEXT = "text-[#17B8A5]";
export const ACCENT_BG = "bg-[#17B8A5]";

export const TYPE_LABEL =
  "text-xs font-semibold tracking-widest uppercase text-[#17B8A5] mb-6";
