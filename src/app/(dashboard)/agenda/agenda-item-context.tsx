"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { klantKleur } from "@/lib/klant-kleuren";
import { Check, Copy, ExternalLink, Sparkles } from "lucide-react";
import type { AgendaItem } from "@/hooks/queries/use-agenda";

interface Props {
  item: AgendaItem;
  onAfgerond?: () => void;
}

const EIGENAAR_KLEUR: Record<string, string> = {
  sem: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  syb: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  team: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  vrij: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

const STATUS_KLEUR: Record<string, string> = {
  open: "bg-slate-500/15 text-slate-300",
  bezig: "bg-amber-500/15 text-amber-300",
  afgerond: "bg-green-500/15 text-green-300",
};

const PRIO_KLEUR: Record<string, string> = {
  laag: "text-slate-400",
  normaal: "text-slate-200",
  hoog: "text-rose-300",
};

export function AgendaItemContext({ item, onAfgerond }: Props) {
  const [afrondenBezig, setAfrondenBezig] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);

  const heeftContext = !!(
    item.projectNaam ||
    item.taakId ||
    item.pijler ||
    item.gemaaktDoor === "bridge"
  );
  if (!heeftContext) return null;

  const projKleur = klantKleur(item.projectId);
  const showMarkeerAfgerond = item.taakId && item.taakStatus && item.taakStatus !== "afgerond";
  const showCopyPrompt = item.taakUitvoerder === "claude" && !!item.taakPrompt;

  async function markeerAfgerond() {
    if (!item.taakId) return;
    setAfrondenBezig(true);
    try {
      const res = await fetch(`/api/taken/${item.taakId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "afgerond" }),
      });
      if (res.ok) onAfgerond?.();
    } finally {
      setAfrondenBezig(false);
    }
  }

  async function copyPrompt() {
    if (!item.taakPrompt) return;
    await navigator.clipboard.writeText(item.taakPrompt);
    setGekopieerd(true);
    setTimeout(() => setGekopieerd(false), 1500);
  }

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-autronis-border bg-autronis-bg/40 p-3">
      {/* Badges rij */}
      <div className="flex flex-wrap items-center gap-1.5">
        {item.eigenaar && (
          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md border capitalize", EIGENAAR_KLEUR[item.eigenaar] ?? EIGENAAR_KLEUR.vrij)}>
            {item.eigenaar}
          </span>
        )}
        {item.gemaaktDoor === "bridge" && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-autronis-accent/15 text-autronis-accent border border-autronis-accent/30 inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Atlas
          </span>
        )}
        {item.pijler && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            {item.pijler}
          </span>
        )}
        {item.taakCluster && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-500/15 text-slate-300 border border-slate-500/30">
            {item.taakCluster}
          </span>
        )}
      </div>

      {/* Project + fase */}
      {(item.projectNaam || item.taakFase) && (
        <div className="flex items-center gap-2 text-sm">
          {item.projectNaam && (
            <>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: projKleur }} />
              {item.projectId ? (
                <Link
                  href={`/projecten/${item.projectId}`}
                  className="text-autronis-text-primary hover:text-autronis-accent transition-colors font-medium inline-flex items-center gap-1"
                >
                  {item.projectNaam}
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </Link>
              ) : (
                <span className="text-autronis-text-primary font-medium">{item.projectNaam}</span>
              )}
            </>
          )}
          {item.taakFase && (
            <>
              {item.projectNaam && <span className="text-autronis-text-secondary/40">·</span>}
              <span className="text-autronis-text-secondary text-xs">{item.taakFase}</span>
            </>
          )}
        </div>
      )}

      {/* Taak card */}
      {item.taakId && item.taakTitel && (
        <div className="rounded-lg border border-autronis-border bg-autronis-card/50 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-autronis-text-secondary mb-0.5">Gekoppelde taak</div>
              <div className="text-sm text-autronis-text-primary font-medium">{item.taakTitel}</div>
            </div>
            {item.taakStatus && (
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md whitespace-nowrap", STATUS_KLEUR[item.taakStatus] ?? STATUS_KLEUR.open)}>
                {item.taakStatus}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {item.taakPrioriteit && (
              <span className={cn("font-medium", PRIO_KLEUR[item.taakPrioriteit])}>
                {item.taakPrioriteit === "hoog" ? "! hoog" : item.taakPrioriteit}
              </span>
            )}
            {item.taakUitvoerder && (
              <span className="text-autronis-text-secondary">
                door {item.taakUitvoerder}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            {showMarkeerAfgerond && (
              <button
                type="button"
                onClick={markeerAfgerond}
                disabled={afrondenBezig}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-green-500/15 text-green-300 border border-green-500/30 hover:bg-green-500/25 transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {afrondenBezig ? "Bezig..." : "Markeer afgerond"}
              </button>
            )}
            {showCopyPrompt && (
              <button
                type="button"
                onClick={copyPrompt}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-autronis-accent/10 text-autronis-accent border border-autronis-accent/30 hover:bg-autronis-accent/20 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {gekopieerd ? "Gekopieerd" : "Copy Claude prompt"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
