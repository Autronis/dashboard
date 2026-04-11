import React from "react";
import path from "path";
import fs from "fs";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";
import type { MaandrapportData } from "@/hooks/queries/use-maandrapport";

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

const MAAND_NAMEN = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

function fmt(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(bedrag);
}

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 8, color: "#1F2937", backgroundColor: "#FFFFFF", padding: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #E5E7EB", paddingBottom: 12 },
  title: { fontSize: 14, fontWeight: 700, color: "#111827" },
  subtitle: { fontSize: 9, color: "#6B7280", marginTop: 2 },
  badge: { fontSize: 8, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "3 8", borderRadius: 4 },
  logo: { width: 40, height: 40 },
  sectionTitle: { fontSize: 10, fontWeight: 700, color: "#111827", marginBottom: 8, marginTop: 16 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 6, padding: 10, border: "1px solid #E5E7EB" },
  kpiLabel: { fontSize: 7, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  tableHeader: { flexDirection: "row", backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB", paddingVertical: 4, paddingHorizontal: 6 },
  tableHeaderCell: { fontSize: 7, fontWeight: 600, color: "#6B7280", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #F3F4F6", paddingVertical: 3, paddingHorizontal: 6 },
  tableCell: { fontSize: 8, color: "#374151" },
  totalRow: { flexDirection: "row", borderTop: "1px solid #D1D5DB", paddingVertical: 4, paddingHorizontal: 6, backgroundColor: "#F9FAFB" },
  totalCell: { fontSize: 8, fontWeight: 700, color: "#111827" },
  splitRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  splitCard: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 6, padding: 10, border: "1px solid #E5E7EB" },
  splitTitle: { fontSize: 9, fontWeight: 700, color: "#111827", marginBottom: 6 },
  splitItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, borderBottom: "1px solid #F3F4F6" },
  splitItemText: { fontSize: 8, color: "#6B7280" },
  splitItemValue: { fontSize: 8, color: "#374151" },
  splitTotal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid #D1D5DB", marginTop: 4 },
  splitTotalText: { fontSize: 8, fontWeight: 700, color: "#111827" },
  splitTotalValue: { fontSize: 8, fontWeight: 700, color: "#059669" },
  footer: { marginTop: 20, paddingTop: 10, borderTop: "1px solid #E5E7EB", textAlign: "center" },
  footerText: { fontSize: 7, color: "#9CA3AF" },
});

export function MaandrapportPDF({ data }: { data: MaandrapportData }) {
  const [jaarStr, maandStr] = data.maand.split("-");
  const maandNaam = MAAND_NAMEN[parseInt(maandStr, 10) - 1];
  const logoSrc = getLogoSrc();

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Autronis VOF — Maandrapport</Text>
            <Text style={s.subtitle}>Belastingoverzicht {maandNaam} {jaarStr}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={s.badge}>{maandNaam} {jaarStr}</Text>
            {logoSrc ? <Image src={logoSrc} style={s.logo} /> : null}
          </View>
        </View>

        {/* KPI Cards */}
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Totaal uitgaven</Text>
            <Text style={s.kpiValue}>{fmt(data.totaalUitgaven)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>BTW terug</Text>
            <Text style={[s.kpiValue, { color: "#059669" }]}>{fmt(data.totaalBtw)}</Text>
          </View>
          {data.totaalVerrekening > 0 && (
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>Van Syb</Text>
              <Text style={[s.kpiValue, { color: "#EA580C" }]}>{fmt(data.totaalVerrekening)}</Text>
            </View>
          )}
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Totaal terug</Text>
            <Text style={[s.kpiValue, { color: "#7C3AED" }]}>{fmt(data.totaalTerug)}</Text>
          </View>
        </View>

        {/* Uitgaven tabel */}
        <Text style={s.sectionTitle}>Zakelijke uitgaven — {maandNaam} {jaarStr}</Text>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { width: 50 }]}>Datum</Text>
          <Text style={[s.tableHeaderCell, { flex: 1 }]}>Omschrijving</Text>
          <Text style={[s.tableHeaderCell, { width: 70 }]}>Categorie</Text>
          <Text style={[s.tableHeaderCell, { width: 50 }]}>Bron</Text>
          <Text style={[s.tableHeaderCell, { width: 65, textAlign: "right" }]}>Incl. BTW</Text>
          <Text style={[s.tableHeaderCell, { width: 55, textAlign: "right" }]}>BTW</Text>
          <Text style={[s.tableHeaderCell, { width: 55, textAlign: "right" }]}>Eigenaar</Text>
        </View>
        {data.uitgaven.map((item, i) => (
          <View key={i} style={s.tableRow}>
            <Text style={[s.tableCell, { width: 50 }]}>{item.datum.slice(5).replace("-", "/")}</Text>
            <Text style={[s.tableCell, { flex: 1 }]}>{item.omschrijving}</Text>
            <Text style={[s.tableCell, { width: 70 }]}>{item.categorie ?? ""}</Text>
            <Text style={[s.tableCell, { width: 50 }]}>{item.bankNaam ?? "—"}</Text>
            <Text style={[s.tableCell, { width: 65, textAlign: "right" }]}>{fmt(item.bedragInclBtw)}</Text>
            <Text style={[s.tableCell, { width: 55, textAlign: "right" }]}>{item.btwBedrag ? fmt(item.btwBedrag) : "—"}</Text>
            <Text style={[s.tableCell, { width: 55, textAlign: "right" }]}>{item.eigenaar === "gedeeld" ? item.splitRatio : item.eigenaar ?? "—"}</Text>
          </View>
        ))}
        <View style={s.totalRow}>
          <Text style={[s.totalCell, { width: 50 }]} />
          <Text style={[s.totalCell, { flex: 1 }]}>Totaal</Text>
          <Text style={[s.totalCell, { width: 70 }]} />
          <Text style={[s.totalCell, { width: 50 }]} />
          <Text style={[s.totalCell, { width: 65, textAlign: "right" }]}>{fmt(data.totaalUitgaven)}</Text>
          <Text style={[s.totalCell, { width: 55, textAlign: "right" }]}>{fmt(data.totaalBtw)}</Text>
          <Text style={[s.totalCell, { width: 55 }]} />
        </View>

        {/* BTW Split */}
        <Text style={s.sectionTitle}>BTW split — Sem vs Syb</Text>
        <View style={s.splitRow}>
          <View style={s.splitCard}>
            <Text style={s.splitTitle}>Sem — BTW terug</Text>
            {data.btwSplit.sem.items.map((item, i) => (
              <View key={i} style={s.splitItem}>
                <Text style={s.splitItemText}>{item.omschrijving}</Text>
                <Text style={s.splitItemValue}>{fmt(item.bedrag)}</Text>
              </View>
            ))}
            <View style={s.splitTotal}>
              <Text style={s.splitTotalText}>Totaal Sem</Text>
              <Text style={s.splitTotalValue}>{fmt(data.btwSplit.sem.totaal)}</Text>
            </View>
          </View>
          <View style={s.splitCard}>
            <Text style={s.splitTitle}>Syb — BTW terug</Text>
            {data.btwSplit.syb.items.map((item, i) => (
              <View key={i} style={s.splitItem}>
                <Text style={s.splitItemText}>{item.omschrijving}</Text>
                <Text style={s.splitItemValue}>{fmt(item.bedrag)}</Text>
              </View>
            ))}
            <View style={s.splitTotal}>
              <Text style={s.splitTotalText}>Totaal Syb</Text>
              <Text style={s.splitTotalValue}>{fmt(data.btwSplit.syb.totaal)}</Text>
            </View>
          </View>
        </View>

        {/* Samenvatting */}
        <Text style={s.sectionTitle}>Samenvatting</Text>
        <View style={s.splitCard}>
          <View style={s.splitItem}>
            <Text style={s.splitItemText}>BTW terug (Belastingdienst)</Text>
            <Text style={[s.splitItemValue, { color: "#059669" }]}>{fmt(data.totaalBtw)}</Text>
          </View>
          {data.totaalVerrekening > 0 && (
            <View style={s.splitItem}>
              <Text style={s.splitItemText}>Van Syb (openstaand)</Text>
              <Text style={[s.splitItemValue, { color: "#EA580C" }]}>{fmt(data.totaalVerrekening)}</Text>
            </View>
          )}
          <View style={s.splitTotal}>
            <Text style={s.splitTotalText}>Totaal terug te krijgen</Text>
            <Text style={[s.splitTotalValue, { fontSize: 10 }]}>{fmt(data.totaalTerug)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Autronis VOF — Gegenereerd op {new Date().toLocaleDateString("nl-NL")} — Dit overzicht is indicatief</Text>
        </View>
      </Page>
    </Document>
  );
}
