"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Archive,
  FolderKanban,
  Clock,
  Euro,
  TrendingUp,
  Plus,
  Mail,
  Phone,
  MapPin,
  User,
  FileText,
  Link2,
  ExternalLink,
  Trash2,
  Globe,
  Building2,
  Receipt,
  FileCheck,
  CalendarDays,
  MessageSquare,
  Sparkles,
  CreditCard,
  Timer,
  Hash,
  Loader2,
  Share2,
  Copy,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn, formatUren, formatBedrag, formatDatum, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useKlantDetail, NotFoundError } from "@/hooks/queries/use-klant-detail";
import type { TijdlijnItem, NextAction } from "@/hooks/queries/use-klant-detail";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageTransition } from "@/components/ui/page-transition";
import { KlantModal } from "../klant-modal";
import { ProjectModal } from "./project-modal";
import { NoteModal } from "./note-modal";
import { DocumentModal } from "./document-modal";

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  actief: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Actief" },
  afgerond: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Afgerond" },
  "on-hold": { bg: "bg-amber-500/15", text: "text-amber-400", label: "On hold" },
  inactief: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Inactief" },
};

const notitieTypeConfig: Record<string, { border: string; label: string; badge: string }> = {
  belangrijk: {
    border: "border-l-red-500",
    label: "Belangrijk",
    badge: "bg-red-500/15 text-red-400",
  },
  afspraak: {
    border: "border-l-green-500",
    label: "Afspraak",
    badge: "bg-emerald-500/15 text-emerald-400",
  },
  notitie: {
    border: "border-l-slate-500",
    label: "Notitie",
    badge: "bg-slate-500/15 text-slate-400",
  },
};

const docTypeConfig: Record<string, { icon: typeof FileText; color: string }> = {
  contract: { icon: FileText, color: "text-red-400" },
  offerte: { icon: FileText, color: "text-amber-400" },
  link: { icon: Link2, color: "text-autronis-accent" },
  overig: { icon: FileText, color: "text-slate-400" },
};

const factuurStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
  concept: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Concept" },
  verzonden: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Verzonden" },
  betaald: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Betaald" },
  te_laat: { bg: "bg-red-500/15", text: "text-red-400", label: "Te laat" },
};

const tijdlijnTypeConfig: Record<string, { icon: typeof FileText; color: string; bg: string }> = {
  factuur: { icon: Receipt, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  offerte: { icon: FileCheck, color: "text-blue-400", bg: "bg-blue-500/10" },
  meeting: { icon: CalendarDays, color: "text-purple-400", bg: "bg-purple-500/10" },
  notitie: { icon: MessageSquare, color: "text-amber-400", bg: "bg-amber-500/10" },
  tijdregistratie: { icon: Clock, color: "text-autronis-accent", bg: "bg-autronis-accent/10" },
};

const relatieStatusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  actief: { label: "Actieve klant", bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  stil: { label: "Stil", bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  aandacht_nodig: { label: "Aandacht nodig", bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400 animate-pulse" },
  inactief: { label: "Inactief", bg: "bg-slate-500/10", text: "text-slate-400", dot: "bg-slate-400" },
};

const nextActionIcons: Record<string, typeof Receipt> = {
  follow_up: Mail,
  factuur: Receipt,
  meeting: CalendarDays,
  taak: CheckCircle2,
  offerte: FileCheck,
};

type Tab = "overzicht" | "tijdlijn" | "financieel" | "documenten";
type TijdlijnFilter = "alles" | "factuur" | "meeting" | "notitie" | "tijdregistratie" | "offerte";

function PortalLinkButton({ klantId }: { klantId: number }) {
  const { addToast } = useToast();
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/klanten/${klantId}/portal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout);
      setPortalLink(data.link);
      await navigator.clipboard.writeText(data.link);
      addToast("Portal link gekopieerd naar klembord!", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Kon link niet genereren", "fout");
    }
    setLoading(false);
  }

  async function handleDeactivate() {
    setDeactivating(true);
    try {
      const res = await fetch(`/api/klanten/${klantId}/portal`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setPortalLink(null);
      addToast("Portal link gedeactiveerd", "succes");
    } catch {
      addToast("Kon link niet deactiveren", "fout");
    }
    setDeactivating(false);
  }

  if (portalLink) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => { navigator.clipboard.writeText(portalLink); addToast("Link gekopieerd!", "succes"); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-autronis-card border border-autronis-accent/30 text-autronis-accent rounded-xl text-sm font-semibold transition-colors hover:bg-autronis-accent/10"
        >
          <Copy className="w-4 h-4" />
          Kopieer portal link
        </button>
        <button
          onClick={handleDeactivate}
          disabled={deactivating}
          className="p-2.5 bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-red-400 hover:border-red-400/30 rounded-xl transition-colors"
          title="Portal deactiveren"
        >
          {deactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2.5 bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/30 rounded-xl text-sm font-semibold transition-colors"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
      Portal link
    </button>
  );
}

export default function KlantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const id = Number(params.id);

  const { data, isLoading, error } = useKlantDetail(id);

  const [klantModalOpen, setKlantModalOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overzicht");
  const [tijdlijnFilter, setTijdlijnFilter] = useState<TijdlijnFilter>("alles");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/klanten/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      addToast("Klant gearchiveerd", "succes");
      router.push("/klanten");
    },
    onError: () => {
      addToast("Kon klant niet archiveren", "fout");
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await fetch(`/api/documenten/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      addToast("Document verwijderd");
      setDeleteDocId(null);
      queryClient.invalidateQueries({ queryKey: ["klant", id] });
    },
    onError: () => {
      addToast("Kon document niet verwijderen", "fout");
    },
  });

  const verrijkMutation = useMutation({
    mutationFn: async (website?: string) => {
      const res = await fetch(`/api/klanten/${id}/verrijk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Verrijking mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      addToast("Klant verrijkt met AI", "succes");
      queryClient.invalidateQueries({ queryKey: ["klant", id] });
    },
    onError: (err: Error) => {
      addToast(err.message || "AI verrijking mislukt", "fout");
    },
  });

  const invalidateKlant = () => {
    queryClient.invalidateQueries({ queryKey: ["klant", id] });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-2 border-autronis-accent/30 border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  // 404 state
  const notFound = error instanceof NotFoundError;
  if (notFound || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-autronis-text-secondary text-lg">Klant niet gevonden</p>
        <Link
          href="/klanten"
          className="flex items-center gap-2 text-autronis-accent hover:underline text-base"
        >
          <ArrowLeft className="w-5 h-5" />
          Terug naar klanten
        </Link>
      </div>
    );
  }

  const { klant, projecten, notities, documenten, recenteTijdregistraties, facturen, offertes, meetings, tijdlijn, kpis, openTaken, nextActions, relatieStatus, laatsteContact, dagenSindsContact, maandelijkseOmzet } = data;

  // Parse JSON fields
  const diensten: string[] = klant.diensten ? JSON.parse(klant.diensten) : [];
  const techStack: string[] = klant.techStack ? JSON.parse(klant.techStack) : [];

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overzicht", label: "Overzicht" },
    { key: "tijdlijn", label: "Tijdlijn", count: tijdlijn.length },
    { key: "financieel", label: "Financieel", count: facturen.length + offertes.length },
    { key: "documenten", label: "Documenten", count: documenten.length },
  ];

  return (
    <PageTransition>
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
      {/* Top section */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/klanten"
            className="inline-flex items-center gap-2 text-base text-autronis-text-secondary hover:text-autronis-text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Klanten
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">
              {klant.bedrijfsnaam}
            </h1>
            {klant.isDemo ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">
                DEMO
              </span>
            ) : null}
          </div>
          {klant.branche && (
            <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-autronis-accent/10 text-autronis-accent font-medium">
              {klant.branche}
            </span>
          )}
          {klant.notities && (
            <p className="text-base text-autronis-text-secondary">{klant.notities}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative group/ai">
            <button
              onClick={() => verrijkMutation.mutate(klant.website || undefined)}
              disabled={verrijkMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-xl text-sm font-semibold transition-colors"
            >
              {verrijkMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {verrijkMutation.isPending ? "Verrijken..." : "Verrijk met AI"}
            </button>
            <div className="absolute top-full left-0 mt-2 w-56 p-3 bg-autronis-card border border-autronis-border rounded-xl shadow-xl opacity-0 group-hover/ai:opacity-100 transition-opacity pointer-events-none z-20">
              <p className="text-xs text-autronis-text-secondary leading-relaxed">
                Haalt automatisch op: branche, diensten, tech stack en bedrijfsgrootte via de website.
              </p>
            </div>
          </div>
          <button
            onClick={() => setKlantModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 btn-press"
          >
            <Pencil className="w-4 h-4" />
            Bewerken
          </button>
          <PortalLinkButton klantId={Number(id)} />
          <button
            onClick={() => setArchiveDialogOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-card hover:bg-autronis-card/80 border border-autronis-border text-autronis-text-secondary hover:text-red-400 rounded-xl text-sm font-semibold transition-colors"
          >
            <Archive className="w-4 h-4" />
            Archiveren
          </button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Projecten",
            value: kpis.aantalProjecten,
            format: (n: number) => Math.round(n).toString(),
            icon: FolderKanban,
            accent: false,
            warn: false,
          },
          {
            label: "Totaal uren",
            value: kpis.totaalMinuten,
            format: (n: number) => formatUren(Math.round(n)),
            icon: Clock,
            accent: false,
            warn: false,
          },
          {
            label: "Omzet",
            value: kpis.omzet,
            format: (n: number) => formatBedrag(n),
            icon: Euro,
            accent: true,
            warn: false,
          },
          {
            label: "Openstaand",
            value: kpis.openstaand,
            format: (n: number) => formatBedrag(n),
            icon: Receipt,
            accent: false,
            warn: kpis.openstaand > 0,
          },
          {
            label: "Uurtarief",
            value: kpis.uurtarief,
            format: (n: number) => formatBedrag(n),
            icon: TrendingUp,
            accent: true,
            warn: false,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-autronis-accent/10 rounded-xl">
                <kpi.icon className="w-4 h-4 text-autronis-accent" />
              </div>
            </div>
            <AnimatedNumber
              value={kpi.value}
              format={kpi.format}
              className={cn(
                "text-2xl font-bold tabular-nums",
                kpi.warn ? "text-amber-400" : kpi.accent ? "text-autronis-accent" : "text-autronis-text-primary"
              )}
            />
            <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">
              {kpi.label}
            </p>
          </div>
        ))}
      </div>

      {/* Relatie samenvatting + Next Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Relatie samenvatting */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide">Relatie status</h3>
            {(() => {
              const rsConfig = relatieStatusConfig[relatieStatus] || relatieStatusConfig.actief;
              return (
                <span className={cn("inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold", rsConfig.bg, rsConfig.text)}>
                  <span className={cn("w-2 h-2 rounded-full", rsConfig.dot)} />
                  {rsConfig.label}
                </span>
              );
            })()}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-autronis-text-secondary/70">Laatste contact</p>
              <p className={cn(
                "text-sm font-medium mt-0.5",
                dagenSindsContact !== null && dagenSindsContact > 14 ? "text-amber-400" : "text-autronis-text-primary"
              )}>
                {dagenSindsContact !== null
                  ? dagenSindsContact === 0 ? "Vandaag"
                    : dagenSindsContact === 1 ? "Gisteren"
                    : `${dagenSindsContact} dagen geleden`
                  : "Onbekend"}
              </p>
            </div>
            <div>
              <p className="text-xs text-autronis-text-secondary/70">Open taken</p>
              {kpis.openTaken > 0 ? (
                <Link
                  href={`/taken?klant=${id}`}
                  className="text-sm font-medium text-autronis-accent hover:underline mt-0.5 block"
                >
                  {kpis.openTaken} taken →
                </Link>
              ) : (
                <p className="text-sm font-medium text-autronis-text-primary mt-0.5">Geen open taken</p>
              )}
            </div>
            <div>
              <p className="text-xs text-autronis-text-secondary/70">Lifetime value</p>
              <p className="text-sm font-medium text-autronis-accent mt-0.5 tabular-nums">{formatBedrag(kpis.clv)}</p>
            </div>
            <div>
              <p className="text-xs text-autronis-text-secondary/70">Gem. per maand</p>
              <p className="text-sm font-medium text-autronis-text-primary mt-0.5 tabular-nums">{formatBedrag(kpis.gemiddeldeMaandOmzet)}</p>
            </div>
          </div>
        </div>

        {/* Next Actions */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6">
          <h3 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-4">Volgende acties</h3>
          {nextActions.length === 0 ? (
            <div className="flex items-center gap-3 text-sm text-autronis-text-secondary/70">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Geen openstaande acties — alles op orde
            </div>
          ) : (
            <div className="space-y-2.5">
              {[...nextActions]
                .sort((a, b) => {
                  const urgOrder = { hoog: 0, normaal: 1, laag: 2 };
                  const typeOrder = { factuur: 0, follow_up: 1, offerte: 2, meeting: 3, taak: 4 };
                  const uA = urgOrder[a.urgentie as keyof typeof urgOrder] ?? 1;
                  const uB = urgOrder[b.urgentie as keyof typeof urgOrder] ?? 1;
                  if (uA !== uB) return uA - uB;
                  const tA = typeOrder[a.type as keyof typeof typeOrder] ?? 5;
                  const tB = typeOrder[b.type as keyof typeof typeOrder] ?? 5;
                  return tA - tB;
                })
                .slice(0, 4).map((action: NextAction, i: number) => {
                const ActionIcon = nextActionIcons[action.type] || ArrowRight;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.05 }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                      action.urgentie === "hoog"
                        ? "bg-red-500/5 border border-red-500/20"
                        : "bg-autronis-bg/50"
                    )}
                  >
                    <ActionIcon className={cn(
                      "w-4 h-4 flex-shrink-0",
                      action.urgentie === "hoog" ? "text-red-400" : "text-autronis-text-secondary"
                    )} />
                    <span className={cn(
                      "flex-1",
                      action.urgentie === "hoog" ? "text-red-400 font-medium" : "text-autronis-text-primary"
                    )}>
                      {action.label}
                    </span>
                    {action.urgentie === "hoog" && (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-autronis-accent/15 text-autronis-accent"
                : "text-autronis-text-secondary hover:text-autronis-text-primary"
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-autronis-bg/50">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
      {activeTab === "overzicht" && (
      <motion.div key="overzicht" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left column */}
          <div className="space-y-8">
            {/* Klantgegevens */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <h2 className="text-lg font-semibold text-autronis-text-primary mb-5">
                Klantgegevens
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Contactpersoon</p>
                    <p className="text-base text-autronis-text-primary mt-0.5">
                      {klant.contactpersoon || "\u2014"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">E-mail</p>
                    {klant.email ? (
                      <a href={`mailto:${klant.email}`} className="text-base text-autronis-accent hover:underline mt-0.5 block">
                        {klant.email}
                      </a>
                    ) : (
                      <p className="text-base text-autronis-text-primary mt-0.5">{"\u2014"}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Telefoon</p>
                    {klant.telefoon ? (
                      <a href={`tel:${klant.telefoon}`} className="text-base text-autronis-accent hover:underline mt-0.5 block">
                        {klant.telefoon}
                      </a>
                    ) : (
                      <p className="text-base text-autronis-text-primary mt-0.5">{"\u2014"}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Adres</p>
                    <p className="text-base text-autronis-text-primary mt-0.5">
                      {klant.adres || "\u2014"}
                    </p>
                  </div>
                </div>
                {klant.website && (
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Website</p>
                      <a href={klant.website.startsWith("http") ? klant.website : `https://${klant.website}`} target="_blank" rel="noopener noreferrer" className="text-base text-autronis-accent hover:underline mt-0.5 block">
                        {klant.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  </div>
                )}
                {klant.kvkNummer && (
                  <div className="flex items-start gap-3">
                    <Hash className="w-5 h-5 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">KvK nummer</p>
                      <p className="text-base text-autronis-text-primary mt-0.5">{klant.kvkNummer}</p>
                    </div>
                  </div>
                )}
                {klant.btwNummer && (
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">BTW nummer</p>
                      <p className="text-base text-autronis-text-primary mt-0.5">{klant.btwNummer}</p>
                    </div>
                  </div>
                )}
                {klant.aantalMedewerkers && (
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-autronis-text-secondary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Medewerkers</p>
                      <p className="text-base text-autronis-text-primary mt-0.5">{klant.aantalMedewerkers}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Diensten & Tech Stack from AI enrichment */}
              {diensten.length > 0 && (
                <div className="mt-5 pt-5 border-t border-autronis-border">
                  <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Diensten</p>
                  <div className="flex flex-wrap gap-1.5">
                    {diensten.map((d) => (
                      <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-autronis-accent/10 text-autronis-accent">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {techStack.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-autronis-text-secondary uppercase tracking-wide mb-2">Tech Stack</p>
                  <div className="flex flex-wrap gap-1.5">
                    {techStack.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {klant.aiVerrijktOp && (
                <p className="text-[10px] text-autronis-text-secondary/50 mt-4">
                  AI-verrijkt op {formatDatum(klant.aiVerrijktOp)}
                </p>
              )}
            </div>

            {/* Notities & Afspraken */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-autronis-text-primary">
                  Notities & Afspraken
                </h2>
                <button
                  onClick={() => setNoteModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Notitie
                </button>
              </div>
              {notities.length === 0 ? (
                <p className="text-base text-autronis-text-secondary">
                  Nog geen notities toegevoegd.
                </p>
              ) : (
                <div className="space-y-3">
                  {notities.slice(0, 5).map((notitie, i) => {
                    const config = notitieTypeConfig[notitie.type] || notitieTypeConfig.notitie;
                    return (
                      <motion.div
                        key={notitie.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.05 }}
                        className={cn(
                          "border-l-4 rounded-xl bg-autronis-bg/50 p-5",
                          config.border
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", config.badge)}>
                            {config.label}
                          </span>
                          <span className="text-sm text-autronis-text-secondary">
                            {formatDatum(notitie.aangemaaktOp)}
                          </span>
                        </div>
                        <p className="text-base text-autronis-text-primary leading-relaxed">
                          {notitie.inhoud}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-8">
            {/* Projecten */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-autronis-text-primary">
                  Projecten
                </h2>
                <button
                  onClick={() => setProjectModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Project
                </button>
              </div>
              {projecten.length === 0 ? (
                <p className="text-base text-autronis-text-secondary">
                  Nog geen projecten.
                </p>
              ) : (
                <div className="space-y-4">
                  {projecten.map((project) => {
                    const status = statusConfig[project.status] || statusConfig.inactief;
                    const voortgang = project.voortgangPercentage ?? 0;
                    return (
                      <Link
                        key={project.id}
                        href={`/klanten/${id}/projecten/${project.id}`}
                        className="block bg-autronis-bg/50 rounded-xl p-5 space-y-3 hover:bg-autronis-bg/80 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-base font-semibold text-autronis-text-primary">
                            {project.naam}
                          </p>
                          <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0", status.bg, status.text)}>
                            {status.label}
                          </span>
                        </div>
                        {project.omschrijving && (
                          <p className="text-sm text-autronis-text-secondary line-clamp-2">
                            {project.omschrijving}
                          </p>
                        )}
                        {/* Progress bar */}
                        <div className="w-full bg-autronis-border rounded-full h-2">
                          <motion.div
                            className="bg-autronis-accent h-2 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: mounted ? `${Math.min(voortgang, 100)}%` : 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm text-autronis-text-secondary">
                          <span>
                            <Clock className="w-4 h-4 inline mr-1.5" />
                            {project.geschatteUren != null
                              ? `${formatUren(project.werkelijkeMinuten)} / ${formatUren(project.geschatteUren * 60)}`
                              : formatUren(project.werkelijkeMinuten)}
                          </span>
                          {project.deadline && (
                            <span>Deadline: {formatDatum(project.deadline)}</span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recente tijdregistraties */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <h2 className="text-lg font-semibold text-autronis-text-primary mb-5">
                Recente tijdregistraties
              </h2>
              {recenteTijdregistraties.length === 0 ? (
                <p className="text-base text-autronis-text-secondary">
                  Geen recente tijdregistraties.
                </p>
              ) : (
                <div className="space-y-3">
                  {recenteTijdregistraties.slice(0, 5).map((registratie, i) => (
                    <motion.div
                      key={registratie.id}
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.04 }}
                      className="bg-autronis-bg/50 rounded-xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-base text-autronis-text-primary truncate">
                          {registratie.omschrijving}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {registratie.projectNaam && (
                            <span className="text-sm text-autronis-accent">
                              {registratie.projectNaam}
                            </span>
                          )}
                          <span className="text-sm text-autronis-text-secondary">
                            {formatDatum(registratie.startTijd)}
                          </span>
                        </div>
                      </div>
                      <span className="text-base font-bold text-autronis-text-primary flex-shrink-0 tabular-nums">
                        {formatUren(registratie.duurMinuten)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
      )}

      {/* Timeline tab */}
      {activeTab === "tijdlijn" && (
      <motion.div key="tijdlijn" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-autronis-text-primary">Interactie-tijdlijn</h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["alles", "factuur", "meeting", "notitie", "tijdregistratie", "offerte"] as TijdlijnFilter[]).map((f) => {
                const filterLabels: Record<TijdlijnFilter, string> = {
                  alles: "Alles",
                  factuur: "Facturen",
                  meeting: "Meetings",
                  notitie: "Notities",
                  tijdregistratie: "Uren",
                  offerte: "Offertes",
                };
                const filterColors: Record<TijdlijnFilter, string> = {
                  alles: "text-autronis-accent border-autronis-accent/40 bg-autronis-accent/10",
                  factuur: "text-emerald-400 border-emerald-400/40 bg-emerald-500/10",
                  meeting: "text-purple-400 border-purple-400/40 bg-purple-500/10",
                  notitie: "text-amber-400 border-amber-400/40 bg-amber-500/10",
                  tijdregistratie: "text-autronis-accent border-autronis-accent/40 bg-autronis-accent/10",
                  offerte: "text-blue-400 border-blue-400/40 bg-blue-500/10",
                };
                return (
                  <button
                    key={f}
                    onClick={() => setTijdlijnFilter(f)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                      tijdlijnFilter === f
                        ? filterColors[f]
                        : "bg-autronis-bg/50 border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                    )}
                  >
                    {filterLabels[f]}
                  </button>
                );
              })}
            </div>
          </div>
          {tijdlijn.length === 0 ? (
            <p className="text-base text-autronis-text-secondary">
              Nog geen interacties vastgelegd.
            </p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-autronis-border" />
              <div className="space-y-6">
                {tijdlijn.filter((item: TijdlijnItem) => tijdlijnFilter === "alles" || item.type === tijdlijnFilter).map((item: TijdlijnItem) => {
                  const config = tijdlijnTypeConfig[item.type] || tijdlijnTypeConfig.notitie;
                  const Icon = config.icon;
                  return (
                    <div key={item.id} className="relative pl-12">
                      {/* Icon dot */}
                      <div className={cn("absolute left-2.5 w-5 h-5 rounded-full flex items-center justify-center", config.bg)}>
                        <Icon className={cn("w-3 h-3", config.color)} />
                      </div>
                      <div className="bg-autronis-bg/50 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="text-sm font-semibold text-autronis-text-primary">
                            {item.titel}
                          </p>
                          <span className="text-xs text-autronis-text-secondary flex-shrink-0">
                            {item.datum ? formatDatum(item.datum) : ""}
                          </span>
                        </div>
                        {item.details && (
                          <p className="text-sm text-autronis-text-secondary">
                            {item.details}
                          </p>
                        )}
                        {item.status && (
                          <span className={cn(
                            "inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mt-2",
                            factuurStatusConfig[item.status]?.bg || "bg-slate-500/15",
                            factuurStatusConfig[item.status]?.text || "text-slate-400"
                          )}>
                            {factuurStatusConfig[item.status]?.label || item.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
      )}

      {/* Financial tab */}
      {activeTab === "financieel" && (
      <motion.div key="financieel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
        <div className="space-y-8">
          {/* Financial KPIs - 6 cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <Euro className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <p className="text-xl font-bold text-emerald-400 tabular-nums">{formatBedrag(kpis.omzet)}</p>
              <p className="text-[10px] text-autronis-text-secondary mt-1 uppercase tracking-wide">Totale omzet</p>
            </div>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-amber-500/10">
                  <Receipt className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <p className={cn("text-xl font-bold tabular-nums", kpis.openstaand > 0 ? "text-amber-400" : "text-autronis-text-primary")}>
                {formatBedrag(kpis.openstaand)}
              </p>
              <p className="text-[10px] text-autronis-text-secondary mt-1 uppercase tracking-wide">Openstaand</p>
            </div>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-autronis-accent/10">
                  <TrendingUp className="w-4 h-4 text-autronis-accent" />
                </div>
              </div>
              <p className="text-xl font-bold text-autronis-accent tabular-nums">{formatBedrag(kpis.clv)}</p>
              <p className="text-[10px] text-autronis-text-secondary mt-1 uppercase tracking-wide">Lifetime value</p>
            </div>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <p className="text-xl font-bold text-blue-400 tabular-nums">{formatBedrag(kpis.gemiddeldeMaandOmzet)}</p>
              <p className="text-[10px] text-autronis-text-secondary mt-1 uppercase tracking-wide">Gem. per maand</p>
            </div>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-purple-500/10">
                  <CreditCard className="w-4 h-4 text-purple-400" />
                </div>
              </div>
              <p className="text-xl font-bold text-purple-400 tabular-nums">{formatBedrag(kpis.gemiddeldFactuurbedrag)}</p>
              <p className="text-[10px] text-autronis-text-secondary mt-1 uppercase tracking-wide">Gem. factuur</p>
            </div>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-autronis-accent/10">
                  <Timer className="w-4 h-4 text-autronis-accent" />
                </div>
              </div>
              <p className="text-xl font-bold text-autronis-text-primary tabular-nums">
                {kpis.gemiddeldeBetalingsDagen !== null ? `${kpis.gemiddeldeBetalingsDagen}d` : "\u2014"}
              </p>
              <p className="text-[10px] text-autronis-text-secondary mt-1 uppercase tracking-wide">Betaaltermijn</p>
            </div>
          </div>

          {/* Monthly revenue chart */}
          {maandelijkseOmzet.length > 0 && (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <h2 className="text-lg font-semibold text-autronis-text-primary mb-5">Omzet per maand</h2>
              <div className="flex items-end gap-2 h-40">
                {(() => {
                  const maxOmzet = Math.max(...maandelijkseOmzet.map(m => m.omzet), 1);
                  return maandelijkseOmzet.map((m) => {
                    const height = Math.max((m.omzet / maxOmzet) * 100, 4);
                    const maandLabel = m.maand.substring(5);
                    return (
                      <div key={m.maand} className="flex-1 flex flex-col items-center gap-1 group">
                        <span className="text-[10px] text-autronis-text-secondary opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                          {formatBedrag(m.omzet)}
                        </span>
                        <div
                          className="w-full bg-autronis-accent/80 rounded-t-lg hover:bg-autronis-accent transition-colors"
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[10px] text-autronis-text-secondary/60">{maandLabel}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Facturen */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-autronis-text-primary">
                  Facturen ({facturen.length})
                </h2>
                <Link
                  href={`/financien/nieuw?klant=${id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Factuur
                </Link>
              </div>
              {facturen.length === 0 ? (
                <p className="text-base text-autronis-text-secondary">Nog geen facturen.</p>
              ) : (
                <div className="space-y-3">
                  {facturen.slice(0, 10).map((factuur) => {
                    const fConfig = factuurStatusConfig[factuur.status || "concept"] || factuurStatusConfig.concept;
                    const isOverdue = factuur.status !== "betaald" && factuur.vervaldatum
                      ? new Date(factuur.vervaldatum) < new Date()
                      : false;
                    const dagenTeLaat = isOverdue && factuur.vervaldatum
                      ? Math.floor((Date.now() - new Date(factuur.vervaldatum).getTime()) / 86400000)
                      : 0;
                    return (
                      <Link
                        key={factuur.id}
                        href={`/financien/${factuur.id}`}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl p-4 transition-colors",
                          isOverdue
                            ? "bg-red-500/5 border border-red-500/20 hover:bg-red-500/10"
                            : "bg-autronis-bg/50 hover:bg-autronis-bg/80"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-semibold", isOverdue ? "text-red-400" : "text-autronis-text-primary")}>
                            {factuur.factuurnummer}
                          </p>
                          <p className="text-xs text-autronis-text-secondary mt-0.5">
                            {factuur.factuurdatum ? formatDatumKort(factuur.factuurdatum) : "Geen datum"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {isOverdue && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-500/15 text-red-400">
                              {dagenTeLaat}d te laat
                            </span>
                          )}
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", fConfig.bg, fConfig.text)}>
                            {fConfig.label}
                          </span>
                          <span className={cn("text-sm font-bold tabular-nums", isOverdue ? "text-red-400" : "text-autronis-text-primary")}>
                            {formatBedrag(factuur.bedragInclBtw || 0)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Offertes */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-autronis-text-primary">
                  Offertes ({offertes.length})
                </h2>
                <Link
                  href={`/offertes/nieuw?klant=${id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Offerte
                </Link>
              </div>
              {offertes.length === 0 ? (
                <p className="text-base text-autronis-text-secondary">Nog geen offertes.</p>
              ) : (
                <div className="space-y-3">
                  {offertes.slice(0, 10).map((offerte) => {
                    const oStatus = offerte.status || "concept";
                    const statusColors: Record<string, string> = {
                      concept: "bg-slate-500/15 text-slate-400",
                      verzonden: "bg-blue-500/15 text-blue-400",
                      geaccepteerd: "bg-emerald-500/15 text-emerald-400",
                      verlopen: "bg-red-500/15 text-red-400",
                      afgewezen: "bg-red-500/15 text-red-400",
                    };
                    return (
                      <Link
                        key={offerte.id}
                        href={`/offertes/${offerte.id}`}
                        className="flex items-center justify-between gap-3 bg-autronis-bg/50 rounded-xl p-4 hover:bg-autronis-bg/80 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-autronis-text-primary">
                            {offerte.offertenummer}{offerte.titel ? `: ${offerte.titel}` : ""}
                          </p>
                          <p className="text-xs text-autronis-text-secondary mt-0.5">
                            {offerte.datum ? formatDatumKort(offerte.datum) : "Geen datum"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColors[oStatus] || statusColors.concept)}>
                            {oStatus.charAt(0).toUpperCase() + oStatus.slice(1)}
                          </span>
                          <span className="text-sm font-bold text-autronis-text-primary tabular-nums">
                            {formatBedrag(offerte.bedragInclBtw || 0)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
      )}

      {/* Documents tab */}
      {activeTab === "documenten" && (
      <motion.div key="documenten" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-autronis-text-primary">
              Documenten & Links
            </h2>
            <button
              onClick={() => setDocumentModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Toevoegen
            </button>
          </div>
          {documenten.length === 0 ? (
            <p className="text-base text-autronis-text-secondary">
              Nog geen documenten of links toegevoegd.
            </p>
          ) : (
            <div className="space-y-3">
              {documenten.map((doc) => {
                const docConfig2 = docTypeConfig[doc.type] || docTypeConfig.overig;
                const DocIcon = docConfig2.icon;
                return (
                  <div
                    key={doc.id}
                    className="bg-autronis-bg/50 rounded-xl p-4 flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <DocIcon className={cn("w-5 h-5 flex-shrink-0", docConfig2.color)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-medium text-autronis-text-primary truncate">
                          {doc.naam}
                        </p>
                        <p className="text-sm text-autronis-text-secondary mt-0.5">
                          {doc.type.charAt(0).toUpperCase() + doc.type.slice(1)} {"\u2014"} {formatDatum(doc.aangemaaktOp)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-autronis-accent hover:text-autronis-accent-hover transition-colors px-3 py-1.5 rounded-lg hover:bg-autronis-accent/10"
                        >
                          Openen
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteDocId(doc.id);
                        }}
                        className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
      )}
      </AnimatePresence>

      {/* Modals */}
      <KlantModal
        open={klantModalOpen}
        onClose={() => setKlantModalOpen(false)}
        klant={klant}
        onOpgeslagen={() => {
          setKlantModalOpen(false);
          invalidateKlant();
        }}
      />

      <ConfirmDialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
        onBevestig={() => archiveMutation.mutate()}
        titel="Klant archiveren?"
        bericht={`Weet je zeker dat je "${klant.bedrijfsnaam}" wilt archiveren? Deze actie kan niet ongedaan worden gemaakt.`}
        bevestigTekst="Archiveren"
        variant="danger"
      />

      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        klantId={id}
        onOpgeslagen={() => {
          setProjectModalOpen(false);
          invalidateKlant();
        }}
      />

      <NoteModal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        klantId={id}
        onOpgeslagen={() => {
          setNoteModalOpen(false);
          invalidateKlant();
        }}
      />

      <DocumentModal
        open={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        klantId={id}
        onOpgeslagen={() => {
          setDocumentModalOpen(false);
          invalidateKlant();
        }}
      />

      <ConfirmDialog
        open={deleteDocId !== null}
        onClose={() => setDeleteDocId(null)}
        onBevestig={() => deleteDocId && deleteDocMutation.mutate(deleteDocId)}
        titel="Document verwijderen?"
        bericht="Weet je zeker dat je dit document wilt verwijderen?"
        bevestigTekst="Verwijderen"
        variant="danger"
      />
    </div>
    </PageTransition>
  );
}
