"use client";

import { useTeamLive } from "@/hooks/queries/use-team-live";
import { Users, CheckSquare, Zap, Clock } from "lucide-react";

const TYPE_CONFIG: Record<string, { icon: typeof Zap; kleur: string; label: string }> = {
  taak_gepakt: { icon: Zap, kleur: "text-blue-400", label: "gestart" },
  taak_afgerond: { icon: CheckSquare, kleur: "text-emerald-400", label: "afgerond" },
  taak_update: { icon: Clock, kleur: "text-autronis-accent", label: "update" },
  status_wijziging: { icon: Zap, kleur: "text-orange-400", label: "status" },
  bezig_met: { icon: Clock, kleur: "text-purple-400", label: "bezig" },
};

function tijdGeleden(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "net";
  if (min < 60) return `${min}m`;
  const uur = Math.floor(min / 60);
  if (uur < 24) return `${uur}u`;
  return `${Math.floor(uur / 24)}d`;
}

export function TeamLiveWidget() {
  const { data, isLoading } = useTeamLive();

  if (isLoading || !data) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 card-glow animate-pulse">
        <div className="h-5 bg-autronis-border/30 rounded w-32 mb-3" />
        <div className="space-y-2">
          <div className="h-10 bg-autronis-border/20 rounded-xl" />
          <div className="h-10 bg-autronis-border/20 rounded-xl" />
        </div>
      </div>
    );
  }

  const { bezigMet, recenteActiviteit, huidigeGebruiker } = data;
  const andereBezigMet = bezigMet.filter((t) => t.gebruikerId !== huidigeGebruiker.id);
  const mijnTaken = bezigMet.filter((t) => t.gebruikerId === huidigeGebruiker.id);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 card-glow">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <Users className="w-4.5 h-4.5 text-autronis-accent" />
        <h3 className="text-sm font-semibold text-autronis-text-primary">Team Live</h3>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 status-pulse" />
          <span className="text-[10px] text-emerald-400 font-medium">{bezigMet.length} actief</span>
        </div>
      </div>

      {/* Wie werkt waaraan */}
      {andereBezigMet.length > 0 && (
        <div className="space-y-2 mb-4">
          {andereBezigMet.map((t) => (
            <div
              key={t.taakId}
              className="bg-autronis-bg/50 rounded-xl p-3 border-l-[3px] border-purple-500"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400">
                  {t.gebruikerNaam.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-autronis-text-primary">{t.gebruikerNaam}</span>
                <div className="ml-auto flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-emerald-400">bezig</span>
                </div>
              </div>
              <p className="text-xs text-autronis-text-secondary ml-8 truncate">{t.taakTitel}</p>
              {t.projectNaam && (
                <p className="text-[10px] text-autronis-text-secondary/60 ml-8 mt-0.5">{t.projectNaam}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mijn actieve taken */}
      {mijnTaken.length > 0 && (
        <div className="space-y-2 mb-4">
          {mijnTaken.map((t) => (
            <div
              key={t.taakId}
              className="bg-autronis-bg/50 rounded-xl p-3 border-l-[3px] border-autronis-accent"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-autronis-accent/20 flex items-center justify-center text-[10px] font-bold text-autronis-accent">
                  JIJ
                </div>
                <span className="text-xs font-medium text-autronis-text-primary truncate flex-1">{t.taakTitel}</span>
              </div>
              {t.projectNaam && (
                <p className="text-[10px] text-autronis-text-secondary/60 ml-8">{t.projectNaam}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Geen actieve taken */}
      {bezigMet.length === 0 && (
        <p className="text-xs text-autronis-text-secondary text-center py-2 mb-3">
          Niemand is op dit moment ergens mee bezig
        </p>
      )}

      {/* Recente activiteit feed */}
      {recenteActiviteit.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-autronis-text-secondary uppercase tracking-wider mb-2">
            Recente activiteit
          </p>
          <div className="space-y-1.5">
            {recenteActiviteit.slice(0, 5).map((a) => {
              const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.taak_update;
              const Icon = cfg.icon;
              return (
                <div key={a.id} className="flex items-start gap-2 py-1">
                  <Icon className={`w-3 h-3 mt-0.5 flex-shrink-0 ${cfg.kleur}`} />
                  <p className="text-[11px] text-autronis-text-secondary leading-snug flex-1">
                    <span className="font-medium text-autronis-text-primary">{a.gebruikerNaam.split(" ")[0]}</span>
                    {" "}{a.bericht}
                  </p>
                  <span className="text-[9px] text-autronis-text-secondary/50 tabular-nums flex-shrink-0">
                    {tijdGeleden(a.aangemaaktOp)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
