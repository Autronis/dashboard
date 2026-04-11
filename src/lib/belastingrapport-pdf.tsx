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

const MAAND_NAMEN = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

const DOEL_LABELS: Record<string, string> = {
  klantbezoek: "Klantbezoek",
  meeting: "Meeting",
  inkoop: "Inkoop / Leverancier",
  netwerk: "Netwerk event",
  training: "Cursus / Training",
  boekhouder: "Boekhouder / KVK / Bank",
  overig: "Overig zakelijk",
};

function formatBedrag(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(bedrag);
}

function formatDatum(datum: string): string {
  return new Date(datum).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9, color: "#1F2937", backgroundColor: "#FFFFFF", paddingBottom: 60 },
  // Cover page
  coverPage: { fontFamily: "Inter", fontSize: 9, color: "#FFFFFF", backgroundColor: "#0E1719" },
  coverContent: { flex: 1, justifyContent: "center", alignItems: "center", padding: 60 },
  coverLogo: { width: 48, height: 48, marginBottom: 20 },
  coverTitle: { fontSize: 28, fontWeight: 700, color: TEAL, letterSpacing: 2, marginBottom: 8 },
  coverSubtitle: { fontSize: 14, color: "#9CA3AF", marginBottom: 40 },
  coverMeta: { flexDirection: "row", gap: 40, marginTop: 20 },
  coverMetaItem: { alignItems: "center" },
  coverMetaLabel: { fontSize: 8, color: "#6B7280", letterSpacing: 1, marginBottom: 4 },
  coverMetaValue: { fontSize: 18, fontWeight: 700, color: "#FFFFFF" },
  coverMetaUnit: { fontSize: 9, color: "#9CA3AF", marginTop: 2 },
  // Header
  header: { paddingHorizontal: 40, paddingTop: 30, paddingBottom: 15 },
  headerTitle: { fontSize: 14, fontWeight: 700, color: "#111827" },
  headerSub: { fontSize: 8, color: "#9CA3AF", marginTop: 2 },
  accentLine: { height: 2, backgroundColor: TEAL, marginHorizontal: 40 },
  // Body
  body: { paddingHorizontal: 40, paddingTop: 15 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: "#111827", marginBottom: 8, marginTop: 12 },
  // KM-stand row
  kmStandRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F3F4F6", padding: 8, borderRadius: 4, marginBottom: 8 },
  kmStandLabel: { fontSize: 8, color: "#6B7280" },
  kmStandValue: { fontSize: 10, fontWeight: 600, color: "#111827" },
  // Table
  tableHeader: { flexDirection: "row", backgroundColor: "#F9FAFB", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingVertical: 5, paddingHorizontal: 6 },
  tableHeaderCell: { fontSize: 7, fontWeight: 600, color: "#6B7280", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6", paddingVertical: 4, paddingHorizontal: 6 },
  tableCell: { fontSize: 8, color: "#374151" },
  tableCellBold: { fontSize: 8, fontWeight: 600, color: "#111827" },
  // Subtotal
  subtotalRow: { flexDirection: "row", backgroundColor: TEAL + "10", paddingVertical: 5, paddingHorizontal: 6, marginTop: 2 },
  subtotalLabel: { fontSize: 8, fontWeight: 600, color: TEAL },
  subtotalValue: { fontSize: 8, fontWeight: 600, color: "#111827" },
  // Summary page
  summaryCard: { backgroundColor: "#F9FAFB", borderRadius: 6, padding: 15, marginBottom: 12 },
  summaryTitle: { fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  summaryLabel: { fontSize: 9, color: "#6B7280" },
  summaryValue: { fontSize: 9, fontWeight: 600, color: "#111827" },
  summaryHighlight: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, backgroundColor: TEAL + "15", paddingHorizontal: 10, borderRadius: 4, marginTop: 6 },
  summaryHighlightLabel: { fontSize: 10, fontWeight: 600, color: TEAL },
  summaryHighlightValue: { fontSize: 10, fontWeight: 700, color: "#111827" },
  // Footer
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#9CA3AF" },
});

// Column widths
const COL = { datum: "12%", van: "18%", naar: "18%", km: "10%", doel: "15%", klant: "15%", bedrag: "12%" };

interface RitRow {
  datum: string;
  vanLocatie: string;
  naarLocatie: string;
  kilometers: number;
  doelType: string | null;
  klantNaam: string | null;
  tariefPerKm: number | null;
}

interface KmStandRow {
  maand: number;
  beginStand: number;
  eindStand: number;
}

interface CategorieRow {
  doelType: string;
  ritten: number;
  km: number;
  bedrag: number;
}

interface BrandstofMaandRow {
  maand: number;
  bedrag: number;
  liters: number | null;
}

interface BelastingrapportProps {
  jaar: number;
  gebruikerNaam: string;
  rittenPerMaand: Record<number, RitRow[]>;
  kmStanden: KmStandRow[];
  zakelijkPercentage: number;
  tariefPerKm: number;
  totaalKm: number;
  totaalZakelijkKm: number;
  totaalAftrekbaar: number;
  categorieën: CategorieRow[];
  totaalBrandstof: number;
  werkelijkPercentage: number | null;
  totaalGereden: number | null;
  brandstofPerMaand: BrandstofMaandRow[];
}

export function BelastingrapportPDF({
  jaar,
  gebruikerNaam,
  rittenPerMaand,
  kmStanden,
  zakelijkPercentage,
  tariefPerKm,
  totaalKm,
  totaalZakelijkKm,
  totaalAftrekbaar,
  categorieën,
  totaalBrandstof,
  werkelijkPercentage,
  totaalGereden,
  brandstofPerMaand,
}: BelastingrapportProps) {
  const logo = getLogoSrc();
  const generatieDatum = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Document>
      {/* Cover page */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverContent}>
          {logo ? <Image src={logo} style={s.coverLogo} /> : null}
          <Text style={s.coverTitle}>KILOMETERREGISTRATIE</Text>
          <Text style={s.coverSubtitle}>{jaar} — {gebruikerNaam}</Text>

          <View style={s.coverMeta}>
            <View style={s.coverMetaItem}>
              <Text style={s.coverMetaLabel}>TOTAAL KM</Text>
              <Text style={s.coverMetaValue}>{Math.round(totaalKm).toLocaleString("nl-NL")}</Text>
            </View>
            <View style={s.coverMetaItem}>
              <Text style={s.coverMetaLabel}>ZAKELIJK</Text>
              <Text style={s.coverMetaValue}>{zakelijkPercentage}%</Text>
            </View>
            <View style={s.coverMetaItem}>
              <Text style={s.coverMetaLabel}>AFTREKBAAR</Text>
              <Text style={s.coverMetaValue}>{formatBedrag(totaalAftrekbaar)}</Text>
            </View>
          </View>

          <View style={{ marginTop: 40 }}>
            <Text style={s.coverMetaLabel}>Gegenereerd op {generatieDatum}</Text>
          </View>
        </View>
      </Page>

      {/* Monthly pages */}
      {Object.entries(rittenPerMaand)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([maandStr, ritten]) => {
          const maand = Number(maandStr);
          const kmStand = kmStanden.find((k) => k.maand === maand);
          const maandKm = ritten.reduce((sum, r) => sum + r.kilometers, 0);
          const maandBedrag = ritten.reduce((sum, r) => sum + r.kilometers * (r.tariefPerKm ?? tariefPerKm), 0);

          return (
            <Page key={maand} size="A4" style={s.page}>
              <View style={s.header}>
                <Text style={s.headerTitle}>{MAAND_NAMEN[maand - 1]} {jaar}</Text>
                <Text style={s.headerSub}>{ritten.length} ritten — {Math.round(maandKm)} km — {formatBedrag(maandBedrag)}</Text>
              </View>
              <View style={s.accentLine} />

              <View style={s.body}>
                {/* KM-stand if available */}
                {kmStand && (
                  <View style={s.kmStandRow}>
                    <View>
                      <Text style={s.kmStandLabel}>BEGIN</Text>
                      <Text style={s.kmStandValue}>{kmStand.beginStand.toLocaleString("nl-NL")} km</Text>
                    </View>
                    <View>
                      <Text style={s.kmStandLabel}>EIND</Text>
                      <Text style={s.kmStandValue}>{kmStand.eindStand.toLocaleString("nl-NL")} km</Text>
                    </View>
                    <View>
                      <Text style={s.kmStandLabel}>TOTAAL</Text>
                      <Text style={s.kmStandValue}>{(kmStand.eindStand - kmStand.beginStand).toLocaleString("nl-NL")} km</Text>
                    </View>
                  </View>
                )}

                {/* Trip table */}
                <View style={s.tableHeader}>
                  <Text style={[s.tableHeaderCell, { width: COL.datum }]}>DATUM</Text>
                  <Text style={[s.tableHeaderCell, { width: COL.van }]}>VAN</Text>
                  <Text style={[s.tableHeaderCell, { width: COL.naar }]}>NAAR</Text>
                  <Text style={[s.tableHeaderCell, { width: COL.km, textAlign: "right" }]}>KM</Text>
                  <Text style={[s.tableHeaderCell, { width: COL.doel }]}>DOEL</Text>
                  <Text style={[s.tableHeaderCell, { width: COL.klant }]}>KLANT</Text>
                  <Text style={[s.tableHeaderCell, { width: COL.bedrag, textAlign: "right" }]}>BEDRAG</Text>
                </View>

                {ritten.map((rit, idx) => (
                  <View key={idx} style={s.tableRow} wrap={false}>
                    <Text style={[s.tableCell, { width: COL.datum }]}>{formatDatum(rit.datum)}</Text>
                    <Text style={[s.tableCell, { width: COL.van }]}>{rit.vanLocatie}</Text>
                    <Text style={[s.tableCell, { width: COL.naar }]}>{rit.naarLocatie}</Text>
                    <Text style={[s.tableCellBold, { width: COL.km, textAlign: "right" }]}>{rit.kilometers}</Text>
                    <Text style={[s.tableCell, { width: COL.doel }]}>{rit.doelType ? DOEL_LABELS[rit.doelType] || rit.doelType : "—"}</Text>
                    <Text style={[s.tableCell, { width: COL.klant }]}>{rit.klantNaam || "—"}</Text>
                    <Text style={[s.tableCellBold, { width: COL.bedrag, textAlign: "right" }]}>{formatBedrag(rit.kilometers * (rit.tariefPerKm ?? tariefPerKm))}</Text>
                  </View>
                ))}

                {/* Month subtotal */}
                <View style={s.subtotalRow}>
                  <Text style={[s.subtotalLabel, { width: "48%" }]}>Subtotaal {MAAND_NAMEN[maand - 1]}</Text>
                  <Text style={[s.subtotalValue, { width: "10%", textAlign: "right" }]}>{Math.round(maandKm)}</Text>
                  <Text style={[s.subtotalLabel, { width: "30%" }]} />
                  <Text style={[s.subtotalValue, { width: "12%", textAlign: "right" }]}>{formatBedrag(maandBedrag)}</Text>
                </View>
              </View>

              <View style={s.footer}>
                <Text style={s.footerText}>Autronis — Kilometerregistratie {jaar}</Text>
                <Text style={s.footerText}>{MAAND_NAMEN[maand - 1]}</Text>
              </View>
            </Page>
          );
        })}

      {/* Summary page */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Samenvatting {jaar}</Text>
          <Text style={s.headerSub}>Overzicht voor belastingaangifte</Text>
        </View>
        <View style={s.accentLine} />

        <View style={s.body}>
          {/* Totals */}
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>Totaaloverzicht</Text>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Totaal gereden kilometers</Text>
              <Text style={s.summaryValue}>{Math.round(totaalKm).toLocaleString("nl-NL")} km</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Zakelijk percentage</Text>
              <Text style={s.summaryValue}>{zakelijkPercentage}%</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Zakelijke kilometers</Text>
              <Text style={s.summaryValue}>{Math.round(totaalZakelijkKm).toLocaleString("nl-NL")} km</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Tarief per km</Text>
              <Text style={s.summaryValue}>{formatBedrag(tariefPerKm)}</Text>
            </View>
            <View style={s.summaryHighlight}>
              <Text style={s.summaryHighlightLabel}>Totaal aftrekbaar</Text>
              <Text style={s.summaryHighlightValue}>{formatBedrag(totaalAftrekbaar)}</Text>
            </View>
          </View>

          {/* Per category */}
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>Per categorie</Text>
            <View style={[s.tableHeader, { backgroundColor: "#F3F4F6" }]}>
              <Text style={[s.tableHeaderCell, { width: "40%" }]}>CATEGORIE</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>RITTEN</Text>
              <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right" }]}>KM</Text>
              <Text style={[s.tableHeaderCell, { width: "25%", textAlign: "right" }]}>BEDRAG</Text>
            </View>
            {categorieën.map((cat) => (
              <View key={cat.doelType} style={s.tableRow}>
                <Text style={[s.tableCell, { width: "40%" }]}>{DOEL_LABELS[cat.doelType] || cat.doelType}</Text>
                <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{cat.ritten}</Text>
                <Text style={[s.tableCellBold, { width: "20%", textAlign: "right" }]}>{Math.round(cat.km)}</Text>
                <Text style={[s.tableCellBold, { width: "25%", textAlign: "right" }]}>{formatBedrag(cat.bedrag)}</Text>
              </View>
            ))}
          </View>

          {/* Km-standen overview */}
          {kmStanden.length > 0 && (
            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>Km-standen per maand</Text>
              <View style={[s.tableHeader, { backgroundColor: "#F3F4F6" }]}>
                <Text style={[s.tableHeaderCell, { width: "30%" }]}>MAAND</Text>
                <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right" }]}>BEGIN</Text>
                <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right" }]}>EIND</Text>
                <Text style={[s.tableHeaderCell, { width: "30%", textAlign: "right" }]}>TOTAAL</Text>
              </View>
              {kmStanden
                .sort((a, b) => a.maand - b.maand)
                .map((k) => (
                  <View key={k.maand} style={s.tableRow}>
                    <Text style={[s.tableCell, { width: "30%" }]}>{MAAND_NAMEN[k.maand - 1]}</Text>
                    <Text style={[s.tableCell, { width: "20%", textAlign: "right" }]}>{k.beginStand.toLocaleString("nl-NL")}</Text>
                    <Text style={[s.tableCell, { width: "20%", textAlign: "right" }]}>{k.eindStand.toLocaleString("nl-NL")}</Text>
                    <Text style={[s.tableCellBold, { width: "30%", textAlign: "right" }]}>{(k.eindStand - k.beginStand).toLocaleString("nl-NL")} km</Text>
                  </View>
                ))}
            </View>
          )}

          {/* Brandstofkosten */}
          {totaalBrandstof > 0 && (
            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>Brandstofkosten</Text>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Totaal brandstofkosten {jaar}</Text>
                <Text style={s.summaryValue}>{formatBedrag(totaalBrandstof)}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Autronis — Kilometerregistratie {jaar}</Text>
          <Text style={s.footerText}>Samenvatting</Text>
        </View>
      </Page>

      {/* Km-stand Bewijs Page */}
      {kmStanden.length > 0 && (
        <Page size="A4" style={s.page}>
          <View style={s.header}>
            <Text style={s.headerTitle}>Km-stand Bewijs {jaar}</Text>
            <Text style={s.headerSub}>Overzicht tellerstand per maand</Text>
          </View>
          <View style={s.accentLine} />

          <View style={s.body}>
            <Text style={s.sectionTitle}>Km-standen per maand</Text>
            {/* Table header */}
            <View style={[s.tableHeader, { backgroundColor: TEAL }]}>
              <Text style={[s.tableHeaderCell, { width: "22%", color: "#FFFFFF" }]}>MAAND</Text>
              <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right", color: "#FFFFFF" }]}>BEGINSTAND</Text>
              <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right", color: "#FFFFFF" }]}>EINDSTAND</Text>
              <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right", color: "#FFFFFF" }]}>TOTAAL GEREDEN</Text>
              <Text style={[s.tableHeaderCell, { width: "18%", textAlign: "right", color: "#FFFFFF" }]}>PRIV&#201; KM</Text>
            </View>
            {kmStanden
              .sort((a, b) => a.maand - b.maand)
              .map((k, idx) => {
                const totaalMaand = k.eindStand - k.beginStand;
                const maandRitten = rittenPerMaand[k.maand] || [];
                const gelogdZakelijk = maandRitten.reduce((sum, r) => sum + r.kilometers, 0);
                const privaKm = Math.max(0, totaalMaand - gelogdZakelijk);
                return (
                  <View key={k.maand} style={[s.tableRow, { backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#F9FAFB" }]}>
                    <Text style={[s.tableCell, { width: "22%" }]}>{MAAND_NAMEN[k.maand - 1]}</Text>
                    <Text style={[s.tableCell, { width: "20%", textAlign: "right" }]}>{k.beginStand.toLocaleString("nl-NL")}</Text>
                    <Text style={[s.tableCell, { width: "20%", textAlign: "right" }]}>{k.eindStand.toLocaleString("nl-NL")}</Text>
                    <Text style={[s.tableCellBold, { width: "20%", textAlign: "right" }]}>{totaalMaand.toLocaleString("nl-NL")} km</Text>
                    <Text style={[s.tableCell, { width: "18%", textAlign: "right" }]}>{Math.round(privaKm).toLocaleString("nl-NL")} km</Text>
                  </View>
                );
              })}
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Autronis — Kilometerregistratie {jaar}</Text>
            <Text style={s.footerText}>Km-stand Bewijs</Text>
          </View>
        </Page>
      )}

      {/* Zakelijk % Onderbouwing Page */}
      {werkelijkPercentage !== null && totaalGereden !== null && (
        <Page size="A4" style={s.page}>
          <View style={s.header}>
            <Text style={s.headerTitle}>Zakelijk % Onderbouwing {jaar}</Text>
            <Text style={s.headerSub}>Berekening werkelijk zakelijk percentage</Text>
          </View>
          <View style={s.accentLine} />

          <View style={s.body}>
            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>Berekening zakelijk percentage</Text>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Totaal gereden (van km-standen)</Text>
                <Text style={s.summaryValue}>{Math.round(totaalGereden).toLocaleString("nl-NL")} km</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Totaal zakelijk gelogd</Text>
                <Text style={s.summaryValue}>{Math.round(totaalZakelijkKm).toLocaleString("nl-NL")} km</Text>
              </View>
              <View style={s.summaryHighlight}>
                <Text style={s.summaryHighlightLabel}>Werkelijk zakelijk %</Text>
                <Text style={s.summaryHighlightValue}>{werkelijkPercentage.toFixed(1)}%</Text>
              </View>
            </View>
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Autronis — Kilometerregistratie {jaar}</Text>
            <Text style={s.footerText}>Zakelijk % Onderbouwing</Text>
          </View>
        </Page>
      )}

      {/* Brandstofkosten Detail Page */}
      {brandstofPerMaand.length > 0 && (
        <Page size="A4" style={s.page}>
          <View style={s.header}>
            <Text style={s.headerTitle}>Brandstofkosten Detail {jaar}</Text>
            <Text style={s.headerSub}>Brandstofkosten per maand</Text>
          </View>
          <View style={s.accentLine} />

          <View style={s.body}>
            <Text style={s.sectionTitle}>Brandstofkosten per maand</Text>
            {/* Table header */}
            <View style={[s.tableHeader, { backgroundColor: TEAL }]}>
              <Text style={[s.tableHeaderCell, { width: "30%", color: "#FFFFFF" }]}>MAAND</Text>
              <Text style={[s.tableHeaderCell, { width: "25%", textAlign: "right", color: "#FFFFFF" }]}>BEDRAG</Text>
              <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right", color: "#FFFFFF" }]}>LITERS</Text>
              <Text style={[s.tableHeaderCell, { width: "25%", textAlign: "right", color: "#FFFFFF" }]}>KM/LITER</Text>
            </View>
            {brandstofPerMaand
              .sort((a, b) => a.maand - b.maand)
              .map((b, idx) => {
                const maandRitten = rittenPerMaand[b.maand] || [];
                const maandKm = maandRitten.reduce((sum, r) => sum + r.kilometers, 0);
                const kmPerLiter = b.liters && b.liters > 0 ? maandKm / b.liters : null;
                return (
                  <View key={b.maand} style={[s.tableRow, { backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#F9FAFB" }]}>
                    <Text style={[s.tableCell, { width: "30%" }]}>{MAAND_NAMEN[b.maand - 1]}</Text>
                    <Text style={[s.tableCellBold, { width: "25%", textAlign: "right" }]}>{formatBedrag(b.bedrag)}</Text>
                    <Text style={[s.tableCell, { width: "20%", textAlign: "right" }]}>{b.liters !== null ? `${b.liters.toFixed(2)} L` : "—"}</Text>
                    <Text style={[s.tableCell, { width: "25%", textAlign: "right" }]}>{kmPerLiter !== null ? `${kmPerLiter.toFixed(1)} km/L` : "—"}</Text>
                  </View>
                );
              })}
            {/* Totaal row */}
            <View style={s.subtotalRow}>
              <Text style={[s.subtotalLabel, { width: "30%" }]}>Totaal</Text>
              <Text style={[s.subtotalValue, { width: "25%", textAlign: "right" }]}>{formatBedrag(brandstofPerMaand.reduce((sum, b) => sum + b.bedrag, 0))}</Text>
              <Text style={[s.subtotalValue, { width: "20%", textAlign: "right" }]}>
                {brandstofPerMaand.some((b) => b.liters !== null)
                  ? `${brandstofPerMaand.reduce((sum, b) => sum + (b.liters ?? 0), 0).toFixed(2)} L`
                  : "—"}
              </Text>
              <Text style={[s.subtotalLabel, { width: "25%" }]} />
            </View>
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Autronis — Kilometerregistratie {jaar}</Text>
            <Text style={s.footerText}>Brandstofkosten Detail</Text>
          </View>
        </Page>
      )}
    </Document>
  );
}
