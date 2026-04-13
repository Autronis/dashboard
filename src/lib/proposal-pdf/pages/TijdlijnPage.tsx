// src/lib/proposal-pdf/pages/TijdlijnPage.tsx
import { Page, View, Text } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { BgImageLayer } from "../primitives";
import { TijdlijnSlide } from "@/components/proposal-deck/types";

export function TijdlijnPage({ slide }: { slide: TijdlijnSlide }) {
  return (
    <Page size="A4" orientation="landscape" style={pdfStyles.page}>
      <BgImageLayer url={slide.bgImageUrl} />
      <View style={pdfStyles.content}>
        <Text style={pdfStyles.typeLabel}>Tijdlijn</Text>
        <Text style={[pdfStyles.headingLG, { marginBottom: 28 }]}>{slide.titel}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {slide.fases.map((fase, idx) => (
            <View key={idx} style={[pdfStyles.faseCard, { width: "30%" }]}>
              <Text style={pdfStyles.faseCardHeader}>
                Fase {idx + 1} · {fase.duur}
              </Text>
              <Text style={pdfStyles.faseCardTitle}>{fase.naam}</Text>
              <Text style={pdfStyles.faseCardBody}>{fase.omschrijving}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}
