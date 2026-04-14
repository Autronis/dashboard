import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { AutronisBrand, impactKleur as brandImpactKleur } from "@/lib/autronis-brand";
import { getLogoDataUrl } from "@/lib/autronis-logo";

// Sales Engine — Mini-voorstel PDF
// Visually aligned with the scope-generator skill template (template.html):
//   - Autronis logo on cover + footer of every page
//   - Teal accent line (top) instead of border-bottom under headers
//   - Sectie-nummering (Sectie 01, 02, ...) like the full scope plan
//   - KPI tile grid with accent / success variants
//   - Light background, consistent typography hierarchy
//
// This is intentionally shorter than the full scope plan (2 pages vs 13)
// because it's a single-page teaser. The brand/look is identical.
const B = AutronisBrand;

const s = StyleSheet.create({
  // ── Page shell ─────────────────────────────────
  page: {
    paddingTop: 36,
    paddingBottom: 60,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: B.textPrimary,
    backgroundColor: B.bg,
  },

  // ── Top accent bar ─────────────────────────────
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: B.accent,
  },

  // ── Header (logo left, metadata right) ─────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  headerLeft: {
    flexDirection: "column",
  },
  logo: {
    width: 72,
    height: 20,
    objectFit: "contain",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  reference: {
    fontSize: 8,
    color: B.textTertiary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  datum: {
    fontSize: 9,
    color: B.textSecondary,
    marginTop: 2,
  },

  // ── Cover-style title block ────────────────────
  titleBlock: {
    marginBottom: 28,
  },
  kicker: {
    fontSize: 9,
    color: B.accent,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  companyName: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 1.1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: B.textSecondary,
  },

  // ── Section header (Sectie XX — title) ─────────
  sectionHeader: {
    marginTop: 20,
    marginBottom: 14,
  },
  sectionNumber: {
    fontSize: 8,
    color: B.accent,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    letterSpacing: -0.2,
  },

  // ── Content card ───────────────────────────────
  card: {
    backgroundColor: B.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: B.border,
    padding: 16,
    marginBottom: 14,
  },
  cardAccent: {
    borderLeftWidth: 4,
    borderLeftColor: B.accent,
  },
  cardText: {
    fontSize: 10,
    color: B.textSecondary,
    lineHeight: 1.6,
  },

  // ── KPI grid ───────────────────────────────────
  kpiGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  kpiTile: {
    flex: 1,
    backgroundColor: B.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: B.border,
    padding: 14,
    alignItems: "center",
  },
  kpiTileAccent: {
    borderLeftWidth: 4,
    borderLeftColor: B.accent,
  },
  kpiTileSuccess: {
    borderLeftWidth: 4,
    borderLeftColor: B.success,
  },
  kpiValue: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    marginBottom: 4,
  },
  kpiValueAccent: {
    color: B.accent,
  },
  kpiValueSuccess: {
    color: B.success,
  },
  kpiLabel: {
    fontSize: 8,
    color: B.textTertiary,
    textAlign: "center",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  // ── Kansen list ────────────────────────────────
  kansRow: {
    flexDirection: "row",
    padding: 10,
    marginBottom: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: B.border,
    backgroundColor: B.card,
  },
  kansPriority: {
    width: 22,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: B.accent,
  },
  kansContent: {
    flex: 1,
  },
  kansTitel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    marginBottom: 3,
  },
  kansBeschrijving: {
    fontSize: 8.5,
    color: B.textSecondary,
    lineHeight: 1.45,
  },
  kansImpact: {
    width: 60,
    textAlign: "right",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // ── CTA ────────────────────────────────────────
  cta: {
    marginTop: 18,
    padding: 18,
    backgroundColor: B.accent,
    borderRadius: 10,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: B.textOnAccent,
    marginBottom: 4,
  },
  ctaSubtext: {
    fontSize: 10,
    color: B.accentLight,
  },

  // ── Footer ─────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: B.border,
    paddingTop: 10,
  },
  footerLogo: {
    width: 52,
    height: 14,
    objectFit: "contain",
    opacity: 0.6,
  },
  footerCenter: {
    fontSize: 7.5,
    color: B.textTertiary,
  },
  footerRight: {
    fontSize: 7.5,
    color: B.textTertiary,
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

function impactLabel(impact: string): string {
  if (impact === "hoog") return "Hoge impact";
  if (impact === "midden") return "Medium";
  return "Laag";
}

export function MiniVoorstelPDF({ data }: { data: MiniVoorstelData }) {
  const logoUrl = getLogoDataUrl();
  const datum = new Date().toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const now = new Date();
  const refNumber = `AUT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const topKansen = data.kansen.sort((a, b) => a.prioriteit - b.prioriteit).slice(0, 5);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Teal accent bar across the top */}
        <View style={s.accentBar} fixed />

        {/* Header: logo + reference */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Image src={logoUrl} style={s.logo} />
          </View>
          <View style={s.headerRight}>
            <Text style={s.reference}>Ref: {refNumber}</Text>
            <Text style={s.datum}>{datum}</Text>
          </View>
        </View>

        {/* Cover-style title block */}
        <View style={s.titleBlock}>
          <Text style={s.kicker}>Mini-voorstel · Automatisering</Text>
          <Text style={s.companyName}>{data.bedrijfsnaam}</Text>
          <Text style={s.subtitle}>Automatiseringsanalyse &amp; voorstel voor {data.contactpersoon}</Text>
        </View>

        {/* Sectie 01 — Samenvatting */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionNumber}>Sectie 01</Text>
          <Text style={s.sectionTitle}>Samenvatting</Text>
        </View>
        <View style={[s.card, s.cardAccent]}>
          <Text style={s.cardText}>Beste {data.contactpersoon},</Text>
          <Text style={[s.cardText, { marginTop: 6 }]}>{data.samenvatting}</Text>
        </View>

        {/* KPI grid — mirrors scope-generator Executive Summary */}
        <View style={s.kpiGrid}>
          <View style={[s.kpiTile, s.kpiTileAccent]}>
            <Text style={[s.kpiValue, s.kpiValueAccent]}>{data.readinessScore}/10</Text>
            <Text style={s.kpiLabel}>Automation Readiness</Text>
          </View>
          <View style={[s.kpiTile, s.kpiTileSuccess]}>
            <Text style={[s.kpiValue, s.kpiValueSuccess]}>
              €{data.jaarlijkseBesparing.toLocaleString("nl-NL")}
            </Text>
            <Text style={s.kpiLabel}>Besparing / jaar</Text>
          </View>
          <View style={s.kpiTile}>
            <Text style={s.kpiValue}>{data.totaalUrenPerWeek}u/week</Text>
            <Text style={s.kpiLabel}>Tijdwinst</Text>
          </View>
          <View style={s.kpiTile}>
            <Text style={s.kpiValue}>~{data.terugverdientijdMaanden} mnd</Text>
            <Text style={s.kpiLabel}>Terugverdientijd</Text>
          </View>
        </View>

        {/* Sectie 02 — Kansen */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionNumber}>Sectie 02</Text>
          <Text style={s.sectionTitle}>Top {topKansen.length} automatiseringskansen</Text>
        </View>
        {topKansen.map((kans, i) => (
          <View key={i} style={s.kansRow}>
            <Text style={s.kansPriority}>#{kans.prioriteit}</Text>
            <View style={s.kansContent}>
              <Text style={s.kansTitel}>{kans.titel}</Text>
              <Text style={s.kansBeschrijving}>{kans.beschrijving}</Text>
            </View>
            <Text style={[s.kansImpact, { color: brandImpactKleur(kans.impact) }]}>
              {impactLabel(kans.impact)}
            </Text>
          </View>
        ))}

        {/* Sectie 03 — Investering */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionNumber}>Sectie 03</Text>
          <Text style={s.sectionTitle}>Investering &amp; pakket</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardText}>
            Op basis van onze analyse raden wij het <Text style={{ fontFamily: "Helvetica-Bold", color: B.textPrimary }}>{data.aanbevolenPakket}</Text>-pakket aan
            met een geschatte investering van <Text style={{ fontFamily: "Helvetica-Bold", color: B.textPrimary }}>€{data.geschatteInvestering.toLocaleString("nl-NL")}</Text>.
            Met een jaarlijkse besparing van €{data.jaarlijkseBesparing.toLocaleString("nl-NL")} verdient
            u deze investering terug in ongeveer {data.terugverdientijdMaanden} maanden.
          </Text>
        </View>

        {/* CTA */}
        <View style={s.cta}>
          <Text style={s.ctaText}>Interesse? Plan een gratis gesprek</Text>
          <Text style={s.ctaSubtext}>{data.bookingUrl ?? "https://cal.com/autronis"}</Text>
        </View>

        {/* Footer with small logo */}
        <View style={s.footer} fixed>
          <Image src={logoUrl} style={s.footerLogo} />
          <Text style={s.footerCenter}>Autronis — Automatisering die werkt</Text>
          <Text style={s.footerRight}>{data.websiteUrl}</Text>
        </View>
      </Page>
    </Document>
  );
}
