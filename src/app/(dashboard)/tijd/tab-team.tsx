"use client";

import { useMemo } from "react";
import { Users, Clock, Briefcase, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useScreenTime } from "@/hooks/queries/use-screen-time";
import { useTeamRegistraties } from "@/hooks/queries/use-tijdregistraties";
import { useGebruikers } from "@/hooks/queries/use-doelen";
import { CATEGORIE_KLEUREN, CATEGORIE_LABELS, formatTijd } from "./constants";

function formatMinuten(min: number): string {
  const uren = Math.floor(min / 60);
  const rest = Math.round(min % 60);
  if (uren === 0) return `${rest}m`;
  return rest > 0 ? `${uren}u ${rest}m` : `${uren}u`;
}

export function TabTeam({ van, tot }: { van: string; tot: string }) {
  const { data: gebruikers } = useGebruikers();
  const { data: alleEntries, isLoading: screenLoading } = useScreenTime(van, tot);
  const { data: registraties, isLoading: regLoading } = useTeamRegistraties(van, tot);

  const isLoading = screenLoading || regLoading;

  const perGebruiker = useMemo(() => {
    if (!gebruikers) return [];
    return gebruikers.map((g) => {
      // Screen time data
      const screenEntries = (alleEntries ?? []).filter((e) => e.gebruikerId === g.id);
      const schermtijdSec = screenEntries.reduce((s, e) => s + e.duurSeconden, 0);
      const perCategorie: Record<string, number> = {};
      for (const e of screenEntries) {
        perCategorie[e.categorie] = (perCategorie[e.categorie] ?? 0) + e.duurSeconden;
      }

      // Time registration data
      const userRegs = (registraties ?? []).filter((r) => r.gebruikerId === g.id);
      const gewerktMin = userRegs.reduce((s, r) => s + (r.duurMinuten ?? 0), 0);

      // Per project breakdown
      const perProject: Record<string, { minuten: number; categorie: string }> = {};
      for (const r of userRegs) {
        const proj = r.projectNaam ?? "Onbekend project";
        if (!perProject[proj]) perProject[proj] = { minuten: 0, categorie: r.categorie };
        perProject[proj].minuten += r.duurMinuten ?? 0;
      }
      const topProjecten = Object.entries(perProject)
        .sort(([, a], [, b]) => b.minuten - a.minuten)
        .slice(0, 5);

      // Per category breakdown (registraties)
      const perRegCategorie: Record<string, number> = {};
      for (const r of userRegs) {
        perRegCategorie[r.categorie] = (perRegCategorie[r.categorie] ?? 0) + (r.duurMinuten ?? 0);
      }

      const aantalRegistraties = userRegs.length;

      return {
        id: g.id,
        naam: g.naam,
        schermtijdSec,
        gewerktMin,
        perCategorie,
        perRegCategorie,
        topProjecten,
        aantalRegistraties,
      };
    });
  }, [gebruikers, alleEntries, registraties]);

  // Team totals
  const teamTotalen = useMemo(() => {
    const totaalGewerkt = perGebruiker.reduce((s, g) => s + g.gewerktMin, 0);
    const totaalSchermtijd = perGebruiker.reduce((s, g) => s + g.schermtijdSec, 0);
    const totaalRegistraties = perGebruiker.reduce((s, g) => s + g.aantalRegistraties, 0);
    return { totaalGewerkt, totaalSchermtijd, totaalRegistraties };
  }, [perGebruiker]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!perGebruiker.length) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
        <Users className="w-12 h-12 text-autronis-text-secondary mx-auto mb-4 opacity-40" />
        <p className="text-autronis-text-secondary text-lg">Geen teamgegevens beschikbaar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-autronis-accent/10 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-autronis-accent" />
            </div>
            <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Gewerkte uren</p>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {formatMinuten(teamTotalen.totaalGewerkt)}
          </p>
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Registraties</p>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {teamTotalen.totaalRegistraties}
          </p>
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Briefcase className="w-4.5 h-4.5 text-purple-400" />
            </div>
            <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Schermtijd</p>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {formatTijd(teamTotalen.totaalSchermtijd)}
          </p>
        </div>
      </div>

      {/* Per person cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {perGebruiker.map((g) => {
          const maxProj = Math.max(...g.topProjecten.map(([, p]) => p.minuten), 1);
          const maxRegCat = Math.max(...Object.values(g.perRegCategorie), 1);

          return (
            <div
              key={g.id}
              className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-autronis-accent/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-autronis-accent">
                    {g.naam.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-autronis-text-primary">{g.naam}</p>
                  <div className="flex items-center gap-3 text-sm text-autronis-text-secondary">
                    <span className="tabular-nums">{formatMinuten(g.gewerktMin)} gewerkt</span>
                    <span className="text-autronis-border">|</span>
                    <span className="tabular-nums">{g.aantalRegistraties} registraties</span>
                  </div>
                </div>
              </div>

              {/* Projecten breakdown */}
              {g.topProjecten.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-autronis-text-secondary mb-2.5 uppercase tracking-wide">
                    Projecten
                  </p>
                  <div className="space-y-2">
                    {g.topProjecten.map(([proj, data]) => (
                      <div key={proj} className="flex items-center gap-3">
                        <span className="text-xs text-autronis-text-secondary w-28 truncate shrink-0" title={proj}>
                          {proj}
                        </span>
                        <div className="flex-1 h-3 bg-autronis-bg rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(data.minuten / maxProj) * 100}%`,
                              backgroundColor: CATEGORIE_KLEUREN[data.categorie] ?? "#17B8A5",
                            }}
                          />
                        </div>
                        <span className="text-xs text-autronis-text-secondary tabular-nums w-14 text-right shrink-0">
                          {formatMinuten(data.minuten)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categorie breakdown */}
              {Object.keys(g.perRegCategorie).length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-autronis-text-secondary mb-2.5 uppercase tracking-wide">
                    Per categorie
                  </p>
                  <div className="space-y-2">
                    {Object.entries(g.perRegCategorie)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, min]) => (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-xs text-autronis-text-secondary w-28 truncate shrink-0">
                            {CATEGORIE_LABELS[cat] ?? cat}
                          </span>
                          <div className="flex-1 h-3 bg-autronis-bg rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${(min / maxRegCat) * 100}%`,
                                backgroundColor: CATEGORIE_KLEUREN[cat] ?? "#6B7280",
                              }}
                            />
                          </div>
                          <span className="text-xs text-autronis-text-secondary tabular-nums w-14 text-right shrink-0">
                            {formatMinuten(min)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Schermtijd (if available) */}
              {g.schermtijdSec > 0 && (
                <div className="pt-4 border-t border-autronis-border">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Schermtijd</p>
                    <p className="text-sm text-autronis-text-primary tabular-nums">{formatTijd(g.schermtijdSec)}</p>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {g.topProjecten.length === 0 && g.schermtijdSec === 0 && (
                <p className="text-sm text-autronis-text-secondary/60 italic">
                  Nog geen registraties voor deze periode
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
