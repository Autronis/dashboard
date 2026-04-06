"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Clock, Briefcase, TrendingUp, Zap, Brain, Building2, Home } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeamRegistraties } from "@/hooks/queries/use-tijdregistraties";
import { useGebruikers } from "@/hooks/queries/use-doelen";
import { CATEGORIE_KLEUREN, CATEGORIE_LABELS, formatTijd } from "./constants";
import type { SessiesData } from "@/hooks/queries/use-screen-time";

interface JaarOverzichtGebruiker {
  gebruikerId: number;
  naam: string;
  totaalUren: number;
  kantoorUren: number;
  thuisUren: number;
  doelUren: number;
  voortgangPercentage: number;
}

function useJaarOverzicht() {
  const jaar = new Date().getFullYear();
  return useQuery({
    queryKey: ["jaaroverzicht", jaar],
    queryFn: async () => {
      const res = await fetch(`/api/tijdregistraties/jaaroverzicht?jaar=${jaar}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.overzicht ?? []) as JaarOverzichtGebruiker[];
    },
    staleTime: 60_000,
  });
}

function formatMinuten(min: number): string {
  const uren = Math.floor(min / 60);
  const rest = Math.round(min % 60);
  if (uren === 0) return `${rest}m`;
  return rest > 0 ? `${uren}u ${rest}m` : `${uren}u`;
}

// Fetch sessies for all users (per gebruiker)
function useTeamSessies(datum: string, gebruikerIds: number[]) {
  return useQuery({
    queryKey: ["team-sessies", datum, gebruikerIds],
    queryFn: async () => {
      const results = await Promise.all(
        gebruikerIds.map(async (id) => {
          const res = await fetch(`/api/screen-time/sessies?datum=${datum}&gebruikerId=${id}`);
          if (!res.ok) return { gebruikerId: id, data: null };
          const data: SessiesData = await res.json();
          return { gebruikerId: id, data };
        })
      );
      return results;
    },
    enabled: gebruikerIds.length > 0,
    staleTime: 30_000,
  });
}

export function TabTeam({ van, tot }: { van: string; tot: string }) {
  const { data: gebruikers } = useGebruikers();
  const { data: registraties, isLoading: regLoading } = useTeamRegistraties(van, tot);
  const { data: jaarOverzicht = [] } = useJaarOverzicht();

  const gebruikerIds = useMemo(() => (gebruikers ?? []).map((g) => g.id), [gebruikers]);
  const { data: teamSessies, isLoading: sessiesLoading } = useTeamSessies(van, gebruikerIds);

  const isLoading = regLoading || sessiesLoading;

  const perGebruiker = useMemo(() => {
    if (!gebruikers) return [];
    const now = Date.now();

    return gebruikers.map((g) => {
      // Screen time sessies data
      const sessie = teamSessies?.find((s) => s.gebruikerId === g.id)?.data;
      const actiefSec = sessie?.stats?.totaalActief ?? 0;
      const productiefPct = sessie?.stats?.productiefPercentage ?? 0;
      const focusScore = sessie?.stats?.focusScore ?? 0;
      const deepWorkMin = sessie?.stats?.deepWorkMinuten ?? 0;
      const aantalSessies = sessie?.stats?.aantalSessies ?? 0;

      // Time registration data — calculate live duration for active timers
      const userRegs = (registraties ?? []).filter((r) => r.gebruikerId === g.id);
      const gewerktMin = userRegs.reduce((s, r) => {
        if (r.duurMinuten != null) return s + r.duurMinuten;
        if (!r.eindTijd && r.startTijd) {
          return s + Math.round((now - new Date(r.startTijd).getTime()) / 60000);
        }
        return s;
      }, 0);

      // Per project breakdown
      const perProject: Record<string, { minuten: number; categorie: string }> = {};
      for (const r of userRegs) {
        const proj = r.projectNaam ?? "Onbekend project";
        if (!perProject[proj]) perProject[proj] = { minuten: 0, categorie: r.categorie };
        if (r.duurMinuten != null) {
          perProject[proj].minuten += r.duurMinuten;
        } else if (!r.eindTijd && r.startTijd) {
          perProject[proj].minuten += Math.round((now - new Date(r.startTijd).getTime()) / 60000);
        }
      }
      const topProjecten = Object.entries(perProject)
        .sort(([, a], [, b]) => b.minuten - a.minuten)
        .slice(0, 5);

      // Per category breakdown (registraties)
      const perRegCategorie: Record<string, number> = {};
      for (const r of userRegs) {
        const min = r.duurMinuten ?? (!r.eindTijd && r.startTijd ? Math.round((now - new Date(r.startTijd).getTime()) / 60000) : 0);
        perRegCategorie[r.categorie] = (perRegCategorie[r.categorie] ?? 0) + min;
      }

      // Locatie split
      let kantoorMin = 0;
      let thuisMin = 0;
      let huidigeLocatie: "kantoor" | "thuis" | null = null;
      for (const r of userRegs) {
        const min = r.duurMinuten ?? (!r.eindTijd && r.startTijd ? Math.round((now - new Date(r.startTijd).getTime()) / 60000) : 0);
        if (r.locatie === "kantoor") kantoorMin += min;
        else if (r.locatie === "thuis") thuisMin += min;
        // Detect current location from active timer
        if (!r.eindTijd && r.locatie) huidigeLocatie = r.locatie as "kantoor" | "thuis";
      }

      return {
        id: g.id,
        naam: g.naam,
        actiefSec,
        productiefPct,
        focusScore,
        deepWorkMin,
        aantalSessies,
        gewerktMin,
        perRegCategorie,
        topProjecten,
        aantalRegistraties: userRegs.length,
        kantoorMin,
        thuisMin,
        huidigeLocatie,
      };
    });
  }, [gebruikers, teamSessies, registraties]);

  // Team totals
  const teamTotalen = useMemo(() => {
    const totaalActief = perGebruiker.reduce((s, g) => s + g.actiefSec, 0);
    const totaalGewerkt = perGebruiker.reduce((s, g) => s + g.gewerktMin, 0);
    const totaalRegistraties = perGebruiker.reduce((s, g) => s + g.aantalRegistraties, 0);
    const gemFocus = perGebruiker.length > 0
      ? Math.round(perGebruiker.reduce((s, g) => s + g.focusScore, 0) / perGebruiker.filter((g) => g.focusScore > 0).length || 0)
      : 0;
    return { totaalActief, totaalGewerkt, totaalRegistraties, gemFocus };
  }, [perGebruiker]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-autronis-accent/10 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-autronis-accent" />
            </div>
            <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Actieve tijd</p>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {formatTijd(teamTotalen.totaalActief)}
          </p>
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Briefcase className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Geregistreerd</p>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {formatMinuten(teamTotalen.totaalGewerkt)}
          </p>
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-green-400" />
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
              <Brain className="w-4.5 h-4.5 text-purple-400" />
            </div>
            <p className="text-xs text-autronis-text-secondary uppercase tracking-wide">Gem. focus</p>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {teamTotalen.gemFocus > 0 ? teamTotalen.gemFocus : "—"}
          </p>
        </div>
      </div>

      {/* Urencriterium voortgang */}
      {jaarOverzicht.length > 0 && (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-autronis-accent/10 flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-autronis-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-autronis-text-primary">Urencriterium {new Date().getFullYear()}</p>
              <p className="text-xs text-autronis-text-secondary">Voortgang richting 1.225 uur per vennoot</p>
            </div>
          </div>
          <div className="space-y-5">
            {jaarOverzicht.map((g) => (
              <div key={g.gebruikerId}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-autronis-text-primary">{g.naam}</span>
                  <span className="text-sm text-autronis-text-secondary tabular-nums">
                    {Math.round(g.totaalUren)}u / {g.doelUren}u
                    <span className="ml-2 text-xs font-medium text-autronis-accent">{g.voortgangPercentage}%</span>
                  </span>
                </div>
                <div className="w-full h-4 bg-autronis-bg rounded-full overflow-hidden flex">
                  {g.kantoorUren > 0 && (
                    <div
                      className="h-full bg-blue-400"
                      style={{ width: `${(g.kantoorUren / g.doelUren) * 100}%` }}
                      title={`Kantoor: ${Math.round(g.kantoorUren)}u`}
                    />
                  )}
                  {g.thuisUren > 0 && (
                    <div
                      className="h-full bg-orange-400"
                      style={{ width: `${(g.thuisUren / g.doelUren) * 100}%` }}
                      title={`Thuis: ${Math.round(g.thuisUren)}u`}
                    />
                  )}
                  {g.totaalUren - g.kantoorUren - g.thuisUren > 0 && (
                    <div
                      className="h-full bg-autronis-text-secondary/30"
                      style={{ width: `${((g.totaalUren - g.kantoorUren - g.thuisUren) / g.doelUren) * 100}%` }}
                      title={`Onbekend: ${Math.round(g.totaalUren - g.kantoorUren - g.thuisUren)}u`}
                    />
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-autronis-text-secondary">
                  {g.kantoorUren > 0 && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-blue-400" />
                      Kantoor {Math.round(g.kantoorUren)}u
                    </span>
                  )}
                  {g.thuisUren > 0 && (
                    <span className="flex items-center gap-1">
                      <Home className="w-3 h-3 text-orange-400" />
                      Thuis {Math.round(g.thuisUren)}u
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-autronis-accent/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-autronis-accent">
                    {g.naam.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-autronis-text-primary">{g.naam}</p>
                    {g.huidigeLocatie && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        g.huidigeLocatie === "kantoor"
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-orange-500/10 text-orange-400"
                      }`}>
                        {g.huidigeLocatie === "kantoor" ? <Building2 className="w-3 h-3" /> : <Home className="w-3 h-3" />}
                        {g.huidigeLocatie === "kantoor" ? "Kantoor" : "Thuis"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-autronis-text-secondary">
                    <span className="tabular-nums">{formatTijd(g.actiefSec)} actief</span>
                    {g.gewerktMin > 0 && (
                      <>
                        <span className="text-autronis-border">|</span>
                        <span className="tabular-nums">{formatMinuten(g.gewerktMin)} geregistreerd</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              {(g.focusScore > 0 || g.deepWorkMin > 0 || g.aantalSessies > 0) && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {g.focusScore > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-xs font-medium text-purple-400">
                      <Brain className="w-3 h-3" />
                      Focus {g.focusScore}
                    </span>
                  )}
                  {g.deepWorkMin > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 text-xs font-medium text-green-400">
                      <Zap className="w-3 h-3" />
                      {formatMinuten(g.deepWorkMin)} deep work
                    </span>
                  )}
                  {g.productiefPct > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-autronis-accent/10 text-xs font-medium text-autronis-accent">
                      {g.productiefPct}% productief
                    </span>
                  )}
                  {g.aantalSessies > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-xs font-medium text-blue-400">
                      {g.aantalSessies} sessies
                    </span>
                  )}
                </div>
              )}

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

              {/* Locatie split */}
              {(g.kantoorMin > 0 || g.thuisMin > 0) && (
                <div className="mb-5">
                  <p className="text-xs text-autronis-text-secondary mb-2.5 uppercase tracking-wide">
                    Locatie
                  </p>
                  <div className="flex items-center gap-3 mb-1.5">
                    {g.kantoorMin > 0 && (
                      <span className="flex items-center gap-1 text-xs text-autronis-text-secondary">
                        <Building2 className="w-3 h-3 text-blue-400" />
                        Kantoor {formatMinuten(g.kantoorMin)}
                      </span>
                    )}
                    {g.thuisMin > 0 && (
                      <span className="flex items-center gap-1 text-xs text-autronis-text-secondary">
                        <Home className="w-3 h-3 text-orange-400" />
                        Thuis {formatMinuten(g.thuisMin)}
                      </span>
                    )}
                  </div>
                  <div className="w-full h-3 bg-autronis-bg rounded-full overflow-hidden flex">
                    {g.kantoorMin > 0 && (
                      <div
                        className="h-full bg-blue-400 rounded-l-full transition-all duration-500"
                        style={{ width: `${(g.kantoorMin / (g.kantoorMin + g.thuisMin)) * 100}%` }}
                      />
                    )}
                    {g.thuisMin > 0 && (
                      <div
                        className="h-full bg-orange-400 rounded-r-full transition-all duration-500"
                        style={{ width: `${(g.thuisMin / (g.kantoorMin + g.thuisMin)) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {g.topProjecten.length === 0 && g.actiefSec === 0 && (
                <p className="text-sm text-autronis-text-secondary/60 italic">
                  Nog geen activiteit voor deze periode
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
