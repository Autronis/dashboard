/**
 * Autronis brand colors — gedeelde kleuren voor ALLE PDFs en klant-facing
 * templates (Sales Engine voorstel, Sales Engine presentatie, scope-generator
 * skill template.html).
 *
 * Deze kleuren matchen 1-op-1 met ~/.claude/skills/scope/template.html zodat
 * elk document dat een klant van Autronis ontvangt dezelfde visuele identiteit
 * heeft — ongeacht uit welk systeem het komt.
 *
 * Als je één kleur aanpast, update dan ook template.html in de scope-generator
 * repo (github.com/Autronis/scope-generator) zodat ze in sync blijven.
 */
export const AutronisBrand = {
  // Backgrounds
  bg: "#FAFAFA",
  card: "#FFFFFF",
  cardHover: "#F8FAFB",
  bgDark: "#0F172A", // donker slide voor presentatie cover/section slides

  // Accent kleur — Autronis teal
  accent: "#128C7E",
  accentLight: "#4DC9B4",
  accentHover: "#0E6B5F",
  accentBg: "rgba(18, 140, 126, 0.08)",
  accentBgStrong: "rgba(18, 140, 126, 0.15)",

  // Status
  success: "#16A34A",
  successBg: "rgba(22, 163, 74, 0.08)",
  warning: "#EA580C",
  danger: "#DC2626",

  // Tekst
  textPrimary: "#1F2529",
  textSecondary: "#64748B",
  textTertiary: "#94A3B8",
  textOnAccent: "#FFFFFF",

  // Borders
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
} as const;

/**
 * Kleur voor een impact-label (hoog/midden/laag). Gebruikt op kansen rijen
 * en badges. Matches de scope-generator template conventie.
 */
export function impactKleur(impact: string): string {
  if (impact === "hoog") return AutronisBrand.success;
  if (impact === "midden") return AutronisBrand.warning;
  return AutronisBrand.textSecondary;
}
