// Centralized color mapping for fiscaalType + transactie type.
// Used by the list view pills and detail panel tags so uitgaven,
// inkomsten and investeringen zijn in één oogopslag te onderscheiden.

export type FiscaalType = "investering" | "kosten" | "prive";
export type TransactieType = "bij" | "af";

interface TagStyle {
  label: string;
  pill: string; // background + text + border classes for a small badge
  accent: string; // solid ring/dot color for list rows
}

export const TYPE_STYLES: Record<TransactieType, TagStyle> = {
  bij: {
    label: "Inkomen",
    pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    accent: "bg-emerald-500",
  },
  af: {
    label: "Uitgave",
    pill: "bg-rose-500/10 text-rose-400 border-rose-500/25",
    accent: "bg-rose-500",
  },
};

export const FISCAAL_STYLES: Record<FiscaalType, TagStyle> = {
  investering: {
    label: "Investering",
    pill: "bg-sky-500/10 text-sky-400 border-sky-500/25",
    accent: "bg-sky-500",
  },
  kosten: {
    label: "Kosten",
    pill: "bg-autronis-bg text-autronis-text-secondary border-autronis-border",
    accent: "bg-autronis-border",
  },
  prive: {
    label: "Privé",
    pill: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    accent: "bg-amber-500",
  },
};

// Category colors — deterministic hash so each category gets a stable hue
// without having to enumerate them up front. Covers the common enum values
// plus anything free-text the AI / user might add.
const CATEGORIE_PALETTE = [
  "bg-indigo-500/10 text-indigo-400 border-indigo-500/25",
  "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/25",
  "bg-cyan-500/10 text-cyan-400 border-cyan-500/25",
  "bg-lime-500/10 text-lime-400 border-lime-500/25",
  "bg-orange-500/10 text-orange-400 border-orange-500/25",
  "bg-violet-500/10 text-violet-400 border-violet-500/25",
  "bg-teal-500/10 text-teal-400 border-teal-500/25",
  "bg-pink-500/10 text-pink-400 border-pink-500/25",
];

export function categoriePill(categorie: string | null | undefined): string {
  if (!categorie) return "bg-autronis-bg text-autronis-text-secondary border-autronis-border";
  let hash = 0;
  for (let i = 0; i < categorie.length; i++) {
    hash = (hash * 31 + categorie.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % CATEGORIE_PALETTE.length;
  return CATEGORIE_PALETTE[idx];
}
