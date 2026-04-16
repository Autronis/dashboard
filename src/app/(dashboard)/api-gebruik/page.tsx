"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ExternalLink, RefreshCw, Loader2, Plus,
  Brain, Mail, Video, Database, CreditCard, Globe,
  ChevronRight, X,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────

interface ServiceEntry {
  id: number;
  naam: string;
  slug: string;
  categorie: string;
  omschrijving: string | null;
  dashboardUrl: string | null;
  kostenType: string;
  status: "actief" | "niet_geconfigureerd";
  laatsteCall?: string | null;
  gebruik?: {
    verbruikt: string;
    limiet?: string;
    eenheid: string;
    percentage?: number;
    details?: string;
  };
  fout?: string;
}

interface AiProvider {
  naam: string;
  calls: number;
  tokens: { input: number; output: number; totaal: number };
  kostenEuro: string;
  laatsteCall: string | null;
}

interface AiDetail {
  totaalKostenEuro: string;
  totaalCalls: number;
  providers: AiProvider[];
}

interface RouteBreakdown {
  route: string;
  provider: string;
  aantalCalls: number;
  kostenCent: number;
  tokens: number;
}

// ── Constants ──────────────────────────────────────────

const categorieIcons: Record<string, typeof Brain> = {
  ai: Brain, email: Mail, media: Video,
  data: Database, betaal: CreditCard, overig: Globe,
};

const categorieLabels: Record<string, string> = {
  ai: "AI & Taal", email: "E-mail", media: "Media & Video",
  data: "Data & Opslag", betaal: "Betaal & Bank", overig: "Overig",
};

const ROUTE_LABELS: Record<string, string> = {
  "/api/ai/chat": "AI Chat",
  "/api/yt-knowledge/analyze": "YouTube Analyse",
  "/api/agenda/ai-plan": "Agenda AI Planning",
  "/api/agenda/taken/schat-duur": "Taak Duurschatting",
  "/api/second-brain/verwerken": "Second Brain",
  "/api/second-brain/zoeken": "Second Brain Zoeken",
  "/api/bank/transacties/analyse": "Bank Analyse",
  "/api/bank/bonnetje": "Bonnetje Scan",
  "/api/bank/email-factuur": "Email Factuur",
  "/api/contract-analyse": "Contract Analyse",
  "/api/documenten/ai-create": "Document Generatie",
  "/api/belasting/tips/genereer": "Belasting Tips",
  "/api/ideeen/analyse": "Ideeën Analyse",
  "/api/mealplan": "Mealplan",
  "/api/mealplan/chat": "Mealplan Chat",
  "/api/radar/vraag-claude": "Radar Vraag",
  "/api/radar/week-samenvatting": "Radar Samenvatting",
  "/api/ops-room/orchestrate": "Ops Room",
  "/api/ops-room/execute": "Ops Room Execute",
  "/api/animaties/generate": "Animatie Generatie",
  "/api/content/videos/chat": "Video Chat",
  "/api/meetings/transcript": "Meeting Transcript",
  "/api/meetings/verwerk": "Meeting Verwerking",
  "/api/klanten/verrijk": "Klant Verrijking",
  "/api/screen-time/sessies": "Screen Time Sessies",
  "/api/uitgaven/scan": "Uitgaven Scan",
  "ai/client": "AI Client (Groq/Anthropic)",
};

const kostenTypeBadge: Record<string, { label: string; className: string }> = {
  usage: { label: "usage-based", className: "bg-autronis-accent/15 text-autronis-accent" },
  infra: { label: "infra", className: "bg-blue-500/15 text-blue-400" },
  gratis: { label: "gratis", className: "bg-emerald-500/10 text-emerald-400" },
};

// ── Helpers ────────────────────────────────────────────

function timeAgo(isoString: string | null | undefined): string | null {
  if (!isoString) return null;
  const date = new Date(isoString.replace(" ", "T") + "Z");
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "zojuist";
  if (diffMin < 60) return `${diffMin} min geleden`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} uur geleden`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d geleden`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

// ── Add Service Modal ──────────────────────────────────

function AddServiceModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [naam, setNaam] = useState("");
  const [categorie, setCategorie] = useState("overig");
  const [omschrijving, setOmschrijving] = useState("");
  const [envVar, setEnvVar] = useState("");
  const [dashboardUrl, setDashboardUrl] = useState("");
  const [kostenType, setKostenType] = useState("infra");
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const handleSave = async () => {
    if (!naam.trim()) { addToast("Naam is verplicht", "fout"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/api-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: naam.trim(),
          categorie,
          omschrijving: omschrijving.trim() || null,
          envVar: envVar.trim() || null,
          dashboardUrl: dashboardUrl.trim() || null,
          kostenType,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Kon service niet toevoegen");
      }
      addToast("Service toegevoegd", "succes");
      onAdded();
      onClose();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Fout", "fout");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent/50 transition-colors";
  const labelClass = "block text-xs font-medium text-autronis-text-secondary mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-autronis-text-primary">Service toevoegen</h2>
          <button onClick={onClose} className="text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Naam *</label>
            <input className={inputClass} value={naam} onChange={e => setNaam(e.target.value)} placeholder="Bijv. Stripe" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Categorie</label>
              <select className={inputClass} value={categorie} onChange={e => setCategorie(e.target.value)}>
                {Object.entries(categorieLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Kosten type</label>
              <select className={inputClass} value={kostenType} onChange={e => setKostenType(e.target.value)}>
                <option value="usage">Usage-based</option>
                <option value="infra">Infra (abonnement)</option>
                <option value="gratis">Gratis</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Omschrijving</label>
            <input className={inputClass} value={omschrijving} onChange={e => setOmschrijving(e.target.value)} placeholder="Wat doet deze service?" />
          </div>
          <div>
            <label className={labelClass}>Env variable naam</label>
            <input className={inputClass} value={envVar} onChange={e => setEnvVar(e.target.value)} placeholder="Bijv. STRIPE_API_KEY" />
          </div>
          <div>
            <label className={labelClass}>Dashboard URL</label>
            <input className={inputClass} value={dashboardUrl} onChange={e => setDashboardUrl(e.target.value)} placeholder="https://dashboard.stripe.com" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !naam.trim()}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-autronis-accent text-white hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : "Toevoegen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────

export default function ApiGebruikPage() {
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [aiDetail, setAiDetail] = useState<AiDetail | null>(null);
  const [routeBreakdown, setRouteBreakdown] = useState<RouteBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const { addToast } = useToast();

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/api-gebruik");
      if (!res.ok) throw new Error("Kon API gebruik niet ophalen");
      const data = await res.json();
      setServices(data.services ?? []);
      setAiDetail(data.aiDetail ?? null);
      setRouteBreakdown(data.routeBreakdown ?? []);
      if (isRefresh) addToast("Gebruik ververst", "succes");
    } catch {
      addToast("Fout bij ophalen API gebruik", "fout");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeCount = services.filter(s => s.status === "actief").length;
  const nonAiServices = services.filter(s => s.categorie !== "ai");
  const grouped = nonAiServices.reduce<Record<string, ServiceEntry[]>>((acc, svc) => {
    if (!acc[svc.categorie]) acc[svc.categorie] = [];
    acc[svc.categorie].push(svc);
    return acc;
  }, {});
  const categoryOrder = ["media", "email", "data", "betaal", "overig"];

  const currentMonth = new Date().toLocaleDateString("nl-NL", { month: "long", year: "numeric" });

  return (
    <PageTransition>
      <div className="space-y-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary">API Gebruik</h1>
            <p className="text-sm text-autronis-text-secondary mt-1">
              Alle services in één overzicht — live status en kosten
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-card border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/30 transition-all disabled:opacity-50"
            >
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Verversen
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-card border border-autronis-accent/30 text-sm text-autronis-accent hover:bg-autronis-accent/10 transition-all"
            >
              <Plus size={14} />
              Service toevoegen
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-autronis-accent" />
          </div>
        )}

        {!loading && (
          <>
            {/* ── Zone 1: Status Grid ── */}
            <div>
              <h2 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-3">
                Alle Services ({activeCount}/{services.length} actief)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                {services.map(svc => {
                  const isActive = svc.status === "actief";
                  const ago = timeAgo(svc.laatsteCall);
                  return (
                    <div
                      key={svc.slug}
                      className="bg-autronis-card border border-autronis-border rounded-xl px-3 py-2.5 flex items-center gap-2.5 hover:border-autronis-border/80 transition-colors"
                    >
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isActive
                            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                            : "bg-neutral-600"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className={`text-xs font-medium truncate ${isActive ? "text-autronis-text-primary" : "text-autronis-text-secondary/50"}`}>
                          {svc.naam}
                        </div>
                        {ago && (
                          <div className="text-[10px] text-autronis-text-secondary/60">{ago}</div>
                        )}
                        {!ago && isActive && (
                          <div className="text-[10px] text-autronis-text-secondary/40">actief</div>
                        )}
                        {!isActive && (
                          <div className="text-[10px] text-autronis-text-secondary/30">niet geconfigureerd</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Zone 2: AI Kosten Detail ── */}
            {aiDetail && (
              <div className="bg-autronis-card border border-autronis-accent/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-autronis-accent/10">
                      <Brain size={20} className="text-autronis-accent" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-autronis-text-primary">
                        AI Kosten — {currentMonth}
                      </h2>
                      <p className="text-xs text-autronis-text-secondary">
                        {aiDetail.totaalCalls.toLocaleString("nl-NL")} calls deze maand
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-autronis-accent">
                      &euro;{aiDetail.totaalKostenEuro}
                    </div>
                  </div>
                </div>

                {/* Provider cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {aiDetail.providers.map(p => (
                    <div key={p.naam} className="bg-autronis-bg/50 border border-autronis-border/50 rounded-xl p-4">
                      <div className="text-sm font-semibold text-autronis-text-primary">{p.naam}</div>
                      <div className="text-xs text-autronis-text-secondary mt-0.5">
                        {p.calls.toLocaleString("nl-NL")} calls · {formatTokens(p.tokens.totaal)} tokens
                      </div>
                      <div className={`text-xl font-bold mt-2 ${Number(p.kostenEuro) === 0 ? "text-emerald-400" : "text-autronis-accent"}`}>
                        {Number(p.kostenEuro) === 0 ? (
                          <>&euro;0,00 <span className="text-xs font-normal">gratis</span></>
                        ) : (
                          `€${p.kostenEuro}`
                        )}
                      </div>
                      {p.laatsteCall && (
                        <div className="text-[10px] text-autronis-text-secondary/50 mt-1">
                          Laatste call: {timeAgo(p.laatsteCall)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Route breakdown table */}
                {routeBreakdown.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-3">
                      Kosten per Feature
                    </h3>
                    <div className="bg-autronis-bg/30 border border-autronis-border/50 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-autronis-border/50">
                            <th className="text-left p-3 text-xs font-semibold text-autronis-text-secondary">Feature</th>
                            <th className="text-left p-3 text-xs font-semibold text-autronis-text-secondary">Provider</th>
                            <th className="text-right p-3 text-xs font-semibold text-autronis-text-secondary">Calls</th>
                            <th className="text-right p-3 text-xs font-semibold text-autronis-text-secondary">Tokens</th>
                            <th className="text-right p-3 text-xs font-semibold text-autronis-text-secondary">Kosten</th>
                          </tr>
                        </thead>
                        <tbody>
                          {routeBreakdown.map((r, i) => {
                            const maxKosten = routeBreakdown[0]?.kostenCent || 1;
                            const barWidth = Math.max(4, (r.kostenCent / maxKosten) * 100);
                            return (
                              <tr key={i} className="border-b border-autronis-border/30 last:border-0 hover:bg-autronis-accent/5 transition-colors">
                                <td className="p-3">
                                  <span className="text-autronis-text-primary font-medium">
                                    {ROUTE_LABELS[r.route || ""] || r.route || "Onbekend"}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    r.provider === "anthropic" ? "bg-orange-500/10 text-orange-400" :
                                    r.provider === "openai" ? "bg-emerald-500/10 text-emerald-400" :
                                    "bg-blue-500/10 text-blue-400"
                                  }`}>
                                    {r.provider === "anthropic" ? "Claude" : r.provider === "openai" ? "GPT" : r.provider}
                                  </span>
                                </td>
                                <td className="p-3 text-right text-autronis-text-secondary">{r.aantalCalls}</td>
                                <td className="p-3 text-right text-autronis-text-secondary">
                                  {r.tokens >= 1_000_000 ? `${(r.tokens / 1_000_000).toFixed(1)}M` :
                                   r.tokens >= 1_000 ? `${(r.tokens / 1_000).toFixed(1)}K` :
                                   r.tokens}
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-1.5 bg-autronis-border rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-autronis-accent rounded-full"
                                        style={{ width: `${barWidth}%` }}
                                      />
                                    </div>
                                    <span className="text-autronis-text-primary font-medium min-w-[60px] text-right">
                                      {r.kostenCent > 0 ? `€${(r.kostenCent / 100).toFixed(2)}` : "Gratis"}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Zone 3: Service Rijen per Categorie ── */}
            <div className="space-y-6">
              {categoryOrder.map(cat => {
                const entries = grouped[cat];
                if (!entries || entries.length === 0) return null;
                const CatIcon = categorieIcons[cat] || Globe;

                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <CatIcon size={16} className="text-autronis-accent" />
                      <h2 className="text-sm font-semibold text-autronis-text-secondary">
                        {categorieLabels[cat]}
                      </h2>
                    </div>
                    <div className="space-y-2">
                      {entries.map(svc => {
                        const isActive = svc.status === "actief";
                        const badge = kostenTypeBadge[svc.kostenType] || kostenTypeBadge.infra;
                        const isExpanded = expandedSlug === svc.slug;

                        return (
                          <div key={svc.slug}>
                            <div
                              onClick={() => setExpandedSlug(isExpanded ? null : svc.slug)}
                              className={`bg-autronis-card border border-autronis-border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:border-autronis-accent/20 transition-all ${
                                isExpanded ? "rounded-b-none border-b-transparent" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    isActive
                                      ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                                      : "bg-neutral-600"
                                  }`}
                                />
                                <div className="min-w-0">
                                  <span className={`text-sm font-medium ${isActive ? "text-autronis-text-primary" : "text-autronis-text-secondary/50"}`}>
                                    {svc.naam}
                                  </span>
                                  {svc.omschrijving && (
                                    <span className="text-xs text-autronis-text-secondary ml-2 hidden sm:inline">
                                      {svc.omschrijving}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                {svc.gebruik && (
                                  <span className="text-xs text-autronis-text-secondary hidden md:inline">
                                    {svc.gebruik.verbruikt} {svc.gebruik.eenheid}
                                  </span>
                                )}
                                <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-medium ${badge.className}`}>
                                  {badge.label}
                                </span>
                                {svc.dashboardUrl && (
                                  <a
                                    href={svc.dashboardUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-autronis-accent hover:text-autronis-accent-hover transition-colors"
                                  >
                                    <ExternalLink size={13} />
                                  </a>
                                )}
                                <ChevronRight
                                  size={14}
                                  className={`text-autronis-text-secondary/30 transition-transform duration-200 ${
                                    isExpanded ? "rotate-90" : ""
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && (
                              <div className="bg-autronis-bg/50 border border-autronis-border border-t-0 rounded-b-xl px-4 py-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <div className="text-autronis-text-secondary/50 uppercase tracking-wider mb-1">Status</div>
                                    <div className={isActive ? "text-emerald-400" : "text-autronis-text-secondary/50"}>
                                      {isActive ? "Actief" : "Niet geconfigureerd"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-autronis-text-secondary/50 uppercase tracking-wider mb-1">Kosten type</div>
                                    <div className="text-autronis-text-primary">{badge.label}</div>
                                  </div>
                                  {svc.gebruik && (
                                    <div>
                                      <div className="text-autronis-text-secondary/50 uppercase tracking-wider mb-1">Gebruik</div>
                                      <div className="text-autronis-text-primary">{svc.gebruik.verbruikt} {svc.gebruik.eenheid}</div>
                                      {svc.gebruik.details && (
                                        <div className="text-autronis-text-secondary/50 mt-0.5">{svc.gebruik.details}</div>
                                      )}
                                    </div>
                                  )}
                                  {svc.dashboardUrl && (
                                    <div>
                                      <div className="text-autronis-text-secondary/50 uppercase tracking-wider mb-1">Dashboard</div>
                                      <a
                                        href={svc.dashboardUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-autronis-accent hover:text-autronis-accent-hover transition-colors inline-flex items-center gap-1"
                                      >
                                        Openen <ExternalLink size={10} />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Add Service Modal */}
        {showAddModal && (
          <AddServiceModal
            onClose={() => setShowAddModal(false)}
            onAdded={() => fetchData(true)}
          />
        )}
      </div>
    </PageTransition>
  );
}
