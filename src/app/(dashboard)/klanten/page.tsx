"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Search,
  Plus,
  Mail,
  Phone,
  Users,
  Clock,
  Euro,
  Eye,
  EyeOff,
  AlertCircle,
  TrendingUp,
  FileText,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { cn, formatUren, formatBedrag } from "@/lib/utils";
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

// Health indicator dot
function HealthDot({ gezondheid, reden }: { gezondheid: string; reden: string }) {
  const config = {
    groen: "bg-green-400 shadow-green-400/50",
    oranje: "bg-amber-400 shadow-amber-400/50",
    rood: "bg-red-400 shadow-red-400/50 animate-pulse",
  }[gezondheid] || "bg-green-400";

  return (
    <div className="relative group">
      <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", config)} />
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

function KlantCard({ klant, onClick }: { klant: Klant; onClick: () => void }) {
  const initialsColor = getInitialsColor(klant.bedrijfsnaam);
  const initials = getInitials(klant.bedrijfsnaam);

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6 cursor-pointer card-glow flex flex-col group",
        !klant.isActief && "opacity-60"
      )}
    >
      {/* Header: Avatar + Name + Health */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0", initialsColor)}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-autronis-text-primary truncate group-hover:text-autronis-accent transition-colors">
              {klant.bedrijfsnaam}
            </h3>
            <HealthDot gezondheid={klant.gezondheid} reden={klant.gezondheidReden} />
          </div>
          <p className="text-sm text-autronis-text-secondary truncate mt-0.5">
            {klant.contactpersoon || "Geen contactpersoon"}
          </p>
        </div>
      </div>

      {/* Last contact */}
      <p className="text-xs text-autronis-text-secondary/70 mb-3">
        Laatste contact: {formatRelatief(klant.laatsteContact)}
      </p>

      {/* Quick contact actions */}
      <div className="flex items-center gap-2 mb-4">
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
        {klant.openstaand > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium tabular-nums">
            {formatBedrag(klant.openstaand)} openstaand
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-autronis-border mt-auto mb-4" />

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
          <p className="text-sm font-bold text-autronis-text-primary tabular-nums">{formatBedrag(klant.totaleOmzet)}</p>
        </div>
      </div>
    </div>
  );
}

export default function KlantenPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading: laden } = useKlanten();
  const klanten = data?.klanten ?? [];
  const kpis = data?.kpis;

  const [zoekterm, setZoekterm] = useState("");
  const [toonInactief, setToonInactief] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [bewerkKlant, setBewerkKlant] = useState<Klant | null>(null);

  const gefilterdeKlanten = useMemo(() => {
    const zoek = zoekterm.toLowerCase().trim();
    return klanten
      .filter((k) => {
        if (!toonInactief && !k.isActief) return false;
        if (zoek) {
          return (
            k.bedrijfsnaam.toLowerCase().includes(zoek) ||
            (k.contactpersoon?.toLowerCase().includes(zoek) ?? false) ||
            (k.email?.toLowerCase().includes(zoek) ?? false)
          );
        }
        return true;
      })
      // Sort: red health first, then orange, then green, then alphabetical
      .sort((a, b) => {
        const healthOrder = { rood: 0, oranje: 1, groen: 2 };
        const aHealth = healthOrder[a.gezondheid] ?? 2;
        const bHealth = healthOrder[b.gezondheid] ?? 2;
        if (aHealth !== bHealth) return aHealth - bHealth;
        return a.bedrijfsnaam.localeCompare(b.bedrijfsnaam, "nl");
      });
  }, [klanten, zoekterm, toonInactief]);

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Klanten</h1>
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
              <p className="text-2xl font-bold text-white tabular-nums">{kpis.actieveKlanten}</p>
              <p className="text-xs text-autronis-text-secondary mt-1">Actieve klanten</p>
            </div>

            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-green-500/10">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-green-400 tabular-nums">{formatBedrag(kpis.totaleOmzet)}</p>
              <p className="text-xs text-autronis-text-secondary mt-1">Totale omzet</p>
            </div>

            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-amber-500/10">
                  <FileText className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", kpis.totaalOpenstaand > 0 ? "text-amber-400" : "text-autronis-text-primary")}>
                {formatBedrag(kpis.totaalOpenstaand)}
              </p>
              <p className="text-xs text-autronis-text-secondary mt-1">Openstaand</p>
            </div>

            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-autronis-accent/10">
                  <AlertCircle className="w-4 h-4 text-autronis-accent" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm font-bold text-autronis-text-primary tabular-nums">{kpis.gezondheid.groen}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-sm font-bold text-autronis-text-primary tabular-nums">{kpis.gezondheid.oranje}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-sm font-bold text-autronis-text-primary tabular-nums">{kpis.gezondheid.rood}</span>
                </div>
              </div>
              <p className="text-xs text-autronis-text-secondary mt-1">Klantgezondheid</p>
            </div>
          </div>
        )}

        {/* Search & Toggle bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-autronis-text-secondary/50" />
            <input
              type="text"
              placeholder="Zoek op bedrijfsnaam, contactpersoon of email..."
              value={zoekterm}
              onChange={(e) => setZoekterm(e.target.value)}
              className="w-full bg-autronis-card border border-autronis-border text-autronis-text-primary rounded-xl pl-11 pr-4 py-3 text-sm placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent/40 transition-colors"
            />
          </div>

          <button
            onClick={() => setToonInactief(!toonInactief)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-colors",
              toonInactief
                ? "bg-autronis-accent/10 border-autronis-accent/30 text-autronis-accent"
                : "bg-autronis-card border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
            )}
          >
            {toonInactief ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {toonInactief ? "Inactief zichtbaar" : "Toon inactief"}
          </button>
        </div>

        {/* Card grid */}
        {laden ? (
          <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
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
          <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {gefilterdeKlanten.map((klant) => (
              <KlantCard
                key={klant.id}
                klant={klant}
                onClick={() => router.push(`/klanten/${klant.id}`)}
              />
            ))}
          </div>
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
