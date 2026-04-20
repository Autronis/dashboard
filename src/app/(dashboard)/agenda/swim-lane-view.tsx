"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AgendaBlok, AgendaBlokProps } from "./agenda-blok";

type Item = AgendaBlokProps;

interface Props {
  datum: string; // "YYYY-MM-DD"
  items: Item[];
  dagStart?: number; // hour, default 8
  dagEind?: number; //  hour — als undefined wordt dynamisch berekend uit items (max eind + 1u), met minimum 22
  onItemClick?: (id: number) => void;
  // Syb-lane is opt-in via feature flag `agenda_syb_lane`. Zolang Syb
  // niet actief bridge-plant (geen eigen Autro-Mac in bedrijf) is solo
  // mode schoner: alleen Sem-lane + Vrij. Default false.
  sybLaneVisible?: boolean;
}

type AvatarMap = Record<string, { naam: string; avatarUrl: string | null }>;

const HOUR_HEIGHT_PX = 96; // 1 hour = 96px (30m = 48px, matches AgendaBlok baseline)
const HEADER_HEIGHT_PX = 64;
const VRIJ_LANE_WIDTH_REM = 9;

// Per-persoon identiteit voor de lane-headers. Sem=Atlas krijgt autronis-teal
// (primaire merkkleur), Syb=Autro krijgt contrasterend warm paars, Team is
// een gradient van beide, Vrij is neutraal grijs. Bridge v2 phase 6 zal de
// live-dot hier hangen aan de chat-sync state (Atlas/Autro actief in
// Claude Code); voor nu is 'ie statisch als visueel anker.
const LANE_CHARACTER = {
  sem: {
    naam: "Sem",
    rol: "Atlas",
    initial: "S",
    bg: "from-teal-500/25 via-teal-500/10 to-transparent",
    ring: "ring-teal-400/50",
    accent: "text-teal-300",
    dot: "bg-teal-400",
    shadow: "shadow-teal-500/20",
  },
  syb: {
    naam: "Syb",
    rol: "Autro",
    initial: "S",
    bg: "from-purple-500/25 via-purple-500/10 to-transparent",
    ring: "ring-purple-400/50",
    accent: "text-purple-300",
    dot: "bg-purple-400",
    shadow: "shadow-purple-500/20",
  },
  vrij: {
    naam: "Vrij",
    rol: "Nog niet gepakt",
    initial: "?",
    bg: "from-[var(--border)]/40 via-[var(--border)]/10 to-transparent",
    ring: "ring-[var(--border)]",
    accent: "text-[var(--text-secondary)]",
    dot: "bg-[var(--text-secondary)]",
    shadow: "shadow-black/20",
  },
} as const;

function hourOffset(iso: string, dagStart: number): number {
  const d = new Date(iso);
  const h = d.getHours() + d.getMinutes() / 60;
  return (h - dagStart) * HOUR_HEIGHT_PX;
}

function LaneHeader({ kind, avatars }: { kind: keyof typeof LANE_CHARACTER; avatars: AvatarMap }) {
  const c = LANE_CHARACTER[kind];
  // /api/team/avatars levert al een fallback-URL naar /foto-sem.jpg of
  // /foto-syb.jpg als de DB-value null is. Hier alleen nog de 'vrij' lane
  // die geen foto heeft.
  const avatarUrl = kind === "sem" || kind === "syb" ? avatars[kind]?.avatarUrl ?? null : null;
  const naam = kind === "sem" || kind === "syb" ? avatars[kind]?.naam ?? c.naam : c.naam;

  return (
    <div
      className={`sticky top-0 z-10 bg-gradient-to-b ${c.bg} backdrop-blur border-b border-[var(--border)] px-3 flex items-center gap-2.5`}
      style={{ height: `${HEADER_HEIGHT_PX}px` }}
    >
      <div
        className={`relative flex items-center justify-center w-10 h-10 rounded-full ring-2 ${c.ring} ${c.shadow} shadow-lg bg-[var(--card)] font-bold text-base ${c.accent} overflow-hidden`}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={naam}
            width={40}
            height={40}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <span>{c.initial}</span>
        )}
        {/* Live-indicator placeholder — bridge v2 phase 6 sluit 'm aan op
            chat-sync state (Atlas/Autro actief in Claude Code). */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${c.dot} ring-2 ring-[var(--bg)]`}
          title={`${c.rol} — live indicator (placeholder, volgt bridge phase 6)`}
        />
      </div>
      <div className="flex flex-col leading-tight min-w-0">
        <span className={`text-base font-bold ${c.accent} truncate`}>{c.naam}</span>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] truncate">
          {c.rol}
        </span>
      </div>
    </div>
  );
}

function Lane({
  kind,
  testId,
  items,
  dagStart,
  totalHeight,
  onItemClick,
  widthClass,
  avatars,
}: {
  kind: keyof typeof LANE_CHARACTER;
  testId: string;
  items: Item[];
  dagStart: number;
  totalHeight: number;
  onItemClick?: (id: number) => void;
  widthClass: string;
  avatars: AvatarMap;
}) {
  return (
    <div className={`relative border-r border-[var(--border)] ${widthClass}`} data-testid={testId}>
      <LaneHeader kind={kind} avatars={avatars} />
      <div className="relative" style={{ height: `${totalHeight}px` }}>
        {items.map((it) => {
          const hasParallel = !!it.parallelActiviteit;
          const top = hourOffset(it.startDatum, dagStart);
          const heightMins = it.eindDatum
            ? Math.max(15, Math.round((new Date(it.eindDatum).getTime() - new Date(it.startDatum).getTime()) / 60000))
            : 30;
          const blockHeight = Math.max(32, Math.round(heightMins * 1.6));

          if (!hasParallel) {
            return (
              <div
                key={it.id}
                className="absolute left-1 right-1"
                style={{ top: `${top}px` }}
              >
                <AgendaBlok {...it} onClick={onItemClick ? () => onItemClick(it.id) : undefined} />
              </div>
            );
          }

          // Claude-taak met parallel werk → split in twee halve-breedte
          // blokken. Links = Claude (het echte agendaItem), rechts = parallel
          // activiteit-kaart (visueel, klik opent zelfde modal).
          return (
            <div
              key={it.id}
              className="absolute left-1 right-1 flex gap-1"
              style={{ top: `${top}px`, height: `${blockHeight}px` }}
            >
              <div className="flex-1 min-w-0">
                <AgendaBlok {...it} onClick={onItemClick ? () => onItemClick(it.id) : undefined} />
              </div>
              <button
                type="button"
                onClick={onItemClick ? () => onItemClick(it.id) : undefined}
                className="relative flex-1 min-w-0 text-left rounded-md border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition-colors pl-2.5 pr-1.5 pt-4 pb-1.5 overflow-hidden"
                style={{ height: `${blockHeight}px`, borderLeft: "3px solid #a855f7" }}
                data-testid="parallel-blok"
              >
                <span className="absolute top-1 left-2 text-[9px] uppercase tracking-wider font-semibold text-purple-300 leading-none">
                  ⋔ Parallel
                </span>
                <div className="text-[11px] text-autronis-text-primary leading-snug line-clamp-3">
                  {it.parallelActiviteit}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SwimLaneView({
  datum,
  items,
  dagStart = 8,
  dagEind,
  onItemClick,
  sybLaneVisible = false,
}: Props) {
  // Dynamische dagEind: pak max eindtijd uit items + 1 uur, met minimum van
  // 22:00 zodat avondsessies (bv. di/do/vr avondwerk) altijd zichtbaar zijn.
  // Als caller expliciet dagEind doorgeeft, respecteren we die.
  const computedDagEind = (() => {
    if (typeof dagEind === "number") return dagEind;
    let max = 22;
    for (const it of items) {
      if (!it.eindDatum) continue;
      const d = new Date(it.eindDatum);
      const h = d.getHours() + (d.getMinutes() > 0 ? 1 : 0);
      if (h > max) max = h;
    }
    return Math.min(24, max);
  })();

  // Fetch avatars voor Sem + Syb lanes (éénmalig bij mount).
  const [avatars, setAvatars] = useState<AvatarMap>({});
  useEffect(() => {
    fetch("/api/team/avatars")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.avatars) setAvatars(json.avatars);
      })
      .catch(() => { /* silent fallback: initialen blijven zichtbaar */ });
  }, []);

  // Current-time lijn: alleen zichtbaar als de getoonde dag vandaag is en
  // de tijd binnen het dagStart-dagEind-venster valt.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const vandaagStr = now.toISOString().slice(0, 10);
  const isVandaagDatum = vandaagStr === datum;
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const showNowLine = isVandaagDatum && nowHour >= dagStart && nowHour <= computedDagEind;
  const nowTop = (nowHour - dagStart) * HOUR_HEIGHT_PX;

  // Voeg ~half uur tail-room onderaan zodat de laatste uur-label én blokken die
  // precies op dagEind eindigen (bv. 21:30-22:00 avondsessie) niet tegen de
  // onderrand worden geknipt.
  const totalHeight = (computedDagEind - dagStart) * HOUR_HEIGHT_PX + 48;

  // In solo-modus (Syb niet actief) vouwen we syb-items + team-items samen
  // onder Sem. Team-items houden wel hun paarse ring zodat ze visueel
  // herkenbaar blijven als gedeeld werk zodra Autro weer aansluit.
  const semItems = sybLaneVisible
    ? items.filter((i) => i.eigenaar === "sem")
    : items.filter((i) => i.eigenaar === "sem" || i.eigenaar === "syb");
  const sybItems = sybLaneVisible ? items.filter((i) => i.eigenaar === "syb") : [];
  const vrijItems = items.filter((i) => i.eigenaar === "vrij");
  const teamItems = sybLaneVisible ? items.filter((i) => i.eigenaar === "team") : [];
  const soloTeamItems = sybLaneVisible ? [] : items.filter((i) => i.eigenaar === "team");

  const hours: number[] = [];
  for (let h = dagStart; h <= computedDagEind; h++) hours.push(h);

  // Lunch overlay: 12:30-13:30
  const lunchTop = (12.5 - dagStart) * HOUR_HEIGHT_PX;
  const lunchHeight = HOUR_HEIGHT_PX;

  return (
    <div className="flex w-full border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg)]">
      {/* Time ruler */}
      <div className="w-14 shrink-0 border-r border-[var(--border)]">
        <div
          className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur"
          style={{ height: `${HEADER_HEIGHT_PX}px` }}
        />
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          {hours.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 text-[11px] tabular-nums text-[var(--text-secondary)] pr-1 text-right"
              style={{ top: `${(h - dagStart) * HOUR_HEIGHT_PX - 6}px` }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
      </div>

      {/* Lanes container — positioned relative for team + lunch overlays */}
      <div className="flex flex-1 relative">
        <Lane
          kind="sem"
          testId="lane-sem"
          items={[...semItems, ...soloTeamItems]}
          dagStart={dagStart}
          totalHeight={totalHeight}
          onItemClick={onItemClick}
          widthClass="flex-1 min-w-0"
          avatars={avatars}
        />
        {sybLaneVisible && (
          <Lane
            kind="syb"
            testId="lane-syb"
            items={sybItems}
            dagStart={dagStart}
            totalHeight={totalHeight}
            onItemClick={onItemClick}
            widthClass="flex-1 min-w-0"
            avatars={avatars}
          />
        )}
        <Lane
          kind="vrij"
          testId="lane-vrij"
          items={vrijItems}
          dagStart={dagStart}
          totalHeight={totalHeight}
          onItemClick={onItemClick}
          widthClass="w-36 min-w-[9rem] shrink-0"
          avatars={avatars}
        />

        {/* Lunch overlay — spans all lanes */}
        <div
          className="absolute left-0 right-0 bg-[var(--border)]/20 border-y border-[var(--border)] pointer-events-none flex items-center justify-center text-[11px] uppercase tracking-widest text-[var(--text-secondary)]"
          style={{ top: `${HEADER_HEIGHT_PX + lunchTop}px`, height: `${lunchHeight}px` }}
          data-testid="lunch-overlay"
        >
          lunch
        </div>

        {/* Current-time indicator: rode lijn die over alle lanes loopt,
            zichtbaar wanneer de getoonde dag vandaag is en de tijd in het
            dag-venster valt. */}
        {showNowLine && (
          <div
            className="absolute left-0 right-0 pointer-events-none z-20"
            style={{ top: `${HEADER_HEIGHT_PX + nowTop}px` }}
            data-testid="now-line"
          >
            <div className="relative h-0.5 bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]">
              <span className="absolute -left-1 -top-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-[var(--bg)]" />
              <span className="absolute right-2 -top-3.5 text-[10px] font-semibold text-rose-400 tabular-nums">
                {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
              </span>
            </div>
          </div>
        )}

        {/* Team blocks positioned on top of sem + syb lanes (not vrij) */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: `${HEADER_HEIGHT_PX}px`,
            left: 0,
            right: 0,
            height: `${totalHeight}px`,
          }}
          data-testid="team-overlay"
        >
          {teamItems.map((it) => (
            <div
              key={it.id}
              className="absolute pointer-events-auto"
              style={{
                top: `${hourOffset(it.startDatum, dagStart)}px`,
                left: "0.25rem",
                // leave room for the vrij lane on the right
                right: `calc(${VRIJ_LANE_WIDTH_REM}rem + 0.25rem)`,
              }}
            >
              <AgendaBlok {...it} onClick={onItemClick ? () => onItemClick(it.id) : undefined} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
