"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, X, Zap, CheckSquare, Clock, ChevronUp } from "lucide-react";
import { useTeamLive } from "@/hooks/queries/use-team-live";

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

const TYPE_ICON: Record<string, typeof Zap> = {
  taak_gepakt: Zap,
  taak_afgerond: CheckSquare,
  taak_update: Clock,
  status_wijziging: Zap,
};

const TYPE_KLEUR: Record<string, string> = {
  taak_gepakt: "text-blue-400",
  taak_afgerond: "text-green-400",
  taak_update: "text-autronis-accent",
  status_wijziging: "text-orange-400",
};

export function TeamFloat() {
  const [open, setOpen] = useState(false);
  const { data } = useTeamLive();

  if (!data) return null;

  const { bezigMet, recenteActiviteit, huidigeGebruiker } = data;
  const anderen = bezigMet.filter((t) => t.gebruikerId !== huidigeGebruiker.id);
  const actief = bezigMet.length;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 lg:left-[17rem] z-40">
      {/* Collapsed: compact indicator */}
      {!open && (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-autronis-card/95 backdrop-blur-md border border-autronis-border rounded-full px-3.5 py-2 shadow-lg hover:border-autronis-accent/40 transition-colors group"
        >
          <div className="relative">
            <Users className="w-4 h-4 text-autronis-accent" />
            {actief > 0 && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 status-pulse" />
            )}
          </div>
          <span className="text-xs font-medium text-autronis-text-primary">
            {actief > 0 ? `${actief} actief` : "Team"}
          </span>
          {anderen.length > 0 && (
            <div className="flex -space-x-1.5">
              {anderen.slice(0, 3).map((t) => (
                <div
                  key={t.taakId}
                  className="w-5 h-5 rounded-full bg-purple-500/25 border border-autronis-card flex items-center justify-center text-[8px] font-bold text-purple-400"
                >
                  {t.gebruikerNaam.slice(0, 1).toUpperCase()}
                </div>
              ))}
            </div>
          )}
          <ChevronUp className="w-3 h-3 text-autronis-text-secondary group-hover:text-autronis-accent transition-colors" />
        </motion.button>
      )}

      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-autronis-card/95 backdrop-blur-md border border-autronis-border rounded-2xl shadow-2xl w-72 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-autronis-border/50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-autronis-accent" />
                <span className="text-sm font-semibold text-autronis-text-primary">Team Live</span>
                {actief > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 status-pulse" />
                    {actief}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-autronis-border/30 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-3">
              {/* Wie werkt waaraan */}
              {bezigMet.length > 0 ? (
                <div className="space-y-2">
                  {bezigMet.map((t) => {
                    const isJij = t.gebruikerId === huidigeGebruiker.id;
                    return (
                      <div
                        key={t.taakId}
                        className="flex items-start gap-2.5"
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5 ${
                            isJij
                              ? "bg-autronis-accent/20 text-autronis-accent"
                              : "bg-purple-500/20 text-purple-400"
                          }`}
                        >
                          {isJij ? "JIJ" : t.gebruikerNaam.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-autronis-text-primary truncate">
                            {t.taakTitel}
                          </p>
                          {t.projectNaam && (
                            <p className="text-[10px] text-autronis-text-secondary/60 truncate">
                              {t.projectNaam}
                            </p>
                          )}
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-autronis-text-secondary text-center py-1">
                  Niemand actief
                </p>
              )}

              {/* Recente activiteit */}
              {recenteActiviteit.length > 0 && (
                <>
                  <div className="border-t border-autronis-border/30 pt-2">
                    <p className="text-[9px] font-semibold text-autronis-text-secondary uppercase tracking-wider mb-1.5">
                      Recent
                    </p>
                    {recenteActiviteit.slice(0, 4).map((a) => {
                      const Icon = TYPE_ICON[a.type] || Clock;
                      const kleur = TYPE_KLEUR[a.type] || "text-autronis-text-secondary";
                      return (
                        <div key={a.id} className="flex items-start gap-1.5 py-0.5">
                          <Icon className={`w-2.5 h-2.5 mt-0.5 flex-shrink-0 ${kleur}`} />
                          <p className="text-[10px] text-autronis-text-secondary leading-snug flex-1 truncate">
                            <span className="font-medium text-autronis-text-primary">
                              {a.gebruikerNaam.split(" ")[0]}
                            </span>{" "}
                            {a.bericht}
                          </p>
                          <span className="text-[8px] text-autronis-text-secondary/40 flex-shrink-0">
                            {tijdGeleden(a.aangemaaktOp)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
