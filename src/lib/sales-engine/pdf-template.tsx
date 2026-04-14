import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { AutronisBrand, impactKleur as brandImpactKleur } from "@/lib/autronis-brand";
import { getLogoDataUrl } from "@/lib/autronis-logo";

// ═══════════════════════════════════════════════════════════════════
// Sales Engine — Voorstel PDF
// Multi-page klant-voorstel visually aligned with the scope-generator
// skill template.html (Autronis brand, teal accent, cover → sections).
//
// Layout strategy:
//   - Cover lives on its own <Page> (no wrap).
//   - Everything else lives on ONE continuous <Page> where React PDF
//     automatically breaks pages as content overflows. The fixed footer
//     + accent bar re-render on every generated page. This prevents the
//     "section ends halfway, rest of page is blank" problem we had when
//     each section was on its own <Page>.
//   - Section headers use wrap={false} and minPresenceAhead to avoid
//     orphan headers at the bottom of a page.
// ═══════════════════════════════════════════════════════════════════

const B = AutronisBrand;

// ────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 60,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: B.textPrimary,
    backgroundColor: B.bg,
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: B.accent,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  headerLogo: { width: 72, height: 20, objectFit: "contain" },
  headerMeta: { alignItems: "flex-end" },
  headerRef: {
    fontSize: 8,
    color: B.textTertiary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  headerDate: { fontSize: 9, color: B.textSecondary, marginTop: 2 },

  // Section header — kicker + title stick together via wrap={false}
  sectionHeader: { marginTop: 6, marginBottom: 14 },
  sectionNumber: {
    fontSize: 8,
    color: B.accent,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    letterSpacing: -0.4,
    lineHeight: 1.15,
  },

  paragraph: {
    fontSize: 10,
    color: B.textSecondary,
    lineHeight: 1.6,
    marginBottom: 8,
  },
  label: {
    fontSize: 8,
    color: B.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  strong: { fontFamily: "Helvetica-Bold", color: B.textPrimary },

  card: {
    backgroundColor: B.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: B.border,
    padding: 14,
    marginBottom: 10,
  },
  cardAccent: { borderLeftWidth: 4, borderLeftColor: B.accent },
  cardSuccess: { borderLeftWidth: 4, borderLeftColor: B.success },
  cardWarning: { borderLeftWidth: 4, borderLeftColor: B.warning },

  // KPI grid — 3 columns, wraps to new row if needed
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  kpiTile: {
    flexBasis: "31.5%",
    backgroundColor: B.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: B.border,
    padding: 14,
    alignItems: "center",
  },
  kpiTileHalf: { flexBasis: "48%" },
  kpiTileAccent: { borderLeftWidth: 4, borderLeftColor: B.accent },
  kpiTileSuccess: { borderLeftWidth: 4, borderLeftColor: B.success },
  kpiTileWarning: { borderLeftWidth: 4, borderLeftColor: B.warning },
  kpiValue: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    marginBottom: 4,
  },
  kpiValueAccent: { color: B.accent },
  kpiValueSuccess: { color: B.success },
  kpiValueWarning: { color: B.warning },
  kpiLabel: {
    fontSize: 8,
    color: B.textTertiary,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  // Kansen overview rows — compact
  kansRow: {
    flexDirection: "row",
    padding: 10,
    marginBottom: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: B.border,
    backgroundColor: B.card,
  },
  kansPrio: {
    width: 26,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: B.accent,
  },
  kansContent: { flex: 1 },
  kansTitel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    marginBottom: 2,
  },
  kansBeschrijving: {
    fontSize: 8.5,
    color: B.textSecondary,
    lineHeight: 1.45,
  },
  kansImpact: {
    width: 68,
    textAlign: "right",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  // Per-kans detail block (stacked, not full page)
  kansDetailBlock: {
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: B.border,
    borderLeftColor: B.accent,
    backgroundColor: B.card,
    padding: 14,
  },
  kansDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  kansDetailTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    marginRight: 10,
  },
  kansDetailBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  kansDetailMetrics: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: B.borderLight,
  },
  kansMetricItem: {
    flex: 1,
  },
  kansMetricLabel: {
    fontSize: 7,
    color: B.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  kansMetricValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
  },

  // Tech stack rows
  techRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: B.borderLight,
  },
  techComponent: {
    width: 100,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
  },
  techDescription: {
    flex: 1,
    fontSize: 9,
    color: B.textSecondary,
    lineHeight: 1.45,
  },

  // Next steps
  stepRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: B.accent,
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 6,
    marginRight: 12,
  },
  stepContent: { flex: 1 },
  stepTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 9,
    color: B.textSecondary,
    lineHeight: 1.45,
  },

  cta: {
    marginTop: 14,
    padding: 18,
    backgroundColor: B.accent,
    borderRadius: 10,
    alignItems: "center",
  },
  ctaTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: B.textOnAccent,
    marginBottom: 4,
  },
  ctaText: { fontSize: 10, color: B.accentLight },

  // Footer — stays fixed at bottom of every page
  footer: {
    position: "absolute",
    bottom: 22,
    left: 48,
    right: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: B.border,
    paddingTop: 8,
  },
  footerLogo: {
    width: 50,
    height: 14,
    objectFit: "contain",
    opacity: 0.6,
  },
  footerText: { fontSize: 7.5, color: B.textTertiary },

  // Cover page
  coverPage: {
    padding: 0,
    backgroundColor: B.bg,
  },
  coverAccentBar: {
    height: 8,
    backgroundColor: B.accent,
  },
  coverContent: {
    paddingTop: 140,
    paddingHorizontal: 60,
    flex: 1,
  },
  coverLogo: {
    width: 140,
    height: 38,
    objectFit: "contain",
    marginBottom: 80,
  },
  coverKicker: {
    fontSize: 10,
    color: B.accent,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  coverTitle: {
    fontSize: 40,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    lineHeight: 1.1,
    letterSpacing: -1,
    marginBottom: 12,
  },
  coverSubtitle: {
    fontSize: 14,
    color: B.textSecondary,
    marginBottom: 60,
  },
  coverMeta: {
    borderTopWidth: 1,
    borderTopColor: B.border,
    paddingTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
  },
  coverMetaItem: { flexDirection: "column" },
  coverMetaLabel: {
    fontSize: 7,
    color: B.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  coverMetaValue: {
    fontSize: 11,
    color: B.textPrimary,
    fontFamily: "Helvetica-Bold",
  },
  coverFooter: {
    position: "absolute",
    bottom: 32,
    left: 60,
    right: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverFooterText: { fontSize: 8, color: B.textTertiary },

  // Anti-orphan helpers
  keepTogether: { marginBottom: 12 },
});

// ────────────────────────────────────────────────────────────────────
// Data types
// ────────────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────
function impactLabel(impact: string): string {
  if (impact === "hoog") return "Hoge impact";
  if (impact === "midden") return "Medium impact";
  return "Lage impact";
}

function formatEuro(n: number): string {
  return `€${n.toLocaleString("nl-NL")}`;
}

// ────────────────────────────────────────────────────────────────────
// Main PDF
// ────────────────────────────────────────────────────────────────────
export function MiniVoorstelPDF({ data }: { data: MiniVoorstelData }) {
  const logoUrl = getLogoDataUrl();
  const now = new Date();
  const datum = now.toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const refNumber = `AUT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const kansen = [...data.kansen].sort((a, b) => a.prioriteit - b.prioriteit);
  const detailKansen = kansen.filter((k) => k.impact === "hoog").slice(0, 3);

  return (
    <Document>
      {/* ════════════════════════════════════════════ */}
      {/* Cover — own Page, no wrap                    */}
      {/* ════════════════════════════════════════════ */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverAccentBar} />
        <View style={s.coverContent}>
          <Image src={logoUrl} style={s.coverLogo} />
          <Text style={s.coverKicker}>Automatiseringsplan</Text>
          <Text style={s.coverTitle}>{data.bedrijfsnaam}</Text>
          <Text style={s.coverSubtitle}>
            Voorstel voor automatisering &amp; workflow optimalisatie
          </Text>
          <View style={s.coverMeta}>
            <View style={s.coverMetaItem}>
              <Text style={s.coverMetaLabel}>Klant</Text>
              <Text style={s.coverMetaValue}>{data.bedrijfsnaam}</Text>
            </View>
            <View style={s.coverMetaItem}>
              <Text style={s.coverMetaLabel}>Contactpersoon</Text>
              <Text style={s.coverMetaValue}>{data.contactpersoon}</Text>
            </View>
            <View style={s.coverMetaItem}>
              <Text style={s.coverMetaLabel}>Datum</Text>
              <Text style={s.coverMetaValue}>{datum}</Text>
            </View>
            <View style={s.coverMetaItem}>
              <Text style={s.coverMetaLabel}>Referentie</Text>
              <Text style={s.coverMetaValue}>{refNumber}</Text>
            </View>
          </View>
        </View>
        <View style={s.coverFooter}>
          <Text style={s.coverFooterText}>
            Autronis — Automatisering die werkt
          </Text>
          <Text style={s.coverFooterText}>hello@autronis.com</Text>
        </View>
      </Page>

      {/* ════════════════════════════════════════════ */}
      {/* Content — ONE continuous page, React PDF     */}
      {/* auto-breaks as needed                        */}
      {/* ════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        {/* Fixed elements — re-render on every generated page */}
        <View style={s.accentBar} fixed />
        <View style={s.header} fixed>
          <Image src={logoUrl} style={s.headerLogo} />
          <View style={s.headerMeta}>
            <Text style={s.headerRef}>Ref: {refNumber}</Text>
            <Text style={s.headerDate}>{datum}</Text>
          </View>
        </View>
        <View style={s.footer} fixed>
          <Image src={logoUrl} style={s.footerLogo} />
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Autronis — Automatiseringsplan · ${pageNumber - 1}/${totalPages - 1}`
            }
          />
          <Text style={s.footerText}>{data.websiteUrl}</Text>
        </View>

        {/* ── Sectie 01 — Executive Summary ───────── */}
        <View style={s.sectionHeader} wrap={false}>
          <Text style={s.sectionNumber}>Sectie 01</Text>
          <Text style={s.sectionTitle}>Executive Summary</Text>
        </View>

        <View style={[s.card, s.cardAccent]} wrap={false}>
          <Text style={s.label}>Samenvatting</Text>
          <Text style={s.paragraph}>{data.samenvatting}</Text>
        </View>

        <View style={s.kpiGrid}>
          <View style={[s.kpiTile, s.kpiTileAccent]}>
            <Text style={[s.kpiValue, s.kpiValueAccent]}>
              {data.readinessScore}/10
            </Text>
            <Text style={s.kpiLabel}>Automation{"\n"}Readiness</Text>
          </View>
          <View style={[s.kpiTile, s.kpiTileSuccess]}>
            <Text style={[s.kpiValue, s.kpiValueSuccess]}>
              {formatEuro(data.jaarlijkseBesparing)}
            </Text>
            <Text style={s.kpiLabel}>Besparing{"\n"}per jaar</Text>
          </View>
          <View style={[s.kpiTile, s.kpiTileWarning]}>
            <Text style={[s.kpiValue, s.kpiValueWarning]}>
              {data.totaalUrenPerWeek}u
            </Text>
            <Text style={s.kpiLabel}>Tijdwinst{"\n"}per week</Text>
          </View>
          <View style={s.kpiTile}>
            <Text style={s.kpiValue}>{kansen.length}</Text>
            <Text style={s.kpiLabel}>
              Automatiseringen{"\n"}geïdentificeerd
            </Text>
          </View>
          <View style={s.kpiTile}>
            <Text style={s.kpiValue}>~{data.terugverdientijdMaanden} mnd</Text>
            <Text style={s.kpiLabel}>Terugverdientijd</Text>
          </View>
          <View style={s.kpiTile}>
            <Text style={s.kpiValue}>{data.aanbevolenPakket}</Text>
            <Text style={s.kpiLabel}>Aanbevolen{"\n"}pakket</Text>
          </View>
        </View>

        <View style={s.card} wrap={false}>
          <Text style={s.label}>Wat dit document bevat</Text>
          <Text style={s.paragraph}>
            Dit voorstel beschrijft de automatiseringskansen die wij voor{" "}
            <Text style={s.strong}>{data.bedrijfsnaam}</Text> hebben
            geïdentificeerd, hoe wij deze gaan implementeren, de geschatte
            investering en de terugverdientijd. Het eindigt met concrete
            volgende stappen.
          </Text>
        </View>

        {/* ── Sectie 02 — Automatiseringskansen ───── */}
        <View style={s.sectionHeader} wrap={false} minPresenceAhead={120}>
          <Text style={s.sectionNumber}>Sectie 02</Text>
          <Text style={s.sectionTitle}>Automatiseringskansen</Text>
        </View>

        <Text style={s.paragraph}>
          Op basis van onze analyse hebben wij{" "}
          <Text style={s.strong}>{kansen.length}</Text> automatiseringskansen
          geïdentificeerd, gerangschikt naar prioriteit en impact. De top 3
          kansen met de hoogste impact worden hieronder in detail toegelicht.
        </Text>

        {kansen.map((kans, i) => (
          <View key={i} style={s.kansRow} wrap={false}>
            <Text style={s.kansPrio}>#{kans.prioriteit}</Text>
            <View style={s.kansContent}>
              <Text style={s.kansTitel}>{kans.titel}</Text>
              <Text style={s.kansBeschrijving}>{kans.beschrijving}</Text>
            </View>
            <Text
              style={[s.kansImpact, { color: brandImpactKleur(kans.impact) }]}
            >
              {impactLabel(kans.impact)}
            </Text>
          </View>
        ))}

        {/* ── Top 3 kansen in detail (inline blocks, not own pages) ── */}
        {detailKansen.length > 0 && (
          <View style={s.sectionHeader} wrap={false} minPresenceAhead={200}>
            <Text style={s.sectionNumber}>Sectie 02 — Verdieping</Text>
            <Text style={s.sectionTitle}>Top {detailKansen.length} kansen uitgelicht</Text>
          </View>
        )}

        {detailKansen.map((kans, idx) => (
          <View key={`detail-${idx}`} style={s.kansDetailBlock} wrap={false}>
            <View style={s.kansDetailHeader}>
              <Text style={s.kansDetailTitle}>
                #{kans.prioriteit} · {kans.titel}
              </Text>
              <Text
                style={[
                  s.kansDetailBadge,
                  { color: brandImpactKleur(kans.impact) },
                ]}
              >
                {impactLabel(kans.impact)}
              </Text>
            </View>
            <Text style={s.paragraph}>{kans.beschrijving}</Text>
            <View style={s.kansDetailMetrics}>
              <View style={s.kansMetricItem}>
                <Text style={s.kansMetricLabel}>Tijdsbesparing</Text>
                <Text style={s.kansMetricValue}>
                  {kans.geschatteTijdsbesparing || "—"}
                </Text>
              </View>
              <View style={s.kansMetricItem}>
                <Text style={s.kansMetricLabel}>Besparing</Text>
                <Text style={[s.kansMetricValue, { color: B.success }]}>
                  {kans.geschatteBesparing || "—"}
                </Text>
              </View>
              <View style={s.kansMetricItem}>
                <Text style={s.kansMetricLabel}>Doorlooptijd</Text>
                <Text style={s.kansMetricValue}>2-4 weken</Text>
              </View>
            </View>
          </View>
        ))}

        {/* ── Sectie 03 — Aanpak & tech stack ─────── */}
        <View style={s.sectionHeader} wrap={false} minPresenceAhead={180}>
          <Text style={s.sectionNumber}>Sectie 03</Text>
          <Text style={s.sectionTitle}>Aanpak &amp; technologie</Text>
        </View>

        <Text style={s.paragraph}>
          Autronis bouwt automatiseringen met een bewezen, lichtgewicht stack die
          snel resultaat oplevert en door elk klein tot middelgroot team beheerd
          kan worden. Wij onderhouden alles tijdens de looptijd — u heeft er
          geen eigen development team voor nodig.
        </Text>

        <View style={s.card} wrap={false}>
          <Text style={s.label}>Onze technologie stack</Text>
          <View style={s.techRow}>
            <Text style={s.techComponent}>n8n</Text>
            <Text style={s.techDescription}>
              Open-source workflow orchestrator — verbindt APIs, databases en
              services. Flexibel, self-hosted, geen vendor lock-in.
            </Text>
          </View>
          <View style={s.techRow}>
            <Text style={s.techComponent}>Claude API</Text>
            <Text style={s.techDescription}>
              AI van Anthropic voor taken die intelligentie vereisen — tekst
              classificeren, samenvatten, content genereren, beslissingen op
              natuurlijke taal input.
            </Text>
          </View>
          <View style={s.techRow}>
            <Text style={s.techComponent}>Supabase</Text>
            <Text style={s.techDescription}>
              Beveiligde PostgreSQL database met realtime updates. Voor het
              opslaan en querien van alle data die door de automatiseringen
              stroomt.
            </Text>
          </View>
          <View style={s.techRow}>
            <Text style={s.techComponent}>Integraties</Text>
            <Text style={s.techDescription}>
              Koppelingen naar uw bestaande systemen via REST APIs, webhooks of
              directe database connecties. Alle verbindingen encrypted.
            </Text>
          </View>
        </View>

        <View style={[s.card, s.cardSuccess]} wrap={false}>
          <Text style={s.label}>Onze werkwijze</Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Kickoff (week 1):</Text> technische intake,
            toegang tot systemen, requirements bevestigen.
          </Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Bouw (week 2-3):</Text> automatiseringen
            worden gebouwd en getest. U ziet wekelijks voortgang.
          </Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Live (week 4):</Text> go-live, monitoring,
            hand-over documentatie. Binnen een maand volledig operationeel.
          </Text>
        </View>

        {/* ── Sectie 04 — Investering & ROI ───────── */}
        <View style={s.sectionHeader} wrap={false} minPresenceAhead={200}>
          <Text style={s.sectionNumber}>Sectie 04</Text>
          <Text style={s.sectionTitle}>Investering &amp; ROI</Text>
        </View>

        <Text style={s.paragraph}>
          Op basis van de geïdentificeerde kansen adviseren wij het{" "}
          <Text style={s.strong}>{data.aanbevolenPakket}</Text>-pakket. De
          investering verdient zich terug door tijdwinst en reductie van
          handmatige fouten.
        </Text>

        <View style={s.kpiGrid}>
          <View style={[s.kpiTile, s.kpiTileHalf, s.kpiTileAccent]}>
            <Text style={[s.kpiValue, s.kpiValueAccent]}>
              {formatEuro(data.geschatteInvestering)}
            </Text>
            <Text style={s.kpiLabel}>Eenmalige{"\n"}investering</Text>
          </View>
          <View style={[s.kpiTile, s.kpiTileHalf, s.kpiTileSuccess]}>
            <Text style={[s.kpiValue, s.kpiValueSuccess]}>
              {formatEuro(data.jaarlijkseBesparing)}
            </Text>
            <Text style={s.kpiLabel}>Jaarlijkse{"\n"}besparing</Text>
          </View>
          <View style={[s.kpiTile, s.kpiTileHalf, s.kpiTileWarning]}>
            <Text style={[s.kpiValue, s.kpiValueWarning]}>
              ~{data.terugverdientijdMaanden} mnd
            </Text>
            <Text style={s.kpiLabel}>Terugverdientijd</Text>
          </View>
          <View style={[s.kpiTile, s.kpiTileHalf]}>
            <Text style={s.kpiValue}>
              {data.jaarlijkseBesparing > 0
                ? `${Math.round(
                    (data.jaarlijkseBesparing /
                      Math.max(data.geschatteInvestering, 1)) *
                      100
                  )}%`
                : "—"}
            </Text>
            <Text style={s.kpiLabel}>ROI{"\n"}eerste jaar</Text>
          </View>
        </View>

        <View style={[s.card, s.cardAccent]} wrap={false}>
          <Text style={s.label}>Wat zit er in het pakket</Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Analyse &amp; design</Text> — volledige
            requirements sessie, architectuur uitwerken, integratie plan.
          </Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Bouw &amp; implementatie</Text> — alle
            genoemde automations gebouwd, getest, gedocumenteerd.
          </Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Go-live begeleiding</Text> — we staan 2 weken
            na launch standby voor aanpassingen en monitoring.
          </Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Hand-over documentatie</Text> — uw team
            krijgt complete documentatie en kan zelfstandig onderhoud doen
            (of Autronis blijft inhuren).
          </Text>
        </View>

        <View style={[s.card, s.cardSuccess]} wrap={false}>
          <Text style={s.label}>Rekenvoorbeeld</Text>
          <Text style={s.paragraph}>
            Bij een investering van{" "}
            <Text style={s.strong}>{formatEuro(data.geschatteInvestering)}</Text>{" "}
            en een maandelijkse besparing van ongeveer{" "}
            <Text style={s.strong}>
              {formatEuro(Math.round(data.jaarlijkseBesparing / 12))}
            </Text>
            , bent u na ~{data.terugverdientijdMaanden} maanden op break-even.
            Elke besparing daarna is pure winst.
          </Text>
        </View>

        {/* ── Sectie 05 — Volgende stappen ────────── */}
        <View style={s.sectionHeader} wrap={false} minPresenceAhead={260}>
          <Text style={s.sectionNumber}>Sectie 05</Text>
          <Text style={s.sectionTitle}>Volgende stappen</Text>
        </View>

        <View style={s.stepRow} wrap={false}>
          <Text style={s.stepNumber}>1</Text>
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Intake gesprek (30 min, gratis)</Text>
            <Text style={s.stepDesc}>
              We bespreken dit voorstel, uw vragen, en stemmen de scope
              definitief af. Daarna beslist u of we doorgaan.
            </Text>
          </View>
        </View>
        <View style={s.stepRow} wrap={false}>
          <Text style={s.stepNumber}>2</Text>
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Contract &amp; kickoff</Text>
            <Text style={s.stepDesc}>
              Eenvoudige project-overeenkomst, kickoff binnen één week. U krijgt
              toegang tot een gedeelde project omgeving om voortgang te volgen.
            </Text>
          </View>
        </View>
        <View style={s.stepRow} wrap={false}>
          <Text style={s.stepNumber}>3</Text>
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Bouw &amp; wekelijkse demo</Text>
            <Text style={s.stepDesc}>
              We bouwen iteratief met wekelijkse check-ins. U ziet elke week
              wat er af is en kan bijsturen.
            </Text>
          </View>
        </View>
        <View style={s.stepRow} wrap={false}>
          <Text style={s.stepNumber}>4</Text>
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Go-live &amp; hand-over</Text>
            <Text style={s.stepDesc}>
              Productie launch, monitoring, documentatie. Na go-live blijven we
              2 weken standby voor eventuele aanpassingen.
            </Text>
          </View>
        </View>

        <View style={s.cta} wrap={false}>
          <Text style={s.ctaTitle}>Klaar om te starten?</Text>
          <Text style={s.ctaText}>
            Plan een gratis gesprek:{" "}
            {data.bookingUrl ?? "https://cal.com/autronis"}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
