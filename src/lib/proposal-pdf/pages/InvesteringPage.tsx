// src/lib/proposal-pdf/pages/InvesteringPage.tsx
import { Page, View, Text } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { BgImageLayer } from "../primitives";
import { InvesteringSlide } from "@/components/proposal-deck/types";
import { DECK_COLORS } from "@/lib/proposal-deck-tokens";

type Regel = {
  id: number;
  omschrijving: string;
  aantal: number | null;
  eenheidsprijs: number | null;
  totaal: number | null;
};

function formatBedrag(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function InvesteringPage({
  slide,
  regels,
  totaalBedrag,
  geldigTot,
}: {
  slide: InvesteringSlide;
  regels: Regel[];
  totaalBedrag: number;
  geldigTot: string | null;
}) {
  return (
    <Page size="A4" orientation="landscape" style={pdfStyles.page}>
      <BgImageLayer url={slide.bgImageUrl} />
      <View style={pdfStyles.content}>
        <Text style={pdfStyles.typeLabel}>Investering</Text>
        <View style={{ flexDirection: "row", gap: 40 }}>
          {/* Tabel links */}
          <View style={{ flex: 1 }}>
            <View
              style={[
                pdfStyles.tableRow,
                { borderBottomWidth: 1, borderBottomColor: DECK_COLORS.border },
              ]}
            >
              <Text style={[pdfStyles.small, { flex: 3 }]}>Omschrijving</Text>
              <Text style={[pdfStyles.small, { flex: 1, textAlign: "right" }]}>Aantal</Text>
              <Text style={[pdfStyles.small, { flex: 1, textAlign: "right" }]}>Prijs</Text>
              <Text style={[pdfStyles.small, { flex: 1, textAlign: "right" }]}>Totaal</Text>
            </View>
            {regels.map((r) => (
              <View key={r.id} style={pdfStyles.tableRow}>
                <Text style={[pdfStyles.body, { flex: 3 }]}>{r.omschrijving}</Text>
                <Text style={[pdfStyles.body, { flex: 1, textAlign: "right" }]}>
                  {r.aantal ?? 1}
                </Text>
                <Text style={[pdfStyles.body, { flex: 1, textAlign: "right" }]}>
                  {formatBedrag(r.eenheidsprijs ?? 0)}
                </Text>
                <Text
                  style={[pdfStyles.body, { flex: 1, textAlign: "right", fontWeight: 600 }]}
                >
                  {formatBedrag(r.totaal ?? 0)}
                </Text>
              </View>
            ))}
          </View>
          {/* Totaal rechts */}
          <View style={{ width: 300, justifyContent: "center", alignItems: "flex-end" }}>
            <Text style={pdfStyles.small}>TOTAAL</Text>
            <Text style={pdfStyles.totaalImpact}>{formatBedrag(totaalBedrag)}</Text>
            {geldigTot && (
              <Text style={[pdfStyles.small, { marginTop: 8 }]}>
                Geldig tot {new Date(geldigTot).toLocaleDateString("nl-NL")}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Page>
  );
}
