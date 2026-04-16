// src/lib/proposal-deck-tokens.ts
// Gedeelde waardes gebruikt door zowel de web-deck (Tailwind) als de PDF (@react-pdf/renderer).
// Wijzig hier = wijzigt overal. DRY.

export const DECK_COLORS = {
  bg: "#0E1719",
  card: "#192225",
  border: "#2A3538",
  accent: "#17B8A5",
  accentHover: "#4DC9B4",
  textPrimary: "#FFFFFF",
  textSecondary: "#A1AEB1",
  overlayDark: "rgba(14, 23, 25, 0.75)",
} as const;

export const DECK_FONTS = {
  heading: "SpaceGrotesk",
  body: "Inter",
} as const;

export const DECK_SIZES = {
  // PDF point sizes (A4 landscape = 842x595pt)
  pdfCoverHeading: 72,
  pdfHeading: 40,
  pdfSubheading: 24,
  pdfBody: 14,
  pdfSmall: 10,
  pdfTotaalImpact: 100,
  // Web uses Tailwind classes, not these numbers
} as const;
