"use client";

import { use, useEffect, useState } from "react";
import { useSalesEngineScanDetail, type AIAnalyse, type ScrapeResultaat, type ScanKans } from "@/hooks/queries/use-sales-engine";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDatum } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
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
  Mail,
  Loader2,
  RefreshCw,
  Rocket,
  Copy,
  Check,
  Sparkles,
  Wand2,
  Film,
} from "lucide-react";
import Link from "next/link";
import { buildUpgradePrompt, buildFreshPrompt, type SiteScrape, type SerpCheck } from "@/lib/lead-rebuild-prep";
import { classifyFit } from "@/lib/lead-rebuild-fit";
import {
  type RebuildPrepAssets,
  loadAssetsForLead,
  buildAssetInjection,
} from "@/lib/rebuild-prep-assets";
import type { ScanDetail } from "@/hooks/queries/use-sales-engine";

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

const impactConfig: Record<string, { label: string; kleur: string; glow: string }> = {
  hoog: { label: "Hoge impact", kleur: "text-emerald-400 bg-emerald-400/10", glow: "shadow-[0_0_12px_rgba(52,211,153,0.25)]" },
  midden: { label: "Medium impact", kleur: "text-yellow-400 bg-yellow-400/10", glow: "shadow-[0_0_8px_rgba(251,191,36,0.15)]" },
  laag: { label: "Lage impact", kleur: "text-[var(--text-tertiary)] bg-[var(--border)]/30", glow: "" },
};

function parseUrenPerWeek(text: string | null): number {
  if (!text) return 0;
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*uur/i);
  if (!match) return 0;
  return parseFloat(match[1].replace(",", "."));
}

function ROIChart({
  maandelijkseBesparing,
  investering,
  terugverdientijdMaanden,
}: {
  maandelijkseBesparing: number;
  investering: number;
  terugverdientijdMaanden: number;
}) {
  const maanden = Array.from({ length: 12 }, (_, i) => i + 1);
  const besparingData = maanden.map((m) => m * maandelijkseBesparing);
  const maxY = Math.max(besparingData[11], investering) * 1.15;

  const W = 700;
  const H = 280;
  const padL = 60;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const x = (m: number) => padL + ((m - 1) / 11) * chartW;
  const y = (val: number) => padT + chartH - (val / maxY) * chartH;

  const besparingPath = maanden
    .map((m, i) => `${i === 0 ? "M" : "L"}${x(m)},${y(besparingData[i])}`)
    .join(" ");

  const breakEvenX = terugverdientijdMaanden > 0 && terugverdientijdMaanden <= 12
    ? padL + ((terugverdientijdMaanden - 1) / 11) * chartW
    : null;

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 280 }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <g key={pct}>
            <line
              x1={padL} y1={padT + chartH * (1 - pct)}
              x2={W - padR} y2={padT + chartH * (1 - pct)}
              stroke="var(--border)" strokeWidth={0.5} strokeDasharray={pct > 0 && pct < 1 ? "4 4" : undefined}
            />
            <text
              x={padL - 8} y={padT + chartH * (1 - pct) + 4}
              textAnchor="end" fontSize={10} fill="var(--text-tertiary)"
            >
              {`€${Math.round((maxY * pct) / 1000)}k`}
            </text>
          </g>
        ))}

        {/* Month labels */}
        {maanden.map((m) => (
          <text key={m} x={x(m)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)">
            M{m}
          </text>
        ))}

        {/* Investment line */}
        <line
          x1={padL} y1={y(investering)}
          x2={W - padR} y2={y(investering)}
          stroke="#f87171" strokeWidth={1.5} strokeDasharray="6 4"
        />
        <text x={W - padR} y={y(investering) - 6} textAnchor="end" fontSize={10} fill="#f87171">
          Investering €{investering.toLocaleString("nl-NL")}
        </text>

        {/* Besparing area */}
        <path
          d={`${besparingPath} L${x(12)},${padT + chartH} L${x(1)},${padT + chartH} Z`}
          fill="url(#besparingGradient)" opacity={0.3}
        />

        {/* Besparing line */}
        <path d={besparingPath} fill="none" stroke="#34d399" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Break-even marker */}
        {breakEvenX && (
          <g>
            <line x1={breakEvenX} y1={padT} x2={breakEvenX} y2={padT + chartH} stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 3" />
            <circle cx={breakEvenX} cy={y(investering)} r={5} fill="var(--accent)" />
            <text x={breakEvenX} y={padT - 4} textAnchor="middle" fontSize={10} fontWeight="bold" fill="var(--accent)">
              Break-even
            </text>
          </g>
        )}

        {/* Data points */}
        {maanden.map((m, i) => (
          <circle key={m} cx={x(m)} cy={y(besparingData[i])} r={3} fill="#34d399" />
        ))}

        <defs>
          <linearGradient id="besparingGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-emerald-400 rounded" />
          Cumulatieve besparing
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-red-400 rounded" style={{ borderTop: "1.5px dashed #f87171" }} />
          Investering
        </div>
        {terugverdientijdMaanden > 0 && terugverdientijdMaanden <= 12 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            Break-even na ~{terugverdientijdMaanden} maand{terugverdientijdMaanden !== 1 ? "en" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function berekenReadinessScore(
  kansen: ScanKans[],
  scrapeResultaat: ScrapeResultaat | null
): { score: number; uitleg: string[] } {
  let score = 0;
  const uitleg: string[] = [];

  if (kansen.length >= 3) {
    score += 2;
    uitleg.push("3+ automatiseringskansen gevonden");
  } else if (kansen.length >= 1) {
    score += 1;
    uitleg.push(`${kansen.length} automatiseringskans(en) gevonden`);
  }

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

  const totaalUren = kansen.reduce((sum, k) => sum + parseUrenPerWeek(k.geschatteTijdsbesparing), 0);
  if (totaalUren >= 10) {
    score += 2;
    uitleg.push(`${totaalUren} uur/week besparingspotentieel`);
  } else if (totaalUren >= 3) {
    score += 1;
    uitleg.push(`${totaalUren} uur/week besparingspotentieel`);
  }

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

  if ((scrapeResultaat?.formulieren?.length ?? 0) > 0 || (scrapeResultaat?.chatWidgets?.length ?? 0) > 0) {
    score += 1;
    uitleg.push("Bestaande formulieren/widgets gevonden");
  }

  return { score: Math.min(score, 10), uitleg };
}

function ScoreBar({ score }: { score: number }) {
  const kleur = score >= 7 ? "bg-emerald-400" : score >= 4 ? "bg-yellow-400" : "bg-red-400";
  const label = score >= 7 ? "Uitstekend" : score >= 4 ? "Gemiddeld" : "Beperkt";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-3xl font-bold tabular-nums">{score}/10</span>
        <span className={`text-sm font-medium ${score >= 7 ? "text-emerald-400" : score >= 4 ? "text-yellow-400" : "text-red-400"}`}>
          {label}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--border)]">
        <motion.div
          className={`h-full rounded-full ${kleur}`}
          initial={{ width: 0 }}
          animate={{ width: `${score * 10}%` }}
          transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
        />
      </div>
    </div>
  );
}

interface ScanFase {
  label: string;
  sublabel: string;
  done: boolean;
  active: boolean;
}

function ScanProgressIndicator({ hasScrapeData }: { hasScrapeData: boolean }) {
  const fases: ScanFase[] = [
    {
      label: "Website scrapen",
      sublabel: "Pagina's analyseren",
      done: hasScrapeData,
      active: !hasScrapeData,
    },
    {
      label: "AI analyse",
      sublabel: "Kansen identificeren",
      done: false,
      active: hasScrapeData,
    },
    {
      label: "Rapport klaar",
      sublabel: "Resultaten opslaan",
      done: false,
      active: false,
    },
  ];

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--accent)]/20 p-6 shadow-[0_0_24px_rgba(23,184,165,0.06)]">
      <div className="flex items-center gap-3 mb-5">
        <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
        <h3 className="font-semibold text-[var(--accent)]">Scan bezig...</h3>
      </div>
      <div className="space-y-3">
        {fases.map((fase, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            className="flex items-center gap-3"
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              fase.done
                ? "bg-emerald-400/20 text-emerald-400"
                : fase.active
                  ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                  : "bg-[var(--border)]/50 text-[var(--text-tertiary)]"
            }`}>
              {fase.done ? (
                <CheckCircle className="w-4 h-4" />
              ) : fase.active ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-3.5 h-3.5" />
                </motion.div>
              ) : (
                <span className="text-[10px] font-bold">{i + 1}</span>
              )}
            </div>
            <div>
              <p className={`text-sm font-medium ${
                fase.done ? "text-emerald-400" : fase.active ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
              }`}>
                {fase.label}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">{fase.sublabel}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="text-xs text-[var(--text-tertiary)] mt-4">Pagina herlaadt automatisch zodra het rapport klaar is...</p>
    </div>
  );
}

function seScrapeToMarkdown(scrapeData: ScrapeResultaat): string {
  const parts: string[] = [];
  if (scrapeData.homepage.title) parts.push(`# ${scrapeData.homepage.title}`);
  for (const h of scrapeData.homepage.headings) parts.push(`## ${h}`);
  if (scrapeData.homepage.bodyText) parts.push(scrapeData.homepage.bodyText);
  for (const sub of scrapeData.subpaginas ?? []) {
    if (sub.title) parts.push(`\n## ${sub.title}`);
    if (sub.bodyText) parts.push(sub.bodyText);
  }
  return parts.join("\n\n");
}

function WebsiteRebuildCard({
  scan,
  scrapeResultaat,
  bedrijfsnaam,
}: {
  scan: ScanDetail["scan"];
  scrapeResultaat: ScrapeResultaat;
  bedrijfsnaam: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // We namespacen sessionStorage keys per sales-engine scan als `se-<scanId>`
  // om botsing met rebuild-prep (UUID-based) te vermijden.
  const roundTripLeadId = `se-${scan.id}`;
  const [assets, setAssets] = useState<RebuildPrepAssets | null>(null);

  const hasWebsite = !!scan.websiteUrl;
  const category = scrapeResultaat.googlePlaces?.categorieen?.[0] ?? null;
  const fit = classifyFit(category, bedrijfsnaam);

  // Laadt bestaande assets (uit eerdere round-trip binnen deze sessie) en
  // ruimt de ?leadAssets URL param op als we net terugkeerden van /animaties.
  useEffect(() => {
    const existing = loadAssetsForLead(roundTripLeadId);
    if (existing) setAssets(existing);

    const returned = searchParams.get("leadAssets");
    if (returned === roundTripLeadId) {
      const justLoaded = loadAssetsForLead(roundTripLeadId);
      if (justLoaded) setAssets(justLoaded);
      router.replace(`/sales-engine/${scan.id}`, { scroll: false });
    }
  }, [roundTripLeadId, searchParams, router, scan.id]);

  const assetGeneratorHref = (() => {
    const params = new URLSearchParams({
      mode: "scroll-stop",
      product: bedrijfsnaam,
      returnTo: roundTripLeadId,
    });
    if (scan.websiteUrl) params.set("bron", scan.websiteUrl);
    if (category) params.set("categorie", category);
    return `/animaties?${params.toString()}`;
  })();

  let prompt: string;
  if (hasWebsite) {
    const markdown = seScrapeToMarkdown(scrapeResultaat);
    const scrape: SiteScrape = {
      ran: true,
      url: scan.websiteUrl,
      title: scrapeResultaat.homepage.title || null,
      markdown: markdown || null,
      error: null,
      source: "custom",
    };
    prompt = buildUpgradePrompt({
      name: bedrijfsnaam,
      location: scrapeResultaat.googlePlaces?.adres ?? null,
      category,
      fit,
      scrape,
    });
  } else {
    const serp: SerpCheck = {
      ran: false,
      verdict: "skipped",
      foundUrl: null,
      candidates: [],
      note: "Sales Engine scan — geen website",
    };
    prompt = buildFreshPrompt({
      name: bedrijfsnaam,
      location: scrapeResultaat.googlePlaces?.adres ?? null,
      category,
      fit,
      serp,
    });
  }

  const previewLines = prompt.split("\n").slice(0, 5).join("\n");

  async function handleCopy() {
    try {
      const fullPrompt = assets ? prompt + buildAssetInjection(assets) : prompt;
      await navigator.clipboard.writeText(fullPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API failed
    }
  }

  const fitStyles =
    fit.verdict === "scroll_stop_good"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
      : fit.verdict === "static_upgrade"
        ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
        : "bg-zinc-500/10 text-zinc-300 border-zinc-500/30";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-5"
    >
      <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--accent)]" />
          Website Rebuild Voorstel
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {fit.verdict === "scroll_stop_good" && (
            <Link
              href={assetGeneratorHref}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                assets
                  ? "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/20"
                  : "bg-[var(--card)] border-[var(--border)] text-[var(--text-primary)] hover:border-fuchsia-500/50 hover:text-fuchsia-300"
              }`}
              title={
                assets
                  ? "Assets gegenereerd. Openen om opnieuw te doen."
                  : "Open Asset Generator voor deze scan"
              }
            >
              <Wand2 className="w-3.5 h-3.5" />
              {assets ? "Assets opnieuw" : "Asset Generator"}
            </Link>
          )}
          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
              copied
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-[var(--accent)] text-black hover:opacity-90 border-transparent"
            }`}
            title={
              assets
                ? "Kopieert prompt mét scroll-stop asset URLs. Plak in een verse Claude Code chat — ATLAS zet auto de chat-tag."
                : "Kopieert de rebuild prompt. Plak in een verse Claude Code chat — ATLAS zet auto de chat-tag."
            }
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Gekopieerd — plak in Claude Code" : `Kopieer prompt${assets ? " + assets" : ""}`}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`px-2 py-0.5 rounded-md text-xs border ${
          hasWebsite
            ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
            : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
        }`}>
          {hasWebsite ? "Upgrade" : "Fresh"}
        </span>
        <span className={`px-2 py-0.5 rounded-md text-xs border ${fitStyles}`}>
          {fit.label}
        </span>
        {assets && (
          <span className="px-2 py-0.5 rounded-md text-xs border bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30 inline-flex items-center gap-1">
            <Film className="w-3 h-3" />
            Assets klaar
          </span>
        )}
      </div>

      <div className="relative">
        <pre
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-[var(--text-secondary)] bg-[var(--bg)] rounded-lg p-3 cursor-pointer overflow-hidden whitespace-pre-wrap"
          style={{ maxHeight: expanded ? "none" : "7rem" }}
        >
          {expanded ? prompt : previewLines + "\n..."}
        </pre>
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--bg)] to-transparent rounded-b-lg pointer-events-none" />
        )}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-[var(--accent)] hover:underline mt-1"
      >
        {expanded ? "Inklappen" : "Volledig tonen"}
      </button>
    </motion.div>
  );
}

export default function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const scanId = parseInt(id, 10);
  const { data, isLoading } = useSalesEngineScanDetail(isNaN(scanId) ? null : scanId);
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();

  const STANDAARD_UURTARIEF = 95;

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

  async function handleHerstart() {
    if (!lead || !scan.websiteUrl) return;
    setIsRestarting(true);
    try {
      const res = await fetch("/api/sales-engine/handmatig", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bedrijfsnaam: lead.bedrijfsnaam,
          websiteUrl: scan.websiteUrl,
          ...(lead.contactpersoon ? { contactpersoon: lead.contactpersoon } : {}),
          ...(lead.email ? { email: lead.email } : {}),
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        addToast(resData.fout || "Herstart mislukt", "fout");
        setIsRestarting(false);
        return;
      }
      addToast("Nieuwe scan gestart", "succes");
      router.push(`/sales-engine/${resData.scanId}`);
    } catch {
      addToast("Er ging iets mis", "fout");
      setIsRestarting(false);
    }
  }

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
              <StatusIcon className={`w-4 h-4 ${scan.status === "pending" ? "animate-spin" : ""}`} />
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
              <Link href="/klanten" className="hover:text-[var(--accent)]">
                Bekijk klant →
              </Link>
            )}
          </div>
        </div>

        {/* Live Progress Indicator (pending) */}
        <AnimatePresence>
          {scan.status === "pending" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ duration: 0.35 }}
            >
              <ScanProgressIndicator hasScrapeData={scrapeResultaat !== null} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        {scan.status === "completed" && (
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/projecten/intake?scanId=${scanId}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)]/20 border border-[var(--accent)]/40 text-[var(--accent)] font-semibold hover:bg-[var(--accent)]/30 transition-colors"
              title="Start de intake flow — scan data wordt voorgevuld, Claude doet het interview, scope PDF wordt gegenereerd"
            >
              <Zap className="w-4 h-4" />
              Start voorstel
            </Link>
            <a
              href={`/api/sales-engine/${scanId}/presentatie`}
              download
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 font-medium hover:bg-purple-500/30 transition-colors"
            >
              <Rocket className="w-4 h-4" />
              Download presentatie (PDF)
            </a>
            {lead && (
              <Link
                href={`/leads`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--text-primary)] font-medium hover:border-[var(--accent)]/30 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Bekijk lead
              </Link>
            )}
          </div>
        )}

        {/* Failed State with restart */}
        {scan.status === "failed" && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">Scan mislukt</span>
                </div>
                {scan.foutmelding && <p className="text-sm text-red-300">{scan.foutmelding}</p>}
              </div>
              <button
                onClick={handleHerstart}
                disabled={isRestarting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-400/15 text-red-400 hover:bg-red-400/25 font-medium text-sm transition-colors disabled:opacity-50 flex-shrink-0"
              >
                {isRestarting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isRestarting ? "Starten..." : "Herstart scan"}
              </button>
            </div>
          </div>
        )}

        {/* ROI + Readiness */}
        {scan.status === "completed" && kansen.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]"
            >
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
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.08 }}
              className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]"
            >
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
            </motion.div>
          </div>
        )}

        {/* 12-maanden ROI Grafiek + Break-even */}
        {scan.status === "completed" && jaarlijkseBesparing > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]"
          >
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--accent)]" />
              12-Maanden ROI Projectie
            </h2>
            <ROIChart
              maandelijkseBesparing={jaarlijkseBesparing / 12}
              investering={geschatteInvestering}
              terugverdientijdMaanden={terugverdientijdMaanden}
            />
          </motion.div>
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

        {/* Bedrijfsprofiel */}
        {aiAnalyse && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]"
          >
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
            {aiAnalyse.concurrentiePositie && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Concurrentiepositie</p>
                <p className="text-sm text-[var(--text-secondary)]">{aiAnalyse.concurrentiePositie}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Automatiseringskansen */}
        {kansen.length > 0 && (
          <div>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--accent)]" />
              Automatiseringskansen
            </h2>
            <div className="space-y-3">
              {kansen.map((kans, i) => {
                const categorie = categorieConfig[kans.categorie];
                const impact = impactConfig[kans.impact];
                const urenPerWeek = parseUrenPerWeek(kans.geschatteTijdsbesparing);
                const jaarBesparing = urenPerWeek * 52 * STANDAARD_UURTARIEF;

                return (
                  <motion.div
                    key={kans.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] hover:border-[var(--accent)]/20 transition-colors"
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
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${impact.kleur} ${impact.glow}`}>
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
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Website Rebuild Voorstel */}
        {scan.status === "completed" && scrapeResultaat && (
          <WebsiteRebuildCard
            scan={scan}
            scrapeResultaat={scrapeResultaat}
            bedrijfsnaam={lead?.bedrijfsnaam ?? "Onbekend bedrijf"}
          />
        )}

        {/* Samenvatting */}
        {scan.samenvatting && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl p-5"
          >
            <h2 className="font-semibold text-lg mb-2 text-[var(--accent)]">Samenvatting</h2>
            <p className="text-sm text-[var(--text-secondary)]">{scan.samenvatting}</p>
          </motion.div>
        )}

        {/* Pending empty state */}
        {scan.status === "pending" && kansen.length === 0 && (
          <div className="bg-[var(--card)] rounded-xl p-10 text-center border border-[var(--border)]">
            <Rocket className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3 opacity-50" />
            <p className="text-[var(--text-secondary)] text-sm">Kansen worden geïdentificeerd...</p>
          </div>
        )}

        {/* Google Places Data */}
        {scrapeResultaat?.googlePlaces && (
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[var(--accent)]" />
              Google Reviews & Bedrijfsinfo
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Rating */}
              {scrapeResultaat.googlePlaces.rating !== null && (
                <div className="bg-[var(--bg)] rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-yellow-400">
                    {scrapeResultaat.googlePlaces.rating}
                    <span className="text-lg text-[var(--text-tertiary)]">/5</span>
                  </p>
                  <div className="flex justify-center gap-0.5 my-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={star <= Math.round(scrapeResultaat.googlePlaces!.rating ?? 0)
                          ? "text-yellow-400" : "text-[var(--border)]"}
                      >
                        &#9733;
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {scrapeResultaat.googlePlaces.aantalReviews} reviews
                  </p>
                </div>
              )}

              {/* Adres */}
              {scrapeResultaat.googlePlaces.adres && (
                <div className="bg-[var(--bg)] rounded-lg p-4">
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Adres</p>
                  <p className="text-sm">{scrapeResultaat.googlePlaces.adres}</p>
                  {scrapeResultaat.googlePlaces.telefoon && (
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      {scrapeResultaat.googlePlaces.telefoon}
                    </p>
                  )}
                </div>
              )}

              {/* Openingstijden */}
              {scrapeResultaat.googlePlaces.openingstijden.length > 0 && (
                <div className="bg-[var(--bg)] rounded-lg p-4">
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Openingstijden</p>
                  <div className="space-y-0.5">
                    {scrapeResultaat.googlePlaces.openingstijden.map((dag) => (
                      <p key={dag} className="text-xs text-[var(--text-secondary)]">{dag}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reviews */}
            {scrapeResultaat.googlePlaces.reviews.length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                  Recente Reviews
                </p>
                <div className="space-y-3">
                  {scrapeResultaat.googlePlaces.reviews.map((review, i) => (
                    <div key={i} className="bg-[var(--bg)] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{review.auteur}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={`text-xs ${star <= review.rating ? "text-yellow-400" : "text-[var(--border)]"}`}
                            >
                              &#9733;
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">{review.tekst}</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">{review.datum}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scrape Data (collapsible) */}
        {scrapeResultaat && scan.status !== "pending" && (
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

                {scrapeResultaat.socialMediaAnalyse && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Social Media Analyse</p>
                    <div className="space-y-2">
                      {scrapeResultaat.socialMediaAnalyse.linkedin && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">LinkedIn:</span>
                          <span className="text-[var(--text-secondary)]">
                            {scrapeResultaat.socialMediaAnalyse.linkedin.heeftBedrijfspagina ? "Bedrijfspagina" : "Persoonlijk profiel"}
                            {scrapeResultaat.socialMediaAnalyse.linkedin.volgersIndicatie && ` — ${scrapeResultaat.socialMediaAnalyse.linkedin.volgersIndicatie} volgers`}
                          </span>
                        </div>
                      )}
                      {scrapeResultaat.socialMediaAnalyse.instagram && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Instagram:</span>
                          <span className="text-[var(--text-secondary)]">
                            {scrapeResultaat.socialMediaAnalyse.instagram.postFrequentie ?? "Profiel gevonden"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(scrapeResultaat.vacatures?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Openstaande Vacatures</p>
                    <div className="space-y-1">
                      {scrapeResultaat.vacatures!.map((v, i) => (
                        <a
                          key={i}
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
                        >
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--border)]/30 text-[var(--text-tertiary)]">
                            {v.platform}
                          </span>
                          {v.titel}
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
