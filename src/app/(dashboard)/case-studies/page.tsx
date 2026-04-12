"use client";

import {
  ExternalLink,
  Video,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Eye,
  Edit3,
  RefreshCw,
  Copy,
  Download,
  Linkedin,
  CheckCircle2,
  XCircle,
  Terminal,
  ArrowRight,
  Filter,
  Share2,
  ChevronDown,
  BarChart3,
  Building2,
  Sparkles,
  X,
  Check,
  Layers,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const GENERATOR_URL = "http://localhost:3456";
const DRAFT_KEY = "autronis-cs-draft";

const GENEREER_STAPPEN = [
  { label: "Klantdata verwerken", offset: 0 },
  { label: "Structuur bepalen", offset: 5000 },
  { label: "Case study schrijven", offset: 11000 },
  { label: "Banners genereren", offset: 24000 },
  { label: "Afronden", offset: 28000 },
];

// ============ TYPES ============

interface CaseStudyResult {
  success: boolean;
  slug: string;
  titel: string;
  voiceoverDuur: number;
  urls: {
    page: string;
    markdown: string;
    caseStudy: string;
    banners: string[];
  };
  error?: string;
}

interface ExistingCaseStudy {
  slug: string;
  titel: string;
  subtitel: string;
}

interface Stap {
  titel: string;
  beschrijving: string;
}

interface ResultaatMetric {
  label: string;
  van: string;
  naar: string;
}

interface Klant {
  id: number;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  email: string | null;
  notities: string | null;
}

interface Project {
  id: number;
  naam: string;
  omschrijving: string | null;
  klantId: number | null;
  klantNaam: string | null;
  status: string;
}

// ============ COMPONENT ============

export default function CaseStudiesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CaseStudyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<ExistingCaseStudy[]>([]);
  const [stappen, setStappen] = useState<Stap[]>([
    { titel: "", beschrijving: "" },
    { titel: "", beschrijving: "" },
  ]);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [lastPingTime, setLastPingTime] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"overzicht" | "nieuw">("overzicht");
  const [formTab, setFormTab] = useState<"formulier" | "preview">("formulier");
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Klant & project selectie
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [projecten, setProjecten] = useState<Project[]>([]);
  const [selectedKlantId, setSelectedKlantId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Form state (controlled for preview)
  const [formState, setFormState] = useState({
    klantnaam: "",
    klantBeschrijving: "",
    klantBranche: "",
    probleem: "",
    probleemMetricWaarde: "",
    probleemMetricLabel: "",
    oplossing: "",
    extraContext: "",
  });

  // Multiple result metrics
  const [resultaatMetrics, setResultaatMetrics] = useState<ResultaatMetric[]>([
    { label: "", van: "", naar: "" },
  ]);

  // Overzicht filters
  const [filterKlant, setFilterKlant] = useState<string>("");

  // Genereer step animation
  const [genereerStap, setGenereerStap] = useState(0);
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Inline preview modal
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

  // Output dropdown state
  const [publiceerOpen, setPubliceerOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const publiceerRef = useRef<HTMLDivElement>(null);
  const downloadRef = useRef<HTMLDivElement>(null);

  // View mode: list or grid
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Draft saved indicator
  const [draftSaved, setDraftSaved] = useState(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  // ============ DATA LOADING ============

  const checkServer = useCallback(async () => {
    try {
      const res = await fetch(`${GENERATOR_URL}/api/case-studies`, { signal: AbortSignal.timeout(3000) });
      setServerOnline(res.ok);
      if (res.ok) setLastPingTime(new Date());
    } catch {
      setServerOnline(false);
    }
  }, []);

  const loadExisting = useCallback(async () => {
    try {
      const res = await fetch(`${GENERATOR_URL}/api/case-studies`);
      const data: ExistingCaseStudy[] = await res.json();
      setExisting(data);
    } catch {
      // Server niet bereikbaar
    }
  }, []);

  const loadKlanten = useCallback(async () => {
    try {
      const res = await fetch("/api/klanten");
      const data = await res.json();
      setKlanten(data.klanten ?? []);
    } catch {
      // Kon klanten niet laden
    }
  }, []);

  const loadProjecten = useCallback(async () => {
    try {
      const res = await fetch("/api/projecten");
      const data = await res.json();
      setProjecten(data.projecten ?? []);
    } catch {
      // Kon projecten niet laden
    }
  }, []);

  useEffect(() => {
    checkServer();
    loadExisting();
    loadKlanten();
    loadProjecten();
  }, [checkServer, loadExisting, loadKlanten, loadProjecten]);

  // Auto-refresh server status every 30s
  useEffect(() => {
    const interval = setInterval(checkServer, 30000);
    return () => clearInterval(interval);
  }, [checkServer]);

  // Load draft from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const { formState: fs, stappen: st, resultaatMetrics: rm } = JSON.parse(saved) as {
          formState: typeof formState;
          stappen: Stap[];
          resultaatMetrics: ResultaatMetric[];
        };
        if (fs) setFormState(fs);
        if (st?.length >= 2) setStappen(st);
        if (rm?.length >= 1) setResultaatMetrics(rm);
      }
    } catch {
      // Corrupt draft — negeer
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save draft to localStorage + show indicator
  useEffect(() => {
    const hasContent = formState.klantnaam || formState.probleem || formState.oplossing;
    if (!hasContent) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ formState, stappen, resultaatMetrics }));
      setDraftSaved(true);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = setTimeout(() => setDraftSaved(false), 2000);
    } catch {
      // localStorage vol — negeer
    }
  }, [formState, stappen, resultaatMetrics]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (publiceerRef.current && !publiceerRef.current.contains(e.target as Node)) setPubliceerOpen(false);
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) setDownloadOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut N → Nieuw tab
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA" || (e.target as HTMLElement).tagName === "SELECT") return;
      if (e.key === "n" || e.key === "N") {
        setActiveTab("nieuw");
        setFormTab("formulier");
      }
      if (e.key === "Escape") setActiveTab("overzicht");
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Filtered projects for selected client
  const clientProjecten = useMemo(() => {
    if (formState.klantnaam === "Autronis") {
      // Show internal projects (no client or Autronis-owned)
      return projecten.filter((p) => !p.klantId || p.klantNaam === "Autronis" || p.klantNaam?.includes("intern"));
    }
    if (!selectedKlantId) return [];
    return projecten.filter((p) => p.klantId === selectedKlantId);
  }, [selectedKlantId, projecten, formState.klantnaam]);

  // ============ KLANT/PROJECT SELECTIE ============

  function handleKlantSelect(klantId: number | null) {
    setSelectedKlantId(klantId);
    setSelectedProjectId(null);
    if (klantId) {
      const klant = klanten.find((k) => k.id === klantId);
      if (klant) {
        setFormState((prev) => ({
          ...prev,
          klantnaam: klant.bedrijfsnaam,
          klantBeschrijving: klant.notities ?? "",
        }));
      }
    }
  }

  function handleProjectSelect(projectId: number | null) {
    setSelectedProjectId(projectId);
    if (projectId) {
      const project = projecten.find((p) => p.id === projectId);
      if (project?.omschrijving) {
        setFormState((prev) => ({
          ...prev,
          extraContext: `Project: ${project.naam}. ${project.omschrijving}`,
        }));
      }
    }
  }

  // ============ STAPPEN ============

  function addStap() {
    setStappen([...stappen, { titel: "", beschrijving: "" }]);
  }

  function removeStap(index: number) {
    if (stappen.length <= 2) return;
    setStappen(stappen.filter((_, i) => i !== index));
  }

  function updateStap(index: number, field: keyof Stap, value: string) {
    const updated = [...stappen];
    updated[index] = { ...updated[index], [field]: value };
    setStappen(updated);
  }

  // ============ RESULTAAT METRICS ============

  function addMetric() {
    setResultaatMetrics([...resultaatMetrics, { label: "", van: "", naar: "" }]);
  }

  function removeMetric(index: number) {
    if (resultaatMetrics.length <= 1) return;
    setResultaatMetrics(resultaatMetrics.filter((_, i) => i !== index));
  }

  function updateMetric(index: number, field: keyof ResultaatMetric, value: string) {
    const updated = [...resultaatMetrics];
    updated[index] = { ...updated[index], [field]: value };
    setResultaatMetrics(updated);
  }

  // ============ HERGEBRUIK ALS TEMPLATE ============

  function hergebruikTemplate() {
    setFormState({ klantnaam: "", klantBeschrijving: "", klantBranche: "", probleem: "", probleemMetricWaarde: "", probleemMetricLabel: "", oplossing: "", extraContext: "" });
    setStappen([{ titel: "", beschrijving: "" }, { titel: "", beschrijving: "" }]);
    setResultaatMetrics([{ label: "", van: "", naar: "" }]);
    setSelectedKlantId(null);
    setSelectedProjectId(null);
    setResult(null);
    setError(null);
    setGenereerStap(0);
    setActiveTab("nieuw");
    setFormTab("formulier");
  }

  // ============ SUBMIT ============

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setGenereerStap(1);

    // Clear previous timers, set up new step timers
    stepTimersRef.current.forEach(clearTimeout);
    stepTimersRef.current = GENEREER_STAPPEN.slice(1).map((stap, i) =>
      setTimeout(() => setGenereerStap(i + 2), stap.offset)
    );

    const filteredStappen = stappen.filter((s) => s.titel.trim());
    const primaryMetric = resultaatMetrics[0];

    const body = {
      klantnaam: formState.klantnaam,
      klantBeschrijving: formState.klantBeschrijving,
      klantBranche: formState.klantBranche,
      probleem: formState.probleem,
      probleemMetric: {
        waarde: formState.probleemMetricWaarde,
        label: formState.probleemMetricLabel,
      },
      oplossing: formState.oplossing,
      stappen: filteredStappen,
      resultaatMetric: {
        van: primaryMetric?.van ?? "",
        naar: primaryMetric?.naar ?? "",
        label: primaryMetric?.label || "Resultaat",
      },
      extraContext: formState.extraContext || undefined,
    };

    try {
      const res = await fetch(`${GENERATOR_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: CaseStudyResult = await res.json();
      if (data.success) {
        stepTimersRef.current.forEach(clearTimeout);
        setGenereerStap(GENEREER_STAPPEN.length + 1);
        setResult(data);
        loadExisting();
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* negeer */ }
      } else {
        stepTimersRef.current.forEach(clearTimeout);
        setGenereerStap(0);
        setError(data.error ?? "Er is iets misgegaan");
      }
    } catch {
      stepTimersRef.current.forEach(clearTimeout);
      setGenereerStap(0);
      setError("Kan geen verbinding maken met de Case Study Generator. Draai eerst: npm run dev");
    }

    setLoading(false);
  }

  // ============ EDIT ============

  async function openEdit(slug: string) {
    try {
      const res = await fetch(`${GENERATOR_URL}/out/${slug}/case-study.md`);
      const text = await res.text();
      setEditSlug(slug);
      setEditContent(text);
    } catch {
      setError("Kan case study niet laden");
    }
  }

  async function saveEdit() {
    if (!editSlug) return;
    setEditSaving(true);
    try {
      await fetch(`${GENERATOR_URL}/api/case-studies/${editSlug}/markdown`, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: editContent,
      });
      setEditSlug(null);
      setEditContent("");
    } catch {
      setError("Opslaan mislukt");
    }
    setEditSaving(false);
  }

  // ============ OUTPUT ACTIONS ============

  async function copyMarkdown() {
    if (!result) return;
    try {
      const res = await fetch(`${GENERATOR_URL}${result.urls.markdown}`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kon markdown niet kopiëren");
    }
  }

  function openLinkedInPost() {
    if (!result) return;
    const params = new URLSearchParams({ caseStudy: result.titel, slug: result.slug });
    window.open(`/content/posts?${params.toString()}`, "_blank");
  }

  function openInstagramBanner() {
    if (!result) return;
    const params = new URLSearchParams({ caseStudy: result.titel, slug: result.slug });
    window.open(`/content/banners?${params.toString()}`, "_blank");
  }

  function openVideo() {
    if (!result) return;
    const params = new URLSearchParams({ caseStudy: result.titel, slug: result.slug });
    window.open(`/content/videos?${params.toString()}`, "_blank");
  }

  function downloadPdf() {
    if (!result) return;
    window.open(`${GENERATOR_URL}${result.urls.page}`, "_blank");
  }

  // ============ STYLES ============

  const inputClass =
    "w-full rounded-xl border border-autronis-border bg-autronis-bg px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-all";
  const labelClass = "text-sm font-semibold text-autronis-accent uppercase tracking-wider";
  const selectClass =
    "w-full rounded-xl border border-autronis-border bg-autronis-bg px-4 py-3 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-all appearance-none cursor-pointer";
  const actionBtnClass =
    "inline-flex items-center gap-2 rounded-lg bg-white/5 border border-autronis-border px-3.5 py-2 text-xs font-semibold text-autronis-text-secondary hover:text-white hover:bg-white/10 transition-colors";
  const accentBtnClass =
    "inline-flex items-center gap-2 rounded-lg bg-autronis-accent/10 border border-autronis-accent/20 px-3.5 py-2 text-xs font-semibold text-autronis-accent hover:bg-autronis-accent/20 transition-colors";

  // Filtered existing case studies
  const filteredExisting = useMemo(() => {
    if (!filterKlant) return existing;
    return existing.filter(
      (cs) =>
        cs.titel.toLowerCase().includes(filterKlant.toLowerCase()) ||
        cs.subtitel.toLowerCase().includes(filterKlant.toLowerCase())
    );
  }, [existing, filterKlant]);

  // Form completeness
  const formVelden = [
    formState.klantnaam,
    formState.probleem,
    formState.oplossing,
    stappen.filter((s) => s.titel.trim()).length > 0 ? "ok" : "",
    resultaatMetrics[0]?.van || resultaatMetrics[0]?.naar ? "ok" : "",
  ];
  const formVolledigheid = Math.round((formVelden.filter(Boolean).length / formVelden.length) * 100);

  function clearDraft() {
    setFormState({ klantnaam: "", klantBeschrijving: "", klantBranche: "", probleem: "", probleemMetricWaarde: "", probleemMetricLabel: "", oplossing: "", extraContext: "" });
    setStappen([{ titel: "", beschrijving: "" }, { titel: "", beschrijving: "" }]);
    setResultaatMetrics([{ label: "", van: "", naar: "" }]);
    setSelectedKlantId(null);
    setSelectedProjectId(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* negeer */ }
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">Case Studies</h1>
            <p className="text-autronis-text-secondary mt-1">Genereer en beheer case studies voor klanten.</p>
          </div>
          <button
            onClick={() => {
              setActiveTab(activeTab === "nieuw" ? "overzicht" : "nieuw");
              setFormTab("formulier");
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-autronis-accent px-5 py-2.5 text-sm font-bold text-autronis-bg hover:bg-autronis-accent-hover transition-all btn-press shadow-lg shadow-autronis-accent/20"
          >
            {activeTab === "nieuw" ? (
              <><Eye className="h-4 w-4" /> Overzicht</>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Nieuwe Case Study
                <kbd className="ml-1 text-[10px] bg-autronis-bg/20 px-1.5 py-0.5 rounded font-mono">N</kbd>
              </>
            )}
          </button>
        </div>

        {/* ============ SERVER STATUS ============ */}
        {serverOnline === null ? (
          <div className="rounded-xl border border-autronis-border bg-autronis-card p-4 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
            <span className="text-sm text-autronis-text-secondary">Verbinding controleren met generator...</span>
            <code className="text-xs bg-autronis-border/50 text-autronis-text-secondary px-1.5 py-0.5 rounded ml-auto">{GENERATOR_URL}</code>
          </div>
        ) : serverOnline ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="h-3 w-3 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 h-3 w-3 rounded-full bg-emerald-400 animate-ping opacity-40" />
            </div>
            <span className="text-sm font-semibold text-emerald-400">Verbonden</span>
            <code className="text-xs bg-autronis-border/50 text-autronis-text-secondary px-1.5 py-0.5 rounded">{GENERATOR_URL}</code>
            {lastPingTime && (
              <span className="text-xs text-autronis-text-tertiary ml-auto">Laatste ping: {lastPingTime.toLocaleTimeString("nl-NL")}</span>
            )}
            <button onClick={checkServer} className="text-autronis-text-tertiary hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-white/5 flex-shrink-0">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-red-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-red-400">Generator offline</span>
              <code className="text-xs bg-autronis-border/50 text-autronis-text-secondary px-1.5 py-0.5 rounded">{GENERATOR_URL}</code>
              <div className="flex-1" />
              <button onClick={checkServer} className="text-autronis-text-tertiary hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="rounded-lg bg-autronis-bg border border-autronis-border p-4 space-y-3">
              <p className="text-sm font-semibold text-autronis-text-secondary flex items-center gap-2">
                <Terminal className="h-4 w-4 text-autronis-accent" />
                Generator server starten
              </p>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/dev/start-server", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ server: "case-study" }),
                    });
                    const data = await res.json() as { status?: string; bericht?: string; url?: string };
                    if (data.status === "running" || data.status === "started") {
                      checkServer();
                    }
                  } catch { /* ignore */ }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-autronis-accent text-white rounded-xl text-sm font-semibold hover:bg-autronis-accent-hover transition-all"
              >
                <Terminal className="h-4 w-4" /> Start Case Study Server
              </button>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] text-autronis-text-tertiary bg-black/20 rounded-lg px-3 py-2 font-mono">
                  cd ../case-study-generator && npm run dev
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText("cd ../case-study-generator && npm run dev")}
                  className="flex-shrink-0 p-2 rounded-lg border border-autronis-border hover:border-autronis-accent/50 text-autronis-text-tertiary hover:text-autronis-accent transition-colors"
                  title="Kopieer commando"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-autronis-text-tertiary">Of start handmatig op {GENERATOR_URL}</p>
            </div>
          </div>
        )}

        {/* ============ EDIT MODAL ============ */}
        <AnimatePresence>
          {editSlug && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => { if (e.target === e.currentTarget) setEditSlug(null); }}
            >
              <motion.div
                className="w-full max-w-4xl rounded-2xl border border-autronis-border bg-autronis-card p-6 space-y-4 max-h-[80vh] flex flex-col"
                initial={{ opacity: 0, y: 32, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-autronis-text-primary">
                    Case Study Bewerken — <span className="text-autronis-accent">{editSlug}</span>
                  </h2>
                  <button
                    onClick={() => setEditSlug(null)}
                    className="text-autronis-text-tertiary hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 w-full rounded-xl border border-autronis-border bg-autronis-bg px-4 py-3 text-sm text-autronis-text-primary font-mono resize-none focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                />
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setEditSlug(null)}
                    className="px-4 py-2 rounded-lg text-sm text-autronis-text-secondary hover:text-white transition-colors"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={editSaving}
                    className="px-5 py-2 rounded-lg bg-autronis-accent text-autronis-bg font-bold text-sm hover:bg-autronis-accent-hover transition-all disabled:opacity-40"
                  >
                    {editSaving ? "Opslaan..." : "Opslaan"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ INLINE PREVIEW MODAL ============ */}
        <AnimatePresence>
          {previewSlug && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => { if (e.target === e.currentTarget) setPreviewSlug(null); }}
            >
              <motion.div
                className="w-full max-w-5xl h-[85vh] rounded-2xl border border-autronis-border bg-autronis-card flex flex-col overflow-hidden"
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between px-5 py-3 border-b border-autronis-border flex-shrink-0">
                  <span className="text-sm font-semibold text-autronis-text-primary">{previewSlug}</span>
                  <div className="flex items-center gap-3">
                    <a
                      href={`${GENERATOR_URL}/out/${previewSlug}/page.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-autronis-accent hover:text-autronis-accent-hover flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Nieuw tabblad
                    </a>
                    <button
                      onClick={() => setPreviewSlug(null)}
                      className="text-autronis-text-tertiary hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <iframe
                  src={`${GENERATOR_URL}/out/${previewSlug}/page.html`}
                  className="flex-1 w-full"
                  title={previewSlug}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ TAB CONTENT ============ */}
        <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >

        {/* ============ OVERZICHT TAB ============ */}
        {activeTab === "overzicht" && (
          <div className="space-y-4">
            {/* KPI balk */}
            {existing.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.25 }}
                  className="bg-autronis-card border border-autronis-border rounded-2xl p-4">
                  <p className="text-xs text-autronis-text-secondary mb-1">Case studies</p>
                  <p className="text-2xl font-bold text-autronis-accent tabular-nums">{existing.length}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.25 }}
                  className="bg-autronis-card border border-autronis-border rounded-2xl p-4">
                  <p className="text-xs text-autronis-text-secondary mb-1">Generator</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", serverOnline === null ? "bg-yellow-400 animate-pulse" : serverOnline ? "bg-emerald-400" : "bg-red-400")} />
                    <span className={cn("text-sm font-bold", serverOnline ? "text-emerald-400" : serverOnline === false ? "text-red-400" : "text-yellow-400")}>
                      {serverOnline === null ? "Controleren" : serverOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.25 }}
                  className="bg-autronis-card border border-autronis-border rounded-2xl p-4 sm:flex items-center justify-between hidden">
                  <div>
                    <p className="text-xs text-autronis-text-secondary mb-1">Weergave</p>
                    <p className="text-sm font-semibold text-autronis-text-primary">{viewMode === "list" ? "Lijst" : "Grid"}</p>
                  </div>
                  <div className="flex gap-1 bg-autronis-bg rounded-lg p-1">
                    <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-autronis-accent/20 text-autronis-accent" : "text-autronis-text-tertiary hover:text-autronis-text-primary")} title="Lijst">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-autronis-accent/20 text-autronis-accent" : "text-autronis-text-tertiary hover:text-autronis-text-primary")} title="Grid">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Filters */}
            {existing.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-autronis-text-tertiary" />
                  <input
                    value={filterKlant}
                    onChange={(e) => setFilterKlant(e.target.value)}
                    placeholder="Zoek op klant of titel..."
                    className={cn(inputClass, "pl-10")}
                  />
                </div>
                <span className="text-xs text-autronis-text-tertiary tabular-nums">
                  {filteredExisting.length} case {filteredExisting.length === 1 ? "study" : "studies"}
                </span>
                {/* Mobile view toggle */}
                <div className="flex gap-1 bg-autronis-bg border border-autronis-border rounded-lg p-1 sm:hidden">
                  <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-autronis-accent/20 text-autronis-accent" : "text-autronis-text-tertiary")}>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                  <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-autronis-accent/20 text-autronis-accent" : "text-autronis-text-tertiary")}>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                  </button>
                </div>
              </div>
            )}

            {filteredExisting.length === 0 && existing.length === 0 ? (
              <div className="space-y-4">
                {/* Empty message */}
                <div className="rounded-xl border border-dashed border-autronis-border/50 bg-autronis-card p-8 flex flex-col items-center text-center gap-4">
                  <Video className="h-10 w-10 text-autronis-text-tertiary/30" />
                  <div>
                    <p className="text-base font-semibold text-autronis-text-primary">Nog geen case studies</p>
                    <p className="text-sm text-autronis-text-secondary mt-1">Zo ziet een gegenereerde case study er uit:</p>
                  </div>
                  <button
                    onClick={() => setActiveTab("nieuw")}
                    className="inline-flex items-center gap-2 rounded-xl bg-autronis-accent px-5 py-2.5 text-sm font-bold text-autronis-bg hover:bg-autronis-accent-hover transition-all btn-press"
                  >
                    <Plus className="h-4 w-4" /> Eerste Case Study aanmaken
                  </button>
                </div>
                {/* Dummy voorbeeld card */}
                <div className="rounded-xl border border-autronis-border/30 bg-autronis-card/40 p-5 opacity-50 pointer-events-none select-none">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-20 h-14 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-emerald-400/40" />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400/80 px-2 py-0.5 rounded-full">Voorbeeld</span>
                      <h3 className="text-base font-bold text-autronis-text-primary mt-1.5">Jobby — 80% minder tijd op lead-opvolging</h3>
                      <p className="text-sm text-autronis-text-secondary mt-0.5">Hoe Autronis een CRM-automatisering bouwde die het salesteam 6 uur per week bespaart</p>
                      <div className="flex items-center gap-2 mt-3">
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-autronis-accent/10 border border-autronis-accent/20 px-3 py-1.5 text-[11px] font-semibold text-autronis-accent">
                          <Eye className="h-3 w-3" /> Bekijk
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-autronis-border px-3 py-1.5 text-[11px] font-semibold text-autronis-text-secondary">
                          <Edit3 className="h-3 w-3" /> Bewerk
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-autronis-border px-3 py-1.5 text-[11px] font-semibold text-autronis-text-secondary">
                          <Layers className="h-3 w-3" /> Hergebruik
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : filteredExisting.length === 0 ? (
              <div className="rounded-xl border border-autronis-border bg-autronis-card p-8 text-center">
                <p className="text-sm text-autronis-text-secondary">
                  Geen resultaten voor &ldquo;{filterKlant}&rdquo;
                </p>
              </div>
            ) : (
              <div className={cn(viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "grid gap-4")}>
                {filteredExisting.map((cs, i) => (
                  viewMode === "grid" ? (
                    <motion.div
                      key={cs.slug}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06, duration: 0.25 }}
                      className="rounded-xl border border-autronis-border bg-autronis-card card-glow hover:border-autronis-accent/30 transition-all group cursor-pointer overflow-hidden"
                      onClick={() => setPreviewSlug(cs.slug)}
                    >
                      {/* Grid thumbnail */}
                      <div className="w-full aspect-video bg-autronis-accent/10 relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <BarChart3 className="h-8 w-8 text-autronis-accent/30" />
                        </div>
                        <img
                          src={`${GENERATOR_URL}/out/${cs.slug}/banners/banner-metric-bold.png`}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-sm font-bold text-white">
                            <Eye className="h-4 w-4" /> Bekijk
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="text-sm font-bold text-autronis-text-primary line-clamp-2">{cs.titel}</h3>
                        <p className="text-xs text-autronis-text-secondary mt-1 truncate">{cs.subtitel}</p>
                        <div className="flex items-center gap-1.5 mt-3" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openEdit(cs.slug)} className={cn(actionBtnClass, "py-1 text-[11px]")}>
                            <Edit3 className="h-3 w-3" /> Bewerk
                          </button>
                          <button onClick={hergebruikTemplate} className={cn(actionBtnClass, "py-1 text-[11px]")}>
                            <Layers className="h-3 w-3" /> Hergebruik
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={cs.slug}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07, duration: 0.3 }}
                      className="rounded-xl border border-autronis-border bg-autronis-card p-5 card-glow hover:border-autronis-accent/20 transition-all group cursor-pointer"
                      onClick={() => setPreviewSlug(cs.slug)}
                    >
                      <div className="flex items-start gap-4">
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 w-20 h-14 rounded-lg bg-autronis-accent/10 border border-autronis-accent/20 overflow-hidden relative">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <BarChart3 className="h-6 w-6 text-autronis-accent/40" />
                          </div>
                          <img
                            src={`${GENERATOR_URL}/out/${cs.slug}/banners/banner-metric-bold.png`}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-base font-bold text-autronis-text-primary truncate group-hover:text-autronis-accent transition-colors">{cs.titel}</h3>
                              <p className="text-sm text-autronis-text-secondary truncate mt-0.5">{cs.subtitel}</p>
                            </div>
                            <code className="text-[10px] text-autronis-text-tertiary/60 flex-shrink-0 mt-1 font-mono hidden sm:block">{cs.slug}</code>
                          </div>

                          {/* Acties */}
                          <div className="flex items-center gap-2 mt-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => setPreviewSlug(cs.slug)} className={accentBtnClass}>
                              <Eye className="h-3.5 w-3.5" /> Bekijk
                            </button>
                            <button onClick={() => openEdit(cs.slug)} className={actionBtnClass}>
                              <Edit3 className="h-3.5 w-3.5" /> Bewerk
                            </button>
                            <a
                              href={`${GENERATOR_URL}/out/${cs.slug}/banners/banner-metric-bold.png`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={actionBtnClass}
                            >
                              <ImageIcon className="h-3.5 w-3.5" /> Banner
                            </a>
                            <a
                              href={`${GENERATOR_URL}/out/${cs.slug}/case-study.md`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={actionBtnClass}
                            >
                              <Share2 className="h-3.5 w-3.5" /> Markdown
                            </a>
                            <button onClick={hergebruikTemplate} className={actionBtnClass}>
                              <Layers className="h-3.5 w-3.5" /> Hergebruik
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ NIEUW TAB ============ */}
        {activeTab === "nieuw" && (
          <>
            {/* Form meta row: sub-tabs + completeness + draft */}
            <div className="flex items-center gap-3 flex-wrap">
            {/* Sub-tabs: Formulier / Preview */}
            <div className="flex gap-1 rounded-lg bg-autronis-bg border border-autronis-border p-1 w-fit">
              <button
                onClick={() => setFormTab("formulier")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-semibold transition-all",
                  formTab === "formulier" ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-white"
                )}
              >
                Formulier
              </button>
              <button
                onClick={() => setFormTab("preview")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-semibold transition-all",
                  formTab === "preview" ? "bg-autronis-accent text-autronis-bg" : "text-autronis-text-secondary hover:text-white"
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Preview
                </span>
              </button>
            </div>

            {/* Completeness + draft indicator */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <div className="flex-1 h-1.5 bg-autronis-bg rounded-full overflow-hidden border border-autronis-border">
                  <motion.div
                    className={cn("h-full rounded-full transition-colors", formVolledigheid === 100 ? "bg-emerald-500" : formVolledigheid > 50 ? "bg-autronis-accent" : "bg-autronis-accent/50")}
                    animate={{ width: `${formVolledigheid}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <span className="text-xs text-autronis-text-tertiary tabular-nums flex-shrink-0">{formVolledigheid}%</span>
              </div>
              <AnimatePresence>
                {draftSaved && (
                  <motion.span
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-autronis-text-tertiary flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Draft opgeslagen
                  </motion.span>
                )}
              </AnimatePresence>
              {(formState.klantnaam || formState.probleem) && (
                <button
                  type="button"
                  onClick={clearDraft}
                  className="text-xs text-autronis-text-tertiary hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Wis formulier
                </button>
              )}
            </div>

            </div>{/* end form meta row */}

            {/* ---- FORMULIER ---- */}
            {formTab === "formulier" && (
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                {/* Klant selectie uit dashboard */}
                <div className="rounded-xl border border-autronis-accent/20 bg-autronis-accent/5 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-autronis-accent" />
                    <span className={labelClass}>Klant selecteren uit dashboard</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-autronis-text-secondary">Klant</label>
                      <div className="relative">
                        <select
                          value={selectedKlantId ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "intern") {
                              handleKlantSelect(null);
                              setFormState(s => ({ ...s, klantnaam: "Autronis", klantBeschrijving: "AI- en automatiseringsbureau voor MKB", klantBranche: "AI & Automatisering" }));
                            } else {
                              handleKlantSelect(val ? Number(val) : null);
                            }
                          }}
                          className={selectClass}
                        >
                          <option value="">— Kies klant of vul handmatig in —</option>
                          <option value="intern">🏠 Intern project (Autronis)</option>
                          {klanten.map((k) => (
                            <option key={k.id} value={k.id}>{k.bedrijfsnaam}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-autronis-text-tertiary pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-autronis-text-secondary">Project</label>
                      <div className="relative">
                        <select
                          value={selectedProjectId ?? ""}
                          onChange={(e) => handleProjectSelect(e.target.value ? Number(e.target.value) : null)}
                          disabled={!selectedKlantId && formState.klantnaam !== "Autronis"}
                          className={cn(selectClass, "disabled:opacity-40 disabled:cursor-not-allowed")}
                        >
                          <option value="">— Kies project —</option>
                          {clientProjecten.map((p) => (
                            <option key={p.id} value={p.id}>{p.naam}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-autronis-text-tertiary pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Klantnaam + branche */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Klantnaam</label>
                    <input
                      name="klantnaam"
                      required
                      value={formState.klantnaam}
                      onChange={(e) => setFormState((s) => ({ ...s, klantnaam: e.target.value }))}
                      placeholder="Bijv. Jobby"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Branche</label>
                    <input
                      name="klantBranche"
                      value={formState.klantBranche}
                      onChange={(e) => setFormState((s) => ({ ...s, klantBranche: e.target.value }))}
                      placeholder="Bijv. HR-tech"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Klant beschrijving</label>
                  <textarea
                    name="klantBeschrijving"
                    rows={2}
                    value={formState.klantBeschrijving}
                    onChange={(e) => setFormState((s) => ({ ...s, klantBeschrijving: e.target.value }))}
                    placeholder="Wie is de klant?"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Probleem</label>
                  <textarea
                    name="probleem"
                    rows={2}
                    value={formState.probleem}
                    onChange={(e) => setFormState((s) => ({ ...s, probleem: e.target.value }))}
                    placeholder="Wat was het probleem?"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Probleem metric</label>
                    <input
                      name="probleemMetricWaarde"
                      value={formState.probleemMetricWaarde}
                      onChange={(e) => setFormState((s) => ({ ...s, probleemMetricWaarde: e.target.value }))}
                      placeholder="Bijv. 25 minuten per lead"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Metric label</label>
                    <input
                      name="probleemMetricLabel"
                      value={formState.probleemMetricLabel}
                      onChange={(e) => setFormState((s) => ({ ...s, probleemMetricLabel: e.target.value }))}
                      placeholder="Bijv. Tijd per lead"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Oplossing</label>
                  <textarea
                    name="oplossing"
                    rows={2}
                    value={formState.oplossing}
                    onChange={(e) => setFormState((s) => ({ ...s, oplossing: e.target.value }))}
                    placeholder="Wat heeft Autronis gebouwd?"
                    className={inputClass}
                  />
                </div>

                {/* Dynamische stappen */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className={labelClass}>Stappen</label>
                    <button
                      type="button"
                      onClick={addStap}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-autronis-accent hover:text-autronis-accent-hover transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Stap toevoegen
                    </button>
                  </div>
                  {stappen.map((stap, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-autronis-accent/10 flex items-center justify-center text-xs font-bold text-autronis-accent mt-1">
                        {i + 1}
                      </span>
                      <input
                        value={stap.titel}
                        onChange={(e) => updateStap(i, "titel", e.target.value)}
                        placeholder="Titel"
                        className={cn("flex-1", inputClass)}
                      />
                      <input
                        value={stap.beschrijving}
                        onChange={(e) => updateStap(i, "beschrijving", e.target.value)}
                        placeholder="Beschrijving"
                        className={cn("flex-1", inputClass)}
                      />
                      <button
                        type="button"
                        onClick={() => removeStap(i)}
                        disabled={stappen.length <= 2}
                        className="flex-shrink-0 p-2.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Multiple result metrics */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <label className={labelClass}>Resultaat metrics</label>
                      <span className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        Alleen de eerste metric wordt verwerkt
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addMetric}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-autronis-accent hover:text-autronis-accent-hover transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Metric toevoegen
                    </button>
                  </div>
                  {resultaatMetrics.map((metric, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex gap-3 items-start">
                        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-400 mt-1">
                          {i + 1}
                        </span>
                        <input
                          value={metric.label}
                          onChange={(e) => updateMetric(i, "label", e.target.value)}
                          placeholder="Label (bijv. Tijd per lead)"
                          className={cn("flex-[1.2]", inputClass)}
                        />
                        <input
                          value={metric.van}
                          onChange={(e) => updateMetric(i, "van", e.target.value)}
                          placeholder="Van (bijv. 25 min)"
                          className={cn("flex-1", inputClass)}
                        />
                        <ArrowRight className="flex-shrink-0 h-5 w-5 text-autronis-text-tertiary mt-3" />
                        <input
                          value={metric.naar}
                          onChange={(e) => updateMetric(i, "naar", e.target.value)}
                          placeholder="Naar (bijv. 5 min)"
                          className={cn("flex-1", inputClass)}
                        />
                        <button
                          type="button"
                          onClick={() => removeMetric(i)}
                          disabled={resultaatMetrics.length <= 1}
                          className="flex-shrink-0 p-2.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {/* Live van→naar preview */}
                      {(metric.van || metric.naar) && (
                        <div className="ml-11 flex items-center gap-2 text-xs">
                          {metric.label && <span className="text-autronis-text-tertiary">{metric.label}:</span>}
                          <span className="line-through text-red-400/70">{metric.van || "—"}</span>
                          <ArrowRight className="h-3 w-3 text-emerald-400" />
                          <span className="font-bold text-emerald-400">{metric.naar || "—"}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Extra context (optioneel)</label>
                  <textarea
                    name="extraContext"
                    rows={2}
                    value={formState.extraContext}
                    onChange={(e) => setFormState((s) => ({ ...s, extraContext: e.target.value }))}
                    placeholder="Eventuele extra informatie..."
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !serverOnline}
                  className="w-full rounded-xl bg-autronis-accent py-4 text-autronis-bg font-bold text-base hover:bg-autronis-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed btn-press shadow-lg shadow-autronis-accent/20"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Genereren...
                    </span>
                  ) : (
                    "Genereer Case Study"
                  )}
                </button>

                {/* Stap-voor-stap genereer progress */}
                <AnimatePresence>
                  {loading && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-xl border border-autronis-accent/20 bg-autronis-accent/5 p-5 space-y-4 overflow-hidden"
                    >
                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-autronis-accent">
                            {genereerStap <= GENEREER_STAPPEN.length
                              ? GENEREER_STAPPEN[Math.max(0, genereerStap - 1)]?.label ?? "Starten..."
                              : "Afronden..."}
                          </span>
                          <span className="text-xs text-autronis-text-tertiary tabular-nums">
                            {Math.min(genereerStap, GENEREER_STAPPEN.length)}/{GENEREER_STAPPEN.length}
                          </span>
                        </div>
                        <div className="h-1.5 bg-autronis-bg rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-autronis-accent rounded-full"
                            animate={{ width: `${(Math.min(genereerStap, GENEREER_STAPPEN.length) / GENEREER_STAPPEN.length) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                      {/* Step list */}
                      <div className="space-y-2">
                        {GENEREER_STAPPEN.map((stap, i) => {
                          const stepNum = i + 1;
                          const isActive = genereerStap === stepNum;
                          const isDone = genereerStap > stepNum;
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex items-center gap-3"
                            >
                              <div className={cn(
                                "h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300",
                                isDone ? "bg-emerald-500/20 text-emerald-400" :
                                isActive ? "bg-autronis-accent/20 text-autronis-accent" :
                                "bg-autronis-border/30 text-autronis-text-tertiary"
                              )}>
                                {isDone ? (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                                    <Check className="h-3 w-3" />
                                  </motion.div>
                                ) : isActive ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <div className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
                                )}
                              </div>
                              <span className={cn(
                                "text-sm transition-colors duration-300",
                                isDone ? "text-autronis-text-tertiary line-through" :
                                isActive ? "text-autronis-text-primary font-medium" :
                                "text-autronis-text-tertiary"
                              )}>
                                {stap.label}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            )}

            {/* ---- PREVIEW ---- */}
            {formTab === "preview" && (
              <div className="rounded-xl border border-autronis-border bg-autronis-card p-6 lg:p-8 space-y-8">
                <div className="text-center space-y-2">
                  <p className="text-xs font-semibold text-autronis-accent uppercase tracking-wider">
                    Case Study Preview
                  </p>
                  <h2 className="text-2xl font-bold text-autronis-text-primary">
                    {formState.klantnaam || "Klantnaam"}
                    {formState.klantBranche && (
                      <span className="text-autronis-text-secondary font-normal"> — {formState.klantBranche}</span>
                    )}
                  </h2>
                  {formState.klantBeschrijving && (
                    <p className="text-sm text-autronis-text-secondary max-w-lg mx-auto">
                      {formState.klantBeschrijving}
                    </p>
                  )}
                </div>

                {/* Probleem */}
                {formState.probleem && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Het probleem</h3>
                    <p className="text-autronis-text-primary">{formState.probleem}</p>
                    {formState.probleemMetricWaarde && (
                      <div className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-sm text-red-400">
                        <XCircle className="h-4 w-4" />
                        {formState.probleemMetricLabel && (
                          <span className="font-semibold">{formState.probleemMetricLabel}:</span>
                        )}
                        {formState.probleemMetricWaarde}
                      </div>
                    )}
                  </div>
                )}

                {/* Oplossing */}
                {formState.oplossing && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-autronis-accent uppercase tracking-wider">De oplossing</h3>
                    <p className="text-autronis-text-primary">{formState.oplossing}</p>
                  </div>
                )}

                {/* Stappen */}
                {stappen.some((s) => s.titel.trim()) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-autronis-accent uppercase tracking-wider">Aanpak</h3>
                    <div className="space-y-2">
                      {stappen
                        .filter((s) => s.titel.trim())
                        .map((stap, i) => (
                          <div key={i} className="flex gap-3 items-start">
                            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-autronis-accent/10 flex items-center justify-center text-xs font-bold text-autronis-accent">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-autronis-text-primary">{stap.titel}</p>
                              {stap.beschrijving && (
                                <p className="text-xs text-autronis-text-secondary">{stap.beschrijving}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Resultaat metrics */}
                {resultaatMetrics.some((m) => m.van || m.naar) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Resultaten</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {resultaatMetrics
                        .filter((m) => m.van || m.naar)
                        .map((metric, i) => (
                          <div key={i} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                            {metric.label && (
                              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                                {metric.label}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-autronis-text-secondary line-through">{metric.van}</span>
                              <ArrowRight className="h-4 w-4 text-emerald-400" />
                              <span className="text-sm font-bold text-emerald-400">{metric.naar}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!formState.klantnaam && !formState.probleem && !formState.oplossing && !resultaatMetrics.some((m) => m.van || m.naar) && (
                  <div className="text-center py-8">
                    <Sparkles className="h-8 w-8 text-autronis-text-tertiary mx-auto mb-3" />
                    <p className="text-sm text-autronis-text-secondary">Vul het formulier in om een preview te zien</p>
                  </div>
                )}

                <div className="pt-4 border-t border-autronis-border">
                  <button
                    onClick={() => setFormTab("formulier")}
                    className="text-sm font-semibold text-autronis-accent hover:text-autronis-accent-hover transition-colors"
                  >
                    &larr; Terug naar formulier
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* ============ RESULTAAT + OUTPUT ACTIONS ============ */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl border border-autronis-accent/20 bg-autronis-accent/5 p-6 space-y-5 card-glow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-400">Succesvol gegenereerd</span>
                    </div>
                    <h3 className="text-lg font-bold text-autronis-text-primary">{result.titel}</h3>
                    <p className="text-sm text-autronis-text-secondary mt-0.5">
                      Voiceover: {result.voiceoverDuur}s &middot; Slug: {result.slug}
                    </p>
                  </div>
                </div>

                {/* Quick links — staggered */}
                <motion.div
                  className="flex flex-wrap gap-2"
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
                >
                  {[
                    { href: `${GENERATOR_URL}${result.urls.page}`, label: "Case Study Pagina", icon: FileText },
                    { href: `${GENERATOR_URL}${result.urls.markdown}`, label: "Markdown", icon: Share2 },
                    ...result.urls.banners.map((url, i) => ({
                      href: `${GENERATOR_URL}${url}`,
                      label: `Banner ${i + 1}`,
                      icon: ImageIcon,
                    })),
                  ].map((link, i) => (
                    <motion.a
                      key={i}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={accentBtnClass}
                      variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                    >
                      <link.icon className="h-4 w-4" /> {link.label}
                    </motion.a>
                  ))}
                </motion.div>

                {/* Output acties — gegroepeerde dropdowns */}
                <div className="border-t border-autronis-border/50 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-autronis-text-tertiary uppercase tracking-wider">Publiceren & downloaden</p>
                  <div className="flex flex-wrap gap-2">
                    {/* Publiceer dropdown */}
                    <div className="relative" ref={publiceerRef}>
                      <button
                        onClick={() => { setPubliceerOpen(!publiceerOpen); setDownloadOpen(false); }}
                        className={cn(accentBtnClass)}
                      >
                        <Share2 className="h-4 w-4" /> Publiceer
                        <ChevronDown className={cn("h-3 w-3 transition-transform", publiceerOpen && "rotate-180")} />
                      </button>
                      <AnimatePresence>
                        {publiceerOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 top-full mt-1.5 w-44 bg-autronis-card border border-autronis-border rounded-xl shadow-xl overflow-hidden z-20"
                          >
                            <button
                              onClick={() => { openLinkedInPost(); setPubliceerOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-autronis-text-primary hover:bg-white/5 transition-colors"
                            >
                              <Linkedin className="h-3.5 w-3.5 text-blue-400" /> LinkedIn post
                            </button>
                            <button
                              onClick={() => { openInstagramBanner(); setPubliceerOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-autronis-text-primary hover:bg-white/5 transition-colors"
                            >
                              <ImageIcon className="h-3.5 w-3.5 text-pink-400" /> Instagram banner
                            </button>
                            <button
                              onClick={() => { openVideo(); setPubliceerOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-autronis-text-primary hover:bg-white/5 transition-colors"
                            >
                              <Video className="h-3.5 w-3.5 text-purple-400" /> Video
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Download dropdown */}
                    <div className="relative" ref={downloadRef}>
                      <button
                        onClick={() => { setDownloadOpen(!downloadOpen); setPubliceerOpen(false); }}
                        className={actionBtnClass}
                      >
                        <Download className="h-4 w-4" /> Download
                        <ChevronDown className={cn("h-3 w-3 transition-transform", downloadOpen && "rotate-180")} />
                      </button>
                      <AnimatePresence>
                        {downloadOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 top-full mt-1.5 w-44 bg-autronis-card border border-autronis-border rounded-xl shadow-xl overflow-hidden z-20"
                          >
                            <button
                              onClick={() => { downloadPdf(); setDownloadOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-autronis-text-primary hover:bg-white/5 transition-colors"
                            >
                              <FileText className="h-3.5 w-3.5 text-autronis-accent" /> PDF pagina
                            </button>
                            <button
                              onClick={() => { copyMarkdown(); setDownloadOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-autronis-text-primary hover:bg-white/5 transition-colors"
                            >
                              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-autronis-accent" />}
                              {copied ? "Gekopieerd!" : "Kopieer markdown"}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}

        </motion.div>
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
