"use client";

import { useEffect, useState, useMemo } from "react";
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
} from "lucide-react";
import { cn, formatUren, formatBedrag } from "@/lib/utils";
import { KlantModal } from "./klant-modal";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonKlanten } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

// ============ TYPES ============

interface Klant {
  id: number;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  email: string | null;
  telefoon: string | null;
  adres: string | null;
  notities: string | null;
  uurtarief: number | null;
  isActief: number;
  aantalProjecten: number;
  totaalMinuten: number;
}

// ============ MAIN PAGE ============

export default function KlantenPage() {
  const router = useRouter();

  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [laden, setLaden] = useState(true);
  const [zoekterm, setZoekterm] = useState("");
  const [toonInactief, setToonInactief] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [bewerkKlant, setBewerkKlant] = useState<Klant | null>(null);

  // Fetch klanten
  const laadKlanten = () => {
    fetch("/api/klanten")
      .then((r) => r.json())
      .then((data) => {
        setKlanten(data.klanten || []);
        setLaden(false);
      })
      .catch(() => {
        setLaden(false);
      });
  };

  useEffect(() => {
    laadKlanten();
  }, []);

  // Filtered & sorted klanten
  const gefilterdeKlanten = useMemo(() => {
    const zoek = zoekterm.toLowerCase().trim();

    return klanten
      .filter((k) => {
        // Filter op actief/inactief
        if (!toonInactief && !k.isActief) return false;

        // Zoekfilter
        if (zoek) {
          return (
            k.bedrijfsnaam.toLowerCase().includes(zoek) ||
            (k.contactpersoon?.toLowerCase().includes(zoek) ?? false) ||
            (k.email?.toLowerCase().includes(zoek) ?? false)
          );
        }
        return true;
      })
      .sort((a, b) => a.bedrijfsnaam.localeCompare(b.bedrijfsnaam, "nl"));
  }, [klanten, zoekterm, toonInactief]);

  const actieveKlanten = klanten.filter((k) => k.isActief).length;

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary">
              Klanten
            </h1>
            <span className="text-sm text-autronis-text-secondary">
              {actieveKlanten} actieve klanten
            </span>
          </div>

          <button
            onClick={() => {
              setBewerkKlant(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
          >
            <Plus className="w-5 h-5" />
            Nieuwe klant
          </button>
        </div>

        {/* Search & Toggle bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
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

          {/* Toggle inactief */}
          <button
            onClick={() => setToonInactief(!toonInactief)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-colors",
              toonInactief
                ? "bg-autronis-accent/10 border-autronis-accent/30 text-autronis-accent"
                : "bg-autronis-card border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
            )}
          >
            {toonInactief ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
            {toonInactief ? "Inactief zichtbaar" : "Toon inactief"}
          </button>
        </div>

        {/* Card grid */}
        {laden ? (
          <SkeletonKlanten />
        ) : gefilterdeKlanten.length === 0 ? (
          zoekterm ? (
            <EmptyState
              titel="Geen klanten gevonden"
              beschrijving="Probeer een andere zoekterm."
              icoon={<Building2 className="w-7 h-7 text-autronis-text-secondary" />}
            />
          ) : (
            <EmptyState
              titel="Geen klanten"
              beschrijving="Voeg je eerste klant toe om van start te gaan."
              actieLabel="Klant toevoegen"
              onActie={() => {
                setBewerkKlant(null);
                setModalOpen(true);
              }}
              icoon={<Building2 className="w-7 h-7 text-autronis-text-secondary" />}
            />
          )
        ) : (
          <div
            className="grid gap-6"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            }}
          >
            {gefilterdeKlanten.map((klant) => (
              <div
                key={klant.id}
                onClick={() => router.push(`/klanten/${klant.id}`)}
                className={cn(
                  "bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6 cursor-pointer card-glow flex flex-col",
                  !klant.isActief && "opacity-60"
                )}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-autronis-text-primary truncate">
                      {klant.bedrijfsnaam}
                    </h3>
                    <p className="text-sm text-autronis-text-secondary truncate mt-0.5">
                      {klant.contactpersoon}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg",
                      klant.isActief
                        ? "bg-green-500/15 text-green-400"
                        : "bg-slate-500/15 text-slate-400"
                    )}
                  >
                    {klant.isActief ? "Actief" : "Inactief"}
                  </span>
                </div>

                {/* Notities */}
                {klant.notities && (
                  <p className="text-sm text-autronis-text-secondary mb-3 line-clamp-2">
                    {klant.notities}
                  </p>
                )}

                {/* Contact info */}
                <div className="space-y-1.5 mb-4">
                  {klant.email && (
                    <div className="flex items-center gap-2 text-sm text-autronis-text-secondary">
                      <Mail className="w-4 h-4 flex-shrink-0 text-autronis-text-secondary/60" />
                      <span className="truncate">{klant.email}</span>
                    </div>
                  )}
                  {klant.telefoon && (
                    <div className="flex items-center gap-2 text-sm text-autronis-text-secondary">
                      <Phone className="w-4 h-4 flex-shrink-0 text-autronis-text-secondary/60" />
                      <span className="truncate">{klant.telefoon}</span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-autronis-border mt-auto mb-4" />

                {/* Footer KPIs */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm text-autronis-text-secondary">
                    <Users className="w-4 h-4 text-autronis-text-secondary/60" />
                    <span className="font-medium tabular-nums">
                      {klant.aantalProjecten}
                    </span>
                    <span className="hidden sm:inline">projecten</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-autronis-text-secondary">
                    <Clock className="w-4 h-4 text-autronis-text-secondary/60" />
                    <span className="font-medium font-mono tabular-nums">
                      {formatUren(klant.totaalMinuten)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-autronis-text-secondary">
                    <Euro className="w-4 h-4 text-autronis-text-secondary/60" />
                    <span className="font-medium tabular-nums">
                      {formatBedrag(klant.uurtarief ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Klant Modal */}
        <KlantModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setBewerkKlant(null);
          }}
          klant={bewerkKlant}
          onOpgeslagen={() => {
            setModalOpen(false);
            setBewerkKlant(null);
            laadKlanten();
          }}
        />
      </div>
    </PageTransition>
  );
}
