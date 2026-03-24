"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2,
  Search,
  Plus,
  Mail,
  Phone,
  Users,
  AlertCircle,
  TrendingUp,
  FileText,
  FlaskConical,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import { cn, formatUren, formatBedrag, formatDatumKort } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { KlantModal } from "./klant-modal";
import { PageTransition } from "@/components/ui/page-transition";
import { useKlanten } from "@/hooks/queries/use-klanten";
import type { Klant } from "@/hooks/queries/use-klanten";
import { useQueryClient } from "@tanstack/react-query";

// Generate consistent color from name
function getInitialsColor(naam: string): string {
  const colors = [
    "bg-blue-500/20 text-blue-400",
    "bg-purple-500/20 text-purple-400",
    "bg-amber-500/20 text-amber-400",
    "bg-rose-500/20 text-rose-400",
    "bg-emerald-500/20 text-emerald-400",
    "bg-cyan-500/20 text-cyan-400",
    "bg-indigo-500/20 text-indigo-400",
    "bg-orange-500/20 text-orange-400",
  ];
  let hash = 0;
  for (let i = 0; i < naam.length; i++) {
    hash = naam.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(naam: string): string {
  return naam
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function isChurnRisico(klant: Klant): boolean {
  return (klant.dagenSindsContact ?? 0) > 30 && klant.actieveProjecten === 0;
}

function getLifetimeValueColor(omzet: number): string {
  if (omzet === 0) return "text-autronis-text-secondary/60";
  if (omzet < 1000) return "text-autronis-text-primary";
  if (omzet < 5000) return "text-emerald-300";
  return "text-emerald-400";
}

function getContactColor(dagen: number | null): string {
  if (dagen === null) return "text-autronis-text-secondary/70";
  if (dagen > 30) return "text-red-400";
  if (dagen > 14) return "text-amber-400";
  return "text-autronis-text-secondary/70";
}

function HighlightMatch({ text, zoek }: { text: string; zoek: string }) {
  if (!zoek.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${zoek.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === zoek.toLowerCase() ? (
          <mark key={i} className="bg-autronis-accent/30 text-autronis-text-primary rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// Relatie status badge
const relatieStatusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  actief: { label: "Actief", bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  stil: { label: "Stil", bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  aandacht_nodig: { label: "Aandacht nodig", bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400 animate-pulse" },
  inactief: { label: "Inactief", bg: "bg-slate-500/10", text: "text-slate-400", dot: "bg-slate-400" },
};

function RelatieStatusBadge({ status, reden }: { status: string; reden?: string }) {
  const config = relatieStatusConfig[status] || relatieStatusConfig.actief;
  return (
    <div className="relative group">
      <span className={cn("inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium", config.bg, config.text)}>
        <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
        {config.label}
      </span>
      {reden && (
        <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1.5 bg-autronis-card border border-autronis-border rounded-lg text-[10px] text-autronis-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
          {reden}
        </div>
      )}
    </div>
  );
}

// Format relative time
function formatRelatief(datum: string | null): string {
  if (!datum) return "Onbekend";
  const d = new Date(datum.includes("T") ? datum : datum.replace(" ", "T") + "Z");
  const diffMs = Date.now() - d.getTime();
  const dagen = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (dagen === 0) return "Vandaag";
  if (dagen === 1) return "Gisteren";
  if (dagen < 7) return `${dagen} dagen geleden`;
  if (dagen < 30) return `${Math.floor(dagen / 7)} weken geleden`;
  return `${Math.floor(dagen / 30)} maanden geleden`;
}

function KlantCard({ klant, onClick, zoek }: { klant: Klant; onClick: () => void; zoek: string }) {
  const initialsColor = getInitialsColor(klant.bedrijfsnaam);
  const initials = getInitials(klant.bedrijfsnaam);
  const churn = isChurnRisico(klant);
  const contactDagen = klant.dagenSindsContact;

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -2, scale: 1.003 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6 cursor-pointer flex flex-col group relative overflow-hidden",
        "hover:border-autronis-accent/40 hover:shadow-lg hover:shadow-autronis-accent/5 transition-colors",
        !klant.isActief && "opacity-60",
        klant.isDemo && "border-dashed border-autronis-border/60"
      )}
    >
      {/* Left accent border on hover */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl bg-autronis-accent/0 group-hover:bg-autronis-accent/60 transition-all duration-200" />

      {/* Header: Avatar + Name + Status */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0", initialsColor)}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-autronis-text-primary truncate group-hover:text-autronis-accent transition-colors">
              <HighlightMatch text={klant.bedrijfsnaam} zoek={zoek} />
            </h3>
            {klant.isDemo ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium flex-shrink-0">
                DEMO
              </span>
            ) : null}
            {churn && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold flex-shrink-0 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                Churnrisico
              </span>
            )}
          </div>
          <p className="text-sm text-autronis-text-secondary truncate mt-0.5">
            {klant.contactpersoon || "Geen contactpersoon"}
          </p>
        </div>
        <RelatieStatusBadge status={klant.relatieStatus} reden={klant.gezondheidReden} />
      </div>

      {/* Branche + last contact */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {klant.branche && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-autronis-accent/10 text-autronis-accent font-medium">
              {klant.branche}
            </span>
          )}
        </div>
        <span className={cn("text-xs flex items-center gap-1", getContactColor(contactDagen))}>
          {contactDagen !== null && contactDagen > 30 && <AlertTriangle className="w-3 h-3" />}
          {contactDagen !== null && contactDagen > 14 && contactDagen <= 30 && "⚠ "}
          {formatRelatief(klant.laatsteContact)}
        </span>
      </div>

      {/* Value summary: lifetime value + open pipeline */}
      <div className="bg-autronis-bg/40 rounded-xl px-3 py-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-autronis-text-secondary/70">Lifetime value</span>
          <span className={cn("font-semibold tabular-nums", getLifetimeValueColor(klant.totaleOmzet))}>{formatBedrag(klant.totaleOmzet)}</span>
        </div>
        {(klant.openstaand > 0 || klant.openstaandeOffertes > 0) && (
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-autronis-text-secondary/70">Open pipeline</span>
            <span className="font-semibold text-amber-400 tabular-nums">
              {formatBedrag(klant.openstaand)}
              {klant.openstaandeOffertes > 0 && (
                <span className="text-blue-400 ml-1.5">
                  + {klant.openstaandeOffertes} offerte{klant.openstaandeOffertes > 1 ? "s" : ""}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Quick actions + open tasks indicator */}
      <div className="flex items-center gap-2 mb-3">
        {klant.email && (
          <a
            href={`mailto:${klant.email}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-autronis-bg/50 border border-autronis-border/50 text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/30 transition-colors"
            title={klant.email}
          >
            <Mail className="w-3.5 h-3.5" />
          </a>
        )}
        {klant.telefoon && (
          <a
            href={`tel:${klant.telefoon}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-autronis-bg/50 border border-autronis-border/50 text-autronis-text-secondary hover:text-green-400 hover:border-green-400/30 transition-colors"
            title={klant.telefoon}
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        )}
        <div className="flex-1" />
        {klant.openTaken > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium tabular-nums">
            {klant.openTaken} open {klant.openTaken === 1 ? "taak" : "taken"}
          </span>
        )}
      </div>

      {/* Tags */}
      {klant.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {klant.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full bg-autronis-bg/80 text-autronis-text-secondary border border-autronis-border/50"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-autronis-border mt-auto mb-3" />

      {/* Footer KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] text-autronis-text-secondary/60 mb-0.5">Projecten</p>
          <p className="text-sm font-bold text-autronis-text-primary tabular-nums">{klant.aantalProjecten}</p>
        </div>
        <div>
          <p className="text-[10px] text-autronis-text-secondary/60 mb-0.5">Uren</p>
          <p className="text-sm font-bold text-autronis-text-primary tabular-nums">{formatUren(klant.totaalMinuten)}</p>
        </div>
        <div>
          <p className="text-[10px] text-autronis-text-secondary/60 mb-0.5">Omzet</p>
          <p className={cn("text-sm font-bold tabular-nums", getLifetimeValueColor(klant.totaleOmzet))}>{formatBedrag(klant.totaleOmzet)}</p>
        </div>
      </div>
    </motion.div>
  );
}

type SorteerOptie = "gezondheid" | "omzet" | "contact" | "naam";
type StatusFilter = "alles" | "actief" | "stil" | "aandacht_nodig" | "inactief";
type GezondheidFilter = "alles" | "groen" | "oranje" | "rood";

export default function KlantenPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [toonDemo, setToonDemo] = useState(false);
  const { data, isLoading: laden } = useKlanten(toonDemo);
  const klanten = data?.klanten ?? [];
  const kpis = data?.kpis;

  const [zoekterm, setZoekterm] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("alles");
  const [filterGezondheid, setFilterGezondheid] = useState<GezondheidFilter>("alles");
  const [sorteer, setSorteer] = useState<SorteerOptie>("gezondheid");
  const [modalOpen, setModalOpen] = useState(false);
  const [bewerkKlant, setBewerkKlant] = useState<Klant | null>(null);

  const toggleGezondheid = useCallback((g: GezondheidFilter) => {
    setFilterGezondheid((prev) => (prev === g ? "alles" : g));
  }, []);

  const gefilterdeKlanten = useMemo(() => {
    const zoek = zoekterm.toLowerCase().trim();
    return klanten
      .filter((k) => {
        if (filterStatus === "alles") {
          // hide inactive by default
          if (!k.isActief) return false;
        } else if (filterStatus === "inactief") {
          if (k.isActief) return false;
        } else {
          if (!k.isActief) return false;
          if (k.relatieStatus !== filterStatus) return false;
        }
        if (filterGezondheid !== "alles" && k.gezondheid !== filterGezondheid) return false;
        if (zoek) {
          return (
            k.bedrijfsnaam.toLowerCase().includes(zoek) ||
            (k.contactpersoon?.toLowerCase().includes(zoek) ?? false) ||
            (k.email?.toLowerCase().includes(zoek) ?? false) ||
            (k.branche?.toLowerCase().includes(zoek) ?? false)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sorteer === "omzet") return b.totaleOmzet - a.totaleOmzet;
        if (sorteer === "contact") {
          const ad = a.dagenSindsContact ?? 9999;
          const bd = b.dagenSindsContact ?? 9999;
          return bd - ad; // most overdue first
        }
        if (sorteer === "naam") return a.bedrijfsnaam.localeCompare(b.bedrijfsnaam, "nl");
        // default: gezondheid
        const healthOrder = { rood: 0, oranje: 1, groen: 2 };
        const aH = healthOrder[a.gezondheid] ?? 2;
        const bH = healthOrder[b.gezondheid] ?? 2;
        if (aH !== bH) return aH - bH;
        return a.bedrijfsnaam.localeCompare(b.bedrijfsnaam, "nl");
      });
  }, [klanten, zoekterm, filterStatus, filterGezondheid, sorteer]);

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">Klanten</h1>
            <span className="text-sm text-autronis-text-secondary">
              {kpis?.actieveKlanten ?? 0} actieve klanten
            </span>
          </div>
          <button
            onClick={() => { setBewerkKlant(null); setModalOpen(true); }}
            className="flex items-center gap-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
          >
            <Plus className="w-5 h-5" />
            Nieuwe klant
          </button>
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-autronis-accent/10">
                  <Users className="w-4 h-4 text-autronis-accent" />
                </div>
              </div>
              <AnimatedNumber value={kpis.actieveKlanten} className="text-2xl font-bold text-autronis-text-primary tabular-nums" />
              <p className="text-xs text-autronis-text-secondary mt-1">Actieve klanten</p>
            </div>

            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-green-500/10">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                </div>
              </div>
              <AnimatedNumber value={kpis.totaleOmzet} format={(n) => formatBedrag(Math.round(n))} className="text-2xl font-bold text-green-400 tabular-nums" />
              <p className="text-xs text-autronis-text-secondary mt-1">Totale omzet</p>
            </div>

            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-amber-500/10">
                  <FileText className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <AnimatedNumber
                value={kpis.totaalOpenstaand}
                format={(n) => formatBedrag(Math.round(n))}
                className={cn("text-2xl font-bold tabular-nums", kpis.totaalOpenstaand > 0 ? "text-amber-400" : "text-autronis-text-primary")}
              />
              <p className="text-xs text-autronis-text-secondary mt-1">Openstaand</p>
            </div>

            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-autronis-accent/10">
                  <AlertCircle className="w-4 h-4 text-autronis-accent" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleGezondheid("groen")}
                  className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors", filterGezondheid === "groen" ? "bg-green-500/20" : "hover:bg-autronis-bg/50")}
                >
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm font-bold text-autronis-text-primary tabular-nums">{kpis.gezondheid.groen}</span>
                </button>
                <button
                  onClick={() => toggleGezondheid("oranje")}
                  className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors", filterGezondheid === "oranje" ? "bg-amber-500/20" : "hover:bg-autronis-bg/50")}
                >
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-sm font-bold text-autronis-text-primary tabular-nums">{kpis.gezondheid.oranje}</span>
                </button>
                <button
                  onClick={() => toggleGezondheid("rood")}
                  className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors", filterGezondheid === "rood" ? "bg-red-500/20" : "hover:bg-autronis-bg/50")}
                >
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-sm font-bold text-autronis-text-primary tabular-nums">{kpis.gezondheid.rood}</span>
                </button>
              </div>
              <p className="text-[10px] text-autronis-text-secondary mt-1">
                Klantgezondheid {filterGezondheid !== "alles" && <span className="text-autronis-accent">· filter actief</span>}
              </p>
            </div>
          </div>
        )}

        {/* Search bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-autronis-text-secondary/50" />
            <input
              type="text"
              placeholder="Zoek op bedrijfsnaam, contactpersoon, email of branche..."
              value={zoekterm}
              onChange={(e) => setZoekterm(e.target.value)}
              className="w-full bg-autronis-card border border-autronis-border text-autronis-text-primary rounded-xl pl-11 pr-4 py-3 text-sm placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent/40 transition-colors"
            />
          </div>
          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary/50 pointer-events-none" />
            <select
              value={sorteer}
              onChange={(e) => setSorteer(e.target.value as SorteerOptie)}
              className="bg-autronis-card border border-autronis-border rounded-xl pl-9 pr-4 py-3 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent/40 transition-colors appearance-none cursor-pointer"
            >
              <option value="gezondheid">Gezondheid</option>
              <option value="omzet">Omzet</option>
              <option value="contact">Laatste contact</option>
              <option value="naam">Naam</option>
            </select>
          </div>
          <button
            onClick={() => setToonDemo(!toonDemo)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-colors",
              toonDemo
                ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                : "bg-autronis-card border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
            )}
          >
            <FlaskConical className="w-4 h-4" />
            Demo
          </button>
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["alles", "actief", "stil", "aandacht_nodig", "inactief"] as StatusFilter[]).map((status) => {
            const labels: Record<StatusFilter, string> = {
              alles: "Alle",
              actief: "Actief",
              stil: "Stil",
              aandacht_nodig: "Aandacht nodig",
              inactief: "Inactief",
            };
            const counts: Record<StatusFilter, number> = {
              alles: klanten.length,
              actief: klanten.filter((k) => k.isActief && k.relatieStatus === "actief").length,
              stil: klanten.filter((k) => k.isActief && k.relatieStatus === "stil").length,
              aandacht_nodig: klanten.filter((k) => k.isActief && k.relatieStatus === "aandacht_nodig").length,
              inactief: klanten.filter((k) => !k.isActief).length,
            };
            const dotColors: Record<StatusFilter, string> = {
              alles: "",
              actief: "bg-green-400",
              stil: "bg-amber-400",
              aandacht_nodig: "bg-red-400 animate-pulse",
              inactief: "bg-slate-400",
            };
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  filterStatus === status
                    ? "bg-autronis-accent/15 border-autronis-accent/40 text-autronis-accent"
                    : "bg-autronis-card border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                {status !== "alles" && <span className={cn("w-1.5 h-1.5 rounded-full", dotColors[status])} />}
                {labels[status]}
                <span className="opacity-60">{counts[status]}</span>
              </button>
            );
          })}
        </div>

        {/* Card grid — responsive: 1 col mobile, 2 col tablet, 3 col desktop */}
        {laden ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-autronis-card border border-autronis-border rounded-2xl p-6 h-56 animate-pulse">
                <div className="flex gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-autronis-border" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-autronis-border rounded w-2/3" />
                    <div className="h-3 bg-autronis-border rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : gefilterdeKlanten.length === 0 ? (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
            <Building2 className="w-10 h-10 text-autronis-text-secondary/30 mx-auto mb-3" />
            <p className="text-autronis-text-secondary text-sm">
              {zoekterm ? "Geen klanten gevonden met deze zoekterm" : "Nog geen klanten. Voeg je eerste klant toe."}
            </p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            animate="visible"
          >
            {gefilterdeKlanten.map((klant) => (
              <motion.div
                key={klant.id}
                variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
              >
                <KlantCard
                  klant={klant}
                  onClick={() => router.push(`/klanten/${klant.id}`)}
                  zoek={zoekterm}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Klant Modal */}
        <KlantModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setBewerkKlant(null); }}
          klant={bewerkKlant}
          onOpgeslagen={() => {
            setModalOpen(false);
            setBewerkKlant(null);
            queryClient.invalidateQueries({ queryKey: ["klanten"] });
          }}
        />
      </div>
    </PageTransition>
  );
}
