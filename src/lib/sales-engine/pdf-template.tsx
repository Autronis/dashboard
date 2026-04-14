import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { AutronisBrand, impactKleur as brandImpactKleur } from "@/lib/autronis-brand";

// Shared Autronis brand colors — match scope-generator skill template.html
// so every klant-facing document has the same visual identity.
const ACCENT = AutronisBrand.accent;
const ACCENT_LIGHT = AutronisBrand.accentBgStrong;
const TEXT_PRIMARY = AutronisBrand.textPrimary;
const TEXT_SECONDARY = AutronisBrand.textSecondary;
const BORDER = AutronisBrand.border;
const BG_LIGHT = AutronisBrand.cardHover;

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: TEXT_PRIMARY,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
  },
  headerLeft: {},
  companyName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: TEXT_SECONDARY,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  autronis: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: TEXT_PRIMARY,
  },
  datum: {
    fontSize: 9,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.6,
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  scoreBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ACCENT_LIGHT,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginRight: 12,
  },
  scoreLabel: {
    fontSize: 10,
    color: TEXT_SECONDARY,
  },
  kansRow: {
    flexDirection: "row",
    padding: 8,
    marginBottom: 4,
    borderRadius: 4,
  },
  kansRowEven: {
    backgroundColor: BG_LIGHT,
  },
  kansPriority: {
    width: 24,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
  },
  kansContent: {
    flex: 1,
  },
  kansTitel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  kansBeschrijving: {
    fontSize: 9,
    color: TEXT_SECONDARY,
    lineHeight: 1.4,
  },
  kansImpact: {
    width: 60,
    textAlign: "right" as const,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  roiGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  roiCard: {
    flex: 1,
    backgroundColor: BG_LIGHT,
    padding: 12,
    borderRadius: 8,
    alignItems: "center" as const,
  },
  roiValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 2,
  },
  roiLabel: {
    fontSize: 8,
    color: TEXT_SECONDARY,
    textAlign: "center" as const,
  },
  cta: {
    marginTop: 20,
    padding: 16,
    backgroundColor: ACCENT,
    borderRadius: 8,
    alignItems: "center" as const,
  },
  ctaText: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  ctaSubtext: {
    fontSize: 10,
    color: AutronisBrand.accentLight,
  },
  footer: {
    position: "absolute" as const,
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: TEXT_SECONDARY,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
});

export interface MiniVoorstelData {
  bedrijfsnaam: string;
  contactpersoon: string;
  websiteUrl: string;
  samenvatting: string;
  readinessScore: number;
  aanbevolenPakket: string;
  kansen: Array<{
    titel: string;
    beschrijving: string;
    impact: string;
    geschatteTijdsbesparing: string | null;
    geschatteBesparing: string | null;
    prioriteit: number;
  }>;
  jaarlijkseBesparing: number;
  geschatteInvestering: number;
  terugverdientijdMaanden: number;
  totaalUrenPerWeek: number;
  bookingUrl?: string;
}

// Use the shared brand helper so Sales Engine + scope-generator match.
const impactKleur = brandImpactKleur;

export function MiniVoorstelPDF({ data }: { data: MiniVoorstelData }) {
  const datum = new Date().toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const topKansen = data.kansen
    .sort((a, b) => a.prioriteit - b.prioriteit)
    .slice(0, 5);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{data.bedrijfsnaam}</Text>
            <Text style={styles.subtitle}>Automatiseringsanalyse & Mini-voorstel</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.autronis}>Autronis</Text>
            <Text style={styles.datum}>{datum}</Text>
          </View>
        </View>

        {/* Intro */}
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Beste {data.contactpersoon},
          </Text>
          <Text style={styles.paragraph}>
            {data.samenvatting}
          </Text>
        </View>

        {/* Score + ROI overzicht */}
        <View style={styles.roiGrid}>
          <View style={styles.roiCard}>
            <Text style={styles.roiValue}>{data.readinessScore}/10</Text>
            <Text style={styles.roiLabel}>Automation Readiness</Text>
          </View>
          <View style={styles.roiCard}>
            <Text style={styles.roiValue}>
              {`€${data.jaarlijkseBesparing.toLocaleString("nl-NL")}`}
            </Text>
            <Text style={styles.roiLabel}>Jaarlijkse besparing</Text>
          </View>
          <View style={styles.roiCard}>
            <Text style={styles.roiValue}>{data.totaalUrenPerWeek}u/week</Text>
            <Text style={styles.roiLabel}>Tijdsbesparing</Text>
          </View>
          <View style={styles.roiCard}>
            <Text style={styles.roiValue}>
              ~{data.terugverdientijdMaanden} mnd
            </Text>
            <Text style={styles.roiLabel}>Terugverdientijd</Text>
          </View>
        </View>

        {/* Top Kansen */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top {topKansen.length} Automatiseringskansen</Text>
          {topKansen.map((kans, i) => (
            <View key={i} style={[styles.kansRow, i % 2 === 0 ? styles.kansRowEven : {}]}>
              <Text style={styles.kansPriority}>#{kans.prioriteit}</Text>
              <View style={styles.kansContent}>
                <Text style={styles.kansTitel}>{kans.titel}</Text>
                <Text style={styles.kansBeschrijving}>{kans.beschrijving}</Text>
              </View>
              <Text style={[styles.kansImpact, { color: impactKleur(kans.impact) }]}>
                {kans.impact === "hoog" ? "Hoge impact" : kans.impact === "midden" ? "Medium" : "Laag"}
              </Text>
            </View>
          ))}
        </View>

        {/* Investering */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Investering & Pakket</Text>
          <Text style={styles.paragraph}>
            Op basis van onze analyse raden wij het {data.aanbevolenPakket}-pakket aan
            met een geschatte investering van €{data.geschatteInvestering.toLocaleString("nl-NL")}.
            Met een jaarlijkse besparing van €{data.jaarlijkseBesparing.toLocaleString("nl-NL")}
            verdient u deze investering terug in ongeveer {data.terugverdientijdMaanden} maanden.
          </Text>
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Interesse? Plan een gratis gesprek</Text>
          <Text style={styles.ctaSubtext}>
            {data.bookingUrl ?? "https://cal.com/autronis"}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Autronis — Automatisering die werkt</Text>
          <Text>{data.websiteUrl}</Text>
        </View>
      </Page>
    </Document>
  );
}
