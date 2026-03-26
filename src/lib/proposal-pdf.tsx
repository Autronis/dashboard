import React from "react";
import path from "path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(FONT_DIR, "Inter-400.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Inter-600.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "Inter-700.ttf"), fontWeight: 700 },
  ],
});

const TEAL = "#128C7E";
const TEAL_LIGHT = "#E6F7F5";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    color: "#1F2529",
  },
  coverPage: {
    fontFamily: "Inter",
    padding: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  coverBrand: {
    fontSize: 36,
    fontWeight: 700,
    color: TEAL,
    marginBottom: 40,
  },
  coverTitel: {
    fontSize: 24,
    fontWeight: 600,
    color: "#1F2529",
    textAlign: "center",
    marginBottom: 16,
  },
  coverKlant: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 40,
  },
  coverDatum: {
    fontSize: 12,
    color: "#94A3B8",
  },
  contentPage: {
    fontFamily: "Inter",
    fontSize: 10,
    padding: 50,
    color: "#1F2529",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: TEAL,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: TEAL_LIGHT,
  },
  sectionContent: {
    fontSize: 10,
    lineHeight: 1.8,
    color: "#374151",
    marginBottom: 24,
  },
  table: {
    marginTop: 10,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: TEAL_LIGHT,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    padding: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    padding: 8,
  },
  colOmschrijving: { width: "50%" },
  colAantal: { width: "15%", textAlign: "center" },
  colPrijs: { width: "17%", textAlign: "right" },
  colTotaal: { width: "18%", textAlign: "right" },
  headerText: {
    fontSize: 8,
    fontWeight: 600,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totalenContainer: {
    alignItems: "flex-end",
    marginTop: 16,
  },
  totalenRij: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 220,
    paddingVertical: 6,
    borderTopWidth: 2,
    borderTopColor: TEAL_LIGHT,
  },
  totalenLabel: {
    width: 100,
    textAlign: "right",
    paddingRight: 15,
    fontSize: 12,
    fontWeight: 600,
    color: "#64748B",
  },
  totalenWaarde: {
    width: 120,
    textAlign: "right",
    fontSize: 14,
    fontWeight: 700,
    color: TEAL,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: "#94A3B8",
    textAlign: "center",
  },
});

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

interface Sectie {
  id: string;
  titel: string;
  inhoud: string;
  actief: boolean;
}

interface Regel {
  omschrijving: string;
  aantal: number | null;
  eenheidsprijs: number | null;
  totaal: number | null;
}

interface ProposalPDFProps {
  proposal: {
    titel: string;
    klantNaam: string;
    klantContactpersoon: string | null;
    klantAdres: string | null;
    datum: string | null;
    geldigTot: string | null;
    totaalBedrag: number;
  };
  secties: Sectie[];
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

export function ProposalPDF({ proposal, secties, regels, bedrijf }: ProposalPDFProps) {
  return (
    <Document>
      {/* Cover page */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverBrand}>{bedrijf.bedrijfsnaam || "Autronis"}</Text>
        <Text style={styles.coverTitel}>{proposal.titel}</Text>
        <Text style={styles.coverKlant}>
          Voor {proposal.klantContactpersoon || proposal.klantNaam}
          {"\n"}
          {proposal.klantNaam}
        </Text>
        <Text style={styles.coverDatum}>
          {proposal.datum ? formatDatumPDF(proposal.datum) : ""}
        </Text>
      </Page>

      {/* Content sections */}
      {secties.map((sectie) => (
        <Page key={sectie.id} size="A4" style={styles.contentPage}>
          <Text style={styles.sectionTitle}>{sectie.titel}</Text>
          <Text style={styles.sectionContent}>{sectie.inhoud}</Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {bedrijf.bedrijfsnaam || "Autronis"} — {proposal.titel}
            </Text>
          </View>
        </Page>
      ))}

      {/* Pricing page */}
      {regels.length > 0 && (
        <Page size="A4" style={styles.contentPage}>
          <Text style={styles.sectionTitle}>Investering</Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerText, styles.colOmschrijving]}>Omschrijving</Text>
              <Text style={[styles.headerText, styles.colAantal]}>Aantal</Text>
              <Text style={[styles.headerText, styles.colPrijs]}>Prijs</Text>
              <Text style={[styles.headerText, styles.colTotaal]}>Totaal</Text>
            </View>
            {regels.map((regel, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colOmschrijving}>{regel.omschrijving}</Text>
                <Text style={styles.colAantal}>{regel.aantal || 1}</Text>
                <Text style={styles.colPrijs}>{formatBedragPDF(regel.eenheidsprijs || 0)}</Text>
                <Text style={styles.colTotaal}>{formatBedragPDF(regel.totaal || 0)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totalenContainer}>
            <View style={styles.totalenRij}>
              <Text style={styles.totalenLabel}>Totaal</Text>
              <Text style={styles.totalenWaarde}>
                {formatBedragPDF(proposal.totaalBedrag)}
              </Text>
            </View>
          </View>

          {proposal.geldigTot && (
            <Text style={[styles.sectionContent, { marginTop: 24, fontStyle: "italic" }]}>
              Dit voorstel is geldig tot {formatDatumPDF(proposal.geldigTot)}.
            </Text>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {bedrijf.bedrijfsnaam || "Autronis"} — {proposal.titel}
              {proposal.geldigTot
                ? ` — Geldig tot ${formatDatumPDF(proposal.geldigTot)}`
                : ""}
            </Text>
          </View>
        </Page>
      )}
    </Document>
  );
}
