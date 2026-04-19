"use client";

import { AgendaBlok, AgendaBlokProps } from "./agenda-blok";

type Item = AgendaBlokProps;

interface Props {
  datum: string; // "YYYY-MM-DD"
  items: Item[];
  dagStart?: number; // hour, default 8
  dagEind?: number; //  hour, default 19
  onItemClick?: (id: number) => void;
}

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

function LaneHeader({ kind }: { kind: keyof typeof LANE_CHARACTER }) {
  const c = LANE_CHARACTER[kind];
  return (
    <div
      className={`sticky top-0 z-10 bg-gradient-to-b ${c.bg} backdrop-blur border-b border-[var(--border)] px-3 flex items-center gap-2.5`}
      style={{ height: `${HEADER_HEIGHT_PX}px` }}
    >
      <div
        className={`relative flex items-center justify-center w-10 h-10 rounded-full ring-2 ${c.ring} ${c.shadow} shadow-lg bg-[var(--card)] font-bold text-base ${c.accent}`}
      >
        {c.initial}
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
}: {
  kind: keyof typeof LANE_CHARACTER;
  testId: string;
  items: Item[];
  dagStart: number;
  totalHeight: number;
  onItemClick?: (id: number) => void;
  widthClass: string;
}) {
  return (
    <div className={`relative border-r border-[var(--border)] ${widthClass}`} data-testid={testId}>
      <LaneHeader kind={kind} />
      <div className="relative" style={{ height: `${totalHeight}px` }}>
        {items.map((it) => (
          <div
            key={it.id}
            className="absolute left-1 right-1"
            style={{ top: `${hourOffset(it.startDatum, dagStart)}px` }}
          >
            <AgendaBlok {...it} onClick={onItemClick ? () => onItemClick(it.id) : undefined} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SwimLaneView({
  datum,
  items,
  dagStart = 8,
  dagEind = 19,
  onItemClick,
}: Props) {
  void datum; // reserved for later phases (project-focus day marker rendering)
  const totalHeight = (dagEind - dagStart) * HOUR_HEIGHT_PX;

  const semItems = items.filter((i) => i.eigenaar === "sem");
  const sybItems = items.filter((i) => i.eigenaar === "syb");
  const vrijItems = items.filter((i) => i.eigenaar === "vrij");
  const teamItems = items.filter((i) => i.eigenaar === "team");

  const hours: number[] = [];
  for (let h = dagStart; h <= dagEind; h++) hours.push(h);

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
          items={semItems}
          dagStart={dagStart}
          totalHeight={totalHeight}
          onItemClick={onItemClick}
          widthClass="flex-1 min-w-0"
        />
        <Lane
          kind="syb"
          testId="lane-syb"
          items={sybItems}
          dagStart={dagStart}
          totalHeight={totalHeight}
          onItemClick={onItemClick}
          widthClass="flex-1 min-w-0"
        />
        <Lane
          kind="vrij"
          testId="lane-vrij"
          items={vrijItems}
          dagStart={dagStart}
          totalHeight={totalHeight}
          onItemClick={onItemClick}
          widthClass="w-36 min-w-[9rem] shrink-0"
        />

        {/* Lunch overlay — spans all lanes */}
        <div
          className="absolute left-0 right-0 bg-[var(--border)]/20 border-y border-[var(--border)] pointer-events-none flex items-center justify-center text-[11px] uppercase tracking-widest text-[var(--text-secondary)]"
          style={{ top: `${HEADER_HEIGHT_PX + lunchTop}px`, height: `${lunchHeight}px` }}
          data-testid="lunch-overlay"
        >
          lunch
        </div>

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
