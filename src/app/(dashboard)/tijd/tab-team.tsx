"use client";

import { useMemo } from "react";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useScreenTime } from "@/hooks/queries/use-screen-time";
import { useGebruikers } from "@/hooks/queries/use-doelen";
import { CATEGORIE_KLEUREN, CATEGORIE_LABELS, formatTijd } from "./constants";

export function TabTeam({ van, tot }: { van: string; tot: string }) {
  const { data: gebruikers } = useGebruikers();
  const { data: alleEntries, isLoading } = useScreenTime(van, tot);

  const perGebruiker = useMemo(() => {
    if (!gebruikers || !alleEntries) return [];
    return gebruikers.map((g) => {
      const entries = alleEntries.filter((e) => e.gebruikerId === g.id);
      const totaal = entries.reduce((s, e) => s + e.duurSeconden, 0);
      const perCategorie: Record<string, number> = {};
      const perApp: Record<string, number> = {};
      for (const e of entries) {
        perCategorie[e.categorie] = (perCategorie[e.categorie] ?? 0) + e.duurSeconden;
        perApp[e.app] = (perApp[e.app] ?? 0) + e.duurSeconden;
      }
      const topApps = Object.entries(perApp)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([app]) => app);
      return { id: g.id, naam: g.naam, totaal, perCategorie, topApps };
    });
  }, [gebruikers, alleEntries]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {perGebruiker.map((g) => {
        const maxCat = Math.max(...Object.values(g.perCategorie), 1);
        return (
          <div
            key={g.id}
            className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-autronis-accent/10 flex items-center justify-center">
                <span className="text-sm font-bold text-autronis-accent">
                  {g.naam.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-base font-semibold text-autronis-text-primary">{g.naam}</p>
                <p className="text-sm text-autronis-text-secondary tabular-nums">
                  {formatTijd(g.totaal)}
                </p>
              </div>
            </div>

            {/* Category mini-bars */}
            <div className="space-y-2 mb-5">
              {Object.entries(g.perCategorie)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, sec]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-xs text-autronis-text-secondary w-24 truncate shrink-0">
                      {CATEGORIE_LABELS[cat] ?? cat}
                    </span>
                    <div className="flex-1 h-3 bg-autronis-bg rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(sec / maxCat) * 100}%`,
                          backgroundColor: CATEGORIE_KLEUREN[cat] ?? "#6B7280",
                        }}
                      />
                    </div>
                    <span className="text-xs text-autronis-text-secondary tabular-nums w-14 text-right shrink-0">
                      {formatTijd(sec)}
                    </span>
                  </div>
                ))}
            </div>

            {/* Top 3 apps */}
            {g.topApps.length > 0 && (
              <div>
                <p className="text-xs text-autronis-text-secondary mb-2 uppercase tracking-wide">
                  Top apps
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.topApps.map((app) => (
                    <span
                      key={app}
                      className="px-2.5 py-1 bg-autronis-bg rounded-lg text-xs text-autronis-text-primary"
                    >
                      {app}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
