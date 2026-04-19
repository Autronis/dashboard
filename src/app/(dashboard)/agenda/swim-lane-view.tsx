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
const HEADER_HEIGHT_PX = 36;
const VRIJ_LANE_WIDTH_REM = 8;

function hourOffset(iso: string, dagStart: number): number {
  const d = new Date(iso);
  const h = d.getHours() + d.getMinutes() / 60;
  return (h - dagStart) * HOUR_HEIGHT_PX;
}

function Lane({
  testId,
  label,
  items,
  dagStart,
  totalHeight,
  onItemClick,
  widthClass,
}: {
  testId: string;
  label: string;
  items: Item[];
  dagStart: number;
  totalHeight: number;
  onItemClick?: (id: number) => void;
  widthClass: string;
}) {
  return (
    <div className={`relative border-r border-[var(--border)] ${widthClass}`} data-testid={testId}>
      <div
        className="sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)]"
        style={{ height: `${HEADER_HEIGHT_PX}px` }}
      >
        {label}
      </div>
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
          testId="lane-sem"
          label="Sem"
          items={semItems}
          dagStart={dagStart}
          totalHeight={totalHeight}
          onItemClick={onItemClick}
          widthClass="flex-1 min-w-0"
        />
        <Lane
          testId="lane-syb"
          label="Syb"
          items={sybItems}
          dagStart={dagStart}
          totalHeight={totalHeight}
          onItemClick={onItemClick}
          widthClass="flex-1 min-w-0"
        />
        <Lane
          testId="lane-vrij"
          label="Vrij"
          items={vrijItems}
          dagStart={dagStart}
          totalHeight={totalHeight}
          onItemClick={onItemClick}
          widthClass={`w-${VRIJ_LANE_WIDTH_REM * 4} min-w-[8rem]`}
        />

        {/* Lunch overlay — spans all lanes */}
        <div
          className="absolute left-0 right-0 bg-[var(--border)]/20 border-y border-[var(--border)] pointer-events-none flex items-center justify-center text-[11px] uppercase tracking-widest text-[var(--text-secondary)]"
          style={{ top: `${HEADER_HEIGHT_PX + lunchTop}px`, height: `${lunchHeight}px` }}
          data-testid="lunch-overlay"
        >
          lunch
        </div>

        {/* Team overlay — blocks positioned on top of sem + syb lanes (not vrij) */}
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
