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
    paddingBottom: 60,
  },
  // ===== HEADER =====
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
    fontSize: 18,
    fontWeight: 700,
    color: TEXT_PRIMARY,
    letterSpacing: 1.5,
  },
  documentSubtype: {
    fontSize: 8,
    color: TEXT_SECONDARY,
    marginTop: 3,
  },
  accentLine: {
    height: 3,
    backgroundColor: TEAL,
  },
  // ===== BODY =====
  body: {
    paddingHorizontal: 50,
    paddingTop: 25,
  },
  // ===== TITEL =====
  titel: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 6,
  },
  datumText: {
    fontSize: 9,
    color: "#6B7280",
    marginBottom: 20,
  },
  // ===== CONTENT SECTIONS =====
  articleHeading: {
    fontSize: 12,
    fontWeight: 700,
    color: DARK_BG,
    marginTop: 18,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: TEAL,
  },
  subHeading: {
    fontSize: 10,
    fontWeight: 600,
    color: "#374151",
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 9.5,
    lineHeight: 1.7,
    color: "#374151",
    marginBottom: 6,
  },
  listItem: {
    fontSize: 9.5,
    lineHeight: 1.7,
    color: "#374151",
    marginBottom: 3,
    paddingLeft: 12,
  },
  // ===== HANDTEKENING BLOK =====
  signatureSection: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: "#E5E7EB",
  },
  signatureTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 16,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureCol: {
    width: "45%",
  },
  signatureLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: TEAL,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#D1D5DB",
    marginBottom: 6,
    paddingBottom: 30,
  },
  signatureSubLabel: {
    fontSize: 8,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  // ===== FOOTER =====
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: DARK_BG,
    paddingHorizontal: 50,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: TEXT_SECONDARY,
  },
  footerCenter: {
    fontSize: 7,
    color: TEXT_SECONDARY,
  },
});

interface ContractPDFProps {
  contract: {
    titel: string;
    type: string;
    inhoud: string;
    klantNaam: string;
    klantContactpersoon: string | null;
    aangemaaktOp: string | null;
  };
  bedrijf: {
    bedrijfsnaam: string | null;
    adres: string | null;
    kvkNummer: string | null;
    email: string | null;
  };
}

function formatDatumPDF(datum: string): string {
  return new Date(datum).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "samenwerkingsovereenkomst": return "SAMENWERKINGSOVEREENKOMST";
    case "sla": return "SERVICE LEVEL AGREEMENT";
    case "nda": return "GEHEIMHOUDINGSOVEREENKOMST";
    default: return "CONTRACT";
  }
}

function parseMarkdownToElements(markdown: string): React.ReactElement[] {
  const lines = markdown.split("\n");
  const elements: React.ReactElement[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      elements.push(
        <Text key={i} style={styles.articleHeading}>
          {trimmed.replace("## ", "")}
        </Text>
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <Text key={i} style={styles.subHeading}>
          {trimmed.replace("### ", "")}
        </Text>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <Text key={i} style={styles.listItem}>
          {"\u2022"} {trimmed.replace(/^[-*]\s/, "").replace(/\*\*(.*?)\*\*/g, "$1")}
        </Text>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        <Text key={i} style={styles.listItem}>
          {trimmed.replace(/\*\*(.*?)\*\*/g, "$1")}
        </Text>
      );
    } else {
      elements.push(
        <Text key={i} style={styles.paragraph}>
          {trimmed.replace(/\*\*(.*?)\*\*/g, "$1")}
        </Text>
      );
    }
  }

  return elements;
}

export function ContractPDF({ contract, bedrijf }: ContractPDFProps) {
  const contentElements = parseMarkdownToElements(contract.inhoud);
  const bedrijfsnaam = bedrijf.bedrijfsnaam || "Autronis";

  // Split content into pages (rough estimate: ~45 lines per page)
  const ELEMENTS_PER_PAGE = 40;
  const pages: React.ReactElement[][] = [];

  for (let i = 0; i < contentElements.length; i += ELEMENTS_PER_PAGE) {
    pages.push(contentElements.slice(i, i + ELEMENTS_PER_PAGE));
  }

  // If empty, at least one page
  if (pages.length === 0) pages.push([]);

  const totalPages = pages.length + 1; // +1 for signature page

  return (
    <Document>
      {pages.map((pageContent, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {/* Header on first page only */}
          {pageIndex === 0 && (
            <>
              <View style={styles.headerBand}>
                <View style={styles.headerContent}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Image src={getLogoSrc()} style={{ width: 36, height: 36 }} />
                    <View>
                      <Text style={styles.bedrijfsnaam}>{bedrijfsnaam.toUpperCase()}</Text>
                      <Text style={styles.tagline}>AI & Automatisering</Text>
                    </View>
                  </View>
                  <View style={styles.headerRight}>
                    <Text style={styles.documentType}>{getTypeLabel(contract.type)}</Text>
                    <Text style={styles.documentSubtype}>Vertrouwelijk document</Text>
                  </View>
                </View>
              </View>
              <View style={styles.accentLine} />
            </>
          )}

          <View style={styles.body}>
            {/* Title on first page */}
            {pageIndex === 0 && (
              <>
                <Text style={styles.titel}>{contract.titel}</Text>
                <Text style={styles.datumText}>
                  Datum: {contract.aangemaaktOp ? formatDatumPDF(contract.aangemaaktOp) : "\u2014"}
                </Text>
              </>
            )}

            {/* Content */}
            {pageContent.map((el) => el)}
          </View>

          {/* Footer */}
          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>{bedrijfsnaam} | {bedrijf.email || "zakelijk@autronis.com"}</Text>
            <Text style={styles.footerCenter}>Pagina {pageIndex + 1} van {totalPages}</Text>
          </View>
        </Page>
      ))}

      {/* Signature page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.body}>
          <View style={styles.signatureSection}>
            <Text style={styles.signatureTitle}>
              Aldus overeengekomen en in tweevoud ondertekend:
            </Text>
            <View style={styles.signatureRow}>
              <View style={styles.signatureCol}>
                <Text style={styles.signatureLabel}>Opdrachtnemer</Text>
                <Text style={[styles.paragraph, { marginBottom: 8 }]}>{bedrijfsnaam}</Text>
                <Text style={styles.signatureSubLabel}>Naam:</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureSubLabel}>Functie:</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureSubLabel}>Datum:</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureSubLabel}>Handtekening:</Text>
                <View style={[styles.signatureLine, { paddingBottom: 50 }]} />
              </View>
              <View style={styles.signatureCol}>
                <Text style={styles.signatureLabel}>Opdrachtgever</Text>
                <Text style={[styles.paragraph, { marginBottom: 8 }]}>{contract.klantNaam}</Text>
                <Text style={styles.signatureSubLabel}>Naam:</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureSubLabel}>Functie:</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureSubLabel}>Datum:</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureSubLabel}>Handtekening:</Text>
                <View style={[styles.signatureLine, { paddingBottom: 50 }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{bedrijfsnaam} | {bedrijf.email || "zakelijk@autronis.com"}</Text>
          <Text style={styles.footerCenter}>Pagina {totalPages} van {totalPages}</Text>
        </View>
      </Page>
    </Document>
  );
}
