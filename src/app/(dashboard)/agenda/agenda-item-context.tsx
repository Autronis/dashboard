"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { klantKleur } from "@/lib/klant-kleuren";
import { Check, Copy, ExternalLink, Sparkles, ListChecks, Clock, Send, Split } from "lucide-react";
import type { AgendaItem } from "@/hooks/queries/use-agenda";

interface Stap {
  stap: string;
  duurMin: number;
}

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
  const [verstuurBezig, setVerstuurBezig] = useState(false);
  const [verstuurd, setVerstuurd] = useState(false);
  const [avatars, setAvatars] = useState<Record<string, { naam: string; avatarUrl: string | null }>>({});

  useEffect(() => {
    fetch("/api/team/avatars")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.avatars) setAvatars(json.avatars);
      })
      .catch(() => { /* silent */ });
  }, []);

  const heeftContext = !!(
    item.projectNaam ||
    item.taakId ||
    item.pijler ||
    item.gemaaktDoor === "bridge" ||
    item.stappenplan ||
    item.aiContext ||
    item.geschatteDuurMinuten ||
    item.parallelActiviteit
  );
  if (!heeftContext) return null;

  const projKleur = klantKleur(item.projectId);
  const showMarkeerAfgerond = item.taakId && item.taakStatus && item.taakStatus !== "afgerond";
  const showCopyPrompt = item.taakUitvoerder === "claude" && !!item.taakPrompt;
  // Markeer-verstuurd is zichtbaar voor sales-pitch blokken (pijler sales_engine
  // + titel suggereert pitch/voorstel). Updates een gekoppelde lead naar
  // status='offerte' zodat Atlas hem niet opnieuw pakt morgen.
  const isPitchBlok = item.pijler === "sales_engine" && /pitch|voorstel/i.test(item.titel);

  const ownerAvatar = item.eigenaar === "sem" || item.eigenaar === "syb" ? avatars[item.eigenaar]?.avatarUrl ?? null : null;
  const ownerNaam: string = item.eigenaar === "sem" ? "Sem · Atlas" : item.eigenaar === "syb" ? "Syb · Autro" : item.eigenaar ?? "onbekend";

  const stappen = useMemo<Stap[]>(() => {
    if (!item.stappenplan) return [];
    try {
      const parsed = JSON.parse(item.stappenplan);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((s): s is Stap => s && typeof s.stap === "string" && typeof s.duurMin === "number")
        .map((s) => ({ stap: s.stap.trim(), duurMin: Math.max(0, s.duurMin) }));
    } catch {
      return [];
    }
  }, [item.stappenplan]);

  const stappenTotaal = stappen.reduce((sum, s) => sum + s.duurMin, 0);

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

  async function markeerVerstuurd() {
    // Zoek de lead op bedrijfsnaam uit de blok-titel ("Pitch voorstel X" of
    // "X — voorstel"). Valt de match weg, toon alleen bevestiging zonder
    // DB-update zodat Sem niet vastloopt.
    setVerstuurBezig(true);
    try {
      const match = item.titel.match(/(?:pitch|voorstel)\s+(?:voor|naar)?\s*(.+?)(?:\s*—|$)/i);
      const bedrijfsnaam = match?.[1]?.trim();
      if (bedrijfsnaam) {
        const leadsRes = await fetch(`/api/klant-leads?zoek=${encodeURIComponent(bedrijfsnaam)}`);
        if (leadsRes.ok) {
          const data = await leadsRes.json() as { leads?: Array<{ id: number; bedrijfsnaam: string; status: string }> };
          const lead = data.leads?.find((l) => l.bedrijfsnaam.toLowerCase().includes(bedrijfsnaam.toLowerCase()));
          if (lead) {
            await fetch(`/api/klant-leads/${lead.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "offerte", volgendeActie: "Follow-up na verzenden" }),
            });
          }
        }
      }
      setVerstuurd(true);
    } finally {
      setVerstuurBezig(false);
    }
  }

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-autronis-border bg-autronis-bg/40 p-3">
      {/* Eigenaar header met avatar */}
      {item.eigenaar && item.eigenaar !== "vrij" && (
        <div className="flex items-center gap-2.5 pb-2 border-b border-autronis-border/60">
          <div className={cn(
            "relative flex items-center justify-center w-9 h-9 rounded-full ring-2 overflow-hidden shrink-0",
            item.eigenaar === "sem" && "ring-teal-400/50 bg-autronis-card",
            item.eigenaar === "syb" && "ring-violet-400/50 bg-autronis-card",
            item.eigenaar === "team" && "ring-amber-400/50 bg-autronis-card",
          )}>
            {ownerAvatar ? (
              <Image src={ownerAvatar} alt={ownerNaam} width={36} height={36} className="w-full h-full object-cover" unoptimized />
            ) : (
              <span className={cn(
                "text-sm font-bold",
                item.eigenaar === "sem" && "text-teal-300",
                item.eigenaar === "syb" && "text-violet-300",
                item.eigenaar === "team" && "text-amber-300",
              )}>
                {item.eigenaar === "team" ? "T" : "S"}
              </span>
            )}
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-sm font-semibold text-autronis-text-primary truncate">{ownerNaam}</div>
            {item.gemaaktDoor === "bridge" && (
              <div className="text-[10px] uppercase tracking-wider text-autronis-accent inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                gepland door bridge
              </div>
            )}
          </div>
        </div>
      )}

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
          <div className="flex items-center gap-2 pt-1 flex-wrap">
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

      {/* Sales-pitch specifieke actie: markeer verstuurd → lead status 'offerte' */}
      {isPitchBlok && (
        <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 p-3 flex items-center justify-between gap-2">
          <div className="text-xs text-autronis-text-primary">
            Voorstel verstuurd? Lead gaat naar <span className="font-semibold">offerte</span>-status zodat Atlas het niet opnieuw plant.
          </div>
          <button
            type="button"
            onClick={markeerVerstuurd}
            disabled={verstuurBezig || verstuurd}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30 hover:bg-fuchsia-500/25 transition-colors disabled:opacity-50 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            {verstuurd ? "Verstuurd ✓" : verstuurBezig ? "Bezig..." : "Markeer verstuurd"}
          </button>
        </div>
      )}

      {/* Parallel-activiteit voor Claude-taken: wat Sem parallel kan doen */}
      {item.parallelActiviteit && (
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-purple-300 mb-1 inline-flex items-center gap-1">
            <Split className="w-3 h-3" />
            Parallel — terwijl Claude draait
          </div>
          <p className="text-xs text-autronis-text-primary whitespace-pre-wrap leading-relaxed">
            {item.parallelActiviteit}
          </p>
        </div>
      )}

      {/* AI context blurb — vrije tekst van Atlas over deze taak */}
      {item.aiContext && (
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-indigo-300 mb-1 inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI context
          </div>
          <p className="text-xs text-autronis-text-primary whitespace-pre-wrap leading-relaxed">
            {item.aiContext}
          </p>
        </div>
      )}

      {/* Stappenplan met AI tijdschatting per stap */}
      {stappen.length > 0 && (
        <div className="rounded-lg border border-autronis-border bg-autronis-card/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider text-autronis-text-secondary inline-flex items-center gap-1">
              <ListChecks className="w-3 h-3" />
              Stappenplan
            </div>
            {stappenTotaal > 0 && (
              <div className="text-[11px] text-autronis-text-secondary inline-flex items-center gap-1 tabular-nums">
                <Clock className="w-3 h-3" />
                {stappenTotaal} min totaal
              </div>
            )}
          </div>
          <ol className="space-y-1.5">
            {stappen.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="w-5 h-5 rounded-md bg-autronis-bg border border-autronis-border flex items-center justify-center text-[10px] font-semibold text-autronis-text-secondary shrink-0 tabular-nums">
                  {i + 1}
                </span>
                <span className="flex-1 text-autronis-text-primary leading-relaxed">
                  {s.stap}
                </span>
                <span className="text-[10px] text-autronis-text-secondary tabular-nums shrink-0 mt-0.5">
                  {s.duurMin}m
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Geschatte duur onafhankelijk van stappen (als alleen totaal gegeven) */}
      {!stappen.length && typeof item.geschatteDuurMinuten === "number" && item.geschatteDuurMinuten > 0 && (
        <div className="text-xs text-autronis-text-secondary inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          AI tijdschatting: <span className="text-autronis-text-primary font-medium tabular-nums">{item.geschatteDuurMinuten} min</span>
        </div>
      )}
    </div>
  );
}
