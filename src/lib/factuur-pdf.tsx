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

const translations = {
  nl: {
    documentType: "FACTUUR",
    invoiceTo: "Factuur aan",
    attn: "t.a.v.",
    invoiceDate: "Factuurdatum",
    dueDate: "Vervaldatum",
    description: "Omschrijving",
    quantity: "Aantal",
    price: "Prijs",
    vat: "BTW",
    total: "Totaal",
    subtotal: "Subtotaal",
    notes: "Opmerkingen",
    payTo: (iban: string, name: string) => `Gelieve te betalen op IBAN ${iban} t.n.v. ${name}`,
    paymentTerm: (date: string) => `Betalingstermijn: voor ${date}`,
    reference: (nr: string) => `O.v.v. ${nr}`,
    contact: "Contact",
    reachable: "Bereikbaar",
    details: "Gegevens",
    tagline: "AI & Automatisering",
  },
  en: {
    documentType: "INVOICE",
    invoiceTo: "Invoice to",
    attn: "Attn.",
    invoiceDate: "Invoice date",
    dueDate: "Due date",
    description: "Description",
    quantity: "Qty",
    price: "Price",
    vat: "VAT",
    total: "Total",
    subtotal: "Subtotal",
    notes: "Notes",
    payTo: (iban: string, name: string) => `Please transfer to IBAN ${iban} in the name of ${name}`,
    paymentTerm: (date: string) => `Payment due: before ${date}`,
    reference: (nr: string) => `Reference: ${nr}`,
    contact: "Contact",
    reachable: "Reach us",
    details: "Details",
    tagline: "AI & Automation",
  },
} as const;

type Taal = "nl" | "en";

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
  taal?: Taal;
}

function formatBedragPDF(bedrag: number, taal: Taal): string {
  return new Intl.NumberFormat(taal === "en" ? "en-GB" : "nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(bedrag);
}

function formatDatumPDF(datum: string, taal: Taal): string {
  return new Date(datum).toLocaleDateString(taal === "en" ? "en-GB" : "nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function FactuurPDF({ factuur, regels, bedrijf, taal = "nl" }: FactuurPDFProps) {
  const t = translations[taal];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ===== HEADER ===== */}
        <View style={styles.headerBand}>
          <View style={styles.headerContent}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Image src={getLogoSrc()} style={{ width: 50, height: 25 }} />
              <View>
                <Text style={styles.bedrijfsnaam}>
                  {(bedrijf.bedrijfsnaam || "AUTRONIS").toUpperCase()}
                </Text>
                <Text style={styles.tagline}>{t.tagline}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.documentType}>{t.documentType}</Text>
              <Text style={styles.factuurNummer}>{factuur.factuurnummer}</Text>
            </View>
          </View>
        </View>

        <View style={styles.accentLine} />

        {/* ===== BODY ===== */}
        <View style={styles.body}>
          <View style={styles.infoRow}>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>{t.invoiceTo}</Text>
              <Text style={styles.infoValue}>
                {factuur.klantNaam}
                {factuur.klantContactpersoon ? `\n${t.attn} ${factuur.klantContactpersoon}` : ""}
                {factuur.klantAdres ? `\n${factuur.klantAdres}` : ""}
                {factuur.klantEmail ? `\n${factuur.klantEmail}` : ""}
              </Text>
            </View>
            <View style={[styles.infoBlock, { alignItems: "flex-end" }]}>
              <Text style={styles.infoLabel}>{t.invoiceDate}</Text>
              <Text style={styles.infoValue}>
                {factuur.factuurdatum ? formatDatumPDF(factuur.factuurdatum, taal) : "\u2014"}
              </Text>
              <Text style={[styles.infoLabel, { marginTop: 12 }]}>{t.dueDate}</Text>
              <Text style={styles.infoValue}>
                {factuur.vervaldatum ? formatDatumPDF(factuur.vervaldatum, taal) : "\u2014"}
              </Text>
            </View>
          </View>

          {/* Table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerText, styles.colOmschrijving]}>{t.description}</Text>
              <Text style={[styles.headerText, styles.colAantal]}>{t.quantity}</Text>
              <Text style={[styles.headerText, styles.colPrijs]}>{t.price}</Text>
              <Text style={[styles.headerText, styles.colBtw]}>{t.vat}</Text>
              <Text style={[styles.headerText, styles.colTotaal]}>{t.total}</Text>
            </View>
            {regels.map((regel, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.regelText, styles.colOmschrijving]}>{regel.omschrijving}</Text>
                <Text style={[styles.regelText, styles.colAantal]}>{regel.aantal || 1}</Text>
                <Text style={[styles.regelText, styles.colPrijs]}>{formatBedragPDF(regel.eenheidsprijs || 0, taal)}</Text>
                <Text style={[styles.regelText, styles.colBtw]}>{regel.btwPercentage ?? 21}%</Text>
                <Text style={[styles.regelText, styles.colTotaal]}>{formatBedragPDF(regel.totaal || 0, taal)}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalen}>
            <View style={styles.totalenRij}>
              <Text style={styles.totalenLabel}>{t.subtotal}</Text>
              <Text style={styles.totalenWaarde}>{formatBedragPDF(factuur.bedragExclBtw, taal)}</Text>
            </View>
            <View style={styles.totalenRij}>
              <Text style={styles.totalenLabel}>{t.vat} ({factuur.btwPercentage || 21}%)</Text>
              <Text style={styles.totalenWaarde}>{formatBedragPDF(factuur.btwBedrag || 0, taal)}</Text>
            </View>
            <View style={[styles.totalenRij, styles.totalenDivider]}>
              <Text style={[styles.totalenLabel, styles.totalenGroot]}>{t.total}</Text>
              <Text style={[styles.totalenWaarde, styles.totalenGroot]}>
                {formatBedragPDF(factuur.bedragInclBtw || 0, taal)}
              </Text>
            </View>
          </View>

          {/* Notes */}
          {factuur.notities && (
            <View style={styles.notities}>
              <Text style={styles.notitiesLabel}>{t.notes}</Text>
              <Text style={{ fontSize: 9, lineHeight: 1.7, color: "#374151" }}>
                {factuur.notities}
              </Text>
            </View>
          )}

          {/* Payment instructions */}
          <View style={styles.betaling}>
            <Text style={styles.betalingText}>
              {bedrijf.iban
                ? t.payTo(bedrijf.iban, bedrijf.bedrijfsnaam || "Autronis")
                : ""}
              {factuur.vervaldatum
                ? `\n${t.paymentTerm(formatDatumPDF(factuur.vervaldatum, taal))}`
                : ""}
              {`\n${t.reference(factuur.factuurnummer)}`}
            </Text>
          </View>
        </View>

        {/* ===== FOOTER ===== */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <View style={styles.footerCol}>
              <Text style={styles.footerLabel}>{t.contact}</Text>
              <Text style={styles.footerText}>
                {bedrijf.bedrijfsnaam || "Autronis"}
                {bedrijf.adres ? `\n${bedrijf.adres}` : ""}
              </Text>
            </View>
            <View style={styles.footerCol}>
              <Text style={styles.footerLabel}>{t.reachable}</Text>
              <Text style={styles.footerText}>
                {bedrijf.email || "zakelijk@autronis.com"}
                {bedrijf.telefoon ? `\n${bedrijf.telefoon}` : ""}
              </Text>
            </View>
            <View style={styles.footerCol}>
              <Text style={styles.footerLabel}>{t.details}</Text>
              <Text style={styles.footerText}>
                {bedrijf.kvkNummer ? `KvK: ${bedrijf.kvkNummer}` : ""}
                {bedrijf.btwNummer ? `\nVAT: ${bedrijf.btwNummer}` : ""}
                {bedrijf.iban ? `\nIBAN: ${bedrijf.iban}` : ""}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
