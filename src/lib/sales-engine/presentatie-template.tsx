import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const ACCENT = "#6366f1";
const ACCENT_LIGHT = "#e0e7ff";
const TEXT_PRIMARY = "#1e293b";
const TEXT_SECONDARY = "#64748b";
const TEXT_LIGHT = "#94a3b8";
const BG_DARK = "#0f172a";
const BG_LIGHT = "#f8fafc";
const BORDER = "#e2e8f0";
const EMERALD = "#34d399";

const s = StyleSheet.create({
  // Shared slide layout
  slide: { width: "100%", height: "100%", padding: 50 },
  slideNumber: { position: "absolute" as const, bottom: 20, right: 30, fontSize: 9, color: TEXT_LIGHT },
  footer: { position: "absolute" as const, bottom: 20, left: 50, fontSize: 8, color: TEXT_LIGHT },

  // Title slide
  titleSlide: { backgroundColor: BG_DARK, justifyContent: "center" as const, alignItems: "center" as const },
  titleCompany: { fontSize: 36, fontFamily: "Helvetica-Bold", color: "#ffffff", marginBottom: 8 },
  titleSub: { fontSize: 16, color: ACCENT_LIGHT, marginBottom: 30 },
  titleAutronis: { fontSize: 12, color: TEXT_LIGHT },
  titleDate: { fontSize: 10, color: TEXT_LIGHT, marginTop: 4 },

  // Section header
  sectionSlide: { backgroundColor: ACCENT, justifyContent: "center" as const },
  sectionTitle: { fontSize: 28, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  sectionSub: { fontSize: 13, color: ACCENT_LIGHT, marginTop: 8 },

  // Content slides
  contentTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: TEXT_PRIMARY, marginBottom: 20 },
  contentSubtitle: { fontSize: 11, color: ACCENT, fontFamily: "Helvetica-Bold", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 1 },
  contentText: { fontSize: 10, color: TEXT_SECONDARY, lineHeight: 1.6, marginBottom: 8 },

  // Kans row
  kansRow: { flexDirection: "row" as const, padding: 8, marginBottom: 4, borderRadius: 4 },
  kansRowEven: { backgroundColor: BG_LIGHT },
  kansNum: { width: 24, fontSize: 12, fontFamily: "Helvetica-Bold", color: ACCENT },
  kansContent: { flex: 1 },
  kansTitel: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  kansDesc: { fontSize: 9, color: TEXT_SECONDARY, lineHeight: 1.4 },
  kansImpact: { width: 55, textAlign: "right" as const, fontSize: 9, fontFamily: "Helvetica-Bold" },

  // ROI metrics
  metricsRow: { flexDirection: "row" as const, gap: 12, marginBottom: 16 },
  metricCard: { flex: 1, backgroundColor: BG_LIGHT, padding: 14, borderRadius: 8, alignItems: "center" as const },
  metricValue: { fontSize: 22, fontFamily: "Helvetica-Bold", color: ACCENT, marginBottom: 2 },
  metricLabel: { fontSize: 8, color: TEXT_SECONDARY, textAlign: "center" as const },

  // Timeline
  timelineRow: { flexDirection: "row" as const, marginBottom: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ACCENT, marginRight: 12, marginTop: 3 },
  timelineContent: { flex: 1, borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 10 },
  timelineFase: { fontSize: 11, fontFamily: "Helvetica-Bold", color: TEXT_PRIMARY, marginBottom: 2 },
  timelineDesc: { fontSize: 9, color: TEXT_SECONDARY },
  timelineDuur: { fontSize: 9, color: ACCENT, marginTop: 2 },

  // CTA
  ctaBox: { backgroundColor: ACCENT, borderRadius: 12, padding: 24, alignItems: "center" as const, marginTop: 20 },
  ctaTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#ffffff", marginBottom: 6 },
  ctaText: { fontSize: 11, color: ACCENT_LIGHT },
});

export interface PresentatieData {
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
    prioriteit: number;
  }>;
  jaarlijkseBesparing: number;
  geschatteInvestering: number;
  terugverdientijdMaanden: number;
  totaalUrenPerWeek: number;
  bookingUrl?: string;
  bedrijfsProfiel?: { branche: string; watZeDoen: string; doelgroep: string } | null;
}

function impactKleur(impact: string): string {
  if (impact === "hoog") return EMERALD;
  if (impact === "midden") return "#f59e0b";
  return TEXT_LIGHT;
}

export function PresentatiePDF({ data }: { data: PresentatieData }) {
  const datum = new Date().toLocaleDateString("nl-NL", { year: "numeric", month: "long", day: "numeric" });
  const topKansen = data.kansen.sort((a, b) => a.prioriteit - b.prioriteit).slice(0, 7);
  let slideNr = 0;

  const SlideNr = () => { slideNr++; return <Text style={s.slideNumber}>{slideNr}</Text>; };
  const Footer = () => <Text style={s.footer}>Autronis — Automatisering die werkt</Text>;

  return (
    <Document>
      {/* Slide 1: Titelpagina */}
      <Page size="A4" orientation="landscape" style={[s.slide, s.titleSlide]}>
        <Text style={s.titleCompany}>{data.bedrijfsnaam}</Text>
        <Text style={s.titleSub}>Automatiseringsanalyse & Voorstel</Text>
        <Text style={s.titleAutronis}>Autronis</Text>
        <Text style={s.titleDate}>{datum}</Text>
      </Page>

      {/* Slide 2: Sectie — Analyse */}
      <Page size="A4" orientation="landscape" style={[s.slide, s.sectionSlide]}>
        <Text style={s.sectionTitle}>Analyse</Text>
        <Text style={s.sectionSub}>Wat we gevonden hebben op basis van uw website en bedrijfsprofiel</Text>
        <SlideNr />
      </Page>

      {/* Slide 3: Bedrijfsprofiel + Samenvatting */}
      <Page size="A4" orientation="landscape" style={s.slide}>
        <Text style={s.contentTitle}>Uw Bedrijf</Text>
        {data.bedrijfsProfiel && (
          <View style={{ marginBottom: 16 }}>
            <Text style={s.contentSubtitle}>Profiel</Text>
            <Text style={s.contentText}>Branche: {data.bedrijfsProfiel.branche}</Text>
            <Text style={s.contentText}>Activiteiten: {data.bedrijfsProfiel.watZeDoen}</Text>
            <Text style={s.contentText}>Doelgroep: {data.bedrijfsProfiel.doelgroep}</Text>
          </View>
        )}
        <Text style={s.contentSubtitle}>Samenvatting</Text>
        <Text style={s.contentText}>{data.samenvatting}</Text>
        <SlideNr />
        <Footer />
      </Page>

      {/* Slide 4: Sectie — Kansen */}
      <Page size="A4" orientation="landscape" style={[s.slide, s.sectionSlide]}>
        <Text style={s.sectionTitle}>Kansen</Text>
        <Text style={s.sectionSub}>{topKansen.length} automatiseringskansen geïdentificeerd</Text>
        <SlideNr />
      </Page>

      {/* Slide 5: Top kansen */}
      <Page size="A4" orientation="landscape" style={s.slide}>
        <Text style={s.contentTitle}>Top Automatiseringskansen</Text>
        {topKansen.map((kans, i) => (
          <View key={i} style={[s.kansRow, i % 2 === 0 ? s.kansRowEven : {}]}>
            <Text style={s.kansNum}>#{kans.prioriteit}</Text>
            <View style={s.kansContent}>
              <Text style={s.kansTitel}>{kans.titel}</Text>
              <Text style={s.kansDesc}>{kans.beschrijving}</Text>
            </View>
            <Text style={[s.kansImpact, { color: impactKleur(kans.impact) }]}>
              {kans.impact === "hoog" ? "Hoog" : kans.impact === "midden" ? "Medium" : "Laag"}
            </Text>
          </View>
        ))}
        <SlideNr />
        <Footer />
      </Page>

      {/* Slide 6: Sectie — ROI */}
      <Page size="A4" orientation="landscape" style={[s.slide, s.sectionSlide]}>
        <Text style={s.sectionTitle}>ROI & Investering</Text>
        <Text style={s.sectionSub}>De financiële impact van automatisering</Text>
        <SlideNr />
      </Page>

      {/* Slide 7: ROI Metrics */}
      <Page size="A4" orientation="landscape" style={s.slide}>
        <Text style={s.contentTitle}>Return on Investment</Text>
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{data.readinessScore}/10</Text>
            <Text style={s.metricLabel}>Automation Readiness</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{`€${data.jaarlijkseBesparing.toLocaleString("nl-NL")}`}</Text>
            <Text style={s.metricLabel}>Jaarlijkse besparing</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{data.totaalUrenPerWeek}u</Text>
            <Text style={s.metricLabel}>Uren bespaard per week</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>~{data.terugverdientijdMaanden} mnd</Text>
            <Text style={s.metricLabel}>Terugverdientijd</Text>
          </View>
        </View>
        <View style={{ marginTop: 16 }}>
          <Text style={s.contentSubtitle}>Investering</Text>
          <Text style={s.contentText}>
            Aanbevolen pakket: {data.aanbevolenPakket} — geschatte investering €{data.geschatteInvestering.toLocaleString("nl-NL")}
          </Text>
          <Text style={s.contentText}>
            Met een jaarlijkse besparing van €{data.jaarlijkseBesparing.toLocaleString("nl-NL")} verdient u deze
            investering terug in ongeveer {data.terugverdientijdMaanden} maanden.
          </Text>
        </View>
        <SlideNr />
        <Footer />
      </Page>

      {/* Slide 8: Fasering */}
      <Page size="A4" orientation="landscape" style={s.slide}>
        <Text style={s.contentTitle}>Voorgestelde Fasering</Text>
        {[
          { fase: "Fase 1 — Quick Wins", desc: "Eenvoudige automatiseringen met directe impact", duur: "Week 1-2" },
          { fase: "Fase 2 — Kernprocessen", desc: "Automatisering van de belangrijkste bedrijfsprocessen", duur: "Week 3-6" },
          { fase: "Fase 3 — Integraties", desc: "Koppelingen tussen systemen en geavanceerde workflows", duur: "Week 7-10" },
          { fase: "Fase 4 — Optimalisatie", desc: "Monitoring, fine-tuning en uitbreiding", duur: "Week 11-12" },
        ].map((item, i) => (
          <View key={i} style={s.timelineRow}>
            <View style={s.timelineDot} />
            <View style={s.timelineContent}>
              <Text style={s.timelineFase}>{item.fase}</Text>
              <Text style={s.timelineDesc}>{item.desc}</Text>
              <Text style={s.timelineDuur}>{item.duur}</Text>
            </View>
          </View>
        ))}
        <SlideNr />
        <Footer />
      </Page>

      {/* Slide 9: CTA */}
      <Page size="A4" orientation="landscape" style={s.slide}>
        <Text style={s.contentTitle}>Volgende Stap</Text>
        <Text style={s.contentText}>
          Wij staan klaar om uw automatiseringsreis te begeleiden. Plan een vrijblijvend gesprek
          om de mogelijkheden te bespreken.
        </Text>
        <View style={s.ctaBox}>
          <Text style={s.ctaTitle}>Plan een gratis strategiegesprek</Text>
          <Text style={s.ctaText}>{data.bookingUrl ?? "https://cal.com/autronis"}</Text>
        </View>
        <Footer />
      </Page>
    </Document>
  );
}
