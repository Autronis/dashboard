export const BORG_CONFIG = {
  adres: "Edisonstraat 60",
  totaalBorg: 585.00,
  huurders: [
    { naam: "Sem (voorgeschoten)", borg: 585.00, huurPerMaand: 101.34, status: "eigen deel" },
    { naam: "Syb (M. Sprenkeler)", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" },
    { naam: "LP Brands", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" },
    { naam: "Nukeware Entertainment", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" },
  ],
} as const;
