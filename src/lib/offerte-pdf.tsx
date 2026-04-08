import React from "react";
import path from "path";
import fs from "fs";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";

let _logoSrc: string | null = null;
function getLogoSrc(): string {
  if (!_logoSrc) {
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      const buf = fs.readFileSync(logoPath);
      _logoSrc = `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      _logoSrc = "";
    }
  }
  return _logoSrc;
}

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(FONT_DIR, "Inter-400.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Inter-600.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "Inter-700.ttf"), fontWeight: 700 },
  ],
});

// Autronis brand colors
const TEAL = "#17B8A5";
const DARK_BG = "#0E1719";
const TEXT_PRIMARY = "#E8ECED";
const TEXT_SECONDARY = "#8A9BA0";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    color: "#1F2937",
    backgroundColor: "#FFFFFF",
  },
  // ===== DARK HEADER =====
  headerBand: {
    backgroundColor: DARK_BG,
    paddingHorizontal: 50,
    paddingTop: 30,
    paddingBottom: 25,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoImage: {
    width: 50,
    height: 25,
  },
  logoTextWrap: {},
  bedrijfsnaam: {
    fontSize: 16,
    fontWeight: 700,
    color: TEAL,
    letterSpacing: 1.5,
  },
  tagline: {
    fontSize: 7,
    color: TEXT_SECONDARY,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  documentType: {
    fontSize: 26,
    fontWeight: 700,
    color: TEXT_PRIMARY,
    letterSpacing: 3,
  },
  offerteNummer: {
    fontSize: 9,
    color: TEXT_SECONDARY,
    marginTop: 4,
  },
  // ===== TEAL ACCENT LINE =====
  accentLine: {
    height: 3,
    backgroundColor: TEAL,
  },
  // ===== BODY =====
  body: {
    paddingHorizontal: 50,
    paddingTop: 28,
    paddingBottom: 20,
  },
  // ===== INFO SECTION =====
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  infoBlock: {
    width: "48%",
  },
  infoLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: TEAL,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 10,
    lineHeight: 1.7,
    color: "#374151",
  },
  // ===== META BAR =====
  metaBar: {
    flexDirection: "row",
    backgroundColor: "#F8FAFB",
    borderRadius: 6,
    padding: 12,
    marginBottom: 20,
    gap: 30,
  },
  metaItem: {},
  metaItemLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaItemValue: {
    fontSize: 10,
    fontWeight: 600,
    color: "#374151",
  },
  // ===== INTRO TEXT =====
  introSection: {
    marginBottom: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  introText: {
    fontSize: 10,
    lineHeight: 1.7,
    color: "#4B5563",
  },
  // ===== TABLE =====
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: DARK_BG,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableRowAlt: {
    backgroundColor: "#F9FAFB",
  },
  colOmschrijving: { width: "42%" },
  colAantal: { width: "12%", textAlign: "center" },
  colPrijs: { width: "16%", textAlign: "right" },
  colBtw: { width: "12%", textAlign: "center" },
  colTotaal: { width: "18%", textAlign: "right" },
  headerText: {
    fontSize: 7,
    fontWeight: 600,
    color: TEXT_PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  regelText: {
    fontSize: 9.5,
    color: "#374151",
  },
  regelOptional: {
    fontSize: 7,
    color: "#9CA3AF",
    fontStyle: "italic",
    marginTop: 2,
  },
  // ===== TOTALS =====
  totalen: {
    alignItems: "flex-end",
    marginTop: 10,
    marginBottom: 20,
  },
  totalenBox: {
    width: 280,
    backgroundColor: "#F8FAFB",
    borderRadius: 8,
    padding: 14,
  },
  totalenRij: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalenLabel: {
    color: "#6B7280",
    fontSize: 10,
  },
  totalenWaarde: {
    fontSize: 10,
    color: "#374151",
  },
  totalenGroot: {
    fontSize: 15,
    fontWeight: 700,
    color: TEAL,
  },
  totalenDivider: {
    borderTopWidth: 2,
    borderTopColor: TEAL,
    paddingTop: 8,
    marginTop: 6,
  },
  // ===== NOTITIES =====
  notities: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "#F9FAFB",
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
  },
  notitiesLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: TEAL,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  // ===== BETALINGSVOORWAARDEN =====
  voorwaarden: {
    marginTop: 16,
    padding: 14,
    backgroundColor: "#F0FDFA",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CCFBF1",
  },
  voorwaardenTitel: {
    fontSize: 8,
    fontWeight: 600,
    color: "#0F766E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  voorwaardenText: {
    fontSize: 8.5,
    color: "#0F766E",
    lineHeight: 1.7,
  },
  // ===== GELDIGHEID =====
  geldigheid: {
    marginTop: 14,
    padding: 12,
    backgroundColor: `#FFFBEB`,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  geldigheidText: {
    fontSize: 9,
    color: "#92400E",
    fontWeight: 600,
  },
  // ===== FOOTER =====
  footer: {
    backgroundColor: DARK_BG,
    paddingHorizontal: 50,
    paddingVertical: 18,
    marginTop: "auto",
  },
  footerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  footerCol: {
    width: "30%",
  },
  footerLabel: {
    fontSize: 6,
    fontWeight: 600,
    color: TEAL,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  footerText: {
    fontSize: 8,
    color: TEXT_SECONDARY,
    lineHeight: 1.6,
  },
  footerCenter: {
    textAlign: "center",
    fontSize: 7,
    color: TEXT_SECONDARY,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#2A3538",
  },
});

interface Regel {
  omschrijving: string;
  aantal: number | null;
  eenheidsprijs: number | null;
  btwPercentage: number | null;
  totaal: number | null;
  isOptioneel?: number | null;
  sectie?: string | null;
}

interface OffertePDFProps {
  offerte: {
    offertenummer: string;
    titel: string | null;
    type?: string | null;
    datum: string | null;
    geldigTot: string | null;
    bedragExclBtw: number | null;
    btwPercentage: number | null;
    btwBedrag: number | null;
    bedragInclBtw: number | null;
    notities: string | null;
    korting?: number | null;
    klantNaam: string;
    klantContactpersoon: string | null;
    klantEmail: string | null;
    klantAdres: string | null;
  };
  regels: Regel[];
  bedrijf: {
    bedrijfsnaam: string | null;
    adres: string | null;
    kvkNummer: string | null;
    btwNummer: string | null;
    email: string | null;
    telefoon: string | null;
    website: string | null;
    iban: string | null;
  };
}

function formatBedragPDF(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(bedrag);
}

function formatDatumPDF(datum: string): string {
  return new Date(datum).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "fixed": return "Fixed Price";
    case "retainer": return "Retainer";
    default: return "Per Uur";
  }
}

export function OffertePDF({ offerte, regels, bedrijf }: OffertePDFProps) {
  const subtotaal = offerte.bedragExclBtw || 0;
  const korting = offerte.korting || 0;
  const subtotaalNaKorting = subtotaal - korting;
  const btwBedrag = korting > 0
    ? subtotaalNaKorting * ((offerte.btwPercentage || 21) / 100)
    : (offerte.btwBedrag || 0);
  const totaal = korting > 0
    ? subtotaalNaKorting + btwBedrag
    : (offerte.bedragInclBtw || 0);

  const contactNaam = offerte.klantContactpersoon || offerte.klantNaam;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ===== DARK HEADER ===== */}
        <View style={styles.headerBand}>
          <View style={styles.headerContent}>
            <View style={styles.logoSection}>
              <Image src={getLogoSrc()} style={styles.logoImage} />
              <View style={styles.logoTextWrap}>
                <Text style={styles.bedrijfsnaam}>
                  {(bedrijf.bedrijfsnaam || "AUTRONIS").toUpperCase()}
                </Text>
                <Text style={styles.tagline}>AI & Automatisering</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.documentType}>OFFERTE</Text>
              <Text style={styles.offerteNummer}>{offerte.offertenummer}</Text>
              {offerte.type && (
                <Text style={[styles.offerteNummer, { color: TEAL, marginTop: 2 }]}>
                  {getTypeLabel(offerte.type)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Accent line */}
        <View style={styles.accentLine} />

        {/* ===== BODY ===== */}
        <View style={styles.body}>
          {/* Info row */}
          <View style={styles.infoRow}>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Van</Text>
              <Text style={styles.infoValue}>
                <Text style={{ fontWeight: 700 }}>{bedrijf.bedrijfsnaam || "Autronis"}</Text>
                {bedrijf.email ? `\n${bedrijf.email}` : ""}
                {bedrijf.website ? `\n${bedrijf.website}` : ""}
                {bedrijf.adres ? `\n${bedrijf.adres}` : ""}
              </Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Offerte aan</Text>
              <Text style={styles.infoValue}>
                <Text style={{ fontWeight: 700 }}>{offerte.klantNaam}</Text>
                {offerte.klantContactpersoon ? `\nt.a.v. ${offerte.klantContactpersoon}` : ""}
                {offerte.klantAdres ? `\n${offerte.klantAdres}` : ""}
                {offerte.klantEmail ? `\n${offerte.klantEmail}` : ""}
              </Text>
            </View>
          </View>

          {/* Meta bar */}
          <View style={styles.metaBar}>
            <View style={styles.metaItem}>
              <Text style={styles.metaItemLabel}>Offertenummer</Text>
              <Text style={styles.metaItemValue}>{offerte.offertenummer}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaItemLabel}>Datum</Text>
              <Text style={styles.metaItemValue}>
                {offerte.datum ? formatDatumPDF(offerte.datum) : "\u2014"}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaItemLabel}>Geldig tot</Text>
              <Text style={styles.metaItemValue}>
                {offerte.geldigTot ? formatDatumPDF(offerte.geldigTot) : "\u2014"}
              </Text>
            </View>
            {offerte.type && (
              <View style={styles.metaItem}>
                <Text style={styles.metaItemLabel}>Type</Text>
                <Text style={[styles.metaItemValue, { color: TEAL }]}>
                  {getTypeLabel(offerte.type)}
                </Text>
              </View>
            )}
          </View>

          {/* Introductie */}
          <View style={styles.introSection}>
            <Text style={styles.introText}>
              Beste {contactNaam},{"\n\n"}
              Hierbij ontvangt u onze offerte{offerte.titel ? ` voor ${offerte.titel}` : ""}. Wij hebben dit voorstel samengesteld op basis van uw wensen en behoeften. Hieronder vindt u een overzicht van de werkzaamheden en bijbehorende kosten.
            </Text>
          </View>

          {/* ===== TABLE ===== */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerText, styles.colOmschrijving]}>Omschrijving</Text>
              <Text style={[styles.headerText, styles.colAantal]}>Aantal</Text>
              <Text style={[styles.headerText, styles.colPrijs]}>Prijs</Text>
              <Text style={[styles.headerText, styles.colBtw]}>BTW</Text>
              <Text style={[styles.headerText, styles.colTotaal]}>Totaal</Text>
            </View>
            {regels.map((regel, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <View style={styles.colOmschrijving}>
                  <Text style={styles.regelText}>{regel.omschrijving}</Text>
                  {regel.isOptioneel === 1 && (
                    <Text style={styles.regelOptional}>Optioneel</Text>
                  )}
                </View>
                <Text style={[styles.regelText, styles.colAantal]}>{regel.aantal || 1}</Text>
                <Text style={[styles.regelText, styles.colPrijs]}>{formatBedragPDF(regel.eenheidsprijs || 0)}</Text>
                <Text style={[styles.regelText, styles.colBtw]}>{regel.btwPercentage ?? 21}%</Text>
                <Text style={[styles.regelText, styles.colTotaal]}>{formatBedragPDF(regel.totaal || 0)}</Text>
              </View>
            ))}
          </View>

          {/* ===== TOTALS ===== */}
          <View style={styles.totalen}>
            <View style={styles.totalenBox}>
              <View style={styles.totalenRij}>
                <Text style={styles.totalenLabel}>Subtotaal</Text>
                <Text style={styles.totalenWaarde}>{formatBedragPDF(subtotaal)}</Text>
              </View>
              {korting > 0 && (
                <View style={styles.totalenRij}>
                  <Text style={[styles.totalenLabel, { color: "#DC2626" }]}>Korting</Text>
                  <Text style={[styles.totalenWaarde, { color: "#DC2626" }]}>
                    - {formatBedragPDF(korting)}
                  </Text>
                </View>
              )}
              <View style={styles.totalenRij}>
                <Text style={styles.totalenLabel}>BTW ({offerte.btwPercentage || 21}%)</Text>
                <Text style={styles.totalenWaarde}>{formatBedragPDF(btwBedrag)}</Text>
              </View>
              <View style={[styles.totalenRij, styles.totalenDivider]}>
                <Text style={[styles.totalenLabel, styles.totalenGroot]}>Totaal</Text>
                <Text style={[styles.totalenWaarde, styles.totalenGroot]}>
                  {formatBedragPDF(totaal)}
                </Text>
              </View>
            </View>
          </View>

          {/* Notities */}
          {offerte.notities && (
            <View style={styles.notities}>
              <Text style={styles.notitiesLabel}>Opmerkingen</Text>
              <Text style={{ fontSize: 9, lineHeight: 1.7, color: "#374151" }}>
                {offerte.notities}
              </Text>
            </View>
          )}

          {/* Betalingsvoorwaarden */}
          <View style={styles.voorwaarden}>
            <Text style={styles.voorwaardenTitel}>Betalingsvoorwaarden</Text>
            <Text style={styles.voorwaardenText}>
              {"\u2022"} Betaling binnen 14 dagen na factuurdatum{"\n"}
              {"\u2022"} 50% aanbetaling bij akkoord, 50% bij oplevering{"\n"}
              {"\u2022"} Facturatie geschiedt per fase of op basis van bestede uren{"\n"}
              {"\u2022"} Op al onze diensten zijn de algemene voorwaarden van {bedrijf.bedrijfsnaam || "Autronis"} van toepassing
            </Text>
          </View>

          {/* Geldigheid */}
          {offerte.geldigTot && (
            <View style={styles.geldigheid}>
              <Text style={styles.geldigheidText}>
                Deze offerte is geldig tot {formatDatumPDF(offerte.geldigTot)}.
                Na deze datum vervalt het aanbod automatisch.
              </Text>
            </View>
          )}
        </View>

        {/* ===== DARK FOOTER ===== */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <View style={styles.footerCol}>
              <Text style={styles.footerLabel}>Contact</Text>
              <Text style={styles.footerText}>
                {bedrijf.bedrijfsnaam || "Autronis"}
                {bedrijf.adres ? `\n${bedrijf.adres}` : ""}
              </Text>
            </View>
            <View style={styles.footerCol}>
              <Text style={styles.footerLabel}>Bereikbaar</Text>
              <Text style={styles.footerText}>
                {bedrijf.email || ""}
                {bedrijf.telefoon ? `\n${bedrijf.telefoon}` : ""}
                {bedrijf.website ? `\n${bedrijf.website}` : ""}
              </Text>
            </View>
            <View style={styles.footerCol}>
              <Text style={styles.footerLabel}>Gegevens</Text>
              <Text style={styles.footerText}>
                {bedrijf.kvkNummer ? `KvK: ${bedrijf.kvkNummer}` : ""}
                {bedrijf.btwNummer ? `\nBTW: ${bedrijf.btwNummer}` : ""}
                {bedrijf.iban ? `\nIBAN: ${bedrijf.iban}` : ""}
              </Text>
            </View>
          </View>
          <Text style={styles.footerCenter}>
            {[bedrijf.bedrijfsnaam, bedrijf.website, bedrijf.email].filter(Boolean).join(" | ")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
