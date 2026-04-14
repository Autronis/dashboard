import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { AutronisBrand, impactKleur as brandImpactKleur } from "@/lib/autronis-brand";
import { getLogoDataUrl } from "@/lib/autronis-logo";

// ═══════════════════════════════════════════════════════════════════
// Sales Engine — Voorstel PDF
// Multi-page document visually aligned with the scope-generator skill
// template.html. Each section lives on its own <Page> so the footer
// always sits at the bottom of its page (no overflow, no overlap).
//
// Structure:
//   1. Cover                       (logo, titel, klant, datum)
//   2. Executive Summary           (samenvatting + 5 KPI tiles)
//   3. Automatiseringskansen       (overzicht tabel van alle kansen)
//   4..N. Per-kans detail          (één pagina per hoge-impact kans)
//   N+1. Aanpak & tech stack
//   N+2. Investering & ROI
//   N+3. Volgende stappen + contact
// ═══════════════════════════════════════════════════════════════════

const B = AutronisBrand;

// ────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // ── Base page ─────────────────────────────────
  page: {
    paddingTop: 44,
    paddingBottom: 64,
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

  // ── Header ─────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
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

  // ── Section kicker + title ─────────────────────
  sectionHeader: { marginBottom: 18 },
  sectionNumber: {
    fontSize: 8,
    color: B.accent,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    letterSpacing: -0.4,
    lineHeight: 1.15,
  },

  // ── Typography ─────────────────────────────────
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

  // ── Card ───────────────────────────────────────
  card: {
    backgroundColor: B.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: B.border,
    padding: 16,
    marginBottom: 14,
  },
  cardAccent: { borderLeftWidth: 4, borderLeftColor: B.accent },
  cardSuccess: { borderLeftWidth: 4, borderLeftColor: B.success },
  cardWarning: { borderLeftWidth: 4, borderLeftColor: B.warning },

  // ── KPI grid ───────────────────────────────────
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  kpiTile: {
    flexBasis: "31.5%",
    backgroundColor: B.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: B.border,
    padding: 16,
    alignItems: "center",
  },
  kpiTileSmall: {
    flexBasis: "48%",
  },
  kpiTileAccent: { borderLeftWidth: 4, borderLeftColor: B.accent },
  kpiTileSuccess: { borderLeftWidth: 4, borderLeftColor: B.success },
  kpiTileWarning: { borderLeftWidth: 4, borderLeftColor: B.warning },
  kpiValue: {
    fontSize: 22,
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

  // ── Kansen overzicht rij ───────────────────────
  kansRow: {
    flexDirection: "row",
    padding: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: B.border,
    backgroundColor: B.card,
  },
  kansPrio: {
    width: 28,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: B.accent,
  },
  kansContent: { flex: 1 },
  kansTitel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    marginBottom: 3,
  },
  kansBeschrijving: {
    fontSize: 9,
    color: B.textSecondary,
    lineHeight: 1.5,
  },
  kansImpact: {
    width: 72,
    textAlign: "right",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // ── Kans detail page ───────────────────────────
  kansDetailTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  kansDetailSubtitle: {
    fontSize: 10,
    color: B.accent,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  kansDetailMetrics: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  kansDetailMetric: {
    flex: 1,
    backgroundColor: B.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: B.border,
    padding: 12,
  },

  // ── Tech stack row ─────────────────────────────
  techRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: B.borderLight,
  },
  techComponent: {
    width: 120,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
  },
  techDescription: {
    flex: 1,
    fontSize: 9,
    color: B.textSecondary,
    lineHeight: 1.5,
  },

  // ── Next steps ─────────────────────────────────
  stepRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: B.accent,
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 7,
    marginRight: 12,
  },
  stepContent: { flex: 1 },
  stepTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: B.textPrimary,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 9,
    color: B.textSecondary,
    lineHeight: 1.45,
  },

  // ── CTA block ──────────────────────────────────
  cta: {
    marginTop: 18,
    padding: 22,
    backgroundColor: B.accent,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: B.textOnAccent,
    marginBottom: 4,
  },
  ctaText: { fontSize: 11, color: B.accentLight },

  // ── Footer ─────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 24,
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
  footerCenter: { fontSize: 7.5, color: B.textTertiary },
  footerRight: { fontSize: 7.5, color: B.textTertiary },

  // ── Cover ──────────────────────────────────────
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
  coverMetaValue: { fontSize: 11, color: B.textPrimary, fontFamily: "Helvetica-Bold" },
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
// Reusable components
// ────────────────────────────────────────────────────────────────────
function Header({
  logoUrl,
  refNumber,
  date,
}: {
  logoUrl: string;
  refNumber: string;
  date: string;
}) {
  return (
    <View style={s.header}>
      <Image src={logoUrl} style={s.headerLogo} />
      <View style={s.headerMeta}>
        <Text style={s.headerRef}>Ref: {refNumber}</Text>
        <Text style={s.headerDate}>{date}</Text>
      </View>
    </View>
  );
}

function Footer({
  logoUrl,
  clientWebsite,
  pageNr,
  totalPages,
}: {
  logoUrl: string;
  clientWebsite: string;
  pageNr: number;
  totalPages: number;
}) {
  return (
    <View style={s.footer} fixed>
      <Image src={logoUrl} style={s.footerLogo} />
      <Text style={s.footerCenter}>
        Autronis — Automatiseringsplan · {pageNr}/{totalPages}
      </Text>
      <Text style={s.footerRight}>{clientWebsite}</Text>
    </View>
  );
}

function SectionHeader({ nummer, title }: { nummer: string; title: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionNumber}>Sectie {nummer}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
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
  // Only hoge-impact kansen get their own detail page.
  const detailKansen = kansen.filter((k) => k.impact === "hoog").slice(0, 4);

  // Page counting — used in footer "X/Y". Cover = no number, so page 1 starts
  // at the executive summary.
  const numDetailPages = detailKansen.length;
  const totalNumberedPages = 2 /* exec + overview */ + numDetailPages + 3; /* aanpak, investering, next */
  let currentPage = 0;
  const nextPage = () => ++currentPage;

  return (
    <Document>
      {/* ══════════════════════════════════════════════════════ */}
      {/* Page 1: Cover                                          */}
      {/* ══════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverAccentBar} />
        <View style={s.coverContent}>
          <Image src={logoUrl} style={s.coverLogo} />
          <Text style={s.coverKicker}>Automatiseringsplan</Text>
          <Text style={s.coverTitle}>{data.bedrijfsnaam}</Text>
          <Text style={s.coverSubtitle}>
            Voorstel voor automatisering & workflow optimalisatie
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
          <Text style={s.coverFooterText}>Autronis — Automatisering die werkt</Text>
          <Text style={s.coverFooterText}>hello@autronis.com</Text>
        </View>
      </Page>

      {/* ══════════════════════════════════════════════════════ */}
      {/* Page 2: Executive Summary                              */}
      {/* ══════════════════════════════════════════════════════ */}
      {(() => { const pn = nextPage(); return (
      <Page size="A4" style={s.page}>
        <View style={s.accentBar} fixed />
        <Header logoUrl={logoUrl} refNumber={refNumber} date={datum} />
        <SectionHeader nummer="01" title="Executive Summary" />

        <View style={[s.card, s.cardAccent]}>
          <Text style={s.label}>Samenvatting</Text>
          <Text style={s.paragraph}>{data.samenvatting}</Text>
        </View>

        <View style={s.kpiGrid}>
          <View style={[s.kpiTile, s.kpiTileAccent]}>
            <Text style={[s.kpiValue, s.kpiValueAccent]}>{data.readinessScore}/10</Text>
            <Text style={s.kpiLabel}>Automation{"\n"}Readiness</Text>
          </View>
          <View style={[s.kpiTile, s.kpiTileSuccess]}>
            <Text style={[s.kpiValue, s.kpiValueSuccess]}>
              {formatEuro(data.jaarlijkseBesparing)}
            </Text>
            <Text style={s.kpiLabel}>Besparing{"\n"}per jaar</Text>
          </View>
          <View style={[s.kpiTile, s.kpiTileWarning]}>
            <Text style={[s.kpiValue, s.kpiValueWarning]}>{data.totaalUrenPerWeek}u</Text>
            <Text style={s.kpiLabel}>Tijdwinst{"\n"}per week</Text>
          </View>
          <View style={s.kpiTile}>
            <Text style={s.kpiValue}>{kansen.length}</Text>
            <Text style={s.kpiLabel}>Automatiseringen{"\n"}geïdentificeerd</Text>
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

        <View style={s.card}>
          <Text style={s.label}>Wat dit document bevat</Text>
          <Text style={s.paragraph}>
            Dit voorstel beschrijft de automatiseringskansen die wij voor{" "}
            <Text style={s.strong}>{data.bedrijfsnaam}</Text> hebben geïdentificeerd,
            hoe wij deze gaan implementeren, de geschatte investering en de
            terugverdientijd. Het eindigt met concrete volgende stappen zodat
            u direct kan beslissen.
          </Text>
        </View>

        <Footer
          logoUrl={logoUrl}
          clientWebsite={data.websiteUrl}
          pageNr={pn}
          totalPages={totalNumberedPages}
        />
      </Page>
      ); })()}

      {/* ══════════════════════════════════════════════════════ */}
      {/* Page 3: Kansen overzicht (alle kansen, kort)           */}
      {/* ══════════════════════════════════════════════════════ */}
      {(() => { const pn = nextPage(); return (
      <Page size="A4" style={s.page}>
        <View style={s.accentBar} fixed />
        <Header logoUrl={logoUrl} refNumber={refNumber} date={datum} />
        <SectionHeader nummer="02" title="Automatiseringskansen" />

        <Text style={s.paragraph}>
          Op basis van onze analyse hebben wij <Text style={s.strong}>{kansen.length}</Text>{" "}
          automatiseringskansen geïdentificeerd, gerangschikt naar prioriteit en impact.
          De hoge-impact kansen worden op de volgende pagina&apos;s in detail toegelicht.
        </Text>

        {kansen.map((kans, i) => (
          <View key={i} style={s.kansRow} wrap={false}>
            <Text style={s.kansPrio}>#{kans.prioriteit}</Text>
            <View style={s.kansContent}>
              <Text style={s.kansTitel}>{kans.titel}</Text>
              <Text style={s.kansBeschrijving}>{kans.beschrijving}</Text>
            </View>
            <Text style={[s.kansImpact, { color: brandImpactKleur(kans.impact) }]}>
              {impactLabel(kans.impact)}
            </Text>
          </View>
        ))}

        <Footer
          logoUrl={logoUrl}
          clientWebsite={data.websiteUrl}
          pageNr={pn}
          totalPages={totalNumberedPages}
        />
      </Page>
      ); })()}

      {/* ══════════════════════════════════════════════════════ */}
      {/* Page 4..N: One page per high-impact opportunity        */}
      {/* ══════════════════════════════════════════════════════ */}
      {detailKansen.map((kans, idx) => {
        const pn = nextPage();
        return (
          <Page key={`detail-${idx}`} size="A4" style={s.page}>
            <View style={s.accentBar} fixed />
            <Header logoUrl={logoUrl} refNumber={refNumber} date={datum} />

            <View style={s.sectionHeader}>
              <Text style={s.sectionNumber}>
                Sectie 02 — Kans #{kans.prioriteit}
              </Text>
              <Text style={s.sectionTitle}>{kans.titel}</Text>
            </View>

            <View style={[s.card, s.cardAccent]}>
              <Text style={s.label}>Wat we gaan automatiseren</Text>
              <Text style={s.paragraph}>{kans.beschrijving}</Text>
            </View>

            <View style={s.kansDetailMetrics}>
              <View style={s.kansDetailMetric}>
                <Text style={s.label}>Impact</Text>
                <Text
                  style={[
                    s.kpiValue,
                    { color: brandImpactKleur(kans.impact), fontSize: 16 },
                  ]}
                >
                  {impactLabel(kans.impact)}
                </Text>
              </View>
              <View style={s.kansDetailMetric}>
                <Text style={s.label}>Tijdsbesparing</Text>
                <Text style={[s.kpiValue, { fontSize: 16 }]}>
                  {kans.geschatteTijdsbesparing || "—"}
                </Text>
              </View>
              <View style={s.kansDetailMetric}>
                <Text style={s.label}>Besparing</Text>
                <Text
                  style={[
                    s.kpiValue,
                    { color: B.success, fontSize: 16 },
                  ]}
                >
                  {kans.geschatteBesparing || "—"}
                </Text>
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.label}>Aanpak</Text>
              <Text style={s.paragraph}>
                Autronis implementeert deze automatisering met onze standaard tech stack
                — <Text style={s.strong}>n8n</Text> voor de workflow orchestration,{" "}
                <Text style={s.strong}>Claude API</Text> voor intelligente beslissingen,{" "}
                en <Text style={s.strong}>Supabase</Text> voor dataopslag. De integratie
                met uw bestaande systemen verloopt via beveiligde API koppelingen.
              </Text>
              <Text style={s.paragraph}>
                <Text style={s.strong}>Doorlooptijd:</Text> ~2-4 weken van kickoff tot
                live, inclusief testing en hand-over. De eerste resultaten ziet u al na
                week 1.
              </Text>
            </View>

            <Footer
              logoUrl={logoUrl}
              clientWebsite={data.websiteUrl}
              pageNr={pn}
              totalPages={totalNumberedPages}
            />
          </Page>
        );
      })}

      {/* ══════════════════════════════════════════════════════ */}
      {/* Aanpak & tech stack                                    */}
      {/* ══════════════════════════════════════════════════════ */}
      {(() => { const pn = nextPage(); return (
      <Page size="A4" style={s.page}>
        <View style={s.accentBar} fixed />
        <Header logoUrl={logoUrl} refNumber={refNumber} date={datum} />
        <SectionHeader nummer="03" title="Aanpak & technologie" />

        <Text style={s.paragraph}>
          Autronis bouwt automatiseringen met een bewezen, lichtgewicht stack die
          snel resultaat oplevert en door elk klein tot middelgroot team beheerd
          kan worden. Wij onderhouden alles tijdens de looptijd, u heeft er geen
          development team voor nodig.
        </Text>

        <View style={s.card}>
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
              AI van Anthropic voor taken die intelligentie vereisen —
              tekstclassificatie, samenvatten, content genereren, beslissingen
              nemen op natuurlijke taal input.
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

        <View style={[s.card, s.cardSuccess]}>
          <Text style={s.label}>Onze werkwijze</Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Kickoff (week 1):</Text> technische intake,
            toegang tot systemen, requirements bevestigen.
          </Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Bouw (week 2-3):</Text> automatisering wordt
            gebouwd en getest. Iteratieve demo&apos;s, u ziet wekelijks voortgang.
          </Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Live (week 4):</Text> go-live, monitoring,
            hand-over documentatie. Binnen een maand volledig operationeel.
          </Text>
        </View>

        <Footer
          logoUrl={logoUrl}
          clientWebsite={data.websiteUrl}
          pageNr={pn}
          totalPages={totalNumberedPages}
        />
      </Page>
      ); })()}

      {/* ══════════════════════════════════════════════════════ */}
      {/* Investering & ROI                                      */}
      {/* ══════════════════════════════════════════════════════ */}
      {(() => { const pn = nextPage(); return (
      <Page size="A4" style={s.page}>
        <View style={s.accentBar} fixed />
        <Header logoUrl={logoUrl} refNumber={refNumber} date={datum} />
        <SectionHeader nummer="04" title="Investering & ROI" />

        <Text style={s.paragraph}>
          Op basis van de geïdentificeerde kansen adviseren wij het{" "}
          <Text style={s.strong}>{data.aanbevolenPakket}</Text>-pakket. De
          investering verdient zich terug door tijdwinst en reductie van
          handmatige fouten.
        </Text>

        <View style={s.kpiGrid}>
          <View style={[s.kpiTile, s.kpiTileSmall, s.kpiTileAccent]}>
            <Text style={[s.kpiValue, s.kpiValueAccent]}>
              {formatEuro(data.geschatteInvestering)}
            </Text>
            <Text style={s.kpiLabel}>Eenmalige{"\n"}investering</Text>
          </View>
          <View style={[s.kpiTile, s.kpiTileSmall, s.kpiTileSuccess]}>
            <Text style={[s.kpiValue, s.kpiValueSuccess]}>
              {formatEuro(data.jaarlijkseBesparing)}
            </Text>
            <Text style={s.kpiLabel}>Jaarlijkse{"\n"}besparing</Text>
          </View>
          <View style={[s.kpiTile, s.kpiTileSmall, s.kpiTileWarning]}>
            <Text style={[s.kpiValue, s.kpiValueWarning]}>
              ~{data.terugverdientijdMaanden} mnd
            </Text>
            <Text style={s.kpiLabel}>Terugverdientijd</Text>
          </View>
          <View style={[s.kpiTile, s.kpiTileSmall]}>
            <Text style={s.kpiValue}>
              {data.jaarlijkseBesparing > 0
                ? `${Math.round((data.jaarlijkseBesparing / Math.max(data.geschatteInvestering, 1)) * 100)}%`
                : "—"}
            </Text>
            <Text style={s.kpiLabel}>ROI{"\n"}eerste jaar</Text>
          </View>
        </View>

        <View style={[s.card, s.cardAccent]}>
          <Text style={s.label}>Wat zit er in het pakket</Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Analyse & design</Text> — volledige requirements sessie,
            architectuur uitwerken, integratie plan.
          </Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Bouw & implementatie</Text> — alle genoemde automations
            gebouwd, getest, en gedocumenteerd.
          </Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Go-live begeleiding</Text> — we staan 2 weken na launch
            standby voor aanpassingen en monitoring.
          </Text>
          <Text style={s.paragraph}>
            <Text style={s.strong}>Hand-over documentatie</Text> — uw team krijgt exacte
            documentatie en kan zelfstandig onderhoud doen (of Autronis blijft inhuren).
          </Text>
        </View>

        <View style={[s.card, s.cardSuccess]}>
          <Text style={s.label}>Rekenvoorbeeld</Text>
          <Text style={s.paragraph}>
            Bij een investering van{" "}
            <Text style={s.strong}>{formatEuro(data.geschatteInvestering)}</Text> en een
            maandelijkse besparing van ongeveer{" "}
            <Text style={s.strong}>
              {formatEuro(Math.round(data.jaarlijkseBesparing / 12))}
            </Text>
            , bent u na ~{data.terugverdientijdMaanden} maanden op break-even en is elke
            besparing daarna pure winst.
          </Text>
        </View>

        <Footer
          logoUrl={logoUrl}
          clientWebsite={data.websiteUrl}
          pageNr={pn}
          totalPages={totalNumberedPages}
        />
      </Page>
      ); })()}

      {/* ══════════════════════════════════════════════════════ */}
      {/* Volgende stappen + CTA                                 */}
      {/* ══════════════════════════════════════════════════════ */}
      {(() => { const pn = nextPage(); return (
      <Page size="A4" style={s.page}>
        <View style={s.accentBar} fixed />
        <Header logoUrl={logoUrl} refNumber={refNumber} date={datum} />
        <SectionHeader nummer="05" title="Volgende stappen" />

        <View style={s.stepRow}>
          <Text style={s.stepNumber}>1</Text>
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Intake gesprek (30 min, gratis)</Text>
            <Text style={s.stepDesc}>
              We bespreken dit voorstel, uw vragen, en stemmen de scope definitief af.
              Daarna beslist u of we doorgaan.
            </Text>
          </View>
        </View>

        <View style={s.stepRow}>
          <Text style={s.stepNumber}>2</Text>
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Contract & kickoff</Text>
            <Text style={s.stepDesc}>
              Eenvoudige project-overeenkomst, kickoff binnen één week. U krijgt toegang
              tot een gedeelde project omgeving om voortgang te volgen.
            </Text>
          </View>
        </View>

        <View style={s.stepRow}>
          <Text style={s.stepNumber}>3</Text>
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Bouw & wekelijkse demo</Text>
            <Text style={s.stepDesc}>
              We bouwen iteratief met wekelijkse check-ins. U ziet elke week wat er af
              is en kan bijsturen.
            </Text>
          </View>
        </View>

        <View style={s.stepRow}>
          <Text style={s.stepNumber}>4</Text>
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Go-live & hand-over</Text>
            <Text style={s.stepDesc}>
              Productie launch, monitoring, documentatie. Na go-live blijven we 2 weken
              standby voor eventuele aanpassingen.
            </Text>
          </View>
        </View>

        <View style={s.cta}>
          <Text style={s.ctaTitle}>Klaar om te starten?</Text>
          <Text style={s.ctaText}>
            Plan een gratis gesprek: {data.bookingUrl ?? "https://cal.com/autronis"}
          </Text>
        </View>

        <Footer
          logoUrl={logoUrl}
          clientWebsite={data.websiteUrl}
          pageNr={pn}
          totalPages={totalNumberedPages}
        />
      </Page>
      ); })()}
    </Document>
  );
}
