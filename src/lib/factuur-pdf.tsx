import React from "react";
import path from "path";
import fs from "fs";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";

let _logoSrc: string | null = null;
function getLogoSrc(): string {
  if (!_logoSrc) {
    try {
      const buf = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
      _logoSrc = `data:image/png;base64,${buf.toString("base64")}`;
    } catch { _logoSrc = ""; }
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
  headerBand: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 50,
    paddingTop: 40,
    paddingBottom: 25,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bedrijfsnaam: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 7,
    color: "#9CA3AF",
    letterSpacing: 0.8,
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  documentType: {
    fontSize: 22,
    fontWeight: 700,
    color: TEAL,
    letterSpacing: 2,
  },
  factuurNummer: {
    fontSize: 9,
    color: "#9CA3AF",
    marginTop: 4,
  },
  accentLine: {
    height: 3,
    backgroundColor: TEAL,
  },
  body: {
    paddingHorizontal: 50,
    paddingTop: 30,
    paddingBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
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
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    padding: 10,
    borderRadius: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 10,
    paddingHorizontal: 10,
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
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  regelText: {
    fontSize: 9.5,
    color: "#374151",
  },
  totalen: {
    alignItems: "flex-end",
    marginTop: 10,
    marginBottom: 25,
  },
  totalenRij: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 260,
    paddingVertical: 5,
  },
  totalenLabel: {
    width: 140,
    textAlign: "right",
    paddingRight: 20,
    color: "#6B7280",
    fontSize: 10,
  },
  totalenWaarde: {
    width: 120,
    textAlign: "right",
    fontSize: 10,
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
    marginTop: 4,
  },
  notities: {
    marginTop: 15,
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
  betaling: {
    marginTop: 20,
    padding: 14,
    backgroundColor: "#F0FDFA",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CCFBF1",
  },
  betalingText: {
    fontSize: 9,
    color: "#0F766E",
    lineHeight: 1.7,
  },
  footer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 50,
    paddingVertical: 20,
    marginTop: "auto",
  },
  footerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
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
    color: "#6B7280",
    lineHeight: 1.6,
  },
});

interface Regel {
  omschrijving: string;
  aantal: number | null;
  eenheidsprijs: number | null;
  btwPercentage: number | null;
  totaal: number | null;
}

interface FactuurPDFProps {
  factuur: {
    factuurnummer: string;
    factuurdatum: string | null;
    vervaldatum: string | null;
    bedragExclBtw: number;
    btwPercentage: number | null;
    btwBedrag: number | null;
    bedragInclBtw: number | null;
    notities: string | null;
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

export function FactuurPDF({ factuur, regels, bedrijf }: FactuurPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ===== DARK HEADER ===== */}
        <View style={styles.headerBand}>
          <View style={styles.headerContent}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Image src={getLogoSrc()} style={{ width: 50, height: 25 }} />
              <View>
                <Text style={styles.bedrijfsnaam}>
                  {(bedrijf.bedrijfsnaam || "AUTRONIS").toUpperCase()}
                </Text>
                <Text style={styles.tagline}>AI & Automatisering</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.documentType}>FACTUUR</Text>
              <Text style={styles.factuurNummer}>{factuur.factuurnummer}</Text>
            </View>
          </View>
        </View>

        <View style={styles.accentLine} />

        {/* ===== BODY ===== */}
        <View style={styles.body}>
          <View style={styles.infoRow}>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Factuur aan</Text>
              <Text style={styles.infoValue}>
                {factuur.klantNaam}
                {factuur.klantContactpersoon ? `\nt.a.v. ${factuur.klantContactpersoon}` : ""}
                {factuur.klantAdres ? `\n${factuur.klantAdres}` : ""}
                {factuur.klantEmail ? `\n${factuur.klantEmail}` : ""}
              </Text>
            </View>
            <View style={[styles.infoBlock, { alignItems: "flex-end" }]}>
              <Text style={styles.infoLabel}>Factuurdatum</Text>
              <Text style={styles.infoValue}>
                {factuur.factuurdatum ? formatDatumPDF(factuur.factuurdatum) : "\u2014"}
              </Text>
              <Text style={[styles.infoLabel, { marginTop: 12 }]}>Vervaldatum</Text>
              <Text style={styles.infoValue}>
                {factuur.vervaldatum ? formatDatumPDF(factuur.vervaldatum) : "\u2014"}
              </Text>
            </View>
          </View>

          {/* Table */}
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
                <Text style={[styles.regelText, styles.colOmschrijving]}>{regel.omschrijving}</Text>
                <Text style={[styles.regelText, styles.colAantal]}>{regel.aantal || 1}</Text>
                <Text style={[styles.regelText, styles.colPrijs]}>{formatBedragPDF(regel.eenheidsprijs || 0)}</Text>
                <Text style={[styles.regelText, styles.colBtw]}>{regel.btwPercentage ?? 21}%</Text>
                <Text style={[styles.regelText, styles.colTotaal]}>{formatBedragPDF(regel.totaal || 0)}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalen}>
            <View style={styles.totalenRij}>
              <Text style={styles.totalenLabel}>Subtotaal</Text>
              <Text style={styles.totalenWaarde}>{formatBedragPDF(factuur.bedragExclBtw)}</Text>
            </View>
            <View style={styles.totalenRij}>
              <Text style={styles.totalenLabel}>BTW ({factuur.btwPercentage || 21}%)</Text>
              <Text style={styles.totalenWaarde}>{formatBedragPDF(factuur.btwBedrag || 0)}</Text>
            </View>
            <View style={[styles.totalenRij, styles.totalenDivider]}>
              <Text style={[styles.totalenLabel, styles.totalenGroot]}>Totaal</Text>
              <Text style={[styles.totalenWaarde, styles.totalenGroot]}>
                {formatBedragPDF(factuur.bedragInclBtw || 0)}
              </Text>
            </View>
          </View>

          {/* Notities */}
          {factuur.notities && (
            <View style={styles.notities}>
              <Text style={styles.notitiesLabel}>Opmerkingen</Text>
              <Text style={{ fontSize: 9, lineHeight: 1.7, color: "#374151" }}>
                {factuur.notities}
              </Text>
            </View>
          )}

          {/* Betaalinstructies */}
          <View style={styles.betaling}>
            <Text style={styles.betalingText}>
              {bedrijf.iban
                ? `Gelieve te betalen op IBAN ${bedrijf.iban} t.n.v. ${bedrijf.bedrijfsnaam || "Autronis"}`
                : ""}
              {factuur.vervaldatum
                ? `\nBetalingstermijn: voor ${formatDatumPDF(factuur.vervaldatum)}`
                : ""}
              {`\nO.v.v. ${factuur.factuurnummer}`}
            </Text>
          </View>
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
                {bedrijf.email || "zakelijk@autronis.com"}
                {bedrijf.telefoon ? `\n${bedrijf.telefoon}` : ""}
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
        </View>
      </Page>
    </Document>
  );
}
