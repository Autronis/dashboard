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
  ChevronRight,
  RefreshCw,
  Copy,
  Download,
  Linkedin,
  Clock,
  CheckCircle2,
  XCircle,
  Terminal,
  ArrowRight,
  Filter,
  Share2,
  Archive,
  ChevronDown,
  BarChart3,
  Building2,
  Sparkles,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const GENERATOR_URL = "http://localhost:3456";

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

type CaseStudyStatus = "concept" | "gepubliceerd" | "gearchiveerd";

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
  const [showInstructions, setShowInstructions] = useState(false);
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
  const [statusFilter, setStatusFilter] = useState<CaseStudyStatus | "alle">("alle");

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

  // Filtered projects for selected client
  const clientProjecten = useMemo(() => {
    if (!selectedKlantId) return [];
    return projecten.filter((p) => p.klantId === selectedKlantId);
  }, [selectedKlantId, projecten]);

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

  // ============ SUBMIT ============

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

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
        setResult(data);
        loadExisting();
      } else {
        setError(data.error ?? "Er is iets misgegaan");
      }
    } catch {
      setError("Kan geen verbinding maken met de Case Study Generator. Draai eerst: npm run web");
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
      setError("Kon markdown niet kopieren");
    }
  }

  function openLinkedInPost() {
    if (!result) return;
    const params = new URLSearchParams({
      caseStudy: result.titel,
      slug: result.slug,
    });
    window.open(`/content/posts?${params.toString()}`, "_blank");
  }

  function openInstagramBanner() {
    if (!result) return;
    const params = new URLSearchParams({
      caseStudy: result.titel,
      slug: result.slug,
    });
    window.open(`/content/banners?${params.toString()}`, "_blank");
  }

  function openVideo() {
    if (!result) return;
    const params = new URLSearchParams({
      caseStudy: result.titel,
      slug: result.slug,
    });
    window.open(`/content/videos?${params.toString()}`, "_blank");
  }

  function downloadPdf() {
    if (!result) return;
    window.open(`${GENERATOR_URL}${result.urls.page}`, "_blank");
  }

  // ============ STYLES ============

  const inputClass =
    "w-full rounded-xl border border-autronis-border bg-autronis-bg px-4 py-3 text-sm text-white placeholder:text-autronis-text-tertiary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-all";
  const labelClass = "text-sm font-semibold text-autronis-accent uppercase tracking-wider";
  const selectClass =
    "w-full rounded-xl border border-autronis-border bg-autronis-bg px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-all appearance-none cursor-pointer";
  const actionBtnClass =
    "inline-flex items-center gap-2 rounded-lg bg-white/5 border border-autronis-border px-3.5 py-2 text-xs font-semibold text-autronis-text-secondary hover:text-white hover:bg-white/10 transition-colors";
  const accentBtnClass =
    "inline-flex items-center gap-2 rounded-lg bg-autronis-accent/10 border border-autronis-accent/20 px-3.5 py-2 text-xs font-semibold text-autronis-accent hover:bg-autronis-accent/20 transition-colors";

  // Filtered existing case studies
  const filteredExisting = useMemo(() => {
    let list = existing;
    if (filterKlant) {
      list = list.filter(
        (cs) =>
          cs.titel.toLowerCase().includes(filterKlant.toLowerCase()) ||
          cs.subtitel.toLowerCase().includes(filterKlant.toLowerCase())
      );
    }
    return list;
  }, [existing, filterKlant]);

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Case Studies</h1>
            <p className="text-autronis-text-secondary mt-1">
              Genereer en beheer case studies voor klanten.
            </p>
          </div>
          <button
            onClick={() => {
              setActiveTab(activeTab === "nieuw" ? "overzicht" : "nieuw");
              setFormTab("formulier");
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-autronis-accent px-5 py-2.5 text-sm font-bold text-autronis-bg hover:bg-autronis-accent-hover transition-all btn-press shadow-lg shadow-autronis-accent/20"
          >
            {activeTab === "nieuw" ? (
              <>
                <Eye className="h-4 w-4" /> Overzicht
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Nieuwe Case Study
              </>
            )}
          </button>
        </div>

        {/* ============ SERVER STATUS ============ */}
        <div className="rounded-xl border border-autronis-border bg-autronis-card p-5 card-glow space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`h-3 w-3 rounded-full ${
                  serverOnline
                    ? "bg-emerald-400"
                    : serverOnline === false
                    ? "bg-red-400"
                    : "bg-yellow-400 animate-pulse"
                }`}
              />
              {serverOnline && (
                <div className="absolute inset-0 h-3 w-3 rounded-full bg-emerald-400 animate-ping opacity-40" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {serverOnline
                    ? "Online"
                    : serverOnline === false
                    ? "Offline"
                    : "Verbinding checken..."}
                </span>
                <code className="text-xs bg-autronis-border/50 text-autronis-text-secondary px-1.5 py-0.5 rounded">
                  {GENERATOR_URL}
                </code>
              </div>
              {lastPingTime && (
                <p className="text-xs text-autronis-text-tertiary mt-0.5">
                  Laatste ping: {lastPingTime.toLocaleTimeString("nl-NL")}
                </p>
              )}
            </div>
            <button
              onClick={checkServer}
              className="text-autronis-text-tertiary hover:text-autronis-accent transition-colors p-1.5 rounded-lg hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Start instructions */}
          {serverOnline === false && (
            <div className="space-y-2">
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-autronis-accent hover:text-autronis-accent-hover transition-colors"
              >
                <Terminal className="h-4 w-4" />
                Server starten
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showInstructions ? "rotate-180" : ""}`}
                />
              </button>
              {showInstructions && (
                <div className="rounded-lg bg-autronis-bg border border-autronis-border p-4 space-y-2">
                  <p className="text-sm text-autronis-text-secondary">
                    Start de case study generator in een terminal:
                  </p>
                  <code className="block text-sm text-autronis-accent bg-black/30 rounded-lg px-4 py-3 font-mono">
                    cd ../case-study-generator && npm run dev
                  </code>
                  <p className="text-xs text-autronis-text-tertiary">
                    De server draait vervolgens op {GENERATOR_URL}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit modal */}
        {editSlug && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8">
            <div className="w-full max-w-4xl rounded-2xl border border-autronis-border bg-autronis-card p-6 space-y-4 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">
                  Case Study Bewerken — {editSlug}
                </h2>
                <button
                  onClick={() => setEditSlug(null)}
                  className="text-autronis-text-tertiary hover:text-white text-xl"
                >
                  &times;
                </button>
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full rounded-xl border border-autronis-border bg-autronis-bg px-4 py-3 text-sm text-white font-mono resize-none focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
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
            </div>
          </div>
        )}

        {/* ============ OVERZICHT TAB ============ */}
        {activeTab === "overzicht" && (
          <div className="space-y-4">
            {/* Filters */}
            {existing.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-autronis-text-tertiary" />
                  <input
                    value={filterKlant}
                    onChange={(e) => setFilterKlant(e.target.value)}
                    placeholder="Zoek op klant of titel..."
                    className={`${inputClass} pl-10`}
                  />
                </div>
                <span className="text-xs text-autronis-text-tertiary tabular-nums">
                  {filteredExisting.length} case {filteredExisting.length === 1 ? "study" : "studies"}
                </span>
              </div>
            )}

            {filteredExisting.length === 0 && existing.length === 0 ? (
              <div className="rounded-xl border border-autronis-border bg-autronis-card p-12 text-center card-glow">
                <Video className="h-12 w-12 text-autronis-text-tertiary mx-auto mb-4" />
                <p className="text-lg font-semibold text-white mb-2">Nog geen case studies</p>
                <p className="text-sm text-autronis-text-secondary mb-6">
                  Maak je eerste case study aan via het formulier.
                </p>
                <button
                  onClick={() => setActiveTab("nieuw")}
                  className="inline-flex items-center gap-2 rounded-xl bg-autronis-accent px-5 py-2.5 text-sm font-bold text-autronis-bg hover:bg-autronis-accent-hover transition-all btn-press"
                >
                  <Plus className="h-4 w-4" /> Nieuwe Case Study
                </button>
              </div>
            ) : filteredExisting.length === 0 ? (
              <div className="rounded-xl border border-autronis-border bg-autronis-card p-8 text-center">
                <p className="text-sm text-autronis-text-secondary">
                  Geen resultaten voor &ldquo;{filterKlant}&rdquo;
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredExisting.map((cs) => (
                  <div
                    key={cs.slug}
                    className="rounded-xl border border-autronis-border bg-autronis-card p-5 card-glow hover:border-autronis-accent/20 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      {/* Thumbnail / icon */}
                      <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-autronis-accent/10 border border-autronis-accent/20 flex items-center justify-center">
                        <BarChart3 className="h-7 w-7 text-autronis-accent" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-base font-bold text-white truncate">{cs.titel}</h3>
                            <p className="text-sm text-autronis-text-secondary truncate mt-0.5">
                              {cs.subtitel}
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <a
                            href={`${GENERATOR_URL}/out/${cs.slug}/page.html`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={accentBtnClass}
                          >
                            <Eye className="h-3.5 w-3.5" /> Bekijk
                          </a>
                          <button onClick={() => openEdit(cs.slug)} className={actionBtnClass}>
                            <Edit3 className="h-3.5 w-3.5" /> Bewerk
                          </button>
                          <a
                            href={`${GENERATOR_URL}/out/${cs.slug}/banners/banner-metric-bold.png`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={actionBtnClass}
                          >
                            <ImageIcon className="h-3.5 w-3.5" /> Banners
                          </a>
                          <a
                            href={`${GENERATOR_URL}/out/${cs.slug}/page.html`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={actionBtnClass}
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </a>
                          <a
                            href={`${GENERATOR_URL}/out/${cs.slug}/case-study.md`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={actionBtnClass}
                          >
                            <Share2 className="h-3.5 w-3.5" /> Markdown
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ NIEUW TAB ============ */}
        {activeTab === "nieuw" && (
          <>
            {/* Sub-tabs: Formulier / Preview */}
            <div className="flex gap-1 rounded-lg bg-autronis-bg border border-autronis-border p-1 w-fit">
              <button
                onClick={() => setFormTab("formulier")}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                  formTab === "formulier"
                    ? "bg-autronis-accent text-autronis-bg"
                    : "text-autronis-text-secondary hover:text-white"
                }`}
              >
                Formulier
              </button>
              <button
                onClick={() => setFormTab("preview")}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                  formTab === "preview"
                    ? "bg-autronis-accent text-autronis-bg"
                    : "text-autronis-text-secondary hover:text-white"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Preview
                </span>
              </button>
            </div>

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
                          onChange={(e) =>
                            handleKlantSelect(e.target.value ? Number(e.target.value) : null)
                          }
                          className={selectClass}
                        >
                          <option value="">— Kies klant of vul handmatig in —</option>
                          {klanten.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.bedrijfsnaam}
                            </option>
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
                          onChange={(e) =>
                            handleProjectSelect(e.target.value ? Number(e.target.value) : null)
                          }
                          disabled={!selectedKlantId}
                          className={`${selectClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          <option value="">— Kies project —</option>
                          {clientProjecten.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.naam}
                            </option>
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
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, klantBeschrijving: e.target.value }))
                    }
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
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, probleemMetricWaarde: e.target.value }))
                      }
                      placeholder="Bijv. 25 minuten per lead"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Metric label</label>
                    <input
                      name="probleemMetricLabel"
                      value={formState.probleemMetricLabel}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, probleemMetricLabel: e.target.value }))
                      }
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
                        className={`flex-1 ${inputClass}`}
                      />
                      <input
                        value={stap.beschrijving}
                        onChange={(e) => updateStap(i, "beschrijving", e.target.value)}
                        placeholder="Beschrijving"
                        className={`flex-1 ${inputClass}`}
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
                    <label className={labelClass}>Resultaat metrics</label>
                    <button
                      type="button"
                      onClick={addMetric}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-autronis-accent hover:text-autronis-accent-hover transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Metric toevoegen
                    </button>
                  </div>
                  {resultaatMetrics.map((metric, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-400 mt-1">
                        {i + 1}
                      </span>
                      <input
                        value={metric.label}
                        onChange={(e) => updateMetric(i, "label", e.target.value)}
                        placeholder="Label (bijv. Tijd per lead)"
                        className={`flex-[1.2] ${inputClass}`}
                      />
                      <input
                        value={metric.van}
                        onChange={(e) => updateMetric(i, "van", e.target.value)}
                        placeholder="Van (bijv. 25 min)"
                        className={`flex-1 ${inputClass}`}
                      />
                      <ArrowRight className="flex-shrink-0 h-5 w-5 text-autronis-text-tertiary mt-3" />
                      <input
                        value={metric.naar}
                        onChange={(e) => updateMetric(i, "naar", e.target.value)}
                        placeholder="Naar (bijv. 5 min)"
                        className={`flex-1 ${inputClass}`}
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
                      Genereren... (±30 seconden)
                    </span>
                  ) : (
                    "Genereer Case Study"
                  )}
                </button>
              </form>
            )}

            {/* ---- PREVIEW ---- */}
            {formTab === "preview" && (
              <div className="rounded-xl border border-autronis-border bg-autronis-card p-6 lg:p-8 space-y-8">
                <div className="text-center space-y-2">
                  <p className="text-xs font-semibold text-autronis-accent uppercase tracking-wider">
                    Case Study Preview
                  </p>
                  <h2 className="text-2xl font-bold text-white">
                    {formState.klantnaam || "Klantnaam"}
                    {formState.klantBranche && (
                      <span className="text-autronis-text-secondary font-normal">
                        {" "}
                        — {formState.klantBranche}
                      </span>
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
                    <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
                      Het probleem
                    </h3>
                    <p className="text-white">{formState.probleem}</p>
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
                    <h3 className="text-sm font-semibold text-autronis-accent uppercase tracking-wider">
                      De oplossing
                    </h3>
                    <p className="text-white">{formState.oplossing}</p>
                  </div>
                )}

                {/* Stappen */}
                {stappen.some((s) => s.titel.trim()) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-autronis-accent uppercase tracking-wider">
                      Aanpak
                    </h3>
                    <div className="space-y-2">
                      {stappen
                        .filter((s) => s.titel.trim())
                        .map((stap, i) => (
                          <div key={i} className="flex gap-3 items-start">
                            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-autronis-accent/10 flex items-center justify-center text-xs font-bold text-autronis-accent">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-white">{stap.titel}</p>
                              {stap.beschrijving && (
                                <p className="text-xs text-autronis-text-secondary">
                                  {stap.beschrijving}
                                </p>
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
                    <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">
                      Resultaten
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {resultaatMetrics
                        .filter((m) => m.van || m.naar)
                        .map((metric, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2"
                          >
                            {metric.label && (
                              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                                {metric.label}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-autronis-text-secondary line-through">
                                {metric.van}
                              </span>
                              <ArrowRight className="h-4 w-4 text-emerald-400" />
                              <span className="text-sm font-bold text-emerald-400">
                                {metric.naar}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!formState.klantnaam &&
                  !formState.probleem &&
                  !formState.oplossing &&
                  !resultaatMetrics.some((m) => m.van || m.naar) && (
                    <div className="text-center py-8">
                      <Sparkles className="h-8 w-8 text-autronis-text-tertiary mx-auto mb-3" />
                      <p className="text-sm text-autronis-text-secondary">
                        Vul het formulier in om een preview te zien
                      </p>
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
              <div className="rounded-xl border border-autronis-accent/20 bg-autronis-accent/5 p-6 space-y-5 card-glow">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-400">
                        Succesvol gegenereerd
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{result.titel}</h3>
                    <p className="text-sm text-autronis-text-secondary mt-0.5">
                      Voiceover: {result.voiceoverDuur}s &middot; Slug: {result.slug}
                    </p>
                  </div>
                </div>

                {/* Quick links */}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`${GENERATOR_URL}${result.urls.page}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={accentBtnClass}
                  >
                    <FileText className="h-4 w-4" /> Case Study Pagina
                  </a>
                  <a
                    href={`${GENERATOR_URL}${result.urls.markdown}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={accentBtnClass}
                  >
                    <FileText className="h-4 w-4" /> Markdown
                  </a>
                  {result.urls.banners.map((url, i) => (
                    <a
                      key={i}
                      href={`${GENERATOR_URL}${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={accentBtnClass}
                    >
                      <ImageIcon className="h-4 w-4" /> Banner {i + 1}
                    </a>
                  ))}
                </div>

                {/* Output actions */}
                <div className="border-t border-autronis-border/50 pt-4">
                  <p className="text-xs font-semibold text-autronis-text-tertiary uppercase tracking-wider mb-3">
                    Acties
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={openLinkedInPost} className={actionBtnClass}>
                      <Linkedin className="h-4 w-4" /> Maak LinkedIn post
                    </button>
                    <button onClick={openInstagramBanner} className={actionBtnClass}>
                      <ImageIcon className="h-4 w-4" /> Maak Instagram banner
                    </button>
                    <button onClick={openVideo} className={actionBtnClass}>
                      <Video className="h-4 w-4" /> Maak video
                    </button>
                    <button onClick={downloadPdf} className={actionBtnClass}>
                      <Download className="h-4 w-4" /> Download PDF
                    </button>
                    <button onClick={copyMarkdown} className={actionBtnClass}>
                      <Copy className="h-4 w-4" /> {copied ? "Gekopieerd!" : "Kopieer tekst"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
