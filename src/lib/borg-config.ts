// Edisonstraat 60 — gedeeld kantoor met 4 huurders. Iedereen betaalt 1/4
// van de borg (€585 / 4 = €146,25) en 1/4 van de huur (€101,34/maand).
// Geen voorschot van Sem — alle 4 hebben hun eigen deel betaald.
export const BORG_CONFIG = {
  adres: "Edisonstraat 60",
  totaalBorg: 585.00,
  borgPerHuurder: 146.25,
  huurPerHuurder: 101.34,
  huurders: [
    { naam: "Sem Gijsberts", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" },
    { naam: "Syb (M. Sprenkeler)", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" },
    { naam: "LP Brands", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" },
    { naam: "Nukeware Entertainment", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" },
  ],
} as const;
