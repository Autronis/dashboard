"use client";

import { use, useState } from "react";
import { useSalesEngineScanDetail, type AIAnalyse, type ScrapeResultaat, type ScanKans } from "@/hooks/queries/use-sales-engine";
import { useGenerateOutreach } from "@/hooks/queries/use-outreach";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDatum } from "@/lib/utils";
import {
  ArrowLeft,
  ExternalLink,
  Building2,
  User,
  AlertTriangle,
  Wrench,
  MessageSquare,
  Globe,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Calculator,
  Gauge,
  FileText,
  UserPlus,
  Send,
  Mail,
  Loader2,
} from "lucide-react";
import Link from "next/link";

const statusConfig: Record<string, { label: string; kleur: string; icon: typeof Clock }> = {
  pending: { label: "Bezig", kleur: "text-yellow-400 bg-yellow-400/10", icon: Clock },
  completed: { label: "Voltooid", kleur: "text-emerald-400 bg-emerald-400/10", icon: CheckCircle },
  failed: { label: "Mislukt", kleur: "text-red-400 bg-red-400/10", icon: AlertCircle },
};

const categorieConfig: Record<string, { label: string; kleur: string }> = {
  lead_gen: { label: "Lead Generatie", kleur: "text-blue-400 bg-blue-400/10" },
  communicatie: { label: "Communicatie", kleur: "text-purple-400 bg-purple-400/10" },
  administratie: { label: "Administratie", kleur: "text-orange-400 bg-orange-400/10" },
  data: { label: "Data & Inzicht", kleur: "text-cyan-400 bg-cyan-400/10" },
  content: { label: "Content", kleur: "text-pink-400 bg-pink-400/10" },
};

const impactConfig: Record<string, { label: string; kleur: string }> = {
  hoog: { label: "Hoge impact", kleur: "text-emerald-400 bg-emerald-400/10" },
  midden: { label: "Medium impact", kleur: "text-yellow-400 bg-yellow-400/10" },
  laag: { label: "Lage impact", kleur: "text-[var(--text-tertiary)] bg-[var(--border)]/30" },
};

// Parse "X uur per week" to hours number
function parseUrenPerWeek(text: string | null): number {
  if (!text) return 0;
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*uur/i);
  if (!match) return 0;
  return parseFloat(match[1].replace(",", "."));
}

// Calculate automation readiness score (1-10)
function berekenReadinessScore(
  kansen: ScanKans[],
  scrapeResultaat: ScrapeResultaat | null
): { score: number; uitleg: string[] } {
  let score = 0;
  const uitleg: string[] = [];

  // Aantal kansen (max 2 punten)
  if (kansen.length >= 3) {
    score += 2;
    uitleg.push("3+ automatiseringskansen gevonden");
  } else if (kansen.length >= 1) {
    score += 1;
    uitleg.push(`${kansen.length} automatiseringskans(en) gevonden`);
  }

  // Impact levels (max 3 punten)
  const hogeImpact = kansen.filter((k) => k.impact === "hoog").length;
  if (hogeImpact >= 2) {
    score += 3;
    uitleg.push(`${hogeImpact} kansen met hoge impact`);
  } else if (hogeImpact >= 1) {
    score += 2;
    uitleg.push("1 kans met hoge impact");
  } else if (kansen.some((k) => k.impact === "midden")) {
    score += 1;
    uitleg.push("Kansen met medium impact");
  }

  // Tijdsbesparing (max 2 punten)
  const totaalUren = kansen.reduce((sum, k) => sum + parseUrenPerWeek(k.geschatteTijdsbesparing), 0);
  if (totaalUren >= 10) {
    score += 2;
    uitleg.push(`${totaalUren} uur/week besparingspotentieel`);
  } else if (totaalUren >= 3) {
    score += 1;
    uitleg.push(`${totaalUren} uur/week besparingspotentieel`);
  }

  // Tech stack modernity (max 2 punten)
  const techStack = scrapeResultaat?.techStack ?? [];
  const modernTech = ["React", "Next.js", "Shopify", "WooCommerce"];
  const legacyTech = ["Joomla", "Magento"];
  const hasModernTech = techStack.some((t) => modernTech.includes(t));
  const hasLegacyTech = techStack.some((t) => legacyTech.includes(t));

  if (hasModernTech && !hasLegacyTech) {
    score += 2;
    uitleg.push("Moderne tech stack - makkelijk te integreren");
  } else if (!hasLegacyTech) {
    score += 1;
    uitleg.push("Standaard tech stack");
  } else {
    uitleg.push("Legacy tech stack - extra werk nodig");
  }

  // Formulieren/widgets aanwezig (max 1 punt)
  if ((scrapeResultaat?.formulieren?.length ?? 0) > 0 || (scrapeResultaat?.chatWidgets?.length ?? 0) > 0) {
    score += 1;
    uitleg.push("Bestaande formulieren/widgets gevonden");
  }

  return { score: Math.min(score, 10), uitleg };
}

function ScoreBar({ score }: { score: number }) {
  const kleur =
    score >= 7 ? "bg-emerald-400" : score >= 4 ? "bg-yellow-400" : "bg-red-400";
  const label =
    score >= 7 ? "Uitstekend" : score >= 4 ? "Gemiddeld" : "Beperkt";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-3xl font-bold tabular-nums">{score}/10</span>
        <span className={`text-sm font-medium ${score >= 7 ? "text-emerald-400" : score >= 4 ? "text-yellow-400" : "text-red-400"}`}>
          {label}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--border)]">
        <div
          className={`h-full rounded-full transition-all ${kleur}`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
    </div>
  );
}

export default function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const scanId = parseInt(id, 10);
  const { data, isLoading } = useSalesEngineScanDetail(isNaN(scanId) ? null : scanId);
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();
  const generateOutreach = useGenerateOutreach();

  const STANDAARD_UURTARIEF = 95; // Autronis uurtarief

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-[var(--text-secondary)]">Scan niet gevonden.</p>
        <Link href="/sales-engine" className="text-[var(--accent)] hover:underline mt-2 inline-block">
          ← Terug naar overzicht
        </Link>
      </div>
    );
  }

  const { scan, lead, kansen } = data;
  const status = statusConfig[scan.status] ?? statusConfig.pending;
  const StatusIcon = status.icon;
  const aiAnalyse = scan.aiAnalyse as AIAnalyse | null;
  const scrapeResultaat = scan.scrapeResultaat as ScrapeResultaat | null;

  // ROI berekening
  const kansenMetUren = kansen.map((k) => ({
    ...k,
    urenPerWeek: parseUrenPerWeek(k.geschatteTijdsbesparing),
  }));
  const totaalUrenPerWeek = kansenMetUren.reduce((sum, k) => sum + k.urenPerWeek, 0);
  const jaarlijkseBesparing = totaalUrenPerWeek * 52 * STANDAARD_UURTARIEF;
  const geschatteInvestering = totaalUrenPerWeek > 8 ? 5000 : totaalUrenPerWeek > 3 ? 3000 : 1500;
  const terugverdientijdMaanden = jaarlijkseBesparing > 0
    ? Math.ceil((geschatteInvestering / jaarlijkseBesparing) * 12)
    : 0;

  // Readiness score: prefer AI-provided score, fallback to local calculation
  const aiReadinessScore = scan.automationReadinessScore;
  const readiness = berekenReadinessScore(kansen, scrapeResultaat);
  const readinessScore = aiReadinessScore ?? readiness.score;

  return (
    <PageTransition>
      <div className="p-6 space-y-6 max-w-5xl">
        {/* Back + Header */}
        <div>
          <Link
            href="/sales-engine"
            className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Terug naar overzicht
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">{lead?.bedrijfsnaam ?? "Onbekend bedrijf"}</h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${status.kleur}`}
            >
              <StatusIcon className="w-4 h-4" />
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--text-secondary)]">
            <a
              href={scan.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-[var(--accent)]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {scan.websiteUrl}
            </a>
            {scan.aangemaaktOp && <span>Gescand op {formatDatum(scan.aangemaaktOp)}</span>}
            {lead && (
              <Link href="/leads" className="hover:text-[var(--accent)]">
                Bekijk lead →
              </Link>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {scan.status === "completed" && (
          <div className="flex flex-wrap gap-3">
            <button
              disabled
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)]/20 text-[var(--accent)] font-medium opacity-50 cursor-not-allowed"
              title="Binnenkort beschikbaar"
            >
              <FileText className="w-4 h-4" />
              Genereer voorstel
            </button>
            {lead && (
              <Link
                href={`/leads`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--text-primary)] font-medium hover:border-[var(--accent)]/30 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Bekijk lead
              </Link>
            )}
            <button
              onClick={() => {
                generateOutreach.mutate(scanId, {
                  onSuccess: (data) => {
                    addToast("Outreach sequentie aangemaakt", "succes");
                    router.push(`/outreach/${data.sequentieId}`);
                  },
                  onError: (err) => addToast(err.message, "fout"),
                });
              }}
              disabled={generateOutreach.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent)]/80 transition-colors disabled:opacity-50"
            >
              {generateOutreach.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {generateOutreach.isPending ? "Emails genereren..." : "Genereer Outreach"}
            </button>
          </div>
        )}

        {/* Failed State */}
        {scan.status === "failed" && scan.foutmelding && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-5">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">Scan mislukt</span>
            </div>
            <p className="text-sm text-red-300">{scan.foutmelding}</p>
          </div>
        )}

        {/* ROI Berekening + Automation Readiness (side by side) */}
        {scan.status === "completed" && kansen.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ROI Berekening */}
            <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[var(--accent)]" />
                ROI Berekening
              </h2>
              <div className="space-y-4">
                {kansenMetUren.map((kans) => (
                  <div key={kans.id} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)] truncate mr-4">{kans.titel}</span>
                    <span className="font-medium tabular-nums whitespace-nowrap">
                      {kans.urenPerWeek > 0
                        ? `€${Math.round(kans.urenPerWeek * 52 * STANDAARD_UURTARIEF).toLocaleString("nl-NL")}/jr`
                        : "—"
                      }
                    </span>
                  </div>
                ))}
                <div className="border-t border-[var(--border)] pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Totale besparing per week</span>
                    <span className="font-bold text-[var(--accent)] tabular-nums">{totaalUrenPerWeek} uur</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Jaarlijkse besparing</span>
                    <span className="font-bold text-emerald-400 tabular-nums">
                      €{jaarlijkseBesparing.toLocaleString("nl-NL")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Geschatte investering</span>
                    <span className="font-medium tabular-nums">
                      €{geschatteInvestering.toLocaleString("nl-NL")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Terugverdientijd</span>
                    <span className="font-bold text-[var(--accent)] tabular-nums">
                      {terugverdientijdMaanden > 0 ? `~${terugverdientijdMaanden} maand${terugverdientijdMaanden !== 1 ? "en" : ""}` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Automation Readiness Score */}
            <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-[var(--accent)]" />
                Automation Readiness
              </h2>
              <ScoreBar score={readinessScore} />
              {scan.aanbevolenPakket && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20">
                  <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Aanbevolen pakket</span>
                  <p className="font-medium text-[var(--accent)] capitalize">{scan.aanbevolenPakket}</p>
                </div>
              )}
              <div className="mt-4 space-y-2">
                {readiness.uitleg.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
                    <span className="text-[var(--text-secondary)]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Cal.com Context */}
        {(scan.bedrijfsgrootte || scan.rol || scan.grootsteKnelpunt || scan.huidigeTools || scan.opmerkingen) && (
          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-[var(--accent)]" />
              Prospect Info
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scan.bedrijfsgrootte && (
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Bedrijfsgrootte</p>
                  <p className="text-sm">{scan.bedrijfsgrootte}</p>
                </div>
              )}
              {scan.rol && (
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Rol</p>
                  <p className="text-sm">{scan.rol}</p>
                </div>
              )}
              {scan.grootsteKnelpunt && (
                <div className="md:col-span-2">
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Grootste Knelpunt
                  </p>
                  <p className="text-sm">{scan.grootsteKnelpunt}</p>
                </div>
              )}
              {scan.huidigeTools && (
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> Huidige Tools
                  </p>
                  <p className="text-sm">{scan.huidigeTools}</p>
                </div>
              )}
              {scan.opmerkingen && (
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Opmerkingen
                  </p>
                  <p className="text-sm">{scan.opmerkingen}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bedrijfsprofiel (from AI) */}
        {aiAnalyse && (
          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[var(--accent)]" />
              Bedrijfsprofiel
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Branche</p>
                <p className="text-sm">{aiAnalyse.bedrijfsProfiel?.branche}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Wat ze doen</p>
                <p className="text-sm">{aiAnalyse.bedrijfsProfiel?.watZeDoen}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Doelgroep</p>
                <p className="text-sm">{aiAnalyse.bedrijfsProfiel?.doelgroep}</p>
              </div>
            </div>
          </div>
        )}

        {/* Automatiseringskansen */}
        {kansen.length > 0 && (
          <div>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--accent)]" />
              Automatiseringskansen
            </h2>
            <div className="space-y-3">
              {kansen.map((kans) => {
                const categorie = categorieConfig[kans.categorie];
                const impact = impactConfig[kans.impact];
                const urenPerWeek = parseUrenPerWeek(kans.geschatteTijdsbesparing);
                const jaarBesparing = urenPerWeek * 52 * STANDAARD_UURTARIEF;

                return (
                  <div
                    key={kans.id}
                    className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-[var(--accent)]">
                          #{kans.prioriteit}
                        </span>
                        <h3 className="font-semibold text-lg">{kans.titel}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {categorie && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categorie.kleur}`}>
                            {categorie.label}
                          </span>
                        )}
                        {impact && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${impact.kleur}`}>
                            {impact.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-3">{kans.beschrijving}</p>
                    <div className="flex items-center flex-wrap gap-4">
                      {kans.geschatteTijdsbesparing && (
                        <div className="flex items-center gap-1.5 text-sm text-[var(--accent)]">
                          <Clock className="w-4 h-4" />
                          {kans.geschatteTijdsbesparing}
                        </div>
                      )}
                      {jaarBesparing > 0 && (
                        <div className="flex items-center gap-1.5 text-sm text-emerald-400">
                          <Calculator className="w-4 h-4" />
                          €{Math.round(jaarBesparing).toLocaleString("nl-NL")}/jaar besparing
                        </div>
                      )}
                      {kans.geschatteKosten && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--border)]/30 text-[var(--text-secondary)]">
                          Kosten: {kans.geschatteKosten}
                        </span>
                      )}
                      {kans.implementatieEffort && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--border)]/30 text-[var(--text-secondary)]">
                          Effort: {kans.implementatieEffort}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Samenvatting */}
        {scan.samenvatting && (
          <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-2 text-[var(--accent)]">Samenvatting</h2>
            <p className="text-sm text-[var(--text-secondary)]">{scan.samenvatting}</p>
          </div>
        )}

        {/* Scrape Data (collapsible) */}
        {scrapeResultaat && (
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)]">
            <button
              onClick={() => setScrapeOpen(!scrapeOpen)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-[var(--accent)]" />
                Scrape Data
              </h2>
              {scrapeOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {scrapeOpen && (
              <div className="px-5 pb-5 space-y-4 border-t border-[var(--border)] pt-4">
                {scrapeResultaat.techStack?.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Tech Stack</p>
                    <div className="flex flex-wrap gap-2">
                      {scrapeResultaat.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--border)]/30 text-[var(--text-secondary)]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {scrapeResultaat.formulieren?.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Formulieren</p>
                    <div className="flex flex-wrap gap-2">
                      {scrapeResultaat.formulieren.map((form) => (
                        <span
                          key={form}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--border)]/30 text-[var(--text-secondary)]"
                        >
                          {form}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {scrapeResultaat.chatWidgets?.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Chat Widgets</p>
                    <div className="flex flex-wrap gap-2">
                      {scrapeResultaat.chatWidgets.map((widget) => (
                        <span
                          key={widget}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--border)]/30 text-[var(--text-secondary)]"
                        >
                          {widget}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(scrapeResultaat.socialMedia ?? {}).length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Social Media</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(scrapeResultaat.socialMedia).map(([platform, url]) => (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--border)]/30 text-[var(--accent)] hover:underline"
                        >
                          {platform}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Gescande Pagina&apos;s</p>
                  <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                    <p>{scrapeResultaat.homepage?.url}</p>
                    {scrapeResultaat.subpaginas?.map((p) => (
                      <p key={p.url}>{p.url}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
