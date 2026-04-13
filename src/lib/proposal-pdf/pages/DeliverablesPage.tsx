// src/lib/proposal-pdf/pages/DeliverablesPage.tsx
import { Page, View, Text } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { BgImageLayer } from "../primitives";
import { DeliverablesSlide } from "@/components/proposal-deck/types";

export function DeliverablesPage({ slide }: { slide: DeliverablesSlide }) {
  return (
    <Page size="A4" orientation="landscape" style={pdfStyles.page}>
      <BgImageLayer url={slide.bgImageUrl} />
      <View style={pdfStyles.content}>
        <Text style={pdfStyles.typeLabel}>Deliverables</Text>
        <Text style={[pdfStyles.headingLG, { marginBottom: 32 }]}>{slide.titel}</Text>
        <View>
          {slide.items.map((item, idx) => (
            <View key={idx} style={pdfStyles.bulletRow}>
              <Text style={pdfStyles.bulletNumber}>{String(idx + 1).padStart(2, "0")}</Text>
              <Text style={pdfStyles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}
