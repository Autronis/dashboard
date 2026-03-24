"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import {
  Plus, RefreshCw, Eye, TrendingUp, Minus, TrendingDown, ExternalLink,
  Trash2, Edit2, X, Loader2, Globe, Shield, ShieldAlert, ShieldCheck,
  Zap, BarChart3, CheckCircle2, XCircle, AlertTriangle, Sparkles, Search,
  ArrowRight, Lightbulb, Target, Activity, Info, ChevronDown, ArrowUpDown,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageTransition } from "@/components/ui/page-transition";
import {
  useConcurrenten, useCreateConcurrent, useUpdateConcurrent,
  useDeleteConcurrent, useStartScan, useScanStatus, useAnalyseConcurrent,
  type Concurrent, type ConcurrentAnalyse,
} from "@/hooks/queries/use-concurrenten";

// ─── Helpers ───
function parseJson<T>(val: string | null, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// ─── Animated Counter ───
function AnimatedCount({ value, className }: { value: number; className?: string }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplayed(0); return; }
    const duration = 700;
    const startTime = performance.now();
    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [value]);
  return <span className={className}>{displayed}</span>;
}

// ─── Trend Badge ───
function TrendBadge({ trend }: { trend: string | null }) {
  if (!trend) return null;
  const config: Record<string, { icon: typeof TrendingUp; label: string; cls: string; animate: boolean }> = {
    groeiend: { icon: TrendingUp, label: "Groeiend", cls: "bg-green-500/15 text-green-400", animate: true },
    stabiel: { icon: Minus, label: "Stabiel", cls: "bg-yellow-500/15 text-yellow-400", animate: false },
    krimpend: { icon: TrendingDown, label: "Krimpend", cls: "bg-red-500/15 text-red-400", animate: false },
  };
  const c = config[trend];
  if (!c) return null;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", c.cls)}>
      <Icon className={cn("h-3 w-3", c.animate && "animate-bounce")} style={c.animate ? { animationDuration: "1.2s" } : undefined} />
      {c.label}
    </span>
  );
}

// ─── Threat Badge ───
function ThreatBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const config: Record<string, { icon: typeof Shield; label: string; cls: string; glow: string }> = {
    laag: { icon: ShieldCheck, label: "Laag risico", cls: "bg-green-500/15 text-green-400", glow: "" },
    medium: { icon: Shield, label: "Medium risico", cls: "bg-yellow-500/15 text-yellow-400", glow: "shadow-[0_0_8px_rgba(234,179,8,0.35)]" },
    hoog: { icon: ShieldAlert, label: "Hoog risico", cls: "bg-red-500/15 text-red-400", glow: "shadow-[0_0_10px_rgba(239,68,68,0.45)]" },
  };
  const c = config[level];
  if (!c) return null;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", c.cls, c.glow)}>
      <Icon className="h-3 w-3" />{c.label}
    </span>
  );
}

// ─── Overlap Score Ring ───
function OverlapRing({ score }: { score: number | null }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(t);
  }, []);

  if (score === null) return null;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 100) * circumference;
  const currentOffset = animated ? targetOffset : circumference;
  const color = score >= 70 ? "text-red-400 stroke-red-400" : score >= 40 ? "text-yellow-400 stroke-yellow-400" : "text-green-400 stroke-green-400";

  return (
    <div className="relative w-10 h-10 flex-shrink-0" title={`${score}% overlap met Autronis`}>
      <svg width="40" height="40" className="transform -rotate-90">
        <circle cx="20" cy="20" r={radius} fill="none" stroke="#2A3538" strokeWidth="3" />
        <circle
          cx="20" cy="20" r={radius} fill="none"
          className={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={currentOffset}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums", color.split(" ")[0])}>{score}</span>
    </div>
  );
}

// ─── Scan Progress ───
function ScanProgress() {
  const { data: status } = useScanStatus(true);
  if (!status?.actief) return null;

  const total = status.concurrenten.length;
  const done = status.concurrenten.filter((c) => c.status === "voltooid").length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-autronis-accent/20 bg-autronis-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-autronis-accent" />
          Scan bezig...
        </h3>
        <span className="text-xs text-autronis-text-secondary tabular-nums">{done}/{total}</span>
      </div>
      <div className="mb-3 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-autronis-accent rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="space-y-1.5">
        {status.concurrenten.map((c) => (
          <div key={c.id} className="flex items-center gap-3 text-xs">
            {c.status === "voltooid" && <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />}
            {c.status === "bezig" && <Loader2 className="h-3.5 w-3.5 animate-spin text-autronis-accent flex-shrink-0" />}
            {c.status === "wachtend" && <div className="h-3.5 w-3.5 rounded-full border border-autronis-border flex-shrink-0" />}
            {c.status === "mislukt" && <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />}
            <span className={cn(
              c.status === "bezig" && "text-autronis-accent",
              c.status === "voltooid" && "text-autronis-text-secondary",
              c.status === "mislukt" && "text-red-400",
              c.status === "wachtend" && "text-autronis-text-secondary/50"
            )}>
              {c.naam}{c.stap && c.status === "bezig" && <span className="ml-1 text-autronis-text-secondary/70">— {c.stap}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Intelligence Summary ───
function IntelligenceSummary({ concurrenten }: { concurrenten: Concurrent[] }) {
  const router = useRouter();

  const insights = useMemo(() => {
    const allHighlights: { naam: string; highlight: string; threat: string | null }[] = [];
    const allKansen: { naam: string; kans: string }[] = [];
    const allChanges: { naam: string; count: number }[] = [];
    const positioning: { naam: string; overlap: number; sterktes: string[]; zwaktes: string[] }[] = [];
    let latestScanDate: string | null = null;

    for (const c of concurrenten) {
      const scan = c.laatsteScan;
      if (scan?.aiHighlights) {
        const hl: string[] = parseJson(scan.aiHighlights, []);
        hl.forEach((h) => allHighlights.push({ naam: c.naam, highlight: h, threat: c.threatLevel }));
      }
      if (scan?.kansen) {
        const kansen: string[] = parseJson(scan.kansen, []);
        kansen.forEach((k) => allKansen.push({ naam: c.naam, kans: k }));
      }
      if (scan?.websiteChanges) {
        const changes: Array<{ veranderd: boolean }> = parseJson(scan.websiteChanges, []);
        const changeCount = changes.filter((ch) => ch.veranderd).length;
        if (changeCount > 0) allChanges.push({ naam: c.naam, count: changeCount });
      }
      if (scan?.aangemaaktOp) {
        if (!latestScanDate || scan.aangemaaktOp > latestScanDate) latestScanDate = scan.aangemaaktOp;
      }
      positioning.push({
        naam: c.naam,
        overlap: c.overlapScore ?? 0,
        sterktes: parseJson(c.sterktes, []),
        zwaktes: parseJson(c.zwaktes, []),
      });
    }

    const actions: { actie: string; prioriteit: "hoog" | "gemiddeld" | "laag"; bron: string }[] = [];
    const highThreatChanging = concurrenten.filter((c) => c.threatLevel === "hoog" && c.laatsteScan);
    if (highThreatChanging.length > 0) {
      actions.push({ actie: `Monitor ${highThreatChanging.map((c) => c.naam).join(", ")} extra — hoog risico en actief`, prioriteit: "hoog", bron: "risico" });
    }
    if (allKansen.length > 0) {
      actions.push({ actie: allKansen[0].kans, prioriteit: "gemiddeld", bron: allKansen[0].naam });
      if (allKansen.length > 1) actions.push({ actie: allKansen[1].kans, prioriteit: "gemiddeld", bron: allKansen[1].naam });
    }
    const exploitableWeaknesses = positioning.filter((p) => p.overlap >= 40 && p.zwaktes.length > 0).flatMap((p) => p.zwaktes.slice(0, 1).map((z) => ({ naam: p.naam, zwakte: z })));
    if (exploitableWeaknesses.length > 0) {
      actions.push({ actie: `Speel in op zwakte van ${exploitableWeaknesses[0].naam}: "${exploitableWeaknesses[0].zwakte}"`, prioriteit: "gemiddeld", bron: "positionering" });
    }
    const lowOverlap = positioning.filter((p) => p.overlap < 30 && p.overlap > 0);
    if (lowOverlap.length > 0) {
      actions.push({ actie: `${lowOverlap.map((p) => p.naam).join(", ")}: lage overlap — geen directe bedreiging, mogelijke partners`, prioriteit: "laag", bron: "positionering" });
    }

    // Urgency: days since last scan
    let dagenGeleden: number | null = null;
    if (latestScanDate) {
      const diff = Date.now() - new Date(latestScanDate).getTime();
      dagenGeleden = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    return { allHighlights, allKansen, allChanges, positioning, actions, latestScanDate, dagenGeleden };
  }, [concurrenten]);

  if (concurrenten.length === 0) return null;

  const priConfig = {
    hoog: { bg: "bg-red-500/15", text: "text-red-400" },
    gemiddeld: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
    laag: { bg: "bg-blue-500/15", text: "text-blue-400" },
  };

  function handleKansClick(kans: string) {
    localStorage.setItem("autronis-kans-prefill", kans);
    router.push("/ideeen");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Acties */}
      <div className="bg-autronis-card border border-autronis-accent/30 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-autronis-accent/10 rounded-xl"><ArrowRight className="w-4 h-4 text-autronis-accent" /></div>
            <div>
              <h2 className="text-base font-semibold text-autronis-text-primary">Wat moeten we doen?</h2>
              <p className="text-[10px] text-autronis-text-secondary">Op basis van competitor intelligence</p>
            </div>
          </div>
          {insights.dagenGeleden !== null && (
            <span className={cn(
              "text-[10px] px-2 py-1 rounded-lg",
              insights.dagenGeleden > 14 ? "bg-red-500/15 text-red-400" :
              insights.dagenGeleden > 7 ? "bg-yellow-500/15 text-yellow-400" :
              "bg-autronis-bg text-autronis-text-secondary"
            )}>
              {insights.dagenGeleden === 0 ? "Vandaag gescand" : `${insights.dagenGeleden}d geleden`}
            </span>
          )}
        </div>
        {insights.actions.length === 0 ? (
          <p className="text-sm text-autronis-text-secondary">Scan concurrenten voor actionable insights.</p>
        ) : (
          <div className="space-y-2">
            {insights.actions.slice(0, 4).map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-autronis-bg/50">
                <div className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase mt-0.5 flex-shrink-0", priConfig[a.prioriteit].bg, priConfig[a.prioriteit].text)}>
                  {a.prioriteit}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-autronis-text-primary leading-snug">{a.actie}</p>
                  <p className="text-[10px] text-autronis-text-secondary mt-0.5">Bron: {a.bron}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kansen + wijzigingen */}
      <div className="space-y-5">
        {insights.allChanges.length > 0 && (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-autronis-text-primary">Recente wijzigingen</h3>
            </div>
            <div className="space-y-1.5">
              {insights.allChanges.map((ch, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-autronis-text-primary">{ch.naam}</span>
                  <span className="text-autronis-accent font-semibold tabular-nums">{ch.count} pagina{ch.count > 1 ? "'s" : ""} gewijzigd</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {insights.allKansen.length > 0 && (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-400" />
                <h3 className="text-sm font-semibold text-autronis-text-primary">Kansen in de markt</h3>
              </div>
              <span className="text-[10px] text-autronis-text-secondary">Klik → sla op als idee</span>
            </div>
            <div className="space-y-2">
              {insights.allKansen.slice(0, 4).map((k, i) => (
                <button
                  key={i}
                  onClick={() => handleKansClick(k.kans)}
                  className="w-full flex items-start gap-2 text-sm text-left p-2 rounded-lg hover:bg-autronis-accent/10 transition-colors group"
                >
                  <span className="text-yellow-400 mt-0.5 group-hover:text-autronis-accent transition-colors">→</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-autronis-text-primary leading-snug group-hover:text-autronis-accent transition-colors">{k.kans}</p>
                    <p className="text-[10px] text-autronis-text-secondary">Via: {k.naam}</p>
                  </div>
                  <Lightbulb className="h-3.5 w-3.5 text-autronis-text-secondary/30 group-hover:text-autronis-accent flex-shrink-0 mt-0.5 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {insights.allHighlights.length > 0 && insights.allChanges.length === 0 && insights.allKansen.length === 0 && (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-autronis-accent" />
              <h3 className="text-sm font-semibold text-autronis-text-primary">Wat concurrenten doen</h3>
            </div>
            <div className="space-y-2">
              {insights.allHighlights.slice(0, 4).map((h, i) => (
                <div key={i} className="text-sm">
                  <span className="text-autronis-text-primary">{h.highlight}</span>
                  <span className="text-[10px] text-autronis-text-secondary ml-2">— {h.naam}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Positioning Overview ───
function PositioningOverview({ concurrenten }: { concurrenten: Concurrent[] }) {
  if (concurrenten.length === 0) return null;
  const autroniseDiensten = ["Workflow automatisering", "AI integraties", "Systeem integraties", "Data & dashboards", "Make.com / n8n", "Custom AI agents"];
  const allCompDiensten = new Set<string>();
  for (const c of concurrenten) { const d: string[] = parseJson(c.diensten, []); d.forEach((s) => allCompDiensten.add(s.toLowerCase())); }
  const uniqueToUs = autroniseDiensten.filter((s) => !allCompDiensten.has(s.toLowerCase()));
  const uniqueToThem: string[] = [];
  for (const c of concurrenten) {
    const d: string[] = parseJson(c.diensten, []);
    for (const dienst of d) {
      if (!autroniseDiensten.some((a) => a.toLowerCase().includes(dienst.toLowerCase()) || dienst.toLowerCase().includes(a.toLowerCase()))) {
        if (!uniqueToThem.includes(dienst)) uniqueToThem.push(dienst);
      }
    }
  }
  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-purple-400" />
        <h2 className="text-base font-semibold text-autronis-text-primary">Positionering</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-4">
          <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">Ons unieke aanbod</p>
          {uniqueToUs.length > 0 ? (
            <div className="space-y-1">{uniqueToUs.map((s) => <p key={s} className="text-sm text-autronis-text-primary">✓ {s}</p>)}</div>
          ) : (
            <p className="text-sm text-autronis-text-secondary">Alle diensten worden gedeeld</p>
          )}
        </div>
        <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-4">
          <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-2">Directe concurrentie</p>
          <div className="space-y-1.5">
            {concurrenten.filter((c) => (c.overlapScore ?? 0) >= 50).sort((a, b) => (b.overlapScore ?? 0) - (a.overlapScore ?? 0)).slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-autronis-text-primary truncate">{c.naam}</span>
                <span className="text-yellow-400 font-semibold tabular-nums">{c.overlapScore}%</span>
              </div>
            ))}
            {concurrenten.filter((c) => (c.overlapScore ?? 0) >= 50).length === 0 && (
              <p className="text-sm text-autronis-text-secondary">Geen directe concurrenten (&gt;50%)</p>
            )}
          </div>
        </div>
        <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Zij bieden, wij niet</p>
          {uniqueToThem.length > 0 ? (
            <div className="space-y-1">
              {uniqueToThem.slice(0, 5).map((s) => <p key={s} className="text-sm text-autronis-text-secondary">{s}</p>)}
              {uniqueToThem.length > 5 && <p className="text-[10px] text-autronis-text-secondary/60">+{uniqueToThem.length - 5} meer</p>}
            </div>
          ) : (
            <p className="text-sm text-autronis-text-secondary">Geen unieke diensten bij concurrenten</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Smart Add Modal ───
function SmartAddModal({ open, onClose, concurrent }: { open: boolean; onClose: () => void; concurrent?: Concurrent }) {
  const { addToast } = useToast();
  const createMutation = useCreateConcurrent();
  const updateMutation = useUpdateConcurrent();
  const analyseMutation = useAnalyseConcurrent();

  const [step, setStep] = useState<1 | 2>(concurrent ? 2 : 1);
  const [step1Mode, setStep1Mode] = useState<"choose" | "ai">("choose");
  const [url, setUrl] = useState(concurrent?.websiteUrl ?? "");
  const [naam, setNaam] = useState(concurrent?.naam ?? "");
  const [linkedin, setLinkedin] = useState(concurrent?.linkedinUrl ?? "");
  const [instagram, setInstagram] = useState(concurrent?.instagramHandle ?? "");
  const [beschrijving, setBeschrijving] = useState(concurrent?.beschrijving ?? "");
  const [notities, setNotities] = useState(concurrent?.notities ?? "");
  const [analyseData, setAnalyseData] = useState<ConcurrentAnalyse | null>(null);

  function handleAnalyse() {
    if (!url.trim()) { addToast("URL is verplicht", "fout"); return; }
    const cleanUrl = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    setUrl(cleanUrl);
    analyseMutation.mutate(cleanUrl, {
      onSuccess: (result) => {
        const data = (result as { analyse: ConcurrentAnalyse }).analyse ?? result;
        setAnalyseData(data as ConcurrentAnalyse);
        setNaam((data as ConcurrentAnalyse).naam || "");
        setBeschrijving((data as ConcurrentAnalyse).beschrijving || "");
        if ((data as ConcurrentAnalyse).socialMedia?.linkedin) setLinkedin((data as ConcurrentAnalyse).socialMedia.linkedin ?? "");
        if ((data as ConcurrentAnalyse).socialMedia?.instagram) setInstagram((data as ConcurrentAnalyse).socialMedia.instagram ?? "");
        setStep(2);
      },
      onError: (err) => { addToast(err.message || "Analyse mislukt", "fout"); setStep(2); },
    });
  }

  function handleOpslaan() {
    if (!naam.trim()) { addToast("Naam is verplicht", "fout"); return; }
    const body = {
      naam: naam.trim(),
      websiteUrl: url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`,
      linkedinUrl: linkedin.trim() || undefined,
      instagramHandle: instagram.trim() || undefined,
      beschrijving: beschrijving.trim() || undefined,
      notities: notities.trim() || undefined,
      ...(analyseData && {
        diensten: analyseData.diensten,
        techStack: analyseData.techStack,
        prijzen: analyseData.prijzen ?? undefined,
        teamGrootte: analyseData.teamGrootte ?? undefined,
        sterktes: analyseData.sterktes,
        zwaktes: analyseData.zwaktes,
        overlapScore: analyseData.overlapScore,
        overlapUitleg: analyseData.overlapUitleg ?? undefined,
        threatLevel: analyseData.threatLevel ?? undefined,
        threatUitleg: analyseData.threatUitleg ?? undefined,
      }),
    };
    if (concurrent) {
      updateMutation.mutate({ id: concurrent.id, ...body }, {
        onSuccess: () => { addToast("Concurrent bijgewerkt", "succes"); onClose(); },
        onError: () => addToast("Bijwerken mislukt", "fout"),
      });
    } else {
      createMutation.mutate(body, {
        onSuccess: () => { addToast("Concurrent toegevoegd", "succes"); onClose(); },
        onError: () => addToast("Toevoegen mislukt", "fout"),
      });
    }
  }

  if (!open) return null;

  const inputCls = "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-autronis-text-primary">{concurrent ? "Concurrent bewerken" : "Concurrent toevoegen"}</h3>
          <button onClick={onClose} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {step === 1 && step1Mode === "choose" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setStep1Mode("ai")}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-autronis-accent/30 bg-autronis-accent/5 hover:border-autronis-accent/60 hover:bg-autronis-accent/10 transition-all text-center group"
            >
              <div className="p-3 bg-autronis-accent/15 rounded-xl group-hover:bg-autronis-accent/25 transition-colors">
                <Sparkles className="w-6 h-6 text-autronis-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-autronis-text-primary">AI Analyse</p>
                <p className="text-[11px] text-autronis-text-secondary mt-1 leading-relaxed">Vul een URL in — AI detecteert diensten, pricing, risico en overlap automatisch</p>
              </div>
            </button>
            <button
              onClick={() => setStep(2)}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-autronis-border bg-autronis-bg/30 hover:border-autronis-border/80 hover:bg-autronis-bg/50 transition-all text-center group"
            >
              <div className="p-3 bg-autronis-bg/50 rounded-xl group-hover:bg-autronis-border/50 transition-colors">
                <Edit2 className="w-6 h-6 text-autronis-text-secondary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-autronis-text-primary">Handmatig</p>
                <p className="text-[11px] text-autronis-text-secondary mt-1 leading-relaxed">Vul zelf de gegevens in — naam, website, diensten en notities</p>
              </div>
            </button>
          </div>
        )}

        {step === 1 && step1Mode === "ai" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-autronis-text-secondary">Website URL</label>
              <input
                type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                className={inputCls} placeholder="https://concurrent.nl" autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAnalyse()}
              />
            </div>
            <div className="p-3 rounded-xl bg-autronis-bg/50 border border-autronis-border">
              <p className="text-xs text-autronis-text-secondary leading-relaxed">
                <Info className="w-3 h-3 inline mr-1 text-autronis-accent" />
                Scant homepage, diensten, over ons, pricing en cases. Detecteert diensten, tech stack, overlap en risico.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep1Mode("choose")} className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
                ← Terug
              </button>
              <button onClick={handleAnalyse} disabled={analyseMutation.isPending || !url.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                {analyseMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Analyseren...</> : <><Sparkles className="w-4 h-4" />Analyseer</>}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {analyseData && (
              <div className="rounded-xl border border-autronis-accent/30 bg-autronis-accent/5 p-3 text-xs text-autronis-text-secondary">
                <span className="font-semibold text-autronis-accent">AI Analyse voltooid</span> — Overlap: {analyseData.overlapScore}%, Risico: {analyseData.threatLevel}
                {analyseData.diensten?.length > 0 && `, ${analyseData.diensten.length} diensten gedetecteerd`}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="block text-xs font-medium text-autronis-text-secondary">Naam *</label><input type="text" value={naam} onChange={(e) => setNaam(e.target.value)} className={inputCls} /></div>
              <div className="space-y-1.5"><label className="block text-xs font-medium text-autronis-text-secondary">Website</label><input type="text" value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="block text-xs font-medium text-autronis-text-secondary">LinkedIn</label><input type="text" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className={inputCls} placeholder="URL" /></div>
              <div className="space-y-1.5"><label className="block text-xs font-medium text-autronis-text-secondary">Instagram</label><input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} className={inputCls} placeholder="@handle" /></div>
            </div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-autronis-text-secondary">Beschrijving</label><textarea value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} rows={3} className={cn(inputCls, "resize-none")} /></div>
            <div className="space-y-1.5"><label className="block text-xs font-medium text-autronis-text-secondary">Notities</label><textarea value={notities} onChange={(e) => setNotities(e.target.value)} rows={2} className={cn(inputCls, "resize-none")} /></div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2.5 text-sm text-autronis-text-secondary">Annuleren</button>
              <button onClick={handleOpslaan} disabled={createMutation.isPending || updateMutation.isPending}
                className="px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold disabled:opacity-50">
                {(createMutation.isPending || updateMutation.isPending) ? "Opslaan..." : concurrent ? "Bijwerken" : "Toevoegen"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Concurrent Card ───
function ConcurrentCard({ concurrent, onEdit, onDelete, onScan, index }: {
  concurrent: Concurrent; onEdit: () => void; onDelete: () => void; onScan: () => void; index: number;
}) {
  const scan = concurrent.laatsteScan;
  const highlights: string[] = scan?.aiHighlights ? parseJson(scan.aiHighlights, []) : [];
  const kansen: string[] = scan?.kansen ? parseJson(scan.kansen, []) : [];
  const diensten: string[] = parseJson(concurrent.diensten, []);
  const sterktes: string[] = parseJson(concurrent.sterktes, []);
  const zwaktes: string[] = parseJson(concurrent.zwaktes, []);

  const changeCount = useMemo(() => {
    if (!scan?.websiteChanges) return 0;
    const changes: Array<{ veranderd: boolean }> = parseJson(scan.websiteChanges, []);
    return changes.filter((c) => c.veranderd).length;
  }, [scan?.websiteChanges]);

  const shakeControls = useAnimation();

  useEffect(() => {
    if (changeCount > 0) {
      const delay = 400 + index * 80;
      const t = setTimeout(() => {
        shakeControls.start({ x: [0, -7, 7, -5, 5, -3, 3, 0], transition: { duration: 0.45 } });
      }, delay);
      return () => clearTimeout(t);
    }
  }, [changeCount, index, shakeControls]);

  return (
    <motion.div
      animate={shakeControls}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        "card-glow rounded-2xl border bg-autronis-card p-5 transition-colors",
        changeCount > 0 ? "border-red-500/25 bg-red-500/[0.03]" : "border-autronis-border"
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-autronis-text-primary truncate">{concurrent.naam}</h3>
            <ThreatBadge level={concurrent.threatLevel} />
          </div>
          <a href={concurrent.websiteUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors">
            {concurrent.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <OverlapRing score={concurrent.overlapScore} />
          <TrendBadge trend={scan?.trendIndicator ?? null} />
        </div>
      </div>

      {/* AI Summary */}
      {(scan?.aiSamenvatting || concurrent.beschrijving) && (
        <p className="mb-3 text-xs leading-relaxed text-autronis-text-secondary line-clamp-2">
          {scan?.aiSamenvatting || concurrent.beschrijving}
        </p>
      )}

      {/* Diensten tags */}
      {diensten.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {diensten.slice(0, 5).map((d) => (
            <span key={d} className="rounded-md bg-autronis-accent/10 px-2 py-0.5 text-[10px] font-medium text-autronis-accent">{d}</span>
          ))}
          {diensten.length > 5 && <span className="text-[10px] text-autronis-text-secondary">+{diensten.length - 5}</span>}
        </div>
      )}

      {/* Scan badges */}
      {scan && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {changeCount > 0 ? (
            <span className="rounded-md bg-red-500/15 text-red-400 px-2 py-0.5 text-[10px] font-medium">
              {changeCount} wijziging{changeCount > 1 ? "en" : ""}
            </span>
          ) : scan.websiteChanges ? (
            <span className="rounded-md bg-autronis-border/50 text-autronis-text-secondary/60 px-2 py-0.5 text-[10px] font-medium">
              Geen wijzigingen
            </span>
          ) : null}
          {scan.vacatures && (() => {
            const vacs: Array<{ titel: string }> = parseJson(scan.vacatures, []);
            return vacs.length > 0 ? (
              <span className="rounded-md bg-autronis-accent/15 px-2 py-0.5 text-[10px] font-medium text-autronis-accent">
                {vacs.length} vacature{vacs.length > 1 ? "s" : ""}
              </span>
            ) : null;
          })()}
        </div>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="mb-3 space-y-1">
          {highlights.slice(0, 2).map((h, i) => (
            <div key={i} className="rounded-lg border-l-2 border-autronis-accent bg-autronis-bg/50 px-2.5 py-1.5 text-[11px] leading-relaxed text-autronis-text-secondary">
              {h}
            </div>
          ))}
        </div>
      )}

      {/* Kansen */}
      {kansen.length > 0 && (
        <div className="mb-3 space-y-1">
          {kansen.slice(0, 1).map((k, i) => (
            <div key={i} className="rounded-lg border-l-2 border-yellow-400 bg-yellow-500/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-yellow-400/80">
              {k}
            </div>
          ))}
        </div>
      )}

      {/* Strengths / Weaknesses */}
      {(sterktes.length > 0 || zwaktes.length > 0) && (
        <div className="mb-3 flex gap-3 text-[10px]">
          {sterktes.length > 0 && <span className="text-green-400/70">+ {sterktes[0]}</span>}
          {zwaktes.length > 0 && <span className="text-red-400/70">− {zwaktes[0]}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-autronis-border/30">
        <span className="text-[10px] text-autronis-text-secondary/60">
          {scan ? `Gescand: ${formatDatum(scan.aangemaaktOp ?? "")}` : "Nog niet gescand"}
        </span>
        <div className="flex gap-1">
          <Link href={`/concurrenten/${concurrent.id}`}
            className="rounded-lg bg-autronis-border/50 px-2.5 py-1 text-[10px] text-autronis-text-secondary hover:bg-white/5 transition-colors">Details →</Link>
          <button onClick={onScan} className="rounded-lg bg-autronis-border/50 px-2 py-1 text-[10px] text-autronis-text-secondary hover:bg-white/5 transition-colors">⟳</button>
          <button onClick={onEdit} className="rounded-lg bg-autronis-border/50 px-1.5 py-1 text-autronis-text-secondary hover:bg-white/5 transition-colors"><Edit2 className="h-3 w-3" /></button>
          <button onClick={onDelete} className="rounded-lg bg-autronis-border/50 px-1.5 py-1 text-red-400/60 hover:bg-red-500/10 transition-colors"><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Vergelijkingsmatrix ───
function VergelijkingsMatrix({ concurrenten }: { concurrenten: Concurrent[] }) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const autroniseDiensten = ["Workflow automatisering", "AI integraties", "Systeem integraties", "Data & dashboards", "Make.com / n8n", "Custom AI agents"];
  const alleDiensten = new Set<string>(autroniseDiensten);
  for (const c of concurrenten) { const d: string[] = parseJson(c.diensten, []); d.forEach((dienst) => alleDiensten.add(dienst)); }
  const dienstenArray = Array.from(alleDiensten);

  function heeftDienst(concurrentDiensten: string[], zoek: string): boolean {
    const z = zoek.toLowerCase();
    return concurrentDiensten.some((d) => { const dl = d.toLowerCase(); return dl.includes(z) || z.includes(dl) || dl.split(" ").some((w) => z.includes(w) && w.length > 3); });
  }

  if (concurrenten.length === 0) return null;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow overflow-x-auto">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-autronis-accent" />
        <h2 className="text-lg font-semibold text-autronis-text-primary">Vergelijkingsmatrix</h2>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-autronis-border/50">
            <th className="text-left py-2 px-2 text-autronis-text-secondary font-medium w-48">Dienst</th>
            <th className="text-center py-2 px-2 font-semibold text-autronis-accent w-24">Autronis</th>
            {concurrenten.map((c, colIdx) => (
              <th key={c.id}
                className={cn("text-center py-2 px-2 font-medium w-24 truncate transition-colors", hoveredCol === colIdx ? "text-autronis-accent" : "text-autronis-text-primary")}
                title={c.naam}>
                {c.naam.length > 12 ? `${c.naam.slice(0, 12)}…` : c.naam}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dienstenArray.map((dienst) => {
            const autronisHeeft = autroniseDiensten.some((ad) => ad.toLowerCase().includes(dienst.toLowerCase()) || dienst.toLowerCase().includes(ad.toLowerCase()));
            return (
              <tr key={dienst}
                className={cn("border-b border-autronis-border/20 transition-colors", hoveredRow === dienst ? "bg-autronis-accent/5" : "hover:bg-autronis-bg/30")}
                onMouseEnter={() => setHoveredRow(dienst)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <td className={cn("py-2 px-2 transition-colors", hoveredRow === dienst ? "text-autronis-accent font-medium" : "text-autronis-text-primary")}>{dienst}</td>
                <td className="text-center py-2">
                  {autronisHeeft ? <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" /> : <span className="text-autronis-text-secondary/30">—</span>}
                </td>
                {concurrenten.map((c, colIdx) => {
                  const cd: string[] = parseJson(c.diensten, []);
                  const heeft = heeftDienst(cd, dienst);
                  const isHighlighted = hoveredRow === dienst || hoveredCol === colIdx;
                  return (
                    <td key={c.id}
                      className={cn("text-center py-2 transition-colors", isHighlighted && "bg-autronis-accent/5")}
                      onMouseEnter={() => setHoveredCol(colIdx)}
                      onMouseLeave={() => setHoveredCol(null)}
                    >
                      {heeft
                        ? (autronisHeeft ? <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mx-auto" /> : <CheckCircle2 className="w-3.5 h-3.5 text-autronis-text-secondary/50 mx-auto" />)
                        : (autronisHeeft ? <span className="text-green-400 text-[10px] font-bold">✓</span> : <span className="text-autronis-text-secondary/20">—</span>)
                      }
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="border-t-2 border-autronis-border/50">
            <td className="py-2 px-2 font-semibold text-autronis-text-primary">Overlap score</td>
            <td className="text-center py-2"><span className="text-autronis-accent font-bold">—</span></td>
            {concurrenten.map((c) => (
              <td key={c.id} className="text-center py-2">
                <span className={cn("font-bold tabular-nums", (c.overlapScore ?? 0) >= 70 ? "text-red-400" : (c.overlapScore ?? 0) >= 40 ? "text-yellow-400" : "text-green-400")}>
                  {c.overlapScore ?? "—"}%
                </span>
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-2 px-2 font-semibold text-autronis-text-primary">Threat level</td>
            <td className="text-center py-2"><span className="text-autronis-accent font-bold">—</span></td>
            {concurrenten.map((c) => <td key={c.id} className="text-center py-2"><ThreatBadge level={c.threatLevel} /></td>)}
          </tr>
        </tbody>
      </table>
      <div className="mt-4 flex items-center gap-4 text-[10px] text-autronis-text-secondary">
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> Autronis biedt, concurrent niet</span>
        <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-yellow-400" /> Directe concurrentie</span>
        <span className="flex items-center gap-1 text-green-400 font-bold">✓ Uniek voordeel Autronis</span>
      </div>
    </div>
  );
}

type SortOption = "overlap" | "threat" | "wijziging" | "naam";

// ─── Main Page ───
export default function ConcurrentenPage() {
  const { data, isLoading } = useConcurrenten();
  const [scanActive, setScanActive] = useState(false);
  const { data: scanStatus } = useScanStatus(scanActive);
  const startScan = useStartScan();
  const deleteMutation = useDeleteConcurrent();
  const { addToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editConcurrent, setEditConcurrent] = useState<Concurrent | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("overlap");
  const [filterHogeOverlap, setFilterHogeOverlap] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scanActive && scanStatus && !scanStatus.actief) setScanActive(false);
  }, [scanActive, scanStatus]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setSortMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleScanAll() {
    startScan.mutate(undefined, {
      onSuccess: () => { addToast("Scan gestart", "succes"); setScanActive(true); },
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  function handleScanOne(id: number) {
    startScan.mutate(id, {
      onSuccess: () => addToast("Scan gestart", "succes"),
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  function handleDelete(id: number) {
    deleteMutation.mutate(id, {
      onSuccess: () => { addToast("Concurrent verwijderd", "succes"); setConfirmDelete(null); },
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-autronis-border border-t-autronis-accent" /></div>;
  }

  const kpis = data?.kpis;
  const allConcurrenten = data?.concurrenten ?? [];
  const hogeOverlap = allConcurrenten.filter((c) => (c.overlapScore ?? 0) >= 70).length;
  const hogeThreat = allConcurrenten.filter((c) => c.threatLevel === "hoog").length;

  const threatOrder: Record<string, number> = { hoog: 0, medium: 1, laag: 2 };

  const sortedConcurrenten = [...allConcurrenten]
    .filter((c) => !filterHogeOverlap || (c.overlapScore ?? 0) >= 70)
    .sort((a, b) => {
      switch (sortBy) {
        case "overlap": return (b.overlapScore ?? 0) - (a.overlapScore ?? 0);
        case "threat": return (threatOrder[a.threatLevel ?? ""] ?? 3) - (threatOrder[b.threatLevel ?? ""] ?? 3);
        case "wijziging": {
          const getChanges = (c: Concurrent) => {
            if (!c.laatsteScan?.websiteChanges) return 0;
            const changes: Array<{ veranderd: boolean }> = parseJson(c.laatsteScan.websiteChanges, []);
            return changes.filter((ch) => ch.veranderd).length;
          };
          return getChanges(b) - getChanges(a);
        }
        case "naam": return a.naam.localeCompare(b.naam);
        default: return 0;
      }
    });

  const sortLabels: Record<SortOption, string> = {
    overlap: "Overlap",
    threat: "Risico",
    wijziging: "Wijzigingen",
    naam: "Naam",
  };

  return (
    <PageTransition>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary">Concurrenten</h1>
            <p className="text-sm text-autronis-text-secondary">Competitor intelligence dashboard</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowMatrix(!showMatrix)}
              className={cn("flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                showMatrix ? "border-autronis-accent bg-autronis-accent/10 text-autronis-accent" : "border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30")}>
              <BarChart3 className="h-4 w-4" />Matrix
            </button>
            <button onClick={handleScanAll} disabled={startScan.isPending || scanStatus?.actief}
              className="flex items-center gap-2 rounded-xl border border-autronis-accent/30 bg-autronis-accent/10 px-4 py-2.5 text-sm font-semibold text-autronis-accent hover:bg-autronis-accent/20 transition-colors disabled:opacity-50"
              title="Scant websites, diensten, pricing, vacatures, social media">
              <RefreshCw className={cn("h-4 w-4", scanStatus?.actief && "animate-spin")} />Scan alles
            </button>
            <button onClick={() => { setEditConcurrent(undefined); setModalOpen(true); }}
              className="flex items-center gap-2 rounded-xl bg-autronis-accent px-4 py-2.5 text-sm font-semibold text-autronis-bg hover:bg-autronis-accent-hover transition-colors">
              <Plus className="h-4 w-4" />Concurrent
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-autronis-border bg-autronis-card p-4 card-glow">
            <p className="text-[10px] text-autronis-text-secondary uppercase tracking-wide">Actief</p>
            <AnimatedCount value={kpis?.totaal ?? 0} className="mt-1 block text-2xl font-bold tabular-nums text-autronis-text-primary" />
          </div>
          <div className="rounded-2xl border border-autronis-border bg-autronis-card p-4 card-glow">
            <p className="text-[10px] text-autronis-text-secondary uppercase tracking-wide">Wijzigingen</p>
            <AnimatedCount value={kpis?.wijzigingenDezeWeek ?? 0} className="mt-1 block text-2xl font-bold tabular-nums text-autronis-accent" />
          </div>
          <div className="rounded-2xl border border-autronis-border bg-autronis-card p-4 card-glow">
            <p className="text-[10px] text-autronis-text-secondary uppercase tracking-wide">Groeiend</p>
            <AnimatedCount value={kpis?.groeiend ?? 0} className="mt-1 block text-2xl font-bold tabular-nums text-green-400" />
          </div>
          <button
            onClick={() => setFilterHogeOverlap((f) => !f)}
            className={cn("rounded-2xl border bg-autronis-card p-4 card-glow text-left transition-colors",
              filterHogeOverlap ? "border-red-500/40 bg-red-500/5" : "border-autronis-border hover:border-red-500/30"
            )}
          >
            <p className={cn("text-[10px] uppercase tracking-wide", filterHogeOverlap ? "text-red-400" : "text-autronis-text-secondary")}>Hoge overlap</p>
            <AnimatedCount value={hogeOverlap} className={cn("mt-1 block text-2xl font-bold tabular-nums", hogeOverlap > 0 ? "text-red-400" : "text-autronis-text-primary")} />
          </button>
          <div className="rounded-2xl border border-autronis-border bg-autronis-card p-4 card-glow">
            <p className="text-[10px] text-autronis-text-secondary uppercase tracking-wide">Hoog risico</p>
            <AnimatedCount value={hogeThreat} className={cn("mt-1 block text-2xl font-bold tabular-nums", hogeThreat > 0 ? "text-red-400" : "text-autronis-text-primary")} />
          </div>
        </div>

        {filterHogeOverlap && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 inline-block" />
            Gefilterd op hoge overlap (≥70%) — {sortedConcurrenten.length} resultaten
            <button onClick={() => setFilterHogeOverlap(false)} className="ml-1 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {scanStatus?.actief && <ScanProgress />}

        <IntelligenceSummary concurrenten={allConcurrenten} />
        <PositioningOverview concurrenten={allConcurrenten} />

        {showMatrix && <VergelijkingsMatrix concurrenten={allConcurrenten} />}

        {/* Cards */}
        {allConcurrenten.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-autronis-border bg-autronis-card/50 p-8">
            <div className="max-w-lg mx-auto text-center mb-6">
              <Eye className="mb-4 h-12 w-12 text-autronis-text-secondary/30 mx-auto" />
              <h3 className="text-lg font-semibold text-autronis-text-primary mb-2">Competitor Intelligence</h3>
              <p className="text-sm text-autronis-text-secondary mb-4">
                Voeg concurrenten toe en AI analyseert automatisch hun website, diensten, pricing, en social media.
                Je krijgt overlap scores, risico-niveaus, en kansen die zij missen.
              </p>
            </div>
            <div className="max-w-lg mx-auto bg-autronis-bg/50 rounded-xl p-5 border border-autronis-border mb-6">
              <div className="flex items-center gap-3 mb-3">
                <h4 className="text-sm font-semibold text-autronis-text-primary">Voorbeeld: "AutomatiseerNL"</h4>
                <ThreatBadge level="medium" />
                <OverlapRing score={62} />
              </div>
              <p className="text-xs text-autronis-text-secondary mb-3">Biedt workflow automatisering en CRM integraties. Geen AI agents of custom dashboards.</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {["Workflow automatisering", "CRM koppelingen", "Zapier"].map((d) => (
                  <span key={d} className="rounded-md bg-autronis-accent/10 px-2 py-0.5 text-[10px] font-medium text-autronis-accent">{d}</span>
                ))}
              </div>
              <div className="space-y-1">
                <div className="rounded-lg border-l-2 border-yellow-400 bg-yellow-500/5 px-2.5 py-1.5 text-[11px] text-yellow-400/80">
                  Kans: zij missen AI agents — positioneer als premium alternatief
                </div>
                <div className="text-[10px] text-green-400/70">+ Sterke lokale aanwezigheid</div>
                <div className="text-[10px] text-red-400/70">− Geen custom development</div>
              </div>
            </div>
            <div className="text-center">
              <button onClick={() => { setEditConcurrent(undefined); setModalOpen(true); }}
                className="rounded-xl bg-autronis-accent px-5 py-2.5 text-sm font-semibold text-autronis-bg hover:bg-autronis-accent-hover transition-colors">
                Eerste concurrent toevoegen
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Sort controls */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-autronis-text-secondary">
                {sortedConcurrenten.length} concurrent{sortedConcurrenten.length !== 1 ? "en" : ""}
              </p>
              <div className="relative" ref={sortMenuRef}>
                <button
                  onClick={() => setSortMenuOpen((o) => !o)}
                  className="flex items-center gap-1.5 text-xs text-autronis-text-secondary hover:text-autronis-text-primary px-3 py-1.5 rounded-lg border border-autronis-border/50 hover:border-autronis-border transition-colors"
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {sortLabels[sortBy]}
                  <ChevronDown className="h-3 w-3" />
                </button>
                <AnimatePresence>
                  {sortMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-1 bg-autronis-card border border-autronis-border rounded-xl shadow-xl z-10 overflow-hidden min-w-[120px]"
                    >
                      {(["overlap", "threat", "wijziging", "naam"] as SortOption[]).map((opt) => (
                        <button key={opt} onClick={() => { setSortBy(opt); setSortMenuOpen(false); }}
                          className={cn("w-full text-left px-3 py-2 text-xs transition-colors",
                            sortBy === opt ? "text-autronis-accent bg-autronis-accent/10" : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                          )}>
                          {sortLabels[opt]}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {sortedConcurrenten.map((c, i) => (
                <ConcurrentCard key={c.id} concurrent={c} index={i}
                  onEdit={() => { setEditConcurrent(c); setModalOpen(true); }}
                  onDelete={() => setConfirmDelete(c.id)}
                  onScan={() => handleScanOne(c.id)} />
              ))}
            </div>
          </>
        )}

        {modalOpen && (
          <SmartAddModal key={editConcurrent?.id ?? "new"} open={modalOpen}
            onClose={() => { setModalOpen(false); setEditConcurrent(undefined); }}
            concurrent={editConcurrent} />
        )}

        <ConfirmDialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)}
          onBevestig={() => confirmDelete && handleDelete(confirmDelete)}
          titel="Concurrent verwijderen?" bericht="Deze concurrent wordt gedeactiveerd. Scan-historie blijft bewaard." />
      </div>
    </PageTransition>
  );
}
